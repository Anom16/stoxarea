"""Debug: cek bobot profil & data SAW untuk ticker tertentu. Jalankan: python scripts/debug/check_match.py"""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
os.chdir(_ROOT)
sys.path.insert(0, str(_ROOT))

from app.core.database import SessionLocal
from app.services.spk1_profiling import get_profile_weights
from app.models.user import RiskProfileEnum
from app.services.spk2_scoring import get_qualified_stocks_for_saw

print('=== KONS ===')
print(get_profile_weights(RiskProfileEnum.konservatif))
print('=== MOD ===')
print(get_profile_weights(RiskProfileEnum.moderat))

db = SessionLocal()
stocks = get_qualified_stocks_for_saw(db)
for s in stocks:
    if s['ticker'] in ['SIDO.JK', 'SIDO', 'LSIP.JK', 'LSIP']:
        print(f"\n--- {s['ticker']} ---")
        print(f"AI Score : {s['ai_score']}")
        print(f"ROE Clean: {s['roe_clean']} (Raw: {s['roe_raw']})")
        print(f"DER Clean: {s['der_clean']} (Raw: {s['der_raw']})")
        print(f"PBV Clean: {s['pbv_clean']} (Raw: {s['pbv_raw']})")
