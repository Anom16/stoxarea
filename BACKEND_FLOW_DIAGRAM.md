## 📊 STOXAREA BACKEND - VISUAL FLOW SUMMARY

**File ini untuk quick reference visual flow tanpa harus baca dokumentasi panjang**

---

# 🔄 OVERALL SYSTEM ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                            │
│              React Components @ localhost:3000                      │
│                   (TypeScript/Tailwind)                            │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP/HTTPS
                         │ JSON
                         ↓
        ┌────────────────────────────────────────────┐
        │                                            │
        │          FASTAPI BACKEND                   │
        │  (Uvicorn ASGI Server, Multi-Worker)      │
        │                                            │
        │  Middleware:                               │
        │  ├─ CORS (allow localhost:3000)           │
        │  ├─ Auth (JWT)                            │
        │  └─ Error Handling                        │
        │                                            │
        │  5 Router Modules:                         │
        │  ├─ auth.py (registration, JWT)           │
        │  ├─ recommendation.py (SPK Tier 3)        │
        │  ├─ market.py (stock data)                │
        │  ├─ portfolio.py (virtual trading)        │
        │  └─ admin_ml.py (admin controls)          │
        │                                            │
        └────────────────────────────────────────────┘
                    │          │          │
         ┌──────────┼──────────┼──────────┬──────────┐
         │          │          │          │          │
         ↓          ↓          ↓          ↓          ↓
      ┌──────┐  ┌──────┐  ┌──────┐  ┌────────┐  ┌─────────┐
      │Cache │  │MLModel│  │yfinance│  │SPK  │  │Database │
      │JSON  │  │ Pickle │  │ API    │  │Logic│  │ Query   │
      └──────┘  └──────┘  └──────┘  └────────┘  └─────────┘
         │          │          │          │          │
         └──────────┴──────────┴──────────┴──────────┘
                         │
                         ↓
        ┌────────────────────────────────────────────┐
        │    PostgreSQL Database (Supabase Cloud)    │
        │                                            │
        │ Tables:                                    │
        │ • users (100 users × 1 = 100 rows)        │
        │ • stocks (150 BEI stocks)                 │
        │ • portfolios (100 × 5 = ~500)            │
        │ • transactions (100 × 50 = 5000+)        │
        │ • financial_history (150 × 5 = 750)      │
        │ • corporate_action_flags                 │
        │ • alembic_version (migration tracking)   │
        │                                            │
        └────────────────────────────────────────────┘

        ┌────────────────────────────────────────────┐
        │    Background ML Pipeline (APScheduler)    │
        │                                            │
        │ Trigger: Every Mon-Fri at 17:00           │
        │                                            │
        │ 1. Download data (yfinance)               │
        │ 2. Feature engineering                    │
        │ 3. XGBoost inference                      │
        │ 4. SHAP calculation                       │
        │ 5. Database sync                          │
        │ 6. Cache hot-reload                       │
        │                                            │
        │ Duration: ~30 min                         │
        │ Output: ai_scores.json                    │
        │                                            │
        └────────────────────────────────────────────┘
```

---

# 👤 USER FLOW DIAGRAM

```
START
  │
  ├─→ [REGISTRATION PAGE]
  │   │
  │   ├─ Enter email, password, name
  │   │
  │   └─→ POST /auth/register
  │       │
  │       └─→ ✅ Account created
  │           Balance = 100 Juta
  │
  ├─→ [LOGIN PAGE]
  │   │
  │   ├─ Enter email, password
  │   │
  │   └─→ POST /auth/login
  │       │
  │       └─→ ✅ JWT Token generated
  │           (Stored in localStorage/cookie)
  │
  ├─→ [PROFILING PAGE]
  │   │
  │   ├─ GET /auth/questionnaire
  │   │ Returns 10 questions about risk tolerance
  │   │
  │   ├─ User answers Q1-Q10
  │   │
  │   └─→ POST /auth/submit-profiling {k1,k2,k3,k4,k5}
  │       │
  │       ├─ Check VETO logic (emergency fund)
  │       ├─ Calculate total score
  │       ├─ Assign profile: Konservatif/Moderat/Agresif
  │       │
  │       └─→ ✅ Risk profile assigned
  │           (Stored in users table)
  │
  ├─→ [RECOMMENDATION PAGE]
  │   │
  │   └─→ GET /recommendation/top-picks?sector=null
  │       │
  │       ├─ SPK Tier 3: SAW Algorithm
  │       │ • Load AI scores from cache
  │       │ • Get profile weights
  │       │ • Normalize fundamentals
  │       │ • Calculate weighted SAW score
  │       │ • Sort by score DESC
  │       │
  │       └─→ ✅ Top 10 stocks displayed
  │           (Personalized for this user!)
  │
  ├─→ [STOCK DETAIL PAGE]
  │   │
  │   ├─→ GET /market/ai-score/{ticker}
  │   │   → AI score + SHAP insights
  │   │
  │   ├─→ GET /market/technical/{ticker}
  │   │   → Candlestick + indicators
  │   │
  │   ├─→ GET /market/fundamental/{ticker}
  │   │   → ROE, DER, PER metrics
  │   │
  │   └─→ GET /market/live-price/{ticker}
  │       → Current price for trading
  │
  ├─→ [VIRTUAL TRADING PAGE]
  │   │
  │   ├─ Display portfolio (holdings)
  │   │ ├─→ GET /portfolio/
  │   │ │   Returns: [{ticker, qty, avg_price}, ...]
  │   │
  │   ├─ BUY STOCK
  │   │ └─→ POST /portfolio/buy {ticker: "BBCA", qty: 1}
  │   │     │
  │   │     ├─ Get live price (yfinance)
  │   │     ├─ Calculate gross + fee
  │   │     ├─ Check balance sufficient
  │   │     ├─ Update portfolio
  │   │     ├─ Deduct balance
  │   │     ├─ Record transaction
  │   │     │
  │   │     └─→ ✅ Transaction success
  │   │
  │   ├─ SELL STOCK
  │   │ └─→ POST /portfolio/sell {ticker: "BBCA", qty: 1}
  │   │     │
  │   │     ├─ Check inventory sufficient
  │   │     ├─ Get live price
  │   │     ├─ Calculate gross - fee
  │   │     ├─ Add to balance
  │   │     ├─ Remove from portfolio
  │   │     ├─ Record transaction
  │   │     │
  │   │     └─→ ✅ Transaction success
  │   │         (Profit = selling price - buying price - all fees)
  │
  └─→ [REPEAT: Check recommendations, trade, track P&L]

User Journey Timeline:
  Day 1: Register → Profiling → Get recommendations
  Day 2-30: Simulate trading, check performance
  Daily: Recommendations updated (AI scores refresh daily)
  Weekly: Track portfolio performance
```

---

# 🧠 SPK 3-TIER DECISION SYSTEM

```
                    SPK (Sistem Pendukung Keputusan)
                 3-Tier Recommendation Architecture

┌──────────────────────────────────────────────────────┐
│              INPUT: User Profile Data                │
│  • Risk tolerance answers (10 questions)             │
│  • Emergency fund status                             │
│  • Desired sector filter                             │
└────────────────┬─────────────────────────────────────┘
                 │
                 ↓
    ┌────────────────────────────────────┐
    │  SPK TIER 1: RISK PROFILING        │
    │  (spk1_profiling.py)               │
    ├────────────────────────────────────┤
    │ Input: 5 questionnaire scores      │
    │        (each 1-5 range)            │
    │                                    │
    │ Process:                           │
    │ 1. VETO check (emergency fund)    │
    │    → Force Konservatif if needed  │
    │                                    │
    │ 2. Total score: k1+k2+k3+k4+k5   │
    │    Min: 5, Max: 25                │
    │                                    │
    │ 3. Categorize:                    │
    │    <12 → Konservatif              │
    │    12-18 → Moderat                │
    │    >18 → Agresif                  │
    │                                    │
    │ Output: RiskProfileEnum            │
    │ Stored in: users.risk_profile     │
    └────────┬───────────────────────────┘
             │
    ┌────────┴───────────────────────────┐
    │ PROFILE WEIGHTS (for SAW):         │
    │                                    │
    │ Konservatif:                       │
    │   AI: 10%  ROE: 50%                │
    │   DER: 30% PER: 10%                │
    │                                    │
    │ Moderat:                           │
    │   AI: 40%  ROE: 30%                │
    │   DER: 20% PER: 10%                │
    │                                    │
    │ Agresif:                           │
    │   AI: 80%  ROE: 10%                │
    │   DER: 5%  PER: 5%                 │
    └────────┬───────────────────────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │  SPK TIER 2: AI MOMENTUM RANKING   │
    │  (spk2_scoring.py)                 │
    ├────────────────────────────────────┤
    │ Input: AI scores from ML model     │
    │        (updated daily)             │
    │                                    │
    │ Process:                           │
    │ 1. Load from cache:                │
    │    BBCA: 0.65, ASII: 0.72, ...    │
    │                                    │
    │ 2. Load qualified stocks:          │
    │    is_qualified = true only        │
    │                                    │
    │ 3. Rank by AI score DESC:          │
    │    ASII (0.72) > BBCA (0.65) > ...│
    │                                    │
    │ Output: Stocks ranked by           │
    │ momentum/upside probability        │
    │                                    │
    │ Function: get_top_momentum_stocks()│
    └────────┬───────────────────────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │  SPK TIER 3: SAW RECOMMENDATIONS   │
    │  (spk3_saw.py)                     │
    ├────────────────────────────────────┤
    │ Input: User profile weights        │
    │        All stock data (AI+Fund)    │
    │        Sector filter (optional)    │
    │                                    │
    │ Process:                           │
    │ 1. For each qualified stock:       │
    │                                    │
    │    Normalize metrics (cap outliers)│
    │    roe_n = roe / 50 (cap: 50)     │
    │    der_n = 1/(der+0.1) (inverse)  │
    │    per_n = 1/per (inverse)        │
    │    ai_n = ai_score (0-1)          │
    │                                    │
    │ 2. Calculate SAW score:            │
    │    SAW = w_ai×n_ai +              │
    │          w_roe×n_roe +            │
    │          w_der×n_der +            │
    │          w_per×n_per              │
    │                                    │
    │    Example (Moderat user):        │
    │    SAW = 0.40×0.65 +             │
    │            0.30×0.80 +            │
    │            0.20×0.70 +            │
    │            0.10×0.50              │
    │        = 0.260 + 0.240 + 0.140   │
    │          + 0.050 = 0.690          │
    │                                    │
    │ 3. Sort by SAW DESC               │
    │                                    │
    │ 4. Apply sector filter (if any)   │
    │                                    │
    │ Output: Top 10 personalized       │
    │ recommendations with scores       │
    │                                    │
    │ Cache: Per-profile × sector       │
    │        TTL: 10 min                │
    │        Per-key locks (no thunderherd)
    └────────┬───────────────────────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │  OUTPUT: Personalized Picks        │
    │  • Ranked by match score          │
    │  • Tailored to risk profile       │
    │  • Includes fundamental metrics   │
    │  • AI insights (SHAP)             │
    │  • Current price                  │
    └────────────────────────────────────┘

KEY INSIGHT:
━━━━━━━━━
- Konservatif users: Heavy on ROE (stable profits) + low DER (low debt)
- Moderat users: Balanced mix of everything
- Agresif users: Heavy on AI momentum (chase trends) + care less about fundamentals

Real Flow Example:
  User answers 10 Q's:
    k1=5 (want 20%+ return)
    k2=3 (quality okay)
    k3=5 (can handle swings)
    k4=3 (moderate price sensitivity)
    k5=2 (decent emergency fund)
  
  Total = 18 → Moderat
  
  Get profile weights: {ai: 0.40, roe: 0.30, der: 0.20, per: 0.10}
  
  For BBCA:
    SAW = 0.40(0.65) + 0.30(0.80) + 0.20(0.70) + 0.10(0.50) = 0.690
  
  For ASII:
    SAW = 0.40(0.72) + 0.30(0.75) + 0.20(0.65) + 0.10(0.60) = 0.704
  
  ASII > BBCA → ASII ranked higher for this user!
```

---

# 💰 VIRTUAL TRADING MECHANICS

```
Trade Execution Flow (Atomic Transaction)

┌─ BEFORE TRADE ──┐
│ Balance: 100M   │
│ Holdings: Empty │
└─────────────────┘

        │
        ↓

    USER ACTION: BUY 1 LOT BBCA

        │
        ├─ Get current price (yfinance)
        │   → 18,000
        │
        ├─ Calculate trade parameters
        │   qty_shares = 1 lot × 100 = 100 lembar
        │   gross_value = 100 × 18,000 = 1,800,000
        │   fee = 1,800,000 × 0.15% = 2,700
        │   net_value = 1,800,000 + 2,700 = 1,802,700
        │
        ├─ Validate
        │   if balance < net_value:
        │     ❌ FAIL "Saldo tidak cukup"
        │   else:
        │     ✅ OK
        │
        └─ Execute (Atomic)
            BEGIN TRANSACTION
            │
            ├─ Deduct balance
            │  100,000,000 - 1,802,700 = 98,197,300
            │
            ├─ Create/Update portfolio
            │  if BBCA not in portfolio:
            │    INSERT portfolio(user, ticker, qty=100, avg_price=18000)
            │  else:
            │    Recalculate avg_price
            │
            ├─ Record transaction
            │  INSERT transactions(
            │    user=1, ticker='BBCA', type='BUY',
            │    price=18000, qty=100,
            │    fee=2700, net_value=1802700,
            │    timestamp=now()
            │  )
            │
            └─ COMMIT (All or nothing!)

┌─ AFTER BUY ──────┐
│ Balance: 98.2M   │
│ Holdings:        │
│  BBCA: 100 @ avg │
│        18,000    │
└──────────────────┘

        ↓ (Next day, price goes UP)

    USER ACTION: SELL 1 LOT BBCA @ 19,000

        │
        ├─ Calculate
        │   qty_shares = 100
        │   current_price = 19,000
        │   gross_value = 100 × 19,000 = 1,900,000
        │   fee = 1,900,000 × 0.25% = 4,750
        │   net_value = 1,900,000 - 4,750 = 1,895,250
        │
        ├─ Validate inventory
        │   if holdings["BBCA"] < 100:
        │     ❌ FAIL "Tidak punya saham ini"
        │   else:
        │     ✅ OK
        │
        └─ Execute (Atomic)
            BEGIN TRANSACTION
            │
            ├─ Add to balance
            │  98,197,300 + 1,895,250 = 100,092,550
            │
            ├─ Remove from portfolio
            │  holdings["BBCA"].qty -= 100
            │  if qty <= 0: DELETE portfolio entry
            │
            ├─ Record transaction
            │  INSERT transactions(
            │    user=1, ticker='BBCA', type='SELL',
            │    price=19000, qty=100,
            │    fee=4750, net_value=1895250,
            │    timestamp=now()
            │  )
            │
            └─ COMMIT

┌─ AFTER SELL ─────┐
│ Balance:         │
│ 100,092,550      │ ← NET PROFIT!
│ Holdings: Empty  │
└──────────────────┘

PROFIT CALCULATION:
  Gross profit = (selling - buying) × qty
               = (19,000 - 18,000) × 100
               = 100,000
  
  Total fees = buy_fee + sell_fee
             = 2,700 + 4,750
             = 7,450
  
  Net profit = gross - fees
             = 100,000 - 7,450
             = 92,550 ✅

FEE RATES (BEI Standard):
  BUY:  0.15% (broker fee)
  SELL: 0.25% (broker fee + tax: PPh 0.1%)
  
This prevents "ilusion profit" dari scalping!
```

---

# 📊 DAILY ML PIPELINE (17:00)

```
TIME: 17:00 UTC+7 (Every Mon-Fri)

STAGE 1: INGEST DATA (15 min)
─────────────────────────────
  for ticker in [150 BEI stocks]:
    download OHLCV (4 years)
    download fundamental data
  
  → data/raw/ohlcv/{ticker}.csv
  → data/raw/fundamental.csv
  
  [Parallel download, ~10x speedup]

STAGE 2: FEATURE ENGINEERING (5 min)
─────────────────────────────────────
  for each ticker's OHLCV:
    Calculate 11 technical features:
    • Log returns (1d, 5d)
    • Moving avg distances
    • Bollinger bands
    • RSI, MACD
    • Volume momentum
    
    Generate target:
    target = 1 if price up >5% in 5 days
    
  → data/processed/features_targets.csv

STAGE 3: MODEL INFERENCE (3 min)
─────────────────────────────────
  Load trained model: xgb_model.pkl
  
  for latest features of each stock:
    prediction = model.predict_proba(features)
    → ai_score = 0.0 to 1.0
  
  BBCA: 0.65 (65% will up)
  ASII: 0.72 (72% will up)
  ...

STAGE 4: SHAP EXPLAINABILITY (4 min)
──────────────────────────────────────
  for each prediction:
    Calculate SHAP values
    → Which features drove prediction?
    → Top 3 influencing features
    → Human-readable insights
  
  Insight example:
  "5-day momentum mendorong naik 15%"

STAGE 5: DATABASE SYNC (1 min)
───────────────────────────────
  UPDATE stocks SET
    roe = latest_roe,
    der = latest_der,
    per = latest_per,
    ...

STAGE 6: SAVE AI SCORES (JSON)
──────────────────────────────
  Save to: data/processed/ai_scores.json
  
  Format:
  {
    "BBCA": {
      "ai_score": 0.65,
      "insights": [{
        "feature": "log_ret_5d",
        "contribution": 0.15,
        "description": "Momentum..."
      }, ...]
    },
    ...
  }

STAGE 7: HOT RELOAD CACHE
─────────────────────────
  Load JSON into FastAPI memory
  → AIScoreStore.reload()
  
  Zero downtime!
  Next user gets latest scores immediately

STAGE 8: INVALIDATE SAW CACHE
─────────────────────────────
  Clear all cached recommendations
  → Force recalculation next request
  → Uses latest data

TOTAL TIME: ~30 minutes
NEXT RUN: Tomorrow 17:00

RESULT:
✅ All 150 stocks scored with AI + explanations
✅ Database updated with latest fundamentals
✅ Recommendations engine has fresh data
✅ Zero downtime, users get instant updates
```

---

# 🗄️ DATABASE RELATIONSHIPS

```
users (1)
  ├─────┬─────────────────┬─────────────────┐
  │     │                 │                 │
  │     ↓                 ↓                 ↓
  ├── (M) portfolios   (M) transactions    
  │      │                 │
  │      │                 ├─ ticker (string, not FK)
  │      │                 ├─ type (BUY/SELL)
  │      │                 ├─ price, qty
  │      │                 ├─ fee, net_value ← NEW!
  │      │                 └─ timestamp
  │      │
  │      ├─ ticker (FK → stocks)
  │      ├─ qty (current holdings)
  │      └─ avg_price (cost basis)
  │
  ├─ id (PK)
  ├─ email (UNIQUE)
  ├─ password_hash
  ├─ risk_profile (Konservatif/Moderat/Agresif)
  ├─ virtual_balance (Rp)
  └─ created_at

stocks (1)
  ├─────┬──────────────┐
  │     │              │
  ├─ ticker (UNIQUE)
  ├─ name
  ├─ sector (12 BEI sectors)
  ├─ industry
  ├─ is_qualified (bool)
  ├─ roe, der, per (fundamentals)
  └─ updated_at (from daily pipeline)

Indices:
  • users(email) - fast login lookup
  • stocks(ticker) - fast stock lookup
  • portfolios(user_id, ticker) - unique per user-stock combo
  • transactions(user_id, timestamp DESC) - fast history
```

---

# 🔑 KEY CONCEPTS

```
1. VETO LOGIC
   If user has emergency fund in use (k5=1),
   FORCE their profile to Konservatif regardless of other answers.
   → Safety mechanism for vulnerable users

2. ATOMIC TRANSACTIONS
   When buying/selling:
   - Update balance
   - Update portfolio
   - Record transaction
   ALL happen together or NONE happen.
   → Prevents balance updated but transaction not recorded

3. OUTLIER CAPPING
   Some stocks have very high ROE/low PER.
   SAW algorithm caps at reasonable max (ROE=50, PER=100)
   → Prevents one extreme metric from skewing recommendation

4. PER-KEY LOCKING
   With 100 concurrent users requesting Moderat profile:
   - Old way: All 100 calculate SAW (wasted CPU)
   - New way: 1 calculates, others wait for result
   → Prevent "thundering herd" problem

5. HOT RELOAD CACHE
   ML pipeline generates ai_scores.json
   Backend reloads into memory without restart
   → Zero downtime, instant updates

6. AVERAGE COST BASIS
   When user buys BBCA multiple times at different prices:
   avg_price = (qty1*price1 + qty2*price2) / (qty1 + qty2)
   → Used for P&L calculation

7. FEE TRANSPARENCY
   Every trade records fee + net_value
   → Users see realistic costs, not "ilusion profit"
```

---

# 📱 RESPONSE EXAMPLES

```
LOGIN SUCCESS:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}

GET RECOMMENDATIONS (Top 3 of 10):
[
  {
    "ticker": "ASII",
    "match_score": 0.704,
    "name": "Astra International",
    "current_price": 7250,
    "sector": "Automotif",
    "metrics": {
      "ai_score": 0.72,
      "roe": 0.75,
      "der": 0.65,
      "per": 0.60
    },
    "insights": [
      {
        "feature": "log_ret_5d",
        "contribution": 0.18,
        "description": "Momentum mingguan kuat"
      },
      ...
    ]
  },
  ...
]

BUY RESPONSE:
{
  "message": "Berhasil membeli 1 lot BBCA",
  "executed_price": 18000,
  "gross_value": 1800000,
  "fee_amount": 2700,
  "fee_rate": "0.15%",
  "net_value": 1802700,
  "qty_lembar": 100
}

GET PORTFOLIO:
[
  {
    "ticker": "BBCA",
    "qty": 100,
    "avg_price": 18000
  },
  {
    "ticker": "ASII",
    "qty": 50,
    "avg_price": 7200
  }
]
```

---

**🎯 QUICK REFERENCE COMPLETE!**

For more details, see: `BACKEND_DETAILED_EXPLANATION.md`
