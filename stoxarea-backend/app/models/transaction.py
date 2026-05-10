from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class TransactionTypeEnum(str, enum.Enum):
    buy = "BUY"
    sell = "SELL"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticker = Column(String, index=True, nullable=False)
    type = Column(Enum(TransactionTypeEnum), nullable=False)
    price = Column(Float, nullable=False)
    qty = Column(Integer, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relasi
    user = relationship("User", back_populates="transactions")
