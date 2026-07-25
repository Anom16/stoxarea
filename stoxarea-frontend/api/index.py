import sys
import os
from pathlib import Path

# Ensure environment variables for Supabase
os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres.akytzkebyghoxmvqgnst:miiwaashi16@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
)
os.environ["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY",
    "VLKbq54lKoyfWVHee2KJp1kunBvu9nOETyZA90pLpOA"
)
os.environ["ALLOWED_ORIGINS"] = "*"

# Add stoxarea-backend to python path
current_dir = Path(__file__).resolve().parent
backend_path = current_dir.parent.parent / "stoxarea-backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

try:
    from app.main import app
except Exception as e:
    from fastapi import FastAPI
    app = FastAPI(title="StoxArea API Fallback")
    @app.get("/api/health")
    def health():
        return {"status": "error", "detail": str(e)}
