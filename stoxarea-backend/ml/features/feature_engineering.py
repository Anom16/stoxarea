"""
ml/pipeline/features.py
-----------------------
Tugas:
  1. Membaca data OHLCV historis dari data/raw/ohlcv/.
  2. Melakukan Feature Engineering (Teknikal murni: Return, MA, BB, RSI, MACD, ATR, OBV, Stochastic, Candlesticks).
  3. Menghasilkan label klasifikasi berbasis ATR Dynamic Threshold (Random Walk Theory).
  4. Menggabungkan seluruh data emiten ke dalam satu dataset training.

Input: data/raw/ohlcv/*.csv
Output: data/processed/features_targets.csv
"""

import pandas as pd
import numpy as np
import json
import logging
from pathlib import Path
from ml.features.technical_indicators import (
    compute_rsi, compute_macd, compute_atr,
    compute_obv, compute_stochastic, detect_candlestick
)

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/features.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

INPUT_OHLCV_DIR = Path("data/raw/ohlcv")
TICKERS_PATH    = Path("data/tickers/tickers_filtered.json")
OUTPUT_PATH     = Path("data/processed/features_targets.csv")

# ── Parameter Target ──
TARGET_HORIZON_DAYS = 5

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

# ── Pemrosesan Per Ticker ──────────────────────────────────────────────────────
def process_ticker(ticker: str, file_path: Path) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    
    # Pastikan data terurut berdasarkan tanggal
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)
    
    if len(df) < 60:  # Butuh cukup data untuk MA50 dan MACD
        return pd.DataFrame()

    # Tambahkan kolom ticker agar bisa diidentifikasi saat digabung
    df["ticker"] = ticker

    close = df["Close"]
    high  = df["High"]
    low   = df["Low"]
    
    # ── Feature Engineering ──
    # 1. Log Returns
    df["log_ret_1d"] = np.log(close / close.shift(1))
    df["log_ret_5d"] = np.log(close / close.shift(5))
    df["log_ret_14d"] = np.log(close / close.shift(14))
    df["log_ret_30d"] = np.log(close / close.shift(30))
    
    # 2. Moving Averages (Jarak Persentase terhadap MA)
    ma_20 = close.rolling(20).mean()
    ma_50 = close.rolling(50).mean()
    df["ma_20_dist"] = (close - ma_20) / ma_20
    df["ma_50_dist"] = (close - ma_50) / ma_50
    
    # 3. Bollinger Bands (20, 2)
    std_20 = close.rolling(20).std()
    bb_upper = ma_20 + (std_20 * 2)
    bb_lower = ma_20 - (std_20 * 2)
    df["bb_width"] = (bb_upper - bb_lower) / ma_20
    df["bb_position"] = (close - bb_lower) / (bb_upper - bb_lower) # 0 = di bawah, 1 = di atas
    
    # 4. RSI (14)
    df["rsi_14"] = compute_rsi(close, 14)
    df["rsi_zscore"] = (df["rsi_14"] - df["rsi_14"].rolling(30).mean()) / df["rsi_14"].rolling(30).std()
    
    # 5. MACD
    macd, macd_signal, macd_hist = compute_macd(close)
    df["macd_norm"] = macd / close
    df["macd_signal_norm"] = macd_signal / close
    df["macd_hist_norm"] = macd_hist / close
    df["macd_hist_zscore"] = (df["macd_hist_norm"] - df["macd_hist_norm"].rolling(30).mean()) / df["macd_hist_norm"].rolling(30).std()
    
    # 6. ATR & Candlestick Patterns
    df["atr_14"] = compute_atr(high, low, close, 14)
    df["atr_norm"] = df["atr_14"] / close
    df = detect_candlestick(df)
    
    # 7. Volume Momentum & OBV
    vol_ma_20 = df["Volume"].rolling(20).mean()
    df["vol_ma_ratio"] = df["Volume"] / vol_ma_20
    df["obv_norm"] = compute_obv(close, df["Volume"])

    # 8. Stochastic Oscillator (%K, %D)
    stoch_k, stoch_d = compute_stochastic(high, low, close)
    df["stoch_k"] = stoch_k
    df["stoch_d"] = stoch_d

    # ── Target Generation (ATR Dynamic Threshold - Random Walk Theory) ──
    future_close = close.shift(-TARGET_HORIZON_DAYS)
    target_pct = (future_close - close) / close

    # Dynamic Threshold per saham berdasarkan volatilitas ATR 5 hari
    df["dynamic_threshold"] = df["atr_norm"] * np.sqrt(TARGET_HORIZON_DAYS) * 1.0

    # Label 1 jika return 5 hari melampaui ATR dynamic threshold
    df["target_5d_up"] = np.where(
        target_pct.isna(),
        np.nan,
        (target_pct > df["dynamic_threshold"]).astype(int)
    )
    
    # Tandai baris terbaru untuk inferensi
    df["is_latest"] = False
    df.loc[df.index[-1], "is_latest"] = True
    
    # Drop baris awal yang NaN akibat kalkulasi MA50 dan indikator lain
    df = df.dropna(subset=["ma_50_dist", "rsi_14", "stoch_d", "obv_norm"]).copy()
    
    # Untuk data training (bukan baris terakhir), pastikan target tidak NaN
    is_training = ~df["is_latest"]
    is_target_nan = df["target_5d_up"].isna()
    
    # Simpan hanya baris yang punya target, ATAU yang merupakan baris terbaru
    df = df[~(is_training & is_target_nan)].copy()
    
    return df

# ── Main Runner ────────────────────────────────────────────────────────────────
def run():
    if not TICKERS_PATH.exists():
        logger.error(f"File {TICKERS_PATH} tidak ditemukan.")
        return
        
    with open(TICKERS_PATH, "r", encoding="utf-8") as f:
        tickers = json.load(f)
        
    all_data = []
    
    logger.info(f"Mulai pemrosesan fitur untuk {len(tickers)} emiten...")
    
    for ticker in tickers:
        file_path = INPUT_OHLCV_DIR / f"{ticker}.csv"
        if file_path.exists():
            df_ticker = process_ticker(ticker, file_path)
            if not df_ticker.empty:
                all_data.append(df_ticker)
        else:
            logger.warning(f"File OHLCV untuk {ticker} tidak ditemukan.")
            
    if not all_data:
        logger.error("Tidak ada data yang diproses.")
        return
        
    combined_df = pd.concat(all_data, ignore_index=True)
    
    # Simpan dataset
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    combined_df.to_csv(OUTPUT_PATH, index=False)
    
    # Statistik Singkat
    train_data = combined_df[~combined_df["is_latest"]]
    inference_data = combined_df[combined_df["is_latest"]]
    
    logger.info("✅ Feature Engineering selesai!")
    logger.info(f"Total baris data training : {len(train_data)}")
    logger.info(f"Total baris inferensi     : {len(inference_data)}")
    
    # Distribusi Target
    target_counts = train_data["target_5d_up"].value_counts()
    pos_rate = target_counts.get(1, 0) / len(train_data) * 100
    
    logger.info("\n=== Distribusi Target (ATR Dynamic Threshold) ===")
    logger.info(f"0 (Dibawah Dynamic ATR Threshold) : {target_counts.get(0, 0)} baris")
    logger.info(f"1 (Tembus Dynamic ATR Threshold)   : {target_counts.get(1, 0)} baris")
    logger.info(f"Positive Rate                      : {pos_rate:.2f}%")
    logger.info("================================================")

if __name__ == "__main__":
    run()
