from sqlalchemy.orm import Session
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
import logging

logger = logging.getLogger(__name__)

def execute_trade(db: Session, user_id: int, ticker: str, trade_type: TransactionTypeEnum, qty: int, current_price: float) -> bool:
    """
    Logika mengeksekusi perdagangan virtual (BUY / SELL).
    """
    if qty <= 0 or current_price <= 0:
        return False

    # Cari portofolio user untuk saham ini
    portfolio = db.query(Portfolio).filter(
        Portfolio.user_id == user_id,
        Portfolio.ticker == ticker
    ).first()

    if trade_type == TransactionTypeEnum.buy:
        if portfolio:
            # Average down / up calculation
            total_cost = (portfolio.qty * portfolio.avg_price) + (qty * current_price)
            portfolio.qty += qty
            portfolio.avg_price = total_cost / portfolio.qty
        else:
            # Beli saham baru
            portfolio = Portfolio(
                user_id=user_id,
                ticker=ticker,
                qty=qty,
                avg_price=current_price
            )
            db.add(portfolio)
    
    elif trade_type == TransactionTypeEnum.sell:
        if not portfolio or portfolio.qty < qty:
            logger.warning(f"Gagal SELL: Saham {ticker} tidak cukup (Dimiliki: {portfolio.qty if portfolio else 0}, Diminta: {qty}).")
            return False
        
        portfolio.qty -= qty
        if portfolio.qty == 0:
            db.delete(portfolio)
            # Opsional: biarkan 0 untuk history, tapi biasanya dihapus dari kepemilikan aktif.

    # Catat history transaksi
    new_tx = Transaction(
        user_id=user_id,
        ticker=ticker,
        type=trade_type,
        price=current_price,
        qty=qty
    )
    db.add(new_tx)

    try:
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Gagal melakukan trading: {str(e)}")
        return False
