from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, Boolean
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
    full_name = Column(String, nullable=True)
    risk_profile = Column(String(50), nullable=True)
    virtual_balance = Column(Float, default=100000000.0)
    is_admin = Column(Boolean, default=False, nullable=False)  # Flag admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relasi
    portfolios = relationship("Portfolio", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
