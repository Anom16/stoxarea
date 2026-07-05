"""
app/api/admin_users.py
-----------------------
Endpoint admin untuk mengelola user dan melihat daftar saham.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.models.stock import Stock

router = APIRouter(prefix="/admin/users", tags=["Admin - User Management"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserAdminView(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    risk_profile: Optional[str] = None
    virtual_balance: float
    is_admin: bool
    created_at: str

    class Config:
        from_attributes = True


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    risk_profile: Optional[str] = None
    is_admin: Optional[bool] = None
    virtual_balance: Optional[float] = None


# ── User Endpoints ────────────────────────────────────────────────────────────

@router.get("/", response_model=List[dict])
def list_all_users(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Daftar semua user terdaftar di sistem."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id":              u.id,
            "email":           u.email,
            "full_name":       u.full_name,
            "risk_profile":    u.risk_profile if u.risk_profile else None,
            "virtual_balance": u.virtual_balance,
            "is_admin":        u.is_admin,
            "created_at":      u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/{user_id}")
def update_user(
    user_id: int,
    body: UpdateUserRequest,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update data user (nama, profil, saldo, status admin)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.risk_profile is not None:
        user.risk_profile = body.risk_profile
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.virtual_balance is not None:
        user.virtual_balance = body.virtual_balance

    db.commit()
    return {
        "message": f"User {user.email} berhasil diperbarui.",
        "user": {
            "id":           user.id,
            "email":        user.email,
            "full_name":    user.full_name,
            "risk_profile": user.risk_profile if user.risk_profile else None,
            "is_admin":     user.is_admin,
            "virtual_balance": user.virtual_balance,
        }
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Hapus user dari sistem."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun admin.")

    email = user.email
    db.delete(user)
    db.commit()
    return {"message": f"User {email} berhasil dihapus."}


@router.post("/{user_id}/reset-balance")
def reset_balance(
    user_id: int,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reset saldo virtual trading user ke 100 juta."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    user.virtual_balance = 100_000_000.0
    db.commit()
    return {"message": f"Saldo {user.email} berhasil direset ke Rp 100.000.000"}


# ── Stock Endpoints ───────────────────────────────────────────────────────────

@router.get("/stocks/list")
def list_all_stocks(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Daftar semua saham di database beserta status qualified."""
    stocks = db.query(Stock).order_by(Stock.ticker).all()
    from intelligence_store.ai_scores import ai_store
    all_scores = ai_store.get_all_scores()

    return [
        {
            "ticker":       s.ticker,
            "name":         s.name,
            "sector":       s.sector,
            "is_qualified": s.is_qualified,
            "roe":          s.roe,
            "der":          s.der,
            "pbv":          s.pbv,
            "ai_score":     all_scores.get(s.ticker, {}).get("ai_score"),
            "ai_score_pct": all_scores.get(s.ticker, {}).get("ai_score_percent"),
        }
        for s in stocks
    ]


@router.patch("/stocks/{ticker}/toggle-qualified")
def toggle_stock_qualified(
    ticker: str,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Toggle status is_qualified saham (aktifkan/nonaktifkan dari rekomendasi)."""
    stock = db.query(Stock).filter(Stock.ticker == ticker).first()
    if not stock:
        raise HTTPException(status_code=404, detail=f"Saham {ticker} tidak ditemukan.")

    stock.is_qualified = not stock.is_qualified
    db.commit()
    status = "diaktifkan" if stock.is_qualified else "dinonaktifkan"
    return {
        "message":      f"{ticker} berhasil {status} dari rekomendasi.",
        "ticker":       ticker,
        "is_qualified": stock.is_qualified,
    }
