"""
ml/pipeline/features.py
-----------------------
Tugas:
  1. Membaca data OHLCV historis dari data/raw/ohlcv/.
  2. Melakukan Feature Engineering (Teknikal).
  3. Menghasilkan label klasifikasi (Target 5 Hari > 5%).
  4. Menggabungkan seluruh data emiten ke dalam satu dataset training.

Input: data/raw/ohlcv/*.csv
Output: data/processed/features_targets.csv
"""

import pandas as pd
import numpy as np
import json
import logging
from pathlib import Path
from ml.features.technical_indicators import compute_rsi, compute_macd

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
TARGET_PROFIT_PCT   = 0.0  # 0% (Hanya perlu naik, tanpa threshold)



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
    
    # ── Feature Engineering ──
    # 1. Log Returns
    df["log_ret_1d"] = np.log(close / close.shift(1))
    df["log_ret_5d"] = np.log(close / close.shift(5))
    
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
    
    # 5. MACD
    macd, macd_signal, macd_hist = compute_macd(close)
    # Normalisasi MACD dengan membaginya terhadap Close agar bisa diperbandingkan antar saham
    df["macd_norm"] = macd / close
    df["macd_signal_norm"] = macd_signal / close
    df["macd_hist_norm"] = macd_hist / close
    
    # 6. Volume Momentum
    vol_ma_20 = df["Volume"].rolling(20).mean()
    df["vol_ma_ratio"] = df["Volume"] / vol_ma_20
    
    # ── Target Generation ──
    # FIX #2: Perbaikan data leakage pada label target.
    #
    # BUG LAMA (SALAH):
    #   high.rolling(window=5).max().shift(-5)
    #   → rolling() mengambil window [t-4, t-3, t-2, t-1, t] (termasuk hari ini & masa lalu)
    #   → shift(-5) hanya menggeser posisi baris, BUKAN mengambil masa depan murni
    #   → Hasilnya: label di baris t mencerminkan max(high[t-9]...high[t-5]), bukan masa depan
    #
    # SEBELUMNYA:
    #   high.shift(-1).rolling(5).max()
    #   → Ini juga BOCOR! Karena rolling(5) di pandas selalu backward-looking,
    #     maka pada hari t, ia menghitung max dari shift(-1) pada hari t-4, t-3, t-2, t-1, t.
    #     Yang berarti max(high[t-3], high[t-2], high[t-1], high[t], high[t+1]).
    #     Ini membocorkan data masa lalu dan hari ini (high[t-3]..high[t]) ke target hari ini!
    #
    # SOLUSI BEBAS LEAKAGE (BENAR):
    #   Menggeser hasil rolling max kembali ke atas sebanyak (horizon - 1) hari.
    #   Untuk horizon 5 hari, kita shift(-4) setelah rolling.
    #   Hasilnya: target hari t = max(high[t+1], high[t+2], high[t+3], high[t+4], high[t+5]).
    #   Murni masa depan!
    # Ambil harga Close tepat 5 hari ke depan
    future_close = close.shift(-TARGET_HORIZON_DAYS)

    # Label 1 jika future close > 0% dari close hari ini (naik)
    target_pct = (future_close - close) / close

    # Biarkan NaN tetap NaN (baris 5 terakhir tidak punya label valid)
    df["target_5d_up"] = np.where(
        target_pct.isna(),
        np.nan,
        (target_pct > TARGET_PROFIT_PCT).astype(int)
    )
    
    # Tandai baris terbaru untuk inferensi
    df["is_latest"] = False
    df.loc[df.index[-1], "is_latest"] = True
    
    # Drop baris awal yang NaN akibat kalkulasi MA50
    df = df.dropna(subset=["ma_50_dist", "rsi_14"]).copy()
    
    # Untuk data training (bukan baris terakhir), pastikan target tidak NaN (yaitu 5 hari sebelum hari ini)
    # Tapi kita ingin inference data (terakhir) tetap masuk dataset meskipun targetnya NaN
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
    
    logger.info("\n=== Distribusi Target (Training) ===")
    logger.info(f"0 (Gagal capai 5%) : {target_counts.get(0, 0)} baris")
    logger.info(f"1 (Tembus >5%)     : {target_counts.get(1, 0)} baris")
    logger.info(f"Positive Rate      : {pos_rate:.2f}%")
    logger.info("====================================")

if __name__ == "__main__":
    run()
