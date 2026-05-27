# PERANCANGAN SISTEM STOXAREA
## Sistem Pendukung Keputusan Rekomendasi Saham Berbasis Machine Learning

---

**Mata Kuliah:** Proyek Sains Data  
**Tahap:** Perancangan Sistem  
**Platform:** E-Learning Universitas Putra Bangsa  

---

## DAFTAR ISI

1. [Proses Bisnis](#1-proses-bisnis)
2. [Rancangan Diagram](#2-rancangan-diagram)
3. [Rancangan Dataset](#3-rancangan-dataset)
4. [Metode yang Digunakan](#4-metode-yang-digunakan)

---

## 1. PROSES BISNIS

### 1.1 Deskripsi Sistem

**STOXAREA** adalah sistem pendukung keputusan (SPK) berbasis web yang memberikan rekomendasi saham Indonesia (IDX) menggunakan kombinasi Machine Learning (XGBoost) dan metode SAW (Simple Additive Weighting). Sistem ini dirancang untuk membantu investor retail dalam mengambil keputusan investasi yang lebih objektif dan terukur.

### 1.2 Alur Proses Bisnis

#### **A. User Registration & Risk Profiling**

1. User mengakses aplikasi web STOXAREA
2. User melakukan registrasi dengan email dan password
3. Sistem mengenkripsi password menggunakan bcrypt
4. User diarahkan ke halaman onboarding untuk mengisi kuesioner risk profiling
5. Kuesioner terdiri dari 10 pertanyaan tentang:
   - Tujuan investasi
   - Horizon waktu investasi
   - Toleransi risiko
   - Pengalaman investasi
   - Reaksi terhadap volatilitas pasar
6. Sistem menghitung total skor dan mengklasifikasikan user ke dalam 3 kategori:
   - **Konservatif** (skor 10-23): Prioritas pada stabilitas dan fundamental kuat
   - **Moderat** (skor 24-36): Keseimbangan antara pertumbuhan dan risiko
   - **Agresif** (skor 37-50): Fokus pada momentum dan potensi return tinggi
7. Profil risiko disimpan ke database dan digunakan untuk personalisasi rekomendasi

#### **B. Data Collection & ML Pipeline (Backend Automation)**

1. **Scheduler Initialization**
   - APScheduler berjalan otomatis setiap hari kerja (Senin-Jumat) jam 17:00 WIB
   - Scheduler memicu fungsi `run_daily_pipeline()`

2. **Data Collection**
   - Sistem mengunduh data OHLCV (Open, High, Low, Close, Volume) untuk 61 emiten IDX
   - Sumber data: Yahoo Finance API via library `yfinance`
   - Data historis: minimal 200 hari trading untuk perhitungan indikator teknikal
   - Data fundamental: PER, PBV, ROE, DER, EPS Growth

3. **Feature Engineering**
   - Sistem memproses data OHLCV untuk menghasilkan 11 fitur teknikal:
     - `log_ret_1d`: Log return 1 hari
     - `log_ret_5d`: Log return 5 hari
     - `ma_20_dist`: Jarak persentase harga ke Moving Average 20 hari
     - `ma_50_dist`: Jarak persentase harga ke Moving Average 50 hari
     - `bb_width`: Lebar Bollinger Bands (volatilitas)
     - `bb_position`: Posisi harga di Bollinger Bands (0-1)
     - `rsi_14`: Relative Strength Index 14 periode
     - `macd_norm`: MACD normalized terhadap harga
     - `macd_signal_norm`: MACD Signal normalized
     - `macd_hist_norm`: MACD Histogram normalized
     - `vol_ma_ratio`: Rasio volume terhadap moving average volume

4. **Target Generation**
   - Label klasifikasi: `target_5d_up`
   - Nilai 1: Jika harga tertinggi dalam 5 hari ke depan naik >5% dari harga close hari ini
   - Nilai 0: Jika tidak mencapai kenaikan 5%
   - Implementasi anti-leakage: menggunakan `shift(-1).rolling(5).max()` untuk memastikan tidak ada informasi masa depan yang bocor ke data training

5. **Model Training**
   - XGBoost Classifier dilatih dengan Walk-Forward Validation (TimeSeriesSplit 5 folds)
   - Handling class imbalance dengan parameter `scale_pos_weight`
   - Model dikalibrasi dengan Isotonic Regression untuk probabilitas yang akurat
   - Model disimpan ke disk: `models/xgb_model.pkl`

6. **Inference & AI Score Generation**
   - Model melakukan prediksi pada data terbaru (hari ini)
   - Output: Probabilitas harga naik >5% dalam 5 hari (AI Score 0-100%)
   - SHAP explainer menghitung kontribusi setiap fitur terhadap prediksi
   - Hasil disimpan ke: `data/processed/ai_scores.json`

#### **C. Recommendation Generation (SPK 3 Lapis)**

**SPK Lapis 1: User Profiling**
- Sistem mengambil profil risiko user dari database
- Menentukan bobot kriteria SAW berdasarkan profil:
  - Konservatif: Bobot tinggi pada PBV, ROE, DER (fundamental)
  - Moderat: Bobot seimbang antara fundamental dan AI Score
  - Agresif: Bobot tinggi pada AI Score dan momentum

**SPK Lapis 2: Veto Logic & Outlier Guard**
- Filter emiten dengan kriteria gugur:
  - EPS (Laba) negatif → `is_qualified = False`
  - Ekuitas negatif → `is_qualified = False`
  - PER negatif atau > 50 → gugur
  - PBV negatif atau > 10 → gugur
  - DER > 2.0 → gugur (kecuali sektor perbankan)
  - ROE < 5% → gugur
  - Corporate Action Guard: Jika harga berubah >35% dalam 1 hari, tandai untuk review manual
- Hanya emiten yang lolos veto yang masuk ke SPK Lapis 3

**SPK Lapis 3: SAW (Simple Additive Weighting)**
- Normalisasi kriteria:
  - **Benefit** (semakin besar semakin baik): AI Score, ROE, PBV
  - **Cost** (semakin kecil semakin baik): PER, DER
- Formula normalisasi:
  - Benefit: $r_{ij} = \frac{x_{ij}}{\max(x_j)}$
  - Cost: $r_{ij} = \frac{\min(x_j)}{x_{ij}}$
- Perhitungan skor akhir:
  - $V_i = \sum_{j=1}^{n} w_j \cdot r_{ij}$
  - $w_j$ = bobot kriteria sesuai profil user
- Ranking: Urutkan emiten berdasarkan $V_i$ tertinggi
- Output: Top 10 rekomendasi saham

#### **D. Virtual Trading**

1. **Buy Transaction**
   - User memilih saham dari rekomendasi atau market list
   - Input: jumlah lembar saham yang ingin dibeli
   - Sistem validasi: saldo virtual cukup untuk transaksi
   - Harga beli: harga close terkini dari Yahoo Finance
   - Jika user sudah memiliki saham yang sama:
     - Update average cost: $\text{avg\_cost} = \frac{(\text{shares\_old} \times \text{avg\_cost\_old}) + (\text{shares\_new} \times \text{price\_new})}{\text{shares\_old} + \text{shares\_new}}$
   - Kurangi saldo virtual user
   - Simpan transaksi ke tabel `transactions`

2. **Sell Transaction**
   - User memilih saham dari portfolio
   - Input: jumlah lembar saham yang ingin dijual
   - Sistem validasi: jumlah saham di portfolio cukup
   - Harga jual: harga close terkini
   - Hitung profit/loss: $\text{P/L} = (\text{price\_sell} - \text{avg\_cost}) \times \text{shares\_sold}$
   - Tambah saldo virtual user
   - Update atau hapus portfolio entry jika semua saham terjual
   - Simpan transaksi ke tabel `transactions`

3. **Portfolio Calculation**
   - Real-time update nilai portfolio:
     - $\text{Market Value} = \sum (\text{shares}_i \times \text{current\_price}_i)$
     - $\text{Total Cost} = \sum (\text{shares}_i \times \text{avg\_cost}_i)$
     - $\text{Unrealized P/L} = \text{Market Value} - \text{Total Cost}$
     - $\text{Return \%} = \frac{\text{Unrealized P/L}}{\text{Total Cost}} \times 100\%$

#### **E. Market Analysis & Explainability**

1. **Stock Detail Page**
   - Menampilkan informasi lengkap saham:
     - Harga terkini, perubahan harian
     - Data fundamental: PER, PBV, ROE, DER, Market Cap
     - AI Score dengan interpretasi (Bearish/Neutral/Bullish)
     - Indikator teknikal: RSI, MACD, Bollinger Bands
     - Candlestick chart interaktif (TradingView style)

2. **SHAP Explainability**
   - Menampilkan kontribusi setiap fitur terhadap AI Score
   - Visualisasi waterfall chart:
     - Base value (rata-rata prediksi model)
     - Kontribusi positif (mendorong harga naik)
     - Kontribusi negatif (menekan harga turun)
     - Final prediction (AI Score)
   - Interpretasi dalam bahasa natural untuk user

3. **Last Update Timestamp**
   - Setiap data (fundamental, teknikal, AI Score) menampilkan timestamp terakhir update
   - User dapat mengetahui kesegaran data yang digunakan

---

## 2. RANCANGAN DIAGRAM

### 2.1 Flowchart Alur Sistem Rekomendasi

```
┌─────────────────────────────────────────────────────────────┐
│                        START                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   User Login         │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Ambil Risk Profile   │
              │ dari Database        │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Load AI Score        │
              │ (dari ML Pipeline)   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Load Data Fundamental│
              │ (PER, PBV, ROE, DER) │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ SPK Lapis 2:         │
              │ Veto Logic           │
              │ (Filter Outlier)     │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ SPK Lapis 3:         │
              │ SAW Ranking          │
              │ (Weighted Scoring)   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Tampilkan Top 10     │
              │ Rekomendasi Saham    │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │        END           │
              └──────────────────────┘
```

### 2.2 Flowchart ML Pipeline (Background Scheduler)

```
┌─────────────────────────────────────────────────────────────┐
│              Scheduler Trigger (Senin-Jumat 17:00)          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Download OHLCV Data  │
              │ (Yahoo Finance API)  │
              │ 61 Emiten IDX        │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Feature Engineering  │
              │ - Log Returns        │
              │ - Moving Averages    │
              │ - Bollinger Bands    │
              │ - RSI, MACD          │
              │ - Volume Ratio       │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Target Generation    │
              │ (Naik >5% dalam 5d)  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Train XGBoost Model  │
              │ - Walk-Forward Val   │
              │ - Class Imbalance    │
              │ - Isotonic Calib     │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Save Model to Disk   │
              │ (xgb_model.pkl)      │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Inference (Predict)  │
              │ AI Score untuk       │
              │ Data Terbaru         │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ SHAP Explainer       │
              │ (Feature Importance) │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Save AI Scores       │
              │ (ai_scores.json)     │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │        END           │
              └──────────────────────┘
```

### 2.3 ERD (Entity Relationship Diagram)

```
┌─────────────────────┐
│       User          │
├─────────────────────┤
│ id (PK)             │◄──────────┐
│ email (UNIQUE)      │           │
│ hashed_password     │           │ 1
│ full_name           │           │
│ risk_profile        │           │
│ virtual_balance     │           │
│ created_at          │           │
│ updated_at          │           │
└─────────────────────┘           │
                                  │
                                  │ N
                       ┌──────────┴──────────┐
                       │     Portfolio       │
                       ├─────────────────────┤
                       │ id (PK)             │◄──────────┐
                       │ user_id (FK)        │           │
                       │ ticker              │           │ 1
                       │ shares              │           │
                       │ avg_cost            │           │
                       │ created_at          │           │
                       │ updated_at          │           │
                       └─────────────────────┘           │
                                                         │
                                                         │ N
                              ┌──────────────────────┐
                              │    Transaction       │
                              ├──────────────────────┤
                              │ id (PK)              │
                              │ portfolio_id (FK)    │
                              │ type (BUY/SELL)      │
                              │ shares               │
                              │ price                │
                              │ total_amount         │
                              │ timestamp            │
                              └──────────────────────┘

┌─────────────────────┐
│       Stock         │
├─────────────────────┤
│ ticker (PK)         │◄──────────┐
│ name                │           │
│ sector              │           │ 1
│ last_price          │           │
│ change_pct          │           │
│ updated_at          │           │
└─────────────────────┘           │
                                  │
                                  │ 1
                       ┌──────────┴──────────┐
                       │    Financials       │
                       ├─────────────────────┤
                       │ id (PK)             │
                       │ ticker (FK)         │
                       │ per                 │
                       │ pbv                 │
                       │ roe                 │
                       │ der                 │
                       │ eps_growth          │
                       │ market_cap          │
                       │ updated_at          │
                       └─────────────────────┘

┌─────────────────────┐
│  CorporateAction    │
├─────────────────────┤
│ id (PK)             │
│ ticker              │
│ action_type         │
│ action_date         │
│ description         │
│ created_at          │
└─────────────────────┘
```

### 2.4 DFD Level 0 (Context Diagram)

```
                    ┌──────────────────────────────┐
                    │                              │
                    │         STOXAREA             │
                    │         SYSTEM               │
                    │                              │
                    │  - Authentication            │
┌──────────┐        │  - Risk Profiling            │        ┌──────────────┐
│          │────────│  - Recommendation Engine     │────────│              │
│   User   │  Login │  - Virtual Trading           │  Data  │ Yahoo Finance│
│          │  Trade │  - Portfolio Management      │ Request│     API      │
│          │◄───────│  - Market Analysis           │◄───────│              │
└──────────┘  Reco  │  - SHAP Explainability       │  OHLCV └──────────────┘
              P/L   │                              │  Fund
                    └──────────────────────────────┘
```

### 2.5 DFD Level 1 (Detailed Process)

```
                                    ┌─────────────────┐
                                    │  Yahoo Finance  │
                                    │      API        │
                                    └────────┬────────┘
                                             │ OHLCV + Fundamental
                                             ▼
┌──────────┐         ┌────────────────────────────────────────┐
│          │  Login  │                                        │
│   User   │────────▶│  1.0 Authentication                    │
│          │         │  (JWT Token Generation)                │
└──────────┘         └────────────┬───────────────────────────┘
     │                             │ User Data
     │                             ▼
     │               ┌─────────────────────────────┐
     │  Answers      │                             │
     │──────────────▶│  2.0 Risk Profiling         │
     │               │  (Questionnaire Scoring)    │
     │               └─────────────┬───────────────┘
     │                             │ Risk Profile
     │                             ▼
     │               ┌─────────────────────────────┐
     │               │                             │
     │               │  3.0 ML Pipeline            │
     │               │  - Feature Engineering      │
     │               │  - XGBoost Training         │
     │               │  - AI Score Generation      │
     │               └─────────────┬───────────────┘
     │                             │ AI Scores
     │                             ▼
     │               ┌─────────────────────────────┐
     │  Request      │                             │
     │──────────────▶│  4.0 SPK Recommendation     │
     │               │  - Veto Logic               │
     │               │  - SAW Ranking              │
     │               └─────────────┬───────────────┘
     │                             │ Top 10 Stocks
     │                             ▼
     │◄──────────────────────────────────────────────
     │               Recommendations
     │
     │               ┌─────────────────────────────┐
     │  Buy/Sell     │                             │
     │──────────────▶│  5.0 Virtual Trading        │
     │               │  - Transaction Processing   │
     │               │  - Portfolio Update         │
     │               └─────────────┬───────────────┘
     │                             │ Transaction Record
     │                             ▼
     │               ┌─────────────────────────────┐
     │               │      Database               │
     │               │  (PostgreSQL)               │
     │               └─────────────────────────────┘
     │
     │◄──────────────────────────────────────────────
                     Portfolio & P/L Report
```

### 2.6 Use Case Diagram

```
                    ┌───────────────────────────────────────┐
                    │        STOXAREA SYSTEM                │
                    │                                       │
┌──────────┐        │  ┌─────────────────────────────────┐ │
│          │        │  │  UC-01: Register                │ │
│          │───────────│  UC-02: Login                   │ │
│          │        │  │  UC-03: Fill Risk Profile       │ │
│   User   │───────────│  UC-04: View Recommendations    │ │
│          │        │  │  UC-05: View Stock Detail       │ │
│          │───────────│  UC-06: Virtual Buy Stock       │ │
│          │        │  │  UC-07: Virtual Sell Stock      │ │
│          │───────────│  UC-08: View Portfolio          │ │
│          │        │  │  UC-09: View Transaction History│ │
│          │───────────│  UC-10: View SHAP Explanation   │ │
└──────────┘        │  └─────────────────────────────────┘ │
                    │                                       │
                    │  ┌─────────────────────────────────┐ │
┌──────────┐        │  │  UC-11: Trigger ML Pipeline     │ │
│Background│───────────│  UC-12: Download Market Data    │ │
│Scheduler │        │  │  UC-13: Train XGBoost Model     │ │
└──────────┘        │  │  UC-14: Generate AI Scores      │ │
                    │  └─────────────────────────────────┘ │
                    │                                       │
                    │  ┌─────────────────────────────────┐ │
┌──────────┐        │  │  UC-15: Retrain Model           │ │
│  Admin   │───────────│  UC-16: View Model Metrics      │ │
└──────────┘        │  │  UC-17: Flag Corporate Action   │ │
                    │  └─────────────────────────────────┘ │
                    └───────────────────────────────────────┘
```

---

## 3. RANCANGAN DATASET

### 3.1 Dataset OHLCV (Raw Data)

**Lokasi:** `data/raw/ohlcv/*.csv`  
**Sumber:** Yahoo Finance API via library `yfinance`  
**Jumlah File:** 61 file CSV (satu file per emiten)  
**Format Nama File:** `{TICKER}.csv` (contoh: `BBCA.JK.csv`)

**Struktur Data:**

| Kolom | Tipe Data | Keterangan | Contoh |
|-------|-----------|------------|--------|
| Date | datetime | Tanggal trading | 2024-05-26 |
| Open | float | Harga pembukaan | 9750.0 |
| High | float | Harga tertinggi hari itu | 9825.0 |
| Low | float | Harga terendah hari itu | 9700.0 |
| Close | float | Harga penutupan | 9800.0 |
| Volume | int | Volume transaksi (lembar) | 15234000 |

**Karakteristik:**
- Data historis minimal 200 hari trading
- Diupdate setiap hari kerja jam 17:00 WIB
- Missing data handling: forward fill untuk hari libur


### 3.2 Dataset Fundamental (Raw Data)

**Lokasi:** `data/raw/fundamental.csv`  
**Sumber:** Yahoo Finance API  
**Update Frequency:** Setiap hari kerja

**Struktur Data:**

| Kolom | Tipe Data | Keterangan | Contoh |
|-------|-----------|------------|--------|
| ticker | string | Kode saham IDX | BBCA.JK |
| name | string | Nama perusahaan | Bank Central Asia Tbk |
| sector | string | Sektor industri | Financials |
| per | float | Price to Earnings Ratio | 18.5 |
| pbv | float | Price to Book Value | 4.2 |
| roe | float | Return on Equity (%) | 22.5 |
| der | float | Debt to Equity Ratio | 0.35 |
| eps_growth | float | EPS Growth YoY (%) | 12.3 |
| market_cap | float | Market Capitalization (Miliar Rp) | 1250000 |
| updated_at | datetime | Timestamp update terakhir | 2024-05-26 17:05:00 |

**Karakteristik:**
- Data fundamental diambil dari laporan keuangan terbaru
- Nilai negatif pada PER/PBV mengindikasikan perusahaan merugi
- DER tinggi (>2.0) mengindikasikan leverage tinggi

### 3.3 Dataset Features & Targets (Processed)

**Lokasi:** `data/processed/features_targets.csv`  
**Hasil:** Feature engineering dari data OHLCV  
**Digunakan untuk:** Training dan inference XGBoost model

**Struktur Data:**

| Kolom | Tipe Data | Keterangan | Range | Contoh |
|-------|-----------|------------|-------|--------|
| ticker | string | Kode saham | - | BBCA.JK |
| Date | datetime | Tanggal | - | 2024-05-26 |
| log_ret_1d | float | Log return 1 hari | -0.1 to 0.1 | 0.0052 |
| log_ret_5d | float | Log return 5 hari | -0.3 to 0.3 | 0.0234 |
| ma_20_dist | float | Jarak % ke MA20 | -0.2 to 0.2 | 0.0125 |
| ma_50_dist | float | Jarak % ke MA50 | -0.3 to 0.3 | 0.0456 |
| bb_width | float | Lebar Bollinger Bands | 0.01 to 0.15 | 0.0523 |
| bb_position | float | Posisi di BB (0=bawah, 1=atas) | 0 to 1 | 0.65 |
| rsi_14 | float | RSI 14 periode | 0 to 100 | 58.3 |
| macd_norm | float | MACD normalized | -0.05 to 0.05 | 0.0012 |
| macd_signal_norm | float | MACD Signal normalized | -0.05 to 0.05 | 0.0008 |
| macd_hist_norm | float | MACD Histogram normalized | -0.02 to 0.02 | 0.0004 |
| vol_ma_ratio | float | Volume vs MA Volume | 0.1 to 5.0 | 1.23 |
| target_5d_up | int | Label: 1 jika naik >5% dalam 5d | 0 or 1 | 1 |
| is_latest | bool | True jika data terbaru (inferensi) | True/False | False |

**Karakteristik:**
- Total baris: ~12,000 (61 emiten × ~200 hari)
- Training data: `is_latest = False`
- Inference data: `is_latest = True` (61 baris, satu per emiten)
- Missing values: Dihapus setelah perhitungan MA50

### 3.4 Dataset AI Scores (Output ML)

**Lokasi:** `data/processed/ai_scores.json`  
**Hasil:** Prediksi XGBoost + SHAP values  
**Update:** Setiap hari kerja setelah ML pipeline selesai

**Struktur Data (JSON):**

```json
{
  "BBCA.JK": {
    "ai_score": 0.73,
    "interpretation": "Bullish",
    "shap_values": {
      "log_ret_1d": 0.05,
      "log_ret_5d": 0.12,
      "ma_20_dist": 0.08,
      "ma_50_dist": 0.03,
      "bb_width": -0.02,
      "bb_position": 0.15,
      "rsi_14": 0.10,
      "macd_norm": 0.07,
      "macd_signal_norm": 0.04,
      "macd_hist_norm": 0.06,
      "vol_ma_ratio": 0.05
    },
    "base_value": 0.35,
    "updated_at": "2024-05-26T17:15:00"
  },
  "BBRI.JK": {
    "ai_score": 0.42,
    "interpretation": "Neutral",
    ...
  }
}
```

**Interpretasi AI Score:**
- **0.00 - 0.40:** Bearish (probabilitas rendah naik >5%)
- **0.40 - 0.60:** Neutral (tidak ada sinyal kuat)
- **0.60 - 1.00:** Bullish (probabilitas tinggi naik >5%)


### 3.5 Database Schema (PostgreSQL)

#### Tabel: `users`

| Kolom | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ID unik user |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email login |
| hashed_password | VARCHAR(255) | NOT NULL | Password terenkripsi (bcrypt) |
| full_name | VARCHAR(255) | NOT NULL | Nama lengkap |
| risk_profile | VARCHAR(50) | NOT NULL | Konservatif/Moderat/Agresif |
| virtual_balance | DECIMAL(15,2) | DEFAULT 100000000 | Saldo virtual (Rp 100 juta) |
| created_at | TIMESTAMP | DEFAULT NOW() | Waktu registrasi |
| updated_at | TIMESTAMP | DEFAULT NOW() | Waktu update terakhir |

#### Tabel: `portfolios`

| Kolom | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ID unik portfolio |
| user_id | INTEGER | FOREIGN KEY (users.id), NOT NULL | Referensi ke user |
| ticker | VARCHAR(20) | NOT NULL | Kode saham |
| shares | INTEGER | NOT NULL | Jumlah lembar saham |
| avg_cost | DECIMAL(15,2) | NOT NULL | Harga rata-rata pembelian |
| created_at | TIMESTAMP | DEFAULT NOW() | Waktu pembelian pertama |
| updated_at | TIMESTAMP | DEFAULT NOW() | Waktu update terakhir |

**Constraint:** UNIQUE(user_id, ticker) - Satu user hanya punya satu entry per ticker

#### Tabel: `transactions`

| Kolom | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ID unik transaksi |
| portfolio_id | INTEGER | FOREIGN KEY (portfolios.id), NOT NULL | Referensi ke portfolio |
| type | VARCHAR(10) | NOT NULL | BUY atau SELL |
| shares | INTEGER | NOT NULL | Jumlah lembar |
| price | DECIMAL(15,2) | NOT NULL | Harga per lembar |
| total_amount | DECIMAL(15,2) | NOT NULL | Total nilai transaksi |
| timestamp | TIMESTAMP | DEFAULT NOW() | Waktu transaksi |

#### Tabel: `stocks`

| Kolom | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| ticker | VARCHAR(20) | PRIMARY KEY | Kode saham (e.g., BBCA.JK) |
| name | VARCHAR(255) | NOT NULL | Nama perusahaan |
| sector | VARCHAR(100) | NOT NULL | Sektor industri |
| last_price | DECIMAL(15,2) | NOT NULL | Harga terakhir |
| change_pct | DECIMAL(5,2) | NOT NULL | Perubahan harian (%) |
| updated_at | TIMESTAMP | DEFAULT NOW() | Waktu update terakhir |

#### Tabel: `financials`

| Kolom | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ID unik |
| ticker | VARCHAR(20) | FOREIGN KEY (stocks.ticker), NOT NULL | Referensi ke stocks |
| per | DECIMAL(10,2) | NULL | Price to Earnings Ratio |
| pbv | DECIMAL(10,2) | NULL | Price to Book Value |
| roe | DECIMAL(10,2) | NULL | Return on Equity (%) |
| der | DECIMAL(10,2) | NULL | Debt to Equity Ratio |
| eps_growth | DECIMAL(10,2) | NULL | EPS Growth YoY (%) |
| market_cap | DECIMAL(20,2) | NULL | Market Cap (Miliar Rp) |
| updated_at | TIMESTAMP | DEFAULT NOW() | Waktu update terakhir |

#### Tabel: `corporate_actions`

| Kolom | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ID unik |
| ticker | VARCHAR(20) | NOT NULL | Kode saham |
| action_type | VARCHAR(50) | NOT NULL | SPLIT, DIVIDEND, RIGHTS, dll |
| action_date | DATE | NOT NULL | Tanggal aksi korporasi |
| description | TEXT | NULL | Deskripsi detail |
| created_at | TIMESTAMP | DEFAULT NOW() | Waktu pencatatan |

---

## 4. METODE YANG DIGUNAKAN

### 4.1 Machine Learning

#### A. XGBoost Classifier

**Deskripsi:**  
XGBoost (Extreme Gradient Boosting) adalah algoritma ensemble learning berbasis decision tree yang menggunakan teknik gradient boosting. Model ini dipilih karena:
- Performa tinggi pada data tabular
- Handling missing values secara otomatis
- Regularization untuk mencegah overfitting
- Feature importance built-in

**Hyperparameters:**
```python
{
  "n_estimators": 150,        # Jumlah trees
  "max_depth": 4,             # Kedalaman maksimal tree
  "learning_rate": 0.05,      # Learning rate (eta)
  "objective": "binary:logistic",  # Binary classification
  "eval_metric": "logloss",   # Evaluation metric
  "scale_pos_weight": 3.5,    # Kompensasi class imbalance
  "random_state": 42,         # Reproducibility
  "n_jobs": -1                # Parallel processing
}
```

**Handling Class Imbalance:**  
Pada data saham IDX, kejadian "naik >5% dalam 5 hari" adalah minoritas (~22% dari total data). Tanpa penanganan, model akan bias ke kelas mayoritas (tidak naik). Solusi:
- `scale_pos_weight = n_neg / n_pos` (sekitar 3.5)
- Memberikan bobot lebih tinggi pada sampel kelas minoritas
- Model menjadi lebih sensitif terhadap sinyal momentum naik


**Calibrated Classifier:**  
XGBoost raw output tidak selalu menghasilkan probabilitas yang akurat. Untuk mendapatkan probabilitas yang reliable, model di-wrap dengan `CalibratedClassifierCV`:
```python
from sklearn.calibration import CalibratedClassifierCV

base_model = xgb.XGBClassifier(...)
calibrated_model = CalibratedClassifierCV(
    base_model, 
    method='isotonic',  # Isotonic regression
    cv=5                # 5-fold cross-validation
)
```

**Manfaat Kalibrasi:**
- Probabilitas output lebih akurat dan dapat diinterpretasikan
- AI Score 0.70 benar-benar berarti "70% kemungkinan naik >5%"
- Penting untuk decision making user

#### B. Walk-Forward Validation

**Deskripsi:**  
Time series data tidak boleh di-split secara random karena akan menyebabkan data leakage (informasi masa depan bocor ke training). Walk-Forward Validation menggunakan `TimeSeriesSplit` dari scikit-learn:

```
Fold 1: Train [1:100]  → Test [101:120]
Fold 2: Train [1:120]  → Test [121:140]
Fold 3: Train [1:140]  → Test [141:160]
Fold 4: Train [1:160]  → Test [161:180]
Fold 5: Train [1:180]  → Test [181:200]
```

**Keuntungan:**
- Simulasi kondisi real-world (training dengan data masa lalu, prediksi masa depan)
- Evaluasi performa model secara robust
- Deteksi overfitting pada time series

**Metrics yang Digunakan:**
- **Accuracy:** Persentase prediksi benar
- **Precision:** Dari semua prediksi "naik", berapa yang benar-benar naik
  - Formula: $\text{Precision} = \frac{TP}{TP + FP}$
  - Penting untuk menghindari false positive (rekomendasi saham yang ternyata turun)

#### C. SHAP (SHapley Additive exPlanations)

**Deskripsi:**  
SHAP adalah metode explainable AI berbasis game theory yang menjelaskan kontribusi setiap fitur terhadap prediksi model. Untuk setiap prediksi, SHAP menghitung:

$$\text{Prediction} = \text{Base Value} + \sum_{i=1}^{n} \text{SHAP}_i$$

**Komponen:**
- **Base Value:** Rata-rata prediksi model di seluruh training data
- **SHAP Value:** Kontribusi fitur ke-i terhadap prediksi
  - Positif: Fitur mendorong harga naik
  - Negatif: Fitur menekan harga turun

**Implementasi:**
```python
import shap

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
```

**Visualisasi:**
- **Waterfall Chart:** Menampilkan kontribusi setiap fitur secara berurutan
- **Force Plot:** Visualisasi interaktif kontribusi fitur
- **Summary Plot:** Feature importance global

**Manfaat untuk User:**
- Transparansi: User tahu kenapa saham direkomendasikan
- Trust: Bukan "black box", tapi explainable
- Edukasi: User belajar faktor apa yang mempengaruhi harga saham

### 4.2 Sistem Pendukung Keputusan (SPK)

#### A. SPK Lapis 1: User Risk Profiling

**Metode:** Kuesioner Scoring System

**Kuesioner (10 Pertanyaan):**
1. Tujuan investasi Anda?
   - Preservasi modal (1 poin)
   - Pendapatan stabil (2 poin)
   - Pertumbuhan moderat (3 poin)
   - Pertumbuhan agresif (4 poin)
   - Spekulasi (5 poin)

2. Berapa lama horizon investasi Anda?
   - < 1 tahun (1 poin)
   - 1-3 tahun (2 poin)
   - 3-5 tahun (3 poin)
   - 5-10 tahun (4 poin)
   - > 10 tahun (5 poin)

3. Jika portfolio Anda turun 20% dalam sebulan, apa yang Anda lakukan?
   - Jual semua (1 poin)
   - Jual sebagian (2 poin)
   - Hold (3 poin)
   - Beli lebih banyak (4 poin)
   - All-in (5 poin)

4. Pengalaman investasi saham Anda?
   - Tidak ada (1 poin)
   - < 1 tahun (2 poin)
   - 1-3 tahun (3 poin)
   - 3-5 tahun (4 poin)
   - > 5 tahun (5 poin)

5. Berapa persen dari total aset Anda yang dialokasikan ke saham?
   - < 10% (1 poin)
   - 10-25% (2 poin)
   - 25-50% (3 poin)
   - 50-75% (4 poin)
   - > 75% (5 poin)

6. Return tahunan yang Anda harapkan?
   - 5-10% (1 poin)
   - 10-15% (2 poin)
   - 15-20% (3 poin)
   - 20-30% (4 poin)
   - > 30% (5 poin)

7. Seberapa sering Anda memantau portfolio?
   - Sebulan sekali (1 poin)
   - Seminggu sekali (2 poin)
   - Beberapa kali seminggu (3 poin)
   - Setiap hari (4 poin)
   - Setiap jam (5 poin)

8. Preferensi Anda terhadap dividen vs capital gain?
   - Dividen tinggi, growth rendah (1 poin)
   - Dividen moderat, growth moderat (3 poin)
   - Tidak peduli dividen, fokus growth (5 poin)

9. Jika ada saham yang naik 50% dalam 3 bulan, apa yang Anda lakukan?
   - Take profit semua (1 poin)
   - Take profit sebagian (2 poin)
   - Hold (3 poin)
   - Beli lebih banyak (4 poin)
   - Leverage (5 poin)

10. Sektor saham yang Anda minati?
    - Blue-chip stabil (1 poin)
    - Dividend aristocrats (2 poin)
    - Growth stocks (3 poin)
    - Small-cap growth (4 poin)
    - Penny stocks (5 poin)

**Klasifikasi:**
- **Konservatif:** Skor 10-23
  - Prioritas: Stabilitas, fundamental kuat, dividen
  - Toleransi risiko: Rendah
  
- **Moderat:** Skor 24-36
  - Prioritas: Keseimbangan growth dan stabilitas
  - Toleransi risiko: Sedang
  
- **Agresif:** Skor 37-50
  - Prioritas: Momentum, growth, high return
  - Toleransi risiko: Tinggi


#### B. SPK Lapis 2: Veto Logic & Outlier Guard

**Tujuan:**  
Memfilter emiten yang memiliki data anomali atau fundamental bermasalah sebelum masuk ke ranking SAW.

**Aturan Veto:**

1. **Laba Negatif (EPS < 0)**
   - Emiten yang merugi otomatis gugur
   - Alasan: PER negatif tidak bisa dinormalisasi dalam SAW
   - Pengecualian: Tidak ada

2. **Ekuitas Negatif**
   - Emiten dengan total utang > total aset gugur
   - Alasan: PBV negatif, perusahaan dalam kondisi insolvensi
   - Pengecualian: Tidak ada

3. **PER Ekstrem**
   - PER < 0 atau PER > 50 → gugur
   - Alasan: PER negatif = rugi, PER > 50 = overvalued ekstrem
   - Pengecualian: Sektor teknologi (PER bisa tinggi)

4. **PBV Ekstrem**
   - PBV < 0 atau PBV > 10 → gugur
   - Alasan: PBV negatif = ekuitas negatif, PBV > 10 = overvalued
   - Pengecualian: Tidak ada

5. **DER Tinggi**
   - DER > 2.0 → gugur
   - Alasan: Leverage terlalu tinggi, risiko default
   - Pengecualian: Sektor perbankan (DER tinggi adalah normal)

6. **ROE Rendah**
   - ROE < 5% → gugur
   - Alasan: Profitabilitas terlalu rendah
   - Pengecualian: Tidak ada

7. **Corporate Action Guard**
   - Jika harga berubah > 35% dalam 1 hari → flag untuk review manual
   - Alasan: Kemungkinan stock split, reverse split, atau right issue
   - Tindakan: Suspend update data emiten tersebut hingga admin validasi

**Implementasi:**
```python
def apply_veto_logic(df):
    df["is_qualified"] = True
    
    # Veto 1: Laba negatif
    df.loc[df["eps"] < 0, "is_qualified"] = False
    
    # Veto 2: Ekuitas negatif
    df.loc[df["equity"] < 0, "is_qualified"] = False
    
    # Veto 3: PER ekstrem
    df.loc[(df["per"] < 0) | (df["per"] > 50), "is_qualified"] = False
    
    # Veto 4: PBV ekstrem
    df.loc[(df["pbv"] < 0) | (df["pbv"] > 10), "is_qualified"] = False
    
    # Veto 5: DER tinggi (kecuali perbankan)
    df.loc[(df["der"] > 2.0) & (df["sector"] != "Financials"), "is_qualified"] = False
    
    # Veto 6: ROE rendah
    df.loc[df["roe"] < 5, "is_qualified"] = False
    
    return df[df["is_qualified"]]
```

#### C. SPK Lapis 3: SAW (Simple Additive Weighting)

**Deskripsi:**  
SAW adalah metode Multi-Criteria Decision Making (MCDM) yang menghitung skor akhir berdasarkan weighted sum dari kriteria yang telah dinormalisasi.

**Kriteria yang Digunakan:**

| Kriteria | Tipe | Keterangan |
|----------|------|------------|
| AI Score | Benefit | Probabilitas naik >5% (dari XGBoost) |
| PER | Cost | Price to Earnings Ratio (semakin rendah semakin baik) |
| PBV | Benefit | Price to Book Value (untuk value investing) |
| ROE | Benefit | Return on Equity (profitabilitas) |
| DER | Cost | Debt to Equity Ratio (semakin rendah semakin baik) |

**Bobot Kriteria Berdasarkan Profil Risiko:**

| Kriteria | Konservatif | Moderat | Agresif |
|----------|-------------|---------|---------|
| AI Score | 0.15 | 0.30 | 0.50 |
| PER | 0.25 | 0.20 | 0.10 |
| PBV | 0.20 | 0.15 | 0.10 |
| ROE | 0.25 | 0.20 | 0.15 |
| DER | 0.15 | 0.15 | 0.15 |
| **Total** | **1.00** | **1.00** | **1.00** |

**Interpretasi Bobot:**
- **Konservatif:** Fokus pada fundamental (PER, ROE, PBV), AI Score hanya 15%
- **Moderat:** Keseimbangan antara fundamental dan momentum
- **Agresif:** Fokus pada momentum (AI Score 50%), fundamental hanya validasi

**Langkah-langkah SAW:**

**1. Normalisasi Kriteria**

Untuk kriteria **Benefit** (semakin besar semakin baik):
$$r_{ij} = \frac{x_{ij}}{\max(x_j)}$$

Untuk kriteria **Cost** (semakin kecil semakin baik):
$$r_{ij} = \frac{\min(x_j)}{x_{ij}}$$

Dimana:
- $r_{ij}$ = nilai normalisasi alternatif ke-i pada kriteria ke-j
- $x_{ij}$ = nilai asli alternatif ke-i pada kriteria ke-j
- $\max(x_j)$ = nilai maksimum pada kriteria ke-j
- $\min(x_j)$ = nilai minimum pada kriteria ke-j

**Contoh Normalisasi:**

Data mentah:
| Ticker | AI Score | PER | PBV | ROE | DER |
|--------|----------|-----|-----|-----|-----|
| BBCA.JK | 0.73 | 18.5 | 4.2 | 22.5 | 0.35 |
| BBRI.JK | 0.65 | 12.3 | 2.8 | 18.2 | 0.52 |
| TLKM.JK | 0.58 | 15.6 | 3.1 | 15.8 | 0.68 |

Normalisasi:
- AI Score (Benefit): max = 0.73
  - BBCA: 0.73 / 0.73 = 1.00
  - BBRI: 0.65 / 0.73 = 0.89
  - TLKM: 0.58 / 0.73 = 0.79

- PER (Cost): min = 12.3
  - BBCA: 12.3 / 18.5 = 0.66
  - BBRI: 12.3 / 12.3 = 1.00
  - TLKM: 12.3 / 15.6 = 0.79

- PBV (Benefit): max = 4.2
  - BBCA: 4.2 / 4.2 = 1.00
  - BBRI: 2.8 / 4.2 = 0.67
  - TLKM: 3.1 / 4.2 = 0.74

- ROE (Benefit): max = 22.5
  - BBCA: 22.5 / 22.5 = 1.00
  - BBRI: 18.2 / 22.5 = 0.81
  - TLKM: 15.8 / 22.5 = 0.70

- DER (Cost): min = 0.35
  - BBCA: 0.35 / 0.35 = 1.00
  - BBRI: 0.35 / 0.52 = 0.67
  - TLKM: 0.35 / 0.68 = 0.51

**2. Perhitungan Skor Akhir**

Formula:
$$V_i = \sum_{j=1}^{n} w_j \cdot r_{ij}$$

Dimana:
- $V_i$ = skor akhir alternatif ke-i
- $w_j$ = bobot kriteria ke-j
- $r_{ij}$ = nilai normalisasi alternatif ke-i pada kriteria ke-j
- $n$ = jumlah kriteria

**Contoh untuk Profil Agresif:**

BBCA.JK:
$$V_{BBCA} = (0.50 \times 1.00) + (0.10 \times 0.66) + (0.10 \times 1.00) + (0.15 \times 1.00) + (0.15 \times 1.00)$$
$$V_{BBCA} = 0.50 + 0.066 + 0.10 + 0.15 + 0.15 = 0.966$$

BBRI.JK:
$$V_{BBRI} = (0.50 \times 0.89) + (0.10 \times 1.00) + (0.10 \times 0.67) + (0.15 \times 0.81) + (0.15 \times 0.67)$$
$$V_{BBRI} = 0.445 + 0.10 + 0.067 + 0.122 + 0.101 = 0.835$$

TLKM.JK:
$$V_{TLKM} = (0.50 \times 0.79) + (0.10 \times 0.79) + (0.10 \times 0.74) + (0.15 \times 0.70) + (0.15 \times 0.51)$$
$$V_{TLKM} = 0.395 + 0.079 + 0.074 + 0.105 + 0.077 = 0.730$$

**3. Ranking**

Urutkan berdasarkan $V_i$ tertinggi:
1. BBCA.JK (0.966)
2. BBRI.JK (0.835)
3. TLKM.JK (0.730)

**Output:** Top 10 rekomendasi saham


### 4.3 Technical Analysis

#### A. Indikator Teknikal yang Digunakan

**1. Moving Averages (MA)**

**Deskripsi:**  
Rata-rata harga dalam periode tertentu untuk mengidentifikasi trend.

**Formula:**
$$MA_n = \frac{1}{n} \sum_{i=0}^{n-1} Close_{t-i}$$

**Implementasi:**
- MA20: Moving Average 20 hari
- MA50: Moving Average 50 hari

**Interpretasi:**
- Harga > MA: Trend naik (bullish)
- Harga < MA: Trend turun (bearish)
- Golden Cross (MA20 > MA50): Sinyal beli
- Death Cross (MA20 < MA50): Sinyal jual

**Feature Engineering:**
```python
ma_20 = close.rolling(20).mean()
ma_50 = close.rolling(50).mean()
df["ma_20_dist"] = (close - ma_20) / ma_20  # Jarak persentase
df["ma_50_dist"] = (close - ma_50) / ma_50
```

**2. Bollinger Bands**

**Deskripsi:**  
Envelope volatilitas yang terdiri dari MA dan 2 standar deviasi.

**Formula:**
$$BB_{upper} = MA_{20} + (2 \times \sigma_{20})$$
$$BB_{lower} = MA_{20} - (2 \times \sigma_{20})$$

**Interpretasi:**
- Harga di BB upper: Overbought (potensi koreksi)
- Harga di BB lower: Oversold (potensi rebound)
- BB width menyempit: Volatilitas rendah, potensi breakout
- BB width melebar: Volatilitas tinggi

**Feature Engineering:**
```python
std_20 = close.rolling(20).std()
bb_upper = ma_20 + (std_20 * 2)
bb_lower = ma_20 - (std_20 * 2)
df["bb_width"] = (bb_upper - bb_lower) / ma_20
df["bb_position"] = (close - bb_lower) / (bb_upper - bb_lower)
```

**3. RSI (Relative Strength Index)**

**Deskripsi:**  
Momentum oscillator yang mengukur kecepatan dan perubahan harga.

**Formula:**
$$RSI = 100 - \frac{100}{1 + RS}$$
$$RS = \frac{\text{Average Gain}}{\text{Average Loss}}$$

**Interpretasi:**
- RSI > 70: Overbought (potensi jual)
- RSI < 30: Oversold (potensi beli)
- RSI 50: Netral

**Implementasi:**
```python
def compute_rsi(close, period=14):
    delta = close.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    
    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi
```

**4. MACD (Moving Average Convergence Divergence)**

**Deskripsi:**  
Indikator momentum yang menunjukkan hubungan antara dua moving average.

**Formula:**
$$MACD = EMA_{12} - EMA_{26}$$
$$Signal = EMA_9(MACD)$$
$$Histogram = MACD - Signal$$

**Interpretasi:**
- MACD > Signal: Bullish (momentum naik)
- MACD < Signal: Bearish (momentum turun)
- MACD cross above Signal: Sinyal beli
- MACD cross below Signal: Sinyal jual

**Implementasi:**
```python
def compute_macd(close):
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd = ema_12 - ema_26
    signal = macd.ewm(span=9, adjust=False).mean()
    histogram = macd - signal
    return macd, signal, histogram
```

**Feature Engineering:**
```python
macd, macd_signal, macd_hist = compute_macd(close)
df["macd_norm"] = macd / close
df["macd_signal_norm"] = macd_signal / close
df["macd_hist_norm"] = macd_hist / close
```

**5. Volume Analysis**

**Deskripsi:**  
Analisis volume transaksi untuk konfirmasi trend.

**Formula:**
$$Volume\ Ratio = \frac{Volume_t}{MA_{20}(Volume)}$$

**Interpretasi:**
- Volume Ratio > 1.5: Volume tinggi (konfirmasi trend)
- Volume Ratio < 0.5: Volume rendah (trend lemah)

**Feature Engineering:**
```python
vol_ma_20 = df["Volume"].rolling(20).mean()
df["vol_ma_ratio"] = df["Volume"] / vol_ma_20
```

### 4.4 Backend Architecture

#### A. FastAPI Framework

**Deskripsi:**  
FastAPI adalah modern web framework untuk membangun API dengan Python 3.7+ berdasarkan type hints.

**Keunggulan:**
- High performance (setara NodeJS dan Go)
- Auto-generate dokumentasi (Swagger UI)
- Type validation otomatis dengan Pydantic
- Async/await support
- Dependency injection

**Struktur Routing:**
```python
from fastapi import FastAPI

app = FastAPI(
    title="StoxArea Backend API",
    description="SPK Rekomendasi Saham",
    version="1.0.0"
)

# Authentication
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Recommendations
app.include_router(recommendation.router, prefix="/api/recommendations", tags=["Recommendations"])

# Market Data
app.include_router(market.router, prefix="/api/market", tags=["Market"])

# Portfolio
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])

# Admin ML
app.include_router(admin_ml.router, prefix="/api/admin/ml", tags=["Admin ML"])
```

#### B. JWT Authentication

**Deskripsi:**  
JSON Web Token untuk stateless authentication.

**Flow:**
1. User login dengan email & password
2. Backend verifikasi credentials
3. Generate JWT token dengan payload: `{user_id, email, exp}`
4. Token dikirim ke frontend
5. Frontend menyimpan token di localStorage
6. Setiap request ke protected endpoint, frontend kirim token di header: `Authorization: Bearer <token>`
7. Backend verify token dan extract user_id

**Implementasi:**
```python
from jose import jwt
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 hari

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload
```

#### C. APScheduler

**Deskripsi:**  
Background job scheduler untuk menjalankan ML pipeline otomatis.

**Konfigurasi:**
```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

# Cron: Senin-Jumat jam 17:00
scheduler.add_job(
    run_daily_pipeline, 
    'cron', 
    day_of_week='mon-fri', 
    hour=17, 
    minute=0
)

scheduler.start()
```

**Fungsi `run_daily_pipeline()`:**
1. Download OHLCV data
2. Feature engineering
3. Train XGBoost model
4. Generate AI scores
5. Save results to disk

#### D. SQLAlchemy ORM

**Deskripsi:**  
Object-Relational Mapping untuk interaksi dengan database.

**Contoh Model:**
```python
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    risk_profile = Column(String, nullable=False)
    virtual_balance = Column(Float, default=100000000)
    created_at = Column(DateTime, default=datetime.utcnow)
```

**Query Example:**
```python
# Create
new_user = User(email="user@example.com", hashed_password="...", ...)
db.add(new_user)
db.commit()

# Read
user = db.query(User).filter(User.email == "user@example.com").first()

# Update
user.virtual_balance = 95000000
db.commit()

# Delete
db.delete(user)
db.commit()
```

### 4.5 Virtual Trading

#### A. Average Cost Method

**Deskripsi:**  
Metode perhitungan harga rata-rata pembelian untuk portfolio management.

**Formula:**
$$\text{New Avg Cost} = \frac{(\text{Shares}_{old} \times \text{Avg Cost}_{old}) + (\text{Shares}_{new} \times \text{Price}_{new})}{\text{Shares}_{old} + \text{Shares}_{new}}$$

**Contoh:**
- User sudah punya 100 lembar BBCA @ Rp 9,500 (avg cost)
- User beli lagi 50 lembar BBCA @ Rp 10,000
- New avg cost = ((100 × 9,500) + (50 × 10,000)) / (100 + 50)
- New avg cost = (950,000 + 500,000) / 150 = Rp 9,667

**Implementasi:**
```python
def update_portfolio_buy(user_id, ticker, shares, price):
    portfolio = db.query(Portfolio).filter(
        Portfolio.user_id == user_id,
        Portfolio.ticker == ticker
    ).first()
    
    if portfolio:
        # Update existing
        new_shares = portfolio.shares + shares
        new_avg_cost = (
            (portfolio.shares * portfolio.avg_cost) + (shares * price)
        ) / new_shares
        
        portfolio.shares = new_shares
        portfolio.avg_cost = new_avg_cost
    else:
        # Create new
        portfolio = Portfolio(
            user_id=user_id,
            ticker=ticker,
            shares=shares,
            avg_cost=price
        )
        db.add(portfolio)
    
    db.commit()
```

#### B. Profit/Loss Calculation

**Formula:**
$$\text{Unrealized P/L} = (\text{Current Price} - \text{Avg Cost}) \times \text{Shares}$$
$$\text{Return \%} = \frac{\text{Current Price} - \text{Avg Cost}}{\text{Avg Cost}} \times 100\%$$

**Contoh:**
- User punya 150 lembar BBCA @ Rp 9,667 (avg cost)
- Harga sekarang: Rp 10,200
- Unrealized P/L = (10,200 - 9,667) × 150 = Rp 79,950
- Return % = (10,200 - 9,667) / 9,667 × 100% = 5.51%

---

## PENUTUP

Dokumen ini menjelaskan perancangan sistem STOXAREA secara komprehensif, mencakup:
1. **Proses Bisnis:** Alur kerja dari registrasi user hingga rekomendasi saham
2. **Rancangan Diagram:** Flowchart, ERD, DFD, dan Use Case Diagram
3. **Rancangan Dataset:** Struktur data OHLCV, fundamental, features, dan database
4. **Metode yang Digunakan:** XGBoost, SHAP, SPK 3 Lapis (Profiling, Veto, SAW), Technical Analysis, dan Backend Architecture

Sistem ini dirancang untuk memberikan rekomendasi saham yang objektif, transparan, dan personal berdasarkan profil risiko user, dengan kombinasi Machine Learning dan Sistem Pendukung Keputusan.

---

**Disusun oleh:** [Nama Kelompok]  
**Tanggal:** 26 Mei 2026  
**Mata Kuliah:** Proyek Sains Data  
**Universitas Putra Bangsa**
