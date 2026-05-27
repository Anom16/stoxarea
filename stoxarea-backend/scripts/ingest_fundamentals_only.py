import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd
import time
from ml.pipeline.ingestor import fetch_fundamental, load_ticker_list

def main():
    try:
        # Load filtered tickers for efficiency
        import json
        with open("data/tickers/tickers_filtered.json", "r") as f:
            tickers = json.load(f)
    except Exception:
        try:
            tickers = load_ticker_list("data/tickers/tickers_bei.json")
        except Exception:
            tickers = ["BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "ADRO.JK", "PTBA.JK", "UNVR.JK", "TLKM.JK", "ASII.JK"]

    print(f"Running fundamental ingestion for {len(tickers)} tickers...")
    all_funds = []
    
    for i, t in enumerate(tickers):
        print(f"[{i+1}/{len(tickers)}] Fetching {t}...")
        try:
            fund = fetch_fundamental(t)
            if fund:
                all_funds.append(fund)
        except Exception as e:
            print(f"Error fetching {t}: {e}")
        time.sleep(0.1) # Fast fetch with small delay
        
    if all_funds:
        df = pd.DataFrame(all_funds)
        os.makedirs("data/raw", exist_ok=True)
        df.to_csv("data/raw/fundamental.csv", index=False)
        print(f"SUCCESS: Ingested and saved fundamental.csv with PBV for {len(all_funds)} stocks!")
    else:
        print("ERROR: No fundamentals retrieved.")

if __name__ == "__main__":
    main()
