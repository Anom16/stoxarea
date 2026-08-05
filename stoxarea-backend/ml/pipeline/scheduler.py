import logging
import traceback
import threading
import time
from datetime import datetime, date
from pathlib import Path

# Impor semua modul dalam urutan pipeline
from ml.pipeline import ingestor
from ml.features import feature_engineering
from ml.training import train_xgboost, evaluate
from ml.inference import shap_explainer
from ml.pipeline import sync_db
from ml.pipeline.outlier_guard import compute_and_save_capping_bounds
from intelligence_store.ai_scores import ai_store
from intelligence_store.capping_bounds import bounds_store
from app.services.spk3_saw import invalidate_saw_cache

logger = logging.getLogger(__name__)

class PipelineLogHandler(logging.Handler):
    def __init__(self, filepath: Path):
        super().__init__()
        self.filepath = filepath
        self.formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    def emit(self, record):
        try:
            msg = self.format(record)
            with open(self.filepath, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
        except Exception:
            self.handleError(record)

_PIPELINE_LOCK = threading.Lock()
_PIPELINE_LOCK_FILE = Path("logs/pipeline.lock")

# Daftar hari libur bursa BEI
BEI_HOLIDAYS_2025: set[date] = {
    date(2025, 1, 1),   date(2025, 1, 27),  date(2025, 1, 28),  date(2025, 1, 29),
    date(2025, 3, 28),  date(2025, 3, 31),  date(2025, 4, 18),  date(2025, 5, 1),
    date(2025, 5, 12),  date(2025, 5, 29),  date(2025, 6, 1),   date(2025, 8, 17),
    date(2025, 9, 5),   date(2025, 12, 25), date(2025, 12, 26),
}

BEI_HOLIDAYS_2026: set[date] = {
    date(2026, 1, 1),
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
    Pipeline ML HARIAN (Cepat ~1-2 menit):
    Fokus: Memperbarui data harga harian & menjalankan Inferensi AI Score dengan model yang sudah ada.
    (TANPA melakukan retrain model XGBoost).
    
    6 Step Harian:
    1. Unduh OHLCV terbaru
    2. Kalkulasi fitur teknikal
    3. Inferensi XGBoost + SHAP (memakai model tersimpan)
    4. Sinkronisasi DB Fundamental
    5. Hitung Outlier Bounds
    6. Hot-reload Memory Store & SAW Cache
    """
    today = date.today()
    if not force and not is_bei_trading_day(today):
        day_name = today.strftime("%A, %d %B %Y")
        reason = "akhir pekan" if today.weekday() >= 5 else "hari libur bursa BEI"
        logger.info(f"[Pipeline] Dilewati — {day_name} adalah {reason}. (Gunakan force=True untuk memaksa)")
        return

    acquired = _PIPELINE_LOCK.acquire(blocking=False)
    if not acquired:
        logger.warning("[Pipeline] Sudah ada pipeline yang berjalan. Skipping execution ini.")
        return
    
    pipeline_start_time = time.time()
    
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    pipeline_log_path = log_dir / "pipeline.log"
    
    with open(pipeline_log_path, "w", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [INFO] 🚀 Memulai Pipeline ML HARIAN (Inference & Ingest - Tanpa Retrain)...\n")

    handler = PipelineLogHandler(pipeline_log_path)
    handler.setLevel(logging.INFO)
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    
    try:
        logger.info("="*70)
        logger.info(f"🚀 MEMULAI PIPELINE HARIAN STOXAREA: {datetime.now().isoformat()}")
        logger.info("="*70)
        
        step_results = {}
        
        # ============ STEP 1: Ingest Data ============
        try:
            logger.info("\n[STEP 1/6] Mengunduh data pasar terbaru (OHLCV)...")
            step_start = time.time()
            ingestor.run()
            step_results['ingestor'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 1/6] ✅ SUKSES ({step_results['ingestor']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 1/6] ❌ GAGAL: {str(e)}")
            step_results['ingestor'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 2: Feature Engineering ============
        try:
            logger.info("\n[STEP 2/6] Mengkalkulasi indikator teknikal terbaru...")
            step_start = time.time()
            feature_engineering.run()
            step_results['feature_engineering'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 2/6] ✅ SUKSES ({step_results['feature_engineering']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 2/6] ❌ GAGAL: {str(e)}")
            step_results['feature_engineering'] = {'success': False, 'error': str(e)}

        # ============ STEP 3: Inference & SHAP (Pakai Model Tersimpan) ============
        try:
            logger.info("\n[STEP 3/6] Menjalankan inferensi AI Score & kalkulasi SHAP (Memakai model tersimpan)...")
            step_start = time.time()
            shap_explainer.run()
            step_results['inference'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 3/6] ✅ SUKSES ({step_results['inference']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 3/6] ❌ GAGAL: {str(e)}")
            step_results['inference'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 4: Database Sync ============
        try:
            logger.info("\n[STEP 4/6] Sinkronisasi data fundamental ke Database...")
            step_start = time.time()
            sync_db.sync_stocks()
            step_results['sync_db'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 4/6] ✅ SUKSES ({step_results['sync_db']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 4/6] ❌ GAGAL: {str(e)}")
            step_results['sync_db'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 5: Outlier Bounds ============
        try:
            logger.info("\n[STEP 5/6] Menghitung batas capping outlier...")
            step_start = time.time()
            compute_and_save_capping_bounds()
            step_results['outlier_guard'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 5/6] ✅ SUKSES ({step_results['outlier_guard']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[STEP 5/6] ❌ GAGAL: {str(e)}")
            step_results['outlier_guard'] = {'success': False, 'error': str(e)}
        
        # ============ STEP 6: Hot-reload ============
        try:
            logger.info("\n[STEP 6/6] Melakukan hot-reload store & invalidasi SAW Cache...")
            step_start = time.time()
            ai_store._load_data()
            bounds_store.reload()
            invalidated = invalidate_saw_cache()
            step_results['hot_reload'] = {'success': True, 'duration': time.time() - step_start}
            logger.info(f"[STEP 6/6] ✅ SUKSES ({step_results['hot_reload']['duration']:.1f}s) - SAW Cache invalidated: {invalidated} entries")
        except Exception as e:
            logger.error(f"[STEP 6/6] ❌ GAGAL: {str(e)}")
            step_results['hot_reload'] = {'success': False, 'error': str(e)}
        
        # ============ SUMMARY ============
        total_duration = time.time() - pipeline_start_time
        success_count = sum(1 for r in step_results.values() if r.get('success'))
        
        logger.info("="*70)
        logger.info(f"📊 RINGKASAN PIPELINE HARIAN")
        logger.info(f"   Total waktu: {total_duration:.1f}s")
        logger.info(f"   Step berhasil: {success_count}/{len(step_results)}")
        for step_name, result in step_results.items():
            status = "✅" if result['success'] else "❌"
            logger.info(f"   {status} {step_name}: {result.get('duration', 0):.1f}s" if result['success'] else f"   {status} {step_name}: {result.get('error', 'Unknown error')}")
        
        if success_count == len(step_results):
            logger.info("✅ PIPELINE HARIAN SELESAI DENGAN SUKSES!")
        else:
            logger.warning(f"⚠️  PIPELINE HARIAN SELESAI DENGAN PARTIAL SUCCESS ({success_count}/{len(step_results)} steps)")
        logger.info("="*70)
        
    except Exception as e:
        logger.error("❌ PIPELINE HARIAN GAGAL! Terjadi kesalahan kritis.")
        logger.error(traceback.format_exc())
    finally:
        root_logger = logging.getLogger()
        root_logger.removeHandler(handler)
        _PIPELINE_LOCK.release()
        logger.info(f"[Pipeline Harian] Lock dirilis.")


def run_weekly_retrain():
    """
    Pipeline MINGGUAN (Full Retrain ~3-5 menit):
    Memperbarui seluruh dataset, melatih ulang pohon XGBoost dari awal (Grid Search & Walk-Forward CV),
    melakukan inferensi, serta memperbarui grafik & laporan evaluasi model.
    """
    acquired = _PIPELINE_LOCK.acquire(blocking=False)
    if not acquired:
        logger.warning("[Weekly] Pipeline lain sedang berjalan. Weekly retrain dilewati.")
        return

    retrain_start = time.time()

    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    pipeline_log_path = log_dir / "pipeline.log"
    
    with open(pipeline_log_path, "w", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [INFO] 🔄 Memulai Full Retrain XGBoost Mingguan...\n")

    handler = PipelineLogHandler(pipeline_log_path)
    handler.setLevel(logging.INFO)
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)

    try:
        logger.info("=" * 70)
        logger.info(f"🔄 MEMULAI FULL RETRAIN MINGGUAN: {datetime.now().isoformat()}")
        logger.info("=" * 70)

        step_results = {}

        # STEP 1: Ingest
        try:
            logger.info("\n[WEEKLY 1/7] Mengunduh data pasar terbaru (OHLCV)...")
            s = time.time()
            ingestor.run()
            step_results['ingestor'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 1/7] ✅ ({step_results['ingestor']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 1/7] ❌ {e}")
            step_results['ingestor'] = {'success': False, 'error': str(e)}

        # STEP 2: Feature Engineering
        try:
            logger.info("\n[WEEKLY 2/7] Feature engineering & target generation...")
            s = time.time()
            feature_engineering.run()
            step_results['features'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 2/7] ✅ ({step_results['features']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 2/7] ❌ {e}")
            step_results['features'] = {'success': False, 'error': str(e)}

        # STEP 3: FULL RETRAIN XGBoost
        try:
            logger.info("\n[WEEKLY 3/7] 🧠 RETRAIN XGBoost dengan Hyperparameter Grid Search & Walk-Forward CV...")
            s = time.time()
            train_xgboost.run()
            duration = time.time() - s
            step_results['retrain'] = {'success': True, 'duration': duration}
            logger.info(f"[WEEKLY 3/7] ✅ Model baru tersimpan ({duration:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 3/7] ❌ Retrain gagal: {e}")
            step_results['retrain'] = {'success': False, 'error': str(e)}

        # STEP 4: Inference + SHAP dengan model baru
        try:
            logger.info("\n[WEEKLY 4/7] Inferensi AI Score & kalkulasi SHAP dengan model terbaru...")
            s = time.time()
            shap_explainer.run()
            step_results['inference'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 4/7] ✅ ({step_results['inference']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 4/7] ❌ {e}")
            step_results['inference'] = {'success': False, 'error': str(e)}

        # STEP 5: Model Evaluation
        try:
            logger.info("\n[WEEKLY 5/7] Evaluasi model XGBoost & pembaruan laporan metrik...")
            s = time.time()
            evaluate.run()
            step_results['evaluation'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 5/7] ✅ ({step_results['evaluation']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 5/7] ❌ {e}")
            step_results['evaluation'] = {'success': False, 'error': str(e)}

        # STEP 6: Sync DB + Outlier Bounds
        try:
            logger.info("\n[WEEKLY 6/7] Sinkronisasi Database & Outlier Capping Bounds...")
            s = time.time()
            sync_db.sync_stocks()
            compute_and_save_capping_bounds()
            step_results['sync'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 6/7] ✅ ({step_results['sync']['duration']:.1f}s)")
        except Exception as e:
            logger.error(f"[WEEKLY 6/7] ❌ {e}")
            step_results['sync'] = {'success': False, 'error': str(e)}

        # STEP 7: Hot-reload
        try:
            logger.info("\n[WEEKLY 7/7] Hot-reload memory & invalidasi SAW Cache...")
            s = time.time()
            ai_store._load_data()
            bounds_store.reload()
            invalidated = invalidate_saw_cache()
            step_results['reload'] = {'success': True, 'duration': time.time() - s}
            logger.info(f"[WEEKLY 7/7] ✅ SAW cache invalidated: {invalidated} entries")
        except Exception as e:
            logger.error(f"[WEEKLY 7/7] ❌ {e}")
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
        root_logger = logging.getLogger()
        root_logger.removeHandler(handler)
        _PIPELINE_LOCK.release()


if __name__ == "__main__":
    run_daily_pipeline()
