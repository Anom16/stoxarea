from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, field_validator

from app.core.database import get_db
from app.core.security import require_admin
from app.models.risk_profile import RiskProfile
from app.models.user import User
from app.models.indicator import ProfileIndicatorWeight, StockProfileMapping

router = APIRouter(prefix="/admin/risk-profiles", tags=["Admin - Risk Profile Management"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class RiskProfileBase(BaseModel):
    name: str
    description: Optional[str] = ""
    min_score_threshold: int
    max_score_threshold: int
    weights: dict # { indicator_id: float }

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, w: dict) -> dict:
        for k, val in w.items():
            if val < 0.0 or val > 1.0:
                raise ValueError(f"Bobot kriteria untuk '{k}' harus berada di rentang 0.0 - 1.0.")
        return w

class RiskProfileCreate(RiskProfileBase):
    id: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("ID profil tidak boleh kosong.")
        if not v.replace("_", "").isalnum():
            raise ValueError("ID profil hanya boleh berisi huruf, angka, dan underscore.")
        return v

class RiskProfileUpdate(RiskProfileBase):
    pass

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[dict])
def list_all_risk_profiles(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List semua profil risiko beserta bobot indikatornya."""
    profiles = db.query(RiskProfile).order_by(RiskProfile.id).all()
    
    # Ambil semua bobot dari database
    all_weights = db.query(ProfileIndicatorWeight).all()
    weights_map = {}
    for w in all_weights:
        if w.profile_id not in weights_map:
            weights_map[w.profile_id] = {}
        weights_map[w.profile_id][w.indicator_id] = w.weight

    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "min_score_threshold": p.min_score_threshold,
            "max_score_threshold": p.max_score_threshold,
            "weights": weights_map.get(p.id, {}),
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in profiles
    ]

@router.post("/", response_model=dict)
def create_risk_profile(
    body: RiskProfileCreate,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Membuat profil risiko baru."""
    # Validasi total bobot = 1.0
    total_weight = sum(body.weights.values())
    if abs(total_weight - 1.0) > 1e-4:
        raise HTTPException(
            status_code=400,
            detail=f"Total bobot kriteria harus tepat 1.0 (100%). Total input Anda: {total_weight:.2f}"
        )

    # Cek apakah ID sudah ada
    existing = db.query(RiskProfile).filter(RiskProfile.id == body.id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Profil risiko dengan ID '{body.id}' sudah terdaftar."
        )

    new_profile = RiskProfile(
        id=body.id,
        name=body.name,
        description=body.description,
        min_score_threshold=body.min_score_threshold,
        max_score_threshold=body.max_score_threshold
    )
    db.add(new_profile)

    # Simpan bobot kriteria
    for ind_id, w in body.weights.items():
        db.add(ProfileIndicatorWeight(profile_id=body.id, indicator_id=ind_id, weight=w))

    db.commit()
    db.refresh(new_profile)

    return {
        "message": f"Profil risiko '{new_profile.name}' berhasil dibuat.",
        "profile": {
            "id": new_profile.id,
            "name": new_profile.name,
            "weights": body.weights,
            "min_score_threshold": new_profile.min_score_threshold,
            "max_score_threshold": new_profile.max_score_threshold
        }
    }

@router.put("/{profile_id}", response_model=dict)
def update_risk_profile(
    profile_id: str,
    body: RiskProfileUpdate,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Memperbarui profil risiko yang ada."""
    profile = db.query(RiskProfile).filter(func.lower(RiskProfile.id) == profile_id.lower().strip()).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil risiko tidak ditemukan.")

    # Validasi total bobot = 1.0
    total_weight = sum(body.weights.values())
    if abs(total_weight - 1.0) > 1e-4:
        raise HTTPException(
            status_code=400,
            detail=f"Total bobot kriteria harus tepat 1.0 (100%). Total input Anda: {total_weight:.2f}"
        )

    profile.name = body.name
    profile.description = body.description
    profile.min_score_threshold = body.min_score_threshold
    profile.max_score_threshold = body.max_score_threshold

    # Update bobot kriteria (hapus lama, masukkan baru)
    db.query(ProfileIndicatorWeight).filter(ProfileIndicatorWeight.profile_id == profile_id).delete()
    for ind_id, w in body.weights.items():
        db.add(ProfileIndicatorWeight(profile_id=profile_id, indicator_id=ind_id, weight=w))

    db.commit()
    db.refresh(profile)

    return {
        "message": f"Profil risiko '{profile.name}' berhasil diperbarui.",
        "profile": {
            "id": profile.id,
            "name": profile.name,
            "weights": body.weights,
            "min_score_threshold": profile.min_score_threshold,
            "max_score_threshold": profile.max_score_threshold
        }
    }

@router.delete("/{profile_id}")
def delete_risk_profile(
    profile_id: str,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Menghapus profil risiko kustom."""
    default_ids = {"konservatif", "moderat", "agresif"}
    if profile_id.lower().strip() in default_ids:
        raise HTTPException(
            status_code=400,
            detail="Profil risiko default bawaan sistem tidak boleh dihapus."
        )

    profile = db.query(RiskProfile).filter(func.lower(RiskProfile.id) == profile_id.lower().strip()).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil risiko tidak ditemukan.")

    name = profile.name
    # Alihkan semua pengguna terkait ke 'moderat'
    db.query(User).filter(User.risk_profile == profile_id).update({"risk_profile": "moderat"})

    # Hapus bobot
    db.query(ProfileIndicatorWeight).filter(ProfileIndicatorWeight.profile_id == profile_id).delete()
    # Hapus pemetaan saham
    db.query(StockProfileMapping).filter(StockProfileMapping.profile_id == profile_id).delete()

    db.delete(profile)
    db.commit()

    return {"message": f"Profil risiko '{name}' berhasil dihapus. Semua pengguna terkait dialihkan ke 'moderat'."}

# ── Stock Mappings Endpoints ───────────────────────────────────────────────────

@router.get("/{profile_id}/stocks", response_model=List[str])
def get_profile_stocks(
    profile_id: str,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Mendapatkan daftar ticker saham yang terikat ke profil ini."""
    mappings = db.query(StockProfileMapping).filter(StockProfileMapping.profile_id == profile_id).all()
    return [m.ticker for m in mappings]

@router.post("/{profile_id}/stocks")
def update_profile_stocks(
    profile_id: str,
    tickers: List[str] = Body(..., embed=True),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Membatasi atau memetakan daftar saham tertentu ke profil risiko ini."""
    # Bersihkan pemetaan lama
    db.query(StockProfileMapping).filter(StockProfileMapping.profile_id == profile_id).delete()
    
    # Tambahkan pemetaan baru
    for t in tickers:
        db.add(StockProfileMapping(ticker=t.upper().strip(), profile_id=profile_id))
        
    db.commit()
    return {"message": f"Pemetaan {len(tickers)} saham ke profil '{profile_id}' berhasil diperbarui."}
