from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.core.database import Base


class CorporateActionFlag(Base):
    """
    Tabel untuk menandai saham yang terdeteksi mengalami pergerakan harga ekstrem
    (>35% dalam sehari) yang bisa jadi stock split, reverse split, atau ARB/ARA.

    Pipeline ML akan SKIP saham ini sampai admin memvalidasi.
    Portofolio virtual yang memegang saham ini akan dibekukan sementara.
    """
    __tablename__ = "corporate_action_flags"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True, nullable=False)

    # Data pergerakan yang memicu flag
    prev_close = Column(Float, nullable=True)       # harga penutupan hari sebelumnya
    curr_close = Column(Float, nullable=True)       # harga penutupan hari ini
    change_pct = Column(Float, nullable=True)       # persentase perubahan (bisa negatif)

    # Status validasi admin
    is_resolved = Column(Boolean, default=False)    # True jika sudah divalidasi admin
    action_type = Column(String, nullable=True)     # "stock_split", "reverse_split", "normal_drop", dll
    split_ratio = Column(Float, nullable=True)      # misal: 5.0 untuk split 1:5
    admin_notes = Column(Text, nullable=True)       # catatan admin

    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
