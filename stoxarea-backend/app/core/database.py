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
        pool_size=20,              # Max open connections
        max_overflow=40,           # Max waiting in queue
        pool_recycle=3600,         # Recycle connection setiap 1 jam
        pool_pre_ping=True,        # Test connection sebelum pakai (detect stale)
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
