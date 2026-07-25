from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool, SingletonThreadPool
from app.core.config import settings

# Mengambil DATABASE_URL dari config.py (yang sudah kita atur prioritasnya)
DATABASE_URL = settings.DATABASE_URL

# Pengaturan Engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite butuh check_same_thread=False untuk FastAPI
    # SingletonThreadPool untuk development
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=SingletonThreadPool,
        echo=False  # Set True untuk debug SQL queries
    )
else:
    # Untuk PostgreSQL (Cloud/Production)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Connection pooling untuk production
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,         # Recycle setiap 30 menit (lebih sering)
        pool_pre_ping=True,        # Test koneksi sebelum pakai
        pool_timeout=30,           # Timeout 30 detik
        connect_args={
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency untuk mendapatkan session database
def get_db():
    """
    Dependency injection untuk FastAPI endpoints.
    Auto-close session setelah request selesai.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
