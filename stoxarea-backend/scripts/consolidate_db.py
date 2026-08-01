import sys
import os
import logging

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

from app.core.database import SessionLocal
from app.models.stock import Stock
from app.services.idx_service import IDXService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def consolidate():
    db = SessionLocal()
    try:
        stocks = db.query(Stock).all()
        logger.info(f"Total stocks before consolidation: {len(stocks)}")
        
        clean_map = {}
        for s in stocks:
            clean = s.ticker.replace('.JK', '').strip().upper()
            if clean not in clean_map:
                clean_map[clean] = []
            clean_map[clean].append(s)

        merged_count = 0
        for clean, s_list in clean_map.items():
            if len(s_list) > 1:
                # Pick the clean ticker as primary if available, else first
                primary = next((x for x in s_list if not x.ticker.endswith('.JK')), s_list[0])
                
                # Check if any record in group was qualified
                any_qualified = any(x.is_qualified for x in s_list)
                primary.is_qualified = any_qualified
                
                for item in s_list:
                    if item.ticker != primary.ticker:
                        if item.cluster and not primary.cluster:
                            primary.cluster = item.cluster
                        if item.sector and not primary.sector:
                            primary.sector = item.sector
                        if item.name and not primary.name:
                            primary.name = item.name
                        db.delete(item)
                        merged_count += 1
                        
            elif len(s_list) == 1:
                # If ticker ends with .JK, rename ticker to clean ticker if clean ticker doesn't exist
                item = s_list[0]
                if item.ticker.endswith('.JK'):
                    clean_ticker = item.ticker.replace('.JK', '').strip().upper()
                    existing = db.query(Stock).filter(Stock.ticker == clean_ticker).first()
                    if not existing:
                        item.ticker = clean_ticker

        db.commit()
        logger.info(f"Merged & cleaned {merged_count} duplicate stock records.")
        
        stocks_after = db.query(Stock).all()
        qualified_after = [s for s in stocks_after if s.is_qualified]
        logger.info(f"Total stocks after consolidation: {len(stocks_after)}, Qualified: {len(qualified_after)}")
        
        logger.info("Executing IDXService sync_to_db...")
        sync_res = IDXService.sync_to_db(db)
        logger.info(f"IDX sync result: {sync_res}")
        
    except Exception as e:
        logger.error(f"Error during consolidation: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    consolidate()
