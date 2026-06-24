"""
test_spk3_outlier.py — Task 1.4: Unit Test Ketahanan SPK 3 terhadap Outlier

Tujuan:
    Membuktikan kepada penguji bahwa algoritma SAW di SPK 3 tidak hancur
    ketika menghadapi data ekstrem yang sering terjadi di pasar IHSG.

Cara jalankan:
    cd stoxarea-backend
    python -m pytest tests/test_spk3_outlier.py -v

Skenario yang diuji:
    1. Satu saham PBV 1500x di antara 99 saham normal
       → 99 saham normal harus tetap punya skor > 0.05
    2. ROE negatif -200% harus dapat skor lebih rendah dari ROE positif
       → Saham rugi tidak boleh disamakan dengan saham ROE 0
    3. DER = 0 (tidak punya hutang) harus dapat skor DER sempurna (1.0)
    4. Semua saham ROE identik → tidak ada division by zero
    5. Semua saham ROE negatif → normalisasi tetap valid (tidak terbalik)
    6. Satu saham ROE 5000% (anomali non-operasional) → saham lain tidak hancur
    7. Profil Agresif vs Konservatif → ranking berbeda untuk data yang sama
    8. Saham dengan data None → tidak crash, dapat skor default
"""

import pytest
from unittest.mock import MagicMock, patch

# ─── Helper: buat mock Stock object ──────────────────────────────────────────

def make_stock(ticker, sector="Keuangan", roe=15.0, der=1.0, pbv=20.0,
               is_qualified=True):
    """Membuat mock objek Stock SQLAlchemy."""
    s = MagicMock()
    s.ticker = ticker
    s.sector = sector
    s.roe = roe
    s.der = der
    s.pbv = pbv
    s.is_qualified = is_qualified
    return s


def make_ai_data(ai_score=0.65):
    """Membuat mock data AI Score dari intelligence_store."""
    return {
        "ai_score": ai_score,
        "insights": [
            {
                "feature": "rsi",
                "contribution": 0.12,
                "description": "RSI menunjukkan oversold"
            }
        ]
    }


# ─── Helper: jalankan SAW dengan data mock ───────────────────────────────────

def run_saw(stocks_data, profile_str="moderat", bounds=None):
    """
    Menjalankan calculate_saw_recommendations dengan semua dependency di-mock.

    Setelah Task 1.3, SPK 3 tidak lagi punya ai_store atau bounds_store sendiri.
    Semua data datang dari get_qualified_stocks_for_saw() di SPK 2.
    Jadi yang di-mock adalah fungsi tersebut, bukan ai_store/bounds_store langsung.

    Args:
        stocks_data: list of dict dengan key: ticker, sector, roe, der, pbv, ai_score
        profile_str: "konservatif" | "moderat" | "agresif"
        bounds: dict bounds custom, jika None pakai fallback default

    Returns:
        list of RecommendationResponse
    """
    from app.models.user import RiskProfileEnum

    profile_map = {
        "konservatif": RiskProfileEnum.konservatif,
        "moderat":     RiskProfileEnum.moderat,
        "agresif":     RiskProfileEnum.agresif,
    }
    profile = profile_map[profile_str]

    # Default bounds jika tidak disediakan (representatif pasar BEI normal)
    default_bounds = {
        "roe": {"p5": -10.0, "p95": 40.0,  "median": 10.0, "sample_size": 50},
        "der": {"p5":   0.0, "p95":  3.0,  "median":  1.0, "sample_size": 50},
        "pbv": {"p5":   5.0, "p95": 80.0,  "median": 20.0, "sample_size": 50},
    }
    active_bounds = bounds or default_bounds

    def clamp_fn(value, metric):
        if value is None:
            return active_bounds[metric]["p5"]
        low  = active_bounds[metric]["p5"]
        high = active_bounds[metric]["p95"]
        return float(min(high, max(low, value)))

    # Bangun output yang akan dikembalikan oleh get_qualified_stocks_for_saw()
    # Ini mensimulasikan data bersih yang sudah di-clamp oleh SPK 2
    qualified_stocks = []
    for d in stocks_data:
        roe_raw = d.get("roe")
        der_raw = d.get("der")
        pbv_raw = d.get("pbv")
        qualified_stocks.append({
            "ticker":    d["ticker"],
            "sector":    d.get("sector", "Keuangan"),
            "ai_score":  d.get("ai_score", 0.65),
            "insights":  [{"feature": "rsi", "contribution": 0.12,
                           "description": "RSI menunjukkan oversold"}],
            "roe_raw":   roe_raw,
            "der_raw":   der_raw,
            "pbv_raw":   pbv_raw,
            "roe_clean": clamp_fn(roe_raw, "roe"),
            "der_clean": clamp_fn(der_raw, "der"),
            "pbv_clean": clamp_fn(pbv_raw, "pbv"),
        })

    mock_db = MagicMock()

    # Bersihkan cache SAW sebelum setiap test agar tidak bocor antar test case
    from app.services.spk3_saw import invalidate_saw_cache
    invalidate_saw_cache()

    # Mock get_qualified_stocks_for_saw — ini satu-satunya dependency SPK 3 sekarang
    with patch("app.services.spk3_saw.get_qualified_stocks_for_saw",
               return_value=qualified_stocks):
        from app.services.spk3_saw import calculate_saw_recommendations
        results = calculate_saw_recommendations(mock_db, profile)

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 1: Satu outlier PBV 1500x tidak merusak 99 saham normal
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlierPBV:

    def test_99_saham_normal_tetap_punya_skor_layak(self):
        """
        Jika ada 1 saham dengan PBV 1500x, 99 saham normal harus tetap
        mendapat match_score > 0.05. Sebelum Task 1.2, skor mereka bisa
        mendekati 0.0001 karena normalisasi rusak.
        """
        stocks = [
            {"ticker": f"NORM{i:02d}", "roe": 15.0, "der": 1.0,
             "pbv": 20.0, "ai_score": 0.65}
            for i in range(99)
        ]
        # Tambah 1 outlier PBV ekstrem
        stocks.append(
            {"ticker": "OUTLIER", "roe": 15.0, "der": 1.0,
             "pbv": 1500.0, "ai_score": 0.65}
        )

        results = run_saw(stocks, profile_str="moderat")
        normal_results = [r for r in results if r.ticker != "OUTLIER"]

        assert len(normal_results) == 99, "Harus ada 99 saham normal di hasil"
        for r in normal_results:
            assert r.match_score > 0.05, (
                f"Saham {r.ticker} punya skor {r.match_score:.4f} — "
                f"terlalu rendah akibat outlier PBV 1500x"
            )

    def test_outlier_pbv_dapat_skor_lebih_rendah_dari_normal(self):
        """Saham dengan PBV 1500x harus ranking lebih rendah dari saham PBV normal."""
        stocks = [
            {"ticker": "NORMAL", "roe": 15.0, "der": 1.0, "pbv": 20.0,  "ai_score": 0.65},
            {"ticker": "OUTLIER","roe": 15.0, "der": 1.0, "pbv": 1500.0, "ai_score": 0.65},
        ]
        results = run_saw(stocks, profile_str="konservatif")
        scores = {r.ticker: r.match_score for r in results}

        assert scores["NORMAL"] > scores["OUTLIER"], (
            f"Saham normal (PBV 20x) harus ranking lebih tinggi dari outlier (PBV 1500x). "
            f"Normal={scores['NORMAL']:.4f}, Outlier={scores['OUTLIER']:.4f}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 2: ROE negatif dapat skor lebih rendah dari ROE positif
# ═══════════════════════════════════════════════════════════════════════════════

class TestROENegatif:

    def test_roe_negatif_dapat_skor_lebih_rendah_dari_roe_positif(self):
        """
        Saham dengan ROE -200% harus dapat skor ROE lebih rendah dari
        saham dengan ROE +15%. Sebelum Task 1.2, keduanya bisa dapat skor
        sama karena ROE negatif dipaksa ke 0.
        """
        stocks = [
            {"ticker": "PROFIT", "roe":  15.0, "der": 1.0, "pbv": 20.0, "ai_score": 0.65},
            {"ticker": "RUGI",   "roe": -200.0, "der": 1.0, "pbv": 20.0, "ai_score": 0.65},
        ]
        results = run_saw(stocks, profile_str="konservatif")
        scores = {r.ticker: r.match_score for r in results}

        assert scores["PROFIT"] > scores["RUGI"], (
            f"Saham profit (ROE 15%) harus ranking lebih tinggi dari saham rugi (ROE -200%). "
            f"PROFIT={scores['PROFIT']:.4f}, RUGI={scores['RUGI']:.4f}"
        )

    def test_roe_negatif_tidak_crash_sistem(self):
        """ROE negatif tidak boleh menyebabkan exception atau division by zero."""
        stocks = [
            {"ticker": "RUGI1", "roe": -50.0,  "der": 1.0, "pbv": 20.0, "ai_score": 0.5},
            {"ticker": "RUGI2", "roe": -200.0, "der": 2.0, "pbv": 30.0, "ai_score": 0.4},
            {"ticker": "RUGI3", "roe": -5.0,   "der": 0.5, "pbv": 15.0, "ai_score": 0.6},
        ]
        # Tidak boleh raise exception
        results = run_saw(stocks, profile_str="moderat")
        assert len(results) == 3
        for r in results:
            assert 0.0 <= r.match_score <= 1.0, (
                f"match_score harus dalam range [0,1], dapat: {r.match_score}"
            )


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 3: DER = 0 dapat skor sempurna
# ═══════════════════════════════════════════════════════════════════════════════

class TestDERNol:

    def test_der_nol_dapat_skor_der_sempurna(self):
        """
        Saham tanpa hutang (DER = 0) harus mendapat skor lebih tinggi dari
        saham dengan hutang besar (DER = 3.0).

        Catatan teknis SAW:
        Normalisasi Cost = min_der / der_capped. Jika hanya ada 2 saham dan
        salah satunya DER = 0 (dapat n_der = 1.0 via threshold), maka
        min_der diambil dari saham DER > 0. Agar perbedaan terlihat, kita
        butuh variasi DER yang cukup besar (0 vs 3.0) sehingga n_der saham
        berhutang besar jelas lebih rendah dari 1.0.
        """
        stocks = [
            {"ticker": "TANPAHUTANG", "roe": 15.0, "der": 0.0, "pbv": 20.0, "ai_score": 0.65},
            {"ticker": "HUTANG_KECIL","roe": 15.0, "der": 0.5, "pbv": 20.0, "ai_score": 0.65},
            {"ticker": "HUTANG_BESAR","roe": 15.0, "der": 3.0, "pbv": 20.0, "ai_score": 0.65},
        ]
        results = run_saw(stocks, profile_str="konservatif")
        scores = {r.ticker: r.match_score for r in results}

        # DER = 0 dan DER = 0.5 keduanya dapat n_der = 1.0 (threshold <= 0.1 tidak berlaku
        # untuk 0.5, tapi min_der = 0.5 sehingga n_der HUTANG_KECIL = 0.5/0.5 = 1.0)
        # Yang pasti: HUTANG_BESAR (DER 3.0) harus lebih rendah dari TANPAHUTANG (DER 0)
        assert scores["TANPAHUTANG"] >= scores["HUTANG_KECIL"], (
            f"Saham DER=0 harus >= saham DER=0.5. "
            f"TANPAHUTANG={scores['TANPAHUTANG']:.4f}, HUTANG_KECIL={scores['HUTANG_KECIL']:.4f}"
        )
        assert scores["HUTANG_KECIL"] > scores["HUTANG_BESAR"], (
            f"Saham DER=0.5 harus ranking lebih tinggi dari DER=3.0. "
            f"HUTANG_KECIL={scores['HUTANG_KECIL']:.4f}, HUTANG_BESAR={scores['HUTANG_BESAR']:.4f}"
        )

    def test_der_sangat_kecil_dianggap_sempurna(self):
        """DER 0.05 (hampir nol) harus dapat skor DER = 1.0 (threshold <= 0.1)."""
        stocks = [
            {"ticker": "HAMPIR_NOL", "roe": 15.0, "der": 0.05, "pbv": 20.0, "ai_score": 0.65},
            {"ticker": "NORMAL_DER", "roe": 15.0, "der": 1.5,  "pbv": 20.0, "ai_score": 0.65},
        ]
        results = run_saw(stocks, profile_str="konservatif")
        scores = {r.ticker: r.match_score for r in results}

        assert scores["HAMPIR_NOL"] > scores["NORMAL_DER"]


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 4: Semua saham ROE identik → tidak ada division by zero
# ═══════════════════════════════════════════════════════════════════════════════

class TestEdgeCaseDivisionByZero:

    def test_semua_roe_identik_tidak_crash(self):
        """
        Jika semua saham punya ROE yang sama persis, max_roe_shifted bisa = 0
        jika tidak ada guard. Harus tidak crash dan semua skor valid.
        """
        stocks = [
            {"ticker": f"SAME{i}", "roe": 10.0, "der": 1.0, "pbv": 20.0, "ai_score": 0.5 + i * 0.01}
            for i in range(5)
        ]
        results = run_saw(stocks, profile_str="moderat")
        assert len(results) == 5
        for r in results:
            assert 0.0 <= r.match_score <= 1.0

    def test_semua_roe_nol_tidak_crash(self):
        """ROE = 0 untuk semua saham tidak boleh menyebabkan division by zero."""
        stocks = [
            {"ticker": f"ZERO{i}", "roe": 0.0, "der": 1.0, "pbv": 20.0, "ai_score": 0.6}
            for i in range(3)
        ]
        results = run_saw(stocks, profile_str="moderat")
        assert len(results) == 3

    def test_semua_der_nol_tidak_crash(self):
        """DER = 0 untuk semua saham tidak boleh menyebabkan division by zero."""
        stocks = [
            {"ticker": f"NODBT{i}", "roe": 15.0, "der": 0.0, "pbv": 20.0, "ai_score": 0.6}
            for i in range(3)
        ]
        results = run_saw(stocks, profile_str="moderat")
        assert len(results) == 3


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 5: Semua ROE negatif → normalisasi tidak terbalik
# ═══════════════════════════════════════════════════════════════════════════════

class TestSemuaROENegatif:

    def test_semua_roe_negatif_normalisasi_tetap_valid(self):
        """
        Kondisi pasar crash: semua saham ROE negatif.
        Normalisasi harus tetap valid — saham dengan ROE paling tinggi
        (paling tidak rugi) harus tetap ranking lebih tinggi.
        """
        stocks = [
            {"ticker": "PALING_BAGUS", "roe": -2.0,  "der": 1.0, "pbv": 20.0, "ai_score": 0.65},
            {"ticker": "SEDANG",       "roe": -8.0,  "der": 1.0, "pbv": 20.0, "ai_score": 0.65},
            {"ticker": "PALING_BURUK", "roe": -10.0, "der": 1.0, "pbv": 20.0, "ai_score": 0.65},
        ]
        results = run_saw(stocks, profile_str="konservatif")
        scores = {r.ticker: r.match_score for r in results}

        assert scores["PALING_BAGUS"] > scores["SEDANG"] > scores["PALING_BURUK"], (
            f"Ranking ROE harus tetap benar meski semua negatif. "
            f"Scores: {scores}"
        )

    def test_semua_roe_negatif_skor_dalam_range_valid(self):
        """Semua skor harus tetap dalam range [0, 1] meski semua ROE negatif."""
        stocks = [
            {"ticker": f"NEG{i}", "roe": -float(i * 2 + 1), "der": 1.0,
             "pbv": 20.0, "ai_score": 0.5}
            for i in range(5)
        ]
        results = run_saw(stocks, profile_str="moderat")
        for r in results:
            assert 0.0 <= r.match_score <= 1.0, (
                f"{r.ticker} punya skor di luar range: {r.match_score}"
            )


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 6: ROE 5000% (anomali non-operasional) tidak merusak saham lain
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlierROE:

    def test_roe_5000_tidak_merusak_saham_normal(self):
        """
        Saham dengan ROE 5000% (misal: perusahaan jual aset besar sekali)
        tidak boleh membuat skor 99 saham normal mendekati 0.
        """
        stocks = [
            {"ticker": f"NORM{i:02d}", "roe": 15.0, "der": 1.0,
             "pbv": 20.0, "ai_score": 0.65}
            for i in range(10)
        ]
        stocks.append(
            {"ticker": "ROE_GILA", "roe": 5000.0, "der": 1.0,
             "pbv": 20.0, "ai_score": 0.65}
        )

        results = run_saw(stocks, profile_str="moderat")
        normal_results = [r for r in results if r.ticker != "ROE_GILA"]

        for r in normal_results:
            assert r.match_score > 0.1, (
                f"Saham {r.ticker} punya skor {r.match_score:.4f} — "
                f"terlalu rendah akibat outlier ROE 5000%"
            )


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 7: Profil berbeda → ranking berbeda untuk data yang sama
# ═══════════════════════════════════════════════════════════════════════════════

class TestProfilBerbedaRankingBerbeda:

    def test_agresif_prioritaskan_ai_score_tinggi(self):
        """
        Profil Agresif (bobot AI Score = 0.60) harus memprioritaskan saham
        dengan AI Score tinggi, meski fundamentalnya biasa saja.
        """
        stocks = [
            # AI Score tinggi, fundamental biasa
            {"ticker": "MOMENTUM", "roe": 10.0, "der": 2.0, "pbv": 30.0, "ai_score": 0.95},
            # AI Score rendah, fundamental bagus
            {"ticker": "FUNDAMENTAL", "roe": 35.0, "der": 0.3, "pbv": 8.0, "ai_score": 0.20},
        ]
        results_agresif = run_saw(stocks, profile_str="agresif")
        scores_agresif = {r.ticker: r.match_score for r in results_agresif}

        assert scores_agresif["MOMENTUM"] > scores_agresif["FUNDAMENTAL"], (
            f"Profil Agresif harus prioritaskan AI Score tinggi. "
            f"MOMENTUM={scores_agresif['MOMENTUM']:.4f}, "
            f"FUNDAMENTAL={scores_agresif['FUNDAMENTAL']:.4f}"
        )

    def test_konservatif_prioritaskan_fundamental_bagus(self):
        """
        Profil Konservatif (bobot ROE=0.45, DER=0.35) harus memprioritaskan
        saham dengan fundamental kuat, meski AI Score-nya rendah.
        """
        stocks = [
            # AI Score tinggi, fundamental biasa
            {"ticker": "MOMENTUM",    "roe": 10.0, "der": 2.0, "pbv": 30.0, "ai_score": 0.95},
            # AI Score rendah, fundamental bagus
            {"ticker": "FUNDAMENTAL", "roe": 35.0, "der": 0.3, "pbv": 8.0,  "ai_score": 0.20},
        ]
        results_konservatif = run_saw(stocks, profile_str="konservatif")
        scores_konservatif = {r.ticker: r.match_score for r in results_konservatif}

        assert scores_konservatif["FUNDAMENTAL"] > scores_konservatif["MOMENTUM"], (
            f"Profil Konservatif harus prioritaskan fundamental kuat. "
            f"FUNDAMENTAL={scores_konservatif['FUNDAMENTAL']:.4f}, "
            f"MOMENTUM={scores_konservatif['MOMENTUM']:.4f}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SKENARIO 8: Data None tidak crash sistem
# ═══════════════════════════════════════════════════════════════════════════════

class TestDataNone:

    def test_roe_none_tidak_crash(self):
        """Saham dengan ROE = None (data tidak tersedia) tidak boleh crash."""
        stocks = [
            {"ticker": "NO_ROE",  "roe": None,  "der": 1.0,  "pbv": 20.0, "ai_score": 0.6},
            {"ticker": "HAS_ROE", "roe": 15.0,  "der": 1.0,  "pbv": 20.0, "ai_score": 0.6},
        ]
        results = run_saw(stocks, profile_str="moderat")
        assert len(results) == 2
        for r in results:
            assert 0.0 <= r.match_score <= 1.0

    def test_semua_data_none_tidak_crash(self):
        """Saham dengan semua fundamental None tidak boleh crash sistem."""
        stocks = [
            {"ticker": "GHOST", "roe": None, "der": None, "pbv": None, "ai_score": 0.5},
        ]
        results = run_saw(stocks, profile_str="moderat")
        assert len(results) == 1
        assert 0.0 <= results[0].match_score <= 1.0

    def test_ui_tetap_dapat_nilai_asli_bukan_capped(self):
        """
        Nilai yang ditampilkan ke UI (roe, der, pbv di response) harus
        nilai mentah asli dari DB, bukan nilai yang sudah di-clamp.
        """
        stocks = [
            {"ticker": "EXTREME", "roe": 5000.0, "der": 50.0, "pbv": 1500.0, "ai_score": 0.5},
        ]
        results = run_saw(stocks, profile_str="moderat")
        r = results[0]

        # UI harus tampilkan nilai asli, bukan nilai yang di-clamp ke P95
        assert r.roe == 5000.0, f"ROE di UI harus 5000.0, dapat {r.roe}"
        assert r.der == 50.0,   f"DER di UI harus 50.0, dapat {r.der}"
        assert r.pbv == 1500.0, f"PBV di UI harus 1500.0, dapat {r.pbv}"
