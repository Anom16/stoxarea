import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Mengambil DATABASE_URL dari environment variable (untuk Cloud/Supabase)
# Jika tidak ada, gunakan SQLite lokal sebagai cadangan
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./stoxarea.db")

# Pengaturan Engine (PostgreSQL tidak butuh check_same_thread)
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Untuk PostgreSQL (Supabase), kita tidak butuh check_same_thread
    # Kadang Vercel butuh fix untuk string 'postgres://' menjadi 'postgresql://'
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
