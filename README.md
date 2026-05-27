# 📈 StoxArea - Stock Recommendation Decision Support System (SPK)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009485)](https://fastapi.tiangolo.com/)
[![Next.js 14+](https://img.shields.io/badge/Next.js-14%2B-000000)](https://nextjs.org/)

**StoxArea** adalah sistem rekomendasi saham berbasis kecerdasan buatan (AI) yang dirancang khusus untuk pasar saham Indonesia (BEI). Menggunakan 3-tier decision support system (SPK) yang menggabungkan profiling risiko, momentum scoring, dan algoritma SAW untuk memberikan rekomendasi saham yang personalized.

---

## 🎯 Fitur Utama

### 🔐 SPK Lapis 1: Risk Profiling
- Questionnaire 10 pertanyaan (5 dimensi K1-K5) untuk menentukan profil risiko
- Klasifikasi berdasarkan total skor:
  - **Konservatif**: Total skor < 12 (risk-averse)
  - **Moderat**: Total skor 12-18 (balanced)
  - **Agresif**: Total skor > 18 (risk-seeking)
- **VETO Safety Logic** (Perlindungan Dana Darurat):
  - Jika K5 ≤ 1 (kapasitas finansial sangat rendah) → Paksa Konservatif
  - Jika K5 == 3 AND K3 == 1 (medium capacity + low tolerance) → Paksa Konservatif
  - Mencegah investasi dengan dana darurat/kebutuhan pokok
- **Bobot W** untuk SAW (fixed per profil, bukan per-user):
  - Konservatif: AI 10%, ROE 45%, DER 35%, PBV 10%
  - Moderat: AI 35%, ROE 30%, DER 15%, PBV 20%
  - Agresif: AI 60%, ROE 10%, DER 10%, PBV 20%

### 🤖 SPK Lapis 2: Stock Scoring & Filtering
- **XGBoost Classifier** untuk prediksi momentum (11 indikator teknikal):
  - Input: Log returns, MA, RSI, MACD, Bollinger Bands, Volume
  - Output: AI Score (0-100%) probabilitas naik dalam 7 hari
- **Penilaian 4 Kriteria** (normalized 0-1):
  - AI Score (benefit: semakin tinggi semakin baik)
  - ROE (benefit: semakin tinggi semakin baik)
  - DER (cost: semakin rendah semakin baik)
  - PBV (cost: semakin rendah semakin baik)
- **Outlier Handling**: Clamp nilai ROE, DER, PBV ke persentil P5-P95 (remove ekstrem values)
- **Pre-filtering**: Only `is_qualified = True` stocks proceed ke SPK Lapis 3
- **SHAP Explainability**: Top 3 fitur teknikal yang mempengaruhi prediksi
- Daily ML pipeline: Otomatis update setiap hari pukul 17:00 (Senin-Jumat)
- Caching 5 menit untuk performa optimal

### 📊 SPK Lapis 3: Personalized Ranking (SAW)
- **Simple Additive Weighting (SAW)** formula:
  - $V_i = \sum (W_j \times N_{ij})$ dimana:
    - $W_j$ = bobot per profil (dari Tier 1)
    - $N_{ij}$ = normalized score saham (dari Tier 2)
- **Cache per Profil**: 3 profil × 12 sektor + global = 39 cache entries max
  - Cache TTL = 10 menit (sync dengan siklus pasar)
  - Thread-safe dengan double-checked locking
- **Filtering & Blacklist**: Sudah dilakukan di Tier 2 via `is_qualified` flag
  - Saham dengan fundamental ekstrem tidak masuk ke SAW
- **Output**: Top 5-10 rekomendasi personal per pengguna
  - Sorted by match_score tertinggi
  - Include: AI score, fundamental metrics, SHAP insights

### 💹 Virtual Trading
- Simulasi trading dengan modal virtual Rp 100 Juta
- Buy/Sell orders dengan real-time price
- Portfolio tracking dengan average price calculation
- Fee tracking: BUY 0.15%, SELL 0.25%
- Transaction history

### 📈 Market Intelligence
- **Technical Chart**: Candlestick + 7 indikator (MA, RSI, MACD, BB)
- **Fundamental Analysis**: PBV, ROE, DER, Dividen, ROA
- **Sector Analysis**: 12 sektor BEI dengan ringkasan per sektor
- **Live Price**: Real-time updating untuk virtual trading
- **4-Year History**: Income Statement, Balance Sheet, Dividen

### 📥 Export & Reporting
- Download Excel (.XLSX) dengan 3 sheet:
  - Sheet 1: Data Teknikal + Indikator
  - Sheet 2: Ringkasan Fundamental
  - Sheet 3: SHAP Insights
- Client-side processing (0 beban server)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                     │
│  Dashboard │ Market Explorer │ Virtual Trading │ Portfolio  │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
    ┌─────────────────────┐  ┌──────────────────┐
    │   FastAPI Backend   │  │  PostgreSQL DB   │
    │  /market/           │  │  - Users         │
    │  /recommendation/   │  │  - Stocks        │
    │  /portfolio/        │  │  - Portfolios    │
    │  /auth/             │  │  - Transactions  │
    └────────┬────────────┘  └──────────────────┘
             │
             ↓
    ┌─────────────────────────────────────────┐
    │      ML Pipeline (Daily 17:00)          │
    │  Ingestor → Features → XGBoost →        │
    │  SHAP → Sync DB → Hot-reload            │
    └─────────────────────────────────────────┘
             │
             ↓
    ┌─────────────────────────────────────────┐
    │     Yahoo Finance API Integration       │
    │  OHLCV (5 years) │ Fundamental Data     │
    └─────────────────────────────────────────┘
```

---

## 🎯 Three-Tier SPK Architecture (Implementation Details)

### Tier 1: User Profiling
**Input:** Kuesioner 10 item (K1-K5)  
**Process:**
1. Agregasi K1-K5 menjadi total skor
2. Tentukan profil (Konservatif/Moderat/Agresif) dari threshold:
   - Skor < 12 → Konservatif
   - Skor 12-18 → Moderat
   - Skor > 18 → Agresif
3. Apply VETO safety logic jika K5 terlalu rendah
4. Ambil bobot W yang sesuai dengan profil (fixed per profil, tidak per-user)

**Output:** Profil risiko + Vektor Bobot W untuk SPK Lapis 3

---

### Tier 2: Stock Scoring & Filtering
**Input:** Dataset saham 150+ ticker, 11 indikator teknikal  
**Process:**
1. **Hitung AI Score** dari XGBoost (teknikal only)
2. **Normalisasi 4 Kriteria** ke [0, 1]:
   - ROE (benefit): normalize dengan shift jika ada negatif
   - DER, PBV (cost): inverse normalisasi (min_value / x)
   - AI Score (benefit): direct normalisasi
3. **Clamp Outliers**: P5-P95 persentil untuk ROE, DER, PBV
4. **Pre-filter**: Only `is_qualified = True` → pass ke Tier 3
5. Simpan clean values untuk SAW + raw values untuk UI display

**Output:** Matriks R (N × 4) dengan normalized scores, siap untuk SAW

---

### Tier 3: Personalized Ranking (SAW)
**Input:** Bobot W dari Tier 1 + Normalized scores R dari Tier 2  
**Process:**
1. **Hitung SAW Score** untuk setiap saham:
   $$V_i = \sum_{j=1}^{4} W_j \times N_{ij}$$
2. **Cache per Profil** (3 profil × 12 sektor = 39 cache entries):
   - Cache TTL = 10 menit
   - Double-checked locking + per-key locks (thread-safe)
   - Invalidate setelah ML pipeline selesai
3. **Sort & Rank** dari V_i tertinggi ke terendah
4. **Return Top 5** rekomendasi personal

**Output:** Rekomendasi saham sorted by match_score + fundamental metrics + SHAP insights

---

### Key Differences from Theory
| Aspek | Desain Teoritis | Implementasi Actual | Alasan |
|:------|:---|:---|:---|
| Bobot W | Per-user (proporsional K1-K4) | Fixed per profil (3 bobot) | Cache efficiency, 3 profil = simple |
| K-Means Clustering | Ya (initial profiling) | Threshold sederhana | Production simplicity |
| Filtering | Tier 3 rule-based blacklist | Tier 2 pre-filter `is_qualified` | Early filtering saves resources |
| Outlier Handling | Tier 3 capping | Tier 2 P5-P95 clamp | Clean data into SAW |
| Veto Logic | K5 ≤ 2 | K5 ≤ 1 atau (K5==3 && K3==1) | Stricter safety for users |

**Kesimpulan:** Implementasi lebih pragmatis & production-focused, dengan early filtering dan cache strategy yang optimal.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI 0.104+
- **Language**: Python 3.10+
- **Database**: SQLite (dev) / PostgreSQL (production)
- **ORM**: SQLAlchemy 2.0+
- **Authentication**: JWT + bcrypt
- **ML**: XGBoost, SHAP, scikit-learn
- **Scheduling**: APScheduler
- **Market Data**: yfinance

### Frontend
- **Framework**: Next.js 14+ (TypeScript/React)
- **Styling**: Tailwind CSS
- **Charts**: lightweight-charts (TradingView)
- **State Management**: Zustand/Context API
- **HTTP Client**: Fetch API

### Infrastructure
- **Backend Server**: Uvicorn
- **Containerization**: Docker
- **Deployment**: Koyeb / Railway / AWS
- **Version Control**: Git

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git
- PostgreSQL 14+ (optional, SQLite untuk development)

### Backend Setup

```bash
cd stoxarea-backend

# 1. Create virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows
# or: source venv/bin/activate  # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Setup database
alembic upgrade head

# 4. Create test users (optional)
python scripts/create_test_users.py

# 5. Initial data ingestion
python scripts/ingest_fundamentals_only.py

# 6. Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend akan berjalan di**: `http://localhost:8000`

API Docs: `http://localhost:8000/docs` (Swagger UI)

### Frontend Setup

```bash
cd stoxarea-frontend

# 1. Install dependencies
npm install

# 2. Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF

# 3. Run development server
npm run dev
```

**Frontend akan berjalan di**: `http://localhost:3000`

---

## 📁 Project Structure

```
STOXAREA/
├── stoxarea-backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py                     # FastAPI entry point
│   │   ├── api/                        # API Endpoints
│   │   │   ├── auth.py                # User auth & profiling (SPK Lapis 1)
│   │   │   ├── market.py              # Market intelligence (SPK Lapis 2)
│   │   │   ├── recommendation.py       # Recommendations (SPK Lapis 3)
│   │   │   ├── portfolio.py           # Virtual trading
│   │   │   └── admin_ml.py            # Admin controls
│   │   ├── models/                     # SQLAlchemy ORM models
│   │   ├── schemas/                    # Pydantic request/response models
│   │   ├── services/                   # Business logic
│   │   │   ├── spk1_profiling.py      # Risk profiling
│   │   │   ├── spk2_scoring.py        # AI scoring
│   │   │   ├── spk3_saw.py            # SAW recommendations
│   │   │   ├── market_data.py         # Market data fetching
│   │   │   ├── virtual_trading.py     # Trading logic
│   │   │   └── corporate_action_guard.py # Corporate action detection
│   │   └── core/
│   │       ├── config.py              # Configuration
│   │       ├── database.py            # DB connection
│   │       └── security.py            # JWT + bcrypt
│   │
│   ├── ml/                             # ML Pipeline
│   │   ├── pipeline/
│   │   │   ├── scheduler.py           # Daily scheduler (17:00)
│   │   │   ├── ingestor.py            # OHLCV + fundamental download
│   │   │   ├── sync_db.py             # DB synchronization
│   │   │   └── outlier_guard.py       # Outlier detection
│   │   ├── features/
│   │   │   └── feature_engineering.py # Technical feature calculation
│   │   ├── training/
│   │   │   └── train_xgboost.py       # Model training
│   │   └── inference/
│   │       └── shap_explainer.py      # SHAP explainability
│   │
│   ├── intelligence_store/             # In-memory caching
│   │   ├── ai_scores.py               # AI score loader
│   │   └── capping_bounds.py          # Outlier bounds
│   │
│   ├── data/
│   │   ├── raw/
│   │   │   ├── ohlcv/                 # OHLCV CSV per ticker (150+ files)
│   │   │   ├── fundamental.csv        # Fundamental metrics
│   │   │   └── tickers/               # Ticker lists & sector mapping
│   │   └── processed/
│   │       ├── ai_scores.json         # Output of ML pipeline
│   │       ├── features_targets.csv   # Features + targets for training
│   │       └── capping_bounds.json    # Outlier bounds per metric
│   │
│   ├── migrations/                     # Alembic database migrations
│   ├── logs/                          # Application logs
│   ├── cache/                         # yfinance timezone cache
│   ├── requirements.txt               # Python dependencies
│   ├── Dockerfile                     # Container configuration
│   └── alembic.ini                    # Migration config
│
├── stoxarea-frontend/                  # Next.js Frontend
│   ├── src/
│   │   ├── app/                       # App router pages
│   │   │   ├── page.tsx               # Home
│   │   │   ├── dashboard/             # Dashboard
│   │   │   ├── market/                # Market explorer & detail
│   │   │   ├── portfolio/             # Virtual trading portfolio
│   │   │   ├── onboarding/            # Risk profiling
│   │   │   └── auth/                  # Authentication
│   │   ├── components/
│   │   │   ├── charts/                # Chart components
│   │   │   │   ├── CandlestickChart.tsx
│   │   │   │   ├── TechnicalChart.tsx
│   │   │   │   ├── RsiMacdChart.tsx
│   │   │   │   └── ShapBarChart.tsx
│   │   │   ├── recommendation/        # SPK Lapis 3 UI
│   │   │   ├── trading/               # Virtual trading UI
│   │   │   ├── ui/                    # Reusable UI components
│   │   │   └── ErrorBoundary.tsx
│   │   ├── hooks/                     # React custom hooks
│   │   ├── lib/                       # Utilities & API client
│   │   ├── store/                     # State management
│   │   └── types/                     # TypeScript type definitions
│   │
│   ├── public/                        # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── tailwind.config.ts
│
├── Documentation/
│   ├── BACKEND_DETAILED_EXPLANATION.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── MONOREPO_GUIDE.md
│   └── ... (berbagai dokumentasi)
│
└── README.md (this file)
```

---

## 🔄 Daily ML Pipeline Flow

Pipeline ML otomatis berjalan **setiap hari Senin-Jumat jam 17:00 WIB** (setelah pasar tutup):

```
17:00 (Market Close)
  ↓
1. INGESTOR
   └─ Download OHLCV terbaru (1 bulan terakhir)
   └─ Append ke CSV existing (data historis 5 tahun tetap)
   └─ Corporate action guard check
  ↓
2. FEATURE ENGINEERING
   └─ Hitung 11 technical features (log returns, MA, RSI, MACD, BB, volume)
   └─ Generate target labels ("stock up >5% in next 5 days?")
  ↓
3. XGBOOST INFERENCE
   └─ Load trained model
   └─ Predict probability untuk latest day
   └─ Output: AI Score 0-100%
  ↓
4. SHAP EXPLAINABILITY
   └─ Calculate SHAP values
   └─ Extract top 3 influencing features
   └─ Convert to human-readable insights
  ↓
5. DATABASE SYNC
   └─ Update stock fundamental metrics (ROE, DER, PER)
   └─ Record AI scores
  ↓
6. HOT-RELOAD
   └─ Load ai_scores.json ke memory
   └─ Instant availability untuk /market/momentum endpoint
  ↓
Result: 150+ stocks dengan fresh AI Score siap untuk rekomendasi
```

---

## 📊 Data Model

### Users
```
- id (PK)
- email (unique)
- password_hash
- full_name
- risk_profile (Enum: Konservatif/Moderat/Agresif)
- virtual_balance (default: 100M)
- created_at
- updated_at
```

### Stocks
```
- ticker (PK, e.g., "BBCA.JK")
- name
- sector
- industry
- cluster
- is_qualified (boolean, passed SPK Lapis 2 filter)
- roe, der, per (fundamental metrics)
- updated_at
```

### Portfolios
```
- id (PK)
- user_id (FK)
- ticker (FK)
- qty (shares owned)
- avg_price (average buying price)
```

### Transactions
```
- id (PK)
- user_id (FK)
- ticker
- type (Enum: BUY/SELL)
- price
- qty
- fee
- net_value
- timestamp
```

---

## 🔐 Authentication & Security

- **Password**: bcrypt hashing (12 rounds)
- **JWT Token**: HS256 algorithm, 24-hour expiry
- **CORS**: All origins (restrict to frontend domain in production)
- **Environment Variables**: Sensitive data di `.env`

```bash
# .env example
DATABASE_URL=postgresql://user:pass@localhost/stoxarea
JWT_SECRET=your-super-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=1440
```

---

## 🧪 Testing

### Backend Tests
```bash
cd stoxarea-backend
pytest tests/
```

### Test Data
```bash
# Create test users
python scripts/create_test_users.py

# Verify trading logic
python tests/test_virtual_trading.py

# Debug AI scores
python debug_scores.py
```

---

## 📈 API Endpoints

### Authentication
- `POST /auth/register` - Pendaftaran user
- `POST /auth/login` - Login & JWT token
- `GET /auth/me` - Get current user
- `GET /auth/questionnaire` - Get 10 risk profiling questions
- `POST /auth/submit-profiling` - Submit profiling answers

### Market Intelligence
- `GET /market/momentum` - Top momentum stocks
- `GET /market/ai-score/{ticker}` - AI score + SHAP insights
- `GET /market/technical/{ticker}` - Candlestick + indicators
- `GET /market/fundamental/{ticker}` - Deep-dive fundamentals
- `GET /market/sectors` - Sector summary
- `GET /market/history/{ticker}` - 4-year financial history
- `GET /market/live-price/{ticker}` - Real-time price

### Recommendations
- `GET /recommendation/top-picks` - Top 10 personalized recommendations

### Virtual Trading
- `GET /portfolio/` - User portfolio
- `POST /portfolio/buy` - Buy stock
- `POST /portfolio/sell` - Sell stock

---

## 🚀 Deployment

### Docker Deployment

```bash
# Backend
cd stoxarea-backend
docker build -t stoxarea-backend .
docker run -p 8000:8000 --env-file .env stoxarea-backend

# Frontend
cd stoxarea-frontend
docker build -t stoxarea-frontend .
docker run -p 3000:3000 stoxarea-frontend
```

### Environment Setup

Lihat [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) untuk:
- Koyeb deployment
- Railway deployment
- AWS EC2 setup
- PostgreSQL production database
- Nginx reverse proxy
- SSL/HTTPS configuration

---

## 📝 Available Documentation

- [BACKEND_DETAILED_EXPLANATION.md](./BACKEND_DETAILED_EXPLANATION.md) - Backend architecture deep-dive
- [BACKEND_FLOW_DIAGRAM.md](./BACKEND_FLOW_DIAGRAM.md) - Visual flow diagrams
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Production deployment
- [MONOREPO_GUIDE.md](./MONOREPO_GUIDE.md) - Monorepo best practices
- [BUSINESS_LOGIC_IMPROVEMENTS.md](./BUSINESS_LOGIC_IMPROVEMENTS.md) - Enhancement ideas
- [DOKUMENTASI_LENGKAP.md](./DOKUMENTASI_LENGKAP.md) - Indonesian full documentation

---

## 🐛 Known Issues & Fixes

### Transaction Fee Tracking ✅ (Fixed May 22, 2026)
- **Issue**: Error "Gagal menyimpan ke database" on BUY/SELL
- **Fix**: Migration `001_add_transaction_fee_columns.py` applied
- **Status**: Verified working

### Corporate Action Handling ✅
- **Issue**: Extreme price movements (splits, mergers) causing AI anomalies
- **Fix**: Corporate action guard checks for >20% movement
- **Status**: SKIP or WAIT for manual validation

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit Pull Request

### Code Standards
- Python: PEP 8 (use `black` formatter)
- TypeScript: Prettier + ESLint
- Commit messages: Descriptive & conventional format

---

## 📄 License

MIT License - Bebas digunakan untuk tujuan komersial dan non-komersial.
Lihat [LICENSE](./LICENSE) untuk detail.

---

## 👨‍💼 Support & Contact

- **Issues**: GitHub Issues tracker
- **Email**: support@stoxarea.app
- **Documentation**: [docs.stoxarea.app](https://docs.stoxarea.app)

---

## 🙏 Acknowledgments

- **Yahoo Finance** - Real-time & historical market data
- **XGBoost** - Machine learning model
- **SHAP** - Model explainability
- **Lightweight Charts** - Interactive charting
- **Next.js** - React framework
- **FastAPI** - Python web framework

---

**Made with ❤️ for Indonesian Stock Market (BEI) enthusiasts**

Last Updated: May 27, 2026
