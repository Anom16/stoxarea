from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from app.core.database import Base

class FinancialHistory(Base):
    __tablename__ = "financial_history"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    year = Column(String)
    
    # Income Statement
    revenue = Column(Float, default=0)
    net_income = Column(Float, default=0)
    
    # Balance Sheet
    assets = Column(Float, default=0)
    liabilities = Column(Float, default=0)
    equity = Column(Float, default=0)

    # Constraint agar tidak ada duplikasi data ticker + tahun
    __table_args__ = (UniqueConstraint('ticker', 'year', name='_ticker_year_uc'),)
