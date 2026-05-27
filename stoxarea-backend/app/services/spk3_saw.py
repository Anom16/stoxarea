"""
spk3_saw.py — SPK Lapis 3: Simple Additive Weighting (SAW)

Kritik 2 — Cache per Profil (Anti-Bottleneck):
    Hanya ada 3 profil (Konservatif, Moderat, Agresif) × 12 sektor + 1 global
    = maksimal 39 kombinasi cache.

    Tanpa cache: 1.000 user request → 1.000 kalkulasi SAW bersamaan
    Dengan cache: 1.000 user request → maksimal 3 kalkulasi, 997 ambil cache

    Cache TTL = 10 menit (sinkron dengan siklus data pasar).
    Cache di-invalidate otomatis saat pipeline ML selesai jalan.
"""

import time
import threading
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.user import RiskProfileEnum
from app.services.spk1_profiling import get_profile_weights
from app.services.spk2_scoring import get_qualified_stocks_for_saw
from app.schemas.recommendation import RecommendationResponse, InsightItem

logger = logging.getLogger(__name__)

# ─── Cache SAW per Profil ─────────────────────────────────────────────────────
#
# Struktur: {
#   "konservatif::all":      {"data": [...], "expiry": timestamp},
#   "moderat::all":          {"data": [...], "expiry": timestamp},
#   "agresif::all":          {"data": [...], "expiry": timestamp},
#   "konservatif::Keuangan": {"data": [...], "expiry": timestamp},
#   ...
# }
#
# Key format: "{profile}::{sector_or_all}"
# Kenapa per profil, bukan per user?
#   → Hanya ada 3 profil. 500 user Agresif cukup hitung 1x, sisanya ambil cache.

_SAW_CACHE: dict = {}
_SAW_CACHE_TTL = 600        # 10 menit — cukup untuk 1 siklus data pasar

# FIX #6: Ganti satu lock global dengan per-key lock untuk mencegah thundering herd.
#
# BUG LAMA: Satu _SAW_CACHE_LOCK dipakai untuk cek DAN simpan, tapi kalkulasi berat
# berjalan di LUAR lock. Jika 100 request datang bersamaan untuk key yang sama,
# semua 100 mendapat cache miss dan menjalankan kalkulasi paralel (thundering herd).
#
# FIX: Gunakan dict of per-key locks (_SAW_KEY_LOCKS).
# Hanya 1 goroutine yang bisa menghitung untuk key tertentu pada satu waktu.
# Goroutine lain yang menunggu lock akan langsung mendapat hasil dari cache
# setelah goroutine pertama selesai menyimpan.
_SAW_CACHE_LOCK = threading.Lock()          # untuk operasi pada dict _SAW_CACHE & _SAW_KEY_LOCKS
_SAW_KEY_LOCKS: dict = {}                   # { cache_key: threading.Lock() }


def _make_cache_key(profile: RiskProfileEnum, sector: Optional[str]) -> str:
    """Membuat cache key unik dari kombinasi profil + sektor."""
    sector_key = sector.lower().strip() if sector else "all"
    return f"{profile.value.lower()}::{sector_key}"


def invalidate_saw_cache() -> int:
    """
    Menghapus seluruh cache SAW.
    Dipanggil oleh pipeline ML setelah data baru selesai diproses,
    agar rekomendasi berikutnya menggunakan data terbaru.

    Returns:
        int: jumlah cache entry yang dihapus
    """
    global _SAW_CACHE, _SAW_KEY_LOCKS
    with _SAW_CACHE_LOCK:
        count = len(_SAW_CACHE)
        _SAW_CACHE.clear()
        _SAW_KEY_LOCKS.clear()  # FIX #6: bersihkan juga per-key locks
    logger.info(f"[SAW Cache] Invalidated {count} cache entries.")
    return count


def get_cache_status() -> dict:
    """
    Mengembalikan status cache saat ini.
    Dipakai oleh admin endpoint untuk monitoring.
    """
    now = time.time()
    with _SAW_CACHE_LOCK:
        entries = []
        for key, val in _SAW_CACHE.items():
            ttl_remaining = max(0, val["expiry"] - now)
            entries.append({
                "key": key,
                "items": len(val["data"]),
                "ttl_remaining_sec": round(ttl_remaining, 1),
                "expired": ttl_remaining <= 0
            })
    return {
        "total_entries": len(entries),
        "entries": entries
    }


# ─── Fungsi Utama SAW ─────────────────────────────────────────────────────────

def calculate_saw_recommendations(
    db: Session,
    profile: RiskProfileEnum,
    target_sector: Optional[str] = None
) -> List[RecommendationResponse]:
    """
    Menjalankan SPK Lapis 3 (Simple Additive Weighting) dengan cache per profil.

    Alur:
        1. Cek cache — jika ada dan belum expired, langsung return
        2. Ambil bobot profil dari SPK 1
        3. Ambil data bersih dari SPK 2
        4. Normalisasi SAW
        5. Hitung skor akhir, simpan ke cache, return
    """

    # ── 1. Cek Cache dengan Double-Checked Locking ───────────────────────────
    # FIX #6: Implementasi per-key lock untuk mencegah thundering herd.
    #
    # Alur:
    #   a. Cek cache tanpa lock (fast path) — jika HIT, langsung return
    #   b. Ambil/buat per-key lock untuk cache_key ini
    #   c. Acquire per-key lock (hanya 1 thread yang bisa masuk per key)
    #   d. Cek cache LAGI di dalam lock (double-check) — mungkin thread lain
    #      sudah mengisi cache saat kita menunggu lock
    #   e. Jika masih MISS, hitung SAW dan simpan ke cache
    #   f. Release per-key lock → thread lain yang menunggu akan langsung
    #      mendapat hasil dari cache (langkah d)

    cache_key = _make_cache_key(profile, target_sector)
    now = time.time()

    # a. Fast path: cek tanpa lock
    cached = _SAW_CACHE.get(cache_key)
    if cached and now < cached["expiry"]:
        logger.debug(f"[SAW Cache] HIT (fast path) — key='{cache_key}'")
        return cached["data"]

    # b. Ambil atau buat per-key lock
    with _SAW_CACHE_LOCK:
        if cache_key not in _SAW_KEY_LOCKS:
            _SAW_KEY_LOCKS[cache_key] = threading.Lock()
        key_lock = _SAW_KEY_LOCKS[cache_key]

    # c. Acquire per-key lock — hanya 1 thread per cache_key yang masuk ke sini
    with key_lock:
        # d. Double-check: mungkin thread sebelumnya sudah mengisi cache
        now = time.time()
        cached = _SAW_CACHE.get(cache_key)
        if cached and now < cached["expiry"]:
            logger.debug(f"[SAW Cache] HIT (double-check) — key='{cache_key}'")
            return cached["data"]

        # Cache miss yang sesungguhnya — hitung dari awal
        logger.info(f"[SAW Cache] MISS — key='{cache_key}', menghitung SAW...")

        # ── 2. Bobot dari profil risiko user (hasil SPK 1) ───────────────────
        weights = get_profile_weights(profile)

        # ── 3. Ambil data bersih dari SPK 2 ──────────────────────────────────
        stocks = get_qualified_stocks_for_saw(db, target_sector)
        if not stocks:
            return []

        # ── 4. Hitung Referensi Normalisasi ──────────────────────────────────

        max_ai = max(s["ai_score"] for s in stocks) or 1.0

        # ROE (Benefit) — guard untuk semua ROE negatif
        all_roe = [s["roe_clean"] for s in stocks]
        roe_min_actual = min(all_roe)
        if roe_min_actual < 0:
            roe_shift = abs(roe_min_actual)
            roe_shifted = {s["ticker"]: s["roe_clean"] + roe_shift for s in stocks}
        else:
            roe_shifted = {s["ticker"]: s["roe_clean"] for s in stocks}

        max_roe_shifted = max(roe_shifted.values()) or 1.0

        # DER & PBV (Cost)
        min_der = min(
            (s["der_clean"] for s in stocks if s["der_clean"] > 0),
            default=0.1
        )
        min_pbv = min(
            (s["pbv_clean"] for s in stocks if s["pbv_clean"] > 0),
            default=0.2
        )

        # ── 5. Kalkulasi Normalisasi SAW & Skor Akhir ────────────────────────
        results = []
        for s in stocks:

            n_ai  = s["ai_score"] / max_ai if max_ai > 0 else 0.0
            n_roe = roe_shifted[s["ticker"]] / max_roe_shifted if max_roe_shifted > 0 else 0.0

            if s["der_clean"] <= 0.1:
                n_der = 1.0
            else:
                n_der = min_der / s["der_clean"]

            n_pbv = 0.0 if s["pbv_clean"] <= 0 else (min_pbv / s["pbv_clean"])

            # Clamp ke [0, 1]
            n_ai  = min(1.0, max(0.0, n_ai))
            n_roe = min(1.0, max(0.0, n_roe))
            n_der = min(1.0, max(0.0, n_der))
            n_pbv = min(1.0, max(0.0, n_pbv))

            final_score = (
                (n_ai  * weights["ai_score"]) +
                (n_roe * weights["roe"])      +
                (n_der * weights["der"])      +
                (n_pbv * weights["pbv"])
            )

            insights = [InsightItem(**i) for i in s["insights"]]

            roe_display = round(s["roe_raw"], 2) if s["roe_raw"] is not None else 0.0
            der_display = round(s["der_raw"], 2) if s["der_raw"] is not None else 0.0
            pbv_display = round(s["pbv_raw"], 2) if s["pbv_raw"] is not None else 0.0

            results.append(
                RecommendationResponse(
                    ticker=s["ticker"],
                    sector=s["sector"],
                    match_score=round(final_score, 4),
                    match_score_percent=f"{final_score * 100:.1f}%",
                    ai_score_percent=f"{s['ai_score'] * 100:.1f}%",
                    insights=insights,
                    roe=roe_display,
                    der=der_display,
                    pbv=pbv_display,
                )
            )

        # Urutkan berdasarkan Match Score tertinggi
        results.sort(key=lambda x: x.match_score, reverse=True)

        # ── 6. Simpan ke Cache (masih di dalam key_lock) ─────────────────────
        with _SAW_CACHE_LOCK:
            _SAW_CACHE[cache_key] = {
                "data":   results,
                "expiry": now + _SAW_CACHE_TTL
            }
        logger.info(
            f"[SAW Cache] STORED — key='{cache_key}', "
            f"{len(results)} saham, TTL={_SAW_CACHE_TTL}s"
        )

        return results
