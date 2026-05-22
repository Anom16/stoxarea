from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user_email
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.services.virtual_trading import execute_trade
from app.services.market_data import get_live_price

router = APIRouter(prefix="/portfolio", tags=["Virtual Trading"])

# FIX #1a: Hapus field `price` dari request — harga diambil server-side.
# FIX #1b: Tambah validasi qty harus kelipatan 1 lot (100 lembar) dan minimal 1 lot.
class TradeRequest(BaseModel):
    ticker: str
    qty: int  # dalam satuan LOT (1 lot = 100 lembar saham BEI)

    @field_validator("qty")
    @classmethod
    def qty_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Jumlah lot harus lebih dari 0.")
        return v

    @field_validator("ticker")
    @classmethod
    def ticker_must_not_be_empty(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Ticker tidak boleh kosong.")
        return v

class PortfolioItemResponse(BaseModel):
    ticker: str
    qty: int
    avg_price: float

    class Config:
        from_attributes = True

@router.get("/", response_model=List[PortfolioItemResponse])
def get_portfolio(email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    """Melihat portofolio saham pengguna saat ini."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return user.portfolios

@router.post("/buy")
def buy_stock(
    trade: TradeRequest,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Simulasi beli saham.
    Harga diambil secara server-side dari yfinance (tidak bisa dimanipulasi client).
    qty dalam satuan LOT (1 lot = 100 lembar).
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ticker = trade.ticker.upper()
    live_price = get_live_price(ticker)
    if live_price <= 0:
        raise HTTPException(
            status_code=503,
            detail=f"Tidak dapat mengambil harga live untuk {ticker}. Coba beberapa saat lagi."
        )

    qty_lembar = trade.qty * 100

    result = execute_trade(
        db, user.id, ticker, TransactionTypeEnum.buy, qty_lembar, live_price
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return {
        "message": f"Berhasil membeli {trade.qty} lot {ticker}",
        "executed_price": result["executed_price"],
        "gross_value": result["gross_value"],
        "fee_amount": result["fee_amount"],
        "fee_rate": result["fee_rate_pct"],
        "net_value": result["net_value"],
        "qty_lembar": qty_lembar,
    }

@router.post("/sell")
def sell_stock(
    trade: TradeRequest,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Simulasi jual saham.
    Harga diambil secara server-side dari yfinance (tidak bisa dimanipulasi client).
    qty dalam satuan LOT (1 lot = 100 lembar).
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ticker = trade.ticker.upper()
    live_price = get_live_price(ticker)
    if live_price <= 0:
        raise HTTPException(
            status_code=503,
            detail=f"Tidak dapat mengambil harga live untuk {ticker}. Coba beberapa saat lagi."
        )

    qty_lembar = trade.qty * 100

    result = execute_trade(
        db, user.id, ticker, TransactionTypeEnum.sell, qty_lembar, live_price
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return {
        "message": f"Berhasil menjual {trade.qty} lot {ticker}",
        "executed_price": result["executed_price"],
        "gross_value": result["gross_value"],
        "fee_amount": result["fee_amount"],
        "fee_rate": result["fee_rate_pct"],
        "net_value": result["net_value"],
        "qty_lembar": qty_lembar,
    }


@router.get("/transactions")
def get_transactions(
    limit: int = 50,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Riwayat transaksi virtual trading user.
    Mengembalikan data lengkap termasuk fee dan net_value.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": tx.id,
            "ticker": tx.ticker,
            "type": tx.type.value,
            "qty": tx.qty,
            "price": tx.price,
            "fee": tx.fee,
            "net_value": tx.net_value,
            "gross_value": tx.qty * tx.price,
            "timestamp": str(tx.timestamp),
        }
        for tx in txs
    ]
