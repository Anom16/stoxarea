from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StockBase(BaseModel):
    ticker: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    roe: Optional[float] = None
    der: Optional[float] = None
    per: Optional[float] = None

class StockResponse(StockBase):
    updated_at: datetime

    class Config:
        from_attributes = True
