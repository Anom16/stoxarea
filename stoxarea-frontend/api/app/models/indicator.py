from sqlalchemy import Column, String, Float, DateTime, Text, PrimaryKeyConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False) # 'benefit' | 'cost'
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProfileIndicatorWeight(Base):
    __tablename__ = "profile_indicator_weights"

    profile_id = Column(String(50), nullable=False)
    indicator_id = Column(String(50), nullable=False)
    weight = Column(Float, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint('profile_id', 'indicator_id'),
    )


class StockIndicatorValue(Base):
    __tablename__ = "stock_indicator_values"

    ticker = Column(String(20), nullable=False)
    indicator_id = Column(String(50), nullable=False)
    value = Column(Float, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint('ticker', 'indicator_id'),
    )


class StockProfileMapping(Base):
    __tablename__ = "stock_profile_mappings"

    ticker = Column(String(20), nullable=False)
    profile_id = Column(String(50), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint('ticker', 'profile_id'),
    )
