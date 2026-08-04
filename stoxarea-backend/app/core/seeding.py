import logging
from sqlalchemy.orm import Session
from app.models.question import Question, QuestionOption
from app.core.questions import QUESTIONNAIRE_DATA

logger = logging.getLogger(__name__)

def seed_questionnaire(db: Session):
    """
    Seed dan sinkronkan kuesioner onboarding 12 pertanyaan ke database.
    """
    try:
        logger.info("Memulai sinkronisasi 12 kuesioner onboarding ke database...")
        for q_data in QUESTIONNAIRE_DATA:
            q_id = q_data["id"]
            existing_q = db.query(Question).filter(Question.id == q_id).first()
            if not existing_q:
                existing_q = Question(
                    id=q_id,
                    category=q_data["category"],
                    question=q_data["question"]
                )
                db.add(existing_q)
            else:
                existing_q.category = q_data["category"]
                existing_q.question = q_data["question"]
            
            db.flush()

            # Hapus opsi lama untuk pertanyaan ini dan masukkan opsi baru
            db.query(QuestionOption).filter(QuestionOption.question_id == q_id).delete()
            for opt in q_data["options"]:
                option = QuestionOption(
                    question_id=q_id,
                    value=opt["value"],
                    text=opt["text"]
                )
                db.add(option)
        
        db.commit()
        logger.info("Sinkronisasi 12 kuesioner onboarding selesai sukses!")
    except Exception as e:
        db.rollback()
        logger.error(f"Gagal melakukan sinkronisasi kuesioner: {str(e)}")
