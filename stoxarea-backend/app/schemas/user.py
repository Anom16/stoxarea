from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import RiskProfileEnum

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    risk_profile: Optional[RiskProfileEnum] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Schema untuk Input Kuesioner Profiling (SPK Lapis 1)
# K1-K5 direpresentasikan sebagai integer (skor 1, 3, atau 5)
class QuestionnaireInput(BaseModel):
    k1_target_keuntungan: int
    k2_kualitas_perusahaan: int
    k3_toleransi_risiko: int
    k4_sensitivitas_harga: int
    k5_kapasitas_finansial: int # Veto logic: Jika 1, maka otomatis Konservatif
