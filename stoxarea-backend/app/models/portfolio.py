from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticker = Column(String, index=True, nullable=False)
    qty = Column(Integer, nullable=False, default=0)
    avg_price = Column(Float, nullable=False, default=0.0)

    # Relasi
    user = relationship("User", back_populates="portfolios")
