from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/stoxarea"
    SECRET_KEY: str = "ganti-dengan-secret-key-yang-kuat"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Konfigurasi ML Pipeline Paths (untuk dibaca oleh intelligence_store)
    AI_SCORES_PATH: str = "data/processed/ai_scores.json"

    class Config:
        env_file = ".env"

settings = Settings()
