import logging
from sqlalchemy.orm import Session
from app.models.question import Question, QuestionOption
from app.core.questions import QUESTIONNAIRE_DATA

logger = logging.getLogger(__name__)

def seed_questionnaire(db: Session):
    """
    Seed kuesioner default ke database jika tabel questions kosong.
    """
    try:
        count = db.query(Question).count()
        if count > 0:
            logger.info("Database kuesioner sudah terisi. Melewati seeding.")
            return

        logger.info("Memulai seeding kuesioner onboarding ke database...")
        for q_data in QUESTIONNAIRE_DATA:
            question = Question(
                id=q_data["id"],
                category=q_data["category"],
                question=q_data["question"]
            )
            db.add(question)
            
            # Tambahkan opsi jawaban
            for opt in q_data["options"]:
                option = QuestionOption(
                    question_id=q_data["id"],
                    value=opt["value"],
                    text=opt["text"]
                )
                db.add(option)
        
        db.commit()
        logger.info("Seeding kuesioner onboarding selesai sukses!")
    except Exception as e:
        db.rollback()
        logger.error(f"Gagal melakukan seeding kuesioner: {str(e)}")
