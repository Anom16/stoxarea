from sqlalchemy import Column, String, Float, Integer, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base

class RiskProfile(Base):
    __tablename__ = "risk_profiles"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    min_score_threshold = Column(Integer, nullable=False, default=0)
    max_score_threshold = Column(Integer, nullable=False, default=30)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
