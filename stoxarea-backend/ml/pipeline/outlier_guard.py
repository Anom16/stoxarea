"""
outlier_guard.py — Task 1.1: Komputasi Batas Capping Berbasis Persentil

Tujuan:
    Menghitung batas capping (min/max) untuk ROE, DER, dan PER
    menggunakan metode persentil P5-P95 dari data aktual saham yang
    lolos filter SPK 2 (is_qualified = True).

Kenapa persentil, bukan hardcode?
    - Nilai hardcode (misal: ROE max 50) tidak punya justifikasi statistik.
    - Persentil P95 secara otomatis menyesuaikan diri dengan kondisi pasar
      saat ini. Jika pasar sedang bubble, P95 naik. Jika pasar crash, P95 turun.
    - Ini membuat sistem defensif terhadap outlier secara adaptif.

Output:
    Menyimpan hasil ke data/processed/capping_bounds.json
    yang kemudian dibaca oleh intelligence_store/capping_bounds.py
"""

import json
import logging
import numpy as np
from pathlib import Path
from app.core.database import SessionLocal
from app.models.stock import Stock
from app.core.config import settings

logger = logging.getLogger(__name__)


def compute_and_save_capping_bounds() -> dict:
    """
    Fungsi utama Task 1.1.
    Membaca semua saham is_qualified=True dari DB, menghitung persentil,
    lalu menyimpan hasilnya ke JSON.

    Returns:
        dict: bounds yang telah dihitung dan disimpan.
    """
    logger.info("[OutlierGuard] Memulai komputasi batas capping berbasis persentil...")

    db = SessionLocal()
    try:
        # Ambil hanya saham yang lolos filter SPK 2
        stocks = db.query(Stock).filter(Stock.is_qualified == True).all()
    finally:
        db.close()

    if not stocks:
        logger.warning("[OutlierGuard] Tidak ada saham qualified di DB. Menggunakan batas default.")
        return _get_default_bounds()

    # Kumpulkan nilai yang valid (tidak None)
    roe_vals = [s.roe for s in stocks if s.roe is not None]
    der_vals = [s.der for s in stocks if s.der is not None and s.der > 0]
    pbv_vals = [s.pbv for s in stocks if s.pbv is not None and s.pbv > 0]

    logger.info(
        f"[OutlierGuard] Data terkumpul — "
        f"ROE: {len(roe_vals)} saham, "
        f"DER: {len(der_vals)} saham, "
        f"PBV: {len(pbv_vals)} saham"
    )

    # Fallback ke default jika data terlalu sedikit untuk persentil bermakna
    MIN_SAMPLE = 10
    bounds = {}

    # --- ROE (Benefit: makin tinggi makin baik) ---
    # P5 sebagai batas bawah: menangkap ROE negatif yang wajar (bukan anomali)
    # P95 sebagai batas atas: memotong ROE ekstrem non-operasional (misal: 5000%)
    if len(roe_vals) >= MIN_SAMPLE:
        bounds["roe"] = {
            "p5":  round(float(np.percentile(roe_vals, 5)),  4),
            "p95": round(float(np.percentile(roe_vals, 95)), 4),
            "median": round(float(np.median(roe_vals)), 4),
            "sample_size": len(roe_vals)
        }
    else:
        logger.warning("[OutlierGuard] Sampel ROE kurang dari 10, pakai default.")
        bounds["roe"] = _get_default_bounds()["roe"]

    # --- DER (Cost: makin rendah makin baik) ---
    # Batas bawah selalu 0 (DER tidak bisa negatif secara logis)
    # P95 sebagai batas atas: memotong DER ekstrem (misal: perusahaan hampir bangkrut)
    if len(der_vals) >= MIN_SAMPLE:
        bounds["der"] = {
            "p5":  0.0,  # DER minimum logis adalah 0 (tidak punya hutang)
            "p95": round(float(np.percentile(der_vals, 95)), 4),
            "median": round(float(np.median(der_vals)), 4),
            "sample_size": len(der_vals)
        }
    else:
        logger.warning("[OutlierGuard] Sampel DER kurang dari 10, pakai default.")
        bounds["der"] = _get_default_bounds()["der"]

    # --- PBV (Cost: makin rendah makin baik) ---
    # P5 sebagai batas bawah: hindari PBV sangat kecil yang anomali (misal: 0.05x)
    # P95 sebagai batas atas: memotong PBV ekstrem (misal: 50x saat euforia)
    if len(pbv_vals) >= MIN_SAMPLE:
        bounds["pbv"] = {
            "p5":  round(float(np.percentile(pbv_vals, 5)),  4),
            "p95": round(float(np.percentile(pbv_vals, 95)), 4),
            "median": round(float(np.median(pbv_vals)), 4),
            "sample_size": len(pbv_vals)
        }
    else:
        logger.warning("[OutlierGuard] Sampel PBV kurang dari 10, pakai default.")
        bounds["pbv"] = _get_default_bounds()["pbv"]

    # Simpan ke JSON
    _save_bounds(bounds)

    logger.info(
        f"[OutlierGuard] ✅ Batas capping berhasil dihitung:\n"
        f"  ROE  → [{bounds['roe']['p5']}, {bounds['roe']['p95']}] "
        f"(median: {bounds['roe']['median']})\n"
        f"  DER  → [0.0, {bounds['der']['p95']}] "
        f"(median: {bounds['der']['median']})\n"
        f"  PBV  → [{bounds['pbv']['p5']}, {bounds['pbv']['p95']}] "
        f"(median: {bounds['pbv']['median']})"
    )

    return bounds


def _save_bounds(bounds: dict) -> None:
    """Menyimpan bounds ke file JSON di intelligence_store."""
    output_path = Path(settings.CAPPING_BOUNDS_PATH)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(bounds, f, indent=2, ensure_ascii=False)

    logger.info(f"[OutlierGuard] Bounds disimpan ke: {output_path}")


def _get_default_bounds() -> dict:
    """
    Nilai default yang dipakai jika data DB belum tersedia
    (misal: pertama kali setup, sebelum pipeline pertama jalan).

    Nilai ini diambil dari referensi umum pasar BEI:
    - ROE: mayoritas saham BEI berkisar -10% hingga 40%
    - DER: mayoritas 0 hingga 3x (sektor non-keuangan)
    - PBV: mayoritas 0.1x hingga 10.0x
    """
    return {
        "roe": {"p5": -10.0, "p95": 40.0,  "median": 10.0, "sample_size": 0},
        "der": {"p5":   0.0, "p95":  3.0,  "median":  1.0, "sample_size": 0},
        "pbv": {"p5":   0.1, "p95": 10.0,  "median":  1.5, "sample_size": 0},
    }


if __name__ == "__main__":
    # Bisa dijalankan manual: python -m ml.pipeline.outlier_guard
    import logging
    logging.basicConfig(level=logging.INFO)
    result = compute_and_save_capping_bounds()
    print("\nHasil bounds:")
    print(json.dumps(result, indent=2))
