from fastapi import FastAPI  # Trigger uvicorn reload to load newly calibrated AI scores
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
from pathlib import Path

from app.core.database import engine, Base
from app.core.config import settings
from app.api import auth, recommendation, market, portfolio, admin_ml, admin_users, admin_risk_profiles, admin_indicators
from apscheduler.schedulers.background import BackgroundScheduler
from ml.pipeline.scheduler import run_daily_pipeline, run_weekly_retrain

# Rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

# Setup Logger Global
import sys
# Force UTF-8 encoding for standard streams to prevent UnicodeEncodeError on Windows when logging emojis
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI App
app = FastAPI(
    title="StoxArea Backend API",
    description="Sistem Pendukung Keputusan (SPK) untuk rekomendasi saham berbasis XGBoost dan SAW.",
    version="1.0.0"
)

# Attach limiter to app
app.state.limiter = limiter

# CORS Middleware - now from environment variables
# Parse comma-separated origins
allowed_origins = settings.ALLOWED_ORIGINS
if isinstance(allowed_origins, str):
    allowed_origins = [o.strip() for o in allowed_origins.split(",")]

logger.info(f"CORS Allowed Origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrasi Router
app.include_router(auth.router)
app.include_router(recommendation.router)
app.include_router(market.router)
app.include_router(portfolio.router)
app.include_router(admin_ml.router)
app.include_router(admin_users.router)
app.include_router(admin_risk_profiles.router)
app.include_router(admin_indicators.router)

# Static files untuk reports (plot evaluasi model)
reports_dir = Path("reports")
reports_dir.mkdir(exist_ok=True)
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

@app.on_event("startup")
def on_startup():
    # Retry database connection and table creation (handles Supabase cold starts/pauses)
    max_retries = 5
    retry_delay = 10
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Membangun tabel database (jika belum ada) - Percobaan {attempt}/{max_retries}...")
            Base.metadata.create_all(bind=engine)
            logger.info("Database berhasil terhubung dan tabel diverifikasi/dibuat.")
            break
        except Exception as e:
            logger.error(f"Koneksi database gagal pada percobaan {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                logger.info(f"Menunggu {retry_delay} detik sebelum mencoba lagi...")
                import time as _time
                _time.sleep(retry_delay)
            else:
                logger.critical("Semua percobaan koneksi database gagal. Aplikasi tidak dapat dijalankan.")
                raise e
    
    # Menjalankan Scheduler ML Pipeline
    logger.info("Memulai Background Scheduler untuk ML Pipeline (Berjalan tiap hari kerja jam 17:00)...")
    scheduler = BackgroundScheduler()
    # Harian: Senin-Jumat jam 17:00 — ingest + inference (cepat)
    scheduler.add_job(run_daily_pipeline, 'cron', day_of_week='mon-fri', hour=17, minute=0)
    # Mingguan: Jumat jam 18:00 — full retrain XGBoost (lebih lama)
    scheduler.add_job(run_weekly_retrain, 'cron', day_of_week='fri', hour=18, minute=0)
    scheduler.start()
    logger.info("Scheduler aktif: Harian (Sen-Jum 17:00) + Mingguan Retrain (Jum 18:00)")

    # ── Auto-run pipeline jika data sudah usang (> 1 hari) ──────────────────
    import threading
    from pathlib import Path
    import time as _time

    ai_scores_path = Path("data/processed/ai_scores.json")
    if ai_scores_path.exists():
        age_hours = (_time.time() - ai_scores_path.stat().st_mtime) / 3600
        if age_hours > 24:
            logger.warning(
                f"[Startup] Data AI Score sudah {age_hours:.1f} jam usang. "
                f"Menjalankan pipeline otomatis di background..."
            )
            threading.Thread(target=run_daily_pipeline, daemon=True).start()
        else:
            logger.info(f"[Startup] Data AI Score masih fresh ({age_hours:.1f} jam yang lalu).")
    else:
        logger.warning("[Startup] ai_scores.json belum ada. Menjalankan pipeline pertama kali...")
        threading.Thread(target=run_daily_pipeline, daemon=True).start()
    
    logger.info("StoxArea Backend siap melayani request!")

@app.get("/")
def read_root():
    return {
        "message": "Welcome to StoxArea API",
        "docs": "Akses /docs untuk melihat dokumentasi interaktif Swagger UI."
    }

@app.get("/health")
def health_check():
    """Health check endpoint untuk monitoring"""
    return {"status": "healthy"}
