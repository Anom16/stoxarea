from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class RiskProfileEnum(str, enum.Enum):
    konservatif = "Konservatif"
    moderat = "Moderat"
    agresif = "Agresif"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    risk_profile = Column(Enum(RiskProfileEnum), nullable=True) # Akan diset setelah isi kuesioner SPK Lapis 1
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relasi
    portfolios = relationship("Portfolio", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
