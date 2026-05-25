from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.database import engine, Base
from app.core.config import settings
from app.api import auth, recommendation, market, portfolio, admin_ml
from apscheduler.schedulers.background import BackgroundScheduler
from ml.pipeline.scheduler import run_daily_pipeline

# Rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

# Setup Logger Global
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
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

@app.on_event("startup")
def on_startup():
    logger.info("Membangun tabel database (jika belum ada)...")
    # Penting: Pastikan app/models/__init__.py sudah mengimport semua model
    Base.metadata.create_all(bind=engine)
    
    # Menjalankan Scheduler ML Pipeline
    logger.info("Memulai Background Scheduler untuk ML Pipeline (Berjalan tiap hari kerja jam 17:00)...")
    scheduler = BackgroundScheduler()
    # Cron berjalan hari Senin-Jumat jam 17:00 waktu server
    scheduler.add_job(run_daily_pipeline, 'cron', day_of_week='mon-fri', hour=17, minute=0)
    scheduler.start()
    
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
