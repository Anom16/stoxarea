from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class Stock(Base):
    __tablename__ = "stocks"

    ticker = Column(String, primary_key=True, index=True)
    sector = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    
    # Metrik Fundamental (diambil saat batch data pipeline)
    roe = Column(Float, nullable=True)
    der = Column(Float, nullable=True)
    per = Column(Float, nullable=True)

    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
