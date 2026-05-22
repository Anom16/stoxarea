"""
spk2_scoring.py — SPK Lapis 2: Penyaringan & Scoring Saham

Tanggung jawab layer ini (Task 1.3 — Separation of Concerns):
    - Menyaring saham tidak qualified (is_qualified = False)
    - Menyiapkan data fundamental yang sudah BERSIH (di-clamp) untuk SPK 3
    - SPK 3 tidak perlu tahu soal outlier — tugasnya hanya menghitung SAW

Fungsi utama:
    get_top_momentum_stocks()     → untuk halaman Market (tampilan publik)
    get_qualified_stocks_for_saw() → khusus untuk dikonsumsi SPK 3 (data bersih)
"""

import time
from intelligence_store.ai_scores import ai_store
from intelligence_store.capping_bounds import bounds_store   # ← Task 1.3
from typing import List, Optional
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


# ─── Task 1.3: Data Gateway untuk SPK 3 ──────────────────────────────────────

def get_qualified_stocks_for_saw(
    db: Session,
    target_sector: Optional[str] = None
) -> List[dict]:
    """
    [Task 1.3 — Separation of Concerns]
    Menyiapkan data saham yang sudah BERSIH untuk dikonsumsi SPK 3 (SAW).

    Tanggung jawab fungsi ini:
        1. Filter saham is_qualified = True (lolos SPK 2)
        2. Gabungkan dengan AI Score dari intelligence_store
        3. Clamp nilai fundamental (ROE, DER, PER) menggunakan bounds persentil
           → SPK 3 tidak perlu tahu soal outlier, tinggal hitung SAW

    Perbedaan dengan get_top_momentum_stocks():
        - Fungsi itu: untuk halaman Market (butuh sparkline, harga, sentimen)
        - Fungsi ini: khusus untuk SAW (butuh fundamental bersih, tidak butuh harga)

    Returns:
        List of dict dengan field:
            ticker, sector, ai_score, insights,
            roe_raw, der_raw, per_raw,      ← nilai asli untuk ditampilkan di UI
            roe_clean, der_clean, per_clean  ← nilai bersih untuk kalkulasi SAW
    """
    # Query saham qualified dari DB
    query = db.query(Stock).filter(Stock.is_qualified == True)
    if target_sector:
        query = query.filter(Stock.sector.ilike(f"%{target_sector}%"))

    stocks = query.all()
    if not stocks:
        return []

    all_scores = ai_store.get_all_scores()
    result = []

    for s in stocks:
        ai_data = all_scores.get(s.ticker)
        if not ai_data:
            # Skip saham yang belum punya AI Score (pipeline belum jalan)
            continue

        # Nilai mentah — disimpan untuk ditampilkan di UI
        roe_raw = s.roe
        der_raw = s.der
        per_raw = s.per

        # Nilai bersih — sudah di-clamp ke batas persentil P5-P95
        # Ini yang dipakai untuk kalkulasi normalisasi SAW di SPK 3
        # SPK 3 tidak perlu tahu batas capping — sudah ditangani di sini
        roe_clean = bounds_store.clamp(roe_raw, "roe")
        der_clean = bounds_store.clamp(der_raw, "der")
        per_clean = bounds_store.clamp(per_raw, "per")

        result.append({
            "ticker":    s.ticker,
            "sector":    s.sector or "Unknown",
            "ai_score":  ai_data.get("ai_score", 0.0),
            "insights":  ai_data.get("insights", []),
            # Nilai asli (untuk UI)
            "roe_raw":   roe_raw,
            "der_raw":   der_raw,
            "per_raw":   per_raw,
            # Nilai bersih (untuk SAW) — sudah bebas outlier
            "roe_clean": roe_clean,
            "der_clean": der_clean,
            "per_clean": per_clean,
        })

    return result
