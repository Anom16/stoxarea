from sqlalchemy.orm import Session
from app.schemas.user import QuestionnaireInput
from app.services.veto_logic import apply_veto_logic
from app.models.risk_profile import RiskProfile

def calculate_risk_profile(db: Session, answers: QuestionnaireInput) -> str:
    """
    Menghitung profil risiko berdasarkan kuesioner SPK Lapis 1.
    Termasuk sistem VETO dana darurat.
    """
    
    # --- LOGIKA VETO ---
    if apply_veto_logic(answers):
        return "konservatif"

    # Total skor dari ke-6 kriteria utama + pertanyaan kustom tambahan
    per_score = answers.k6_valuasi_per if answers.k6_valuasi_per is not None else 3
    extra_sum = sum(answers.extra_answers.values()) if answers.extra_answers else 0
    total_score = (
        answers.k1_target_keuntungan +
        answers.k2_kualitas_perusahaan +
        answers.k3_toleransi_risiko +
        answers.k4_sensitivitas_harga +
        answers.k5_kapasitas_finansial +
        per_score +
        extra_sum
    )

    # Ambil profil dari database yang sesuai dengan score threshold
    profiles = db.query(RiskProfile).all()
    for p in profiles:
        if p.min_score_threshold <= total_score <= p.max_score_threshold:
            return p.id

    # Fallback default
    return "moderat"

from app.models.indicator import ProfileIndicatorWeight

def get_profile_weights(db: Session, profile_id: str) -> dict:
    """
    Menghasilkan vektor bobot kriteria untuk rumus SAW (SPK Lapis 3)
    berdasarkan profil risiko user dari database.
    """
    p_id = profile_id.lower().strip() if profile_id else "moderat"
    
    defaults = {
        "konservatif": {"ai_score": 0.10, "roe": 0.35, "der": 0.30, "pbv": 0.10, "per": 0.15},
        "moderat":     {"ai_score": 0.30, "roe": 0.25, "der": 0.15, "pbv": 0.15, "per": 0.15},
        "agresif":     {"ai_score": 0.50, "roe": 0.10, "der": 0.10, "pbv": 0.15, "per": 0.15},
    }

    try:
        weights = db.query(ProfileIndicatorWeight).filter(
            ProfileIndicatorWeight.profile_id == p_id
        ).all()
        
        if weights and hasattr(weights[0], "indicator_id") and isinstance(weights[0].indicator_id, str):
            return {w.indicator_id: float(w.weight) for w in weights}
    except Exception:
        pass
        
    return defaults.get(p_id, defaults["moderat"])
