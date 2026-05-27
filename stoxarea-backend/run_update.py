"""
Script untuk update data OHLCV dan regenerate AI scores
"""
import sys, logging
sys.path.insert(0, '.')

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

logger.info("Step 1: Update OHLCV data...")
from ml.pipeline import ingestor
ingestor.run()

logger.info("Step 2: Feature engineering...")
from ml.features import feature_engineering
feature_engineering.run()

logger.info("Step 3: Inference + SHAP...")
from ml.inference import shap_explainer
shap_explainer.run()

logger.info("Step 4: Hot-reload...")
from intelligence_store.ai_scores import ai_store
ai_store._load_data()

# Cek hasil
import json
from pathlib import Path
import os, datetime

path = Path("data/processed/ai_scores.json")
mtime = datetime.datetime.fromtimestamp(os.path.getmtime(path))
logger.info(f"ai_scores.json updated: {mtime}")

with open(path) as f:
    scores = json.load(f)

vals = [v['ai_score'] for v in scores.values()]
logger.info(f"Total tickers: {len(vals)}")
logger.info(f"Mean score: {sum(vals)/len(vals)*100:.1f}%")
logger.info(f"Score >= 90%: {sum(1 for v in vals if v >= 0.9)}")

# Cek tanggal inferensi terbaru
import pandas as pd
df = pd.read_csv("data/processed/features_targets.csv")
infer = df[df["is_latest"]]
df["Date"] = pd.to_datetime(df["Date"])
infer_date = pd.to_datetime(infer["Date"]).max()
logger.info(f"Inference date: {infer_date.date()}")
