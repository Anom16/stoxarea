import json
import pandas as pd
from pathlib import Path
from app.core.database import SessionLocal, engine, Base
from app.models.stock import Stock
from app.models.user import User
from app.models.indicator import StockIndicatorValue, StockProfileMapping

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
            
            # FIX #3: Perbaikan mismatch format ticker antara fundamental.csv dan sync_db.
            roe, der, pbv = None, None, None
            if not fund_df.empty:
                ticker_bare = ticker.split('.')[0]          # "BBCA.JK" → "BBCA"
                ticker_full = ticker_bare + ".JK"           # "BBCA"    → "BBCA.JK"

                # Coba exact match dengan format lengkap dulu, fallback ke bare code
                match = fund_df[fund_df['ticker'] == ticker_full]
                if match.empty:
                    match = fund_df[fund_df['ticker'] == ticker_bare]
                # Fallback terakhir: case-insensitive partial match untuk antisipasi variasi format
                if match.empty:
                    match = fund_df[fund_df['ticker'].str.upper() == ticker_full.upper()]

                if not match.empty:
                    roe = float(match.iloc[0]['roe']) if pd.notnull(match.iloc[0]['roe']) else None
                    der = float(match.iloc[0]['der']) if pd.notnull(match.iloc[0]['der']) else None
                    pbv = float(match.iloc[0]['pbv']) if pd.notnull(match.iloc[0]['pbv']) else None

            # Update atau Create
            stock = db.query(Stock).filter(Stock.ticker == ticker).first()
            if not stock:
                stock = Stock(ticker=ticker)
                db.add(stock)
            
            stock.name = item["name"]
            stock.sector = sector_name
            stock.roe = roe
            stock.der = der
            stock.pbv = pbv

            # FIX #1 — Filter saham dengan fundamental berbahaya untuk SAW.
            fundamental_disqualified = False
            disqualify_reason = None

            if pbv is not None and pbv <= 0:
                fundamental_disqualified = True
                disqualify_reason = f"PBV negatif ({pbv:.2f}) — ekuitas negatif"
            elif der is not None and der < 0:
                fundamental_disqualified = True
                disqualify_reason = f"DER negatif ({der:.2f}) — ekuitas negatif"
            elif roe is not None and roe < -50:
                fundamental_disqualified = True
                disqualify_reason = f"ROE sangat negatif ({roe:.2f}%) — kerugian ekstrem"

            if fundamental_disqualified:
                stock.is_qualified = False
                print(f"  [GUGUR FUNDAMENTAL] {ticker}: {disqualify_reason}")
            else:
                # Hanya set qualified jika lolos filter volume/harga DAN fundamental sehat
                stock.is_qualified = (ticker in qualified_tickers)
            
            # Sync to StockIndicatorValue for SAW compatibility
            for ind_id, val in [("roe", roe), ("der", der), ("pbv", pbv)]:
                if val is not None:
                    ind_val = db.query(StockIndicatorValue).filter(
                        StockIndicatorValue.ticker == ticker,
                        StockIndicatorValue.indicator_id == ind_id
                    ).first()
                    if not ind_val:
                        ind_val = StockIndicatorValue(ticker=ticker, indicator_id=ind_id)
                        db.add(ind_val)
                    ind_val.value = val

            # Seed default profile mappings if none exist for this stock
            existing_mappings = db.query(StockProfileMapping).filter(StockProfileMapping.ticker == ticker).first()
            if not existing_mappings:
                for profile_id in ["konservatif", "moderat", "agresif"]:
                    db.add(StockProfileMapping(ticker=ticker, profile_id=profile_id))
        
        db.commit()
        print("Sinkronisasi BERHASIL! Seluruh Sektor kini telah diterjemahkan ke Bahasa Indonesia.")
    except Exception as e:
        db.rollback()
        print(f"Gagal sinkronisasi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    sync_stocks()
