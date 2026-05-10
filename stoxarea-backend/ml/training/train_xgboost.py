"""
ml/pipeline/train_xgboost.py
----------------------------
Tugas:
  1. Melatih model XGBoost Classifier menggunakan dataset fitur teknikal.
  2. Menggunakan Walk-Forward Validation (TimeSeriesSplit) untuk menguji model.
  3. Menyimpan model ke disk untuk inferensi harian.
"""

import pandas as pd
import numpy as np
import xgboost as xgb
import logging
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import classification_report, accuracy_score, precision_score

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
MODEL_PATH  = MODEL_DIR / "xgb_model.json"

FEATURES = [
    "log_ret_1d", "log_ret_5d", "ma_20_dist", "ma_50_dist", 
    "bb_width", "bb_position", "rsi_14", 
    "macd_norm", "macd_signal_norm", "macd_hist_norm", 
    "vol_ma_ratio"
]
TARGET = "target_5d_up"

def run():
    if not INPUT_PATH.exists():
        logger.error(f"File {INPUT_PATH} tidak ditemukan. Jalankan features.py terlebih dahulu.")
        return

    logger.info("Memuat dataset training...")
    df = pd.read_csv(INPUT_PATH)
    
    # Konversi Date ke datetime dan urutkan waktu dari terlama ke terbaru
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)
    
    # Ambil hanya data untuk training (is_latest == False)
    train_df = df[~df["is_latest"]].copy()
    
    # Pastikan tidak ada NaN pada target
    train_df = train_df.dropna(subset=[TARGET] + FEATURES)
    
    X = train_df[FEATURES]
    y = train_df[TARGET]
    
    logger.info(f"Total sampel latih: {len(X)}")
    
    # ── Walk-Forward Validation (Time Series Split) ──
    logger.info("Memulai Walk-Forward Validation (5 Splits)...")
    tscv = TimeSeriesSplit(n_splits=5)
    
    precisions = []
    accuracies = []
    
    for fold, (train_index, test_index) in enumerate(tscv.split(X)):
        X_train, X_test = X.iloc[train_index], X.iloc[test_index]
        y_train, y_test = y.iloc[train_index], y.iloc[test_index]
        
        # Inisialisasi model
        model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1
        )
        
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        
        acc = accuracy_score(y_test, preds)
        prec = precision_score(y_test, preds, zero_division=0)
        
        accuracies.append(acc)
        precisions.append(prec)
        logger.info(f"Fold {fold+1} | Accuracy: {acc:.4f} | Precision: {prec:.4f}")
        
    logger.info(f"=== Hasil Validasi Rata-rata ===")
    logger.info(f"Mean Accuracy  : {np.mean(accuracies):.4f}")
    logger.info(f"Mean Precision : {np.mean(precisions):.4f}")
    logger.info("================================")
    
    # ── Final Training di Seluruh Data ──
    logger.info("Melatih model final menggunakan SELURUH data training...")
    final_model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.05,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1
    )
    final_model.fit(X, y)
    
    # Evaluasi di training set (sekadar referensi)
    final_preds = final_model.predict(X)
    logger.info("\nLaporan Performa di Training Data:")
    logger.info("\n" + classification_report(y, final_preds))
    
    # Feature Importance
    importance = final_model.feature_importances_
    feat_imp = pd.DataFrame({"Feature": FEATURES, "Importance": importance})
    feat_imp = feat_imp.sort_values(by="Importance", ascending=False)
    
    logger.info("\nTop 5 Fitur Paling Berpengaruh:")
    for idx, row in feat_imp.head(5).iterrows():
        logger.info(f"  {row['Feature']:<16}: {row['Importance']:.4f}")
    
    # ── Simpan Model ──
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    final_model.save_model(MODEL_PATH)
    logger.info(f"\n✅ Model XGBoost berhasil disimpan di {MODEL_PATH}")

if __name__ == "__main__":
    run()
