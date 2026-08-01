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
from app.services.spk1_profiling import get_profile_weights
from app.services.spk2_scoring import get_qualified_stocks_for_saw
from app.schemas.recommendation import RecommendationResponse, InsightItem, TransparencyDetail

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
#   → Hanya ada beberapa profil. Semua user Agresif cukup hitung 1x, sisanya ambil cache.

_SAW_CACHE: dict = {}
_SAW_CACHE_TTL = 600        # 10 menit — cukup untuk 1 siklus data pasar

# FIX #6: Ganti satu lock global dengan per-key lock untuk mencegah thundering herd.
_SAW_CACHE_LOCK = threading.Lock()          # untuk operasi pada dict _SAW_CACHE & _SAW_KEY_LOCKS
_SAW_KEY_LOCKS: dict = {}                   # { cache_key: threading.Lock() }


def _make_cache_key(profile: str, sector: Optional[str]) -> str:
    """Membuat cache key unik dari kombinasi profil + sektor."""
    sector_key = sector.lower().strip() if sector else "all"
    profile_key = profile.lower().strip() if profile else "moderat"
    return f"{profile_key}::{sector_key}"


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

from app.models.indicator import Indicator, StockIndicatorValue, StockProfileMapping, ProfileIndicatorWeight

def calculate_saw_recommendations(
    db: Session,
    profile: str,
    target_sector: Optional[str] = None
) -> List[RecommendationResponse]:
    """
    Menjalankan SPK Lapis 3 (Simple Additive Weighting) dengan cache per profil.
    """

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

    # c. Acquire per-key lock
    with key_lock:
        # d. Double-check: mungkin thread sebelumnya sudah mengisi cache
        now = time.time()
        cached = _SAW_CACHE.get(cache_key)
        if cached and now < cached["expiry"]:
            logger.debug(f"[SAW Cache] HIT (double-check) — key='{cache_key}'")
            return cached["data"]

        # Cache miss yang sesungguhnya — hitung dari awal
        logger.info(f"[SAW Cache] MISS — key='{cache_key}', menghitung SAW...")

        # ── 1. Cek saham yang dikaitkan dengan profil risiko ini ──────────────
        p_id = profile.lower().strip() if profile else "moderat"
        try:
            mapped_tickers = [m.ticker for m in db.query(StockProfileMapping).filter(StockProfileMapping.profile_id == p_id).all()]
        except Exception:
            mapped_tickers = []
            
        if not mapped_tickers:
            logger.info(f"[SAW] Profil '{p_id}' tidak memiliki emiten terikat spesifik. Menggunakan seluruh qualified stocks.")

        # ── 2. Ambil kriteria indikator aktif dari database ──────────────────
        try:
            query_res = db.query(Indicator).all()
            if query_res and hasattr(query_res[0], "id") and isinstance(query_res[0].id, str):
                active_indicators = query_res
            else:
                active_indicators = []
        except Exception:
            active_indicators = []

        if not active_indicators:
            active_indicators = [
                Indicator(id='ai_score', name='AI Momentum Score', type='benefit'),
                Indicator(id='roe', name='ROE (Return on Equity)', type='benefit'),
                Indicator(id='der', name='DER (Debt to Equity Ratio)', type='cost'),
                Indicator(id='pbv', name='PBV (Price to Book Value)', type='cost'),
                Indicator(id='per', name='PER (Price to Earnings Ratio)', type='cost')
            ]
        indicator_map = {ind.id: ind for ind in active_indicators}

        # ── 3. Bobot kriteria dinamis untuk profil ini ───────────────────────
        weights = get_profile_weights(db, p_id)
        # Filter bobot hanya untuk indikator yang aktif
        weights = {k: v for k, v in weights.items() if k in indicator_map}
        weighted_indicators = [ind_id for ind_id, w in weights.items() if w > 0]
        
        if not weighted_indicators:
            logger.info(f"[SAW] Profil '{p_id}' tidak memiliki bobot spesifik > 0. Menggunakan default flat distribution.")
            weights = {ind.id: 1.0 / len(active_indicators) for ind in active_indicators}
            weighted_indicators = list(weights.keys())

        # ── 4. Ambil data bersih dari SPK 2 ──────────────────────────────────
        stocks = get_qualified_stocks_for_saw(db, target_sector)
        # Filter hanya saham yang dikaitkan dengan profil ini jika ada mapping
        if mapped_tickers:
            clean_mapped = {t.replace(".JK", "").strip().upper() for t in mapped_tickers}
            filtered = [s for s in stocks if s["ticker"].replace(".JK", "").strip().upper() in clean_mapped]
            if filtered:
                stocks = filtered

        if not stocks:
            return []

        # ── 5. Ambil data nilai indikator saham dari database ────────────────
        stock_vals = {s["ticker"]: {} for s in stocks}
        try:
            values_query = db.query(StockIndicatorValue).filter(
                StockIndicatorValue.ticker.in_([s["ticker"] for s in stocks])
            ).all()
            for val in values_query:
                stock_vals[val.ticker][val.indicator_id] = val.value
        except Exception:
            pass

        # Lengkapi stock_vals dari s jika dari mock / SPK 2 data
        for s in stocks:
            stock_vals[s["ticker"]]["ai_score"] = s["ai_score"]
            for ind_key in ["roe", "der", "pbv", "per"]:
                if ind_key not in stock_vals[s["ticker"]]:
                    clean_v = s.get(f"{ind_key}_clean")
                    raw_v = s.get(f"{ind_key}_raw")
                    direct_v = s.get(ind_key)
                    
                    chosen_v = clean_v if clean_v is not None else (raw_v if raw_v is not None else direct_v)
                    if chosen_v is not None:
                        stock_vals[s["ticker"]][ind_key] = chosen_v

        # ── 6. Normalisasi SAW Dinamis per Indikator ─────────────────────────
        normalized = {s["ticker"]: {} for s in stocks}

        for ind_id in weighted_indicators:
            ind = indicator_map[ind_id]
            # Ambil nilai mentah emiten untuk indikator ini (None/missing menjadi None)
            raw_vals = [stock_vals[s["ticker"]].get(ind_id) for s in stocks]
            valid_vals = [v for v in raw_vals if v is not None]

            if ind.type == 'benefit':
                if not valid_vals:
                    # Semua missing -> set neutral 0.5
                    for s in stocks:
                        normalized[s["ticker"]][ind_id] = 0.5
                else:
                    min_actual = min(valid_vals, default=0.0)
                    if min_actual < 0:
                        shift = abs(min_actual)
                        shifted = [v + shift for v in valid_vals]
                        max_shifted = max(shifted, default=1.0) or 1.0
                        for s in stocks:
                            raw_val = stock_vals[s["ticker"]].get(ind_id)
                            if raw_val is None:
                                normalized[s["ticker"]][ind_id] = 0.5
                            else:
                                normalized[s["ticker"]][ind_id] = (raw_val + shift) / max_shifted
                    else:
                        max_val = max(valid_vals, default=1.0) or 1.0
                        for s in stocks:
                            raw_val = stock_vals[s["ticker"]].get(ind_id)
                            if raw_val is None:
                                normalized[s["ticker"]][ind_id] = 0.5
                            else:
                                normalized[s["ticker"]][ind_id] = raw_val / max_val
            else:
                # Cost type: semakin kecil nilai (positif) semakin baik.
                # Nilai <= 0 atau missing tidak boleh secara otomatis dapat skor sempurna (1.0).
                positive_vals = [v for v in valid_vals if v > 0]
                if not positive_vals:
                    for s in stocks:
                        normalized[s["ticker"]][ind_id] = 0.5
                else:
                    min_pos_val = min(positive_vals)
                    for s in stocks:
                        raw_val = stock_vals[s["ticker"]].get(ind_id)
                        if raw_val is None:
                            # Data missing -> set 0.5 (netral)
                            normalized[s["ticker"]][ind_id] = 0.5
                        elif raw_val < 0:
                            # Nilai negatif pada cost (e.g. PER negatif akibat rugi) -> set netral 0.5
                            normalized[s["ticker"]][ind_id] = 0.5
                        elif raw_val == 0:
                            # 0 cost (e.g. DER 0 = bebas hutang) -> skor sempurna 1.0
                            normalized[s["ticker"]][ind_id] = 1.0
                        else:
                            normalized[s["ticker"]][ind_id] = min_pos_val / raw_val

            # Clamp normalized ke rentang [0.0, 1.0]
            for s in stocks:
                val = normalized[s["ticker"]].get(ind_id, 0.5)
                normalized[s["ticker"]][ind_id] = min(1.0, max(0.0, val))

        # ── 7. Hitung Skor SAW Akhir ─────────────────────────────────────────
        results = []
        for s in stocks:
            ticker = s["ticker"]
            final_score = 0.0
            formula_parts = []

            for ind_id in weighted_indicators:
                n_val = normalized[ticker][ind_id]
                w_val = weights[ind_id]
                final_score += (n_val * w_val)
                formula_parts.append(f"({n_val:.2f} * {w_val:.2f})")

            formula_str = "Match Score = " + " + ".join(formula_parts) + f" = {final_score:.4f} ({final_score * 100:.1f}%)"

            insights = [InsightItem(**i) for i in s["insights"]]

            # Default fundamental fallback display (Prioritaskan nilai raw asli)
            r_val = s.get("roe_raw") if s.get("roe_raw") is not None else stock_vals[ticker].get("roe", 0.0)
            d_val = s.get("der_raw") if s.get("der_raw") is not None else stock_vals[ticker].get("der", 0.0)
            p_val = s.get("pbv_raw") if s.get("pbv_raw") is not None else stock_vals[ticker].get("pbv", 0.0)

            roe_display = round(float(r_val), 2) if r_val is not None else None
            der_display = round(float(d_val), 2) if d_val is not None else None
            pbv_display = round(float(p_val), 2) if p_val is not None else None

            # Transparansi Detail Kalkulasi SAW
            transparency_data = TransparencyDetail(
                weights={ind_id: round(weights[ind_id], 4) for ind_id in weighted_indicators},
                raw_values={ind_id: round(stock_vals[ticker].get(ind_id, 0.0), 4) for ind_id in weighted_indicators},
                normalized_values={ind_id: round(normalized[ticker][ind_id], 4) for ind_id in weighted_indicators},
                formula=formula_str
            )

            results.append(
                RecommendationResponse(
                    ticker=ticker,
                    sector=s["sector"],
                    match_score=round(final_score, 4),
                    match_score_percent=f"{final_score * 100:.1f}%",
                    ai_score_percent=f"{s['ai_score'] * 100:.1f}%",
                    insights=insights,
                    roe=roe_display,
                    der=der_display,
                    pbv=pbv_display,
                    transparency=transparency_data
                )
            )

        # Urutkan berdasarkan Match Score tertinggi
        results.sort(key=lambda x: x.match_score, reverse=True)

        # ── 8. Simpan ke Cache ───────────────────────────────────────────────
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
