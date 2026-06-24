"""Debug: analisis SIDO & LSIP. Jalankan: python scripts/debug/check_sido_lsip.py"""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
os.chdir(_ROOT)
sys.path.insert(0, str(_ROOT))

import json
import pandas as pd

df = pd.read_csv('data/processed/features_targets.csv')
with open('data/processed/ai_scores.json') as f:
    scores = json.load(f)

for t in ['SIDO.JK', 'LSIP.JK']:
    print(f'=== Analisis {t} ===')
    if t in scores:
        print(f"AI Score: {scores[t]['ai_score_percent']}")
        for insight in scores[t]['insights']:
            print(f" - {insight['feature']}: {insight['contribution']:.4f} ({insight['description']})")
    else:
        print('Tidak ada di ai_scores.json')

    ticker_df = df[df['ticker'] == t].tail(5)
    print('\nFitur Terbaru (5 Hari Terakhir):')
    cols = ['Date', 'Close', 'log_ret_5d', 'ma_20_dist', 'ma_50_dist', 'bb_position', 'rsi_14', 'macd_norm']
    print(ticker_df[cols].to_string(index=False))
    print('\n')
