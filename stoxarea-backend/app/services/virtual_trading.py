from sqlalchemy.orm import Session
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

def execute_trade(db: Session, user_id: int, ticker: str, trade_type: TransactionTypeEnum, qty: int, current_price: float) -> bool:
    """
    Logika mengeksekusi perdagangan virtual (BUY / SELL).
    Mengupdate kepemilikan saham DAN saldo tunai user.
    """
    if qty <= 0 or current_price <= 0:
        return False

    # 1. Ambil Data User untuk cek Saldo
    user = db.query(User).filter(User.id == user_id).first()
    if not user: return False

    total_value = qty * current_price

    # 2. Cari portofolio user untuk saham ini
    portfolio = db.query(Portfolio).filter(
        Portfolio.user_id == user_id,
        Portfolio.ticker == ticker
    ).first()

    if trade_type == TransactionTypeEnum.buy:
        # CEK SALDO: Pastikan uang cukup
        if user.virtual_balance < total_value:
            logger.warning(f"Gagal BUY: Saldo tidak cukup (Saldo: {user.virtual_balance}, Butuh: {total_value}).")
            return False
        
        # Potong Saldo User
        user.virtual_balance -= total_value

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
            logger.warning(f"Gagal SELL: Saham {ticker} tidak cukup.")
            return False
        
        # Tambah Saldo User (Hasil Jual)
        user.virtual_balance += total_value

        portfolio.qty -= qty
        if portfolio.qty <= 0:
            db.delete(portfolio)

    # 3. Catat history transaksi
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
