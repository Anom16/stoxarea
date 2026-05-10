from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user_email
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.transaction import TransactionTypeEnum
from app.services.virtual_trading import execute_trade

router = APIRouter(prefix="/portfolio", tags=["Virtual Trading"])

class TradeRequest(BaseModel):
    ticker: str
    qty: int
    price: float

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
def buy_stock(trade: TradeRequest, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    """Simulasi beli saham."""
    user = db.query(User).filter(User.email == email).first()
    success = execute_trade(db, user.id, trade.ticker.upper(), TransactionTypeEnum.buy, trade.qty, trade.price)
    
    if not success:
        raise HTTPException(status_code=400, detail="Gagal melakukan transaksi BUY.")
        
    return {"message": f"Berhasil membeli {trade.qty} lot {trade.ticker}"}

@router.post("/sell")
def sell_stock(trade: TradeRequest, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    """Simulasi jual saham."""
    user = db.query(User).filter(User.email == email).first()
    success = execute_trade(db, user.id, trade.ticker.upper(), TransactionTypeEnum.sell, trade.qty, trade.price)
    
    if not success:
        raise HTTPException(status_code=400, detail="Gagal melakukan transaksi SELL. Saham tidak cukup.")
        
    return {"message": f"Berhasil menjual {trade.qty} lot {trade.ticker}"}
