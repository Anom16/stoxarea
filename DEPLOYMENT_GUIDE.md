# 🚀 Panduan Deployment StoxArea

Panduan ini akan membantu Anda mempublikasikan StoxArea agar bisa diakses secara publik oleh orang lain menggunakan **Supabase** (Database) dan **Vercel** (Frontend).

---

## 1. Persiapan Database (Supabase)
1. Buka [Supabase](https://supabase.com/) dan daftar gratis menggunakan akun GitHub.
2. Buat **New Project** (beri nama: `stoxarea`).
3. Pergi ke **Project Settings** > **Database**.
4. Cari bagian **Connection String** > Pilih tab **URI**.
5. Copy alamat tersebut. Contoh: `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`
   > **Penting**: Ganti `[PASSWORD]` dengan password database yang Anda buat tadi.

---

## 2. Deploy Backend (FastAPI)
Layanan yang disarankan: **Render.com** atau **Railway.app** (Pilih Render untuk gratis yang stabil).

1. Buat akun di [Render](https://render.com/).
2. Klik **New +** > **Web Service**.
3. Hubungkan ke repository GitHub Anda.
4. **PENTING (Monorepo)**: Atur **Root Directory** ke: `stoxarea-backend`
5. Gunakan pengaturan berikut:
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
5. Pergi ke tab **Environment** dan tambahkan:
   - `DATABASE_URL`: (Tempel alamat dari Supabase tadi)
   - `SECRET_KEY`: (Buat karakter acak bebas)

---

## 3. Deploy Frontend (Vercel)
1. Buka [Vercel](https://vercel.com/) dan hubungkan akun GitHub Anda.
2. Klik **Add New** > **Project**.
3. Pilih repository `stoxarea`.
4. **PENTING (Monorepo)**: Saat muncul opsi **Root Directory**, masukkan: `stoxarea-frontend`
5. Di bagian **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_API_URL`: (Alamat URL Backend dari Render tadi, misal: `https://stoxarea-backend.onrender.com`)
5. Klik **Deploy**.

---

## 4. Selesai! 🎉
Setelah proses deploy selesai, Vercel akan memberikan link publik (misal: `https://stoxarea.vercel.app`). Bagikan link tersebut kepada teman atau rekan Anda untuk mencoba terminal analisis saham buatan Anda!

---

### Tips Keamanan:
- Jangan pernah mengupload file `.env` yang berisi password asli ke GitHub (gunakan `.gitignore`).
- Selalu gunakan `https://` untuk akses di production.
