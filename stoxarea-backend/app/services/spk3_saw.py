from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.stock import Stock
from app.models.user import RiskProfileEnum
from app.services.spk1_profiling import get_profile_weights
from intelligence_store.ai_scores import ai_store
from app.schemas.recommendation import RecommendationResponse, InsightItem

def calculate_saw_recommendations(db: Session, profile: RiskProfileEnum, target_sector: Optional[str] = None) -> List[RecommendationResponse]:
    """
    Menjalankan SPK Lapis 3 (Simple Additive Weighting).
    Menggabungkan Fundamental (ROE, DER, PER) dengan AI Momentum Score.
    Bisa difilter berdasarkan sektor spesifik.
    """
    # 1. Ambil bobot berdasarkan profil risiko user
    weights = get_profile_weights(profile)

    # 2. Ambil data saham dari DB (Fundamental)
    query = db.query(Stock)
    if target_sector:
        # Fitur filter sektoral
        query = query.filter(Stock.sector.ilike(f"%{target_sector}%"))
        
    stocks = query.all()
    if not stocks:
        return []

    # Filter saham yang juga ada di hasil ML (ai_scores.json)
    valid_stocks = []
    for s in stocks:
        ai_data = ai_store.get_score(s.ticker)
        # Pastikan data fundamental tidak None agar hitungan SAW tidak error
        if ai_data and s.roe is not None and s.der is not None and s.per is not None:
            valid_stocks.append({
                "ticker": s.ticker,
                "sector": s.sector or "Unknown",
                "ai_score": ai_data.get("ai_score", 0.0),
                "insights": ai_data.get("insights", []),
                "roe": s.roe,
                "der": s.der,
                "per": s.per
            })

    if not valid_stocks:
        return []

    # 3. Cari Nilai Max (Benefit) dan Min (Cost) untuk Normalisasi
    # Benefit: AI Score, ROE
    # Cost: DER, PER
    # 3. Cari Nilai Max (Benefit) dan Min (Cost) untuk Normalisasi dengan Capping (Outlier Removal)
    # Benefit: AI Score, ROE
    # Cost: DER, PER
    
    # Capping values to prevent outliers from distorting normalization
    # ROE > 50% dianggap sudah sangat bagus (capped di 50)
    # DER > 5 dianggap sangat berisiko (capped di 5)
    processed_stocks = []
    for item in valid_stocks:
        processed_stocks.append({
            **item,
            "roe_capped": min(50.0, max(0.0, item["roe"])),
            "der_capped": min(5.0, max(0.0, item["der"])),
            "per_capped": min(100.0, max(0.0, item["per"]))
        })

    max_ai  = max(item["ai_score"] for item in processed_stocks) or 1.0
    max_roe = max(item["roe_capped"] for item in processed_stocks) or 1.0
    
    # Untuk Cost, kita ambil nilai > 0 agar tidak devide-by-zero.
    min_der = min((item["der_capped"] for item in processed_stocks if item["der_capped"] > 0), default=0.5)
    min_per = min((item["per_capped"] for item in processed_stocks if item["per_capped"] > 0), default=5.0)

    # 4. Kalkulasi Normalisasi dan Nilai Akhir (SAW)
    results = []
    for s in processed_stocks:
        # --- Normalisasi ---
        # Benefit: V_i / V_max
        n_ai = s["ai_score"] / max_ai if max_ai > 0 else 0
        n_roe = s["roe_capped"] / max_roe if max_roe > 0 else 0
        
        # Cost: V_min / V_i
        if s["der_capped"] <= 0.1: # Hutang hampir nol dianggap sempurna
            n_der = 1.0
        else:
            n_der = min_der / s["der_capped"]
            
        n_per = 0 if s["per_capped"] <= 0 else (min_per / s["per_capped"])

        # Mencegah nilai abnormal > 1.0 akibat data ekstrem
        n_ai = min(1.0, max(0.0, n_ai))
        n_roe = min(1.0, max(0.0, n_roe))
        n_der = min(1.0, max(0.0, n_der))
        n_per = min(1.0, max(0.0, n_per))

        # --- Skor Akhir ---
        final_score = (
            (n_ai * weights["ai_score"]) +
            (n_roe * weights["roe"]) +
            (n_der * weights["der"]) +
            (n_per * weights["per"])
        )

        insights = [InsightItem(**i) for i in s["insights"]]
        
        results.append(
            RecommendationResponse(
                ticker=s["ticker"],
                sector=s["sector"],
                match_score=round(final_score, 4),
                match_score_percent=f"{final_score * 100:.1f}%",
                ai_score_percent=f"{s['ai_score'] * 100:.1f}%",
                insights=insights,
                roe=round(s["roe"], 2),
                der=round(s["der"], 2),
                per=round(s["per"], 2)
            )
        )

    # 5. Urutkan berdasarkan Match Score tertinggi
    results.sort(key=lambda x: x.match_score, reverse=True)
    return results
