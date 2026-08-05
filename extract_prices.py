import os, csv, glob

ohlcv_dir = 'stoxarea-backend/data/raw/ohlcv'
result = {}

for f in glob.glob(os.path.join(ohlcv_dir, '*.csv')):
    ticker = os.path.basename(f).replace('.JK.csv', '')
    try:
        with open(f, 'r') as fp:
            rows = list(csv.reader(fp))
            if len(rows) >= 2:
                last_row = rows[-1]
                close_price = float(last_row[4])  # Close column
                result[ticker] = int(close_price)
    except Exception as e:
        pass

# Print sorted by ticker
for t in sorted(result.keys()):
    print(f'    "{t}": {result[t]},')
