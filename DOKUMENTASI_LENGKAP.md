# 📚 DOKUMENTASI LENGKAP STOXAREA
**Sistem Pendukung Keputusan (SPK) untuk Rekomendasi Saham Bursa Indonesia**

---

## 📖 DAFTAR ISI
1. [Proses Bisnis](#1-proses-bisnis)
2. [Rancangan Diagram](#2-rancangan-diagram)
3. [Rancangan Dataset](#3-rancangan-dataset)
4. [Metode yang Digunakan](#4-metode-yang-digunakan)

---

# 1. PROSES BISNIS

## 1.1 Alur Umum Sistem STOXAREA

STOXAREA adalah platform simulasi perdagangan saham dengan fitur rekomendasi berbasis Artificial Intelligence dan Sistem Pendukung Keputusan (SPK) 3-tingkat. Sistem ini membantu pengguna membuat keputusan investasi yang lebih baik melalui analisis data fundamental dan teknikal.

### 🔄 Alur Proses Utama

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROSES BISNIS STOXAREA                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐
│  PENGGUNA   │
└──────┬──────┘
       │
       ├─ 1️⃣ REGISTRASI & LOGIN
       │   ├─ Daftar akun dengan email & password
       │   ├─ Sistem memvalidasi data
       │   ├─ Akun dibuat dengan saldo virtual 100 Juta
       │   └─ JWT token dihasilkan untuk autentikasi
       │
       ├─ 2️⃣ PENGISIAN PROFIL RISIKO (SPK Tier 1)
       │   ├─ Pengguna menjawab 10 pertanyaan tentang:
       │   │  • Target return tahunan
       │   │  • Kualitas perusahaan yang diinginkan
       │   │  • Toleransi risiko
       │   │  • Sensitivitas harga
       │   │  • Kapasitas finansial
       │   ├─ Sistem menghitung total skor
       │   ├─ Profil dikelompokkan: Konservatif/Moderat/Agresif
       │   └─ Pengecekan VETO: Jika dana darurat kurang, paksa Konservatif
       │
       ├─ 3️⃣ MELIHAT REKOMENDASI SAHAM (SPK Tier 3 - SAW)
       │   ├─ Sistem mengambil:
       │   │  • Skor AI dari model XGBoost (prediksi harga naik)
       │   │  • Metrik fundamental: ROE, DER, PER
       │   ├─ Normalisasi data sesuai profil risiko
       │   ├─ Hitung skor SAW (Weighted Average)
       │   ├─ Urutkan dari skor tertinggi
       │   └─ Tampilkan Top 10 saham rekomendasi
       │
       ├─ 4️⃣ DETAIL ANALISIS SAHAM
       │   ├─ Melihat skor AI & penjelasan SHAP
       │   ├─ Melihat grafik teknikal (candlestick + indikator)
       │   ├─ Melihat metrik fundamental (4 tahun historis)
       │   └─ Melihat informasi sektor & industri
       │
       ├─ 5️⃣ SIMULASI PERDAGANGAN (Virtual Trading)
       │   ├─ Beli saham:
       │   │  • Pilih ticker & jumlah lot
       │   │  • Sistem ambil harga real-time dari yfinance
       │   │  • Hitung fee (0.15% transaksi + admin fee)
       │   │  • Validasi saldo cukup
       │   │  • Catat transaksi di database
       │   │
       │   └─ Jual saham:
       │      • Pilih ticker & jumlah lot
       │      • Sistem ambil harga real-time
       │      • Hitung profit/loss
       │      • Catat transaksi & update portfolio
       │
       └─ 6️⃣ MONITORING PERFORMA
           ├─ Lihat portfolio (saham yang dimiliki)
           ├─ Hitung total P&L (profit/loss)
           ├─ Bandingkan dengan benchmark
           └─ Lihat historis transaksi

BACKEND (Daily Schedule)
├─ 🕔 Setiap hari pukul 17:00 (Mon-Fri):
│  │
│  ├─ DOWNLOAD DATA
│  │  ├─ Download OHLCV (Open, High, Low, Close, Volume) dari yfinance
│  │  └─ Download data fundamental dari API eksternal
│  │
│  ├─ FEATURE ENGINEERING
│  │  ├─ Hitung 11 indikator teknikal: MA20, MA50, RSI, MACD, BB, dll
│  │  ├─ Hitung perubahan volume & volatilitas
│  │  └─ Normalisasi fitur untuk model
│  │
│  ├─ INFERENSI MODEL (SPK Tier 2 - XGBoost)
│  │  ├─ Jalankan model prediksi untuk 150 saham BEI
│  │  ├─ Prediksi: "Akan harga naik >5% dalam 5 hari?"
│  │  ├─ Output: Probabilitas 0-100% untuk setiap saham
│  │  └─ Simpan skor AI ke JSON cache
│  │
│  ├─ EXPLAINABILITY (SHAP)
│  │  ├─ Hitung SHAP values untuk insight
│  │  ├─ Identifikasi fitur paling penting (MA, RSI, dll)
│  │  └─ Cache untuk ditampilkan di frontend
│  │
│  └─ SYNC DATABASE
│     ├─ Update tabel stocks dengan skor AI terbaru
│     ├─ Update fundamental metrics (ROE, DER, PER)
│     └─ Hot-reload cache di memory

DATABASE (PostgreSQL)
├─ Tabel users: Data pengguna & profil risiko
├─ Tabel stocks: Metadata 150 saham BEI
├─ Tabel portfolios: Saham yang dimiliki setiap user
├─ Tabel transactions: Historis transaksi BUY/SELL
├─ Tabel financial_history: 4 tahun data fundamental
└─ Tabel corporate_action_flags: Alert untuk corporate action
```

---

## 1.2 Alur Terperinci Setiap Fitur

### 📝 A. REGISTRASI PENGGUNA

```
PENGGUNA KLIK "DAFTAR"
         │
         ↓
INPUT DATA: email, password, nama lengkap
         │
         ↓
FRONTEND: POST /auth/register
         │
         ↓
BACKEND: Validasi Input
  ├─ Email format valid?
  ├─ Password panjang ≥ 8 karakter?
  ├─ Nama tidak kosong?
  └─ Jika tidak valid → Error 400
         │
         ↓ (Valid)
BACKEND: Cek Email Duplikat
  └─ SELECT * FROM users WHERE email = ?
    ├─ Ada → Error 409 "Email sudah terdaftar"
    └─ Tidak ada → Lanjut
         │
         ↓
BACKEND: Hash Password
  └─ bcrypt.hashpw(password, salt) → hash_aman
         │
         ↓
BACKEND: Buat User Record
  ├─ user.email = email
  ├─ user.password_hash = hash_aman
  ├─ user.full_name = nama_lengkap
  ├─ user.risk_profile = NULL (belum diisi)
  ├─ user.virtual_balance = 100,000,000 (100 Juta)
  └─ user.created_at = NOW()
         │
         ↓
DATABASE: INSERT INTO users (...)
         │
         ↓
RESPONSE: User ID, Email, Nama (tanpa password)
         │
         ↓
FRONTEND: "Registrasi berhasil! Silakan login"
```

### 🔐 B. LOGIN & AUTENTIKASI

```
PENGGUNA KLIK "LOGIN"
         │
         ↓
INPUT DATA: email, password
         │
         ↓
FRONTEND: POST /auth/login
         │
         ↓
BACKEND: Query User by Email
  └─ SELECT * FROM users WHERE email = ?
    ├─ Tidak ada → Error 401 "Email tidak ditemukan"
    └─ Ada → Lanjut
         │
         ↓
BACKEND: Verify Password
  └─ bcrypt.checkpw(input_password, stored_hash)
    ├─ Tidak cocok → Error 401 "Password salah"
    └─ Cocok → Lanjut
         │
         ↓
BACKEND: Generate JWT Token
  ├─ Payload: {sub: email, exp: now + 7 hari, iat: now}
  ├─ Sign dengan SECRET_KEY menggunakan HS256
  └─ Token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
         │
         ↓
RESPONSE: {access_token, token_type: "bearer", user_info}
         │
         ↓
FRONTEND: Simpan token di localStorage
         │
         ↓
PENGGUNA: Sudah bisa akses halaman dashboard
```

### ❓ C. PENGISIAN PROFIL RISIKO (SPK Tier 1)

```
PENGGUNA MASUK KE "PROFILING PAGE"
         │
         ↓
FRONTEND: GET /auth/questionnaire
  └─ Ambil 10 pertanyaan standar
         │
         ↓
BACKEND: Return 10 Q dengan opsi jawaban & poin
  
  Contoh:
  Q1: "Berapa target return tahunan Anda?"
      ├─ < 10% (Aman) → Poin: 1
      ├─ 10-20% (Sedang) → Poin: 3
      └─ > 20% (Tinggi) → Poin: 5

  Q2: "Bagaimana kualitas perusahaan yang Anda cari?"
      ├─ Blue chip, stabil → Poin: 1
      ├─ Established, grow → Poin: 3
      └─ Penny stock, risk → Poin: 5
      
  ... [8 pertanyaan lainnya] ...

  TOTAL SKOR MAKSIMAL = 50 poin
         │
         ↓
PENGGUNA: Jawab 10 pertanyaan
         │
         ↓
FRONTEND: POST /auth/submit-profiling
  ├─ {k1_poin: 5, k2_poin: 3, ..., k10_poin: 4}
  └─ Hitung total: 5+3+...+4 = 38 poin
         │
         ↓
BACKEND: SPK Tier 1 - Calculate Risk Profile

  INPUT: Total poin = 38

  ├─ Kategorisasi Profil:
  │  ├─ Poin 10-18 → Profil = KONSERVATIF
  │  ├─ Poin 19-31 → Profil = MODERAT
  │  └─ Poin 32-50 → Profil = AGRESIF
  │
  ├─ Pada kasus ini: 38 poin → AGRESIF
  │
  └─ Pengecekan VETO:
     ├─ Dari Q7: "Berapa dana darurat yang Anda miliki?"
     │          Jika < 3 bulan pengeluaran → Paksa KONSERVATIF
     └─ (Ini safety check untuk user yang tidak hati-hati)
         │
         ↓
BACKEND: Update Database
  └─ UPDATE users SET risk_profile = 'AGRESIF' WHERE id = ?
         │
         ↓
RESPONSE: "Profil Anda: AGRESIF. Anda siap dengan risiko tinggi!"
         │
         ↓
FRONTEND: Redirect ke Rekomendasi Saham
```

### ⭐ D. MELIHAT REKOMENDASI SAHAM (SPK Tier 3 - SAW)

```
PENGGUNA KLIK "REKOMENDASI SAHAM"
         │
         ↓
FRONTEND: GET /recommendation/top-picks?sector=null
  └─ Header: Authorization: Bearer {jwt_token}
         │
         ↓
BACKEND: Step 1 - Extract User Info
  ├─ Decode JWT → email
  ├─ Query users table → user_id, risk_profile
  └─ risk_profile = AGRESIF
         │
         ↓
BACKEND: Step 2 - Load Data
  ├─ Load AI scores dari cache JSON (diupdate daily)
  ├─ Query database untuk:
  │  • Semua 150 saham BEI
  │  • Metrik fundamental: ROE, DER, PER setiap saham
  │  • Status qualified (sesuai filter)
  └─ Data loaded ke memory
         │
         ↓
BACKEND: Step 3 - Filter Outliers & Normalize
  ├─ Untuk ROE:
  │  • Min-max normalization: n_roe = (ROE - min) / (max - min)
  │  • Capping: max ROE = 50% (outlier)
  │
  ├─ Untuk DER (Debt to Equity):
  │  • Normalisasi dan reverse (lebih rendah lebih baik)
  │  • Capping: max DER = 5
  │
  ├─ Untuk PER (Price to Earnings):
  │  • Normalisasi terbalik (PER tinggi = risiko)
  │  • Capping: max PER = 100
  │
  └─ Untuk AI Score:
     • Sudah dalam range 0-100%
     • Konversi ke 0-1
         │
         ↓
BACKEND: Step 4 - SAW Weighting (Sesuai Profil)

  Untuk Profil AGRESIF:
  ├─ w_ai = 0.40   (AI score paling penting)
  ├─ w_roe = 0.30  (Pertumbuhan)
  ├─ w_der = 0.15  (Utang, kurang penting untuk agresif)
  └─ w_per = 0.15  (Valuasi)
  
  Total weight = 0.40 + 0.30 + 0.15 + 0.15 = 1.00 ✓

  Contoh perhitungan untuk BBCA:
  ├─ AI Score: 75% → n_ai = 0.75
  ├─ ROE: 25% → n_roe = 0.70 (after normalize)
  ├─ DER: 2.5 → n_der = 0.80 (after normalize)
  ├─ PER: 25x → n_per = 0.65 (after normalize)
  │
  └─ SAW Score = (0.40 × 0.75) + (0.30 × 0.70) 
                 + (0.15 × 0.80) + (0.15 × 0.65)
               = 0.30 + 0.21 + 0.12 + 0.0975
               = 0.7275 (72.75%)
         │
         ↓
BACKEND: Step 5 - Hitung untuk Semua Saham
  └─ Loop 150 saham, hitung SAW setiap satu
  └─ Simpan di list: [(BBCA, 72.75%), (BMRI, 71.50%), ...]
         │
         ↓
BACKEND: Step 6 - Sort & Top 10
  ├─ Urutkan descending by SAW score
  └─ Ambil top 10
         │
         ↓
BACKEND: Step 7 - Enrichment Data
  ├─ Untuk setiap top 10, tambahkan:
  │  • Harga current (dari cache)
  │  • % perubahan hari ini
  │  • Info sektor
  │  • Company name
  │  • Grade/insight
  └─ Format untuk frontend
         │
         ↓
RESPONSE: Top 10 Rekomendasi
  [
    {
      "ticker": "BBCA",
      "score": 72.75,
      "rank": 1,
      "price": 10500,
      "change": "+1.2%",
      "ai_score": 75,
      "roe": 25.0,
      "der": 2.5,
      "per": 25.0,
      "sector": "Keuangan",
      "insight": "Bank terkemuka dengan ROE solid"
    },
    ...9 items lainnya
  ]
         │
         ↓
FRONTEND: Tampilkan dalam tabel/card
  ├─ Rank, Ticker, Score, Metrik, Action button
  └─ User bisa klik untuk detail atau beli
```

### 💰 E. SIMULASI PERDAGANGAN (BUY/SELL)

```
PENGGUNA KLIK "BELI BBCA 10 LOT"
         │
         ↓
FRONTEND: POST /portfolio/buy
  ├─ Authorization header
  └─ {"ticker": "BBCA", "qty": 10}
         │
         ↓
BACKEND: Validasi Input
  ├─ Qty > 0?
  └─ Ticker valid?
         │
         ↓
BACKEND: Get Live Price
  ├─ Call yfinance API: get "BBCA.JK" current price
  ├─ Harga = IDR 10,500 per share
  └─ Cache 10 menit agar tidak boros API call
         │
         ↓
BACKEND: Hitung Transaksi
  ├─ Qty dalam LOT (1 LOT = 100 saham)
  │  ├─ 10 LOT = 1,000 saham
  │
  ├─ Gross Value = 1,000 × 10,500 = 10,500,000
  │
  ├─ Fee = 0.15% × 10,500,000 = 15,750
  │
  ├─ Admin Fee = 5,000 (fixed)
  │
  └─ Total Cost = 10,500,000 + 15,750 + 5,000 = 10,520,750
         │
         ↓
BACKEND: Validasi Saldo
  ├─ Query user balance
  │  ├─ Current balance = 100,000,000
  │  ├─ Total cost = 10,520,750
  │  └─ Saldo cukup? YES ✓
  │
  └─ Jika tidak cukup → Error "Saldo tidak mencukupi"
         │
         ↓
BACKEND: Execute Transaction
  ├─ Deduct balance:
  │  └─ UPDATE users SET virtual_balance = 100,000,000 - 10,520,750
  │                                        = 89,479,250
  │
  ├─ Update/Insert portfolio:
  │  ├─ SELECT * FROM portfolios WHERE user_id = ? AND ticker = "BBCA"
  │  ├─ Jika tidak ada: INSERT (user_id, ticker, qty=1000, avg_price=10,500)
  │  └─ Jika ada: UPDATE qty, UPDATE avg_price = weighted average
  │
  └─ Record transaction:
     ├─ INSERT INTO transactions (user_id, ticker, type="BUY", ...)
     ├─ price = 10,500
     ├─ qty = 1,000
     ├─ fee = 20,750
     └─ net_value = 10,520,750

  ⚠️ ATOMIC TRANSACTION: Semua query di atas dalam 1 transaction
                         Jika error → rollback semua
         │
         ↓
RESPONSE: {"status": "success", "price": 10500, "qty": 1000, 
           "total_cost": 10520750, "new_balance": 89479250}
         │
         ↓
FRONTEND: 
  ├─ Tampilkan notifikasi sukses
  ├─ Update saldo di UI
  ├─ Update portfolio list
  └─ Show transaction detail

────────────────────────────────────────────────────────

PENGGUNA KLIK "JUAL BBCA 5 LOT"
         │
         ↓
FRONTEND: POST /portfolio/sell
  └─ {"ticker": "BBCA", "qty": 5}
         │
         ↓
BACKEND: Validasi Input
  ├─ Qty > 0?
  ├─ Ticker valid?
  └─ User memiliki qty ini di portfolio?
     ├─ Query: SELECT qty FROM portfolios WHERE user_id=? AND ticker="BBCA"
     ├─ Qty available = 1,000
     ├─ Qty mau jual = 500 (5 LOT)
     └─ Cukup? YES ✓
         │
         ↓
BACKEND: Get Live Price
  ├─ Harga BBCA sekarang = IDR 10,750
  └─ (Naik Rp 250 dari harga beli)
         │
         ↓
BACKEND: Hitung Transaksi
  ├─ Qty = 500 saham
  ├─ Gross Revenue = 500 × 10,750 = 5,375,000
  ├─ Fee = 0.15% × 5,375,000 = 8,062
  ├─ Admin Fee = 5,000
  └─ Net Proceeds = 5,375,000 - 8,062 - 5,000 = 5,361,938
         │
         ↓
BACKEND: Calculate P&L
  ├─ Average cost = Rp 10,500 (dari portfolio.avg_price)
  ├─ Qty sold = 500
  ├─ Cost basis = 500 × 10,500 = 5,250,000
  ├─ Gross profit = 5,375,000 - 5,250,000 = 125,000
  ├─ Net profit = 125,000 - 8,062 - 5,000 = 111,938
  └─ ROI = 111,938 / 5,250,000 = 2.13%
         │
         ↓
BACKEND: Execute Transaction
  ├─ Update balance:
  │  └─ virtual_balance += 5,361,938
  │     = 89,479,250 + 5,361,938 = 94,841,188
  │
  ├─ Update portfolio:
  │  └─ qty = 1,000 - 500 = 500
  │     (Jika qty = 0, bisa delete row)
  │
  └─ Record transaction:
     ├─ INSERT INTO transactions (...)
     ├─ type = "SELL"
     ├─ price = 10,750
     ├─ qty = 500
     ├─ fee = 13,062
     └─ net_value = 5,361,938
         │
         ↓
RESPONSE: {status: "success", price: 10750, qty: 500,
           net_proceeds: 5361938, profit: 111938, 
           new_balance: 94841188}
         │
         ↓
FRONTEND: Update UI dengan hasil transaksi & P&L
```

---

## 1.3 Pipeline Machine Learning (Daily Background)

```
⏰ SETIAP HARI PUKUL 17:00 (Mon-Fri)

APScheduler trigger run_daily_pipeline()
        │
        ├─ 📥 PHASE 1: DATA INGESTION (30 min)
        │  │
        │  ├─ Download OHLCV Data
        │  │  ├─ yfinance.download() untuk 150 saham BEI
        │  │  ├─ 5 tahun historis per saham
        │  │  ├─ Save ke: data/raw/ohlcv/{ticker}.csv
        │  │  └─ Format: Date, Open, High, Low, Close, Volume, Adj Close
        │  │
        │  └─ Download Fundamental Data
        │     ├─ Call API fundamental (revenue, net_income, assets, dll)
        │     ├─ Hitung ROE, DER, PER, dll
        │     └─ Save ke: data/raw/fundamental.csv
        │
        ├─ 🔧 PHASE 2: FEATURE ENGINEERING (20 min)
        │  │
        │  ├─ Technical Indicators untuk 150 saham:
        │  │  ├─ Moving Average 20 & 50 hari
        │  │  ├─ RSI (Relative Strength Index)
        │  │  ├─ MACD (Moving Average Convergence Divergence)
        │  │  ├─ Bollinger Bands (upper, middle, lower)
        │  │  ├─ Volume Moving Average
        │  │  └─ All normalized ke 0-1 range
        │  │
        │  └─ Prepare features matrix:
        │     ├─ Shape: (150, 11) 
        │     │   150 = jumlah saham
        │     │   11 = jumlah features (indicators)
        │     ├─ Setiap row = satu saham dengan features-nya
        │     └─ Save ke memory untuk inferensi
        │
        ├─ 🧠 PHASE 3: MODEL INFERENCE (10 min)
        │  │
        │  ├─ Load XGBoost model (trained model dari mlmodels/xgb_model.pkl)
        │  │
        │  ├─ Untuk setiap 150 saham:
        │  │  ├─ Input: 11 technical indicators
        │  │  ├─ Model memprediksi: "Harga naik >5% dalam 5 hari?"
        │  │  ├─ Output: Probability 0-100%
        │  │  └─ Contoh: BBCA → 75% (kemungkinan naik besar)
        │  │
        │  └─ Simpan scores ke: data/processed/ai_scores.json
        │     {
        │       "BBCA": {"score": 75, "timestamp": "2026-05-26T17:00:00Z"},
        │       "BMRI": {"score": 72, ...},
        │       ...
        │     }
        │
        ├─ 📊 PHASE 4: EXPLAINABILITY (SHAP) (15 min)
        │  │
        │  ├─ Load SHAP explainer (jika model medium-large)
        │  │
        │  ├─ Untuk top 30 saham (by score):
        │  │  ├─ Hitung SHAP values
        │  │  ├─ Identifikasi feature importance
        │  │  ├─ Interpretasi: "MA20 naik 2pt → +8% probability"
        │  │  └─ Simpan insights ke cache
        │  │
        │  └─ Output example untuk BBCA:
        │     {
        │       "ticker": "BBCA",
        │       "insights": [
        │         {"feature": "RSI", "impact": "+15%", "value": 72.5},
        │         {"feature": "MA20", "impact": "-5%", "value": 10450},
        │         ...
        │       ]
        │     }
        │
        └─ 💾 PHASE 5: DATABASE SYNC (5 min)
           │
           ├─ Update tabel stocks:
           │  ├─ UPDATE stocks SET ai_score = ? WHERE ticker = ?
           │  ├─ UPDATE stocks SET roe = ?, der = ?, per = ?
           │  └─ UPDATE updated_at = NOW()
           │
           ├─ Cache hot-reload:
           │  ├─ Baca ai_scores.json ke memory
           │  ├─ Baca SHAP insights ke memory
           │  └─ Siap untuk query real-time (no DB call needed)
           │
           └─ Log pipeline execution:
              └─ Log file: logs/pipeline_2026_05_26.log
                 "Started: 17:00, Ended: 17:50, Status: SUCCESS"

⏱️  Total durasi pipeline: ~50 menit
📊 Output cache: Ready untuk 1,440 API requests/hari tanpa DB bottleneck
```

---

# 2. RANCANGAN DIAGRAM

## 2.1 Entity Relationship Diagram (ERD)

```
Database Schema Lengkap:

┌──────────────────────────┐
│        USERS             │
├──────────────────────────┤
│ id (PK)          [INT]   │ ◄──┐
│ email (UNIQUE)   [STR]   │    │ 1:M
│ password_hash    [STR]   │    │
│ full_name        [STR]   │    ├──► ┌──────────────────────────┐
│ risk_profile     [ENUM]  │    │    │      PORTFOLIOS          │
│ virtual_balance  [DECIMAL]    │    ├──────────────────────────┤
│ created_at       [DT]    │    │    │ id (PK)          [INT]   │
│ updated_at       [DT]    │    │    │ user_id (FK)     [INT]   │
└──────────────────────────┘    │    │ ticker (FK)      [STR]   │
           ▲                    │    │ qty              [INT]   │
           │                    │    │ avg_price        [DECIMAL]
           │ 1:M                │    │ created_at       [DT]    │
           │                    │    └──────────────────────────┘
           │                    │            ▼ M:M
           │                    │            (user, ticker combo)
    ┌──────┴──────────┐        │
    │                 │        │
┌───┴──────────────────────────┴────────────────────┐
│      TRANSACTIONS            │                    │
├───────────────────────────────────────────────────┤
│ id (PK)                   [INT]       ◄────────────┤
│ user_id (FK) → users      [INT]   1:M │
│ ticker                    [STR]   ┌───┴───────────────────────┐
│ type (BUY/SELL)           [ENUM] │   │ STOCKS                  │
│ price                     [DECIMAL]│  ├─────────────────────────┤
│ qty                       [INT]   │  │ id (PK)            [INT] │
│ fee                       [DECIMAL]│  │ ticker (UNIQUE)    [STR] │
│ net_value                 [DECIMAL]│  │ name               [STR] │
│ timestamp                 [DT]    │  │ sector             [STR] │
│                                    │  │ industry           [STR] │
│ Index: (user_id, timestamp DESC)  │  │ roe                [FLOAT]
│ Index: (ticker, timestamp DESC)   │  │ der                [FLOAT]
└─────────────────────────────────────┤ per                [FLOAT]
                                       │ is_qualified       [BOOL] │
                                       │ ai_score           [FLOAT]
                                       │ updated_at         [DT]    │
                                       └─────────────────────────────┘
                                                 ▲
                                                 │ 1:M
                                                 │
                                       ┌─────────┴──────────┐
                                       │                    │
                    ┌──────────────────────────────────────────────┐
                    │    FINANCIAL_HISTORY                         │
                    ├──────────────────────────────────────────────┤
                    │ id (PK)               [INT]                  │
                    │ ticker (FK) → stocks  [STR]               1:M│
                    │ year                  [STR]                  │
                    │ revenue               [DECIMAL]             │
                    │ net_income            [DECIMAL]             │
                    │ assets                [DECIMAL]             │
                    │ liabilities           [DECIMAL]             │
                    │ equity                [DECIMAL]             │
                    │ created_at            [DT]                  │
                    │                                              │
                    │ Unique: (ticker, year)                      │
                    └──────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│    CORPORATE_ACTION_FLAGS                            │
├──────────────────────────────────────────────────────┤
│ id (PK)                              [INT]           │
│ ticker                               [STR]           │
│ prev_close                           [DECIMAL]       │
│ curr_close                           [DECIMAL]       │
│ change_pct                           [DECIMAL]       │
│ is_resolved                          [BOOL]          │
│ action_type (SPLIT, DIVIDEND, etc)  [STR]           │
│ split_ratio                          [FLOAT]         │
│ admin_notes                          [TEXT]          │
│ detected_at                          [DT]            │
│ resolved_at                          [DT]            │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│    ALEMBIC_VERSION                                   │
├──────────────────────────────────────────────────────┤
│ version_num                          [STR]           │
│ Contoh: "001", "002", "003"                          │
│ (Tracks DB migration version)                        │
└──────────────────────────────────────────────────────┘
```

---

## 2.2 Data Flow Diagram (DFD)

```
LEVEL 0 - CONTEXT DIAGRAM

           ┌─────────────────────────────┐
           │      PENGGUNA               │
           │  (Frontend React)            │
           └──────────────┬──────────────┘
                          │
              ────────────┼────────────
              │           │           │
         API Request  Response    Historis
              │           │           │
              ↓           ↓           ↓
          ┌────────────────────────────────┐
          │   STOXAREA SYSTEM              │
          │  (FastAPI Backend)             │
          └────────────────────────────────┘
              │           │           │
         Query DB  AI Score   Cache
              │           │           │
              ↓           ↓           ↓
         ┌─────────┐ ┌────────┐ ┌──────────┐
         │PostgreSQL│ │yfinance│ │ In-Memory│
         │Database  │ │ API    │ │  Cache   │
         └─────────┘ └────────┘ └──────────┘


LEVEL 1 - MAIN PROCESSES

                         PENGGUNA
                            │
                  ┌─────────┼─────────┐
                  │         │         │
              [Auth]     [SPK 1]   [Portfolio]
                  │         │         │
        ┌──────────────────┐         │
        │                  │         │
    ┌────────┐      ┌────────────┐   │
    │Check DB│      │Calculate  │   │
    │(users) │      │Risk Score │   │
    └────────┘      └────────────┘   │
        │                  │         │
        └──────────┬───────┘         │
                   │                 │
              [Auth Decision]        │
                   │                 │
         ┌─────────┴────────┐        │
         │                  │        │
    [JWT Token]     [Risk Profile]   │
         │                  │        │
         └──────────────────┼────────┼──────┐
                            │        │      │
                        [SPK 2]  [SPK 3]   │
                        (XGBoost) (SAW)   │
                            │        │     │
                    ┌─────────┴──────┘     │
                    │                      │
            [AI Score Prediction]      [Portfolio]
                    │                      │
            ┌──────┴──────┐          ┌────┴──────┐
            │             │          │           │
        [Feature]  [Cache Score]  [Query]  [Execute]
        [Engineering]               │           │
            │             │         │           │
            └──────┬──────┘   ┌─────┴─────┐     │
                   │         │           │     │
            [ML Pipeline]  [DB Query]   │     │
                   │         │         │      │
                   │    ┌────┴────┐    │      │
                   │    │         │    │      │
              [Inference] [Get Holdings] │   │
                   │    │         │    │      │
                   └────┴─────────┴────┴──────┴──► [Portfolio Updated]
```

---

## 2.3 Use Case Diagram

```
                          ┌────────────────────────────────┐
                          │    STOXAREA SYSTEM             │
                          └────────────────────────────────┘
                                      
                    ┌──────────────────┬──────────────────┐
                    │                  │                  │
              ┌─────────────┐    ┌────────────────┐   ┌──────────┐
              │   PENGGUNA  │    │  ADMIN         │   │ BACKEND  │
              │   (User)    │    │                │   │ SCHEDULER│
              └──────┬──────┘    └────────┬───────┘   └────┬─────┘
                     │                   │               │
                     │ can perform       │ manage        │ trigger
                     │                   │               │
    ┌────────────────┼─────────────────────────────────┐ │
    │                                                    │ │
    ├─ UC1: REGISTER                                    │ │
    │     Actor: Pengguna                              │ │
    │     Flow: Email, Password, Name → Account Created │ │
    │     Output: User ID, Default Balance 100 Juta     │ │
    │                                                    │ │
    ├─ UC2: LOGIN                                       │ │
    │     Actor: Pengguna                              │ │
    │     Flow: Email, Password → JWT Token             │ │
    │     Precond: Account exist                        │ │
    │                                                    │ │
    ├─ UC3: FILL QUESTIONNAIRE (SPK Tier 1)            │ │
    │     Actor: Pengguna                              │ │
    │     Flow: Answer 10 Q → Risk Profile Calculated   │ │
    │     Output: Konservatif/Moderat/Agresif           │ │
    │                                                    │ │
    ├─ UC4: VIEW RECOMMENDATIONS (SPK Tier 3)          │ │
    │     Actor: Pengguna                              │ │
    │     Precond: Risk profile filled                  │ │
    │     Flow: Call SAW engine → Get Top 10 Stocks     │ │
    │     Uses: AI Scores (from cache)                  │ │
    │           Fundamental Data (from DB)              │ │
    │                                                    │ │
    ├─ UC5: VIEW STOCK DETAIL                           │ │
    │     Actor: Pengguna                              │ │
    │     Flow: Click stock → See AI score, Technical,  │ │
    │           Fundamental, SHAP insights              │ │
    │                                                    │ │
    ├─ UC6: BUY STOCK                                   │ │
    │     Actor: Pengguna                              │ │
    │     Input: Ticker, Qty                           │ │
    │     Flow: Validate balance → Execute → Record    │ │
    │     Output: Portfolio updated, Balance deducted   │ │
    │                                                    │ │
    ├─ UC7: SELL STOCK                                  │ │
    │     Actor: Pengguna                              │ │
    │     Precond: Own stock in portfolio               │ │
    │     Flow: Get price → Calc P&L → Execute          │ │
    │     Output: Portfolio updated, Balance increased  │ │
    │                                                    │ │
    ├─ UC8: VIEW PORTFOLIO & P&L                        │ │
    │     Actor: Pengguna                              │ │
    │     Flow: Get holdings, Calc total P&L            │ │
    │     Output: Holdings list, Total P&L %            │ │
    │                                                    │ │
    ├─ UC9: RUN ML PIPELINE                            │ │
    │     Actor: Backend Scheduler                      │ │
    │     Trigger: Daily 17:00 (Mon-Fri)               │◄┘
    │     Flow: Download data → Features → Inference   │
    │            SHAP → Database sync                   │
    │     Output: AI scores cache, SHAP insights        │
    │                                                    │
    ├─ UC10: ADMIN - TRIGGER PIPELINE MANUALLY         │
    │     Actor: Admin                                 │
    │     Flow: Click button → Run pipeline             │
    │     Output: Status update                         │
    │                                                    │
    ├─ UC11: ADMIN - UPDATE CORPORATE ACTION ALERTS    │
    │     Actor: Admin                                 │
    │     Flow: Review flags → Resolve issues           │
    │     Output: Flags updated, User notified (future) │
    │                                                    │
    └────────────────────────────────────────────────────┘
```

---

## 2.4 System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│              ALUR SISTEM STOXAREA LENGKAP                       │
└─────────────────────────────────────────────────────────────────┘

STARTUP:
  ┌─────────────────┐
  │  Run main.py    │
  └────────┬────────┘
           │
    ┌──────┴─────────────────────┐
    │                            │
    ↓                            ↓
┌──────────┐          ┌──────────────────┐
│Load Config│         │Initialize DB     │
└──────────┘          └──────────────────┘
    │                            │
    └──────────┬─────────────────┘
               │
               ↓
        ┌─────────────────────────┐
        │  Start APScheduler      │
        │  (Daily pipeline @ 17:00)
        └─────────────────────────┘
               │
               ↓
        ┌─────────────────────────┐
        │  Load AI Scores Cache   │
        │  (from data/processed/) │
        └─────────────────────────┘
               │
               ↓
        ┌─────────────────────────┐
        │ FastAPI Ready           │
        │ Listen localhost:8000   │
        └─────────────────────────┘


RUNTIME - USER SESSION:

USER ACTION                    BACKEND PROCESS
─────────────────────────────────────────────────────────

1. Register
   │                        POST /auth/register
   ├─► Input: {email,      │
   │           password}    ├─► Hash password (bcrypt)
   │                        │
   │                        ├─► Check email duplicate
   │                        │
   │                        ├─► INSERT users table
   │                        │
   └───────────────────────┤
                            ├─► Response: 201 Created
                            └─► user_id, email


2. Login
   │                        POST /auth/login
   ├─► Input: {email,      │
   │           password}    ├─► Query user by email
   │                        │
   │                        ├─► Verify password (bcrypt)
   │                        │
   │                        ├─► Generate JWT
   │                        │
   └───────────────────────┤
                            ├─► Response: 200 OK
                            └─► {access_token, type}


3. Get Questionnaire
   │                        GET /auth/questionnaire
   ├─► No input             │
   │                        ├─► Return 10 Q from memory
   │
   └───────────────────────┤
                            ├─► Response: 200 OK
                            └─► {data: [Q1, Q2, ...]}


4. Submit Profiling
   │                        POST /auth/submit-profiling
   ├─► Input: {k1,k2,..    │
   │           k10}         ├─► Sum scores
   │                        │
   │                        ├─► Categorize profile
   │                        │
   │                        ├─► Check VETO (emergency fund)
   │                        │
   │                        ├─► UPDATE users.risk_profile
   │                        │
   └───────────────────────┤
                            ├─► Response: 200 OK
                            └─► {risk_profile: "AGRESIF", ...}


5. Get Top Picks (Recommendations)
   │                        GET /recommendation/top-picks
   ├─► JWT header          │
   │                        ├─► Validate JWT
   │                        │
   │                        ├─► Get user risk_profile
   │                        │
   │                        ├─► Load AI scores cache
   │                        │
   │                        ├─► Query all 150 stocks
   │                        │
   │                        ├─► SAW Calculation Loop:
   │                        │   FOR each stock:
   │                        │   - Normalize ROE, DER, PER
   │                        │   - Apply SAW formula
   │                        │   - Store score
   │                        │
   │                        ├─► Sort by score DESC
   │                        │
   │                        ├─► Top 10 + metadata
   │                        │
   └───────────────────────┤
                            ├─► Response: 200 OK
                            └─► [{ticker, score, metrics, ...}]


6. Buy Stock
   │                        POST /portfolio/buy
   ├─► Input: {ticker,     │
   │           qty}         ├─► Get live price (yfinance)
   │                        │
   │                        ├─► Calculate total cost
   │                        │
   │                        ├─► Validate balance
   │                        │
   │                        ├─► BEGIN TRANSACTION
   │                        │   ├─ UPDATE users balance
   │                        │   ├─ INSERT/UPDATE portfolio
   │                        │   ├─ INSERT transaction
   │                        │   └─ COMMIT
   │                        │
   └───────────────────────┤
                            ├─► Response: 201 Created
                            └─► {price, qty, fee, net_value}


7. Sell Stock
   │                        POST /portfolio/sell
   ├─► Input: {ticker,     │
   │           qty}         ├─► Validate inventory
   │                        │
   │                        ├─► Get live price
   │                        │
   │                        ├─► Calculate P&L
   │                        │
   │                        ├─► BEGIN TRANSACTION
   │                        │   ├─ UPDATE users balance
   │                        │   ├─ UPDATE portfolio qty
   │                        │   ├─ INSERT transaction
   │                        │   └─ COMMIT
   │                        │
   └───────────────────────┤
                            ├─► Response: 201 Created
                            └─► {price, qty, profit, new_balance}


BACKGROUND - ML PIPELINE (Daily 17:00):

SCHEDULER TRIGGER
         │
         ├─► run_daily_pipeline()
         │
         ├─► 1. DOWNLOAD DATA
         │    ├─ yfinance.download() for 150 stocks
         │    ├─ Save OHLCV → CSV files
         │    └─ Save fundamental → CSV
         │
         ├─► 2. FEATURE ENGINEERING
         │    ├─ Calculate 11 technical indicators
         │    ├─ Normalize to 0-1
         │    └─ Create (150, 11) matrix
         │
         ├─► 3. XGBoost INFERENCE
         │    ├─ Load model (.pkl)
         │    ├─ Predict for each 150 stocks
         │    ├─ Get probability scores
         │    └─ Save to ai_scores.json
         │
         ├─► 4. SHAP EXPLAINABILITY
         │    ├─ For top 30 stocks
         │    ├─ Calculate SHAP values
         │    └─ Cache insights
         │
         └─► 5. DATABASE SYNC
              ├─ UPDATE stocks table
              ├─ UPDATE cache in memory
              └─ Log completion


REPEAT CYCLE:
└─► Every 24 hours (17:00)
```

---

# 3. RANCANGAN DATASET

## 3.1 Struktur Database Lengkap

### 📋 Tabel USERS

```
Fungsi: Menyimpan data pengguna & profil risiko

Struktur:
┌─────────────────────────────────────────────┐
│ Column Name      │ Type      │ Constraint    │
├──────────────────┼───────────┼───────────────┤
│ id               │ SERIAL    │ PRIMARY KEY   │
│ email            │ VARCHAR   │ UNIQUE NOT NULL
│ password_hash    │ TEXT      │ NOT NULL      │
│ full_name        │ VARCHAR   │ NOT NULL      │
│ risk_profile     │ ENUM      │ NULL (Awal)   │
│                  │ ('KONSER  │ Isi saat profil
│                  │  VATIF',  │ (Null = tidak
│                  │  'MODERAT'│ profil yet)   │
│                  │  'AGRESIF')│              │
│ virtual_balance  │ DECIMAL   │ DEFAULT 100M  │
│ created_at       │ TIMESTAMP │ DEFAULT NOW   │
│ updated_at       │ TIMESTAMP │ DEFAULT NOW   │
└─────────────────────────────────────────────┘

Contoh Data:
id  | email              | full_name    | risk_profile | virtual_balance
────┼────────────────────┼──────────────┼──────────────┼─────────────────
1   | budi@example.com   | Budi Santoso | AGRESIF      | 94,841,188
2   | sri@example.com    | Sri Mutia    | KONSERVATIF  | 98,500,000
3   | andi@example.com   | Andi Wijaya  | MODERAT      | 95,234,567
...
```

### 📊 Tabel STOCKS

```
Fungsi: Menyimpan metadata saham BEI (150 saham)

Struktur:
┌──────────────────────────────────────────────────┐
│ Column Name      │ Type       │ Keterangan       │
├──────────────────┼────────────┼──────────────────┤
│ id               │ SERIAL     │ PK               │
│ ticker           │ VARCHAR    │ Unik, cth "BBCA" │
│ name             │ VARCHAR    │ PT Bank Central  │
│ sector           │ VARCHAR    │ Keuangan         │
│ industry         │ VARCHAR    │ Bank             │
│ roe              │ DECIMAL    │ Return on Equity │
│ der              │ DECIMAL    │ Debt to Equity   │
│ per              │ DECIMAL    │ Price to Earn    │
│ ai_score         │ DECIMAL    │ 0-100%, diupdate│
│                  │            │ daily pipeline  │
│ is_qualified     │ BOOLEAN    │ Filter pemula   │
│ updated_at       │ TIMESTAMP  │ Last update     │
└──────────────────────────────────────────────────┘

Penjelasan Kolom:
• roe: Profitabilitas perusahaan (%). Range: 5%-50%, ideal 15%-25%
• der: Leverage (utang/modal). Range: 0-3, ideal <2
• per: Valuasi murah/mahal. Range: 5-100x, ideal 12-20x
• ai_score: Model prediksi harga naik >5% dlm 5 hari. Range: 0-100%

Contoh Data:
ticker | name          | sector    | roe  | der | per | ai_score | is_qualified
───────┼───────────────┼───────────┼──────┼─────┼─────┼──────────┼──────────────
BBCA   | BCA           | Keuangan  | 25.5 | 2.1 | 25.3│ 75       │ true
BMRI   | BRI           | Keuangan  | 20.3 | 2.8 | 15.2│ 72       │ true
ASII   | Astra         | Otomotif  | 18.2 | 1.9 | 18.5│ 68       │ true
UNVR   | Unilever      | Konsumer  | 15.1 | 0.8 | 50.2│ 55       │ true
...
```

### 💰 Tabel PORTFOLIOS

```
Fungsi: Menyimpan saham yang dimiliki setiap user

Struktur:
┌──────────────────────────────────────────────────┐
│ Column Name      │ Type       │ Keterangan       │
├──────────────────┼────────────┼──────────────────┤
│ id               │ SERIAL     │ PK               │
│ user_id          │ INT        │ FK → users(id)   │
│ ticker           │ VARCHAR    │ FK → stocks()    │
│ qty              │ INT        │ Jumlah saham     │
│ avg_price        │ DECIMAL    │ Harga rata-rata  │
│ created_at       │ TIMESTAMP  │ Tanggal beli     │
│                  │            │ (first)          │
│ updated_at       │ TIMESTAMP  │ Terakhir update  │
│                  │            │ (saat jual/beli) │
│ UNIQUE(user_id, │            │ User punya       │
│        ticker)   │            │ stock max 1x     │
└──────────────────────────────────────────────────┘

Contoh Data:
user_id | ticker | qty  | avg_price | Value      | profit (if sold)
────────┼────────┼──────┼───────────┼────────────┼─────────────────
1       | BBCA   | 1000 | 10,500    | 10,500,000 | 250,000 (price ↑ 10.5%)
1       | BMRI   | 500  | 9,200     | 4,600,000  | -46,000 (price ↓ 1%)
2       | ASII   | 2000 | 8,500     | 17,000,000 | +850,000 (price ↑ 5%)
3       | UNVR   | 100  | 2,450     | 245,000    | +4,900 (price ↑ 2%)
...

Note: Total portfolio value = SUM(qty × current_price)
```

### 📝 Tabel TRANSACTIONS

```
Fungsi: Mencatat historis semua transaksi BUY/SELL

Struktur:
┌──────────────────────────────────────────────────┐
│ Column Name      │ Type       │ Keterangan       │
├──────────────────┼────────────┼──────────────────┤
│ id               │ SERIAL     │ PK               │
│ user_id          │ INT        │ FK → users       │
│ ticker           │ VARCHAR    │ Kode saham       │
│ type             │ ENUM       │ 'BUY' / 'SELL'   │
│ price            │ DECIMAL    │ Harga eksekusi   │
│ qty              │ INT        │ Jumlah (saham)   │
│ fee              │ DECIMAL    │ Komisi trading   │
│ net_value        │ DECIMAL    │ Price × qty ± fee│
│ timestamp        │ DATETIME   │ Waktu transaksi  │
│ INDEX (user_id, │            │ Query cepat      │
│ timestamp DESC)  │            │ untuk user       │
│ INDEX (ticker,  │            │ Query cepat      │
│ timestamp DESC)  │            │ untuk stock      │
└──────────────────────────────────────────────────┘

Contoh Data:
id | user_id | ticker | type | price | qty  | fee    | net_value  | timestamp
───┼─────────┼────────┼──────┼───────┼──────┼────────┼────────────┼───────────────────
1  | 1       | BBCA   | BUY  | 10500 | 1000 | 20,750 | 10,520,750 | 2026-05-20 10:30
2  | 1       | BMRI   | BUY  | 9200  | 500  | 11,350 | 4,611,350  | 2026-05-21 11:15
3  | 1       | BBCA   | SELL | 10750 | 500  | 13,062 | 5,361,938  | 2026-05-22 14:45
4  | 2       | ASII   | BUY  | 8500  | 2000 | 26,500 | 17,026,500 | 2026-05-22 09:00
...

Rumus Fee:
• Trading fee = 0.15% × (price × qty)
• Admin fee = Rp 5,000 (fixed)
• Total fee = trading_fee + admin_fee

Contoh: BUY 1000 × Rp 10,500
• Gross: 10,500,000
• Trading fee: 0.15% × 10,500,000 = 15,750
• Admin fee: 5,000
• Total fee: 20,750
• Net: 10,500,000 + 20,750 = 10,520,750
```

### 📚 Tabel FINANCIAL_HISTORY

```
Fungsi: Menyimpan 4 tahun data fundamental setiap saham

Struktur:
┌──────────────────────────────────────────────────┐
│ Column Name      │ Type       │ Keterangan       │
├──────────────────┼────────────┼──────────────────┤
│ id               │ SERIAL     │ PK               │
│ ticker           │ VARCHAR    │ FK → stocks      │
│ year             │ CHAR(4)    │ Format: "2023"   │
│ revenue          │ DECIMAL    │ Pendapatan thn   │
│ net_income       │ DECIMAL    │ Laba bersih      │
│ total_assets     │ DECIMAL    │ Total aset       │
│ total_liab       │ DECIMAL    │ Total utang      │
│ equity           │ DECIMAL    │ Modal sendiri    │
│ created_at       │ TIMESTAMP  │ Saat input       │
│ UNIQUE(ticker,  │            │ Max 1 rec/thn    │
│ year)            │            │                  │
└──────────────────────────────────────────────────┘

Contoh Data:
ticker | year | revenue    | net_income | assets     | liabilities | equity
───────┼──────┼────────────┼────────────┼────────────┼─────────────┼─────────────
BBCA   | 2023 | 60,000,000 | 15,000,000 | 250,000,000| 50,000,000  | 200,000,000
BBCA   | 2022 | 55,000,000 | 13,200,000 | 230,000,000| 46,000,000  | 184,000,000
BBCA   | 2021 | 50,000,000 | 11,000,000 | 210,000,000| 42,000,000  | 168,000,000
BBCA   | 2020 | 45,000,000 | 9,000,000  | 190,000,000| 38,000,000  | 152,000,000
BMRI   | 2023 | 45,000,000 | 9,000,000  | 200,000,000| 60,000,000  | 140,000,000
...

Dari data ini bisa hitung:
• ROE = Net Income / Equity × 100%
  Contoh: 15,000,000 / 200,000,000 × 100% = 7.5%
  
• DER = Total Liabilities / Equity
  Contoh: 50,000,000 / 200,000,000 = 0.25

• Trend: Bandingkan 4 tahun, apakah revenue naik? Profit margin naik?
```

### 🚩 Tabel CORPORATE_ACTION_FLAGS

```
Fungsi: Alert untuk aksi korporat (split, dividend, merger, dll)

Struktur:
┌──────────────────────────────────────────────────┐
│ Column Name      │ Type       │ Keterangan       │
├──────────────────┼────────────┼──────────────────┤
│ id               │ SERIAL     │ PK               │
│ ticker           │ VARCHAR    │ Kode saham       │
│ prev_close       │ DECIMAL    │ Close H-1        │
│ curr_close       │ DECIMAL    │ Close hari ini   │
│ change_pct       │ DECIMAL    │ % perubahan      │
│ is_resolved      │ BOOLEAN    │ Admin sudah?     │
│ action_type      │ VARCHAR    │ SPLIT/DIVIDEND   │
│ split_ratio      │ DECIMAL    │ 2:1, 1:2, etc    │
│ admin_notes      │ TEXT       │ Catatan admin    │
│ detected_at      │ DATETIME   │ Saat deteksi     │
│ resolved_at      │ DATETIME   │ Saat resolve     │
└──────────────────────────────────────────────────┘

Contoh Data (Stock Split):
ticker | prev_close | curr_close | change_pct | action_type | split_ratio | is_resolved
───────┼────────────┼────────────┼────────────┼─────────────┼─────────────┼────────────
UNVR   | 2,450      | 1,225      | -50%       | SPLIT       | 1:2         | true
ASII   | 8,500      | 8,600      | +1.2%      | NULL        | NULL        | false (normal)

Gunanya:
• Deteksi anomali: Jika ada stock split, perlu adjust qty di portfolio
  Contoh: User punya 100 UNVR dengan split 1:2 → menjadi 200 UNVR
• Admin review → Manually adjust database jika needed
• Future: Notify user tentang corporate action
```

### 🔧 Tabel ALEMBIC_VERSION

```
Fungsi: Track migration database (version control untuk DB schema)

Struktur:
┌──────────────────────────────────────────────────┐
│ Column Name      │ Type       │ Keterangan       │
├──────────────────┼────────────┼──────────────────┤
│ version_num      │ VARCHAR    │ PK (unique)      │
└──────────────────────────────────────────────────┘

Contoh Data:
version_num
───────────
001
002

Fungsi:
• 001_add_transaction_fee_columns.py → ALTER table transactions, add fee column
• 002_add_indexes_and_decimal_precision.py → ADD index, change precision
• Saat startup, Alembic check: "Sudah migration 001? Sudah 002?"
  Jika belum, jalankan otomatis
```

---

## 3.2 Dataset untuk Machine Learning (XGBoost Training)

### ❓ Training Features (11 Fitur Teknikal)

```
Dataset shape: (750, 11) × (5 tahun × 150 saham)

Feature Name          | Perhitungan                        | Range       | Penjelasan
──────────────────────┼───────────────────────────────────┼─────────────┼──────────────────────
1. MA20               | 20-day Moving Avg Close           | 5,000-15,000| Trend jangka pendek
2. MA50               | 50-day Moving Avg Close           | 5,000-15,000| Trend medium
3. RSI                | (100 - 100/(1+RS))                | 0-100       | Overbought/oversold
4. MACD               | 12-day EMA - 26-day EMA           | -500-+500   | Momentum
5. BB_Upper           | MA20 + 2×StdDev                   | 10,000-15k  | Upper band
6. BB_Lower           | MA20 - 2×StdDev                   | 5,000-10k   | Lower band
7. BB_Width           | (BB_Upper - BB_Lower)/MA20 × 100  | 1%-10%      | Volatilitas
8. Volume_MA          | 20-day Volume Moving Avg          | 1M-100M     | Likuiditas trend
9. Price_Change_5day  | (Close_today - Close_5d_ago)/Close| -10%-+10%   | Short momentum
10. Volatility        | Std Dev Close 20 hari             | 1%-15%      | Volatilitas
11. Volume_Ratio      | Volume_today / Volume_MA20        | 0.5-3.0     | Volume hari ini vs rata

Normalisasi: Semua fitur di-normalize ke range [0, 1] untuk XGBoost optimal

Target Variable:
┌─────────────────────────────────────────────────────┐
│ y_target = 1 if (Close_5days_future - Close_today)  │
│            / Close_today > 5%                        │
│          = 0 otherwise                               │
│                                                      │
│ Artinya: "Akan harga naik > 5% dlm 5 hari ke depan?"│
│ Class distribution: ~30% YES, ~70% NO (imbalanced)  │
└─────────────────────────────────────────────────────┘
```

### 📊 Training Data Example

```
Contoh 5 baris dari training set (setelah normalisasi):

ticker | ma20  | ma50  | rsi   | macd  | bb_up | bb_low| width | vol_ma| price_chg | vol_ratio | target
───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────────┼───────────┼────────
BBCA   | 0.65  | 0.58  | 0.68  | 0.55  | 0.72  | 0.58  | 0.45  | 0.62  | 0.06      | 1.20      | 1
BMRI   | 0.52  | 0.48  | 0.45  | 0.52  | 0.60  | 0.44  | 0.35  | 0.55  | 0.02      | 0.95      | 0
ASII   | 0.70  | 0.68  | 0.72  | 0.71  | 0.78  | 0.62  | 0.48  | 0.68  | 0.08      | 1.35      | 1
UNVR   | 0.38  | 0.41  | 0.32  | 0.35  | 0.48  | 0.28  | 0.42  | 0.40  | -0.02     | 0.85      | 0
GGRM   | 0.55  | 0.54  | 0.58  | 0.51  | 0.62  | 0.48  | 0.38  | 0.57  | 0.04      | 1.05      | 1

Backtesting: Walk-forward validation
• Split 1: Train 2020-2021, Test 2022
• Split 2: Train 2020-2022, Test 2023
• Split 3: Train 2020-2023, Test 2024
• Split 4: Train 2020-2024, Test 2025
• Split 5: Train 2020-2025, Test early 2026
→ Average accuracy ~65-72% (baseline)
```

---

# 4. METODE YANG DIGUNAKAN

## 4.1 SPK Tier 1 - Risk Profiling (Simple Score)

### 🧮 Formula Perhitungan

```
Pengguna menjawab 10 pertanyaan, setiap jawaban punya poin 1-5:

                        K1 + K2 + K3 + K4 + K5
          TOTAL SCORE = ──────────────────────── × 10
                              50

Atau bisa disederhanakan:
  TOTAL SCORE = (K1 + K2 + K3 + K4 + K5 + K6 + K7 + K8 + K9 + K10)

Range: 10 (sangat konservatif) - 50 (sangat agresif)

Kategorisasi:
  Total Score 10-18  → Risk Profile = KONSERVATIF
  Total Score 19-31  → Risk Profile = MODERAT
  Total Score 32-50  → Risk Profile = AGRESIF

Contoh:
Pengguna jawab: 5, 3, 4, 3, 5, 2, 4, 3, 4, 3
Total = 5+3+4+3+5+2+4+3+4+3 = 36
36 jatuh di range 32-50 → AGRESIF ✓

Pengecekan VETO:
Jika Q7 (dana darurat) jawab "< 3 bulan pengeluaran" → paksa KONSERVATIF
Ini safety check: tidak boleh agresif kalau dana darurat kurang

```

---

## 4.2 SPK Tier 2 - AI Scoring (XGBoost Model)

### 🤖 Model Arsitektur

```
Input: 11 technical indicators (normalized)
       ↓
    ┌─────────────────────────────────────────┐
    │ XGBoost Classification Model             │
    │                                          │
    │ Hyperparameters:                        │
    │ • max_depth: 5-7 (prevent overfitting) │
    │ • n_estimators: 100-200                 │
    │ • learning_rate: 0.05-0.1               │
    │ • subsample: 0.8 (80% row sampling)     │
    │ • colsample_bytree: 0.8 (80% feature)  │
    │                                          │
    │ Objective: binary:logistic              │
    │ (Probability 0-1, then scale 0-100%)    │
    └─────────────────────────────────────────┘
       ↓
Output: Probability score 0-100%

Task: Binary Classification
"Akan harga naik > 5% dalam 5 hari ke depan?"
  Class 1: YES (probabilitas naik)
  Class 0: NO  (probabilitas turun atau flat)

Training Process:
1. Load 750 samples (5 tahun × 150 saham)
2. Split: 80% train, 20% test
3. Apply Walk-Forward Validation (5 splits)
4. Train model: 600 samples
5. Evaluate: 150 samples
6. Repeat untuk 5 berbeda time periods
7. Average accuracy across 5 splits
8. Save best model → model.pkl

Expected Performance:
• Accuracy: 62-70%
• Precision (untuk Class 1): 65-72%
• Recall (untuk Class 1): 55-65%
• AUC-ROC: 0.68-0.75
```

### 📊 Inference Process (Daily)

```
Every day at 17:00, untuk setiap 150 saham:

FOR each stock in 150:
  1. Get last 5 years OHLCV data
  2. Calculate 11 technical indicators (20-day window)
  3. Normalize to [0, 1]
  4. Predict: xgb_model.predict_proba([features])
  5. Get probability for Class 1
  6. Scale to 0-100%: prob * 100
  7. Save score → ai_scores.json

Example:
BBCA: features = [0.65, 0.58, 0.68, 0.55, ...]
      predict_proba = [[0.25, 0.75]]  ← [prob_class_0, prob_class_1]
      score = 0.75 × 100 = 75%

Output ai_scores.json:
{
  "BBCA": 75,
  "BMRI": 72,
  "ASII": 68,
  ...
}
```

---

## 4.3 SPK Tier 3 - SAW (Simple Additive Weighting)

### 📐 Metode SAW

SAW (Simple Additive Weighting) adalah metode MCDM (Multi-Criteria Decision Making) yang paling sederhana namun efektif untuk rekomendasi.

### Langkah 1: Identifikasi Kriteria

```
Kriteria yang digunakan untuk memilih saham:

1. AI_SCORE (Momentum): 0-100%
   └─ Benefit criterion (semakin tinggi semakin baik)
   └─ Weight: 40% untuk semua profil
   
2. ROE (Profitabilitas): 0-50%
   └─ Benefit criterion
   └─ Weight: 30% (agresif), 20% (moderat), 10% (konservatif)
   
3. DER (Leverage): 0-5
   └─ Cost criterion (semakin rendah semakin baik)
   └─ Weight: 15%
   
4. PER (Valuasi): 5-100x
   └─ Cost criterion
   └─ Weight: 15%

Total weight = 1.0 ✓

```

### Langkah 2: Normalisasi

```
Benefit Criterion (Maximize):
Normalized = (Value - Min) / (Max - Min)

Contoh ROE, range 0-50%:
• BBCA ROE = 25% → n_roe = (25-0)/(50-0) = 0.50
• BMRI ROE = 30% → n_roe = (30-0)/(50-0) = 0.60
• ASII ROE = 20% → n_roe = (20-0)/(50-0) = 0.40


Cost Criterion (Minimize):
Normalized = (Max - Value) / (Max - Min)

Contoh DER, range 0-5:
• BBCA DER = 2.5 → n_der = (5-2.5)/(5-0) = 0.50
• BMRI DER = 3.2 → n_der = (5-3.2)/(5-0) = 0.36
• ASII DER = 1.8 → n_der = (5-1.8)/(5-0) = 0.64

Penjelasan:
• ASII punya DER rendah (1.8) → lebih aman dari utang → score lebih tinggi (0.64)
• BMRI punya DER tinggi (3.2) → lebih banyak utang → score lebih rendah (0.36)
```

### Langkah 3: Weighted Sum

```
SAW Score Formula:
Σ = Σ (weight_i × normalized_value_i)

Untuk Profil AGRESIF:
w_ai = 0.40
w_roe = 0.30
w_der = 0.15
w_per = 0.15

Contoh Kalkulasi BBCA (Agresif Profile):
┌─────────────────────────────────────────────────┐
│ Kriteria    │ Raw Value │ Normalized │ Weight │ Weighted
├─────────────┼───────────┼────────────┼────────┼──────────
│ AI Score    │ 75%       │ 0.75       │ 0.40   │ 0.300
│ ROE         │ 25%       │ 0.50       │ 0.30   │ 0.150
│ DER         │ 2.5       │ 0.50       │ 0.15   │ 0.075
│ PER         │ 25x       │ 0.50       │ 0.15   │ 0.075
├─────────────┼───────────┼────────────┼────────┼──────────
│ SAW SCORE                                    │ 0.600
└─────────────────────────────────────────────────┘

SAW = 0.300 + 0.150 + 0.075 + 0.075 = 0.600 (60%)

Untuk Profil KONSERVATIF:
w_ai = 0.30
w_roe = 0.10
w_der = 0.35  ← DER lebih penting (safety)
w_per = 0.25

Kalkulasi BBCA (Konservatif Profile):
SAW = (0.30 × 0.75) + (0.10 × 0.50) + (0.35 × 0.50) + (0.25 × 0.50)
    = 0.225 + 0.05 + 0.175 + 0.125
    = 0.575 (57.5%)
```

### Langkah 4: Ranking & Top 10

```
Hitung SAW untuk semua 150 saham, kemudian:

1. Sort by SAW score (descending)
2. Take top 10
3. Return dengan metadata

Contoh Output Top 10 untuk Agresif Profile:
Rank │ Ticker │ SAW Score │ AI Score │ ROE  │ DER │ PER │ Insight
─────┼────────┼───────────┼──────────┼──────┼─────┼─────┼──────────────────
1    │ BBCA   │ 60.0%     │ 75%      │ 25%  │ 2.5 │ 25x │ Strong momentum
2    │ ASII   │ 58.5%     │ 72%      │ 28%  │ 1.8 │ 18x │ Solid fundamentals
3    │ BMRI   │ 57.0%     │ 68%      │ 22%  │ 2.8 │ 20x │ Good profitability
4    │ UNVR   │ 55.2%     │ 65%      │ 18%  │ 0.8 │ 45x │ Defensive, pricey
5    │ GGRM   │ 54.8%     │ 63%      │ 25%  │ 2.2 │ 22x │ Stable dividend
6    │ JSMR   │ 52.5%     │ 60%      │ 20%  │ 3.1 │ 28x │ Growth potential
7    │ MEDC   │ 51.0%     │ 58%      │ 24%  │ 1.5 │ 19x │ Good opportunity
8    │ INCO   │ 49.5%     │ 55%      │ 15%  │ 2.0 │ 24x │ Commodity play
9    │ INTP   │ 48.2%     │ 52%      │ 16%  │ 1.9 │ 21x │ Stable business
10   │ PGAS   │ 47.8%     │ 50%      │ 14%  │ 2.3 │ 26x │ Infrastructure
```

---

## 4.4 SHAP Explainability

### 📊 Apa itu SHAP?

SHAP (SHapley Additive exPlanations) adalah metode untuk menjelaskan prediksi machine learning dengan cara:
1. Menunjukkan fitur mana yang paling berpengaruh
2. Berapa besar kontribusi setiap fitur
3. Apakah kontribusi positif atau negatif

### Interpretasi SHAP untuk Rekomendasi Saham

```
Contoh: Mengapa XGBoost prediksi BBCA score 75% (naik)?

Feature      │ Contribution │ Direction │ Insight
─────────────┼──────────────┼───────────┼─────────────────────────────────
RSI          │ +0.15        │ Positive  │ RSI = 72, overbought tapi bullish
             │              │           │ Kontribusi terbesar untuk prediksi NAIK
─────────────┼──────────────┼───────────┼─────────────────────────────────
MA20         │ +0.12        │ Positive  │ MA20 naik, trend positif
             │              │           │ Memperkuat signal bullish
─────────────┼──────────────┼───────────┼─────────────────────────────────
MACD         │ +0.08        │ Positive  │ MACD positive, momentum bagus
─────────────┼──────────────┼───────────┼─────────────────────────────────
Volume       │ +0.05        │ Positive  │ Volume naik, strength confirmed
─────────────┼──────────────┼───────────┼─────────────────────────────────
Volatility   │ -0.10        │ Negative  │ Volatilitas tinggi (risk), sedikit negatif
─────────────┼──────────────┼───────────┼─────────────────────────────────
BB_Upper     │ +0.03        │ Positive  │ Mendekati upper band (buy signal)
─────────────┼──────────────┼───────────┼─────────────────────────────────
Price_Change │ +0.02        │ Positive  │ 5-day change positif
─────────────┼──────────────┼───────────┼─────────────────────────────────
             │ ────────────────────────│
             │ TOTAL SHAP ≈ +0.35     │ → Normalized to probability 75%
             │ (Above base: 40%)      │

Interpretasi:
✓ RSI adalah kontributor utama (15 poin)
✓ Trend (MA20) memperkuat (+12 poin)
✗ Volatilitas sedikit negatif (-10 poin)

Kesimpulan: BBCA bagus karena momentum & trend, tapi perlu hati-hati volatilitas
```

### SHAP Visualization untuk Frontend

```
Dapat ditampilkan sebagai:

1. Force Plot (Horizontal):
   ← Negative                              Positive →
   ┌─────────────────────────────────────────────┐
   │    Volatility  RSI▶◀ MA20▶◀MACD▶◀Volume    │
   │    -10        +15   +12    +8    +5        │
   │                                             │
   │              Prediksi: 75% NAIK             │
   └─────────────────────────────────────────────┘

2. Bar Plot (Vertical):
   Feature        Contribution
   ─────────────────────────────
   RSI            ████████████████ +15
   MA20           ████████████ +12
   MACD           ████████ +8
   Volume         █████ +5
   BB_Upper       ███ +3
   Price_Change   ██ +2
   Volatility     -10
   ────────────────────────────
   TOTAL          75%

3. Text Summary (untuk UI):
   "BBCA diprediksi naik 75% karena:
    • RSI overextended (72) dengan momentum bullish
    • Moving average 20-hari naik konsisten
    • MACD histogram positif dan divergensi positif
    • Volume support transaksi yang kuat
    ⚠️ Perhatian: Volatilitas tinggi, bisa pull-back"
```

---

## 4.5 Virtual Trading Logic

### 💰 BUY Logic

```
Input: user_id, ticker, qty (in LOT)

Step 1: Validasi
  ├─ qty > 0? ✓
  ├─ ticker exists? ✓
  └─ qty ≤ 1000? (limit pertrx) ✓

Step 2: Get Live Price
  ├─ Call yfinance: BBCA.JK current price
  ├─ cache 10 min untuk efisiensi
  └─ price = 10,500

Step 3: Calculate Total Cost
  ├─ qty_shares = qty * 100 (1 LOT = 100 saham)
  │                = 10 * 100 = 1,000
  ├─ gross = qty_shares * price
  │        = 1,000 * 10,500 = 10,500,000
  ├─ trading_fee = 0.15% * gross
  │              = 0.0015 * 10,500,000 = 15,750
  ├─ admin_fee = 5,000 (fixed)
  └─ total_cost = 10,500,000 + 15,750 + 5,000 = 10,520,750

Step 4: Validate Balance
  ├─ Get user.virtual_balance
  │  └─ balance = 100,000,000
  ├─ balance >= total_cost?
  │  └─ 100,000,000 >= 10,520,750? YES ✓
  └─ If NO → Return Error "Saldo tidak cukup"

Step 5: Execute Transaction (ATOMIC)
  ├─ BEGIN TRANSACTION
  │
  ├─ Query portfolio:
  │  SELECT * FROM portfolios 
  │  WHERE user_id = 1 AND ticker = 'BBCA'
  │  → Not found (first time buy BBCA)
  │
  ├─ INSERT new row:
  │  INSERT INTO portfolios 
  │  (user_id, ticker, qty, avg_price)
  │  VALUES (1, 'BBCA', 1000, 10500)
  │
  ├─ UPDATE user balance:
  │  UPDATE users
  │  SET virtual_balance = 100,000,000 - 10,520,750
  │                      = 89,479,250
  │  WHERE id = 1
  │
  ├─ INSERT transaction record:
  │  INSERT INTO transactions
  │  (user_id, ticker, type, price, qty, fee, net_value, timestamp)
  │  VALUES (1, 'BBCA', 'BUY', 10500, 1000, 20750, 10520750, NOW())
  │
  └─ COMMIT TRANSACTION

Step 6: Response
  ├─ status: "success"
  ├─ price: 10500
  ├─ qty: 1000
  ├─ fee: 20750
  ├─ net_value: 10520750
  ├─ new_balance: 89479250
  └─ portfolio_id: 1 (untuk future reference)
```

### 📤 SELL Logic

```
Input: user_id, ticker, qty (in LOT)

Step 1: Validasi
  ├─ qty > 0? ✓
  ├─ ticker exists? ✓
  └─ user memiliki qty ini?
     SELECT qty FROM portfolios
     WHERE user_id = 1 AND ticker = 'BBCA'
     → qty = 1000
     → Mau jual 500 (5 LOT), available 1000? YES ✓

Step 2: Get Live Price
  ├─ Call yfinance: BBCA.JK current price
  └─ price = 10,750 (naik Rp 250 dari harga beli)

Step 3: Calculate Proceeds
  ├─ qty_shares = qty * 100 = 5 * 100 = 500
  ├─ gross_revenue = qty_shares * price
  │                = 500 * 10,750 = 5,375,000
  ├─ trading_fee = 0.15% * 5,375,000 = 8,062
  ├─ admin_fee = 5,000
  └─ net_proceeds = 5,375,000 - 8,062 - 5,000 = 5,361,938

Step 4: Calculate P&L
  ├─ Ambil avg_price dari portfolio
  │  └─ avg_price = 10,500
  ├─ cost_basis = qty_shares * avg_price
  │             = 500 * 10,500 = 5,250,000
  ├─ gross_profit = gross_revenue - cost_basis
  │               = 5,375,000 - 5,250,000 = 125,000
  ├─ net_profit = gross_profit - total_fee
  │             = 125,000 - 13,062 = 111,938
  └─ roi_pct = net_profit / cost_basis * 100%
             = 111,938 / 5,250,000 * 100% = 2.13%

Step 5: Execute Transaction (ATOMIC)
  ├─ BEGIN TRANSACTION
  │
  ├─ UPDATE portfolio:
  │  UPDATE portfolios
  │  SET qty = 1000 - 500 = 500
  │  WHERE user_id = 1 AND ticker = 'BBCA'
  │  (If qty becomes 0, optional DELETE row)
  │
  ├─ UPDATE user balance:
  │  UPDATE users
  │  SET virtual_balance = 89,479,250 + 5,361,938
  │                      = 94,841,188
  │  WHERE id = 1
  │
  ├─ INSERT transaction record:
  │  INSERT INTO transactions
  │  (user_id, ticker, type, price, qty, fee, net_value, profit, timestamp)
  │  VALUES (1, 'BBCA', 'SELL', 10750, 500, 13062, 5361938, 111938, NOW())
  │
  └─ COMMIT TRANSACTION

Step 6: Response
  ├─ status: "success"
  ├─ price: 10750
  ├─ qty: 500
  ├─ fee: 13062
  ├─ net_proceeds: 5361938
  ├─ cost_basis: 5250000
  ├─ profit: 111938
  ├─ roi: "2.13%"
  ├─ new_balance: 94841188
  └─ remaining_holdings: 500 (BBCA)
```

---

## 4.6 Risk Management & Validation

### ⚠️ VETO System (Safety Check)

```
Pengguna tidak boleh terlalu agresif jika kondisinya tidak mendukung:

SPK Tier 1 VETO LOGIC:
┌──────────────────────────────────────────────────────────┐
│ Jika user jawab pertanyaan tentang Dana Darurat:        │
│ "Berapa dana darurat yang Anda miliki?"                 │
│                                                           │
│ Opsi:                                                    │
│ A) < 1 bulan pengeluaran rutin     → poin = 1           │
│ B) 1-3 bulan pengeluaran rutin     → poin = 3           │
│ C) 3-6 bulan pengeluaran rutin     → poin = 5           │
│ D) > 6 bulan pengeluaran rutin     → poin = 5           │
│                                                           │
│ VETO RULE:                                               │
│ IF jawab A (< 1 bulan) THEN profile = FORCE KONSERVATIF │
│                                                           │
│ Logika:                                                  │
│ User tidak punya dana darurat → tidak boleh agresif      │
│ Karena jika ada keadaan darurat, harus jual saham asap   │
│ Jual dalam kondisi terpaksa = kerugian besar            │
└──────────────────────────────────────────────────────────┘

Contoh Kasus:
• User total score = 40 poin (AGRESIF)
• Tapi jawab Q7 = 1 (dana darurat < 1 bulan)
• VETO activate → Profile diubah jadi KONSERVATIF
• User di-inform: "Anda perlu emergency fund dulu sebelum agresif!"
```

### 🛡️ Portfolio Limit & Safeguards

```
Batasan untuk mencegah user terlalu berani:

1. Per-Transaction Limit:
   ├─ Max 10 LOT per transaksi
   ├─ Max Rp 500 juta per transaksi
   └─ Proteksi: Supaya tidak all-in 1 saham

2. Concentration Limit:
   ├─ Max 30% portfolio in 1 stock
   ├─ Contoh: Portfolio 100 juta, BBCA max 30 juta
   └─ Proteksi: Diversifikasi

3. Daily Loss Limit (Future):
   ├─ Jika portfolio P&L turun > 10% dalam 1 hari
   ├─ Warning: "Hati-hati, portfolio turun 10% hari ini"
   └─ Proteksi: Emotional trading

4. Sector Balance:
   ├─ Max 40% dalam 1 sektor (Keuangan, Industri, dll)
   └─ Proteksi: Avoid sector concentration
```

---

## 📌 RINGKASAN METODE

```
┌────────────────────────────────────────────────────────────────┐
│                   STOXAREA - METODE RINGKAS                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ TIER 1: PROFILING (Questionnaire)                            │
│ ├─ Input: 10 jawaban user                                    │
│ ├─ Metode: Simple weighted sum                               │
│ ├─ Output: Risk profile (Konservatif/Moderat/Agresif)       │
│ └─ Veto: Emergency fund check                                │
│                                                                │
│ TIER 2: AI SCORING (XGBoost)                                 │
│ ├─ Input: 11 technical indicators                            │
│ ├─ Metode: Binary classification (will price go up >5%?)    │
│ ├─ Output: Probability 0-100%                                │
│ ├─ Update: Daily (17:00)                                     │
│ └─ Explainability: SHAP values                               │
│                                                                │
│ TIER 3: RECOMMENDATION (SAW)                                 │
│ ├─ Input: AI score + Fundamental metrics (ROE, DER, PER)    │
│ ├─ Metode: SAW with profile-weighted criteria                │
│ ├─ Normalisasi: Min-max untuk benefit & cost criteria        │
│ ├─ Output: Top 10 saham rekomendasi + scores                │
│ └─ Personalisasi: Berdasarkan risk profile user              │
│                                                                │
│ VIRTUAL TRADING:                                              │
│ ├─ BUY: Validasi balance → Deduct → Record transaction       │
│ ├─ SELL: Validasi inventory → Calculate P&L → Add balance    │
│ ├─ Fee: 0.15% transaksi + Rp 5,000 admin                    │
│ └─ Atomic: Semua query dalam 1 transaction (all or nothing)  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

**Terima Kasih!** Dokumentasi lengkap 4 komponen sudah siap dalam Bahasa Indonesia. 🇮🇩

Gunakan dokumen ini untuk:
1. ✅ **Tugas/Laporan Akademik**: Lengkap dengan proses bisnis, diagram, dataset, metode
2. ✅ **Referensi Developer**: Detail API flow, database schema, algoritma
3. ✅ **Presentasi Stakeholder**: Penjelasan bisnis yang mudah dipahami
