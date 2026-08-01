from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services.spk2_scoring import get_top_momentum_stocks, get_ai_score_by_ticker
from app.services.market_data import (
    get_technical_data, 
    get_fundamental_data, 
    get_sector_summary, 
    get_historical_financials,
    get_live_price
)

router = APIRouter(prefix="/market", tags=["Market Intelligence (SPK Lapis 2)"])

@router.get("/history/{ticker}")
def get_stock_history(ticker: str, db: Session = Depends(get_db)):
    """
    [NEW - HEAVY] Mengambil data historis 4 tahun (Laba Rugi, Neraca, Dividen).
    Dipisahkan agar pemuatan halaman utama detail emiten tetap cepat.
    """
    ticker_upper = ticker.upper()
    if not ticker_upper.endswith(".JK") and not ticker_upper.startswith("^") and not "=" in ticker_upper:
        ticker_upper += ".JK"
    return get_historical_financials(ticker_upper, db=db)

@router.get("/momentum")
def get_hot_momentum(
    sector: Optional[str] = Query(None, description="Filter berdasarkan nama sektor"),
    db: Session = Depends(get_db)
):
    """
    Menampilkan seluruh saham yang lolos SPK Lapis 2 (AI Momentum XGBoost), 
    diurutkan dari AI Score tertinggi ke terendah.
    Bisa difilter per sektor (12 sektor resmi BEI).
    """
    return get_top_momentum_stocks(db, limit=1000, target_sector=sector)


@router.get("/ai-score/{ticker}")
def get_ticker_score(ticker: str):
    """
    Mendapatkan detail AI Score dan SHAP Insights untuk satu emiten spesifik.
    Digunakan untuk panel 'Visualisasi AI Score & SHAP' di halaman detail emiten.
    """
    data = get_ai_score_by_ticker(ticker.upper())
    if not data:
        return {"message": f"Data AI tidak ditemukan untuk ticker {ticker.upper()}"}
    return data

@router.get("/live-price/{ticker}")
def get_live_price_api(ticker: str):
    """
    [NEW] Mengambil harga saham secara REAL-TIME tanpa cache.
    Digunakan khusus untuk Virtual Trading.
    """
    price = get_live_price(ticker)
    return {"ticker": ticker.upper(), "price": price}


@router.get("/technical/{ticker}")
def get_technical_chart(
    ticker: str,
    period: str = Query("3mo", description="Periode data: 1mo, 3mo, 6mo, 1y, 2y"),
    interval: str = Query("1d", description="Interval candle: 1d, 1wk, 1mo")
):
    """
    [NEW] Mengambil data candlestick OHLCV lengkap beserta Indikator Teknikal
    secara real-time dari yfinance:
    - Candlestick (Open, High, Low, Close, Volume)
    - Moving Average (MA-20, MA-50)
    - RSI (14 periode)
    - MACD + Signal + Histogram
    - Bollinger Bands (Upper, Mid, Lower)
    
    Digunakan untuk 'Interactive Technical Charts' di Frontend.
    """
    ticker_upper = ticker.upper()
    if not ticker_upper.endswith(".JK") and not ticker_upper.startswith("^") and not "=" in ticker_upper:
        ticker_upper += ".JK"
    return get_technical_data(ticker_upper, period=period, interval=interval)


@router.get("/fundamental/{ticker}")
def get_fundamental_detail(
    ticker: str,
    db: Session = Depends(get_db)
):
    """
    [NEW] Mengambil data Fundamental Deep-Dive lengkap untuk satu emiten:
    - Harga (Current Price, 52-Week High/Low, Volume)
    - Valuasi (PER, PBV, PSR, EV/EBITDA)
    - Profitabilitas (ROE, ROA, Net Margin, Gross Margin)
    - Kesehatan Keuangan (DER, Current Ratio, Quick Ratio)
    - Dividen (Yield %, Payout Ratio)
    - Deskripsi Bisnis Perusahaan
    
    Menggabungkan data dari yfinance (real-time) + database lokal (custom pipeline).
    """
    ticker_upper = ticker.upper()
    if not ticker_upper.endswith(".JK") and not ticker_upper.startswith("^") and not "=" in ticker_upper:
        ticker_upper += ".JK"
    return get_fundamental_data(ticker_upper, db=db)


@router.get("/sectors")
def get_sector_overview(db: Session = Depends(get_db)):
    """
    [NEW] Mengembalikan ringkasan 12 Sektor Resmi BEI:
    - Jumlah saham yang aktif dipantau per sektor
    - Rata-rata AI Score (Sentimen Sektor: Bullish/Netral/Bearish)
    - Top 3 Movers (saham dengan momentum AI tertinggi) per sektor
    
    Digunakan untuk Radar Cerdas Sektoral / Market Heatmap di Frontend.
    """
    return get_sector_summary(db)


@router.get("/report/{ticker}/pdf")
def get_stock_report_pdf(
    ticker: str,
    db: Session = Depends(get_db)
):
    """
    [NEW] Mengunduh laporan fundamental, laporan keuangan, dan dividen emiten sebagai PDF.
    """
    ticker_upper = ticker.upper()
    if not ticker_upper.endswith(".JK") and not ticker_upper.startswith("^") and not "=" in ticker_upper:
        ticker_upper += ".JK"
        
    # 1. Fetch data
    fund = get_fundamental_data(ticker_upper, db=db)
    hist = get_historical_financials(ticker_upper, db=db)
    ai = get_ai_score_by_ticker(ticker_upper) or {}
    
    # 2. Generate PDF
    from app.services.stock_pdf import generate_stock_report_pdf
    pdf_bytes = generate_stock_report_pdf(ticker_upper, fund, hist, ai)
    
    filename = f"StoxArea_Laporan_{ticker_upper.replace('.JK', '')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
