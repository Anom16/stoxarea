"""
ml/pipeline/inference_shap.py
-----------------------------
Tugas:
  1. Membaca data fitur terbaru (is_latest == True) untuk setiap emiten.
  2. Melakukan inferensi menggunakan model XGBoost (Calibrated).
  3. Menggunakan probabilitas empiris murni 100% REAL (Calibrated Empirical Probability) sebagai AI Score.
  4. Menghitung SHAP Values untuk mengekstrak 3 fitur paling berpengaruh per saham.
  5. Menyimpan hasilnya ke JSON (data/processed/ai_scores.json).
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
MODEL_PATH  = Path(settings.MODEL_PATH)
OUTPUT_PATH = Path(settings.AI_SCORES_PATH)

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

FEATURE_NAMES = {
    "log_ret_1d":           "Hasil Perubahan Harian",
    "log_ret_5d":           "Tren Pergerakan 5 Hari Terakhir",
    "ma_20_dist":           "Posisi Harga vs Rata-rata 20 Hari (MA-20)",
    "ma_50_dist":           "Posisi Harga vs Rata-rata 50 Hari (MA-50)",
    "bb_width":             "Gejolak Rentang Harga (Bollinger Bands)",
    "bb_position":          "Posisi Harga di Batas Atas/Bawah (Bollinger)",
    "rsi_14":               "Kekuatan Jenuh Beli/Jual (RSI)",
    "macd_norm":            "Kekuatan Tren Pergerakan (MACD)",
    "macd_signal_norm":     "Sinyal Pemicu Tren (MACD Signal)",
    "macd_hist_norm":       "Selisih Kekuatan Tren (MACD Histogram)",
    "vol_ma_ratio":         "Lonjakan Volume Transaksi",
    "atr_norm":             "Tingkat Volatilitas Relatif (ATR)",
    "obv_norm":             "Tren Arus Akumulasi Transaksi (OBV)",
    "stoch_k":              "Kecepatan Momentum Harga (Stochastic %K)",
    "stoch_d":              "Sinyal Rata-rata Momentum (Stochastic %D)",
    "is_doji":              "Kondisi Keraguan Pasar (Pola Doji)",
    "is_hammer":            "Sinyal Pembalikan Positif (Pola Hammer)",
    "is_bullish_engulfing": "Pola Penguatan Kuat (Bullish Engulfing)",
    "is_bearish_engulfing": "Pola Penekanan Harga (Bearish Engulfing)",
    "is_shooting_star":     "Sinyal Penurunan Harga (Shooting Star)",
    "is_morning_star":      "Pola Pembalikan Arah Naik (Morning Star)",
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
    
    inference_df = df[df["is_latest"]].copy()
    inference_df = inference_df.dropna(subset=FEATURES)
    
    if inference_df.empty:
        logger.error("Tidak ada data inferensi yang valid.")
        return
        
    tickers = inference_df["ticker"].values
    X_infer = inference_df[FEATURES]
    
    logger.info("Memuat model XGBoost (Calibrated)...")
    model = joblib.load(MODEL_PATH)
    
    # Probabilitas 100% REAL dari CalibratedClassifierCV
    logger.info("Memproses Probabilitas AI 100% REAL...")
    raw_proba = model.predict_proba(X_infer)[:, 1]

    # SHAP Explainability
    logger.info("Menghitung SHAP Values untuk transparansi AI...")
    
    if hasattr(model, "calibrated_classifiers_"):
        base_model_for_shap = model.calibrated_classifiers_[0].estimator
    else:
        base_model_for_shap = model

    explainer = shap.TreeExplainer(base_model_for_shap)
    shap_values = explainer.shap_values(X_infer)
    
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
        
    results = {}
    
    for i, ticker in enumerate(tickers):
        raw_p = float(raw_proba[i])
        sv    = shap_values[i]
        
        abs_sv = np.abs(sv)
        top_3_idx = np.argsort(abs_sv)[-3:][::-1]
        
        insights = []
        for idx in top_3_idx:
            feat_name = FEATURES[idx]
            val = sv[idx]
            if abs(val) > 0.005:
                insights.append({
                    "feature": feat_name,
                    "contribution": float(val),
                    "description": format_insight(feat_name, val)
                })
        
        results[ticker] = {
            "ai_score": round(raw_p, 4),
            "ai_score_percent": f"{raw_p * 100:.1f}%",
            "insights": insights,
            "last_updated": str(pd.Timestamp.now())
        }
    
    # Simpan ke JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4)
        
    logger.info(f"✅ Inferensi & SHAP selesai untuk {len(results)} ticker!")
    logger.info(f"Data disimpan ke: {OUTPUT_PATH}")
    
    # Tampilkan top 5 saham sebagai preview
    logger.info("\n=== Top 5 Rekomendasi Probabilitas AI Murni 100% REAL ===")
    top_tickers = sorted(results.items(), key=lambda x: x[1]['ai_score'], reverse=True)[:5]
    for rank, (ticker, data) in enumerate(top_tickers, 1):
        logger.info(f"{rank}. {ticker:<8} | Probabilitas AI Murni: {data['ai_score_percent']}")
        if data["insights"]:
            logger.info(f"   Alasan utama: {data['insights'][0]['description']}")
    logger.info("=========================================================")

if __name__ == "__main__":
    run()
