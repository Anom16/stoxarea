import json
import pandas as pd
from pathlib import Path
from app.core.database import SessionLocal, engine, Base
from app.models.stock import Stock
from app.models.user import User

def sync_stocks():
    # 1. Pastikan tabel dibuat dengan struktur terbaru
    Base.metadata.create_all(bind=engine)
    
    # 2. Load data Ticker & Nama dari JSON
    json_path = Path("data/tickers/tickers_bei.json")
    if not json_path.exists():
        print(f"File {json_path} tidak ditemukan!")
        return
    with open(json_path, "r") as f:
        tickers_data = json.load(f)

    # 3. Load data Sektor Bahasa Indonesia (HASIL KLASIFIKASI)
    sector_path = Path("data/tickers/tickers_sectors.json")
    id_sectors = {}
    if sector_path.exists():
        with open(sector_path, "r") as f:
            id_sectors = json.load(f)
        print(f"Berhasil memuat {len(id_sectors)} sektor Bahasa Indonesia.")

    # 3.5 Load data Ticker yang Lolos Filter (SPK 2)
    filtered_path = Path("data/tickers/tickers_filtered.json")
    qualified_tickers = set()
    if filtered_path.exists():
        with open(filtered_path, "r") as f:
            qualified_tickers = set(json.load(f))
        print(f"Berhasil memuat {len(qualified_tickers)} saham yang LOLOS FILTER.")

    # 4. Load data Fundamental dari CSV (ROE, DER, PER)
    fund_path = Path("data/raw/fundamental.csv")
    fund_df = pd.DataFrame()
    if fund_path.exists():
        fund_df = pd.read_csv(fund_path)
        print(f"Berhasil memuat data fundamental untuk {len(fund_df)} emiten.")

    print(f"Memulai sinkronisasi {len(tickers_data)} saham ke database...")
    
    db = SessionLocal()
    try:
        for item in tickers_data:
            ticker = item["ticker"]
            
            # Gunakan Sektor Bahasa Indonesia jika tersedia, jika tidak gunakan fallback
            sector_name = id_sectors.get(ticker, item.get("sector", "Lainnya"))
            
            # Ambil data fundamental jika ada
            roe, der, per = None, None, None
            if not fund_df.empty:
                match = fund_df[fund_df['ticker'].str.contains(ticker.split('.')[0])]
                if not match.empty:
                    roe = float(match.iloc[0]['roe']) if pd.notnull(match.iloc[0]['roe']) else None
                    der = float(match.iloc[0]['der']) if pd.notnull(match.iloc[0]['der']) else None
                    per = float(match.iloc[0]['per']) if pd.notnull(match.iloc[0]['per']) else None

            # Update atau Create
            stock = db.query(Stock).filter(Stock.ticker == ticker).first()
            if not stock:
                stock = Stock(ticker=ticker)
                db.add(stock)
            
            stock.name = item["name"]
            stock.sector = sector_name # SEKARANG PAKAI BAHASA INDONESIA
            stock.is_qualified = (ticker in qualified_tickers) # STATUS LOLOS SENSOR
            stock.roe = roe
            stock.der = der
            stock.per = per
        
        db.commit()
        print("Sinkronisasi BERHASIL! Seluruh Sektor kini telah diterjemahkan ke Bahasa Indonesia.")
    except Exception as e:
        db.rollback()
        print(f"Gagal sinkronisasi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    sync_stocks()
