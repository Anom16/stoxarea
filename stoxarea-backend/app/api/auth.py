import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user_email
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, QuestionnaireInput, UpdateProfileRequest, UpdatePasswordRequest
from app.services.spk1_profiling import calculate_risk_profile
from app.core.questions import QUESTIONNAIRE_DATA
from app.models.risk_profile import RiskProfile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth & Profiling"])

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")  # Max 5 registration attempts per minute
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    """Register new user with rate limiting"""
    logger.info(f"Mencoba mendaftarkan user baru: {user_in.email}")
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        logger.warning(f"Registrasi GAGAL: Email {user_in.email} sudah ada di database!")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email, 
        password_hash=hashed_password,
        full_name=user_in.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login")
@limiter.limit("10/minute")  # Max 10 login attempts per minute
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login user with rate limiting to prevent brute force"""
    input_user = form_data.username.strip().lower()
    user = db.query(User).filter(
        (User.email == input_user) | (User.email.ilike(f"{input_user}@%"))
    ).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        logger.warning(f"Login GAGAL: Invalid credentials untuk {form_data.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.email})
    logger.info(f"Login SUCCESS: {user.email}")
    return {"access_token": access_token, "token_type": "bearer"}

class GoogleAuthInput(BaseModel):
    email: str
    full_name: str | None = None
    google_id: str | None = None

@router.post("/google")
def google_login(payload: GoogleAuthInput, db: Session = Depends(get_db)):
    """Authentication via Google 1-Click / OAuth"""
    email_clean = payload.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Email Google tidak valid.")

    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        name = payload.full_name or email_clean.split("@")[0].capitalize()
        hashed = get_password_hash("GoogleOAuthSecuredUser_2026")
        user = User(
            email=email_clean,
            password_hash=hashed,
            full_name=name,
            is_admin=False,
            virtual_balance=100000000.0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"[Google Auth] Pendaftaran akun baru via Google sukses: {email_clean}")
    else:
        logger.info(f"[Google Auth] Login akun existing via Google sukses: {email_clean}")

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    return user

@router.get("/questionnaire")
def get_questionnaire(db: Session = Depends(get_db)):
    """Mengembalikan daftar pertanyaan SPK Lapis 1 dari Database untuk di-render oleh Frontend."""
    from app.models.question import Question
    questions = db.query(Question).all()
    
    def get_num(q_id: str):
        try:
            return int(q_id[1:])
        except:
            return 999
            
    questions_sorted = sorted(questions, key=lambda x: get_num(x.id))
    
    data = []
    for q in questions_sorted:
        options_sorted = sorted(q.options, key=lambda o: o.value)
        data.append({
            "id": q.id,
            "category": q.category,
            "question": q.question,
            "options": [
                {"value": o.value, "text": o.text}
                for o in options_sorted
            ]
        })
    return {"data": data}

@router.post("/submit-profiling", response_model=UserResponse)
def submit_profiling(answers: QuestionnaireInput, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Hitung profil berdasarkan jawaban kuesioner + VETO
    profile = calculate_risk_profile(db, answers)
    
    user.risk_profile = profile
    db.commit()
    db.refresh(user)
    
    return user

@router.put("/profile", response_model=UserResponse)
def update_profile(
    risk_profile: str = Body(..., embed=True), 
    email: str = Depends(get_current_user_email), 
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.risk_profile = risk_profile.lower().strip() if risk_profile else "moderat"
    db.commit()
    db.refresh(user)
    return user


@router.put("/update-name", response_model=UserResponse)
def update_name(
    body: UpdateProfileRequest,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Update nama lengkap user."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.full_name = body.full_name
    db.commit()
    db.refresh(user)
    logger.info(f"Nama user {email} diperbarui menjadi: {body.full_name}")
    return user


@router.put("/update-password")
def update_password(
    body: UpdatePasswordRequest,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Update password user setelah verifikasi password lama."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verifikasi password lama
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="Kata sandi saat ini tidak sesuai."
        )

    # Pastikan password baru berbeda dari yang lama
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="Kata sandi baru tidak boleh sama dengan kata sandi lama."
        )

    user.password_hash = get_password_hash(body.new_password)
    db.commit()
    logger.info(f"Password user {email} berhasil diperbarui.")
    return {"message": "Kata sandi berhasil diperbarui."}

@router.get("/risk-profiles")
def get_public_risk_profiles(
    db: Session = Depends(get_db)
):
    """Mendapatkan daftar semua profil risiko untuk user biasa."""
    profiles = db.query(RiskProfile).order_by(RiskProfile.id).all()
    
    # Ambil bobot untuk semua profil secara dinamis
    from app.models.indicator import ProfileIndicatorWeight
    all_weights = db.query(ProfileIndicatorWeight).all()
    weights_map = {}
    for w in all_weights:
        if w.profile_id not in weights_map:
            weights_map[w.profile_id] = {}
        weights_map[w.profile_id][w.indicator_id] = w.weight

    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "weights": weights_map.get(p.id, {}),
            "min_score_threshold": p.min_score_threshold,
            "max_score_threshold": p.max_score_threshold,
        }
        for p in profiles
    ]
