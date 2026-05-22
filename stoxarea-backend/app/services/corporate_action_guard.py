"""
corporate_action_guard.py — FIX #3: Deteksi Corporate Action Otomatis

Masalah yang diselesaikan:
    Ketika saham melakukan stock split (misal BBCA 1:5), harga di yfinance
    besok pagi terlihat "anjlok" 80% sebelum adjusted price diperbarui.
    Pipeline ML akan mengira saham hancur → AI Score anjlok.
    Portofolio virtual user yang pegang saham itu tiba-tiba minus 80%.

Solusi:
    1. Sebelum pipeline menyimpan data baru, bandingkan harga hari ini vs kemarin.
    2. Jika perubahan > 35% (batas ARB/ARA BEI), tandai sebagai needs_review.
    3. Pipeline SKIP saham ini — tidak update OHLCV, tidak update AI Score.
    4. Admin validasi via endpoint /admin/ml/corporate-actions.
    5. Jika terkonfirmasi stock split, sesuaikan qty di tabel portfolios.
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.corporate_action import CorporateActionFlag
from app.models.portfolio import Portfolio

logger = logging.getLogger(__name__)

# Batas perubahan harga harian yang memicu flag (sesuai ARB/ARA BEI = 35%)
EXTREME_CHANGE_THRESHOLD = 0.35


def check_and_flag(ticker: str, prev_close: float, curr_close: float) -> bool:
    """
    Periksa apakah perubahan harga harian melebihi threshold ARB/ARA BEI.

    Args:
        ticker: kode saham (misal "BBCA.JK")
        prev_close: harga penutupan hari sebelumnya
        curr_close: harga penutupan hari ini

    Returns:
        True  → perubahan ekstrem terdeteksi, saham di-flag, pipeline harus SKIP
        False → perubahan normal, pipeline boleh lanjut
    """
    if prev_close <= 0 or curr_close <= 0:
        return False

    change_pct = (curr_close - prev_close) / prev_close

    if abs(change_pct) <= EXTREME_CHANGE_THRESHOLD:
        return False  # Normal, tidak perlu flag

    db = SessionLocal()
    try:
        # Cek apakah sudah ada flag aktif (belum resolved) untuk ticker ini
        existing = db.query(CorporateActionFlag).filter(
            CorporateActionFlag.ticker == ticker,
            CorporateActionFlag.is_resolved == False
        ).first()

        if existing:
            logger.info(f"[CorporateAction] {ticker} sudah dalam status flagged, skip duplikasi.")
            return True  # Tetap skip pipeline

        # Buat flag baru
        flag = CorporateActionFlag(
            ticker=ticker,
            prev_close=prev_close,
            curr_close=curr_close,
            change_pct=round(change_pct * 100, 2),
        )
        db.add(flag)
        db.commit()

        direction = "naik" if change_pct > 0 else "turun"
        logger.warning(
            f"[CorporateAction] ⚠️  FLAG: {ticker} harga {direction} "
            f"{abs(change_pct)*100:.1f}% dalam sehari "
            f"(Rp {prev_close:,.0f} → Rp {curr_close:,.0f}). "
            f"Pipeline ML di-SUSPEND untuk ticker ini. Admin harus validasi."
        )
        return True

    except Exception as e:
        db.rollback()
        logger.error(f"[CorporateAction] Gagal membuat flag untuk {ticker}: {e}")
        return False
    finally:
        db.close()


def is_flagged(ticker: str) -> bool:
    """
    Cek apakah ticker sedang dalam status flagged (belum divalidasi admin).
    Dipanggil oleh pipeline sebelum memproses data saham.
    """
    db = SessionLocal()
    try:
        flag = db.query(CorporateActionFlag).filter(
            CorporateActionFlag.ticker == ticker,
            CorporateActionFlag.is_resolved == False
        ).first()
        return flag is not None
    finally:
        db.close()


def resolve_flag(flag_id: int, action_type: str, split_ratio: float | None, admin_notes: str, db: Session) -> dict:
    """
    Admin memvalidasi flag corporate action.

    Jika action_type == "stock_split" dan split_ratio diberikan,
    fungsi ini otomatis menyesuaikan qty di tabel portfolios.

    Args:
        flag_id: ID flag yang akan di-resolve
        action_type: "stock_split" | "reverse_split" | "normal_drop" | "normal_surge" | "other"
        split_ratio: rasio split (misal 5.0 untuk 1:5). None jika bukan split.
        admin_notes: catatan admin
        db: SQLAlchemy session

    Returns:
        dict dengan detail hasil resolusi
    """
    flag = db.query(CorporateActionFlag).filter(CorporateActionFlag.id == flag_id).first()
    if not flag:
        return {"success": False, "message": f"Flag ID {flag_id} tidak ditemukan."}

    if flag.is_resolved:
        return {"success": False, "message": "Flag ini sudah pernah di-resolve."}

    portfolios_adjusted = 0

    # Jika stock split, sesuaikan qty di semua portofolio yang memegang saham ini
    if action_type == "stock_split" and split_ratio and split_ratio > 1:
        portfolios = db.query(Portfolio).filter(Portfolio.ticker == flag.ticker).all()
        for p in portfolios:
            old_qty = p.qty
            old_avg = p.avg_price
            p.qty = int(p.qty * split_ratio)
            p.avg_price = p.avg_price / split_ratio  # harga per lembar turun proporsional
            logger.info(
                f"[CorporateAction] Portfolio user_id={p.user_id} {flag.ticker}: "
                f"qty {old_qty} → {p.qty}, avg_price Rp {old_avg:,.0f} → Rp {p.avg_price:,.0f}"
            )
            portfolios_adjusted += 1

    elif action_type == "reverse_split" and split_ratio and split_ratio > 1:
        portfolios = db.query(Portfolio).filter(Portfolio.ticker == flag.ticker).all()
        for p in portfolios:
            old_qty = p.qty
            p.qty = max(1, int(p.qty / split_ratio))
            p.avg_price = p.avg_price * split_ratio
            logger.info(
                f"[CorporateAction] Reverse split {flag.ticker}: "
                f"qty {old_qty} → {p.qty}"
            )
            portfolios_adjusted += 1

    # Tandai flag sebagai resolved
    flag.is_resolved = True
    flag.action_type = action_type
    flag.split_ratio = split_ratio
    flag.admin_notes = admin_notes
    flag.resolved_at = datetime.now(tz=timezone.utc)

    db.commit()

    logger.info(
        f"[CorporateAction] ✅ Flag {flag_id} ({flag.ticker}) resolved: "
        f"type={action_type}, portfolios_adjusted={portfolios_adjusted}"
    )

    return {
        "success": True,
        "ticker": flag.ticker,
        "action_type": action_type,
        "split_ratio": split_ratio,
        "portfolios_adjusted": portfolios_adjusted,
        "message": f"Flag berhasil di-resolve. {portfolios_adjusted} portofolio disesuaikan."
    }


def get_pending_flags(db: Session) -> list:
    """Ambil semua flag yang belum divalidasi admin."""
    flags = db.query(CorporateActionFlag).filter(
        CorporateActionFlag.is_resolved == False
    ).order_by(CorporateActionFlag.detected_at.desc()).all()

    return [
        {
            "id": f.id,
            "ticker": f.ticker,
            "prev_close": f.prev_close,
            "curr_close": f.curr_close,
            "change_pct": f.change_pct,
            "detected_at": str(f.detected_at),
            "direction": "naik" if (f.change_pct or 0) > 0 else "turun",
        }
        for f in flags
    ]
