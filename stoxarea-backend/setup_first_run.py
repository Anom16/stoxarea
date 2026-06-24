"""
setup_first_run.py
------------------
Jalankan script ini SEKALI setelah clone repo untuk pertama kali.

Langkah:
  1. Buat folder yang diperlukan
  2. Inisialisasi database
  3. Download data OHLCV (butuh koneksi internet)
  4. Feature engineering
  5. Train model XGBoost
  6. Generate AI Scores
  7. Sync database

Cara pakai:
  cd stoxarea-backend
  python setup_first_run.py

Estimasi waktu: 15-30 menit (tergantung kecepatan internet)
"""

import sys
import os
import time
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

def main():
    logger.info("=" * 60)
    logger.info("🚀 STOXAREA — Setup First Run")
    logger.info("=" * 60)

    # ── Step 1: Buat folder yang diperlukan ───────────────────────────────────
    logger.info("\n[1/7] Membuat folder yang diperlukan...")
    folders = [
        "data/raw/ohlcv",
        "data/processed",
        "data/clusters",
        "data/clusters/plots",
        "models",
        "logs",
        "reports",
        "cache/yf_tz",
    ]
    for folder in folders:
        os.makedirs(folder, exist_ok=True)
    logger.info("  ✅ Folder siap")

    # ── Step 2: Cek .env ──────────────────────────────────────────────────────
    logger.info("\n[2/7] Mengecek file .env...")
    if not os.path.exists(".env"):
        if os.path.exists(".env.example"):
            import shutil
            shutil.copy(".env.example", ".env")
            logger.warning("  ⚠️  .env dibuat dari .env.example")
            logger.warning("  ⚠️  PENTING: Edit .env dan isi DATABASE_URL dan SECRET_KEY sebelum lanjut!")
            input("  Tekan ENTER setelah mengedit .env untuk melanjutkan...")
        else:
            logger.error("  ❌ File .env tidak ditemukan! Buat .env terlebih dahulu.")
            sys.exit(1)
    else:
        logger.info("  ✅ .env ditemukan")

    # ── Step 3: Inisialisasi Database ─────────────────────────────────────────
    logger.info("\n[3/7] Menginisialisasi database...")
    try:
        from app.core.database import engine, Base
        from app.models import user, stock, portfolio, transaction, financials, corporate_action
        Base.metadata.create_all(bind=engine)
        logger.info("  ✅ Tabel database berhasil dibuat")
    except Exception as e:
        logger.error(f"  ❌ Gagal init database: {e}")
        logger.error("  Pastikan DATABASE_URL di .env sudah benar!")
        sys.exit(1)

    # ── Step 4: Download OHLCV Data ───────────────────────────────────────────
    logger.info("\n[4/7] Mengunduh data OHLCV dari Yahoo Finance...")
    logger.info("  ⏳ Proses ini memakan waktu 5-15 menit...")
    try:
        from ml.pipeline import ingestor
        ingestor.run()
        logger.info("  ✅ Data OHLCV berhasil diunduh")
    except Exception as e:
        logger.error(f"  ❌ Gagal download OHLCV: {e}")
        logger.warning("  Melanjutkan ke step berikutnya...")

    # ── Step 5: Feature Engineering ───────────────────────────────────────────
    logger.info("\n[5/7] Feature Engineering...")
    try:
        from ml.features import feature_engineering
        feature_engineering.run()
        logger.info("  ✅ Feature engineering selesai")
    except Exception as e:
        logger.error(f"  ❌ Gagal feature engineering: {e}")
        sys.exit(1)

    # ── Step 6: Train XGBoost ─────────────────────────────────────────────────
    logger.info("\n[6/7] Melatih model XGBoost...")
    logger.info("  ⏳ Proses ini memakan waktu 3-10 menit...")
    try:
        from ml.training import train_xgboost
        train_xgboost.run()
        logger.info("  ✅ Model XGBoost berhasil dilatih")
    except Exception as e:
        logger.error(f"  ❌ Gagal training: {e}")
        sys.exit(1)

    # ── Step 7: Generate AI Scores + Sync DB ──────────────────────────────────
    logger.info("\n[7/7] Generate AI Score & Sync Database...")
    try:
        from ml.inference import shap_explainer
        shap_explainer.run()

        from ml.pipeline import sync_db
        sync_db.sync_stocks()

        from ml.pipeline.outlier_guard import compute_and_save_capping_bounds
        compute_and_save_capping_bounds()

        logger.info("  ✅ AI Score & Database berhasil disinkronisasi")
    except Exception as e:
        logger.error(f"  ❌ Error: {e}")

    # ── Selesai ───────────────────────────────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info("🎉 SETUP SELESAI!")
    logger.info("=" * 60)
    logger.info("\nCara menjalankan server:")
    logger.info("  uvicorn app.main:app --reload --port 8000")
    logger.info("\nCara menjalankan frontend:")
    logger.info("  cd ../stoxarea-frontend && npm install && npm run dev")
    logger.info("\nAkses aplikasi:")
    logger.info("  Frontend : http://localhost:3000")
    logger.info("  Backend  : http://localhost:8000")
    logger.info("  API Docs : http://localhost:8000/docs")


if __name__ == "__main__":
    main()
