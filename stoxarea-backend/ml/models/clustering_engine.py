import pandas as pd
import numpy as np
import json
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from app.core.database import SessionLocal
from app.models.stock import Stock

def run_clustering():
    print("Memulai Mesin Klasterisasi Saham (K-Means)...")
    
    db = SessionLocal()
    try:
        # 1. Ambil data dari Database
        stocks = db.query(Stock).all()
        if not stocks:
            print("Database kosong! Jalankan sync_db dulu.")
            return

        data = []
        for s in stocks:
            # Gunakan fitur: ROE, PER, dan kita simulasikan Volatilitas (Volatility)
            # Di masa depan bisa diambil dari OHLCV
            data.append({
                "ticker": s.ticker,
                "roe": s.roe if s.roe is not None else 0.0,
                "per": s.per if s.per is not None else 20.0, # Default average PER
                "der": s.der if s.der is not None else 1.0
            })

        df = pd.DataFrame(data)
        
        # 2. Preprocessing & Normalisasi
        features = ["roe", "per", "der"]
        X = df[features]
        
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # 3. K-Means Clustering (K=4)
        kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        df["cluster_id"] = kmeans.fit_predict(X_scaled)

        # 4. Labeling Klaster berdasarkan karakteristik
        # Kita hitung rata-rata tiap klaster untuk menentukan namanya
        cluster_names = {}
        for cid in range(4):
            c_mean = df[df["cluster_id"] == cid][features].mean()
            
            if c_mean["roe"] > 15:
                name = "Sultan (Safe Compounders)"
            elif c_mean["per"] < 15:
                name = "Value Gems (Undervalued)"
            elif c_mean["roe"] > 10:
                name = "Steady Growth"
            elif c_mean["der"] > 2.5:
                name = "Speculative (High Risk)"
            else:
                name = "Moderate Cap"
            
            cluster_names[cid] = name

        # 5. Update kembali ke Database
        for _, row in df.iterrows():
            stock = db.query(Stock).filter(Stock.ticker == row["ticker"]).first()
            if stock:
                stock.cluster = cluster_names[row["cluster_id"]]
        
        db.commit()
        print(f"Klasterisasi SELESAI! {len(df)} saham telah dikelompokkan.")
        
        # Print summary
        for cid, name in cluster_names.items():
            count = len(df[df["cluster_id"] == cid])
            print(f"- {name}: {count} saham")

    except Exception as e:
        db.rollback()
        print(f"Gagal Klasterisasi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_clustering()
