from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Mengambil DATABASE_URL dari config.py (yang sudah kita atur prioritasnya)
DATABASE_URL = settings.DATABASE_URL

# Pengaturan Engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite butuh check_same_thread=False untuk FastAPI
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Untuk PostgreSQL (Cloud)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency untuk mendapatkan session database
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
