from app.schemas.user import QuestionnaireInput

def apply_veto_logic(answers: QuestionnaireInput) -> bool:
    """
    Logika VETO Keamanan Finansial.

    FIX #5: Perluas kondisi veto — ada dua jawaban K5 yang berbahaya:
      - K5 = 1 (nilai rendah): dana yang dipakai adalah dana darurat/kebutuhan pokok
        → Langsung veto, investasi dengan dana darurat sangat berisiko.
      - K5 = 1 dari pertanyaan ke-10 (porsi kekayaan): hampir seluruh tabungan di saham
        → Ini juga kondisi berbahaya yang harus memicu profil Konservatif.

    Karena frontend menggabungkan 2 jawaban K5 menjadi 1 nilai (rata-rata atau minimum),
    kita gunakan threshold: jika nilai K5 <= 1, artinya setidaknya satu jawaban K5
    menunjukkan kondisi keuangan yang tidak aman untuk investasi agresif.

    Mengembalikan True jika user terdeteksi dalam kondisi finansial berisiko tinggi.
    """
    # Kondisi 1: Dana yang dipakai adalah dana darurat (K5 = 1 dari pertanyaan sumber dana)
    # Kondisi 2: Hampir seluruh kekayaan ada di saham (K5 = 1 dari pertanyaan porsi kekayaan)
    # Karena K5 adalah agregat dari 2 pertanyaan, nilai 1 berarti minimal satu kondisi berbahaya terpenuhi.
    if answers.k5_kapasitas_finansial == 1:
        return True

    # Kondisi tambahan: Jika K5 = 3 tapi K3 (toleransi risiko) juga = 1,
    # artinya user tidak tahan rugi tapi masih pakai dana yang cukup penting.
    # Ini edge case yang perlu perlindungan ekstra → tetap veto ke Konservatif.
    if answers.k5_kapasitas_finansial == 3 and answers.k3_toleransi_risiko == 1:
        return True

    return False
