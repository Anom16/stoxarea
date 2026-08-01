import json
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.stock import Stock

def fix_qualified():
    db = SessionLocal()
    try:
        json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'tickers', 'tickers_filtered.json')
        with open(json_path, "r") as f:
            filtered_list = json.load(f)
        
        # Build clean ticker set
        clean_tickers = set()
        for t in filtered_list:
            bare = t.replace(".JK", "").strip().upper()
            clean_tickers.add(bare)
            clean_tickers.add(f"{bare}.JK")
        
        print(f"Memuat {len(filtered_list)} ticker dari tickers_filtered.json...")

        stocks = db.query(Stock).all()
        updated = 0
        qualified_count = 0

        for s in stocks:
            bare_t = s.ticker.replace(".JK", "").strip().upper()
            should_be_qualified = (bare_t in clean_tickers or s.ticker.upper() in clean_tickers)
            
            if s.is_qualified != should_be_qualified:
                s.is_qualified = should_be_qualified
                updated += 1
            
            if should_be_qualified:
                qualified_count += 1
                
        db.commit()
        print(f"BERHASIL! {updated} saham diperbarui statusnya.")
        print(f"Total Saham QUALIFIED sekarang: {qualified_count}")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_qualified()
