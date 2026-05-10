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
from pathlib import Path

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
MODEL_PATH  = Path("models/xgb_model.json")
OUTPUT_PATH = Path("data/processed/ai_scores.json")

FEATURES = [
    "log_ret_1d", "log_ret_5d", "ma_20_dist", "ma_50_dist", 
    "bb_width", "bb_position", "rsi_14", 
    "macd_norm", "macd_signal_norm", "macd_hist_norm", 
    "vol_ma_ratio"
]

# Mapping fitur ke nama yang lebih mudah dipahami user (Human Readable)
FEATURE_NAMES = {
    "log_ret_1d": "Perubahan Harga Harian",
    "log_ret_5d": "Momentum Mingguan",
    "ma_20_dist": "Jarak ke Harga Rata-rata (MA20)",
    "ma_50_dist": "Trend Menengah (MA50)",
    "bb_width": "Volatilitas / Squeeze (BB)",
    "bb_position": "Posisi Harga (Bollinger)",
    "rsi_14": "Tingkat Kejenuhan Pasar (RSI)",
    "macd_norm": "Kekuatan Tren (MACD)",
    "macd_signal_norm": "Sinyal Tren (MACD)",
    "macd_hist_norm": "Akselerasi Tren (MACD Hist)",
    "vol_ma_ratio": "Lonjakan Volume"
}

def format_insight(feature_name: str, shap_val: float) -> str:
    """Mengubah SHAP value menjadi kalimat insight sederhana."""
    direction = "mendorong naik" if shap_val > 0 else "menekan turun"
    human_name = FEATURE_NAMES.get(feature_name, feature_name)
    return f"{human_name} {direction} probabilitas."

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
    
    logger.info("Memuat model XGBoost...")
    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH)
    
    # 1. Inferensi (AI Score = Probabilitas kelas 1)
    logger.info("Memproses AI Score...")
    proba = model.predict_proba(X_infer)[:, 1]  # Probabilitas naik > 5%
    
    # 2. SHAP Explainability
    logger.info("Menghitung SHAP Values untuk transparansi AI...")
    explainer = shap.TreeExplainer(model)
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
