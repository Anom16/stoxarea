from pydantic_settings import BaseSettings
from pydantic import Field
import os

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./stoxarea.db",
        env="DATABASE_URL",
        description="Database connection URL (PostgreSQL/SQLite)"
    )
    
    # Security - CRITICAL: Must be set in production via .env
    SECRET_KEY: str = Field(
        default="change-me-in-production",
        env="SECRET_KEY",
        description="JWT secret key. Use strong random value in production!"
    )
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # API
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,https://stoxarea.vercel.app,https://stoxarea-frontend.vercel.app,https://stoxarea-*.vercel.app",
        env="ALLOWED_ORIGINS",
        description="Comma-separated CORS allowed origins"
    )
    
    # ML Pipeline Paths
    AI_SCORES_PATH: str = "data/processed/ai_scores.json"
    CAPPING_BOUNDS_PATH: str = "data/processed/capping_bounds.json"
    MODEL_PATH: str = "models/xgb_model.pkl"
    
    # Cloudflare Analytics
    CLOUDFLARE_API_TOKEN: str = Field(default="", env="CLOUDFLARE_API_TOKEN")
    CLOUDFLARE_ZONE_ID: str = Field(default="", env="CLOUDFLARE_ZONE_ID")
    CLOUDFLARE_ACCOUNT_ID: str = Field(default="", env="CLOUDFLARE_ACCOUNT_ID")
    CLOUDFLARE_SITE_TOKEN: str = Field(default="7b9e49aa362c461dae9a0b279e7649b4", env="CLOUDFLARE_SITE_TOKEN")
    
    # Feature: Rate limiting
    RATE_LIMIT_ENABLED: bool = Field(default=True, env="RATE_LIMIT_ENABLED")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"

settings = Settings()
