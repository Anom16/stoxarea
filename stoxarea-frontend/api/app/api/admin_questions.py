from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.core.security import require_admin
from app.models.question import Question, QuestionOption

router = APIRouter(prefix="/admin/users/questions", tags=["Admin - Questionnaire Management"])

VALID_CATEGORIES = {
    "k1_target_keuntungan",
    "k2_kualitas_perusahaan",
    "k3_toleransi_risiko",
    "k4_sensitivitas_harga",
    "k5_kapasitas_finansial"
}

# Schemas
class OptionUpdateSchema(BaseModel):
    value: int
    text: str

class QuestionUpdateSchema(BaseModel):
    question: str
    options: List[OptionUpdateSchema]

class QuestionCreateSchema(BaseModel):
    category: str
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


@router.post("/", response_model=dict)
def create_question(
    body: QuestionCreateSchema,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Membuat pertanyaan kuesioner baru beserta 3 pilihan jawabannya."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Kategori tidak valid. Harus salah satu dari: {', '.join(VALID_CATEGORIES)}")

    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Teks pertanyaan tidak boleh kosong.")

    if len(body.options) != 3:
        raise HTTPException(status_code=400, detail="Pilihan jawaban harus berjumlah tepat 3 opsi.")

    # Auto-generate next question ID: q1, q2, ...
    questions = db.query(Question).all()
    max_num = 0
    for q in questions:
        try:
            if q.id.startswith('q'):
                num = int(q.id[1:])
                if num > max_num:
                    max_num = num
        except ValueError:
            pass
            
    new_id = f"q{max_num + 1}"

    # Create new question
    new_q = Question(
        id=new_id,
        category=body.category,
        question=body.question.strip()
    )
    db.add(new_q)

    # Add options
    for opt in body.options:
        if not opt.text.strip():
            raise HTTPException(status_code=400, detail="Teks opsi tidak boleh kosong.")
            
        db_option = QuestionOption(
            question_id=new_id,
            value=opt.value,
            text=opt.text.strip()
        )
        db.add(db_option)

    db.commit()
    db.refresh(new_q)

    options_sorted = sorted(new_q.options, key=lambda o: o.value)
    return {
        "message": f"Pertanyaan {new_id} berhasil dibuat.",
        "question": {
            "id": new_q.id,
            "category": new_q.category,
            "question": new_q.question,
            "options": [
                {"value": o.value, "text": o.text}
                for o in options_sorted
            ]
        }
    }


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


@router.delete("/{question_id}")
def delete_question(
    question_id: str,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Menghapus pertanyaan beserta opsi jawabannya dari database."""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Pertanyaan tidak ditemukan.")

    db.delete(question)
    db.commit()
    return {"message": f"Pertanyaan {question_id} berhasil dihapus."}
