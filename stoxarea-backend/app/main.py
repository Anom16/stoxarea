from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.database import engine, Base
from app.api import auth, recommendation, market, portfolio, admin_ml
from apscheduler.schedulers.background import BackgroundScheduler
from ml.pipeline.scheduler import run_daily_pipeline

# Setup Logger Global
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI App
app = FastAPI(
    title="StoxArea Backend API",
    description="Sistem Pendukung Keputusan (SPK) untuk rekomendasi saham berbasis XGBoost dan SAW.",
    version="1.0.0"
)

# CORS Middleware (agar Next.js bisa memanggil API ini)
# CATATAN: allow_origins="*" tidak bisa dikombinasikan dengan allow_credentials=True
# karena browser akan reject request. Pilih salah satu:
#   - Development: pakai list origin spesifik + credentials=True
#   - Production: ganti dengan URL frontend yang sebenarnya
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Next.js dev server
        "http://127.0.0.1:3000",
    ],
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
