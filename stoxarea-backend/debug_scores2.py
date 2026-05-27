import pandas as pd
import numpy as np
import joblib

model = joblib.load('models/xgb_model.pkl')
df = pd.read_csv('data/processed/features_targets.csv')
df['Date'] = pd.to_datetime(df['Date'])

FEATURE_COLS = ['log_ret_1d','log_ret_5d','ma_20_dist','ma_50_dist',
                'bb_width','bb_position','rsi_14','macd_norm',
                'macd_signal_norm','macd_hist_norm','vol_ma_ratio']

# === 1. Training Target Distribution ===
train = df[~df['is_latest']].dropna(subset=['target_5d_up'])
pos = int((train['target_5d_up'] == 1).sum())
neg = int((train['target_5d_up'] == 0).sum())
print('=== TRAINING TARGET DISTRIBUTION ===')
print(f"  Naik >5% (1): {pos} ({pos/(pos+neg)*100:.1f}%)")
print(f"  Tidak   (0) : {neg} ({neg/(pos+neg)*100:.1f}%)")
print(f"  Total       : {pos+neg}")
print(f"  scale_pos_weight used: {neg/pos:.2f}")

# === 2. Calibration Check - predict on training data ===
X_train = train[FEATURE_COLS].dropna()
y_train = train.loc[X_train.index, 'target_5d_up']
probs_train = model.predict_proba(X_train)[:,1]

print(f"\n=== CALIBRATION ON TRAINING DATA ===")
bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01]
labels = ['0-10%','10-20%','20-30%','30-40%','40-50%','50-60%','60-70%','70-80%','80-90%','90-100%']
binned = pd.cut(probs_train, bins=bins, labels=labels)
for label in labels:
    mask = binned == label
    count = mask.sum()
    if count > 0:
        actual_rate = y_train[mask].mean() * 100
        print(f"  Predicted {label}: {count:5d} samples, actual positive rate = {actual_rate:.1f}%")
    else:
        print(f"  Predicted {label}: {count:5d} samples")

# === 3. Verify target with specific ASII example ===
print(f"\n=== ASII.JK TARGET VERIFICATION ===")
asii = df[df['ticker']=='ASII.JK'].sort_values('Date')
print(f"  Last 10 training rows target:")
asii_train = asii[~asii['is_latest']].tail(10)
for _, row in asii_train.iterrows():
    print(f"    {row['Date'].strftime('%Y-%m-%d')}  Close={row['Close']:.0f}  target={row['target_5d_up']}")

# === 4. Check if model is CalibratedClassifierCV ===
print(f"\n=== MODEL TYPE ===")
print(f"  Type: {type(model).__name__}")
if hasattr(model, 'calibrated_classifiers_'):
    print(f"  Num calibrated estimators: {len(model.calibrated_classifiers_)}")
    first = model.calibrated_classifiers_[0].estimator
    fi = dict(zip(FEATURE_COLS, first.feature_importances_))
    print(f"\n=== FEATURE IMPORTANCES (estimator #1) ===")
    for f, v in sorted(fi.items(), key=lambda x: -x[1]):
        print(f"  {f:25s}: {v:.4f}")
