# Tarik OHLCV + fundamental dari Yahoo Finance
"""
ml/pipeline/ingestor.py
-----------------------
Tugas:
  1. Ambil daftar ticker BEI (.JK) dari Yahoo Finance
  2. Tarik data OHLCV historis 5 tahun
  3. Tarik data fundamental: ROE, DER, PER
  4. Simpan ke format yang siap diproses tahap berikutnya

Catatan:
  - Bulk historical ingestion dijalankan terpisah dari dynamic update
  - Data fundamental yang kosong diimputasi dengan median sektoral
  - Ticker yang gagal diambil dicatat di failed_tickers.log
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/ingestor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ── Konstanta ──────────────────────────────────────────────────────────────────
HISTORICAL_YEARS   = 5
OUTPUT_DIR         = Path("data/raw")
FAILED_LOG         = Path("logs/failed_tickers.log")

# Delay antar request ke Yahoo Finance (detik)
# Terlalu cepat = kena rate limit
REQUEST_DELAY      = 0.5

# ── Daftar ticker BEI ──────────────────────────────────────────────────────────
# Sumber: daftar emiten aktif BEI, sudah ditambah suffix .JK
# Ini adalah contoh subset — pada produksi, list ini ditarik dari
# file tickers_bei.json yang diupdate berkala
def load_ticker_list(filepath: str = "data/tickers_bei.json") -> list[str]:
    """
    Load daftar ticker BEI dari file JSON.
    Format file: ["BBCA.JK", "BBRI.JK", "GOTO.JK", ...]
    """
    path = Path(filepath)
    if not path.exists():
        logger.error(f"File ticker tidak ditemukan: {filepath}")
        raise FileNotFoundError(f"File ticker tidak ditemukan: {filepath}")

    with open(path, "r") as f:
        tickers = json.load(f)

    logger.info(f"Total ticker dimuat: {len(tickers)}")
    return tickers


# ── Ambil data OHLCV historis ──────────────────────────────────────────────────
def fetch_ohlcv(ticker: str, years: int = HISTORICAL_YEARS) -> pd.DataFrame | None:
    """
    Ambil data OHLCV historis dari Yahoo Finance.

    Return kolom: Date, Open, High, Low, Close, Volume
    Return None jika gagal atau data kosong.
    """
    end_date   = datetime.today()
    start_date = end_date - timedelta(days=years * 365)

    try:
        df = yf.download(
            ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=True   # harga sudah disesuaikan split/dividen
        )

        if df.empty:
            logger.warning(f"[{ticker}] Data OHLCV kosong")
            return None

        # Reset index agar Date jadi kolom biasa
        df = df.reset_index()
        df.columns = df.columns.droplevel(1) if isinstance(df.columns, pd.MultiIndex) else df.columns
        df["ticker"] = ticker

        # Pastikan kolom yang dibutuhkan ada
        required_cols = ["Date", "Open", "High", "Low", "Close", "Volume"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            logger.warning(f"[{ticker}] Kolom hilang: {missing}")
            return None

        logger.info(f"[{ticker}] OHLCV berhasil: {len(df)} baris")
        return df[required_cols + ["ticker"]]

    except Exception as e:
        logger.error(f"[{ticker}] Gagal ambil OHLCV: {e}")
        return None


# ── Ambil data fundamental ─────────────────────────────────────────────────────
def fetch_fundamental(ticker: str) -> dict | None:
    """
    Ambil metrik fundamental dari Yahoo Finance:
      - ROE  : Return on Equity (benefit, makin tinggi makin baik)
      - DER  : Debt to Equity Ratio (cost, makin rendah makin baik)
      - PER  : Price to Earnings Ratio (cost, makin rendah makin baik)

    Return dict atau None jika semua data kosong.
    """
    try:
        stock = yf.Ticker(ticker)
        info  = stock.info

        roe = info.get("returnOnEquity", None)   # desimal, misal 0.18 = 18%
        der = info.get("debtToEquity",   None)   # rasio kelipatan
        per = info.get("trailingPE",     None)   # rasio kelipatan

        # Konversi ROE ke persentase agar konsisten
        if roe is not None:
            roe = roe * 100

        result = {
            "ticker" : ticker,
            "roe"    : roe,
            "der"    : der,
            "per"    : per,
        }

        # Catat mana yang kosong (untuk monitoring kualitas data)
        missing = [k for k, v in result.items() if v is None and k != "ticker"]
        if missing:
            logger.warning(f"[{ticker}] Fundamental kosong: {missing}")

        # Jika semua fundamental kosong, return None
        if all(v is None for k, v in result.items() if k != "ticker"):
            return None

        logger.info(f"[{ticker}] Fundamental berhasil: ROE={roe}, DER={der}, PER={per}")
        return result

    except Exception as e:
        logger.error(f"[{ticker}] Gagal ambil fundamental: {e}")
        return None


# ── Imputasi fundamental dengan median sektoral ────────────────────────────────
def impute_fundamental(
    df_fundamental: pd.DataFrame,
    df_sector: pd.DataFrame
) -> pd.DataFrame:
    """
    Isi nilai fundamental yang kosong (NaN) dengan median sektoral.

    Parameter:
      df_fundamental : DataFrame dengan kolom [ticker, roe, der, per]
      df_sector      : DataFrame dengan kolom [ticker, sector]

    Logika:
      Kalau ROE saham X kosong, isi dengan median ROE seluruh saham
      di sektor yang sama dengan X.

    Saham yang data fundamentalnya > 30% kosong tetap di-exclude
    (ditangani di filter_emiten.py).
    """
    df = df_fundamental.merge(df_sector, on="ticker", how="left")

    for col in ["roe", "der", "per"]:
        # Hitung median per sektor
        sector_median = df.groupby("sector")[col].transform("median")
        # Isi NaN dengan median sektornya
        df[col] = df[col].fillna(sector_median)

    logger.info("Imputasi fundamental dengan median sektoral selesai")
    return df.drop(columns=["sector"])


# ── Bulk ingestion (jalankan satu kali / berkala di luar jam pasar) ───────────
def run_bulk_ingestion(ticker_list: list[str]) -> None:
    """
    Tarik OHLCV dan fundamental untuk semua ticker secara batch.
    Simpan hasil ke:
      data/raw/ohlcv/      → satu file CSV per ticker
      data/raw/fundamental.csv → satu file gabungan semua ticker

    Jalankan ini di luar jam pasar (misal setelah 16.30 WIB)
    karena prosesnya berat dan memakan waktu lama.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "ohlcv").mkdir(exist_ok=True)
    FAILED_LOG.parent.mkdir(exist_ok=True)

    failed_tickers   = []
    all_fundamentals = []

    for i, ticker in enumerate(ticker_list):
        logger.info(f"[{i+1}/{len(ticker_list)}] Memproses {ticker}")

        # ── OHLCV ──
        df_ohlcv = fetch_ohlcv(ticker)
        if df_ohlcv is not None:
            ohlcv_path = OUTPUT_DIR / "ohlcv" / f"{ticker}.csv"
            df_ohlcv.to_csv(ohlcv_path, index=False)
        else:
            failed_tickers.append(ticker)

        # ── Fundamental ──
        fund = fetch_fundamental(ticker)
        if fund is not None:
            all_fundamentals.append(fund)

        # Delay untuk menghindari rate limit Yahoo Finance
        time.sleep(REQUEST_DELAY)

    # Simpan semua fundamental ke satu file
    if all_fundamentals:
        df_fund = pd.DataFrame(all_fundamentals)
        df_fund.to_csv(OUTPUT_DIR / "fundamental.csv", index=False)
        logger.info(f"Fundamental disimpan: {len(df_fund)} emiten")

    # Catat ticker yang gagal
    if failed_tickers:
        with open(FAILED_LOG, "w") as f:
            f.write("\n".join(failed_tickers))
        logger.warning(f"Total ticker gagal: {len(failed_tickers)}, lihat {FAILED_LOG}")

    logger.info("Bulk ingestion selesai")


# ── Dynamic update (jalankan setiap hari setelah pasar tutup) ─────────────────
def run_dynamic_update(ticker_list: list[str]) -> None:
    """
    Update harga penutupan terbaru saja (1 hari terakhir).
    Jauh lebih ringan dari bulk ingestion.
    Dipakai untuk memperbarui nilai portofolio virtual di dashboard.
    """
    latest_prices = {}

    for ticker in ticker_list:
        try:
            df = yf.download(
                ticker,
                period="2d",       # ambil 2 hari untuk antisipasi hari libur
                progress=False,
                auto_adjust=True
            )
            if not df.empty:
                latest_prices[ticker] = {
                    "close" : float(df["Close"].iloc[-1]),
                    "date"  : str(df.index[-1].date())
                }
            time.sleep(REQUEST_DELAY)

        except Exception as e:
            logger.error(f"[{ticker}] Dynamic update gagal: {e}")

    # Simpan sebagai JSON untuk dikonsumsi FastAPI secara cepat
    output_path = OUTPUT_DIR / "latest_prices.json"
    with open(output_path, "w") as f:
        json.dump(latest_prices, f)

    logger.info(f"Dynamic update selesai: {len(latest_prices)} ticker diperbarui")


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tickers = load_ticker_list()

    # Ganti ke run_dynamic_update() untuk update harian ringan
    run_bulk_ingestion(tickers)