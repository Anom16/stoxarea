"""
ml/pipeline/inference_shap.py
-----------------------------
Tugas:
  1. Membaca data fitur terbaru (is_latest == True) untuk setiap emiten.
  2. Melakukan inferensi menggunakan model XGBoost (AI Score).
  3. Menghitung SHAP Values untuk mengekstrak 3 fitur paling berpengaruh per saham.
  4. Menyimpan hasilnya (AI Score + Insight) ke JSON agar bisa dibaca backend FastAPI.
"""

import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import json
import logging
import joblib
from pathlib import Path
from app.core.config import settings

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/inference_shap.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

INPUT_PATH  = Path("data/processed/features_targets.csv")
MODEL_PATH  = Path(settings.MODEL_PATH)   # ← pakai config, bukan hardcode
OUTPUT_PATH = Path(settings.AI_SCORES_PATH)

FEATURES = [
    "log_ret_1d", "log_ret_5d",
    "ma_20_dist", "ma_50_dist",
    "bb_width", "bb_position",
    "rsi_14",
    "macd_norm", "macd_signal_norm", "macd_hist_norm",
    "vol_ma_ratio",
]

# Mapping fitur ke nama yang lebih mudah dipahami user (Human Readable)
FEATURE_NAMES = {
    "log_ret_1d":       "Hasil Naik-Turun Harian",
    "log_ret_5d":       "Tren Pergerakan 5 Hari Terakhir",
    "ma_20_dist":       "Posisi Harga vs Rata-rata 20 Hari (MA-20)",
    "ma_50_dist":       "Posisi Harga vs Rata-rata 50 Hari (MA-50)",
    "bb_width":         "Gejolak Rentang Harga (Bollinger Bands)",
    "bb_position":      "Posisi Harga di Batas Atas/Bawah (Bollinger)",
    "rsi_14":           "Kekuatan Jenuh Beli/Jual (RSI)",
    "macd_norm":        "Kekuatan Tren Pergerakan (MACD)",
    "macd_signal_norm": "Sinyal Pemicu Tren (MACD Signal)",
    "macd_hist_norm":   "Selisih Kekuatan Tren (MACD Histogram)",
    "vol_ma_ratio":     "Lonjakan Volume Transaksi",
}

def format_insight(feature_name: str, shap_val: float) -> str:
    """Mengubah SHAP value menjadi kalimat insight sederhana."""
    direction = "mendukung potensi kenaikan harga" if shap_val > 0 else "menekan potensi kenaikan harga"
    human_name = FEATURE_NAMES.get(feature_name, feature_name)
    return f"{human_name} {direction} saham."

def run():
    if not INPUT_PATH.exists() or not MODEL_PATH.exists():
        logger.error("Dataset atau Model tidak ditemukan. Jalankan pipeline sebelumnya.")
        return

    logger.info("Memuat data inferensi terbaru...")
    df = pd.read_csv(INPUT_PATH)
    
    # Ambil baris terbaru untuk tiap ticker
    inference_df = df[df["is_latest"]].copy()
    inference_df = inference_df.dropna(subset=FEATURES)
    
    if inference_df.empty:
        logger.error("Tidak ada data inferensi yang valid.")
        return
        
    tickers = inference_df["ticker"].values
    X_infer = inference_df[FEATURES]
    
    logger.info("Memuat model XGBoost (Calibrated)...")
    model = joblib.load(MODEL_PATH)
    
    # 1. Inferensi (AI Score = Probabilitas kelas 1)
    logger.info("Memproses AI Score...")
    proba = model.predict_proba(X_infer)[:, 1]  # Probabilitas naik > 5%
    
    # 2. SHAP Explainability
    logger.info("Menghitung SHAP Values untuk transparansi AI...")
    
    # Untuk CalibratedClassifierCV, kita ambil salah satu estimator dasar untuk SHAP
    # karena TreeExplainer butuh objek booster asli.
    if hasattr(model, "calibrated_classifiers_"):
        base_model_for_shap = model.calibrated_classifiers_[0].estimator
    else:
        base_model_for_shap = model

    explainer = shap.TreeExplainer(base_model_for_shap)
    shap_values = explainer.shap_values(X_infer)
    
    # XGBoost classifier kadang mereturn list untuk binary (tergantung versi), kadang array.
    if isinstance(shap_values, list):
        shap_values = shap_values[1]  # Ambil class 1
        
    results = {}
    
    for i, ticker in enumerate(tickers):
        score = float(proba[i])
        
        # Ambil SHAP value untuk saham ini
        sv = shap_values[i]
        
        # Cari 3 fitur dengan kontribusi absolut terbesar
        abs_sv = np.abs(sv)
        top_3_idx = np.argsort(abs_sv)[-3:][::-1]  # Sort dari yang terbesar
        
        insights = []
        for idx in top_3_idx:
            feat_name = FEATURES[idx]
            val = sv[idx]
            if abs(val) > 0.01:  # Hanya masukkan insight jika cukup signifikan
                insights.append({
                    "feature": feat_name,
                    "contribution": float(val),
                    "description": format_insight(feat_name, val)
                })
        
        results[ticker] = {
            "ai_score": round(score, 4),
            "ai_score_percent": f"{score * 100:.1f}%",
            "insights": insights,
            "last_updated": str(pd.Timestamp.now())
        }
    
    # Simpan ke JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4)
        
    logger.info(f"✅ Inferensi & SHAP selesai untuk {len(results)} ticker!")
    logger.info(f"Data disimpan ke: {OUTPUT_PATH}")
    
    # Tampilkan top 3 saham sebagai preview
    logger.info("\n=== Top 3 Rekomendasi Momentum Hari Ini ===")
    top_tickers = sorted(results.items(), key=lambda x: x[1]['ai_score'], reverse=True)[:3]
    for rank, (ticker, data) in enumerate(top_tickers, 1):
        logger.info(f"{rank}. {ticker} (Score: {data['ai_score_percent']})")
        if data["insights"]:
            logger.info(f"   Alasan utama: {data['insights'][0]['description']}")
    logger.info("===========================================")

if __name__ == "__main__":
    run()
