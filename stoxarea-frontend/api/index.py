import sys
import os
from pathlib import Path

# Add current api directory to sys.path so 'app' package is found directly
api_dir = Path(__file__).resolve().parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

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

from app.main import app as backend_app
from fastapi import FastAPI

app = FastAPI(title="StoxArea Serverless Gateway")

# Mount backend_app under /api and /
app.mount("/api", backend_app)
app.mount("/", backend_app)
