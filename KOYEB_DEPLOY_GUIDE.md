# 🚀 Panduan Deployment Backend di Koyeb

Gunakan panduan ini jika Anda tidak ingin menggunakan kartu kredit/debit di Render. Koyeb sangat ramah untuk deployment FastAPI.

---

## 1. Persiapan di Koyeb
1. Buka [Koyeb.com](https://www.koyeb.com/) dan daftar gratis menggunakan akun GitHub Anda.
2. Klik tombol **Create App**.

## 2. Konfigurasi Deployment
1. Pilih **GitHub** sebagai sumber kode.
2. Pilih repository Anda (misal: `stoxarea`).
3. Di bagian **Branch**, pilih `main`.

### **Pengaturan Penting (Monorepo):**
Cari bagian **Build and Deployment Settings** dan isi sebagai berikut:

- **Root Directory**: `stoxarea-backend`
- **Build Command**: `pip install -r requirements.txt`
- **Run Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## 3. Menambahkan Database & Keamanan
Cari bagian **Environment Variables** dan tambahkan:

1. `DATABASE_URL`: (Isi dengan URL dari Supabase Anda)
2. `SECRET_KEY`: (Isi dengan karakter acak bebas, misal: `koyeb_stoxarea_key_2024`)

## 4. Finishing
1. Klik **Deploy**.
2. Tunggu proses build selesai (sekitar 2-3 menit).
3. Anda akan mendapatkan URL publik dari Koyeb, contoh: `https://stoxarea-backend-user.koyeb.app`.

---

## 5. Update di Vercel (Frontend)
Setelah Backend di Koyeb menyala:
1. Copy URL dari Koyeb tadi.
2. Buka dashboard **Vercel** Anda.
3. Pergi ke **Settings** > **Environment Variables**.
4. Update nilai `NEXT_PUBLIC_API_URL` dengan URL dari Koyeb tersebut.
5. Lakukan **Redeploy** di Vercel.

---
*Selesai! Sekarang aplikasi Anda sudah aktif sepenuhnya tanpa memerlukan kartu kredit.* 🚀✨
