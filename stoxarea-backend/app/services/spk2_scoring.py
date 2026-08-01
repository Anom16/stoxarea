"""
spk2_scoring.py — SPK Lapis 2: Penyaringan & Scoring Saham berbasis 3 Kriteria Likuiditas
"""

import logging
import time
from intelligence_store.ai_scores import ai_store
from intelligence_store.capping_bounds import bounds_store
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.stock import Stock

logger = logging.getLogger(__name__)

MOMENTUM_CACHE = {}
CACHE_TTL = 1

SECTOR_KEYWORDS = {
    "energi": ["energi", "energy"],
    "keuangan": ["keuangan", "financial", "finance", "bank"],
    "infrastruktur": ["infrastruktur", "infrastructure", "utilities", "telecom"],
    "barang konsumen primer": ["primer", "consumer staples", "staples", "makanan"],
    "barang konsumen non-primer": ["non-primer", "consumer cyclicals", "cyclical", "discretionary"],
    "kesehatan": ["kesehatan", "healthcare", "health", "farmasi"],
    "perindustrian": ["perindustrian", "industrial", "industrials"],
    "properti & real estat": ["properti", "property", "real estate"],
    "barang baku": ["barang baku", "basic materials", "materials"],
    "pertanian": ["pertanian", "agriculture", "plantation", "cpo"],
    "teknologi": ["teknologi", "technology", "tech"],
    "transportasi & logistik": ["transportasi", "transportation", "logistics"]
}

import json
from pathlib import Path

QUALIFIED_TICKERS_SET = set()
tf_path = Path("data/tickers/tickers_filtered.json")
if tf_path.exists():
    try:
        with open(tf_path, "r") as f:
            QUALIFIED_TICKERS_SET = {t.replace(".JK", "").strip().upper() for t in json.load(f)}
    except Exception:
        pass

def get_top_momentum_stocks(db: Session, limit: int = 1000, target_sector: Optional[str] = None) -> List[dict]:
    """
    Menampilkan saham-saham yang LOLOS 3 KRITERIA LIKUIDITAS (115 Qualified Stocks).
    """
    all_scores = ai_store.get_all_scores()
    query = db.query(Stock).filter(
        Stock.is_qualified == True
    )
    if target_sector and target_sector.lower() not in ["semua sektor", "all"]:
        sec_key = target_sector.lower().strip()
        keywords = SECTOR_KEYWORDS.get(sec_key, [sec_key])
        from sqlalchemy import or_
        filters = [Stock.sector.ilike(f"%{kw}%") for kw in keywords]
        query = query.filter(or_(*filters))
    
    db_stocks = query.all()
    
    # Filter secara ketat hanya saham yang ada di tickers_filtered.json (115 Saham Qualified)
    if QUALIFIED_TICKERS_SET:
        db_stocks = [s for s in db_stocks if s.ticker.replace(".JK", "").strip().upper() in QUALIFIED_TICKERS_SET]
    
    # Deduplicate by clean ticker (e.g. BBCA vs BBCA.JK)
    grouped = {}
    for s in db_stocks:
        clean = s.ticker.replace(".JK", "").strip().upper()
        if clean not in grouped:
            grouped[clean] = s
        else:
            existing = grouped[clean]
            if not existing.name and s.name:
                grouped[clean] = s

    stocks_list = []
    for clean_ticker, s in grouped.items():
        ticker = s.ticker
        data = all_scores.get(clean_ticker) or all_scores.get(f"{clean_ticker}.JK") or all_scores.get(ticker) or {}
        
        ai_score   = data.get("ai_score", 0.50)
        ai_pct     = data.get("ai_score_percent", "50.0%")
        insights   = data.get("insights", [])

        stocks_list.append({
            "ticker":           s.ticker,
            "name":             s.name or s.ticker,
            "sector":           s.sector or "Keuangan",
            "is_qualified":     True,
            "roe":              s.roe,
            "der":              s.der,
            "pbv":              s.pbv,
            "ai_score":         ai_score,
            "ai_score_percent": ai_pct,
            "insights":         insights,
            "has_ai_score":     True,
            "current_price":    0,
            "price":            0,
            "sparkline":        [],
            "sentiment":        "Bullish" if ai_score >= 0.40 else ("Netral" if ai_score >= 0.30 else "Bearish")
        })
            
    # Sort alphabetically by ticker
    stocks_list.sort(key=lambda x: x["ticker"])
    
    return stocks_list

def get_ai_score_by_ticker(ticker: str) -> dict:
    """Mengambil skor AI untuk satu ticker spesifik."""
    all_scores = ai_store.get_all_scores()
    ticker = ticker.upper()
    clean_t = ticker.replace(".JK", "").strip()
    
    formats = [clean_t, clean_t + ".JK", ticker]
    for f in formats:
        if f in all_scores:
            return all_scores[f]
            
    return {"ai_score": 0.50, "ai_score_percent": "50.0%", "insights": []}

def get_qualified_stocks_for_saw(
    db: Session,
    target_sector: Optional[str] = None,
) -> List[dict]:
    """
    Menyiapkan data saham yang LOLOS 3 KRITERIA LIKUIDITAS dari Database untuk dikonsumsi SPK 3 (SAW).
    """
    query = db.query(Stock).filter(
        Stock.is_qualified == True,
        Stock.roe.isnot(None),
        Stock.der.isnot(None),
        Stock.pbv.isnot(None)
    )
    if target_sector:
        query = query.filter(Stock.sector.ilike(f"%{target_sector}%"))

    stocks = query.all()
    if not stocks:
        return []

    all_scores = ai_store.get_all_scores()
    result = []

    for s in stocks:
        clean_t = s.ticker.replace(".JK", "").strip().upper()
        ai_data = all_scores.get(clean_t) or all_scores.get(f"{clean_t}.JK") or all_scores.get(s.ticker) or {}
        
        ai_score = ai_data.get("ai_score", 0.50)
        insights = ai_data.get("insights", [])

        roe_raw = s.roe if s.roe is not None else 10.0
        der_raw = s.der if s.der is not None else 0.8
        pbv_raw = s.pbv if s.pbv is not None else 1.2

        roe_clean = bounds_store.clamp(roe_raw, "roe")
        der_clean = bounds_store.clamp(der_raw, "der")
        pbv_clean = bounds_store.clamp(pbv_raw, "pbv")

        result.append({
            "ticker":    clean_t,
            "sector":    s.sector or "Keuangan",
            "ai_score":  ai_score,
            "insights":  insights,
            "roe_raw":   roe_raw,
            "der_raw":   der_raw,
            "pbv_raw":   pbv_raw,
            "roe_clean": roe_clean,
            "der_clean": der_clean,
            "pbv_clean": pbv_clean,
        })

    return result
