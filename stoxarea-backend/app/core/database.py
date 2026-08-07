from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool, SingletonThreadPool
from app.core.config import settings

# Mengambil DATABASE_URL dari config.py (yang sudah kita atur prioritasnya)
DATABASE_URL = settings.DATABASE_URL

# Pengaturan Engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite check_same_thread=False & timeout 30 detik untuk cegah 'database is locked'
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
        poolclass=SingletonThreadPool,
        echo=False
    )
    # Event listener untuk mengaktifkan WAL Mode (Write-Ahead Logging) & PRAGMA busy_timeout
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA busy_timeout=30000;")
            cursor.close()
        except Exception:
            pass

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
