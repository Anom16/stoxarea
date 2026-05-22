"""
capping_bounds.py — Singleton loader untuk batas capping outlier.

Pola ini identik dengan ai_scores.py agar konsisten dengan arsitektur
intelligence_store yang sudah ada.

Cara pakai di SPK 3:
    from intelligence_store.capping_bounds import bounds_store

    bounds = bounds_store.get_bounds()
    roe_max = bounds["roe"]["p95"]   # batas atas ROE
    roe_min = bounds["roe"]["p5"]    # batas bawah ROE (bisa negatif)
"""

import json
import logging
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)


class CappingBoundsStore:
    """
    Singleton yang menyimpan batas capping persentil di memori.
    Di-load saat server startup, di-reload setiap kali pipeline selesai jalan.
    """

    # Nilai default hardcode sebagai fallback terakhir
    # (dipakai jika file JSON belum ada sama sekali)
    _FALLBACK = {
        "roe": {"p5": -10.0, "p95": 40.0,  "median": 10.0, "sample_size": 0},
        "der": {"p5":   0.0, "p95":  3.0,  "median":  1.0, "sample_size": 0},
        "per": {"p5":   5.0, "p95": 80.0,  "median": 20.0, "sample_size": 0},
    }

    def __init__(self):
        self._bounds = {}
        self._load_data()

    def _load_data(self):
        """Membaca file capping_bounds.json ke memori."""
        path = Path(settings.CAPPING_BOUNDS_PATH)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    self._bounds = json.load(f)
                logger.info(
                    f"[CappingBounds] Berhasil memuat batas capping "
                    f"(ROE P95={self._bounds['roe']['p95']}, "
                    f"DER P95={self._bounds['der']['p95']}, "
                    f"PER P95={self._bounds['per']['p95']})"
                )
            except Exception as e:
                logger.error(f"[CappingBounds] Gagal membaca file: {e}. Menggunakan fallback.")
                self._bounds = self._FALLBACK.copy()
        else:
            logger.warning(
                f"[CappingBounds] File tidak ditemukan di {path}. "
                f"Menggunakan nilai default. Jalankan pipeline untuk generate file ini."
            )
            self._bounds = self._FALLBACK.copy()

    def get_bounds(self) -> dict:
        """Mengambil semua batas capping."""
        return self._bounds

    def clamp(self, value: float | None, metric: str) -> float:
        """
        Helper: Clamp satu nilai ke dalam batas P5-P95 untuk metric tertentu.

        Args:
            value: Nilai mentah dari DB (bisa None, negatif, atau ekstrem)
            metric: "roe", "der", atau "per"

        Returns:
            float: Nilai yang sudah di-clamp, aman untuk normalisasi SAW.

        Contoh:
            bounds_store.clamp(5000.0, "roe")  → 40.0  (di-cap ke P95)
            bounds_store.clamp(-200.0, "roe")  → -10.0 (di-cap ke P5, tetap negatif)
            bounds_store.clamp(None,   "der")  → 0.0   (None → batas bawah)
            bounds_store.clamp(1500.0, "per")  → 80.0  (di-cap ke P95)
        """
        if value is None:
            # None → gunakan batas bawah (paling aman/konservatif)
            return self._bounds[metric]["p5"]

        low  = self._bounds[metric]["p5"]
        high = self._bounds[metric]["p95"]
        return float(min(high, max(low, value)))

    def reload(self):
        """
        Dipanggil oleh scheduler setelah pipeline selesai,
        agar nilai bounds di memori langsung terupdate tanpa restart server.
        """
        logger.info("[CappingBounds] Hot-reload bounds dari file...")
        self._load_data()

    def is_using_fallback(self) -> bool:
        """Cek apakah sedang pakai nilai default (pipeline belum pernah jalan)."""
        return self._bounds.get("roe", {}).get("sample_size", 0) == 0


# Singleton instance — dipakai di seluruh aplikasi
bounds_store = CappingBoundsStore()
