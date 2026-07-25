import yfinance as yf
import pandas as pd
import time
import threading
from datetime import datetime, timezone
from typing import Optional

_YF_LOCK = threading.Lock()

# Rate limiter: pastikan jeda minimal antar request ke Yahoo Finance
_LAST_YF_REQUEST = 0.0
_YF_MIN_INTERVAL = 1.0  # minimal 1 detik antar request

def _yf_rate_limit():
    """Pastikan ada jeda minimal antar request ke Yahoo Finance."""
    global _LAST_YF_REQUEST
    now = time.time()
    elapsed = now - _LAST_YF_REQUEST
    if elapsed < _YF_MIN_INTERVAL:
        time.sleep(_YF_MIN_INTERVAL - elapsed)
    _LAST_YF_REQUEST = time.time()

# Cache sederhana untuk optimasi kecepatan load
# Format: { "TICKER_KEY": (timestamp, data) }
_TECHNICAL_CACHE = {}
_FUNDAMENTAL_CACHE = {}
CACHE_TTL_TECH = 600   # 10 menit
CACHE_TTL_FUND = 3600  # 1 jam

# Retry config untuk Yahoo Finance throttling
_YF_MAX_RETRIES = 3
_YF_RETRY_DELAY = 2.0  # detik antar retry

# yfinance 1.4.0+ menggunakan curl_cffi untuk bypass rate limiting
try:
    yf.set_tz_cache_location("cache/yf_tz")
except Exception:
    pass

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
        # Untuk period pendek, fetch data lebih panjang agar indikator MA50 bisa dihitung
        WARMUP = {"1mo": "3mo", "3mo": "6mo", "6mo": "1y"}
        fetch_period = WARMUP.get(period, period)
        # Update trim days sesuai period
        PERIOD_DAYS = {"1mo": 31, "3mo": 92, "6mo": 183}

        with _YF_LOCK:
            _yf_rate_limit()
            df = yf.download(ticker, period=fetch_period, interval=interval, progress=False, auto_adjust=True)
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

        # Trim ke period asli jika menggunakan warmup
        PERIOD_DAYS = {"1mo": 31, "3mo": 92, "6mo": 183}
        if period in PERIOD_DAYS and len(df) > PERIOD_DAYS[period]:
            df = df.tail(PERIOD_DAYS[period])

        dates = df.index.strftime("%Y-%m-%d").tolist()

        # Tanggal candle terakhir = data terbaru dari Yahoo Finance
        last_candle_date = dates[-1] if dates else None
        # Waktu fetch aktual (kapan server mengambil data ini dari Yahoo)
        fetched_at = datetime.fromtimestamp(now, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        res = {
            "ticker": ticker,
            "period": period,
            "interval": interval,
            "dates": dates,
            "last_updated": {
                "last_candle_date": last_candle_date,   # tanggal data harga terakhir
                "fetched_at": fetched_at,               # kapan server fetch dari Yahoo
                "cache_ttl_seconds": CACHE_TTL_TECH,    # berapa lama data ini di-cache
            },
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
    Dilengkapi retry logic untuk menangani Yahoo Finance throttling.
    """
    now = time.time()
    if ticker in _FUNDAMENTAL_CACHE:
        ts, data = _FUNDAMENTAL_CACHE[ticker]
        if now - ts < CACHE_TTL_FUND:
            return data

    # Retry loop untuk menangani Yahoo Finance throttling
    info = None
    last_error = None
    for attempt in range(_YF_MAX_RETRIES):
        try:
            with _YF_LOCK:
                _yf_rate_limit()
                t = yf.Ticker(ticker)
                info = t.info
            # Validasi: info harus punya minimal satu field harga
            if info and (info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")):
                break  # Berhasil, keluar dari retry loop
            # Info kosong/tidak valid, coba lagi
            info = None
            if attempt < _YF_MAX_RETRIES - 1:
                time.sleep(_YF_RETRY_DELAY * (attempt + 1))
        except Exception as e:
            last_error = e
            if attempt < _YF_MAX_RETRIES - 1:
                time.sleep(_YF_RETRY_DELAY * (attempt + 1))

    # Jika semua retry gagal, coba ambil dari database sebagai fallback
    if not info:
        if db:
            try:
                from app.models.stock import Stock
                stock = db.query(Stock).filter_by(ticker=ticker).first()
                if stock:
                    # Return data minimal dari database agar halaman tetap bisa tampil
                    return {
                        "ticker": ticker,
                        "name": stock.name or ticker.replace(".JK", ""),
                        "sector": stock.sector,
                        "industry": None,
                        "last_updated": {"source": "database_fallback"},
                        "price": {"current": None, "open": None, "day_high": None,
                                  "day_low": None, "week_52_high": None, "week_52_low": None,
                                  "volume": 0, "avg_volume": 0, "market_cap": None, "beta": None},
                        "valuation": {"per": stock.pbv, "pbv": stock.pbv},
                        "profitability": {"roe": stock.roe, "roa": None, "net_margin": None},
                        "health": {"der": stock.der},
                        "dividend": {"yield_pct": None, "payout_ratio": None},
                        "description": None,
                        "_fallback": True,
                    }
            except Exception:
                pass
        return {"error": f"Data tidak tersedia untuk {ticker}. Yahoo Finance sedang throttle. Coba lagi dalam beberapa detik."}

    try:

        def safe(key, default=None, digits=2):
            val = info.get(key)
            try:
                return round(float(val), digits) if val is not None else default
            except (TypeError, ValueError):
                return default

        # Data dari DB jika tersedia
        db_roe, db_der, db_pbv = None, None, None
        if db:
            from app.models.stock import Stock
            stock = db.query(Stock).filter_by(ticker=ticker).first()
            if stock:
                db_roe, db_der, db_pbv = stock.roe, stock.der, stock.pbv

        # Waktu update harga terakhir dari Yahoo Finance
        # regularMarketTime = Unix timestamp kapan harga terakhir diupdate di Yahoo
        market_time_unix = info.get("regularMarketTime")
        if market_time_unix:
            try:
                market_dt = datetime.fromtimestamp(int(market_time_unix), tz=timezone.utc)
                market_time_str = market_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                market_date_str = market_dt.strftime("%d %b %Y, %H:%M WIB")
            except Exception:
                market_time_str = None
                market_date_str = None
        else:
            market_time_str = None
            market_date_str = None

        fetched_at = datetime.fromtimestamp(now, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        res = {
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "last_updated": {
                "market_time": market_time_str,       # kapan Yahoo update harga terakhir
                "market_time_display": market_date_str,
                "fetched_at": fetched_at,             # kapan server fetch dari Yahoo
                "cache_ttl_seconds": CACHE_TTL_FUND,  # berapa lama data ini di-cache
            },
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
                "pbv":  db_pbv if db_pbv is not None else safe("priceToBook"),
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

def get_live_price(ticker: str) -> float:
    """
    [NEW] Mengambil harga saham secara REAL-TIME tanpa cache lama.
    Menggunakan daily data 5 hari agar aman dari kekosongan data menit sebelum pasar buka.
    """
    try:
        t = ticker.upper()
        if not t.endswith(".JK") and not t.startswith("^") and not "=" in t:
            t += ".JK"
            
        with _YF_LOCK:
            _yf_rate_limit()
            df = yf.download(t, period="5d", interval="1d", progress=False, auto_adjust=True)
        if not df.empty:
            close_col = df["Close"]
            if isinstance(close_col, pd.DataFrame):
                matched_cols = [c for c in close_col.columns if c.upper() == t]
                if matched_cols:
                    val = close_col[matched_cols[0]].dropna().iloc[-1]
                else:
                    val = close_col.dropna().iloc[-1].iloc[0]
            else:
                val = close_col.dropna().iloc[-1]
            return round(float(val), 2)
        
        # Fallback ke .info HANYA jika download benar-benar gagal total
        with _YF_LOCK:
            _yf_rate_limit()
            info = yf.Ticker(t).info
        # Pastikan info yang didapat memang milik ticker kita (hindari bug cache yfinance)
        if info and info.get("symbol", "").upper() == t:
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            if price:
                return round(float(price), 2)
                
        return 0.0
    except Exception as e:
        print(f"Error live price {ticker}: {e}")
        return 0.0


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
            latest_year = local_data[0].year if local_data else None

            # Fetch dividen live dari Yahoo (ringan, tidak disimpan ke DB)
            try:
                with _YF_LOCK:
                    _yf_rate_limit()
                    t_obj = yf.Ticker(ticker)
                    divs = t_obj.dividends.tail(10)
                history_div = [{"date": d.strftime('%Y-%m-%d'), "amount": float(v)} for d, v in divs.items()]
            except Exception:
                history_div = []

            return {
                "last_updated": {
                    "source": "database",
                    "latest_fiscal_year": latest_year,
                    "display": f"Laporan Fiskal {latest_year}" if latest_year else "—",
                },
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
                "dividend_history": history_div
            }

    # 2. Jika tidak ada di DB, ambil dari YFinance
    try:
        with _YF_LOCK:
            _yf_rate_limit()
            t = yf.Ticker(ticker)
            fin_raw = t.financials.T
            bs_raw = t.balance_sheet.T
            divs = t.dividends.tail(10)
        
        def safe_val(row, key, default=0):
            try:
                val = row.get(key)
                return float(val) if val is not None and not pd.isna(val) else default
            except: return default
        
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
        history_div = [{"date": d.strftime('%Y-%m-%d'), "amount": float(v)} for d, v in divs.items()]

        # Tahun laporan keuangan terbaru
        latest_fiscal_year = years[0].strftime('%Y') if len(years) > 0 else None
        fetched_at_hist = datetime.fromtimestamp(time.time(), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        return {
            "last_updated": {
                "source": "yahoo_finance",
                "latest_fiscal_year": latest_fiscal_year,
                "fetched_at": fetched_at_hist,
                "display": f"Laporan Fiskal {latest_fiscal_year}" if latest_fiscal_year else "—",
            },
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
            "sentiment": "Bullish" if avg_ai >= 0.40 else ("Netral" if avg_ai >= 0.30 else "Bearish"),
        })

    # Urutkan berdasarkan avg_ai_score (sektor paling bullish di atas)
    result.sort(key=lambda x: x["avg_ai_score"], reverse=True)
    return result
