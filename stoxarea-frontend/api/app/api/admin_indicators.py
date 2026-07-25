import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, field_validator

from app.core.database import get_db
from app.core.security import require_admin
from app.models.indicator import Indicator, StockIndicatorValue, ProfileIndicatorWeight
from app.models.stock import Stock
from app.models.risk_profile import RiskProfile

router = APIRouter(prefix="/admin/indicators", tags=["Admin - Indicator Management"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class IndicatorBase(BaseModel):
    name: str
    type: str # 'benefit' | 'cost'
    description: Optional[str] = ""

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"benefit", "cost"}:
            raise ValueError("Tipe indikator harus 'benefit' atau 'cost'.")
        return v

class IndicatorCreate(IndicatorBase):
    id: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("ID indikator tidak boleh kosong.")
        if not v.replace("_", "").isalnum():
            raise ValueError("ID indikator hanya boleh berisi huruf, angka, dan underscore.")
        return v

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[dict])
def list_all_indicators(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List semua indikator kriteria SAW."""
    indicators = db.query(Indicator).order_by(Indicator.id).all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "type": i.type,
            "description": i.description,
            "created_at": i.created_at.isoformat() if i.created_at else None
        }
        for i in indicators
    ]

@router.post("/", response_model=dict)
def create_indicator(
    body: IndicatorCreate,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Membuat indikator kriteria SAW baru."""
    # Cek duplikasi ID
    existing = db.query(Indicator).filter(Indicator.id == body.id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Indikator dengan ID '{body.id}' sudah terdaftar."
        )

    new_ind = Indicator(
        id=body.id,
        name=body.name,
        type=body.type,
        description=body.description
    )
    db.add(new_ind)

    # Inisialisasi bobot default 0.0 untuk semua profil risiko yang ada
    profiles = db.query(RiskProfile).all()
    for p in profiles:
        db.add(ProfileIndicatorWeight(profile_id=p.id, indicator_id=body.id, weight=0.0))

    db.commit()
    db.refresh(new_ind)

    return {
        "message": f"Indikator '{new_ind.name}' berhasil dibuat.",
        "indicator": {
            "id": new_ind.id,
            "name": new_ind.name,
            "type": new_ind.type
        }
    }

@router.delete("/{indicator_id}")
def delete_indicator(
    indicator_id: str,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Menghapus indikator kustom."""
    # Proteksi indikator default bawaan
    default_ids = {"ai_score", "roe", "der", "pbv"}
    if indicator_id.lower().strip() in default_ids:
        raise HTTPException(
            status_code=400,
            detail="Indikator default bawaan sistem tidak boleh dihapus."
        )

    indicator = db.query(Indicator).filter(Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indikator tidak ditemukan.")

    name = indicator.name

    # Hapus semua nilai indikator untuk saham
    db.query(StockIndicatorValue).filter(StockIndicatorValue.indicator_id == indicator_id).delete()
    # Hapus bobot profil untuk indikator ini
    db.query(ProfileIndicatorWeight).filter(ProfileIndicatorWeight.indicator_id == indicator_id).delete()

    db.delete(indicator)
    db.commit()

    return {"message": f"Indikator '{name}' berhasil dihapus dari sistem."}

@router.post("/{indicator_id}/upload")
def upload_indicator_values(
    indicator_id: str,
    file: UploadFile = File(...),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Mengunggah berkas CSV berisi data masukan indikator per saham.
    CSV harus memiliki kolom: ticker, value (atau val).
    """
    indicator = db.query(Indicator).filter(Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indikator tidak ditemukan.")

    # Baca isi file
    try:
        contents = file.file.read()
        buffer = io.StringIO(contents.decode('utf-8'))
        reader = csv.reader(buffer)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file CSV: {str(e)}")

    # Baca header
    headers = next(reader, None)
    if not headers:
        raise HTTPException(status_code=400, detail="Berkas CSV kosong.")

    # Tentukan index kolom
    ticker_idx = 0
    val_idx = 1
    
    header_lower = [h.strip().lower() for h in headers]
    if 'ticker' in header_lower:
        ticker_idx = header_lower.index('ticker')
    if 'value' in header_lower:
        val_idx = header_lower.index('value')
    elif 'val' in header_lower:
        val_idx = header_lower.index('val')

    imported = 0
    skipped = 0

    for row in reader:
        if not row or len(row) <= max(ticker_idx, val_idx):
            continue
        
        ticker = row[ticker_idx].upper().strip()
        val_str = row[val_idx].strip()
        
        try:
            val = float(val_str)
        except ValueError:
            skipped += 1
            continue

        # Validasi apakah saham tersebut terdaftar
        stock_exists = db.query(Stock).filter(Stock.ticker == ticker).first()
        if not stock_exists:
            skipped += 1
            continue

        # Simpan atau update nilai indikator saham
        existing = db.query(StockIndicatorValue).filter(
            StockIndicatorValue.ticker == ticker,
            StockIndicatorValue.indicator_id == indicator_id
        ).first()

        if existing:
            existing.value = val
        else:
            db.add(StockIndicatorValue(ticker=ticker, indicator_id=indicator_id, value=val))
        
        imported += 1

    db.commit()

    return {
        "message": f"Sukses memperbarui data untuk indikator '{indicator.name}'.",
        "imported_rows": imported,
        "skipped_rows": skipped
    }
