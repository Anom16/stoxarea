"""
ml/pipeline/scrape_tickers.py
------------------------------
Tugas:
  1. Scrape daftar emiten BEI dari Wikipedia
  2. Validasi setiap ticker ke Yahoo Finance (pastikan data ada)
  3. Simpan hasil ke data/tickers/tickers_bei.json

Jalankan SEKALI SAJA di awal proyek, atau saat ingin
memperbarui daftar emiten (misal tiap 6 bulan).

Cara pakai:
    python -m ml.pipeline.scrape_tickers

Estimasi waktu: 15–30 menit tergantung koneksi internet
(karena validasi ke Yahoo Finance satu per satu dengan delay)
"""

import requests
import yfinance as yf
import pandas as pd
import json
import time
import logging
from bs4 import BeautifulSoup
from pathlib import Path

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/scrape_tickers.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ── Konstanta ──────────────────────────────────────────────────────────────────
OUTPUT_PATH    = Path("data/tickers/tickers_bei.json")
INVALID_PATH   = Path("data/tickers/tickers_invalid.json")
REQUEST_DELAY  = 0.3   # detik antar validasi Yahoo Finance

# URL Wikipedia daftar emiten IDX
# Halaman ini berisi tabel semua perusahaan tercatat di BEI
WIKI_URL = "https://en.wikipedia.org/wiki/List_of_companies_listed_on_the_Indonesia_Stock_Exchange"


# ── Step 1: Scrape dari Wikipedia ──────────────────────────────────────────────
def scrape_from_wikipedia() -> list[dict]:
    """
    Scrape tabel emiten dari Wikipedia.

    Return list of dict:
    [
        {"ticker": "BBCA", "name": "Bank Central Asia", "sector": "Financials"},
        ...
    ]
    """
    logger.info(f"Scraping Wikipedia: {WIKI_URL}")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    try:
        response = requests.get(WIKI_URL, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Gagal akses Wikipedia: {e}")
        raise

    soup = BeautifulSoup(response.text, "html.parser")

    # Wikipedia menyimpan daftar emiten dalam tabel wikitable
    # Cari semua tabel, ambil yang punya kolom ticker/symbol
    tables = soup.find_all("table", class_="wikitable")

    if not tables:
        logger.error("Tidak ada tabel wikitable ditemukan di halaman Wikipedia")
        raise ValueError("Struktur halaman Wikipedia berubah, perlu update selector")

    emiten_list = []

    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue

        # Ambil header untuk tahu posisi kolom
        headers_row = rows[0].find_all(["th", "td"])
        headers_text = [h.get_text(strip=True).lower() for h in headers_row]

        # Cari indeks kolom ticker dan nama perusahaan
        ticker_idx = None
        name_idx   = None
        sector_idx = None

        for i, h in enumerate(headers_text):
            if any(kw in h for kw in ["symbol", "ticker", "code", "kode"]):
                ticker_idx = i
            if any(kw in h for kw in ["company", "name", "nama", "perusahaan"]):
                name_idx = i
            if any(kw in h for kw in ["sector", "sektor", "industry"]):
                sector_idx = i

        # Skip tabel yang tidak punya kolom ticker
        if ticker_idx is None:
            continue

        logger.info(f"Tabel ditemukan — kolom ticker: {ticker_idx}, nama: {name_idx}, sektor: {sector_idx}")

        # Iterasi baris data (skip header)
        for row in rows[1:]:
            cols = row.find_all(["td", "th"])
            if len(cols) <= ticker_idx:
                continue

            ticker = cols[ticker_idx].get_text(strip=True).upper()

            # Bersihkan ticker — ambil hanya huruf kapital 4 karakter
            ticker = "".join(c for c in ticker if c.isalpha())[:4]

            if not ticker or len(ticker) < 2:
                continue

            name   = cols[name_idx].get_text(strip=True) if name_idx and len(cols) > name_idx else ""
            sector = cols[sector_idx].get_text(strip=True) if sector_idx and len(cols) > sector_idx else "Unknown"

            emiten_list.append({
                "ticker" : ticker,
                "name"   : name,
                "sector" : sector,
            })

    # Hapus duplikat berdasarkan ticker
    seen    = set()
    unique  = []
    for e in emiten_list:
        if e["ticker"] not in seen:
            seen.add(e["ticker"])
            unique.append(e)

    logger.info(f"Total emiten dari Wikipedia: {len(unique)}")
    return unique


# ── Step 2: Fallback — daftar ticker hardcoded (LQ45 + IDX80) ─────────────────
def get_fallback_tickers() -> list[dict]:
    """
    Fallback jika scraping Wikipedia gagal.
    Berisi saham-saham utama BEI (LQ45 + IDX80) yang sudah terbukti
    ada di Yahoo Finance dengan data lengkap.

    List ini mencakup emiten blue chip & liquid di berbagai sektor BEI.
    """
    return [
        # ── Sektor Keuangan (Financials) ──
        {"ticker": "BBCA", "name": "Bank Central Asia",          "sector": "Financials"},
        {"ticker": "BBRI", "name": "Bank Rakyat Indonesia",      "sector": "Financials"},
        {"ticker": "BMRI", "name": "Bank Mandiri",               "sector": "Financials"},
        {"ticker": "BBNI", "name": "Bank Negara Indonesia",      "sector": "Financials"},
        {"ticker": "BNGA", "name": "Bank CIMB Niaga",            "sector": "Financials"},
        {"ticker": "BJBR", "name": "Bank Jabar Banten",          "sector": "Financials"},
        {"ticker": "BRIS", "name": "Bank Syariah Indonesia",     "sector": "Financials"},
        {"ticker": "BBTN", "name": "Bank Tabungan Negara",       "sector": "Financials"},
        {"ticker": "MEGA", "name": "Bank Mega",                  "sector": "Financials"},
        {"ticker": "PNBN", "name": "Bank Pan Indonesia",         "sector": "Financials"},

        # ── Sektor Energi (Energy) ──
        {"ticker": "ADRO", "name": "Adaro Energy",               "sector": "Energy"},
        {"ticker": "PTBA", "name": "Bukit Asam",                 "sector": "Energy"},
        {"ticker": "ITMG", "name": "Indo Tambangraya Megah",     "sector": "Energy"},
        {"ticker": "INDY", "name": "Indika Energy",              "sector": "Energy"},
        {"ticker": "HRUM", "name": "Harum Energy",               "sector": "Energy"},
        {"ticker": "BUMI", "name": "Bumi Resources",             "sector": "Energy"},
        {"ticker": "ELSA", "name": "Elnusa",                     "sector": "Energy"},
        {"ticker": "MEDC", "name": "Medco Energi",               "sector": "Energy"},

        # ── Sektor Barang Konsumsi (Consumer Goods) ──
        {"ticker": "UNVR", "name": "Unilever Indonesia",         "sector": "Consumer Goods"},
        {"ticker": "ICBP", "name": "Indofood CBP",               "sector": "Consumer Goods"},
        {"ticker": "INDF", "name": "Indofood Sukses Makmur",     "sector": "Consumer Goods"},
        {"ticker": "MYOR", "name": "Mayora Indah",               "sector": "Consumer Goods"},
        {"ticker": "KLBF", "name": "Kalbe Farma",                "sector": "Consumer Goods"},
        {"ticker": "SIDO", "name": "Industri Jamu Sido Muncul",  "sector": "Consumer Goods"},
        {"ticker": "WOOD", "name": "Integra Indocabinet",        "sector": "Consumer Goods"},
        {"ticker": "ULTJ", "name": "Ultra Jaya Milk",            "sector": "Consumer Goods"},
        {"ticker": "DLTA", "name": "Delta Djakarta",             "sector": "Consumer Goods"},
        {"ticker": "ROTI", "name": "Nippon Indosari Corpindo",   "sector": "Consumer Goods"},

        # ── Sektor Infrastruktur & Utilitas ──
        {"ticker": "TLKM", "name": "Telkom Indonesia",           "sector": "Infrastructure"},
        {"ticker": "EXCL",  "name": "XL Axiata",                 "sector": "Infrastructure"},
        {"ticker": "ISAT", "name": "Indosat Ooredoo",            "sector": "Infrastructure"},
        {"ticker": "TOWR", "name": "Sarana Menara Nusantara",    "sector": "Infrastructure"},
        {"ticker": "JSMR", "name": "Jasa Marga",                 "sector": "Infrastructure"},
        {"ticker": "WIKA", "name": "Wijaya Karya",               "sector": "Infrastructure"},
        {"ticker": "PTPP", "name": "PP Persero",                 "sector": "Infrastructure"},
        {"ticker": "WSKT", "name": "Waskita Karya",              "sector": "Infrastructure"},

        # ── Sektor Material Dasar (Basic Materials) ──
        {"ticker": "TKIM", "name": "Pabrik Kertas Tjiwi Kimia",  "sector": "Basic Materials"},
        {"ticker": "INKP", "name": "Indah Kiat Pulp & Paper",    "sector": "Basic Materials"},
        {"ticker": "INTP", "name": "Indocement Tunggal Prakarsa","sector": "Basic Materials"},
        {"ticker": "SMGR", "name": "Semen Indonesia",            "sector": "Basic Materials"},
        {"ticker": "BRPT", "name": "Barito Pacific",             "sector": "Basic Materials"},
        {"ticker": "TPIA", "name": "Chandra Asri Petrochemical", "sector": "Basic Materials"},

        # ── Sektor Properti & Real Estate ──
        {"ticker": "BSDE", "name": "Bumi Serpong Damai",         "sector": "Property"},
        {"ticker": "CTRA", "name": "Ciputra Development",        "sector": "Property"},
        {"ticker": "PWON", "name": "Pakuwon Jati",               "sector": "Property"},
        {"ticker": "SMRA", "name": "Summarecon Agung",           "sector": "Property"},
        {"ticker": "LPKR", "name": "Lippo Karawaci",             "sector": "Property"},
        {"ticker": "DMAS", "name": "Puradelta Lestari",          "sector": "Property"},

        # ── Sektor Industri (Industrials) ──
        {"ticker": "ASII", "name": "Astra International",        "sector": "Industrials"},
        {"ticker": "UNTR", "name": "United Tractors",            "sector": "Industrials"},
        {"ticker": "PGAS", "name": "Perusahaan Gas Negara",      "sector": "Industrials"},
        {"ticker": "AKRA", "name": "AKR Corporindo",             "sector": "Industrials"},
        {"ticker": "SCMA", "name": "Surya Citra Media",          "sector": "Industrials"},

        # ── Sektor Teknologi ──
        {"ticker": "GOTO", "name": "GoTo Gojek Tokopedia",       "sector": "Technology"},
        {"ticker": "BUKA", "name": "Bukalapak",                  "sector": "Technology"},
        {"ticker": "EMTK", "name": "Elang Mahkota Teknologi",    "sector": "Technology"},
        {"ticker": "DNET", "name": "Indoritel Makmur",           "sector": "Technology"},

        # ── Sektor Pertanian (Agriculture) ──
        {"ticker": "AALI", "name": "Astra Agro Lestari",         "sector": "Agriculture"},
        {"ticker": "LSIP", "name": "PP London Sumatra",          "sector": "Agriculture"},
        {"ticker": "PALM", "name": "Provident Agro",             "sector": "Agriculture"},
        {"ticker": "SSMS", "name": "Sawit Sumbermas Sarana",     "sector": "Agriculture"},
        {"ticker": "SIMP", "name": "Salim Ivomas Pratama",       "sector": "Agriculture"},

        # ── Sektor Kesehatan (Healthcare) ──
        {"ticker": "SIDO", "name": "Industri Jamu Sido Muncul",  "sector": "Healthcare"},
        {"ticker": "MIKA", "name": "Mitra Keluarga Karyasehat",  "sector": "Healthcare"},
        {"ticker": "PRSY", "name": "Prima Sarana Gemilang",      "sector": "Healthcare"},
        {"ticker": "HEAL", "name": "Medikaloka Hermina",         "sector": "Healthcare"},

        # ── Sektor Transportasi ──
        {"ticker": "BIRD", "name": "Blue Bird",                  "sector": "Transportation"},
        {"ticker": "GIAA", "name": "Garuda Indonesia",           "sector": "Transportation"},
        {"ticker": "SMDR", "name": "Samudera Indonesia",         "sector": "Transportation"},
        {"ticker": "ASSA", "name": "Adi Sarana Armada",          "sector": "Transportation"},
    ]


# ── Step 3: Validasi ticker ke Yahoo Finance ───────────────────────────────────
def validate_ticker_yfinance(ticker_raw: str) -> bool:
    """
    Cek apakah ticker valid di Yahoo Finance dengan suffix .JK.
    Caranya: coba download 5 hari data, kalau ada data = valid.
    """
    ticker_jk = f"{ticker_raw}.JK"
    try:
        df = yf.download(
            ticker_jk,
            period="5d",
            progress=False,
            auto_adjust=True
        )
        return not df.empty
    except Exception:
        return False


def run_validation(emiten_list: list[dict]) -> tuple[list[str], list[str]]:
    """
    Validasi semua ticker ke Yahoo Finance.

    Return:
        valid_tickers   : list ticker yang lolos (format BBCA.JK)
        invalid_tickers : list ticker yang gagal
    """
    valid_tickers   = []
    invalid_tickers = []
    total           = len(emiten_list)

    for i, emiten in enumerate(emiten_list):
        ticker = emiten["ticker"]
        logger.info(f"[{i+1}/{total}] Validasi {ticker}.JK ...")

        if validate_ticker_yfinance(ticker):
            valid_tickers.append(f"{ticker}.JK")
            logger.info(f"  ✅ {ticker}.JK — valid")
        else:
            invalid_tickers.append(ticker)
            logger.warning(f"  ❌ {ticker}.JK — tidak ditemukan di Yahoo Finance")

        time.sleep(REQUEST_DELAY)

    return valid_tickers, invalid_tickers


# ── Step 4: Simpan hasil ───────────────────────────────────────────────────────
def save_results(valid: list[str], invalid: list[str]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(valid, f, indent=2)
    logger.info(f"✅ Ticker valid disimpan ke {OUTPUT_PATH} ({len(valid)} ticker)")

    with open(INVALID_PATH, "w") as f:
        json.dump(invalid, f, indent=2)
    logger.info(f"⚠️  Ticker invalid disimpan ke {INVALID_PATH} ({len(invalid)} ticker)")


# ── Main ───────────────────────────────────────────────────────────────────────
def run():
    logger.info("=" * 55)
    logger.info("  StoxArea — Scraping & Validasi Ticker BEI")
    logger.info("=" * 55)

    # Step 1: Coba scrape Wikipedia
    emiten_list = []
    try:
        emiten_list = scrape_from_wikipedia()
        logger.info(f"Scraping Wikipedia berhasil: {len(emiten_list)} emiten")
    except Exception as e:
        logger.warning(f"Scraping Wikipedia gagal: {e}")
        logger.info("Menggunakan fallback list (LQ45 + IDX80)...")
        emiten_list = get_fallback_tickers()

    # Kalau Wikipedia berhasil tapi hasilnya sedikit, gabung dengan fallback
    if len(emiten_list) < 50:
        logger.warning(f"Hasil Wikipedia terlalu sedikit ({len(emiten_list)}), gabung dengan fallback")
        fallback     = get_fallback_tickers()
        existing     = {e["ticker"] for e in emiten_list}
        for f in fallback:
            if f["ticker"] not in existing:
                emiten_list.append(f)
        logger.info(f"Total setelah digabung: {len(emiten_list)} emiten")

    # Step 2: Validasi ke Yahoo Finance
    logger.info(f"\nMemulai validasi {len(emiten_list)} ticker ke Yahoo Finance...")
    logger.info("Estimasi waktu: {:.0f}–{:.0f} menit\n".format(
        len(emiten_list) * REQUEST_DELAY / 60,
        len(emiten_list) * REQUEST_DELAY / 60 * 2
    ))

    valid, invalid = run_validation(emiten_list)

    # Step 3: Simpan
    save_results(valid, invalid)

    # Summary
    logger.info("\n" + "=" * 55)
    logger.info(f"  SELESAI")
    logger.info(f"  Ticker valid   : {len(valid)}")
    logger.info(f"  Ticker invalid : {len(invalid)}")
    logger.info(f"  Output         : {OUTPUT_PATH}")
    logger.info("=" * 55)


if __name__ == "__main__":
    run()
