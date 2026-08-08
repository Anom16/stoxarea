from sqlalchemy.orm import Session
from app.schemas.user import QuestionnaireInput
from app.services.veto_logic import apply_veto_logic
from app.models.risk_profile import RiskProfile
from app.models.question import Question, QuestionOption
import logging

logger = logging.getLogger(__name__)

def calculate_risk_profile(db: Session, answers: QuestionnaireInput) -> str:
    """
    Menghitung profil risiko berdasarkan kuesioner SPK Lapis 1.
    
    Menggunakan Formula Normalisasi Terstandar Min-Max (0% - 100%):
    Score Pct = (Total User Score - Min Possible Score) / (Max Possible Score - Min Possible Score) * 100%
    
    Termasuk sistem VETO dana darurat.
    """
    
    # 1. Logika VETO Dana Darurat
    if apply_veto_logic(answers):
        logger.info("[Profiling] Trigger VETO Dana Darurat -> Profile: konservatif")
        return "konservatif"

    # 2. Hitung total skor mentah dari jawaban user
    per_score = answers.k6_valuasi_per if answers.k6_valuasi_per is not None else 3
    extra_sum = sum(answers.extra_answers.values()) if answers.extra_answers else 0
    raw_user_score = (
        answers.k1_target_keuntungan +
        answers.k2_kualitas_perusahaan +
        answers.k3_toleransi_risiko +
        answers.k4_sensitivitas_harga +
        answers.k5_kapasitas_finansial +
        per_score +
        extra_sum
    )

    # 3. Hitung Min Possible Score & Max Possible Score dari seluruh pertanyaan aktif di DB
    db_questions = db.query(Question).all()
    min_possible = 0
    max_possible = 0

    if db_questions:
        for q in db_questions:
            if q.options:
                vals = [o.value for o in q.options]
                min_possible += min(vals)
                max_possible += max(vals)
            else:
                min_possible += 1
                max_possible += 5
    else:
        # Fallback default 6 pertanyaan dasar (skor 1 s.d 5 per pertanyaan)
        min_possible = 6 * 1
        max_possible = 6 * 5

    # 4. Hitung Normalized Percentage (0.0% s.d 100.0%)
    if max_possible > min_possible:
        normalized_score_pct = ((raw_user_score - min_possible) / (max_possible - min_possible)) * 100.0
    else:
        normalized_score_pct = 50.0

    normalized_score_pct = max(0.0, min(100.0, normalized_score_pct))
    logger.info(f"[Profiling] Raw Score: {raw_user_score} (Min: {min_possible}, Max: {max_possible}) -> Normalized Pct: {normalized_score_pct:.1f}%")

    # 5. Mencocokkan persentase ke RiskProfile di database
    profiles = db.query(RiskProfile).all()
    for p in profiles:
        # Dukungan ganda: Threshold persentase (0-100) atau threshold skor mentah
        min_th = float(p.min_score_threshold)
        max_th = float(p.max_score_threshold)

        # Jika threshold diset dalam persentase (0-100)
        if max_th <= 100.0 and min_th >= 0.0:
            if min_th <= normalized_score_pct <= max_th:
                return p.id
        else:
            # Fallback jika diset dalam skor mentah lama
            if min_th <= raw_user_score <= max_th:
                return p.id

    # Fallback default berdasarkan persentase
    if normalized_score_pct <= 35.0:
        return "konservatif"
    elif normalized_score_pct <= 70.0:
        return "moderat"
    else:
        return "agresif"


from app.models.indicator import ProfileIndicatorWeight

def get_profile_weights(db: Session, profile_id: str) -> dict:
    """
    Menghasilkan vektor bobot kriteria untuk rumus SAW (SPK Lapis 3)
    berdasarkan profil risiko user dari database.
    """
    p_id = profile_id.lower().strip() if profile_id else "moderat"
    
    defaults = {
        "konservatif": {"ai_score": 0.10, "roe": 0.15, "der": 0.15, "pbv": 0.15, "per": 0.15, "sortino": 0.30},
        "moderat":     {"ai_score": 0.25, "roe": 0.20, "der": 0.15, "pbv": 0.10, "per": 0.10, "sortino": 0.20},
        "agresif":     {"ai_score": 0.45, "roe": 0.20, "der": 0.10, "pbv": 0.075, "per": 0.075, "sortino": 0.10},
    }

    try:
        weights = db.query(ProfileIndicatorWeight).filter(
            ProfileIndicatorWeight.profile_id == p_id
        ).all()
        
        if weights and hasattr(weights[0], "indicator_id") and isinstance(weights[0].indicator_id, str):
            res = {w.indicator_id: float(w.weight) for w in weights}
            total_sum = sum(res.values())
            if total_sum > 0:
                return {k: round(v / total_sum, 4) for k, v in res.items()}
    except Exception:
        pass
        
    return defaults.get(p_id, defaults["moderat"])
