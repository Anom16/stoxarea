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
import joblib
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit
from sklearn.calibration import CalibratedClassifierCV
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
MODEL_PATH  = MODEL_DIR / "xgb_model.pkl"

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
    
    # FIX #9: Tangani class imbalance dengan scale_pos_weight.
    #
    # BUG LAMA: Tidak ada penanganan imbalance. Untuk saham blue-chip BEI,
    # kenaikan 5% dalam 5 hari adalah kejadian langka → kelas 1 jauh lebih sedikit
    # dari kelas 0. Model yang dilatih tanpa penanganan ini akan bias ke kelas 0
    # (selalu prediksi "tidak naik") dan tetap mendapat akurasi tinggi secara statistik,
    # tapi precision untuk kelas 1 (yang kita butuhkan) mendekati 0.
    #
    # FIX: Hitung scale_pos_weight = count(kelas 0) / count(kelas 1).
    # XGBoost akan memberi bobot lebih tinggi pada sampel kelas minoritas (kelas 1)
    # sehingga model lebih sensitif terhadap sinyal momentum naik.
    n_neg = int((y == 0).sum())
    n_pos = int((y == 1).sum())
    if n_pos == 0:
        logger.error("Tidak ada sampel positif (kelas 1) di data training. Periksa label generation.")
        return

    scale_pos_weight = n_neg / n_pos
    logger.info(f"Class distribution — Kelas 0: {n_neg}, Kelas 1: {n_pos}")
    logger.info(f"scale_pos_weight = {scale_pos_weight:.2f} (bobot kompensasi imbalance)")
    
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
            scale_pos_weight=scale_pos_weight,  # FIX #9: kompensasi imbalance
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
    logger.info("Melatih model final menggunakan SELURUH data training (dengan Kalibrasi Isotonik)...")
    base_model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.05,
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=scale_pos_weight,  # FIX #9: kompensasi imbalance
        random_state=42,
        n_jobs=-1
    )
    
    # Wrap dengan Kalibrasi Isotonik
    final_model = CalibratedClassifierCV(base_model, method='isotonic', cv=5)
    final_model.fit(X, y)
    
    # Evaluasi di training set (sekadar referensi)
    final_preds = final_model.predict(X)
    logger.info("\nLaporan Performa di Training Data:")
    logger.info("\n" + classification_report(y, final_preds))
    
    # Feature Importance (Diambil dari estimator pertama di dalam CalibratedClassifierCV)
    # Catatan: CalibratedClassifierCV dengan cv=5 melatih 5 model. Kita ambil yang pertama sebagai perwakilan.
    first_estimator = final_model.calibrated_classifiers_[0].estimator
    importance = first_estimator.feature_importances_
    feat_imp = pd.DataFrame({"Feature": FEATURES, "Importance": importance})
    feat_imp = feat_imp.sort_values(by="Importance", ascending=False)
    
    logger.info("\nTop 5 Fitur Paling Berpengaruh (Estimator #1):")
    for idx, row in feat_imp.head(5).iterrows():
        logger.info(f"  {row['Feature']:<16}: {row['Importance']:.4f}")
    
    # ── Simpan Model ──
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_model, MODEL_PATH)
    logger.info(f"\n✅ Model XGBoost (Calibrated) berhasil disimpan di {MODEL_PATH}")

if __name__ == "__main__":
    run()
