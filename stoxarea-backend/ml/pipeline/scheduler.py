import logging
import traceback
import threading
import time
from datetime import datetime, date
from pathlib import Path

# Impor semua modul dalam urutan pipeline
from ml.pipeline import ingestor
from ml.features import feature_engineering
from ml.training import train_xgboost
from ml.inference import shap_explainer
from ml.pipeline import sync_db
from ml.pipeline.outlier_guard import compute_and_save_capping_bounds
from intelligence_store.ai_scores import ai_store
from intelligence_store.capping_bounds import bounds_store
from app.services.spk3_saw import invalidate_saw_cache

logger = logging.getLogger(__name__)

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


def run_daily_pipeline(force: bool = False):
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
    if not force and not is_bei_trading_day(today):
        day_name = today.strftime("%A, %d %B %Y")
        reason = "akhir pekan" if today.weekday() >= 5 else "hari libur bursa BEI"
        logger.info(f"[Pipeline] Dilewati — {day_name} adalah {reason}. (Gunakan parameter force jika ingin memaksakan jalan)")
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
        
        # ============ STEP 3: Training XGBoost ============
        try:
            logger.info("\n[STEP 3/7] Melatih model XGBoost...")
            step_start = time.time()
            train_xgboost.run()
            step_results['train_xgboost'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 3/7] ✅ SUKSES ({step_results['train_xgboost']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 3/7] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['train_xgboost'] = {'success': False, 'error': str(e)}

        # ============ STEP 4: Inference & SHAP ============
        try:
            logger.info("\n[STEP 4/7] Menjalankan inferensi XGBoost & kalkulasi SHAP...")
            step_start = time.time()
            shap_explainer.run()
            step_results['inference'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 4/7] ✅ SUKSES ({step_results['inference']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 4/7] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['inference'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 5: Database Sync ============
        try:
            logger.info("\n[STEP 5/7] Sinkronisasi fundamental ke Database...")
            step_start = time.time()
            sync_db.sync_stocks()
            step_results['sync_db'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 5/7] ✅ SUKSES ({step_results['sync_db']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 5/7] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['sync_db'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 6: Outlier Bounds ============
        try:
            logger.info("\n[STEP 6/7] Menghitung batas capping outlier berbasis persentil...")
            step_start = time.time()
            compute_and_save_capping_bounds()
            step_results['outlier_guard'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 6/7] ✅ SUKSES ({step_results['outlier_guard']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 6/7] ❌ GAGAL: {str(e)}")
            logger.error(traceback.format_exc())
            step_results['outlier_guard'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 7: Hot-reload ============
        try:
            logger.info("\n[STEP 7/7] Melakukan hot-reload store ke memori server...")
            step_start = time.time()
            ai_store._load_data()
            bounds_store.reload()
            invalidated = invalidate_saw_cache()
            step_results['hot_reload'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 7/7] ✅ SUKSES ({step_results['hot_reload']['duration']:.1f}s) - SAW Cache invalidated: {invalidated} entries")
        except Exception as e:
            logger.error(f"[STEP 7/7] ❌ GAGAL: {str(e)}")
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


def run_weekly_retrain():
    """
    Pipeline Mingguan: Full retrain XGBoost dengan data terbaru.

    Dijadwalkan setiap Jumat jam 18:00 (setelah pipeline harian selesai).
    Lebih berat dari pipeline harian karena melakukan:
      1. Ingest data terbaru
      2. Feature engineering
      3. RETRAIN model XGBoost (Walk-Forward Validation 5 fold)
      4. Inference + SHAP dengan model baru
      5. Sync DB + Outlier bounds
      6. Hot-reload

    Kenapa mingguan, bukan harian?
      - Training XGBoost dengan 65.000+ baris memakan waktu ~5-10 menit
      - Pola teknikal tidak berubah drastis dalam 1 hari
      - Mingguan cukup untuk menangkap perubahan regime pasar
    """
    acquired = _PIPELINE_LOCK.acquire(blocking=False)
    if not acquired:
        logger.warning("[Weekly] Pipeline harian sedang berjalan. Weekly retrain dilewati.")
        return

    retrain_start = time.time()

    try:
        logger.info("=" * 70)
        logger.info(f"🔄 MEMULAI WEEKLY RETRAIN: {datetime.now().isoformat()}")
        logger.info("=" * 70)

        step_results = {}

        # STEP 1: Ingest
        try:
            logger.info("\n[WEEKLY 1/6] Mengunduh data pasar terbaru...")
            s = time.time()
            ingestor.run()
            step_results['ingestor'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 1/6] ✅ ({step_results['ingestor']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 1/6] ❌ {e}")
            step_results['ingestor'] = {'success': False, 'error': str(e)}

        # STEP 2: Feature Engineering
        try:
            logger.info("\n[WEEKLY 2/6] Feature engineering...")
            s = time.time()
            feature_engineering.run()
            step_results['features'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 2/6] ✅ ({step_results['features']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 2/6] ❌ {e}")
            step_results['features'] = {'success': False, 'error': str(e)}

        # STEP 3: RETRAIN XGBoost (ini yang membedakan dari pipeline harian)
        try:
            logger.info("\n[WEEKLY 3/6] 🧠 RETRAIN XGBoost dengan Walk-Forward Validation...")
            logger.info("             Menggunakan seluruh data historis yang tersedia...")
            s = time.time()
            train_xgboost.run()
            duration = time.time() - s
            step_results['retrain'] = {'success': True, 'duration': duration}
            logger.info(f"[WEEKLY 3/6] ✅ Model baru tersimpan ({duration:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 3/6] ❌ Retrain gagal: {e}")
            logger.error(traceback.format_exc())
            step_results['retrain'] = {'success': False, 'error': str(e)}
            logger.warning("[WEEKLY] Melanjutkan dengan model lama...")

        # STEP 4: Inference + SHAP dengan model baru
        try:
            logger.info("\n[WEEKLY 4/6] Inference + SHAP dengan model terbaru...")
            s = time.time()
            shap_explainer.run()
            step_results['inference'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 4/6] ✅ ({step_results['inference']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 4/6] ❌ {e}")
            step_results['inference'] = {'success': False, 'error': str(e)}

        # STEP 5: Sync DB + Outlier Bounds
        try:
            logger.info("\n[WEEKLY 5/6] Sync DB + Outlier bounds...")
            s = time.time()
            sync_db.sync_stocks()
            compute_and_save_capping_bounds()
            step_results['sync'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 5/6] ✅ ({step_results['sync']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 5/6] ❌ {e}")
            step_results['sync'] = {'success': False, 'error': str(e)}

        # STEP 6: Hot-reload
        try:
            logger.info("\n[WEEKLY 6/6] Hot-reload memory...")
            s = time.time()
            ai_store._load_data()
            bounds_store.reload()
            invalidated = invalidate_saw_cache()
            step_results['reload'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 6/6] ✅ SAW cache invalidated: {invalidated} entries")
        except Exception as e:
            logger.error(f"[WEEKLY 6/6] ❌ {e}")
            step_results['reload'] = {'success': False, 'error': str(e)}

        # Summary
        total = time.time() - retrain_start
        success_count = sum(1 for r in step_results.values() if r.get('success'))
        logger.info("=" * 70)
        logger.info(f"📊 WEEKLY RETRAIN SELESAI")
        logger.info(f"   Total waktu  : {total:.1f}s ({total/60:.1f} menit)")
        logger.info(f"   Step berhasil: {success_count}/{len(step_results)}")
        if step_results.get('retrain', {}).get('success'):
            logger.info("   🧠 Model XGBoost berhasil diperbarui dengan data terbaru!")
        else:
            logger.warning("   ⚠️  Model XGBoost TIDAK diperbarui (retrain gagal)")
        logger.info("=" * 70)

    except Exception as e:
        logger.error(f"❌ WEEKLY RETRAIN GAGAL KRITIS: {e}")
        logger.error(traceback.format_exc())
    finally:
        _PIPELINE_LOCK.release()


if __name__ == "__main__":
    run_daily_pipeline()
