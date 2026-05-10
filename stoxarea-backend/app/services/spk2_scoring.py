from intelligence_store.ai_scores import ai_store
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.stock import Stock

def get_all_ai_scores() -> Dict[str, dict]:
    """
    Mengambil seluruh skor momentum AI (SPK Lapis 2).
    """
    return ai_store.get_all_scores()

def get_top_momentum_stocks(db: Session, limit: int = 10, target_sector: Optional[str] = None) -> List[dict]:
    """
    Menyaring dan mengurutkan saham murni berdasarkan AI Score tertinggi (XGBoost).
    Ini adalah representasi murni dari hasil SPK Lapis 2 tanpa campur tangan fundamental.
    Bisa difilter per sektor.
    """
    all_scores = ai_store.get_all_scores()
    
    # Ambil data saham dari DB untuk mencocokkan sektor
    query = db.query(Stock.ticker, Stock.sector)
    if target_sector:
        query = query.filter(Stock.sector.ilike(f"%{target_sector}%"))
        
    valid_tickers = {s.ticker: s.sector for s in query.all()}
    
    # Format data untuk di-sort
    stocks_list = []
    for ticker, data in all_scores.items():
        # Hanya masukkan jika tidak ada filter sektor ATAU ticker ada dalam daftar valid_tickers
        if not target_sector or ticker in valid_tickers:
            stocks_list.append({
                "ticker": ticker,
                "sector": valid_tickers.get(ticker, "Unknown"),
                "ai_score": data.get("ai_score", 0.0),
                "ai_score_percent": data.get("ai_score_percent", "0%"),
                "insights": data.get("insights", [])
            })
            
    # Sort descending berdasarkan ai_score
    stocks_list.sort(key=lambda x: x["ai_score"], reverse=True)
    top_stocks = stocks_list[:limit]

    # --- Optimasi: Ambil Sparkline (Tren 7 Hari) ---
    import yfinance as yf
    try:
        tickers = [s["ticker"] for s in top_stocks]
        # Jika ticker tidak pakai .JK, tambahkan
        yf_tickers = [t if t.endswith(".JK") else t + ".JK" for t in tickers]
        
        # Download data harga 1 bulan terakhir untuk ambil 7 hari trading terakhir
        data = yf.download(yf_tickers, period="1mo", interval="1d", progress=False, auto_adjust=True)
        if not data.empty:
            prices = data["Close"]
            for s in top_stocks:
                t = s["ticker"]
                yf_t = t if t.endswith(".JK") else t + ".JK"
                if yf_t in prices:
                    p_series = prices[yf_t].dropna().tail(7).tolist()
                    s["sparkline"] = [round(float(x), 2) for x in p_series]
                    s["current_price"] = round(float(p_series[-1]), 2) if p_series else 0
                    # Hitung sentimen sederhana dari tren 7 hari
                    if len(p_series) >= 2:
                        change = p_series[-1] - p_series[0]
                        s["sentiment"] = "Bullish" if change > 0 else "Bearish"
                    else:
                        s["sentiment"] = "Netral"
                else:
                    s["sparkline"] = []
                    s["sentiment"] = "Netral"
    except Exception as e:
        print(f"Error fetching sparklines: {e}")
        for s in top_stocks:
            s["sparkline"] = []
            s["sentiment"] = "Netral"
    
    return top_stocks

def get_ai_score_by_ticker(ticker: str) -> dict:
    """
    Mengambil skor AI (SPK Lapis 2) untuk spesifik emiten.
    """
    return ai_store.get_score(ticker)
