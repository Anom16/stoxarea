import sys
import os
from pathlib import Path
from fastapi import FastAPI

# Force Environment Variables for Supabase
os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres.akytzkebyghoxmvqgnst:miiwaashi16@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
)
os.environ["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY",
    "VLKbq54lKoyfWVHee2KJp1kunBvu9nOETyZA90pLpOA"
)
os.environ["ALLOWED_ORIGINS"] = "*"

# Add stoxarea-backend to python sys.path
current_dir = Path(__file__).resolve().parent
backend_path = current_dir.parent.parent / "stoxarea-backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.main import app as backend_app

# Create Master Gateway FastAPI app
app = FastAPI(title="StoxArea Serverless Gateway")

# Mount backend_app under /api so requests to /api/auth/login automatically strip /api and match /auth/login
app.mount("/api", backend_app)
app.mount("/", backend_app)
