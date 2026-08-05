import pandas as pd
import numpy as np

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

def compute_obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """Menghitung On-Balance Volume (OBV) ternormalisasi (Z-Score MA20)."""
    obv_change = np.sign(close.diff()) * volume
    obv = obv_change.fillna(0).cumsum()
    obv_ma20 = obv.rolling(window=20).mean()
    obv_std20 = obv.rolling(window=20).std().replace(0, 1e-8)
    obv_norm = (obv - obv_ma20) / obv_std20
    return obv_norm

def compute_stochastic(high: pd.Series, low: pd.Series, close: pd.Series, k_period: int = 14, d_period: int = 3):
    """Menghitung Stochastic Oscillator (%K dan %D)."""
    lowest_low = low.rolling(window=k_period).min()
    highest_high = high.rolling(window=k_period).max()
    denom = (highest_high - lowest_low).replace(0, 1e-8)
    stoch_k = ((close - lowest_low) / denom) * 100
    stoch_d = stoch_k.rolling(window=d_period).mean()
    return stoch_k, stoch_d

def detect_candlestick(df: pd.DataFrame) -> pd.DataFrame:
    """Mendeteksi pola candlestick dasar dan tingkat lanjut."""
    body = (df['Close'] - df['Open']).abs()
    shadow = df['High'] - df['Low']
    df['is_doji'] = (body <= 0.1 * shadow).astype(int)
    
    lower_shadow = df[['Open', 'Close']].min(axis=1) - df['Low']
    upper_shadow = df['High'] - df[['Open', 'Close']].max(axis=1)
    df['is_hammer'] = ((lower_shadow > 2 * body) & (upper_shadow < 0.2 * body)).astype(int)
    
    # Bullish Engulfing
    prev_body = df['Open'].shift(1) - df['Close'].shift(1) # Positif jika merah
    curr_body = df['Close'] - df['Open'] # Positif jika hijau
    
    is_prev_red = prev_body > 0
    is_curr_green = curr_body > 0
    engulfs_bull = (df['Close'] > df['Open'].shift(1)) & (df['Open'] < df['Close'].shift(1))
    df['is_bullish_engulfing'] = (is_prev_red & is_curr_green & engulfs_bull).astype(int)

    # Bearish Engulfing
    is_prev_green = prev_body < 0
    is_curr_red = curr_body < 0
    engulfs_bear = (df['Close'] < df['Open'].shift(1)) & (df['Open'] > df['Close'].shift(1))
    df['is_bearish_engulfing'] = (is_prev_green & is_curr_red & engulfs_bear).astype(int)

    # Shooting Star
    df['is_shooting_star'] = ((upper_shadow > 2 * body) & (lower_shadow < 0.2 * body)).astype(int)

    # Morning Star Sederhana
    prev2_red = (df['Open'].shift(2) - df['Close'].shift(2)) > 0
    prev1_small = (df['Close'].shift(1) - df['Open'].shift(1)).abs() <= 0.3 * (df['High'].shift(1) - df['Low'].shift(1))
    curr_green_strong = curr_body > 0
    df['is_morning_star'] = (prev2_red & prev1_small & curr_green_strong).astype(int)

    return df
