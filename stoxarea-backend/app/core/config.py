from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./stoxarea.db"
    SECRET_KEY: str = "ganti-dengan-secret-key-yang-kuat"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Konfigurasi ML Pipeline Paths
    AI_SCORES_PATH: str = "data/processed/ai_scores.json"
    CAPPING_BOUNDS_PATH: str = "data/processed/capping_bounds.json"
    MODEL_PATH: str = "ml/models_saved/xgb_model.pkl"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
