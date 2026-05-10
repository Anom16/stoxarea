from pydantic import BaseModel
from typing import List, Optional

class InsightItem(BaseModel):
    feature: str
    contribution: float
    description: str

class RecommendationResponse(BaseModel):
    ticker: str
    sector: str
    match_score: float # Hasil perkalian vektor SAW (0.0 - 1.0)
    match_score_percent: str # Format string, misal: "92.5%"
    ai_score_percent: str # Probabilitas dari XGBoost, misal: "66.5%"
    insights: List[InsightItem]
    
    # Fundamental data pendukung (opsional ditampilkan di UI)
    roe: Optional[float] = None
    der: Optional[float] = None
    per: Optional[float] = None
