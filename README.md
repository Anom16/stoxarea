# STOXAREA — Sistem Rekomendasi Saham Berbasis AI

Sistem Pendukung Keputusan (SPK) Hybrid untuk rekomendasi saham Indonesia (IDX) menggunakan XGBoost + SAW.

## Cara Menjalankan (Pertama Kali)

### 1. Clone Repository
```bash
git clone https://github.com/username/stoxarea.git
cd stoxarea
```

### 2. Setup Backend
```bash
cd stoxarea-backend

# Install dependencies
pip install -r requirements.txt

# Salin dan edit file .env
cp .env.example .env
# Edit .env: isi DATABASE_URL dan SECRET_KEY

# Jalankan setup otomatis (download data, train model, dll)
python setup_first_run.py
```

> ⚠️ Setup pertama memakan waktu **15-30 menit** karena perlu download data saham dari Yahoo Finance dan train model XGBoost.

### 3. Jalankan Backend
```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Setup & Jalankan Frontend
```bash
cd ../stoxarea-frontend
npm install
npm run dev
```

### 5. Akses Aplikasi
| URL | Keterangan |
|-----|-----------|
| http://localhost:3000 | Frontend (Aplikasi) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Dokumentasi API (Swagger) |

---

## Environment Variables (`.env`)

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=your-super-secret-key-minimum-32-chars
ALLOWED_ORIGINS=http://localhost:3000
```

---

## Struktur Project

```
STOXAREA/
├── stoxarea-backend/     # FastAPI + XGBoost + SPK
│   ├── app/              # API endpoints, models, services
│   ├── ml/               # Machine learning pipeline
│   ├── data/             # Data OHLCV dan processed
│   ├── models/           # Model XGBoost tersimpan
│   └── setup_first_run.py
│
├── stoxarea-frontend/    # Next.js + TypeScript
│   └── src/app/          # Halaman aplikasi
│
└── run_stoxarea.ps1      # Script untuk jalankan keduanya sekaligus
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL |
| ML | XGBoost, SHAP, scikit-learn |
| Data | Yahoo Finance API (yfinance) |
| SPK | SAW (Simple Additive Weighting) |

---

## Akun Default

Setelah setup selesai, daftar akun baru di http://localhost:3000/auth/register

Untuk akun admin, jalankan:
```python
python -c "
import sys; sys.path.insert(0,'.')
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
db = SessionLocal()
u = User(email='admin@example.com', password_hash=get_password_hash('password'), full_name='Admin', is_admin=True)
db.add(u); db.commit(); db.close()
print('Admin created')
"
```
