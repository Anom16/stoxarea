import logging
import traceback
from datetime import datetime, date

# Impor semua modul dalam urutan pipeline
from ml.pipeline import ingestor
from ml.features import feature_engineering
from ml.inference import shap_explainer
from ml.pipeline import sync_db
from ml.pipeline.outlier_guard import compute_and_save_capping_bounds
from intelligence_store.ai_scores import ai_store
from intelligence_store.capping_bounds import bounds_store
from app.services.spk3_saw import invalidate_saw_cache

logger = logging.getLogger(__name__)

# FIX #8: Daftar hari libur bursa BEI.
# Perlu diupdate setiap tahun sesuai pengumuman resmi BEI.
# Format: set of date objects untuk lookup O(1).
BEI_HOLIDAYS_2025: set[date] = {
    date(2025, 1, 1),   # Tahun Baru Masehi
    date(2025, 1, 27),  # Isra Mi'raj
    date(2025, 1, 28),  # Cuti Bersama Isra Mi'raj
    date(2025, 1, 29),  # Tahun Baru Imlek
    date(2025, 3, 28),  # Hari Suci Nyepi
    date(2025, 3, 31),  # Cuti Bersama Nyepi
    date(2025, 4, 18),  # Wafat Isa Al-Masih
    date(2025, 5, 1),   # Hari Buruh Internasional
    date(2025, 5, 12),  # Hari Raya Waisak
    date(2025, 5, 29),  # Kenaikan Isa Al-Masih
    date(2025, 6, 1),   # Hari Lahir Pancasila
    date(2025, 8, 17),  # HUT Kemerdekaan RI
    date(2025, 9, 5),   # Maulid Nabi Muhammad SAW
    date(2025, 12, 25), # Hari Raya Natal
    date(2025, 12, 26), # Cuti Bersama Natal
    # Lebaran 2025 (estimasi, sesuaikan dengan pengumuman resmi)
    date(2025, 3, 28),
    date(2025, 3, 29),
    date(2025, 3, 30),
    date(2025, 4, 1),
    date(2025, 4, 2),
    date(2025, 4, 3),
    date(2025, 4, 4),
    date(2025, 4, 7),
}

BEI_HOLIDAYS_2026: set[date] = {
    date(2026, 1, 1),   # Tahun Baru Masehi
    # Tambahkan sesuai pengumuman resmi BEI 2026
}

# Gabungkan semua tahun
BEI_HOLIDAYS: set[date] = BEI_HOLIDAYS_2025 | BEI_HOLIDAYS_2026


def is_bei_trading_day(check_date: date | None = None) -> bool:
    """
    Memeriksa apakah tanggal yang diberikan adalah hari bursa BEI aktif.
    Mengembalikan False jika hari Sabtu, Minggu, atau hari libur BEI.
    """
    if check_date is None:
        check_date = date.today()

    # Sabtu = 5, Minggu = 6
    if check_date.weekday() >= 5:
        return False

    if check_date in BEI_HOLIDAYS:
        return False

    return True

def run_daily_pipeline():
    """
    Fungsi utama (Orkestrator) untuk menjalankan rutinitas ML harian:
    1. Unduh OHLCV terbaru (Ingestor)
    2. Kalkulasi fitur teknikal (Feature Engineering)
    3. Inferensi XGBoost & kalkulasi SHAP (SHAP Explainer)
    4. Sinkronisasi data fundamental terbaru ke Database (Sync DB)
    5. Hitung batas capping outlier berbasis persentil (Outlier Guard)
    6. Muat ulang memori FastAPI agar UI langsung update (Hot-reload)
    """
    # FIX #8: Cek hari libur bursa sebelum menjalankan pipeline.
    # Jika hari ini bukan hari bursa aktif, skip pipeline untuk menghindari
    # data kosong/basi yang bisa merusak ai_scores.json.
    today = date.today()
    if not is_bei_trading_day(today):
        day_name = today.strftime("%A, %d %B %Y")
        if today.weekday() >= 5:
            reason = "akhir pekan"
        else:
            reason = "hari libur bursa BEI"
        logger.info(f"[Pipeline] Dilewati — {day_name} adalah {reason}. Tidak ada data pasar baru.")
        return

    logger.info("="*50)
    logger.info(f"🚀 MEMULAI PIPELINE HARIAN STOXAREA: {datetime.now()}")
    logger.info("="*50)
    
    try:
        # STEP 1: Ingest Data
        logger.info("\n[STEP 1/6] Mengunduh data pasar terbaru...")
        ingestor.run()
        
        # STEP 2: Feature Engineering
        logger.info("\n[STEP 2/6] Mengkalkulasi indikator teknikal...")
        feature_engineering.run()
        
        # STEP 3: Inference & SHAP
        logger.info("\n[STEP 3/6] Menjalankan inferensi XGBoost & kalkulasi SHAP...")
        shap_explainer.run()
        
        # STEP 4: Database Sync
        # Penting: sync_db harus selesai SEBELUM outlier_guard,
        # karena outlier_guard membaca data ROE/DER/PER dari DB yang baru di-sync.
        logger.info("\n[STEP 4/6] Sinkronisasi fundamental ke Database...")
        sync_db.sync_stocks()
        
        # STEP 5: Hitung Batas Capping Outlier (Task 1.1)
        # Membaca data DB yang sudah fresh dari Step 4,
        # menghitung persentil P5-P95, lalu simpan ke capping_bounds.json
        logger.info("\n[STEP 5/6] Menghitung batas capping outlier berbasis persentil...")
        compute_and_save_capping_bounds()
        
        # STEP 6: Hot-reload semua store di memori
        # Urutan penting: ai_store dulu, baru bounds_store, baru invalidate SAW cache
        logger.info("\n[STEP 6/6] Melakukan hot-reload store ke memori server...")
        ai_store._load_data()
        bounds_store.reload()           # reload bounds baru ke memori SPK 3
        invalidated = invalidate_saw_cache()  # hapus cache SAW lama — paksa hitung ulang
        logger.info(f"[STEP 6/6] SAW Cache dihapus: {invalidated} entries.")
        
        logger.info("="*50)
        logger.info("✅ PIPELINE HARIAN SELESAI DENGAN SUKSES!")
        logger.info("="*50)
        
    except Exception as e:
        logger.error("❌ PIPELINE GAGAL! Terjadi kesalahan kritis.")
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    run_daily_pipeline()
