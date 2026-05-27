from app.schemas.user import QuestionnaireInput
from app.models.user import RiskProfileEnum
from app.services.veto_logic import apply_veto_logic

def calculate_risk_profile(answers: QuestionnaireInput) -> RiskProfileEnum:
    """
    Menghitung profil risiko berdasarkan kuesioner SPK Lapis 1.
    Termasuk sistem VETO dana darurat.
    """
    
    # --- LOGIKA VETO ---
    if apply_veto_logic(answers):
        return RiskProfileEnum.konservatif

    # Total skor dari ke-5 kriteria
    total_score = (
        answers.k1_target_keuntungan +
        answers.k2_kualitas_perusahaan +
        answers.k3_toleransi_risiko +
        answers.k4_sensitivitas_harga +
        answers.k5_kapasitas_finansial
    )

    # Menentukan rentang
    # Asumsi setiap K bernilai 1, 3, atau 5. Min = 5, Max = 25
    if total_score < 12:
        return RiskProfileEnum.konservatif
    elif total_score <= 18:
        return RiskProfileEnum.moderat
    else:
        return RiskProfileEnum.agresif

def get_profile_weights(profile: RiskProfileEnum) -> dict:
    """
    Menghasilkan vektor bobot kriteria untuk rumus SAW (SPK Lapis 3)
    berdasarkan profil risiko user.
    Semakin agresif, bobot AI Momentum makin tinggi.
    Semakin konservatif, bobot Fundamental (ROE, DER) makin tinggi.
    """
    if profile == RiskProfileEnum.konservatif:
        return {
            "ai_score": 0.10, 
            "roe": 0.45,      
            "der": 0.35,      
            "pbv": 0.10       
        }
    elif profile == RiskProfileEnum.moderat:
        return {
            "ai_score": 0.35, 
            "roe": 0.30,      
            "der": 0.15,      
            "pbv": 0.20       
        }
    elif profile == RiskProfileEnum.agresif:
        return {
            "ai_score": 0.60, 
            "roe": 0.10,      
            "der": 0.10,      
            "pbv": 0.20       
        }
    
    # Default fallback
    return {"ai_score": 0.25, "roe": 0.25, "der": 0.25, "pbv": 0.25}
