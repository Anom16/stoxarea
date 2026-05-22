## 🎯 STOXAREA BACKEND - PENJELASAN DETAIL LENGKAP

**Versi**: 1.0.0  
**Tech Stack**: FastAPI + SQLAlchemy + PostgreSQL + XGBoost + SHAP  
**Database**: PostgreSQL Supabase

---

# 📋 DAFTAR ISI
1. [Architecture Overview](#architecture-overview)
2. [User Journey Flow](#user-journey-flow)
3. [SPK 3-Tier System](#spk-3-tier-system)
4. [Virtual Trading Flow](#virtual-trading-flow)
5. [ML Pipeline Daily](#ml-pipeline-daily)
6. [Database Schema](#database-schema)
7. [API Endpoints Detail](#api-endpoints-detail)
8. [Coding Pattern & Best Practices](#coding-pattern--best-practices)

---

# ARCHITECTURE OVERVIEW

## Struktur Folder Backend

```
stoxarea-backend/
├─ app/                    # Source code aplikasi FastAPI
│  ├─ main.py             # Entry point, router initialization
│  ├─ api/                # API Layer (endpoint handlers)
│  │  ├─ auth.py          # Register, Login, Profiling
│  │  ├─ recommendation.py # SPK Lapis 3 - Get top picks
│  │  ├─ market.py        # Market intelligence endpoints
│  │  ├─ portfolio.py     # Virtual trading (BUY/SELL)
│  │  └─ admin_ml.py      # Admin controls
│  ├─ models/             # SQLAlchemy ORM Models
│  │  ├─ user.py          # User table schema
│  │  ├─ stock.py         # Stock metadata
│  │  ├─ portfolio.py     # Holdings (many-to-many user-stock)
│  │  ├─ transaction.py   # Trade history
│  │  └─ corporate_action.py
│  ├─ services/           # Business Logic Layer
│  │  ├─ spk1_profiling.py    # SPK Tier 1 - Risk Profile calculation
│  │  ├─ spk2_scoring.py      # SPK Tier 2 - AI Score lookup
│  │  ├─ spk3_saw.py          # SPK Tier 3 - SAW recommendation engine
│  │  ├─ virtual_trading.py   # Trade execution logic
│  │  ├─ market_data.py       # yfinance wrapper + caching
│  │  ├─ veto_logic.py        # VETO system (emergency fund check)
│  │  └─ [other services]
│  ├─ core/              # Infrastructure & Configuration
│  │  ├─ config.py       # Settings (DATABASE_URL, SECRET_KEY, etc)
│  │  ├─ database.py     # SQLAlchemy engine + sessionmaker
│  │  ├─ security.py     # JWT, password hashing, auth decorator
│  │  └─ questions.py    # Questionnaire data (10 Q for SPK Tier 1)
│  ├─ schemas/          # Pydantic models (request/response validation)
│  │  ├─ user.py
│  │  ├─ recommendation.py
│  │  └─ stock.py
│  └─ intelligence_store/ # AI Score cache singleton
│
├─ ml/                    # Machine Learning Pipeline
│  ├─ pipeline/          # Orchestrator & pipeline jobs
│  │  ├─ scheduler.py    # APScheduler (runs daily at 17:00)
│  │  ├─ ingestor.py     # Download OHLCV + fundamental data
│  │  ├─ sector_classifier.py
│  │  ├─ filter_emiten.py
│  │  ├─ outlier_guard.py
│  │  ├─ sync_db.py      # Sync stock fundamentals to DB
│  │  └─ [others]
│  ├─ features/          # Feature engineering
│  ├─ training/          # Model training
│  ├─ inference/         # SHAP explainability
│  ├─ models/            # Model artifacts (.pkl files)
│  └─ models_saved/      # Saved model binaries
│
├─ migrations/           # Alembic (database version control)
│  ├─ env.py            # Migration environment config
│  └─ versions/         # Migration files (001_add_fee_columns.py, etc)
│
├─ data/                # Market data storage
│  ├─ raw/              # Downloaded OHLCV & fundamentals (CSV)
│  ├─ processed/        # AI scores JSON, features CSV
│  └─ tickers/          # Ticker metadata JSON files
│
├─ requirements.txt     # Python dependencies
├─ alembic.ini         # Alembic configuration
└─ Dockerfile          # Container image
```

---

## **Technology Stack Explained**

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
│           (TypeScript/React @ localhost:3000)               │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP Requests
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  FASTAPI (Backend)                           │
│  - Uvicorn ASGI Server (async, multi-worker)               │
│  - Request validation with Pydantic                         │
│  - JWT authentication                                       │
│  - CORS middleware (allow localhost:3000)                  │
│  - 5 Router modules (auth, recommendation, etc)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
┌──────────────┐ ┌────────────┐ ┌──────────────┐
│ Service      │ │ ML Models  │ │ External API │
│ Layer        │ │ (XGBoost,  │ │ (yfinance)   │
│ (Business    │ │ SHAP)      │ │              │
│  Logic)      │ │            │ │              │
└──────────────┘ └────────────┘ └──────────────┘
        │
        ↓
┌─────────────────────────────────────────────────────────────┐
│          PostgreSQL Database (Supabase Cloud)               │
│                                                              │
│  Tables: users, stocks, portfolios, transactions,          │
│          financial_history, corporate_action_flags         │
│          alembic_version (migration tracking)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│     Background Scheduler (APScheduler)                      │
│                                                              │
│  Triggers daily at 17:00 (Mon-Fri)                         │
│  └→ run_daily_pipeline()                                   │
│     ├→ Download data from yfinance                         │
│     ├→ Feature engineering                                 │
│     ├→ XGBoost prediction                                  │
│     ├→ SHAP value calculation                              │
│     ├→ Sync to database                                    │
│     └→ Hot reload AI scores cache                          │
└─────────────────────────────────────────────────────────────┘
```

---

# USER JOURNEY FLOW

## **Complete User Flow (Registration → Profiling → Recommendation → Trading)**

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  STEP 1: USER REGISTRATION                                                       │
│  ════════════════════════════                                                    │
│                                                                                   │
│  Frontend          Backend          Database                                      │
│  ───────           ───────          ────────                                      │
│     │                 │                │                                          │
│     │─ POST /auth/register                                                       │
│     │     {"email": "user@example.com", "password": "xxx", "full_name": "Budi"}  │
│     │──────────────→ [Request hits api/auth.py - register() function]          │
│     │                │                                                            │
│     │                ├─ Check if email sudah ada:                                │
│     │                │  db.query(User).filter(User.email == email).first()      │
│     │                │  → Jika ada, return 400 "Email already registered"       │
│     │                │                                                            │
│     │                ├─ Hash password dengan bcrypt:                             │
│     │                │  hashed = get_password_hash(password)                    │
│     │                │  → bcrypt.hashpw() → random salt + hash                  │
│     │                │                                                            │
│     │                ├─ Create User object:                                      │
│     │                │  new_user = User(email, password_hash, full_name)        │
│     │                │  virtual_balance = 100 Juta (default)                    │
│     │                │  risk_profile = NULL (belum isi kuesioner)              │
│     │                │                                                            │
│     │                ├─ Save ke database:                                        │
│     │                │  db.add(new_user)                                        │
│     │                │  db.commit()  ← Atomic transaction                       │
│     │                │  db.refresh(new_user)  ← Get auto-generated ID           │
│     │                │              │                                            │
│     │                │              └→ INSERT INTO users (...)                  │
│     │                │                  RETURNING id, created_at                │
│     │                │              ┌──────────────────────────────────────┐   │
│     │                │              │ users table updated:                 │   │
│     │                │              │ id=1                                 │   │
│     │                │              │ email=user@example.com              │   │
│     │                │              │ password_hash=$2b$12$...            │   │
│     │                │              │ full_name=Budi                      │   │
│     │                │              │ risk_profile=NULL                   │   │
│     │                │              │ virtual_balance=100000000           │   │
│     │                │              │ created_at=2026-05-22 10:00:00     │   │
│     │                │              └──────────────────────────────────────┘   │
│     │                │                                                            │
│     │                └─ Return UserResponse (Pydantic model):                    │
│     │                   {"id": 1, "email": "...", "full_name": "Budi", ...}    │
│     │←──────────────────── 200 OK                                               │
│     │                                                                             │
└────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  STEP 2: USER LOGIN                                                              │
│  ═══════════════════                                                             │
│                                                                                   │
│  Frontend                                 Backend                                 │
│  ────────                                 ───────                                 │
│     │                                                                             │
│     │─ POST /auth/login                                                          │
│     │   {"username": "user@example.com", "password": "xxx"}                     │
│     │───────────────────────→ [OAuth2PasswordRequestForm dependency]           │
│     │                          (FastAPI standard form data)                      │
│     │                                                                             │
│     │                         ├─ Query database:                                 │
│     │                         │  user = db.query(User)                          │
│     │                         │          .filter(User.email == email)            │
│     │                         │          .first()                                │
│     │                         │                                                  │
│     │                         ├─ Verify password:                                │
│     │                         │  verify_password(plain_password, hash)          │
│     │                         │  → bcrypt.checkpw() → True/False                │
│     │                         │  Jika False → HTTPException(401 Unauthorized)  │
│     │                         │                                                  │
│     │                         ├─ Generate JWT token:                             │
│     │                         │  create_access_token({"sub": email})            │
│     │                         │  → JWT encode dengan SECRET_KEY (HS256)         │
│     │                         │  → Token contains: email, exp, iat              │
│     │                         │                                                  │
│     │                         └─ Return token:                                   │
│     │←───────────────────────── {"access_token": "eyJhb...", "token_type": ...} │
│     │                                                                             │
│  [Token disimpan di frontend (localStorage/cookie)]                             │
│                                                                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  STEP 3: FETCH QUESTIONNAIRE (SPK Tier 1 Profiling)                              │
│  ══════════════════════════════════════════════════                              │
│                                                                                   │
│  Frontend                Backend                                                  │
│  ────────                ───────                                                  │
│     │                                                                             │
│     │─ GET /auth/questionnaire                                                   │
│     │   (Header: Authorization: Bearer eyJhb...)                                │
│     │───────────────→ [No DB query needed, returns static data]                 │
│     │                                                                             │
│     │                ├─ Validate JWT token:                                      │
│     │                │  get_current_user_email() dependency                     │
│     │                │  → JWT decode dengan SECRET_KEY                          │
│     │                │  → Extract email dari token['sub']                       │
│     │                │  → Jika invalid/expired → 401 Unauthorized              │
│     │                │                                                           │
│     │                └─ Return 10 questions:                                     │
│     │←─ 200 OK {"data": [                                                        │
│     │        {                                                                    │
│     │          "id": "k1_target_keuntungan",                                    │
│     │          "question": "Berapa target return tahunan Anda?",               │
│     │          "options": [                                                      │
│     │            {"value": 1, "label": "< 10% (Aman)"},                        │
│     │            {"value": 3, "label": "10-20% (Sedang)"},                     │
│     │            {"value": 5, "label": "> 20% (Tinggi)"}                       │
│     │          ]                                                                 │
│     │        },                                                                  │
│     │        ...9 questions lainnya                                              │
│     │      ]}                                                                     │
│     │                                                                             │
│  [Frontend renders form dengan 10 pertanyaan]                                   │
│                                                                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  STEP 4: SUBMIT QUESTIONNAIRE ANSWERS (Calculate Risk Profile)                   │
│  ═════════════════════════════════════════════════════════════                   │
│                                                                                   │
│  Frontend                Backend                                Database          │
│  ────────                ───────                                ────────          │
│     │                                                                             │
│     │─ POST /auth/submit-profiling                                               │
│     │   {                                                                         │
│     │     "k1_target_keuntungan": 5,                                            │
│     │     "k2_kualitas_perusahaan": 3,                                          │
│     │     "k3_toleransi_risiko": 5,                                             │
│     │     "k4_sensitivitas_harga": 3,                                           │
│     │     "k5_kapasitas_finansial": 1                                           │
│     │   }                                                                         │
│     │───────────────→                                                            │
│     │                │                                                           │
│     │                ├─ Validate JWT & get email                                │
│     │                │  email = get_current_user_email()                        │
│     │                │                                                           │
│     │                ├─ Query user dari database:                                │
│     │                │  user = db.query(User)                                   │
│     │                │          .filter(User.email == email)                     │
│     │                │          .first()                                         │
│     │                │  (Jika tidak ditemukan → 404)                            │
│     │                │              │                                            │
│     │                │              └─ SELECT * FROM users WHERE email = '...'  │
│     │                │                  Returns: User object (id=1, ...)        │
│     │                │                                                           │
│     │                ├─ Calculate risk profile:                                  │
│     │                │  profile = calculate_risk_profile(answers)               │
│     │                │  [Lihat SPK Tier 1 logic di bawah]                     │
│     │                │                                                           │
│     │                │  PSEUDOCODE:                                              │
│     │                │  ───────────                                              │
│     │                │  1. Check VETO logic:                                     │
│     │                │     if answers.k5_kapasitas_finansial == 1 (darurat):   │
│     │                │       return RiskProfileEnum.konservatif   ← FORCE!      │
│     │                │                                                           │
│     │                │  2. Hitung total score:                                   │
│     │                │     total = 5+3+5+3+1 = 17                              │
│     │                │                                                           │
│     │                │  3. Tentukan kategori:                                    │
│     │                │     if total < 12: return Konservatif                    │
│     │                │     elif total <= 18: return Moderat  ← Our case (17)   │
│     │                │     else: return Agresif                                 │
│     │                │                                                           │
│     │                ├─ Update user object:                                      │
│     │                │  user.risk_profile = RiskProfileEnum.moderat             │
│     │                │  db.commit()  ← Save ke database                         │
│     │                │  db.refresh(user)  ← Reload dari DB                      │
│     │                │              │                                            │
│     │                │              └─ UPDATE users                              │
│     │                │                  SET risk_profile = 'Moderat'            │
│     │                │                  WHERE id = 1                            │
│     │                │                  RETURNING *                             │
│     │                │                                                           │
│     │                └─ Return updated user:                                     │
│     │←─────────────────── 200 OK {                                              │
│     │                       "id": 1,                                             │
│     │                       "email": "user@example.com",                        │
│     │                       "risk_profile": "Moderat",    ← Changed!           │
│     │                       "virtual_balance": 100000000                        │
│     │                     }                                                      │
│     │                                                                             │
│  [User sekarang punya profil risiko → dapat rekomendasi personal]               │
│                                                                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  STEP 5: GET PERSONALIZED RECOMMENDATIONS (SPK Tier 3 - SAW)                     │
│  ═════════════════════════════════════════════════════════════                   │
│                                                                                   │
│  Frontend                                                                         │
│  ────────                                                                         │
│     │                                                                             │
│     │─ GET /recommendation/top-picks?sector=null                                 │
│     │   (Header: Authorization: Bearer ...)                                      │
│     │                                                                             │
│     ├────────────────────────→ [Backend: recommendation.py - get_top_picks()]   │
│     │                                                                             │
│     │                         Step 1: Validate JWT & get user                   │
│     │                         ─────────────────────────────────                 │
│     │                         user = db.query(User)                              │
│     │                                 .filter(User.email == email)               │
│     │                                 .first()                                   │
│     │                                                                             │
│     │                         Step 2: Check risk_profile sudah diisi             │
│     │                         ─────────────────────────────────────             │
│     │                         if not user.risk_profile:                         │
│     │                           return 400 "Selesaikan kuesioner dulu"          │
│     │                                                                             │
│     │                         Step 3: Call SAW Recommendation Engine             │
│     │                         ───────────────────────────────────               │
│     │                         recommendations = calculate_saw_recommendations(   │
│     │                             db,                                           │
│     │                             user.risk_profile,  # "Moderat"              │
│     │                             sector             # null (all sectors)       │
│     │                         )                                                  │
│     │                                                                             │
│     │                         ┌─────────────────────────────────────┐           │
│     │                         │ SAW ALGORITHM INSIDE                │           │
│     │                         ├─────────────────────────────────────┤           │
│     │                         │ 1. Load AI Scores from cache        │           │
│     │                         │    ai_scores = AIScoreStore.get_all()          │
│     │                         │    → {"BBCA": 0.65, "ASII": 0.72, ...}        │
│     │                         │                                     │           │
│     │                         │ 2. Get profile weights              │           │
│     │                         │    weights = get_profile_weights()  │           │
│     │                         │    → {"ai_score": 0.40,             │           │
│     │                         │       "roe": 0.30,                  │           │
│     │                         │       "der": 0.20,                  │           │
│     │                         │       "per": 0.10}                  │           │
│     │                         │                                     │           │
│     │                         │ 3. Get qualified stocks from DB     │           │
│     │                         │    stocks = db.query(Stock)         │           │
│     │                         │              .filter(Stock.is_qualified==True) │
│     │                         │    → [BBCA, ASII, UNVR, ...]                  │
│     │                         │                                     │           │
│     │                         │ 4. Normalize metrics + apply capping│           │
│     │                         │    for each stock:                  │           │
│     │                         │      roe_norm = stock.roe / 50 (cap) │          │
│     │                         │      der_norm = 1 / (stock.der+0.1) │          │
│     │                         │      per_norm = 1 / stock.per       │           │
│     │                         │      ai_norm = stock.ai_score       │           │
│     │                         │                                     │           │
│     │                         │ 5. Calculate SAW score              │           │
│     │                         │    SAW = (w_ai × n_ai) +            │           │
│     │                         │          (w_roe × n_roe) +          │           │
│     │                         │          (w_der × n_der) +          │           │
│     │                         │          (w_per × n_per)            │           │
│     │                         │                                     │           │
│     │                         │    For BBCA (Moderat user):        │           │
│     │                         │    SAW = (0.40 × 0.65) +           │           │
│     │                         │            (0.30 × 0.8) +          │           │
│     │                         │            (0.20 × 0.7) +          │           │
│     │                         │            (0.10 × 0.5)            │           │
│     │                         │        = 0.260 + 0.240 + 0.140 + 0.050        │
│     │                         │        = 0.690 (SAW Score)         │           │
│     │                         │                                     │           │
│     │                         │ 6. Sort by SAW score (DESC)         │           │
│     │                         │    Top 10 recommendations returned   │           │
│     │                         └─────────────────────────────────────┘           │
│     │                                                                             │
│     │←─────────── 200 OK [                                                       │
│     │        {                                                                    │
│     │          "ticker": "BBCA",                                                 │
│     │          "match_score": 0.690,                                            │
│     │          "name": "Bank Central Asia",                                      │
│     │          "current_price": 18000,                                          │
│     │          "sector": "Keuangan",                                            │
│     │          "metrics": {                                                      │
│     │            "ai_score": 0.65,                                              │
│     │            "roe": 0.8,                                                     │
│     │            "der": 0.7,                                                     │
│     │            "per": 0.5                                                      │
│     │          },                                                                │
│     │          "insights": [                                                     │
│     │            {"feature": "roe", "contribution": 0.30, "description": "..."},│
│     │            ...                                                             │
│     │          ]                                                                 │
│     │        },                                                                  │
│     │        ... 9 stocks lainnya                                                │
│     │      ]                                                                     │
│     │                                                                             │
│  [Frontend displays top 10 recommendations untuk dipilih user]                 │
│                                                                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  STEP 6: BUY STOCK (Virtual Trading)                                             │
│  ═════════════════════════════════════                                           │
│                                                                                   │
│  Frontend               Backend                         Database                 │
│  ────────               ───────                         ────────                 │
│     │                                                                             │
│     │─ POST /portfolio/buy                                                       │
│     │   {                                                                         │
│     │     "ticker": "BBCA",                                                      │
│     │     "qty": 1           # 1 LOT = 100 lembar                                │
│     │   }                                                                         │
│     │───────────────────→                                                        │
│     │                    │                                                       │
│     │                    ├─ Validate JWT & get user                              │
│     │                    │  user = db.query(User)                               │
│     │                    │          .filter(User.email == email)                │
│     │                    │          .first()                                    │
│     │                    │              │                                        │
│     │                    │              └─ SELECT * FROM users WHERE email='...'│
│     │                    │                  Returns: id=1, balance=100M, ...    │
│     │                    │                                                       │
│     │                    ├─ Get live stock price                                 │
│     │                    │  live_price = get_live_price("BBCA")                 │
│     │                    │                                                       │
│     │                    │  ┌─ yfinance call ────┐                             │
│     │                    │  │ ticker = yfinance.Ticker("BBCA.JK")              │
│     │                    │  │ price = ticker.info['currentPrice']              │
│     │                    │  │ return 18000.0                                    │
│     │                    │  └────────────────────┘                              │
│     │                    │  [Cached for 10 minutes]                             │
│     │                    │                                                       │
│     │                    ├─ Convert qty: 1 LOT = 100 lembar                     │
│     │                    │  qty_lembar = 1 * 100 = 100 lembar                  │
│     │                    │                                                       │
│     │                    ├─ Call execute_trade() service:                       │
│     │                    │  result = execute_trade(                            │
│     │                    │      db=db,                                          │
│     │                    │      user_id=1,                                      │
│     │                    │      ticker="BBCA",                                  │
│     │                    │      trade_type=TransactionTypeEnum.buy,            │
│     │                    │      qty=100,                                        │
│     │                    │      current_price=18000.0                          │
│     │                    │  )                                                    │
│     │                    │                                                       │
│     │                    │  ┌──── EXECUTE_TRADE LOGIC ────┐                    │
│     │                    │  │                              │                    │
│     │                    │  │ 1. Calculate BUY cost:       │                    │
│     │                    │  │    gross = 100 * 18000       │                    │
│     │                    │  │         = 1,800,000          │                    │
│     │                    │  │                              │                    │
│     │                    │  │ 2. Calculate fee (0.15%):    │                    │
│     │                    │  │    fee = 1,800,000 * 0.0015  │                    │
│     │                    │  │        = 2,700               │                    │
│     │                    │  │                              │                    │
│     │                    │  │ 3. Calculate net value:      │                    │
│     │                    │  │    net = 1,800,000 + 2,700   │                    │
│     │                    │  │        = 1,802,700           │                    │
│     │                    │  │                              │                    │
│     │                    │  │ 4. Check balance:            │                    │
│     │                    │  │    if user.balance < 1,802,700:                   │
│     │                    │  │      return fail "Saldo tidak cukup"             │
│     │                    │  │                              │                    │
│     │                    │  │ 5. Deduct balance:           │                    │
│     │                    │  │    user.balance -= 1,802,700 │                    │
│     │                    │  │    → 100,000,000 - 1,802,700 │                   │
│     │                    │  │    → 98,197,300              │                    │
│     │                    │  │                              │                    │
│     │                    │  │ 6. Check portfolio:          │                    │
│     │                    │  │    portfolio = db.query(Portfolio)                │
│     │                    │  │                  .filter(...)                     │
│     │                    │  │                  .first()                         │
│     │                    │  │    → Jika BBCA sudah owned:   │                   │
│     │                    │  │      portfolio.qty += 100     │                    │
│     │                    │  │      Hitung avg_cost ulang    │                    │
│     │                    │  │    → Jika belum:              │                    │
│     │                    │  │      Create portfolio baru    │                    │
│     │                    │  │                              │                    │
│     │                    │  │ 7. Create transaction record: │                    │
│     │                    │  │    tx = Transaction(          │                    │
│     │                    │  │      user_id=1,               │                    │
│     │                    │  │      ticker="BBCA",           │                    │
│     │                    │  │      type="BUY",              │                    │
│     │                    │  │      price=18000,             │                    │
│     │                    │  │      qty=100,                 │                    │
│     │                    │  │      fee=2700,                │                    │
│     │                    │  │      net_value=1,802,700,     │                    │
│     │                    │  │      timestamp=now()          │                    │
│     │                    │  │    )                          │                    │
│     │                    │  │                              │                    │
│     │                    │  │ 8. Persist ke database:       │                    │
│     │                    │  │    db.add(user)               │                    │
│     │                    │  │    db.add(portfolio) atau update                  │
│     │                    │  │    db.add(tx)                 │                    │
│     │                    │  │    db.commit()  ← Atomic!    │                    │
│     │                    │  │                              │                    │
│     │                    │  └──────────────────────────────┘                    │
│     │                    │              │                                        │
│     │                    │              └─ Database updates:                     │
│     │                    │                                                       │
│     │                    │                UPDATE users SET virtual_balance=...  │
│     │                    │                INSERT INTO portfolios (...)          │
│     │                    │                INSERT INTO transactions (...)        │
│     │                    │                                                       │
│     │                    └─ Return success response:                             │
│     │←────── 200 OK {                                                            │
│     │    "message": "Berhasil membeli 1 lot BBCA",                              │
│     │    "executed_price": 18000,                                               │
│     │    "gross_value": 1800000,                                                │
│     │    "fee_amount": 2700,                                                    │
│     │    "fee_rate": "0.15%",                                                   │
│     │    "net_value": 1802700,                                                  │
│     │    "qty_lembar": 100                                                      │
│     │  }                                                                         │
│     │                                                                             │
│  [Frontend shows success message + updates portfolio display]                   │
│                                                                                   │
│  Database State After BUY:                                                       │
│  ═════════════════════════                                                       │
│  users:        id=1, balance=98,197,300 ← Updated                               │
│  portfolios:   id=?, user_id=1, ticker=BBCA, qty=100, avg_price=18000          │
│  transactions: id=1, user_id=1, ticker=BBCA, type=BUY, price=18000, qty=100, │
│                fee=2700, net_value=1,802,700, timestamp=...                     │
│                                                                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

# SPK 3-TIER SYSTEM

## **Tier 1: Risk Profile Calculation (spk1_profiling.py)**

```
Input: 10 Questionnaire Answers
  k1_target_keuntungan: 1-5
  k2_kualitas_perusahaan: 1-5
  k3_toleransi_risiko: 1-5
  k4_sensitivitas_harga: 1-5
  k5_kapasitas_finansial: 1-5   ← VETO criteria!

Logic:
  ┌────────────────────────────────────────────┐
  │ 1. VETO CHECK (Emergency Fund)             │
  │ ─────────────────────────────────────────  │
  │ if k5_kapasitas_finansial == 1 (Emergency fund terpakai):
  │   FORCE return: Konservatif                │
  │   (User dalam situasi darurat, HARUS aman)│
  │                                             │
  │ 2. TOTAL SCORE CALCULATION                 │
  │ ─────────────────────────────────────────  │
  │ total = k1 + k2 + k3 + k4 + k5             │
  │ Min = 5 (semua jawab 1)                    │
  │ Max = 25 (semua jawab 5)                   │
  │                                             │
  │ 3. CATEGORIZATION                          │
  │ ─────────────────────────────────────────  │
  │ if total < 12:  Konservatif (Min risk)    │
  │ elif total <= 18: Moderat (Medium risk)   │
  │ else: Agresif (High risk, high return)    │
  └────────────────────────────────────────────┘

Example Flow:
  Input: k1=5, k2=3, k3=5, k4=3, k5=1
  │
  ├─ Check VETO: k5=1? NO (k5=1 means darurat saat ini, tp misalnya user jawab 
     kecukupan finansial ok maka bukan 1)
     Actually: k5=1 means "Saya butuh dana darurat" → VETO KONSERVATIF!
  │
  └─ FORCE Konservatif immediately
  
  Output: RiskProfileEnum.Konservatif

atau jika k5=3:
  Input: k1=5, k2=3, k3=5, k4=3, k5=3
  total = 5+3+5+3+3 = 19
  total > 18? YES
  Output: RiskProfileEnum.Agresif
```

## **Tier 2: AI Score Ranking (spk2_scoring.py)**

```
Purpose: Rank stocks berdasarkan AI Momentum Score
Source: XGBoost model predictions (updated daily via ML pipeline)

Process:
  1. Load AI Scores dari cache (JSON file):
     {
       "BBCA": {"ai_score": 0.65, "insights": [...]},
       "ASII": {"ai_score": 0.72, "insights": [...]},
       ...
     }

  2. Get qualified stocks (is_qualified=true):
     Stocks yang pass filter:
     - Minimum trading volume
     - No corporate actions (stock split, etc)
     - Outlier guards passed

  3. Rank by AI Score DESC:
     ASII (0.72) > BBCA (0.65) > ... > SMGR (0.25)

Output: List of stocks ranked by momentum (best first)
```

## **Tier 3: SAW Recommendation Engine (spk3_saw.py)**

```
Simple Additive Weighting Algorithm

Purpose: Personalized recommendations berdasarkan profil + fundamental

Input:
  - User Risk Profile (Konservatif/Moderat/Agresif)
  - Optional: Sector filter

Step 1: Get Profile Weights (dari spk1_profiling.py)
  Konservatif: {ai_score: 0.10, roe: 0.50, der: 0.30, per: 0.10}
  Moderat:     {ai_score: 0.40, roe: 0.30, der: 0.20, per: 0.10}
  Agresif:     {ai_score: 0.80, roe: 0.10, der: 0.05, per: 0.05}

Step 2: Load All Stock Data
  AI Scores from cache: {ticker: score}
  Fundamentals from DB: {ticker: {roe, der, per, ...}}

Step 3: Normalize Metrics
  roe_normalized = stock.roe / 50 (capped at 50)
  der_normalized = 1 / (stock.der + 0.1)  (inverse: lower is better)
  per_normalized = 1 / stock.per  (inverse: lower is better)
  ai_normalized = stock.ai_score (0-1 range)

Step 4: Calculate SAW Score
  SAW = (w_ai × n_ai) + (w_roe × n_roe) + (w_der × n_der) + (w_per × n_per)

  Example for Moderat User:
  BBCA: SAW = (0.40 × 0.65) + (0.30 × 0.8) + (0.20 × 0.7) + (0.10 × 0.5)
           = 0.260 + 0.240 + 0.140 + 0.050
           = 0.690

Step 5: Sort & Return Top 10
  Sorted by SAW score DESC
  Apply sector filter if requested

Optimization:
  - Per-profile cache (3 profiles × 12 sectors + 1 global = 39 max)
  - Per-key locks: only 1 compute per cache key
  - TTL = 600s (10 min)
  - Auto-invalidate after ML pipeline
```

---

# VIRTUAL TRADING FLOW

```
Detailed Virtual Trading Execution

SCENARIO: User membeli 1 LOT BBCA @ Rp 18,000

┌─ Virtual Trading State Before ──┐
│ user.balance = 100,000,000       │
│ portfolio["BBCA"] = NULL         │
└─────────────────────────────────┘
                │
                ↓
        [BUY TRANSACTION]
                │
                ├─ Gross Value = qty × price
                │                = 100 × 18,000
                │                = 1,800,000
                │
                ├─ Fee = Gross × FEE_BUY_RATE (0.15%)
                │      = 1,800,000 × 0.0015
                │      = 2,700
                │
                ├─ Net Value = Gross + Fee  (user bayar)
                │            = 1,800,000 + 2,700
                │            = 1,802,700
                │
                ├─ Balance Check
                │  if balance < 1,802,700: FAIL ✗
                │  if balance >= 1,802,700: OK ✓
                │
                ├─ Update Balance
                │  balance -= 1,802,700
                │  = 100,000,000 - 1,802,700
                │  = 98,197,300
                │
                ├─ Update Portfolio
                │  if BBCA exists:
                │    old_cost = qty * avg_price
                │    total_cost = old_cost + gross_value
                │    portfolio.qty += 100
                │    portfolio.avg_price = total_cost / portfolio.qty
                │
                │  if BBCA NOT exists:
                │    CREATE portfolio:
                │    qty = 100
                │    avg_price = 18,000
                │
                ├─ Create Transaction Record
                │  Transaction {
                │    user_id: 1,
                │    ticker: "BBCA",
                │    type: "BUY",
                │    price: 18,000,
                │    qty: 100,
                │    fee: 2,700,           ← New!
                │    net_value: 1,802,700, ← New!
                │    timestamp: now()
                │  }
                │
                ├─ Database Commit (Atomic!)
                │  BEGIN TRANSACTION
                │    UPDATE users SET balance = 98,197,300 WHERE id=1
                │    INSERT/UPDATE portfolios SET ...
                │    INSERT INTO transactions (...)
                │  COMMIT  ← All or Nothing
                │
                └─ Return Success
                   {
                     success: true,
                     executed_price: 18,000,
                     gross_value: 1,800,000,
                     fee_amount: 2,700,
                     net_value: 1,802,700
                   }

┌─ Virtual Trading State After ──┐
│ user.balance = 98,197,300        │
│ portfolio["BBCA"] = {qty: 100,   │
│                      avg_price:  │
│                      18,000}      │
└─────────────────────────────────┘

SELL TRANSACTION (Same user sells all BBCA)

Current Price = 19,000 (higher!)
Profit = (19,000 - 18,000) × 100 = 100,000

                │
                ├─ Gross Value = 100 × 19,000 = 1,900,000
                │
                ├─ Fee = Gross × FEE_SELL_RATE (0.25%)
                │      = 1,900,000 × 0.0025
                │      = 4,750
                │
                ├─ Net Value = Gross - Fee  (user terima)
                │            = 1,900,000 - 4,750
                │            = 1,895,250
                │
                ├─ Inventory Check
                │  if portfolio.qty < 100: FAIL ✗
                │  if portfolio.qty >= 100: OK ✓
                │
                ├─ Add to Balance
                │  balance += 1,895,250
                │  = 98,197,300 + 1,895,250
                │  = 100,092,550  ← PROFIT realized!
                │
                ├─ Remove from Portfolio
                │  portfolio.qty -= 100
                │  if portfolio.qty <= 0:
                │    DELETE portfolio
                │
                ├─ Create Transaction Record
                │  Transaction {
                │    type: "SELL",
                │    price: 19,000,
                │    fee: 4,750,
                │    net_value: 1,895,250
                │  }
                │
                └─ Commit & Return

Profit Realization:
  = (Selling price - Buying price) × qty - (buy_fee + sell_fee)
  = (19,000 - 18,000) × 100 - (2,700 + 4,750)
  = 100,000 - 7,450
  = 92,550  ← Actual profit setelah fee

Final Balance = 100,092,550
  = Initial (100M) + Profit (92,550)
```

---

# ML PIPELINE DAILY

```
Runs automatically: Mon-Fri 17:00 UTC+7

┌──────────────────────────────────────────────────────────────┐
│                    STEP 1: INGESTOR                          │
│  Download OHLCV (4 years) + Fundamental data from yfinance   │
└──────────────────────────────────────────────────────────────┘
                            ↓
        for ticker in ALL_150_BEI_STOCKS:
            data = yfinance.download(
                ticker,
                start="2022-05-22",
                end="2026-05-22",
                interval="1d"
            )
            → OHLCV data saved to data/raw/ohlcv/{ticker}.csv
            
            fundamentals = yfinance.Ticker(ticker).info
            → PE, ROE, DER, PBV, etc saved to data/raw/fundamental.csv
            
        [Parallel download with thread pools for speed]

Output: CSV files with time-series data

┌──────────────────────────────────────────────────────────────┐
│              STEP 2: FEATURE ENGINEERING                     │
│  Calculate 11 technical indicators from OHLCV               │
└──────────────────────────────────────────────────────────────┘
                            ↓
        for each ticker OHLCV:
            features = {
                'log_ret_1d': log(close[t] / close[t-1]),
                'log_ret_5d': log(close[t] / close[t-5]),
                'ma20_dist': (close - MA20) / MA20,
                'ma50_dist': (close - MA50) / MA50,
                'bb_width': (BB_upper - BB_lower) / close,
                'bb_position': (close - BB_lower) / (BB_upper - BB_lower),
                'rsi14': RSI(14),
                'macd': MACD line,
                'macd_signal': Signal line,
                'macd_hist': MACD - Signal,
                'volume_momentum': volume[t] / avg_volume
            }
            
            target = 1 if close[t+5] > close[t] * 1.05 else 0
                     (Did price go UP > 5% in next 5 days?)
            
        Output: data/processed/features_targets.csv
        Columns: [features, target, latest_day_flag]

┌──────────────────────────────────────────────────────────────┐
│                  STEP 3: MODEL INFERENCE                     │
│  XGBoost predict probability for latest day (TODAY)         │
└──────────────────────────────────────────────────────────────┘
                            ↓
        model = load("ml/models_saved/xgb_model.pkl")
        
        for each ticker's latest features:
            probability = model.predict_proba(features[today])
            → Probability stock goes UP > 5% in next 5 days
            → Range: 0.0 (won't up) to 1.0 (will definitely up)
            
        ai_score = {
            'BBCA': 0.65,   (65% chance UP > 5%)
            'ASII': 0.72,
            'SMGR': 0.25,
            ...
        }

┌──────────────────────────────────────────────────────────────┐
│                 STEP 4: SHAP EXPLAINABILITY                  │
│  Calculate SHAP values to explain each prediction           │
└──────────────────────────────────────────────────────────────┘
                            ↓
        for each ticker:
            shap_values = calculate_shap(
                model,
                features[today]
            )
            
            top_3_features = shap_values.sort_by_importance()[:3]
            
            insights = {
                'feature': 'log_ret_5d',
                'contribution': 0.15,  (15% of prediction confidence)
                'description': 'Momentum Mingguan mendorong naik'
            }
            
        Output: Detailed explanations

┌──────────────────────────────────────────────────────────────┐
│             STEP 5: DATABASE SYNC                            │
│  Update stock metadata + fundamentals in database           │
└──────────────────────────────────────────────────────────────┘
                            ↓
        for each stock in stocks table:
            UPDATE stocks SET
                roe = new_roe,
                der = new_der,
                per = new_per,
                updated_at = now()
            WHERE ticker = X

┌──────────────────────────────────────────────────────────────┐
│          STEP 6: SAVE AI SCORES (JSON Cache)                 │
│  Store results for fast access by recommendation engine     │
└──────────────────────────────────────────────────────────────┘
                            ↓
        data/processed/ai_scores.json = {
            "BBCA": {
                "ai_score": 0.65,
                "ai_score_percent": "65%",
                "insights": [
                    {
                        "feature": "log_ret_5d",
                        "contribution": 0.15,
                        "description": "Momentum..."
                    },
                    ...
                ]
            },
            ...
        }

┌──────────────────────────────────────────────────────────────┐
│          STEP 7: HOT RELOAD AI SCORE CACHE                   │
│  Reload JSON into FastAPI memory                            │
└──────────────────────────────────────────────────────────────┘
                            ↓
        ai_store = AIScoreStore()
        ai_store.load_from_json("data/processed/ai_scores.json")
        
        # Now recommendation engine gets latest scores
        # Zero downtime! Users get fresh recommendations

┌──────────────────────────────────────────────────────────────┐
│          STEP 8: INVALIDATE SAW CACHE                        │
│  Clear cached recommendations (force recalculate next call)  │
└──────────────────────────────────────────────────────────────┘
                            ↓
        _SAW_CACHE.clear()
        
        → Next user recommendation request will:
          ├─ Get latest AI scores
          ├─ Get latest fundamental metrics (just synced)
          └─ Recalculate SAW scores

Pipeline Runtime: ~30 minutes
- Ingest: 15 min (150 stocks parallel download)
- Feature: 5 min
- Inference: 3 min
- SHAP: 4 min
- Database sync: 1 min
- Cache reload: <1 min

Next run: Tomorrow 17:00
```

---

# DATABASE SCHEMA

```
PostgreSQL Tables:

┌─ USERS TABLE ─────────────────────────┐
│ id [PK]                                │
│ email [UNIQUE]                         │
│ password_hash                          │
│ full_name                              │
│ risk_profile [ENUM: Konservatif/etc]  │
│ virtual_balance [FLOAT]                │
│ created_at [TIMESTAMP]                 │
│                                        │
│ Relations:                             │
│ ├─ 1 : M portfolios                   │
│ └─ 1 : M transactions                 │
└────────────────────────────────────────┘

┌─ STOCKS TABLE ─────────────────────────┐
│ id [PK]                                 │
│ ticker [UNIQUE] (e.g., "BBCA.JK")     │
│ name                                    │
│ sector                                  │
│ industry                                │
│ is_qualified [BOOL]                     │
│ roe [FLOAT]                             │
│ der [FLOAT]                             │
│ per [FLOAT]                             │
│ updated_at [TIMESTAMP]                  │
└─────────────────────────────────────────┘

┌─ PORTFOLIOS TABLE ─────────────────────┐
│ id [PK]                                 │
│ user_id [FK → users]                   │
│ ticker [FK → stocks]                   │
│ qty [INT] (shares owned)                │
│ avg_price [FLOAT] (average cost)        │
│                                        │
│ Unique: (user_id, ticker)              │
│ So each user owns each stock once      │
└────────────────────────────────────────┘

┌─ TRANSACTIONS TABLE ──────────────────┐
│ id [PK]                                │
│ user_id [FK → users]                  │
│ ticker [STRING]                        │
│ type [ENUM: BUY/SELL]                  │
│ price [FLOAT] (execution price)        │
│ qty [INT] (shares)                     │
│ fee [FLOAT] ← NEW!                     │
│ net_value [FLOAT] ← NEW!               │
│ timestamp [DATETIME]                   │
│                                        │
│ Index: (user_id, timestamp DESC)      │
│        (ticker, timestamp DESC)        │
└────────────────────────────────────────┘

┌─ FINANCIAL_HISTORY TABLE ─────────────┐
│ id [PK]                                │
│ ticker [STRING]                        │
│ year [STRING]                          │
│ revenue [FLOAT]                        │
│ net_income [FLOAT]                     │
│ assets [FLOAT]                         │
│ liabilities [FLOAT]                    │
│ equity [FLOAT]                         │
│                                        │
│ Unique: (ticker, year)                 │
└────────────────────────────────────────┘

┌─ CORPORATE_ACTION_FLAGS ──────────────┐
│ id [PK]                                │
│ ticker [STRING]                        │
│ prev_close [FLOAT]                     │
│ curr_close [FLOAT]                     │
│ change_pct [FLOAT]                     │
│ is_resolved [BOOL]                     │
│ action_type [STRING]                   │
│ split_ratio [FLOAT]                    │
│ admin_notes [TEXT]                     │
│ detected_at [DATETIME]                 │
│ resolved_at [DATETIME]                 │
└────────────────────────────────────────┘

┌─ ALEMBIC_VERSION ─────────────────────┐
│ version_num [STRING]                   │
│                                        │
│ Tracks which migrations applied        │
│ Current: "001"                         │
└────────────────────────────────────────┘
```

---

# API ENDPOINTS DETAIL

```
AUTH Module (/auth)
═══════════════════

1. POST /auth/register
   Input: {email, password, full_name}
   Flow: Hash password → Create user → Save to DB
   Output: {id, email, full_name, risk_profile=null, ...}

2. POST /auth/login
   Input: {username (email), password}
   Flow: Verify credentials → Generate JWT
   Output: {access_token, token_type="bearer"}

3. GET /auth/me
   Auth: Required (JWT)
   Flow: Extract email from token → Query user
   Output: {id, email, risk_profile, ...}

4. GET /auth/questionnaire
   Auth: Not required (static data)
   Output: {data: [10 Q&A objects]}

5. POST /auth/submit-profiling
   Auth: Required
   Input: {k1, k2, k3, k4, k5 answers}
   Flow: Calculate SPK Tier 1 → Update user → Save
   Output: {user with new risk_profile}

RECOMMENDATION Module (/recommendation)
═════════════════════════════════════════

1. GET /recommendation/top-picks?sector=null
   Auth: Required
   Flow: Get user risk profile → Call SAW engine → Top 10
   Output: [{ticker, match_score, metrics, insights}, ...]

MARKET Module (/market)
═══════════════════════

1. GET /market/momentum?limit=10
   Flow: Get all stocks sorted by AI score
   Output: [{ticker, ai_score, current_price, ...}, ...]

2. GET /market/ai-score/{ticker}
   Flow: Lookup AI score + SHAP insights for one stock
   Output: {ticker, ai_score, insights: [...]}

3. GET /market/technical/{ticker}
   Flow: Fetch technical indicators + price history
   Output: {candlestick_data, indicators: [MA20, RSI, MACD, BB]}

4. GET /market/fundamental/{ticker}
   Flow: Fetch fundamental metrics
   Output: {PER, PBV, ROE, ROA, DER, dividend, ...}

5. GET /market/sectors
   Flow: Aggregate data per 12 BEI sectors
   Output: {sector: {stocks_count, avg_pe, ...}, ...}

6. GET /market/history/{ticker}
   Flow: 4-year financial history (Income, Balance Sheet)
   Output: {years: [{year, revenue, net_income, ...}]}

7. GET /market/live-price/{ticker}
   Flow: Call yfinance → Return current price (cached 10min)
   Output: {price, change_pct}

PORTFOLIO Module (/portfolio)
════════════════════════════════

1. GET /portfolio/
   Auth: Required
   Flow: Get user's holdings
   Output: [{ticker, qty, avg_price}, ...]

2. POST /portfolio/buy
   Auth: Required
   Input: {ticker, qty (in LOTs)}
   Flow: Get live price → Execute trade → Save transaction
   Output: {success, executed_price, fee_amount, net_value}

3. POST /portfolio/sell
   Auth: Required
   Input: {ticker, qty (in LOTs)}
   Flow: Check inventory → Execute trade → Save transaction
   Output: {success, executed_price, fee_amount, net_value}

ADMIN Module (/admin)
══════════════════════

1. POST /admin/ml/trigger-pipeline
   Auth: Required (admin only)
   Flow: Manually trigger ML pipeline (normally daily auto)
   Output: {status, pipeline_id}
```

---

# CODING PATTERN & BEST PRACTICES

## **1. Dependency Injection Pattern**

```python
# FastAPI uses dependency injection for:

# Get current user email from JWT
async def get_current_user_email(
    token: str = Depends(oauth2_scheme)
) -> str:
    payload = jwt.decode(token, SECRET_KEY, ALGORITHM)
    email = payload.get("sub")
    return email

# Use in endpoint
@router.get("/profile")
def get_profile(email: str = Depends(get_current_user_email), 
                db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    return user

# Benefits:
# - Reusable across endpoints
# - Testable (mock dependencies)
# - Clear dependency graph
# - Automatic validation
```

## **2. Service Layer Separation**

```
API Layer (Endpoint)
    ↓
Service Layer (Business Logic)
    ↓
Repository/Data Layer (Database)

Example:
@router.post("/buy")
def buy_stock(...):
    # Minimal logic in endpoint
    result = execute_trade(db, user_id, ticker, ...)
    ← Service handles all business logic

# Benefits:
# - Easy to test service independently
# - Business logic reusable (could call from CLI, batch jobs, etc)
# - Separation of concerns
```

## **3. Pydantic Models for Validation**

```python
# Automatic input validation + conversion
class TradeRequest(BaseModel):
    ticker: str
    qty: int
    
    @field_validator("qty")
    @classmethod
    def qty_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Must be > 0")
        return v

# FastAPI automatically:
# - Validates input matches schema
# - Returns 422 if invalid
# - Converts to Python types
# - Generates OpenAPI schema
```

## **4. SQLAlchemy ORM Pattern**

```python
# Define model once
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    ...

# Use everywhere
user = db.query(User).filter(User.email == email).first()
user.balance -= amount
db.commit()

# Benefits:
# - Type-safe queries
# - No SQL strings (no injection)
# - Automatic migrations via Alembic
# - Relationship traversal (user.portfolios)
```

## **5. Context Manager for Database Session**

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ensures DB connection always closed, even if error

# Use:
@router.get("/")
def endpoint(db: Session = Depends(get_db)):
    # db automatically provided
    # connection automatically closed after response
```

## **6. Atomic Transactions**

```python
# All-or-nothing transaction
try:
    user.balance -= amount
    db.add(transaction)
    db.commit()  ← Either all changes commit, or none
except Exception as e:
    db.rollback()  ← Undo all changes if error
    raise

# Prevents data corruption (balance updated but transaction not recorded, etc)
```

## **7. Logging Pattern**

```python
import logging
logger = logging.getLogger(__name__)

logger.info(f"User {email} logged in")
logger.warning(f"Balance insufficient: {user.balance} < {required}")
logger.error(f"Database error: {e}")

# All logs include: timestamp, level, message
# Can redirect to file, syslog, etc
```

## **8. Caching Pattern**

```python
# Cache with TTL + invalidation

_CACHE = {}
_CACHE_TTL = 600  # 10 minutes

def get_cached(key):
    if key in _CACHE:
        entry = _CACHE[key]
        if time.time() < entry['expiry']:
            return entry['data']  # Hit!
    
    # Cache miss: compute
    data = expensive_computation()
    _CACHE[key] = {'data': data, 'expiry': time.time() + _CACHE_TTL}
    return data

def invalidate_cache():
    _CACHE.clear()

# Benefits:
# - Huge performance improvement for repeated requests
# - Automatic expiration
# - Manual invalidation for updates
```

## **9. Error Handling**

```python
try:
    result = execute_trade(...)
except IntegrityError:
    # Data constraint violation
    return {"error": "Data conflict"}
except OperationalError:
    # DB connection issue
    return {"error": "Database down"}
except Exception as e:
    logger.error(f"Unexpected: {e}")
    return {"error": "Internal server error"}
```

## **10. Enum for Type Safety**

```python
class TransactionTypeEnum(str, enum.Enum):
    buy = "BUY"
    sell = "SELL"

# Use:
if trade_type == TransactionTypeEnum.buy:
    ...

# Benefits:
# - No string typos (TransactionTypeEnum.buyy won't exist)
# - IDE autocomplete
# - Database stores "BUY" / "SELL" but type-safe in code
```

---

