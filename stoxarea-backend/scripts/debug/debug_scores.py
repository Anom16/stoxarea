"""Debug: distribusi probabilitas model XGBoost. Jalankan: python scripts/debug/debug_scores.py"""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
os.chdir(_ROOT)
sys.path.insert(0, str(_ROOT))

import pandas as pd
import joblib

model = joblib.load('models/xgb_model.pkl')
df = pd.read_csv('data/processed/features_targets.csv')
df['Date'] = pd.to_datetime(df['Date'])

FEATURE_COLS = ['log_ret_1d','log_ret_5d','ma_20_dist','ma_50_dist',
                'bb_width','bb_position','rsi_14','macd_norm',
                'macd_signal_norm','macd_hist_norm','vol_ma_ratio']

latest = df[df['is_latest']==True].dropna(subset=FEATURE_COLS)
X_all = latest[FEATURE_COLS]
probs = model.predict_proba(X_all)[:,1]
latest = latest.copy()
latest['prob'] = probs

print('=== TOP 20 RAW PROBABILITIES (from model) ===')
top = latest.nlargest(20, 'prob')[['ticker','prob'] + FEATURE_COLS]
for _, row in top.iterrows():
    print(f"{row['ticker']:12s} prob={row['prob']*100:.2f}%  rsi={row['rsi_14']:.1f}  "
          f"log1d={row['log_ret_1d']:.4f}  log5d={row['log_ret_5d']:.4f}  "
          f"bb_pos={row['bb_position']:.4f}  bb_w={row['bb_width']:.4f}")

print()
print('=== DISTRIBUTION ===')
bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01]
labels = ['0-10%','10-20%','20-30%','30-40%','40-50%','50-60%','60-70%','70-80%','80-90%','90-100%']
counts = pd.cut(latest['prob'], bins=bins, labels=labels).value_counts().sort_index()
for label, count in counts.items():
    print(f"  {label}: {count} saham")

print()
print('=== FEATURE IMPORTANCES ===')
fi = dict(zip(FEATURE_COLS, model.feature_importances_))
for f, v in sorted(fi.items(), key=lambda x: -x[1]):
    print(f'  {f:25s}: {v:.4f}')

print()
print('=== TRAINING DATA TARGET DISTRIBUTION ===')
train = df[~df['is_latest']].dropna(subset=['target_5d_up'])
pos = (train['target_5d_up'] == 1).sum()
neg = (train['target_5d_up'] == 0).sum()
print(f"  Naik (1): {pos} ({pos/(pos+neg)*100:.1f}%)")
print(f"  Turun(0): {neg} ({neg/(pos+neg)*100:.1f}%)")
print(f"  Total   : {len(train)}")
