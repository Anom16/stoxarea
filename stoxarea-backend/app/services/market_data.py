import yfinance as yf
import pandas as pd
import time
from typing import Optional

# Cache sederhana untuk optimasi kecepatan load
# Format: { "TICKER_KEY": (timestamp, data) }
_TECHNICAL_CACHE = {}
_FUNDAMENTAL_CACHE = {}
CACHE_TTL_TECH = 600  # 10 menit
CACHE_TTL_FUND = 1800 # 30 menit

def get_technical_data(ticker: str, period: str = "3mo", interval: str = "1d") -> dict:
    """
    Mengambil data candlestick + indikator teknikal (RSI, MACD, BB, MA) dari yfinance.
    Digunakan untuk Interactive Technical Charts di Frontend.
    """
    cache_key = f"{ticker}_{period}_{interval}"
    now = time.time()
    
    if cache_key in _TECHNICAL_CACHE:
        ts, data = _TECHNICAL_CACHE[cache_key]
        if now - ts < CACHE_TTL_TECH:
            return data

    try:
        df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
        if df.empty:
            return {"error": f"Data tidak tersedia untuk {ticker}"}

        df = df.copy()
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
        close = df["Close"]

        # --- Moving Average ---
        df["ma_20"] = close.rolling(20).mean()
        df["ma_50"] = close.rolling(50).mean()

        # --- RSI (14 periode) ---
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss
        df["rsi"] = 100 - (100 / (1 + rs))

        # --- MACD ---
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        df["macd"] = ema12 - ema26
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
        df["macd_hist"] = df["macd"] - df["macd_signal"]

        # --- Bollinger Bands ---
        df["bb_mid"] = close.rolling(20).mean()
        bb_std = close.rolling(20).std()
        df["bb_upper"] = df["bb_mid"] + 2 * bb_std
        df["bb_lower"] = df["bb_mid"] - 2 * bb_std

        # Buang baris NaN lalu konversi ke list untuk JSON
        df = df.dropna()
        dates = df.index.strftime("%Y-%m-%d").tolist()

        res = {
            "ticker": ticker,
            "period": period,
            "interval": interval,
            "dates": dates,
            "candles": {
                "open":  [round(float(x), 2) for x in df["Open"].tolist()],
                "high":  [round(float(x), 2) for x in df["High"].tolist()],
                "low":   [round(float(x), 2) for x in df["Low"].tolist()],
                "close": [round(float(x), 2) for x in close.loc[df.index].tolist()],
                "volume":[int(x) for x in df["Volume"].tolist()],
            },
            "indicators": {
                "ma_20":       [round(float(x), 2) for x in df["ma_20"].tolist()],
                "ma_50":       [round(float(x), 2) for x in df["ma_50"].tolist()],
                "rsi":         [round(float(x), 2) for x in df["rsi"].tolist()],
                "macd":        [round(float(x), 4) for x in df["macd"].tolist()],
                "macd_signal": [round(float(x), 4) for x in df["macd_signal"].tolist()],
                "macd_hist":   [round(float(x), 4) for x in df["macd_hist"].tolist()],
                "bb_upper":    [round(float(x), 2) for x in df["bb_upper"].tolist()],
                "bb_mid":      [round(float(x), 2) for x in df["bb_mid"].tolist()],
                "bb_lower":    [round(float(x), 2) for x in df["bb_lower"].tolist()],
            }
        }
        _TECHNICAL_CACHE[cache_key] = (now, res)
        return res

    except Exception as e:
        return {"error": str(e)}


def get_fundamental_data(ticker: str, db=None) -> dict:
    """
    [OPTIMIZED] Mengambil data fundamental inti (cepat).
    Tidak mengambil data historis yang berat.
    """
    now = time.time()
    if ticker in _FUNDAMENTAL_CACHE:
        ts, data = _FUNDAMENTAL_CACHE[ticker]
        if now - ts < CACHE_TTL_FUND:
            return data

    try:
        t = yf.Ticker(ticker)
        info = t.info

        def safe(key, default=None, digits=2):
            val = info.get(key)
            try:
                return round(float(val), digits) if val is not None else default
            except (TypeError, ValueError):
                return default

        # Data dari DB jika tersedia
        db_roe, db_der, db_per = None, None, None
        if db:
            from app.models.stock import Stock
            stock = db.query(Stock).filter_by(ticker=ticker).first()
            if stock:
                db_roe, db_der, db_per = stock.roe, stock.der, stock.per

        res = {
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "price": {
                "current":         safe("currentPrice") or safe("regularMarketPrice"),
                "open":            safe("open") or safe("regularMarketOpen"),
                "day_high":        safe("dayHigh"),
                "day_low":         safe("dayLow"),
                "week_52_high":    safe("fiftyTwoWeekHigh"),
                "week_52_low":     safe("fiftyTwoWeekLow"),
                "volume":          int(info.get("volume") or info.get("regularMarketVolume") or 0),
                "avg_volume":      int(info.get("averageVolume") or 0),
                "market_cap":      info.get("marketCap"),
                "beta":            safe("beta"),
            },
            "valuation": {
                "per":  db_per if db_per is not None else safe("trailingPE"),
                "pbv":  safe("priceToBook"),
            },
            "profitability": {
                "roe":          db_roe if db_roe is not None else safe("returnOnEquity"),
                "roa":          safe("returnOnAssets"),
                "net_margin":   safe("profitMargins"),
            },
            "health": {
                "der":          db_der if db_der is not None else safe("debtToEquity"),
            },
            "dividend": {
                "yield_pct":    safe("dividendYield", digits=4),
                "payout_ratio": safe("payoutRatio"),
            },
            "description": info.get("longBusinessSummary"),
        }
        _FUNDAMENTAL_CACHE[ticker] = (now, res)
        return res
    except Exception as e:
        return {"error": str(e)}

def get_historical_financials(ticker: str, db=None) -> dict:
    """
    [PERSISTENCE] Mengambil data historis dari Database.
    Jika tidak ada, fetch dari yfinance dan simpan permanen ke DB.
    """
    from app.models.financials import FinancialHistory
    
    # 1. Cek di Database Lokal
    if db:
        local_data = db.query(FinancialHistory).filter_by(ticker=ticker).order_by(FinancialHistory.year.desc()).all()
        if local_data:
            return {
                "financials_history": [{
                    "year": d.year,
                    "revenue": d.revenue,
                    "net_income": d.net_income
                } for d in local_data],
                "balance_sheet_history": [{
                    "year": d.year,
                    "assets": d.assets,
                    "liabilities": d.liabilities,
                    "equity": d.equity
                } for d in local_data],
                "dividend_history": [] # Kita fetch dividen secara live karena ringan
            }

    # 2. Jika tidak ada di DB, ambil dari YFinance
    try:
        t = yf.Ticker(ticker)
        
        def safe_val(row, key, default=0):
            try:
                val = row.get(key)
                return float(val) if val is not None and not pd.isna(val) else default
            except: return default

        fin_raw = t.financials.T
        bs_raw = t.balance_sheet.T
        
        res_fin = []
        res_bs = []

        # Gabungkan data untuk disimpan ke DB
        years = fin_raw.head(4).index
        for yr in years:
            yr_str = yr.strftime('%Y')
            f_row = fin_raw.loc[yr]
            b_row = bs_raw.loc[yr] if yr in bs_raw.index else {}

            fin_item = {
                "year": yr_str,
                "revenue": safe_val(f_row, "Total Revenue"),
                "net_income": safe_val(f_row, "Net Income"),
            }
            bs_item = {
                "year": yr_str,
                "assets": safe_val(b_row, "Total Assets"),
                "liabilities": safe_val(b_row, "Total Liabilities Net Minority Interest") or safe_val(b_row, "Total Liabilities"),
                "equity": safe_val(b_row, "Stockholders Equity"),
            }
            res_fin.append(fin_item)
            res_bs.append(bs_item)

            # Simpan ke Database secara permanen
            if db:
                new_hist = FinancialHistory(
                    ticker=ticker,
                    year=yr_str,
                    revenue=fin_item["revenue"],
                    net_income=fin_item["net_income"],
                    assets=bs_item["assets"],
                    liabilities=bs_item["liabilities"],
                    equity=bs_item["equity"]
                )
                db.merge(new_hist) # merge akan update jika sudah ada
        
        if db: db.commit()

        # Dividends tetap live karena datanya kecil/ringan
        divs = t.dividends.tail(10)
        history_div = [{"date": d.strftime('%Y-%m-%d'), "amount": float(v)} for d, v in divs.items()]

        return {
            "financials_history": res_fin,
            "balance_sheet_history": res_bs,
            "dividend_history": history_div
        }
    except Exception as e:
        return {"error": str(e)}


def get_sector_summary(db) -> list:
    """
    Menghasilkan daftar 12 sektor BEI beserta jumlah saham dan
    rata-rata AI Score per sektor.
    """
    from app.models.stock import Stock
    from intelligence_store.ai_scores import ai_store

    SECTORS_BEI = [
        "Keuangan",
        "Energi",
        "Barang Konsumen Primer",
        "Barang Konsumen Non-Primer",
        "Kesehatan",
        "Infrastruktur",
        "Perindustrian",
        "Properti & Real Estat",
        "Barang Baku",
        "Pertanian",
        "Teknologi",
        "Transportasi & Logistik",
    ]

    stocks = db.query(Stock).all()
    all_scores = ai_store.get_all_scores()

    result = []
    for sector in SECTORS_BEI:
        sector_stocks = [s for s in stocks if s.sector and sector.lower() in s.sector.lower()]
        ai_scores_in_sector = [
            all_scores[s.ticker].get("ai_score", 0)
            for s in sector_stocks
            if s.ticker in all_scores
        ]
        avg_ai = round(sum(ai_scores_in_sector) / len(ai_scores_in_sector), 4) if ai_scores_in_sector else 0
        top_movers = sorted(
            [(s.ticker, all_scores.get(s.ticker, {}).get("ai_score", 0)) for s in sector_stocks],
            key=lambda x: x[1], reverse=True
        )[:3]

        result.append({
            "sector": sector,
            "total_stocks": len(sector_stocks),
            "avg_ai_score": avg_ai,
            "avg_ai_score_percent": f"{avg_ai * 100:.1f}%",
            "top_movers": [{"ticker": t, "ai_score_percent": f"{s*100:.1f}%"} for t, s in top_movers],
            "sentiment": "Bullish" if avg_ai >= 0.55 else ("Netral" if avg_ai >= 0.45 else "Bearish"),
        })

# Urutkan berdasarkan avg_ai_score (sektor paling bullish di atas)
    result.sort(key=lambda x: x["avg_ai_score"], reverse=True)
    return result
