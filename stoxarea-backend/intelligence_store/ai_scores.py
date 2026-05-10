import json
import logging
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIScoreStore:
    def __init__(self):
        self.scores = {}
        self._load_data()

    def _load_data(self):
        path = Path(settings.AI_SCORES_PATH)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    self.scores = json.load(f)
                logger.info(f"Berhasil memuat AI Scores untuk {len(self.scores)} emiten.")
            except Exception as e:
                logger.error(f"Gagal membaca AI Scores JSON: {e}")
        else:
            logger.warning(f"File AI Scores tidak ditemukan di {path}. Pastikan pipeline ML telah dijalankan.")

    def get_score(self, ticker: str) -> dict:
        """Mengambil data probabilitas dan insight SHAP untuk satu ticker."""
        return self.scores.get(ticker)

    def get_all_scores(self) -> dict:
        """Mengambil semua data skor."""
        return self.scores

# Singleton instance
ai_store = AIScoreStore()
