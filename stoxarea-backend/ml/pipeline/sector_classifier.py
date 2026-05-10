"""
ml/pipeline/sector_classifier.py
--------------------------------
Tugas:
  1. Membaca daftar ticker yang telah difilter (tickers_filtered.json).
  2. Mengambil informasi sektor dari Yahoo Finance.
  3. Memetakan sektor Yahoo Finance ke 11 Sektor Resmi BEI + 1 Sektor Pertanian.
  4. Menyimpan hasilnya ke data/tickers/tickers_sectors.json.

Catatan:
  Format Output JSON:
  {
      "BBCA.JK": "Keuangan",
      "GOTO.JK": "Teknologi",
      ...
  }
"""

import yfinance as yf
import json
import logging
import time
from pathlib import Path

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/sector_classifier.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

INPUT_PATH  = Path("data/tickers/tickers_filtered.json")
OUTPUT_PATH = Path("data/tickers/tickers_sectors.json")
REQUEST_DELAY = 0.5

# ── Mapping Sektor Yahoo Finance ke Sektor BEI ─────────────────────────────────
# Yahoo Finance menggunakan standar GICS yang sedikit berbeda dengan IDX-IC.
# Kita petakan ke 11 Sektor BEI + 1 Sektor Pertanian sesuai dokumen.
SECTOR_MAPPING = {
    "Basic Materials": "Barang Baku",
    "Consumer Cyclical": "Barang Konsumen Non-Primer",
    "Consumer Defensive": "Barang Konsumen Primer",
    "Energy": "Energi",
    "Financial Services": "Keuangan",
    "Healthcare": "Kesehatan",
    "Industrials": "Perindustrian",
    "Real Estate": "Properti & Real Estat",
    "Technology": "Teknologi",
    "Utilities": "Infrastruktur",
    "Communication Services": "Infrastruktur", # Di BEI, Telco masuk Infrastruktur
}

def map_to_idx_sector(yf_sector: str, yf_industry: str) -> str:
    if not yf_sector:
        return "Tidak Diketahui"
        
    # Cek apakah industri berkaitan dengan Pertanian (Sektor Tambahan)
    agri_keywords = ["agricultural", "farm", "plantation", "crop"]
    if yf_industry:
        if any(kw in yf_industry.lower() for kw in agri_keywords):
            return "Pertanian"
            
    # Cek mapping umum
    return SECTOR_MAPPING.get(yf_sector, yf_sector)

def run():
    if not INPUT_PATH.exists():
        logger.error(f"File {INPUT_PATH} tidak ditemukan. Jalankan filter_emiten.py terlebih dahulu.")
        return

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        tickers = json.load(f)

    logger.info(f"Memulai klasifikasi sektoral untuk {len(tickers)} ticker...")
    
    sector_data = {}
    
    for i, ticker in enumerate(tickers):
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            yf_sector = info.get("sector", "")
            yf_industry = info.get("industry", "")
            
            idx_sector = map_to_idx_sector(yf_sector, yf_industry)
            sector_data[ticker] = idx_sector
            
            logger.info(f"[{i+1}/{len(tickers)}] {ticker} -> {idx_sector} (YF: {yf_sector} | {yf_industry})")
            
        except Exception as e:
            logger.error(f"[{ticker}] Gagal mengambil data sektor: {e}")
            sector_data[ticker] = "Tidak Diketahui"
            
        time.sleep(REQUEST_DELAY)
        
    # Simpan hasil
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(sector_data, f, indent=4)
        
    logger.info(f"✅ Klasifikasi sektoral selesai! Data disimpan di {OUTPUT_PATH}")
    
    # Cetak ringkasan
    summary = {}
    for sector in sector_data.values():
        summary[sector] = summary.get(sector, 0) + 1
        
    logger.info("\n=== Ringkasan Sektor ===")
    for sector, count in sorted(summary.items(), key=lambda x: -x[1]):
        logger.info(f"{sector:<30}: {count} emiten")
    logger.info("========================")

if __name__ == "__main__":
    run()
