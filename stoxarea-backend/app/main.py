from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.database import engine, Base
from app.api import auth, recommendation, market, portfolio

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Ganti dengan URL Next.js di production (misal: "http://localhost:3000")
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrasi Router
app.include_router(auth.router)
app.include_router(recommendation.router)
app.include_router(market.router)
app.include_router(portfolio.router)

@app.on_event("startup")
def on_startup():
    logger.info("Membangun tabel database (jika belum ada)...")
    # Penting: Pastikan app/models/__init__.py sudah mengimport semua model
    Base.metadata.create_all(bind=engine)
    logger.info("StoxArea Backend siap melayani request!")

@app.get("/")
def read_root():
    return {
        "message": "Welcome to StoxArea API",
        "docs": "Akses /docs untuk melihat dokumentasi interaktif Swagger UI."
    }
