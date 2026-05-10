# 🤖 Panduan Deploy Backend di Hugging Face Spaces

Hugging Face adalah platform terbaik untuk aplikasi AI. Mereka memberikan kapasitas besar secara GRATIS dan tanpa memerlukan kartu kredit.

---

## 1. Persiapan di Hugging Face
1. Buka [Hugging Face](https://huggingface.co/) dan daftar gratis.
2. Klik profil Anda di pojok kanan atas > **New Space**.
3. Beri nama: `stoxarea-backend`.
4. Pilih **SDK: Docker**.
5. Pilih **Blank** (atau biarkan default).
6. Pilih **Public** (agar Frontend bisa mengakses).
7. Klik **Create Space**.

---

## 2. Menghubungkan Kode
1. Di halaman Space baru Anda, klik tab **Settings**.
2. Cari bagian **Variables and secrets**.
3. Tambahkan **New Secret** untuk database:
   - Name: `DATABASE_URL`
   - Value: (Isi dengan URL Supabase Anda)
4. Pergi ke tab **Files and versions**.
5. Klik **Add file** > **Upload files**.
6. Upload **seluruh isi folder `stoxarea-backend`** (termasuk file `Dockerfile` yang baru saya buat).
7. Klik **Commit changes**.

---

## 3. Menghubungkan ke Frontend (Vercel)
1. Tunggu sampai status Space Anda menjadi **Running** (ini mungkin butuh 5-10 menit karena AI library-nya besar).
2. Setelah Running, klik tombol titik tiga di pojok kanan atas Space > **Embed this Space**.
3. Anda akan melihat **Direct URL** (misal: `https://anom16-stoxarea-backend.hf.space`).
4. Copy URL tersebut dan masukkan ke **Environment Variables** di Vercel Frontend Anda (`NEXT_PUBLIC_API_URL`).
5. **Redeploy** Frontend Anda di Vercel.

---
*Selesai! Sekarang StoxArea Anda punya "Otak AI" yang kuat di Hugging Face dan "Wajah" yang cantik di Vercel.* 🚀🤖✨
