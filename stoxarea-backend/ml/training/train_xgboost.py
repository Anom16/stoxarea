import pandas as pd
import numpy as np
import xgboost as xgb
import logging
import joblib
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, accuracy_score, precision_score, roc_auc_score

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/train_xgboost.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

INPUT_PATH  = Path("data/processed/features_targets.csv")
MODEL_DIR   = Path("models")
MODEL_PATH  = MODEL_DIR / "xgb_model.pkl"

FEATURES = [
    "log_ret_1d", "log_ret_5d",
    "ma_20_dist", "ma_50_dist",
    "bb_width", "bb_position",
    "rsi_14",
    "macd_norm", "macd_signal_norm", "macd_hist_norm",
    "vol_ma_ratio",
    "atr_norm",
    "obv_norm",
    "stoch_k", "stoch_d",
    "is_doji", "is_hammer", "is_bullish_engulfing",
    "is_bearish_engulfing", "is_shooting_star", "is_morning_star",
]
TARGET = "target_5d_up"

def run():
    if not INPUT_PATH.exists():
        logger.error(f"File {INPUT_PATH} tidak ditemukan. Jalankan feature_engineering.py terlebih dahulu.")
        return

    logger.info("Memuat dataset training...")
    df = pd.read_csv(INPUT_PATH)
    
    # Konversi Date ke datetime dan urutkan waktu dari terlama ke terbaru
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)
    
    # Ambil hanya data untuk training (is_latest == False)
    train_df = df[~df["is_latest"]].copy()
    
    # Pastikan tidak ada NaN pada target & fitur
    train_df = train_df.dropna(subset=[TARGET] + FEATURES)
    
    X = train_df[FEATURES]
    y = train_df[TARGET]
    
    logger.info(f"Total sampel latih: {len(X):,}")
    
    n_neg = int((y == 0).sum())
    n_pos = int((y == 1).sum())
    if n_pos == 0:
        logger.error("Tidak ada sampel positif (kelas 1) di data training. Periksa label generation.")
        return

    scale_pos_weight = min(5.0, max(0.5, n_neg / n_pos))
    logger.info(f"Class distribution — Kelas 0: {n_neg:,}, Kelas 1: {n_pos:,}")
    logger.info(f"scale_pos_weight = {scale_pos_weight:.4f}")

    # ── Grid Search Hyperparameter via TimeSeriesSplit ─────────────────────────
    logger.info("\n🔍 Memulai Grid Search Hyperparameter dengan Walk-Forward CV (5 Splits)...")
    param_grid = [
        {"max_depth": 3, "subsample": 0.75, "colsample_bytree": 0.75, "gamma": 0.1, "learning_rate": 0.05},
        {"max_depth": 4, "subsample": 0.75, "colsample_bytree": 0.75, "gamma": 0.1, "learning_rate": 0.05},
        {"max_depth": 5, "subsample": 0.80, "colsample_bytree": 0.80, "gamma": 0.1, "learning_rate": 0.03},
        {"max_depth": 6, "subsample": 0.70, "colsample_bytree": 0.70, "gamma": 0.2, "learning_rate": 0.03},
    ]

    tscv = TimeSeriesSplit(n_splits=5)
    best_score = -1.0
    best_params = param_grid[1]  # Default fallback max_depth=4

    for p_idx, params in enumerate(param_grid):
        auc_scores = []
        for fold, (train_index, test_index) in enumerate(tscv.split(X)):
            X_tr, X_te = X.iloc[train_index], X.iloc[test_index]
            y_tr, y_te = y.iloc[train_index], y.iloc[test_index]
            
            model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=params["max_depth"],
                learning_rate=params["learning_rate"],
                subsample=params["subsample"],
                colsample_bytree=params["colsample_bytree"],
                gamma=params["gamma"],
                objective="binary:logistic",
                eval_metric="logloss",
                scale_pos_weight=scale_pos_weight,
                random_state=42,
                n_jobs=-1
            )
            model.fit(X_tr, y_tr)
            proba = model.predict_proba(X_te)[:, 1]
            try:
                auc_scores.append(roc_auc_score(y_te, proba))
            except Exception:
                pass
                
        mean_auc = np.mean(auc_scores) if auc_scores else 0
        logger.info(f"Candidate {p_idx+1}/{len(param_grid)}: {params} => Mean AUC-ROC: {mean_auc:.4f}")
        if mean_auc > best_score:
            best_score = mean_auc
            best_params = params

    logger.info(f"\n🏆 Hiperparameter Terbaik Terpilih: {best_params} (Mean AUC: {best_score:.4f})")

    # ── Final Training dengan Isotonic Calibration ──
    logger.info("\nMelatih model final menggunakan SELURUH data training dengan Hiperparameter Terbaik & Kalibrasi Isotonik...")
    base_model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=best_params["max_depth"],
        learning_rate=best_params["learning_rate"],
        subsample=best_params["subsample"],
        colsample_bytree=best_params["colsample_bytree"],
        gamma=best_params["gamma"],
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        n_jobs=-1
    )
    
    final_model = CalibratedClassifierCV(base_model, method='isotonic', cv=5)
    final_model.fit(X, y)
    
    final_preds = final_model.predict(X)
    logger.info("\nLaporan Performa di Training Data:")
    logger.info("\n" + classification_report(y, final_preds))
    
    # Feature Importance
    first_estimator = final_model.calibrated_classifiers_[0].estimator
    importance = first_estimator.feature_importances_
    feat_imp = pd.DataFrame({"Feature": FEATURES, "Importance": importance})
    feat_imp = feat_imp.sort_values(by="Importance", ascending=False)
    
    logger.info("\nTop 5 Fitur Paling Berpengaruh:")
    for idx, row in feat_imp.head(5).iterrows():
        logger.info(f"  {row['Feature']:<20}: {row['Importance']:.4f}")
    
    # ── Simpan Model ──
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_model, MODEL_PATH)
    logger.info(f"\n✅ Model XGBoost (Calibrated) berhasil disimpan di {MODEL_PATH}")

if __name__ == "__main__":
    run()
