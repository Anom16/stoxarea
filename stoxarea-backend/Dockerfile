FROM python:3.11-slim

# Install system dependencies yang dibutuhkan curl_cffi dan psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /code

# Copy dan install dependencies dulu (layer caching)
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /code/requirements.txt

# Copy seluruh kode
COPY . .

# Buat folder yang dibutuhkan saat runtime
RUN mkdir -p logs reports data/processed data/raw/ohlcv data/clusters

# Jalankan uvicorn (Railway inject $PORT otomatis)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
