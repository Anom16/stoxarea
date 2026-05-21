import time
from intelligence_store.ai_scores import ai_store
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.stock import Stock

# --- Sistem Caching Sederhana ---
MOMENTUM_CACHE = {} # { "sector_name": {"data": [...], "expiry": timestamp} }
CACHE_TTL = 300 # Cache berlaku selama 5 menit (300 detik)

def get_top_momentum_stocks(db: Session, limit: int = 30, target_sector: Optional[str] = None) -> List[dict]:
    """
    [OPTIMIZED] Menyaring saham berdasarkan AI Score dengan sistem Caching.
    Mencegah lag akibat fetch yfinance berulang-ulang.
    """
    global MOMENTUM_CACHE
    cache_key = target_sector or "all"
    current_time = time.time()

    # 1. Cek apakah ada di cache dan belum expired
    if cache_key in MOMENTUM_CACHE:
        cache_data = MOMENTUM_CACHE[cache_key]
        if current_time < cache_data["expiry"]:
            return cache_data["data"]

    # 2. Jika tidak ada di cache, lakukan proses berat
    all_scores = ai_store.get_all_scores()
    
    # Ambil data saham dari DB sebagai basis utama (Hanya yang lolos filter)
    query = db.query(Stock.ticker, Stock.sector).filter(Stock.is_qualified == True)
    if target_sector:
        query = query.filter(Stock.sector.ilike(f"%{target_sector}%"))
    
    db_stocks = query.all()
    
    stocks_list = []
    for s in db_stocks:
        ticker = s.ticker
        # Ambil skor AI jika ada
        data = all_scores.get(ticker)
        
        # HANYA TAMPILKAN JIKA ADA DATA AI (Tidak 0%)
        if data:
            stocks_list.append({
                "ticker": ticker,
                "sector": s.sector or "Unknown",
                "ai_score": data.get("ai_score", 0.0),
                "ai_score_percent": data.get("ai_score_percent", "0%"),
                "insights": data.get("insights", [])
            })
            
    # Urutkan berdasarkan AI Score tertinggi (yang belum ada skor di bawah)
    stocks_list.sort(key=lambda x: x["ai_score"], reverse=True)
    # Gunakan limit yang lebih besar sesuai jumlah database
    top_stocks = stocks_list[:150]

    # 3. Fetch Data Pasar (Sparkline & Price) - Ini yang biasanya menyebabkan LAG
    import yfinance as yf
    try:
        tickers = [s["ticker"] for s in top_stocks]
        yf_tickers = [t if t.endswith(".JK") else t + ".JK" for t in tickers]
        
        # Download data 1 bulan terakhir secara kolektif (satu request saja)
        data = yf.download(yf_tickers, period="1mo", interval="1d", progress=False, auto_adjust=True)
        
        if not data.empty:
            # Jika hanya satu saham, pandas return Series. Jika banyak, return DataFrame.
            # Kita handle agar selalu konsisten
            if len(yf_tickers) > 1:
                prices = data["Close"]
            else:
                prices = {yf_tickers[0]: data["Close"]}

            for s in top_stocks:
                t = s["ticker"]
                yf_t = t if t.endswith(".JK") else t + ".JK"
                
                if yf_t in prices:
                    # Ambil 7 hari terakhir untuk sparkline
                    p_series = prices[yf_t].dropna().tail(7).tolist()
                    s["sparkline"] = [round(float(x), 2) for x in p_series]
                    s["current_price"] = round(float(p_series[-1]), 2) if p_series else 0
                    
                    if len(p_series) >= 2:
                        change = p_series[-1] - p_series[0]
                        s["sentiment"] = "Bullish" if change > 0 else "Bearish"
                    else:
                        s["sentiment"] = "Netral"
                else:
                    s["sparkline"] = []
                    s["sentiment"] = "Netral"
                    s["current_price"] = 0
    except Exception as e:
        print(f"Error fetching market data: {e}")
        # Berikan data kosong agar UI tidak hancur
        for s in top_stocks:
            s["sparkline"] = []
            s["current_price"] = 0

    # 4. Simpan hasil kerja berat ke Cache sebelum dikembalikan
    MOMENTUM_CACHE[cache_key] = {
        "data": top_stocks,
        "expiry": current_time + CACHE_TTL
    }
    
    return top_stocks

def get_ai_score_by_ticker(ticker: str) -> dict:
    """
    Mengambil skor AI untuk satu ticker spesifik.
    """
    all_scores = ai_store.get_all_scores()
    ticker = ticker.upper()
    
    # Coba berbagai variasi format ticker
    formats = [ticker, ticker + ".JK", ticker.replace(".JK", "")]
    for f in formats:
        if f in all_scores:
            return all_scores[f]
            
    return {}
