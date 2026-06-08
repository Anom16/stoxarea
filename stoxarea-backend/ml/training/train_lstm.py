"""
ml/training/train_lstm.py
-------------------------
Membangun dan melatih model LSTM menggunakan PyTorch.
"""

import pandas as pd
import numpy as np
import logging
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import StandardScaler
import joblib

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

INPUT_PATH = Path("data/processed/features_targets.csv")
MODEL_DIR = Path("models")
MODEL_PATH = MODEL_DIR / "lstm_model.pth"
SCALER_PATH = MODEL_DIR / "lstm_scaler.pkl"

# Tambahkan fitur baru ke dalam daftar
FEATURES = [
    "log_ret_1d", "log_ret_5d", "log_ret_14d", "log_ret_30d", 
    "ma_20_dist", "ma_50_dist", "bb_width", "bb_position", 
    "rsi_14", "rsi_zscore", "macd_norm", "macd_signal_norm", 
    "macd_hist_norm", "macd_hist_zscore", "vol_ma_ratio",
    "atr_norm", "is_doji", "is_hammer", "is_bullish_engulfing"
]
TARGET = "target_5d_up"
SEQ_LENGTH = 10  # Hari ke belakang untuk memori LSTM

if HAS_TORCH:
    class StockLSTM(nn.Module):
        def __init__(self, input_dim, hidden_dim=32, num_layers=1, dropout=0.2):
            super(StockLSTM, self).__init__()
            self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True, dropout=dropout if num_layers > 1 else 0)
            self.dropout = nn.Dropout(dropout)
            self.fc = nn.Linear(hidden_dim, 1)
            
        def forward(self, x):
            out, _ = self.lstm(x)
            out = self.dropout(out[:, -1, :]) # Ambil timestep terakhir
            out = self.fc(out)
            return torch.sigmoid(out)

def create_sequences(df, features, target, seq_length):
    """Mengubah data tabular menjadi format sequence (samples, time_steps, features)"""
    sequences = []
    labels = []
    
    # Kita harus melakukan ini per ticker agar tidak mencampur hari saham A dengan saham B
    for ticker, group in df.groupby("ticker"):
        # Pastikan data terurut berdasar waktu
        group = group.sort_values("Date").reset_index(drop=True)
        
        # Ekstrak nilai Numpy
        X_val = group[features].values
        y_val = group[target].values
        
        for i in range(len(group) - seq_length):
            seq = X_val[i : i + seq_length]
            label = y_val[i + seq_length - 1] # Target berada pada hari terakhir dari sequence
            
            # Abaikan sequence jika ada NaN
            if not np.isnan(seq).any() and not np.isnan(label):
                sequences.append(seq)
                labels.append(label)
                
    return np.array(sequences), np.array(labels)

def run():
    if not HAS_TORCH:
        logger.error("PyTorch tidak terpasang. Jalankan: pip install torch")
        return

    if not INPUT_PATH.exists():
        logger.error(f"File {INPUT_PATH} tidak ditemukan.")
        return

    logger.info("Memuat dataset training...")
    df = pd.read_csv(INPUT_PATH)
    df["Date"] = pd.to_datetime(df["Date"])
    
    # Filter data training saja
    train_df = df[~df["is_latest"]].copy()
    
    logger.info(f"Membentuk sequence dengan panjang {SEQ_LENGTH} hari...")
    X, y = create_sequences(train_df, FEATURES, TARGET, SEQ_LENGTH)
    
    logger.info(f"Bentuk data X: {X.shape}, y: {y.shape}")
    
    # Standarisasi Data (Penting untuk Neural Networks)
    # Reshape ke 2D untuk scaler, lalu kembalikan ke 3D
    num_samples, time_steps, num_features = X.shape
    X_2d = X.reshape(-1, num_features)
    scaler = StandardScaler()
    X_2d_scaled = scaler.fit_transform(X_2d)
    X_scaled = X_2d_scaled.reshape(num_samples, time_steps, num_features)
    
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(scaler, SCALER_PATH)
    
    # ── Walk-Forward Validation ──
    logger.info("Memulai Validasi LSTM...")
    tscv = TimeSeriesSplit(n_splits=5)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Menggunakan device: {device}")
    
    precisions = []
    recalls = []
    
    # Imbalance weighting
    pos_weight = (y == 0).sum() / (y == 1).sum()
    
    for fold, (train_index, test_index) in enumerate(tscv.split(X_scaled)):
        X_train, X_test = X_scaled[train_index], X_scaled[test_index]
        y_train, y_test = y[train_index], y[test_index]
        
        train_data = TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train).view(-1, 1))
        train_loader = DataLoader(train_data, batch_size=256, shuffle=False) # Shuffle False untuk time series batching
        
        model = StockLSTM(input_dim=num_features).to(device)
        criterion = nn.BCELoss() # Gunakan BCE biasa, weight diatur via threshold nanti
        optimizer = torch.optim.Adam(model.parameters(), lr=0.005)
        
        # Training loop singkat (10 epoch)
        model.train()
        for epoch in range(10):
            for batch_X, batch_y in train_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                optimizer.zero_grad()
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
                
        # Evaluasi
        model.eval()
        with torch.no_grad():
            X_test_tensor = torch.FloatTensor(X_test).to(device)
            preds_proba = model(X_test_tensor).cpu().numpy()
            
        # Gunakan threshold 0.40 untuk recall yang lebih baik (seperti saran analisis)
        preds = (preds_proba >= 0.40).astype(int)
        
        prec = precision_score(y_test, preds, zero_division=0)
        rec = recall_score(y_test, preds, zero_division=0)
        precisions.append(prec)
        recalls.append(rec)
        logger.info(f"Fold {fold+1} | Precision: {prec:.4f} | Recall: {rec:.4f}")
        
    logger.info("=== Hasil Validasi LSTM (Rata-rata) ===")
    logger.info(f"Mean Precision : {np.mean(precisions):.4f}")
    logger.info(f"Mean Recall    : {np.mean(recalls):.4f}")
    logger.info("=======================================")

if __name__ == "__main__":
    run()
