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

    # Total skor dari ke-5 kriteria
    total_score = (
        answers.k1_target_keuntungan +
        answers.k2_kualitas_perusahaan +
        answers.k3_toleransi_risiko +
        answers.k4_sensitivitas_harga +
        answers.k5_kapasitas_finansial
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
    # Bersihkan input/id profile
    p_id = profile_id.lower().strip() if profile_id else "moderat"
    
    weights = db.query(ProfileIndicatorWeight).filter(
        ProfileIndicatorWeight.profile_id == p_id
    ).all()
    
    if weights:
        return {w.indicator_id: w.weight for w in weights}
    
    # Fallback default (5 indikator sama rata)
    return {"ai_score": 0.20, "roe": 0.20, "der": 0.20, "pbv": 0.20, "per": 0.20}
