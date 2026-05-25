import logging
import traceback
import threading
import time
from datetime import datetime, date
from pathlib import Path

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

# FIX #10: Threading lock untuk prevent concurrent pipeline execution
# Jika 2+ server jalan APScheduler, hanya 1 yang boleh run pipeline bersamaan
_PIPELINE_LOCK = threading.Lock()
_PIPELINE_LOCK_FILE = Path("logs/pipeline.lock")

# FIX #8: Daftar hari libur bursa BEI.
# Perlu diupdate setiap tahun sesuai pengumuman resmi BEI.
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
}

BEI_HOLIDAYS: set[date] = BEI_HOLIDAYS_2025 | BEI_HOLIDAYS_2026


def is_bei_trading_day(check_date: date | None = None) -> bool:
    """Memeriksa apakah tanggal adalah hari bursa BEI aktif"""
    if check_date is None:
        check_date = date.today()

    if check_date.weekday() >= 5:
        return False

    if check_date in BEI_HOLIDAYS:
        return False

    return True


def run_daily_pipeline():
    """
    Pipeline ML harian dengan FIX #10 (race condition prevention) dan error recovery
    
    6-step process dengan proper error handling:
    1. Unduh OHLCV terbaru
    2. Kalkulasi fitur teknikal
    3. XGBoost inference + SHAP
    4. Sinkronisasi DB
    5. Hitung outlier bounds
    6. Hot-reload memory
    """
    
    # FIX #8: Skip jika bukan hari bursa
    today = date.today()
    if not is_bei_trading_day(today):
        day_name = today.strftime("%A, %d %B %Y")
        reason = "akhir pekan" if today.weekday() >= 5 else "hari libur bursa BEI"
        logger.info(f"[Pipeline] Dilewati — {day_name} adalah {reason}.")
        return

    # FIX #10: Acquire lock (prevent concurrent execution)
    acquired = _PIPELINE_LOCK.acquire(blocking=False)
    if not acquired:
        logger.warning("[Pipeline] Sudah ada pipeline yang berjalan. Skipping execution ini.")
        return
    
    pipeline_start_time = time.time()
    
    try:
        logger.info("="*70)
        logger.info(f"🚀 MEMULAI PIPELINE HARIAN STOXAREA: {datetime.now().isoformat()}")
        logger.info("="*70)
        
        step_results = {}
        
        # ============ STEP 1: Ingest Data ============
        try:
            logger.info("\n[STEP 1/6] Mengunduh data pasar terbaru...")
            step_start = time.time()
            ingestor.run()
            step_results['ingestor'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 1/6] ✅ SUKSES ({step_results['ingestor']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 1/6] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['ingestor'] = {'success': False, 'error': str(e)}
            # Continue ke step berikutnya (tolerant terhadap error)
        
        # ============ STEP 2: Feature Engineering ============
        try:
            logger.info("\n[STEP 2/6] Mengkalkulasi indikator teknikal...")
            step_start = time.time()
            feature_engineering.run()
            step_results['feature_engineering'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 2/6] ✅ SUKSES ({step_results['feature_engineering']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 2/6] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['feature_engineering'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 3: Inference & SHAP ============
        try:
            logger.info("\n[STEP 3/6] Menjalankan inferensi XGBoost & kalkulasi SHAP...")
            step_start = time.time()
            shap_explainer.run()
            step_results['inference'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 3/6] ✅ SUKSES ({step_results['inference']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 3/6] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['inference'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 4: Database Sync ============
        try:
            logger.info("\n[STEP 4/6] Sinkronisasi fundamental ke Database...")
            step_start = time.time()
            sync_db.sync_stocks()
            step_results['sync_db'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 4/6] ✅ SUKSES ({step_results['sync_db']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 4/6] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['sync_db'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 5: Outlier Bounds ============
        try:
            logger.info("\n[STEP 5/6] Menghitung batas capping outlier berbasis persentil...")
            step_start = time.time()
            compute_and_save_capping_bounds()
            step_results['outlier_guard'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 5/6] ✅ SUKSES ({step_results['outlier_guard']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 5/6] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['outlier_guard'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 6: Hot-reload ============
        try:
            logger.info("\n[STEP 6/6] Melakukan hot-reload store ke memori server...")
            step_start = time.time()
            ai_store._load_data()
            bounds_store.reload()
            invalidated = invalidate_saw_cache()
            step_results['hot_reload'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 6/6] ✅ SUKSES ({step_results['hot_reload']['duration']:.1f}s) - SAW Cache invalidated: {invalidated} entries")
        except Exception as e:
            logger.error(f"[STEP 6/6] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['hot_reload'] = {'success': False, 'error': str(e)}
        
        # ============ SUMMARY ============
        total_duration = time.time() - pipeline_start_time
        success_count = sum(1 for r in step_results.values() if r.get('success'))
        
        logger.info("="*70)
        logger.info(f"📊 RINGKASAN PIPELINE")
        logger.info(f"   Total waktu: {total_duration:.1f}s")
        logger.info(f"   Step berhasil: {success_count}/{len(step_results)}")
        for step_name, result in step_results.items():
            status = "✅" if result['success'] else "❌"
            logger.info(f"   {status} {step_name}: {result.get('duration', 0):.1f}s" if result['success'] else f"   {status} {step_name}: {result.get('error', 'Unknown error')}")
        
        if success_count == len(step_results):
            logger.info("✅ PIPELINE HARIAN SELESAI DENGAN SUKSES!")
        else:
            logger.warning(f"⚠️  PIPELINE SELESAI DENGAN PARTIAL SUCCESS ({success_count}/{len(step_results)} steps)")
        logger.info("="*70)
        
    except Exception as e:
        logger.error("❌ PIPELINE GAGAL! Terjadi kesalahan kritis yang tidak terduga.")
        logger.error(traceback.format_exc())
    finally:
        # Release lock
        _PIPELINE_LOCK.release()
        logger.info(f"[Pipeline] Lock dirilis. Siap untuk eksekusi berikutnya.")


if __name__ == "__main__":
    run_daily_pipeline()

