from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from app.models.user import RiskProfileEnum

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    full_name: Optional[str] = None

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    full_name: Optional[str] = None
    risk_profile: Optional[RiskProfileEnum] = None
    virtual_balance: float
    created_at: datetime

    class Config:
        from_attributes = True

# Schema update nama lengkap
class UpdateProfileRequest(BaseModel):
    full_name: str

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nama lengkap tidak boleh kosong.")
        if len(v) < 2:
            raise ValueError("Nama lengkap minimal 2 karakter.")
        return v

# Schema update password
class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Kata sandi baru minimal 8 karakter.")
        return v

# Schema untuk Input Kuesioner Profiling (SPK Lapis 1)
_VALID_SCORES = {1, 3, 5}

def _validate_score(field_name: str, v: int) -> int:
    if v not in _VALID_SCORES:
        raise ValueError(
            f"{field_name} harus bernilai 1, 3, atau 5. Nilai '{v}' tidak valid."
        )
    return v

class QuestionnaireInput(BaseModel):
    k1_target_keuntungan: int
    k2_kualitas_perusahaan: int
    k3_toleransi_risiko: int
    k4_sensitivitas_harga: int
    k5_kapasitas_finansial: int

    @field_validator("k1_target_keuntungan")
    @classmethod
    def validate_k1(cls, v: int) -> int:
        return _validate_score("k1_target_keuntungan", v)

    @field_validator("k2_kualitas_perusahaan")
    @classmethod
    def validate_k2(cls, v: int) -> int:
        return _validate_score("k2_kualitas_perusahaan", v)

    @field_validator("k3_toleransi_risiko")
    @classmethod
    def validate_k3(cls, v: int) -> int:
        return _validate_score("k3_toleransi_risiko", v)

    @field_validator("k4_sensitivitas_harga")
    @classmethod
    def validate_k4(cls, v: int) -> int:
        return _validate_score("k4_sensitivitas_harga", v)

    @field_validator("k5_kapasitas_finansial")
    @classmethod
    def validate_k5(cls, v: int) -> int:
        return _validate_score("k5_kapasitas_finansial", v)
