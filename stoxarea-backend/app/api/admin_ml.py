from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Body
from pydantic import BaseModel
from typing import Optional
from ml.pipeline.scheduler import run_daily_pipeline
from app.services.spk3_saw import invalidate_saw_cache, get_cache_status
from app.services.corporate_action_guard import get_pending_flags, resolve_flag
from app.core.security import get_current_user_email
from app.core.database import get_db
from app.models.user import User
from sqlalchemy.orm import Session
import logging
import threading

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/ml",
    tags=["Admin - Machine Learning"]
)

PIPELINE_RUNNING = False
pipeline_lock = threading.Lock()


class ResolveActionRequest(BaseModel):
    action_type: str          # "stock_split" | "reverse_split" | "normal_drop" | "normal_surge" | "other"
    split_ratio: Optional[float] = None
    admin_notes: Optional[str] = ""


def _get_admin_user(
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency: memastikan request berasal dari user yang sudah login.
    Semua endpoint admin wajib pakai dependency ini.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _background_pipeline_runner():
    global PIPELINE_RUNNING
    try:
        run_daily_pipeline()
    finally:
        with pipeline_lock:
            PIPELINE_RUNNING = False

@router.post("/trigger-pipeline")
def trigger_pipeline_manually(
    background_tasks: BackgroundTasks,
    _: User = Depends(_get_admin_user)   # ← wajib login
):
    """
    Endpoint khusus admin untuk memicu pipeline ML Harian secara manual.
    Berguna jika scheduler cron gagal berjalan, atau untuk testing.
    Proses berjalan di background.
    """
    global PIPELINE_RUNNING
    
    with pipeline_lock:
        if PIPELINE_RUNNING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Pipeline sedang berjalan di background. Harap tunggu hingga selesai."
            )
        PIPELINE_RUNNING = True

    logger.info("Menerima request manual untuk trigger ML Pipeline...")
    background_tasks.add_task(_background_pipeline_runner)
    
    return {"message": "Pipeline ML berhasil di-trigger dan sedang berjalan di background."}


@router.post("/invalidate-cache")
def invalidate_cache_manually(
    _: User = Depends(_get_admin_user)   # ← wajib login
):
    """
    Menghapus seluruh cache SAW secara manual.
    Berguna saat data fundamental diupdate di luar jadwal pipeline,
    atau saat debugging rekomendasi yang terasa stale (tidak update).
    """
    count = invalidate_saw_cache()
    return {
        "message": "SAW Cache berhasil dihapus.",
        "entries_cleared": count
    }


@router.get("/cache-status")
def check_cache_status(
    _: User = Depends(_get_admin_user)
):
    """
    Melihat status cache SAW saat ini.
    Menampilkan semua cache entry yang aktif beserta sisa TTL-nya.
    """
    return get_cache_status()


# ── Corporate Action Endpoints ────────────────────────────────────────────────

@router.get("/corporate-actions")
def list_corporate_action_flags(
    _: User = Depends(_get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Menampilkan semua saham yang sedang dalam status corporate action review.
    Pipeline ML di-suspend untuk saham-saham ini sampai admin memvalidasi.
    """
    flags = get_pending_flags(db)
    return {
        "total_pending": len(flags),
        "flags": flags,
        "note": "Saham-saham ini di-skip oleh pipeline ML sampai admin resolve."
    }


@router.post("/corporate-actions/{flag_id}/resolve")
def resolve_corporate_action(
    flag_id: int,
    body: ResolveActionRequest,
    _: User = Depends(_get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Admin memvalidasi flag corporate action.

    action_type options:
    - "stock_split"    → harga turun karena split, qty portofolio dikalikan split_ratio
    - "reverse_split"  → harga naik karena reverse split, qty dibagi split_ratio
    - "normal_drop"    → penurunan harga normal (bukan corporate action), pipeline bisa lanjut
    - "normal_surge"   → kenaikan harga normal, pipeline bisa lanjut
    - "other"          → lainnya, pipeline bisa lanjut setelah admin catat

    Jika stock_split dengan split_ratio=5.0, semua portofolio yang memegang
    saham ini akan otomatis qty × 5 dan avg_price ÷ 5.
    """
    valid_types = {"stock_split", "reverse_split", "normal_drop", "normal_surge", "other"}
    if body.action_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"action_type tidak valid. Pilihan: {valid_types}"
        )

    if body.action_type in {"stock_split", "reverse_split"} and not body.split_ratio:
        raise HTTPException(
            status_code=400,
            detail="split_ratio wajib diisi untuk action_type stock_split atau reverse_split."
        )

    result = resolve_flag(
        flag_id=flag_id,
        action_type=body.action_type,
        split_ratio=body.split_ratio,
        admin_notes=body.admin_notes or "",
        db=db
    )

    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])

    return result
