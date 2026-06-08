"""
ml/pipeline/agriculture_cluster.py
----------------------------------
Clustering untuk emiten sektor Pertanian menggunakan algoritma K-Means.
Fitur yang digunakan:
- Return 1 Tahun (Tren)
- Volatilitas (Risiko)
- Rata-rata Volume (Likuiditas)
"""

import json
import logging
from pathlib import Path
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import time

# ── Setup logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

SECTORS_FILE = Path("data/tickers/tickers_bei.json")
OUTPUT_FILE = Path("data/clusters/agriculture.json")
REQUEST_DELAY = 0.5
N_CLUSTERS = 3

def get_agriculture_tickers():
    if not SECTORS_FILE.exists():
        logger.error(f"File {SECTORS_FILE} tidak ditemukan.")
        return []
    
    with open(SECTORS_FILE, "r", encoding="utf-8") as f:
        sectors_list = json.load(f)
        
    # Ambil ticker yang sektornya "Agriculture"
    agri_tickers = [item["ticker"] for item in sectors_list if item.get("sector") == "Agriculture"]
    return agri_tickers

def fetch_features(tickers):
    data = []
    
    for i, ticker in enumerate(tickers):
        logger.info(f"[{i+1}/{len(tickers)}] Mengunduh data {ticker}...")
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1y")
            
            if len(hist) < 200:
                logger.warning(f"  -> Data {ticker} kurang dari 200 hari, di-skip.")
                continue
                
            # Hitung Return 1 Tahun
            start_price = hist['Close'].iloc[0]
            end_price = hist['Close'].iloc[-1]
            return_1y = (end_price - start_price) / start_price
            
            # Hitung Volatilitas (Standar Deviasi dari return harian)
            daily_returns = hist['Close'].pct_change().dropna()
            volatility = daily_returns.std() * np.sqrt(252) # Annualized volatility
            
            # Hitung Rata-rata Volume
            avg_volume = hist['Volume'].mean()
            
            data.append({
                "ticker": ticker,
                "return_1y": return_1y,
                "volatility": volatility,
                "avg_volume": avg_volume
            })
            
        except Exception as e:
            logger.error(f"  -> Gagal mengunduh data {ticker}: {e}")
            
        time.sleep(REQUEST_DELAY)
        
    return pd.DataFrame(data)

def generate_persona(cluster_centers):
    # Sederhana: kita urutkan berdasarkan return dan volatility
    # Mengembalikan mapping cluster_id -> Persona Name
    personas = {}
    
    for idx, center in enumerate(cluster_centers):
        ret = center[0]
        vol = center[1]
        
        # Logika sederhana penentuan persona
        if ret > 0 and vol > 0.4:
            personas[idx] = "High Growth / High Volatility"
        elif ret > 0 and vol <= 0.4:
            personas[idx] = "Steady Growth / Defensive"
        elif ret < 0 and vol > 0.4:
            personas[idx] = "Laggard / High Risk"
        else:
            personas[idx] = "Sideways / Sleepy"
            
    # Pastikan setiap cluster punya nama yang unik (tambahkan index jika duplikat)
    # Ini versi sederhana
    return personas

def run_clustering():
    logger.info("Memulai proses clustering sektor Pertanian...")
    
    tickers = get_agriculture_tickers()
    if not tickers:
        logger.warning("Tidak ada emiten Pertanian ditemukan!")
        return
        
    logger.info(f"Ditemukan {len(tickers)} emiten Pertanian.")
    
    df = fetch_features(tickers)
    if df.empty:
        logger.error("Gagal mendapatkan data fitur untuk semua emiten.")
        return
        
    logger.info(f"Berhasil mengunduh data untuk {len(df)} emiten. Memulai K-Means...")
    
    # Preprocessing
    features = df[['return_1y', 'volatility', 'avg_volume']]
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)
    
    # Clustering
    kmeans = KMeans(n_clusters=min(N_CLUSTERS, len(df)), random_state=42, n_init=10)
    df['cluster'] = kmeans.fit_predict(scaled_features)
    
    # Inverse transform cluster centers untuk membuat persona
    centers = scaler.inverse_transform(kmeans.cluster_centers_)
    personas = generate_persona(centers)
    
    # Format output
    output_data = {
        "metadata": {
            "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "n_clusters": N_CLUSTERS,
            "sector": "Pertanian",
            "personas": personas
        },
        "clusters": {}
    }
    
    for _, row in df.iterrows():
        cluster_id = int(row['cluster'])
        ticker = row['ticker']
        if cluster_id not in output_data["clusters"]:
            output_data["clusters"][cluster_id] = {
                "persona": personas.get(cluster_id, f"Cluster {cluster_id}"),
                "members": []
            }
        
        output_data["clusters"][cluster_id]["members"].append({
            "ticker": ticker,
            "return_1y": float(row['return_1y']),
            "volatility": float(row['volatility']),
            "avg_volume": float(row['avg_volume'])
        })
        
    # Simpan hasil
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4)
        
    logger.info(f"✅ Clustering selesai! Hasil disimpan di {OUTPUT_FILE}")
    
if __name__ == "__main__":
    run_clustering()
