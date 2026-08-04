from sqlalchemy.orm import Session
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

# ── Biaya Transaksi BEI (Simulasi Realistis) ─────────────────────────────────
#
# FIX #2: Tambahkan fee broker dan pajak agar simulator tidak menciptakan
# "ilusi profit" — user yang scalping 1 tick terlihat cuan padahal di pasar
# nyata saldo mereka tergerus biaya transaksi.
#
# Struktur biaya BEI yang umum dipakai broker retail Indonesia:
#   BUY  : fee broker 0.15% dari nilai transaksi
#   SELL : fee broker 0.15% + PPN 11% dari fee + PPh Final 0.1% dari nilai jual
#          → efektif sekitar 0.25% dari nilai jual
#
# Catatan: Angka ini adalah rata-rata broker online (Ajaib, Stockbit, dll).
# Broker konvensional bisa lebih tinggi (0.3% beli / 0.4% jual).
FEE_BUY_RATE  = 0.0015   # 0.15% dari nilai beli
FEE_SELL_RATE = 0.0025   # 0.25% dari nilai jual (fee + PPN + PPh Final)


def execute_trade(
    db: Session,
    user_id: int,
    ticker: str,
    trade_type: TransactionTypeEnum,
    qty: int,
    current_price: float
) -> dict:
    """
    Logika mengeksekusi perdagangan virtual (BUY / SELL).
    Mengupdate kepemilikan saham DAN saldo tunai user.

    Returns:
        dict dengan keys:
            success (bool)
            message (str)
            executed_price (float)   — harga per lembar
            gross_value (float)      — nilai sebelum fee
            fee_amount (float)       — total biaya transaksi
            net_value (float)        — nilai setelah fee (yang benar-benar dipotong/diterima)
    """
    if qty <= 0 or current_price <= 0:
        return {"success": False, "message": "Qty dan harga harus lebih dari 0."}

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"success": False, "message": "User tidak ditemukan."}

    # Standardize ticker format: DB always stores ticker with .JK suffix (e.g. BBCA.JK)
    ticker_upper = ticker.upper().strip()
    ticker_full = ticker_upper if ticker_upper.endswith(".JK") else f"{ticker_upper}.JK"
    ticker_clean = ticker_upper.replace(".JK", "")

    gross_value = qty * current_price

    # Flexible matching: search portfolio by ticker_full, ticker_clean, or raw input
    portfolio = db.query(Portfolio).filter(
        Portfolio.user_id == user_id,
        Portfolio.ticker.in_([ticker_full, ticker_clean, ticker_upper])
    ).first()

    if trade_type == TransactionTypeEnum.buy:
        # Hitung fee beli
        fee_amount = round(gross_value * FEE_BUY_RATE, 2)
        net_value  = gross_value + fee_amount   # user membayar harga + fee

        # Cek saldo mencukupi (termasuk fee)
        if user.virtual_balance < net_value:
            logger.warning(
                f"Gagal BUY {ticker_clean}: Saldo tidak cukup "
                f"(Saldo: {user.virtual_balance:,.0f}, Butuh: {net_value:,.0f} "
                f"[termasuk fee Rp {fee_amount:,.0f}])"
            )
            return {
                "success": False,
                "message": (
                    f"Saldo tidak cukup. Dibutuhkan Rp {net_value:,.0f} "
                    f"(harga Rp {gross_value:,.0f} + fee Rp {fee_amount:,.0f})."
                )
            }

        # Potong saldo (harga + fee)
        user.virtual_balance -= net_value

        if portfolio:
            # Standardize ticker to .JK
            portfolio.ticker = ticker_full
            # Average cost: hitung ulang avg_price berdasarkan total cost
            total_cost = (portfolio.qty * portfolio.avg_price) + gross_value
            portfolio.qty += qty
            portfolio.avg_price = total_cost / portfolio.qty
        else:
            portfolio = Portfolio(
                user_id=user_id,
                ticker=ticker_full,
                qty=qty,
                avg_price=current_price
            )
            db.add(portfolio)

    elif trade_type == TransactionTypeEnum.sell:
        if not portfolio or portfolio.qty < qty:
            logger.warning(f"Gagal SELL {ticker_clean}: Saham tidak cukup.")
            return {"success": False, "message": f"Kepemilikan saham {ticker_clean} tidak mencukupi untuk dijual."}

        # Hitung fee jual
        fee_amount = round(gross_value * FEE_SELL_RATE, 2)
        net_value  = gross_value - fee_amount   # user menerima harga - fee

        # Tambah saldo (hasil jual setelah fee)
        user.virtual_balance += net_value

        portfolio.qty -= qty
        if portfolio.qty <= 0:
            db.delete(portfolio)

    else:
        return {"success": False, "message": "Tipe transaksi tidak valid."}

    # Catat history transaksi (simpan ticker_full untuk konsistensi)
    new_tx = Transaction(
        user_id=user_id,
        ticker=ticker_full,
        type=trade_type,
        price=current_price,
        qty=qty,
        fee=fee_amount,
        net_value=net_value
    )
    db.add(new_tx)

    try:
        db.commit()
        logger.info(
            f"[{trade_type.value}] {ticker} {qty} lembar @ Rp {current_price:,.0f} | "
            f"Gross: Rp {gross_value:,.0f} | Fee: Rp {fee_amount:,.0f} | "
            f"Net: Rp {net_value:,.0f}"
        )
        return {
            "success": True,
            "message": f"Transaksi {trade_type.value} berhasil.",
            "executed_price": current_price,
            "gross_value": gross_value,
            "fee_amount": fee_amount,
            "net_value": net_value,
            "fee_rate_pct": f"{(FEE_BUY_RATE if trade_type == TransactionTypeEnum.buy else FEE_SELL_RATE) * 100:.2f}%"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Gagal commit transaksi: {str(e)}")
        return {"success": False, "message": "Gagal menyimpan transaksi ke database."}
