from fastapi import FastAPI  # Reloaded all 485 qualified stocks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
from pathlib import Path

from app.core.database import engine, Base
from app.core.config import settings
from app.api import auth, recommendation, market, portfolio, admin_ml, admin_users, admin_risk_profiles, admin_indicators, admin_questions, admin_analytics
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
app.include_router(admin_questions.router)
app.include_router(admin_analytics.router)

# Static files untuk reports (plot evaluasi model)
reports_dir = Path("reports")
reports_dir.mkdir(exist_ok=True)
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

def seed_database_if_empty(db):
    from app.models.indicator import Indicator, ProfileIndicatorWeight
    from app.models.risk_profile import RiskProfile
    from app.core.seeding import seed_questionnaire

    # 0. Seed Onboarding Questionnaire
    seed_questionnaire(db)

    # 1. Seed Indicators
    try:
        existing_indicators = {ind.id for ind in db.query(Indicator).all()}
        default_indicators = [
            Indicator(id='ai_score', name='AI Momentum Score', type='benefit', description='Skor probabilitas momentum kenaikan harga dari model AI XGBoost'),
            Indicator(id='roe', name='ROE (Return on Equity)', type='benefit', description='Tingkat pengembalian ekuitas untuk mengukur efisiensi laba emiten'),
            Indicator(id='der', name='DER (Debt to Equity Ratio)', type='cost', description='Rasio hutang terhadap ekuitas untuk menilai solvabilitas emiten'),
            Indicator(id='pbv', name='PBV (Price to Book Value)', type='cost', description='Rasio harga saham terhadap nilai buku untuk mengukur valuasi emiten'),
            Indicator(id='per', name='PER (Price to Earnings Ratio)', type='cost', description='Rasio harga saham terhadap laba bersih per lembar (valuasi laba emiten)')
        ]
        for ind in default_indicators:
            if ind.id not in existing_indicators:
                db.add(ind)
        db.commit()
    except Exception as ex:
        logger.error(f"[Seed] Failed seeding indicators: {ex}")
        db.rollback()

    # 2. Seed Risk Profiles
    try:
        if db.query(RiskProfile).count() == 0:
            logger.info("[Seed] Seeding default risk profiles...")
            profiles = [
                RiskProfile(
                    id='konservatif',
                    name='Konservatif',
                    description='Fokus pada keamanan modal dengan emiten berfundamental kuat.',
                    min_score_threshold=0,
                    max_score_threshold=11
                ),
                RiskProfile(
                    id='moderat',
                    name='Moderat',
                    description='Menyeimbangkan pertumbuhan momentum AI dengan stabilitas fundamental.',
                    min_score_threshold=12,
                    max_score_threshold=18
                ),
                RiskProfile(
                    id='agresif',
                    name='Agresif',
                    description='Memaksimalkan pengembalian dengan memanfaatkan rekomendasi kecerdasan AI.',
                    min_score_threshold=19,
                    max_score_threshold=25
                )
            ]
            for p in profiles:
                db.add(p)
            db.commit()
    except Exception as ex:
        logger.error(f"[Seed] Failed seeding risk profiles: {ex}")
        db.rollback()

    # 3. Seed Profile Indicator Weights
    try:
        db.query(ProfileIndicatorWeight).delete()
        db.commit()

        default_weights = [
            # Konservatif (Total = 1.0)
            ProfileIndicatorWeight(profile_id='konservatif', indicator_id='sortino', weight=0.30),
            ProfileIndicatorWeight(profile_id='konservatif', indicator_id='roe', weight=0.15),
            ProfileIndicatorWeight(profile_id='konservatif', indicator_id='der', weight=0.15),
            ProfileIndicatorWeight(profile_id='konservatif', indicator_id='pbv', weight=0.15),
            ProfileIndicatorWeight(profile_id='konservatif', indicator_id='per', weight=0.15),
            ProfileIndicatorWeight(profile_id='konservatif', indicator_id='ai_score', weight=0.10),
            
            # Moderat (Total = 1.0)
            ProfileIndicatorWeight(profile_id='moderat', indicator_id='ai_score', weight=0.25),
            ProfileIndicatorWeight(profile_id='moderat', indicator_id='sortino', weight=0.20),
            ProfileIndicatorWeight(profile_id='moderat', indicator_id='roe', weight=0.20),
            ProfileIndicatorWeight(profile_id='moderat', indicator_id='der', weight=0.15),
            ProfileIndicatorWeight(profile_id='moderat', indicator_id='pbv', weight=0.10),
            ProfileIndicatorWeight(profile_id='moderat', indicator_id='per', weight=0.10),
            
            # Agresif (Total = 1.0)
            ProfileIndicatorWeight(profile_id='agresif', indicator_id='ai_score', weight=0.45),
            ProfileIndicatorWeight(profile_id='agresif', indicator_id='roe', weight=0.20),
            ProfileIndicatorWeight(profile_id='agresif', indicator_id='sortino', weight=0.10),
            ProfileIndicatorWeight(profile_id='agresif', indicator_id='der', weight=0.10),
            ProfileIndicatorWeight(profile_id='agresif', indicator_id='pbv', weight=0.075),
            ProfileIndicatorWeight(profile_id='agresif', indicator_id='per', weight=0.075)
        ]
        for w in default_weights:
            db.add(w)
        db.commit()
        from app.services.spk3_saw import invalidate_saw_cache
        invalidate_saw_cache()
    except Exception as ex:
        logger.error(f"[Seed] Failed seeding indicator weights: {ex}")
        db.rollback()

    # 4. Seed Default Test Users if explicitly enabled via ENV (Prevent default insecure admin in production)
    try:
        import os
        from app.models.user import User, RiskProfileEnum
        from app.core.security import get_password_hash
        
        seed_enabled = os.getenv("SEED_DEFAULT_USERS", "false").lower() == "true"
        if seed_enabled and db.query(User).count() == 0:
            admin_email = os.getenv("ADMIN_EMAIL", "admin@stoxarea.local")
            admin_pass = os.getenv("ADMIN_PASSWORD")
            
            if not admin_pass:
                logger.warning("[Seed] SEED_DEFAULT_USERS diset true tetapi ADMIN_PASSWORD tidak diatur. Mengabaikan seeding user bawaan demi keamanan.")
            else:
                logger.info(f"[Seed] Seeding admin user ({admin_email})...")
                admin_user = User(
                    email=admin_email,
                    password_hash=get_password_hash(admin_pass),
                    risk_profile=RiskProfileEnum.agresif,
                    is_admin=True,
                    full_name="Admin StoxArea"
                )
                db.add(admin_user)
                db.commit()
    except Exception as ex:
        logger.error(f"[Seed] Failed seeding default users: {ex}")
        db.rollback()

    # 5. Pastikan semua user dengan email admin (misal admin@gmail.com) berstatus is_admin = True
    try:
        from app.models.user import User
        admin_list = db.query(User).filter(User.email.ilike("%admin%")).all()
        for au in admin_list:
            if not au.is_admin:
                au.is_admin = True
        db.commit()
    except Exception:
        db.rollback()


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
            
            # Seeding data bawaan jika kosong
            from app.core.database import SessionLocal as _SessionLocal
            db_session = _SessionLocal()
            try:
                seed_database_if_empty(db_session)
            finally:
                db_session.close()
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
    
    # Menjalankan Scheduler ML Pipeline (Hanya jika RUN_SCHEDULER=true)
    import os
    run_scheduler_flag = os.getenv("RUN_SCHEDULER", "true").lower() == "true"
    if run_scheduler_flag:
        logger.info("Memulai Background Scheduler untuk ML Pipeline (Berjalan tiap hari kerja jam 17:00)...")
        scheduler = BackgroundScheduler()
        # Harian: Senin-Jumat jam 17:00 — ingest + inference (cepat)
        scheduler.add_job(run_daily_pipeline, 'cron', day_of_week='mon-fri', hour=17, minute=0)
        # Mingguan: Jumat jam 18:00 — full retrain XGBoost (lebih lama)
        scheduler.add_job(run_weekly_retrain, 'cron', day_of_week='fri', hour=18, minute=0)
        scheduler.start()
        logger.info("Scheduler aktif: Harian (Sen-Jum 17:00) + Mingguan Retrain (Jum 18:00)")
    else:
        logger.info("Background Scheduler dinonaktifkan (RUN_SCHEDULER=false) — berguna untuk multi-worker node.")

    # ── Auto-run pipeline hanya jika file ai_scores.json tidak ada ────────────
    import threading
    from pathlib import Path

    ai_scores_path = Path("data/processed/ai_scores.json")
    if not ai_scores_path.exists():
        logger.warning("[Startup] ai_scores.json belum ada. Menjalankan pipeline pertama kali...")
        threading.Thread(target=run_daily_pipeline, daemon=True).start()
    else:
        logger.info("[Startup] Data AI Score siap. Server berjalan tanpa locking SQLite.")

    # ── Pre-warm memory cache untuk IHSG & Top Stocks agar demo pameran 0ms ─────
    from app.services.market_data import pre_warm_cache
    threading.Thread(target=pre_warm_cache, daemon=True).start()

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
