"""
setup_structure.py
------------------
Jalankan script ini sekali di awal proyek untuk membuat
seluruh struktur folder dan file placeholder StoxArea.

Cara pakai:
    python setup_structure.py
"""

import os
from pathlib import Path

# ── Warna terminal ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
BLUE   = "\033[94m"
YELLOW = "\033[93m"
RESET  = "\033[0m"

def log_dir(path):  print(f"  {BLUE}📁 {path}{RESET}")
def log_file(path): print(f"  {GREEN}📄 {path}{RESET}")
def log_head(text): print(f"\n{YELLOW}{'─'*50}\n  {text}\n{'─'*50}{RESET}")


# ── Definisi struktur folder ───────────────────────────────────────────────────

BACKEND_DIRS = [
    "stoxarea-backend/app/api",
    "stoxarea-backend/app/core",
    "stoxarea-backend/app/models",
    "stoxarea-backend/app/schemas",
    "stoxarea-backend/app/services",
    "stoxarea-backend/ml/pipeline",
    "stoxarea-backend/ml/features",
    "stoxarea-backend/ml/training",
    "stoxarea-backend/ml/inference",
    "stoxarea-backend/ml/models_saved",
    "stoxarea-backend/intelligence_store",
    "stoxarea-backend/migrations",
    "stoxarea-backend/data/raw/ohlcv",
    "stoxarea-backend/data/tickers",
    "stoxarea-backend/logs",
    "stoxarea-backend/tests",
]

FRONTEND_DIRS = [
    "stoxarea-frontend/src/app/auth",
    "stoxarea-frontend/src/app/onboarding",
    "stoxarea-frontend/src/app/dashboard",
    "stoxarea-frontend/src/app/market/[ticker]",
    "stoxarea-frontend/src/app/virtual-trading",
    "stoxarea-frontend/src/app/profile",
    "stoxarea-frontend/src/components/ui",
    "stoxarea-frontend/src/components/charts",
    "stoxarea-frontend/src/components/recommendation",
    "stoxarea-frontend/src/components/trading",
    "stoxarea-frontend/src/hooks",
    "stoxarea-frontend/src/lib",
    "stoxarea-frontend/src/store",
    "stoxarea-frontend/src/types",
    "stoxarea-frontend/public",
]


# ── Definisi file + konten placeholder ────────────────────────────────────────

BACKEND_FILES = {

    # ── app/api ──
    "stoxarea-backend/app/api/__init__.py": "",
    "stoxarea-backend/app/api/auth.py": '# Endpoint: POST /auth/register, POST /auth/login\n',
    "stoxarea-backend/app/api/user.py": '# Endpoint: GET /user/profile, POST /user/questionnaire\n',
    "stoxarea-backend/app/api/market.py": '# Endpoint: GET /market/sectors, GET /market/{sector}\n',
    "stoxarea-backend/app/api/recommendation.py": '# Endpoint: GET /recommendation/top-picks\n',
    "stoxarea-backend/app/api/portfolio.py": '# Endpoint: GET /portfolio, POST /portfolio/buy, POST /portfolio/sell\n',
    "stoxarea-backend/app/api/shap_explain.py": '# Endpoint: GET /explain/{ticker}\n',

    # ── app/core ──
    "stoxarea-backend/app/core/__init__.py": "",
    "stoxarea-backend/app/core/config.py": (
        "from pydantic_settings import BaseSettings\n\n"
        "class Settings(BaseSettings):\n"
        "    DATABASE_URL: str\n"
        "    SECRET_KEY: str\n"
        "    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60\n\n"
        "    class Config:\n"
        "        env_file = '.env'\n\n"
        "settings = Settings()\n"
    ),
    "stoxarea-backend/app/core/security.py": '# JWT encode/decode, password hashing\n',
    "stoxarea-backend/app/core/database.py": '# SQLAlchemy engine, SessionLocal, Base\n',

    # ── app/models ──
    "stoxarea-backend/app/models/__init__.py": "",
    "stoxarea-backend/app/models/user.py": '# ORM: tabel users (id, email, hashed_password, risk_profile, weights)\n',
    "stoxarea-backend/app/models/stock.py": '# ORM: tabel stocks (ticker, sector, ai_score, roe, der, per)\n',
    "stoxarea-backend/app/models/portfolio.py": '# ORM: tabel portfolios (id, user_id, ticker, qty, avg_price)\n',
    "stoxarea-backend/app/models/transaction.py": '# ORM: tabel transactions (id, user_id, ticker, type, qty, price, date)\n',

    # ── app/schemas ──
    "stoxarea-backend/app/schemas/__init__.py": "",
    "stoxarea-backend/app/schemas/user.py": '# Pydantic: UserCreate, UserLogin, UserProfile, QuestionnaireInput\n',
    "stoxarea-backend/app/schemas/stock.py": '# Pydantic: StockBase, StockDetail, MarketList\n',
    "stoxarea-backend/app/schemas/recommendation.py": '# Pydantic: TopPickItem, TopPickResponse\n',

    # ── app/services ──
    "stoxarea-backend/app/services/__init__.py": "",
    "stoxarea-backend/app/services/spk1_profiling.py": '# Logika: kuesioner → skor → profil (Konservatif/Moderat/Agresif) → bobot\n',
    "stoxarea-backend/app/services/spk2_scoring.py": '# Logika: normalisasi matriks (benefit/cost) → matriks rating\n',
    "stoxarea-backend/app/services/spk3_saw.py": '# Logika: matriks rating × vektor bobot → skor SAW → ranking\n',
    "stoxarea-backend/app/services/veto_logic.py": '# Logika: K5 override profil jika dana darurat\n',
    "stoxarea-backend/app/services/virtual_trading.py": '# Logika: simulasi beli/jual, update saldo, hitung P&L\n',

    # ── app/main ──
    "stoxarea-backend/app/main.py": (
        "from fastapi import FastAPI\n"
        "from fastapi.middleware.cors import CORSMiddleware\n"
        "from app.api import auth, user, market, recommendation, portfolio, shap_explain\n\n"
        "app = FastAPI(title='StoxArea API', version='1.0.0')\n\n"
        "app.add_middleware(\n"
        "    CORSMiddleware,\n"
        "    allow_origins=['http://localhost:3000'],\n"
        "    allow_credentials=True,\n"
        "    allow_methods=['*'],\n"
        "    allow_headers=['*'],\n"
        ")\n\n"
        "app.include_router(auth.router,           prefix='/auth')\n"
        "app.include_router(user.router,           prefix='/user')\n"
        "app.include_router(market.router,         prefix='/market')\n"
        "app.include_router(recommendation.router, prefix='/recommendation')\n"
        "app.include_router(portfolio.router,      prefix='/portfolio')\n"
        "app.include_router(shap_explain.router,   prefix='/explain')\n"
    ),

    # ── ml/pipeline ──
    "stoxarea-backend/ml/pipeline/__init__.py": "",
    "stoxarea-backend/ml/pipeline/ingestor.py": '# Tarik OHLCV + fundamental dari Yahoo Finance\n',
    "stoxarea-backend/ml/pipeline/scheduler.py": '# Jadwal bulk ingestion & dynamic update harian\n',
    "stoxarea-backend/ml/pipeline/filter_emiten.py": '# Filter: volume, hari trading, harga > Rp50\n',
    "stoxarea-backend/ml/pipeline/sector_classifier.py": '# Klasifikasi emiten ke 12 sektor BEI\n',

    # ── ml/features ──
    "stoxarea-backend/ml/features/__init__.py": "",
    "stoxarea-backend/ml/features/technical_indicators.py": '# Hitung RSI, MACD, MA, Bollinger Bands dari OHLCV\n',
    "stoxarea-backend/ml/features/fundamental_features.py": '# Proses ROE, DER, PER → siap masuk model\n',
    "stoxarea-backend/ml/features/feature_engineering.py": '# Lagging, rolling window, gabung teknikal + fundamental\n',

    # ── ml/training ──
    "stoxarea-backend/ml/training/__init__.py": "",
    "stoxarea-backend/ml/training/train_xgboost.py": '# Training XGBoost dengan CUDA, label threshold dinamis per sektor\n',
    "stoxarea-backend/ml/training/evaluate.py": '# Evaluasi akurasi, precision, recall, AUC\n',

    # ── ml/inference ──
    "stoxarea-backend/ml/inference/__init__.py": "",
    "stoxarea-backend/ml/inference/predict.py": '# Load model → generate AI Score 0.0–1.0 per emiten\n',
    "stoxarea-backend/ml/inference/shap_explainer.py": '# SHAP values → kontribusi per fitur per saham\n',

    # ── intelligence_store ──
    "stoxarea-backend/intelligence_store/__init__.py": "",
    "stoxarea-backend/intelligence_store/ai_scores.py": '# Simpan & ambil AI Score hasil inference dari DB/cache\n',
    "stoxarea-backend/intelligence_store/shap_cache.py": '# Cache SHAP values per ticker agar tidak recompute tiap request\n',

    # ── data ──
    "stoxarea-backend/data/tickers/tickers_bei.json": '[]',

    # ── config files ──
    "stoxarea-backend/.env": (
        "DATABASE_URL=postgresql://user:password@localhost:5432/stoxarea\n"
        "SECRET_KEY=ganti-dengan-secret-key-yang-kuat\n"
        "ACCESS_TOKEN_EXPIRE_MINUTES=60\n"
    ),
    "stoxarea-backend/requirements.txt": (
        "fastapi\n"
        "uvicorn[standard]\n"
        "sqlalchemy\n"
        "alembic\n"
        "pydantic-settings\n"
        "python-jose[cryptography]\n"
        "passlib[bcrypt]\n"
        "yfinance\n"
        "pandas\n"
        "numpy\n"
        "xgboost\n"
        "shap\n"
        "scikit-learn\n"
        "ta\n"
        "apscheduler\n"
        "psycopg2-binary\n"
    ),
    "stoxarea-backend/Dockerfile": (
        "FROM python:3.11-slim\n"
        "WORKDIR /app\n"
        "COPY requirements.txt .\n"
        "RUN pip install --no-cache-dir -r requirements.txt\n"
        "COPY . .\n"
        'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]\n'
    ),
    "stoxarea-backend/tests/__init__.py": "",
}


FRONTEND_FILES = {

    # ── app ──
    "stoxarea-frontend/src/app/layout.tsx": (
        "import type { Metadata } from 'next'\n"
        "export const metadata: Metadata = { title: 'StoxArea', description: 'Smart Stock Decision Support' }\n"
        "export default function RootLayout({ children }: { children: React.ReactNode }) {\n"
        "  return <html lang='id'><body>{children}</body></html>\n"
        "}\n"
    ),
    "stoxarea-frontend/src/app/page.tsx": "// Landing page\nexport default function Home() { return <main>StoxArea</main> }\n",
    "stoxarea-frontend/src/app/auth/page.tsx": "// Halaman login & register\n",
    "stoxarea-frontend/src/app/onboarding/page.tsx": "// Kuesioner SPK 1 — profil risiko pengguna\n",
    "stoxarea-frontend/src/app/dashboard/page.tsx": "// Dashboard utama — top picks SAW + % match\n",
    "stoxarea-frontend/src/app/market/page.tsx": "// Daftar semua emiten per sektor\n",
    "stoxarea-frontend/src/app/market/[ticker]/page.tsx": "// Detail saham — candlestick, SHAP, fundamental\n",
    "stoxarea-frontend/src/app/virtual-trading/page.tsx": "// Simulasi portofolio virtual\n",
    "stoxarea-frontend/src/app/profile/page.tsx": "// Profil pengguna + ubah profil risiko\n",

    # ── components/ui ──
    "stoxarea-frontend/src/components/ui/Button.tsx": "// Komponen button reusable\n",
    "stoxarea-frontend/src/components/ui/Card.tsx": "// Komponen card reusable\n",
    "stoxarea-frontend/src/components/ui/Badge.tsx": "// Badge profil: Konservatif / Moderat / Agresif\n",
    "stoxarea-frontend/src/components/ui/Modal.tsx": "// Modal konfirmasi transaksi virtual\n",

    # ── components/charts ──
    "stoxarea-frontend/src/components/charts/CandlestickChart.tsx": "// Grafik candlestick interaktif\n",
    "stoxarea-frontend/src/components/charts/RsiMacdChart.tsx": "// Grafik RSI dan MACD\n",
    "stoxarea-frontend/src/components/charts/ShapBarChart.tsx": "// Bar chart kontribusi SHAP per fitur\n",

    # ── components/recommendation ──
    "stoxarea-frontend/src/components/recommendation/TopPicksCard.tsx": "// Kartu saham rekomendasi + persentase match\n",
    "stoxarea-frontend/src/components/recommendation/SectorRankList.tsx": "// Daftar ranking saham per sektor\n",

    # ── components/trading ──
    "stoxarea-frontend/src/components/trading/VirtualPortfolio.tsx": "// Tampilan portofolio virtual + valuasi real-time\n",
    "stoxarea-frontend/src/components/trading/TradeForm.tsx": "// Form beli/jual saham virtual\n",

    # ── hooks ──
    "stoxarea-frontend/src/hooks/useRecommendation.ts": "// Fetch top picks SAW dari API\n",
    "stoxarea-frontend/src/hooks/useMarketData.ts": "// Fetch data market + detail emiten\n",
    "stoxarea-frontend/src/hooks/usePortfolio.ts": "// Fetch & mutasi portofolio virtual\n",

    # ── lib ──
    "stoxarea-frontend/src/lib/api.ts": (
        "import axios from 'axios'\n\n"
        "const api = axios.create({\n"
        "  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',\n"
        "  headers: { 'Content-Type': 'application/json' },\n"
        "})\n\n"
        "export default api\n"
    ),
    "stoxarea-frontend/src/lib/auth.ts": "// Simpan, ambil, hapus JWT token\n",

    # ── store ──
    "stoxarea-frontend/src/store/userStore.ts": "// Zustand: profil pengguna, risk profile, bobot SAW\n",
    "stoxarea-frontend/src/store/portfolioStore.ts": "// Zustand: posisi virtual, saldo, riwayat transaksi\n",

    # ── types ──
    "stoxarea-frontend/src/types/index.ts": (
        "export type RiskProfile = 'Konservatif' | 'Moderat' | 'Agresif'\n\n"
        "export interface Stock {\n"
        "  ticker:   string\n"
        "  name:     string\n"
        "  sector:   string\n"
        "  aiScore:  number\n"
        "  roe:      number\n"
        "  der:      number\n"
        "  per:      number\n"
        "  sawScore: number\n"
        "  match:    number\n"
        "}\n\n"
        "export interface User {\n"
        "  id:          string\n"
        "  email:       string\n"
        "  riskProfile: RiskProfile\n"
        "  weights:     { k1: number; k2: number; k3: number; k4: number }\n"
        "}\n"
    ),

    # ── config ──
    "stoxarea-frontend/next.config.js": (
        "/** @type {import('next').NextConfig} */\n"
        "const nextConfig = {\n"
        "  reactStrictMode: true,\n"
        "}\n"
        "module.exports = nextConfig\n"
    ),
    "stoxarea-frontend/tailwind.config.ts": (
        "import type { Config } from 'tailwindcss'\n"
        "const config: Config = {\n"
        "  content: ['./src/**/*.{ts,tsx}'],\n"
        "  theme: { extend: {} },\n"
        "  plugins: [],\n"
        "}\n"
        "export default config\n"
    ),
    "stoxarea-frontend/package.json": (
        '{\n'
        '  "name": "stoxarea-frontend",\n'
        '  "version": "0.1.0",\n'
        '  "private": true,\n'
        '  "scripts": {\n'
        '    "dev": "next dev",\n'
        '    "build": "next build",\n'
        '    "start": "next start"\n'
        '  },\n'
        '  "dependencies": {\n'
        '    "next": "14.2.0",\n'
        '    "react": "^18",\n'
        '    "react-dom": "^18",\n'
        '    "axios": "^1.6.0",\n'
        '    "zustand": "^4.5.0",\n'
        '    "recharts": "^2.12.0",\n'
        '    "lightweight-charts": "^4.1.0"\n'
        '  },\n'
        '  "devDependencies": {\n'
        '    "typescript": "^5",\n'
        '    "@types/react": "^18",\n'
        '    "tailwindcss": "^3.4.0",\n'
        '    "autoprefixer": "^10.0.0"\n'
        '  }\n'
        '}\n'
    ),
}


# ── Fungsi utama ───────────────────────────────────────────────────────────────

def create_structure():
    base = Path(".")

    # ── Backend ──
    log_head("Membuat struktur Backend (FastAPI)")
    for d in BACKEND_DIRS:
        path = base / d
        path.mkdir(parents=True, exist_ok=True)
        log_dir(d)

    for filepath, content in BACKEND_FILES.items():
        path = base / filepath
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(content, encoding="utf-8")
            log_file(filepath)
        else:
            print(f"  ⏭️  Skip (sudah ada): {filepath}")

    # ── Frontend ──
    log_head("Membuat struktur Frontend (Next.js)")
    for d in FRONTEND_DIRS:
        path = base / d
        path.mkdir(parents=True, exist_ok=True)
        log_dir(d)

    for filepath, content in FRONTEND_FILES.items():
        path = base / filepath
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(content, encoding="utf-8")
            log_file(filepath)
        else:
            print(f"  ⏭️  Skip (sudah ada): {filepath}")

    # ── Summary ──
    total_dirs  = len(BACKEND_DIRS) + len(FRONTEND_DIRS)
    total_files = len(BACKEND_FILES) + len(FRONTEND_FILES)
    print(f"\n{GREEN}✅ Selesai!{RESET}")
    print(f"   {BLUE}{total_dirs} folder{RESET} dan {GREEN}{total_files} file{RESET} berhasil dibuat.")
    print(f"\n   Langkah selanjutnya:")
    print(f"   Backend  → cd stoxarea-backend  && pip install -r requirements.txt")
    print(f"   Frontend → cd stoxarea-frontend && npm install\n")


if __name__ == "__main__":
    create_structure()
