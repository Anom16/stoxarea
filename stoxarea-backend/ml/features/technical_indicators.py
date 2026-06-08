import pandas as pd

def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Menghitung Relative Strength Index (RSI)."""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def compute_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """Menghitung MACD, MACD Signal, dan MACD Histogram."""
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    macd_hist = macd - macd_signal
    return macd, macd_signal, macd_hist

def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Menghitung Average True Range (ATR) untuk volatilitas."""
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    return atr

def detect_candlestick(df: pd.DataFrame) -> pd.DataFrame:
    """Mendeteksi pola candlestick dasar."""
    # Doji: Harga open dan close hampir sama (badan < 10% dari panjang ekor)
    body = (df['Close'] - df['Open']).abs()
    shadow = df['High'] - df['Low']
    df['is_doji'] = (body <= 0.1 * shadow).astype(int)
    
    # Hammer: Ekor bawah panjang, ekor atas pendek, badan kecil di atas
    lower_shadow = df[['Open', 'Close']].min(axis=1) - df['Low']
    upper_shadow = df['High'] - df[['Open', 'Close']].max(axis=1)
    df['is_hammer'] = ((lower_shadow > 2 * body) & (upper_shadow < 0.2 * body)).astype(int)
    
    # Bullish Engulfing: Candle saat ini hijau menelan candle merah sebelumnya
    prev_body = df['Open'].shift(1) - df['Close'].shift(1) # Positif jika merah
    curr_body = df['Close'] - df['Open'] # Positif jika hijau
    
    is_prev_red = prev_body > 0
    is_curr_green = curr_body > 0
    engulfs = (df['Close'] > df['Open'].shift(1)) & (df['Open'] < df['Close'].shift(1))
    
    df['is_bullish_engulfing'] = (is_prev_red & is_curr_green & engulfs).astype(int)
    return df
