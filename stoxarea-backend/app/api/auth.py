from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user_email
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, QuestionnaireInput
from app.services.spk1_profiling import calculate_risk_profile
from app.core.questions import QUESTIONNAIRE_DATA

router = APIRouter(prefix="/auth", tags=["Auth & Profiling"])

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_in.password)
    new_user = User(email=user_in.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    return user

@router.get("/questionnaire")
def get_questionnaire():
    """Mengembalikan daftar 10 pertanyaan SPK Lapis 1 untuk di-render oleh Frontend."""
    return {"data": QUESTIONNAIRE_DATA}

@router.post("/submit-profiling", response_model=UserResponse)
def submit_profiling(answers: QuestionnaireInput, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Hitung profil berdasarkan jawaban kuesioner + VETO
    profile = calculate_risk_profile(answers)
    
    user.risk_profile = profile
    db.commit()
    db.refresh(user)
    
    return user
