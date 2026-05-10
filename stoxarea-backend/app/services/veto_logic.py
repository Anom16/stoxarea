from app.schemas.user import QuestionnaireInput

def apply_veto_logic(answers: QuestionnaireInput) -> bool:
    """
    Logika VETO Keamanan Finansial.
    Mengembalikan True jika user terdeteksi menggunakan dana darurat/uang dapur.
    """
    # K5 = 1 berarti dana yang dipakai adalah dana darurat/kebutuhan pokok
    if answers.k5_kapasitas_finansial == 1:
        return True
    return False
