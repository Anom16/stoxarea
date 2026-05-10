from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user_email
from app.models.user import User
from app.schemas.recommendation import RecommendationResponse
from app.services.spk3_saw import calculate_saw_recommendations

router = APIRouter(prefix="/recommendation", tags=["Recommendation (SPK Lapis 3)"])

@router.get("/top-picks", response_model=List[RecommendationResponse])
def get_top_picks(
    sector: Optional[str] = Query(None, description="Filter berdasarkan nama sektor (contoh: Keuangan, Energi)"),
    email: str = Depends(get_current_user_email), 
    db: Session = Depends(get_db)
):
    """
    Menghasilkan rekomendasi saham personal menggunakan SPK Lapis 3 (SAW).
    Bergantung pada hasil kuesioner SPK Lapis 1 (Profil Risiko).
    Bisa difilter spesifik per sektor.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not user.risk_profile:
        raise HTTPException(
            status_code=400, 
            detail="Silakan selesaikan kuesioner profil risiko terlebih dahulu."
        )
        
    # Panggil Service SPK Lapis 3 dengan opsi sektor
    recommendations = calculate_saw_recommendations(db, user.risk_profile, sector)
    
    # Return Top 10
    return recommendations[:10]
