from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.core.security import require_admin
from app.models.question import Question, QuestionOption

router = APIRouter(prefix="/admin/users/questions", tags=["Admin - Questionnaire Management"])

# Schemas
class OptionUpdateSchema(BaseModel):
    value: int
    text: str

class QuestionUpdateSchema(BaseModel):
    question: str
    options: List[OptionUpdateSchema]

@router.get("/")
def list_questions(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Mengambil daftar seluruh pertanyaan kuesioner berserta pilihan jawabannya."""
    questions = db.query(Question).all()
    
    def get_num(q_id: str):
        try:
            return int(q_id[1:])
        except:
            return 999
            
    questions_sorted = sorted(questions, key=lambda x: get_num(x.id))
    
    res = []
    for q in questions_sorted:
        options_sorted = sorted(q.options, key=lambda o: o.value)
        res.append({
            "id": q.id,
            "category": q.category,
            "question": q.question,
            "options": [
                {"value": o.value, "text": o.text}
                for o in options_sorted
            ]
        })
    return res

@router.put("/{question_id}")
def update_question(
    question_id: str,
    body: QuestionUpdateSchema,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Memperbarui teks pertanyaan dan opsi pilihan jawaban beserta nilainya."""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Pertanyaan tidak ditemukan.")

    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Teks pertanyaan tidak boleh kosong.")

    # Update question text
    question.question = body.question.strip()

    # Update options (we expect exactly 3 options for the profiling logic)
    if len(body.options) != 3:
        raise HTTPException(status_code=400, detail="Pilihan jawaban harus berjumlah tepat 3 opsi.")

    # Delete old options
    db.query(QuestionOption).filter(QuestionOption.question_id == question_id).delete()
    
    # Add new options
    for opt in body.options:
        if opt.value not in {1, 3, 5}:
            raise HTTPException(status_code=400, detail="Nilai bobot opsi harus bernilai 1, 3, atau 5.")
        if not opt.text.strip():
            raise HTTPException(status_code=400, detail="Teks opsi tidak boleh kosong.")
            
        db_option = QuestionOption(
            question_id=question_id,
            value=opt.value,
            text=opt.text.strip()
        )
        db.add(db_option)
        
    db.commit()
    db.refresh(question)
    
    options_sorted = sorted(question.options, key=lambda o: o.value)
    return {
        "message": f"Pertanyaan {question_id} berhasil diperbarui.",
        "question": {
            "id": question.id,
            "category": question.category,
            "question": question.question,
            "options": [
                {"value": o.value, "text": o.text}
                for o in options_sorted
            ]
        }
    }
