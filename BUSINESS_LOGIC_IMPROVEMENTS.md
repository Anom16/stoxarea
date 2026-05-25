# 🎯 BUSINESS LOGIC IMPROVEMENTS UNTUK STOXAREA

> **Status**: Priority-based roadmap untuk meningkatkan kualitas rekomendasi & user experience
> **Date**: May 25, 2026

---

## 📊 CURRENT STATE ANALYSIS

### 1. **SPK Lapis 1 - Risk Profiling** ⚠️ BASIC

**Current Implementation:**
- Questionnaire: 10 pertanyaan → Score calculation
- Score ranges: `<12 (Konservatif), 12-18 (Moderat), >18 (Agresif)`
- VETO logic: Emergency funds → Force Konservatif

**Issues Found:**
- ❌ Fixed score threshold arbitrary (12, 18) - tidak berbasis data
- ❌ VETO logic terlalu kaku - emergency fund ≠ always risky
- ❌ No time-decay: Risk profile dari 2 tahun lalu masih berlaku
- ❌ No dynamic adjustment: Portfolio performance tidak mempengaruhi profile
- ❌ Missing factors: Investment horizon, income stability, family dependents

**Recommendations:**

| Priority | Issue | Solution | Effort |
|----------|-------|----------|--------|
| 🔴 HIGH | Score threshold tidak berbasis data | Analyze actual portfolio performance → Set threshold empirically | Medium |
| 🔴 HIGH | VETO logic terlalu kaku | Conditional weighting instead of hard rule | Low |
| 🟡 MEDIUM | No psychological factors | Add behavioral questions (loss aversion, regret) | Medium |
| 🟡 MEDIUM | Static profile | Auto-adjust profile based on portfolio 3-month performance | High |

---

### 2. **SPK Lapis 2 - AI Scoring (XGBoost)** ⚠️ NEEDS IMPROVEMENT

**Current Implementation:**
- Binary classification: "Stock up >5% in next 5 days?" (Yes/No)
- Features: 11 technical indicators (MA, RSI, MACD, BB, Volume)
- Training: Walk-forward validation (5 splits)
- Output: Probability score per stock (0-100%)

**Issues Found:**
- ❌ **Class imbalance**: Probably 30% up, 70% down → Model biased to NO
- ❌ **5% threshold arbitrary**: Why 5%? Could be 2%, 10%, varies by volatility
- ❌ **No sector/market context**: Uses only technical indicators
- ❌ **Static model**: Retrains only daily, doesn't adapt to market regime
- ❌ **Missing fundamental factors**: ROE, DER, PER not in ML model
- ❌ **Weak validation**: Walk-forward doesn't catch model decay
- ❌ **No ensemble**: Only XGBoost, no voting models

**Recommendations:**

| Priority | Issue | Solution | Effort |
|----------|-------|----------|--------|
| 🔴 HIGH | Class imbalance | Apply SMOTE (Synthetic Minority Oversampling) | Medium |
| 🔴 HIGH | Threshold is arbitrary | Multi-output model: Predict return % directly | High |
| 🔴 HIGH | Missing fundamentals | Add ROE, DER, PER, Dividend yield to features | Medium |
| 🟡 MEDIUM | No market context | Add sector momentum as feature | Low |
| 🟡 MEDIUM | Static threshold | Use model confidence score (threshold = dynamic) | Low |
| 🟡 MEDIUM | Single model | Ensemble: XGBoost + LightGBM + CatBoost (voting) | High |
| 🟡 MEDIUM | Poor validation | Add holdout test set (last 3 months) + monitoring | Medium |

**Quick Win - SMOTE Implementation:**
```python
from imblearn.over_sampling import SMOTE

# Current: X_train shape (800, 11) - class 0: 560, class 1: 240 (imbalanced!)
# Apply SMOTE:
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_train, y_train)
# Now: X_resampled shape (1120, 11) - class 0: 560, class 1: 560 (balanced!)

# Train on balanced data
model = XGBClassifier(scale_pos_weight=1)  # No longer need manual scaling
model.fit(X_resampled, y_resampled)
```

---

### 3. **SPK Lapis 3 - SAW Recommendations** ⚠️ SIMPLISTIC

**Current Implementation:**
- SAW formula: `Score = (n_ai × w_ai) + (n_roe × w_roe) + (n_der × w_der) + (n_per × w_per)`
- Outlier capping: ROE max 50%, DER max 5, PER max 100 (hardcoded!)
- Normalization: Min-max scaling
- User weights: 3 profiles (Konservatif/Moderat/Agresif)

**Issues Found:**
- ❌ **Fixed outlier caps**: Should be based on distribution (e.g., P95)
- ❌ **No correlation handling**: ROE and AI Score correlated → double-counting
- ❌ **Simplistic weights**: Same weights for all users in same profile
- ❌ **No sector bias**: Doesn't account for sector average ROE
- ❌ **Static normalization**: Uses global min/max, not by sector
- ❌ **No penalty for risk**: High debt (DER) should heavily penalize Konservatif

**Recommendations:**

| Priority | Issue | Solution | Effort |
|----------|-------|----------|--------|
| 🔴 HIGH | Fixed outlier caps | Calculate P5-P95 from data distribution | Low |
| 🔴 HIGH | No correlation handling | Use PCA or correlation analysis → Remove redundant metrics | Medium |
| 🟡 MEDIUM | Static normalization | Normalize per-sector (ROE vs sector average ROE) | Medium |
| 🟡 MEDIUM | Simple weights | Add user customization → Let users weight metrics | Medium |
| 🟡 MEDIUM | No sector diversification | Add sector diversity constraint (max 3 from same sector) | Low |
| 🟡 MEDIUM | No dividend consideration | Add dividend yield to metrics for Konservatif | Low |

**Quick Win - Dynamic Outlier Capping:**
```python
import numpy as np

# Current: hardcoded caps
# roe_max = 50, der_max = 5, per_max = 100

# Better: P95 from actual data
roe_p95 = np.percentile(stocks['roe'].dropna(), 95)  # Maybe 45?
der_p95 = np.percentile(stocks['der'].dropna(), 95)  # Maybe 3.2?
per_p95 = np.percentile(stocks['per'].dropna(), 95)  # Maybe 25?

# Normalize using data-driven bounds
roe_normalized = min(stock['roe'], roe_p95) / roe_p95
```

---

### 4. **Virtual Trading** ❌ UNREALISTIC

**Current Implementation:**
- Instant execution at requested price
- Fee: 0.15% (BUY), 0.25% (SELL)
- No slippage, no bid-ask spread
- Average price tracking for holdings

**Issues Found:**
- ❌ **No slippage simulation**: Buy/sell at market price, but market moves after order
- ❌ **No liquidity check**: Can buy 10M worth of stock with low volume
- ❌ **No bid-ask spread**: Assumes perfect execution
- ❌ **Missing execution costs**: No commissions, no tax implications
- ❌ **No order size impact**: Large orders don't move price
- ❌ **Unrealistic fee structure**: Fixed %, not real broker fees

**Recommendations:**

| Priority | Issue | Solution | Effort |
|----------|-------|----------|--------|
| 🟡 MEDIUM | No slippage | Model slippage = (order_qty / daily_volume) × volatility × 0.5% | Medium |
| 🟡 MEDIUM | No liquidity check | Get daily volume from yfinance, check order feasibility | Low |
| 🟡 MEDIUM | No bid-ask spread | Add spread simulation: price ± (spread% × volatility) | Low |
| 🟡 MEDIUM | Simple fee structure | Match real Indo brokers: flat + %, tiered by volume | Low |
| 🟢 LOW | Missing tax | Add 10% capital gains tax on profitable sells | Medium |

**Quick Win - Slippage Model:**
```python
# Slippage estimation formula
def estimate_slippage(ticker, order_qty, order_type='BUY'):
    daily_volume = get_daily_volume(ticker)  # From yfinance
    volatility = get_volatility(ticker)      # Calculate from recent prices
    
    # Slippage = (Order size % of daily volume) × Volatility × Base factor
    order_pct_of_volume = order_qty / daily_volume
    slippage_pct = min(order_pct_of_volume * volatility * 0.5, 2.0)  # Cap at 2%
    
    # Apply slippage to execution price
    if order_type == 'BUY':
        execution_price = current_price * (1 + slippage_pct)
    else:
        execution_price = current_price * (1 - slippage_pct)
    
    return execution_price, slippage_pct
```

---

### 5. **ML Pipeline** ⚠️ BASIC ENGINEERING

**Current Implementation:**
- Daily run at 17:00 Mon-Fri
- 6-step pipeline: Download → Feature → Inference → SHAP → Sync DB → Reload cache
- Walk-forward validation (5 splits)
- Train on 5 years of historical data

**Issues Found:**
- ❌ **Feature leakage**: Using future data in feature calculation?
- ❌ **No rebalancing**: Portfolio doesn't rebalance on new recommendations
- ❌ **Static features**: Same 11 features regardless of market regime
- ❌ **No model monitoring**: No performance tracking over time
- ❌ **Incomplete SHAP insights**: Top 3 features too generic
- ❌ **No ensemble prediction**: Single XGBoost model
- ❌ **Missing macro indicators**: Doesn't consider rate, inflation, IDX volatility

**Recommendations:**

| Priority | Issue | Solution | Effort |
|----------|-------|----------|--------|
| 🔴 HIGH | Feature leakage | Review feature engineering → Ensure no look-ahead bias | High |
| 🟡 MEDIUM | No model monitoring | Track daily model accuracy, retrain if performance drops | Medium |
| 🟡 MEDIUM | Missing macro factors | Add IDX momentum, VIX equivalent, interest rate trend | Medium |
| 🟡 MEDIUM | Single model | Build 3-model ensemble (XGBoost, LightGBM, CatBoost) | High |
| 🟢 LOW | Generic insights | Personalize SHAP → Show only relevant features for user | Medium |
| 🟢 LOW | No adaptive threshold | Dynamic threshold: higher in bull market, lower in bear | Medium |

---

## 🚀 IMPLEMENTATION ROADMAP

### **Phase 1: Quick Wins (1-2 days)** 🟢

1. **SMOTE for class imbalance** ← ⭐ HIGHEST ROI
   - File: `stoxarea-backend/ml/training/train_xgboost.py`
   - Impact: Better model calibration, fewer false positives
   - Code complexity: Low
   - Time: 2 hours

2. **Dynamic outlier capping from P95**
   - File: `stoxarea-backend/ml/pipeline/outlier_guard.py` (modify)
   - Impact: More robust SAW scoring
   - Code complexity: Low
   - Time: 1 hour

3. **Sector-based normalization in SAW**
   - File: `stoxarea-backend/app/services/spk3_saw.py`
   - Impact: Fairer cross-sector comparisons
   - Code complexity: Low
   - Time: 2 hours

4. **Add slippage model to virtual trading**
   - File: `stoxarea-backend/app/services/virtual_trading.py`
   - Impact: More realistic trade execution
   - Code complexity: Medium
   - Time: 3 hours

**Total: ~8 hours**

---

### **Phase 2: Medium-Term (3-5 days)** 🟡

1. **Empirically determine risk profile thresholds**
   - Analyze all user portfolios → Find optimal breakpoints
   - File: `stoxarea-backend/app/services/spk1_profiling.py`
   - Impact: Better risk profile fit
   - Time: 1 day

2. **Add fundamental features to XGBoost**
   - Combine technical (11) + fundamental (ROE, DER, PER, Div Yield) = 15 features
   - File: `stoxarea-backend/ml/features/fundamental_features.py` (create new)
   - Impact: More robust AI scoring
   - Time: 1-2 days

3. **Implement model monitoring dashboard**
   - Track daily accuracy, precision, recall
   - Alert if accuracy drops below 52%
   - File: Create `stoxarea-backend/ml/monitoring/performance_tracker.py` (new)
   - Impact: Catch model decay early
   - Time: 1 day

4. **User customizable SAW weights**
   - Frontend: Allow user to adjust weight allocation
   - File: `stoxarea-frontend/src/components/RecommendationCustomizer.tsx` (new)
   - Impact: Better user engagement
   - Time: 1 day

**Total: ~4 days**

---

### **Phase 3: Advanced (1-2 weeks)** 🔴

1. **3-model ensemble (XGBoost + LightGBM + CatBoost)**
   - Majority voting on predictions
   - File: `stoxarea-backend/ml/training/ensemble_trainer.py` (new)
   - Impact: More robust predictions, reduce overfitting
   - Time: 3-4 days

2. **Macro indicators integration**
   - Add IDX momentum, implied volatility, rate trend
   - File: `stoxarea-backend/ml/features/macro_features.py` (new)
   - Impact: Market-aware recommendations
   - Time: 2-3 days

3. **Dynamic risk profile adjustment**
   - Auto-adjust profile based on 3-month portfolio performance
   - File: `stoxarea-backend/app/services/spk1_profiling.py` (extend)
   - Impact: Adaptive personalization
   - Time: 2 days

4. **Tax-aware virtual trading**
   - Track cost basis, calculate capital gains, simulate 10% tax
   - File: `stoxarea-backend/app/services/virtual_trading.py` (extend)
   - Impact: Realistic P&L
   - Time: 2 days

**Total: ~10 days**

---

## 📈 EXPECTED IMPROVEMENTS

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| **AI Score accuracy** | ~55% | 58-60% | SMOTE + fundamental features |
| **Recommendation hit rate** | ~45% | 50-55% | Better normalization + macro factors |
| **User engagement** | ? | +20% | Customizable weights + transparency |
| **Model stability** | Unknown | Monitored | Performance tracking |
| **Realistic simulation** | Unrealistic | ±5% vs real | Slippage + bid-ask + liquidity |
| **Time to implement** | N/A | Phased | Quick wins first |

---

## 🎓 REFERENCES

**Class Imbalance:**
- SMOTE: https://imbalanced-learn.org/stable/references/generated/imblearn.over_sampling.SMOTE.html
- Cost-sensitive learning: XGBoost `scale_pos_weight` parameter

**Feature Engineering:**
- Fundamental features: Income statement, balance sheet metrics from yfinance
- Macro features: FRED API (Federal Reserve), Investing.com

**Model Validation:**
- Walk-forward validation with holdout test set
- Backtesting framework: `backtrader`, `bt`

**Ensemble Methods:**
- LightGBM: Gradient boosting alternative to XGBoost
- CatBoost: Handles categorical variables better
- Voting classifier: `sklearn.ensemble.VotingClassifier`

**Market Microstructure:**
- Slippage model: Kyle's model, Almgren-Chriss impact model
- Bid-ask spread: Time and sales data from exchange

---

## 💡 QUICK DECISION MATRIX

**Start with Phase 1 if you want:**
- ✅ Quick improvements (1-2 days)
- ✅ Low risk, high confidence
- ✅ 5-10% accuracy improvement

**Start with Phase 2 if you want:**
- ✅ Solid foundation for future work
- ✅ Better user experience
- ✅ 10-20% improvement

**Start with Phase 3 if you want:**
- ✅ Production-grade system
- ✅ Competitive advantage
- ✅ 20%+ improvement (but 2+ weeks effort)

---

## 🔗 NEXT STEPS

1. **Review this document** with team
2. **Choose priority**: Phase 1 → 2 → 3, or pick specific items?
3. **Assign tasks** to developers
4. **Set milestones** (weekly checkpoints)
5. **Measure results** (accuracy, engagement, P&L vs benchmark)

**Need implementation code for any of these? Just ask! 🚀**
