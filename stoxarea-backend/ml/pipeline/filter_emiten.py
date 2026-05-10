"""
ml/pipeline/filter_emiten.py
-----------------------------
Tugas:
  Menyaring ticker hasil scrape_tickers.py menggunakan 3 kriteria:
    1. Volume rata-rata 30 hari  > 10 ribu lot/hari
    2. Hari trading dalam setahun ≥ 100 hari
    3. Harga penutupan terakhir  > Rp 50 (bukan saham gocap)

Input  : data/tickers/tickers_bei.json   (output scrape_tickers.py)
Output : data/tickers/tickers_filtered.json

Cara pakai:
    python -m ml.pipeline.filter_emiten

Jalankan SETELAH scrape_tickers.py selesai.
"""

import yfinance as yf
import pandas as pd
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timedelta

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/filter_emiten.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ── Konstanta threshold ────────────────────────────────────────────────────────
MIN_AVG_VOLUME      = 10_000      # 10 ribu lot/hari (rata-rata 30 hari)
MIN_TRADING_DAYS    = 100         # dari 252 hari bursa dalam setahun
MIN_PRICE_IDR       = 51          # harga penutupan > Rp 51 (exclude gocap Rp50)

REQUEST_DELAY       = 0.5         # detik antar request Yahoo Finance

INPUT_PATH          = Path("data/tickers/tickers_bei.json")
OUTPUT_PATH         = Path("data/tickers/tickers_filtered.json")
REJECTED_PATH       = Path("data/tickers/tickers_rejected.json")


# ── Load ticker list ───────────────────────────────────────────────────────────
def load_tickers(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(
            f"File tidak ditemukan: {path}\n"
            "Jalankan scrape_tickers.py terlebih dahulu."
        )
    with open(path) as f:
        tickers = json.load(f)
    logger.info(f"Total ticker dimuat: {len(tickers)}")
    return tickers


# ── Ambil data OHLCV 1 tahun untuk filtering ──────────────────────────────────
def fetch_data_for_filter(ticker: str) -> pd.DataFrame | None:
    """
    Ambil data 1 tahun terakhir untuk keperluan filtering.
    Lebih ringan dari bulk ingestion 5 tahun.
    """
    end   = datetime.today()
    start = end - timedelta(days=365)

    try:
        df = yf.download(
            ticker,
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=True
        )

        if df.empty:
            return None

        # Flatten MultiIndex kalau ada
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)

        return df

    except Exception as e:
        logger.error(f"[{ticker}] Gagal fetch data: {e}")
        return None


# ── 3 Fungsi filter ────────────────────────────────────────────────────────────
def check_volume(df: pd.DataFrame) -> tuple[bool, float]:
    """
    Kriteria 1: Volume rata-rata 30 hari terakhir > 10 ribu lot/hari.

    Yahoo Finance mengembalikan volume dalam satuan lembar saham.
    1 lot = 100 lembar saham, jadi kita konversi dulu.
    """
    if "Volume" not in df.columns or len(df) < 30:
        return False, 0.0

    # Ambil 30 hari terakhir
    recent_30      = df["Volume"].tail(30)

    # Konversi lembar → lot (1 lot = 100 lembar)
    avg_volume_lot = recent_30.mean() / 100

    passed = avg_volume_lot > MIN_AVG_VOLUME
    return passed, round(avg_volume_lot, 0)


def check_trading_days(df: pd.DataFrame) -> tuple[bool, int]:
    """
    Kriteria 2: Jumlah hari trading dalam 1 tahun ≥ 100 hari.

    Saham yang sering suspend atau tidak likuid akan punya
    jumlah hari trading jauh di bawah 200.
    """
    trading_days = len(df)
    passed       = trading_days >= MIN_TRADING_DAYS
    return passed, trading_days


def check_price(df: pd.DataFrame) -> tuple[bool, float]:
    """
    Kriteria 3: Harga penutupan terakhir > Rp 50.

    Saham gocap (harga ≤ Rp 50) rawan manipulasi dan
    spread-nya tidak wajar untuk analisis teknikal.
    """
    if "Close" not in df.columns or df.empty:
        return False, 0.0

    last_price = float(df["Close"].iloc[-1])
    passed     = last_price > MIN_PRICE_IDR
    return passed, round(last_price, 0)


# ── Evaluasi satu ticker ───────────────────────────────────────────────────────
def evaluate_ticker(ticker: str) -> dict:
    """
    Jalankan 3 kriteria filter untuk satu ticker.

    Return dict berisi hasil evaluasi lengkap:
    {
        "ticker"       : "BBCA.JK",
        "passed"       : True,
        "avg_volume"   : 12500000.0,
        "trading_days" : 245,
        "last_price"   : 9500.0,
        "reject_reason": None
    }
    """
    result = {
        "ticker"        : ticker,
        "passed"        : False,
        "avg_volume"    : 0.0,
        "trading_days"  : 0,
        "last_price"    : 0.0,
        "reject_reason" : None,
    }

    df = fetch_data_for_filter(ticker)

    # Kalau data tidak bisa diambil sama sekali
    if df is None:
        result["reject_reason"] = "data_tidak_tersedia"
        return result

    # ── Cek 3 kriteria ──
    vol_ok,   avg_vol      = check_volume(df)
    days_ok,  trading_days = check_trading_days(df)
    price_ok, last_price   = check_price(df)

    result["avg_volume"]   = avg_vol
    result["trading_days"] = trading_days
    result["last_price"]   = last_price

    # Tentukan alasan penolakan (bisa lebih dari satu)
    reasons = []
    if not vol_ok:
        reasons.append(f"volume_rendah({avg_vol:.0f}_lot)")
    if not days_ok:
        reasons.append(f"hari_trading_kurang({trading_days}_hari)")
    if not price_ok:
        reasons.append(f"harga_gocap(Rp{last_price:.0f})")

    if not reasons:
        result["passed"] = True
    else:
        result["reject_reason"] = " | ".join(reasons)

    return result


# ── Main filter runner ─────────────────────────────────────────────────────────
def run_filter(tickers: list[str]) -> tuple[list[str], list[dict]]:
    """
    Jalankan filter untuk semua ticker.

    Return:
        filtered  : list ticker yang lolos (format BBCA.JK)
        rejected  : list dict ticker yang ditolak + alasannya
    """
    filtered = []
    rejected = []
    total    = len(tickers)

    logger.info(f"\nMemulai filter {total} ticker...\n")
    logger.info(f"Kriteria:")
    logger.info(f"  Volume rata-rata 30 hari  > {MIN_AVG_VOLUME:,} lot/hari")
    logger.info(f"  Hari trading setahun      ≥ {MIN_TRADING_DAYS} hari")
    logger.info(f"  Harga penutupan terakhir  > Rp {MIN_PRICE_IDR}\n")

    for i, ticker in enumerate(tickers):
        logger.info(f"[{i+1}/{total}] Evaluasi {ticker}")

        result = evaluate_ticker(ticker)

        if result["passed"]:
            filtered.append(ticker)
            logger.info(
                f"  ✅ LOLOS — "
                f"Vol: {result['avg_volume']:,.0f} lot | "
                f"Hari: {result['trading_days']} | "
                f"Harga: Rp{result['last_price']:,.0f}"
            )
        else:
            rejected.append(result)
            logger.warning(
                f"  ❌ DITOLAK — {result['reject_reason']}"
            )

        time.sleep(REQUEST_DELAY)

    return filtered, rejected


# ── Simpan hasil ───────────────────────────────────────────────────────────────
def save_results(filtered: list[str], rejected: list[dict]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(filtered, f, indent=2)

    with open(REJECTED_PATH, "w") as f:
        json.dump(rejected, f, indent=2, ensure_ascii=False)

    logger.info(f"\n✅ Ticker lolos   disimpan ke {OUTPUT_PATH}")
    logger.info(f"⚠️  Ticker ditolak disimpan ke {REJECTED_PATH}")


# ── Summary report ─────────────────────────────────────────────────────────────
def print_summary(filtered: list[str], rejected: list[dict]) -> None:
    total   = len(filtered) + len(rejected)

    # Hitung breakdown alasan penolakan
    reasons = {}
    for r in rejected:
        for reason in r["reject_reason"].split(" | "):
            key = reason.split("(")[0]
            reasons[key] = reasons.get(key, 0) + 1

    logger.info("\n" + "=" * 55)
    logger.info("  HASIL FILTER EMITEN")
    logger.info("=" * 55)
    logger.info(f"  Total input        : {total} ticker")
    logger.info(f"  Lolos filter       : {len(filtered)} ticker")
    logger.info(f"  Ditolak            : {len(rejected)} ticker")
    logger.info(f"  Tingkat lolos      : {len(filtered)/total*100:.1f}%")
    logger.info("")
    logger.info("  Breakdown penolakan:")
    for reason, count in sorted(reasons.items(), key=lambda x: -x[1]):
        logger.info(f"    {reason:<30} : {count} ticker")
    logger.info("=" * 55)


# ── Entry point ────────────────────────────────────────────────────────────────
def run():
    tickers            = load_tickers(INPUT_PATH)
    filtered, rejected = run_filter(tickers)
    save_results(filtered, rejected)
    print_summary(filtered, rejected)


if __name__ == "__main__":
    run()