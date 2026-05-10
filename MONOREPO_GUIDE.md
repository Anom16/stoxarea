# 📁 Panduan Satu Repository (Monorepo)

Gunakan panduan ini jika Anda ingin menyimpan **Frontend** dan **Backend** dalam satu tempat yang sama di GitHub.

## 1. Persiapan di GitHub
1. Buka [GitHub](https://github.com/) dan buat satu repository baru bernama `stoxarea`.
2. Jangan centang "Add a README" atau "Add a .gitignore" (biarkan kosong).

## 2. Perintah Upload (Push)
Buka PowerShell/Terminal di folder utama `STOXAREA`, lalu jalankan perintah ini:

```powershell
# Inisialisasi Git
git init

# Tambahkan semua file (Backend & Frontend)
git add .

# Simpan perubahan
git commit -m "Initial commit: Monorepo StoxArea"

# Atur branch utama
git branch -M main

# Hubungkan ke GitHub (GANTI USERNAME-ANDA)
git remote add origin https://github.com/USERNAME-ANDA/stoxarea.git

# Upload ke Cloud
git push -u origin main
```

---

## 3. Catatan Penting Saat Deploy
Karena kita menggunakan satu repository, Anda **WAJIB** mengatur folder tujuan di layanan Cloud:

### **Di Render (Backend)**
Saat membuat Web Service, cari bagian **Root Directory** dan isi:
`stoxarea-backend`

### **Di Vercel (Frontend)**
Saat mengimpor proyek, cari bagian **Root Directory** dan isi:
`stoxarea-frontend`

---
*Selamat! Sekarang seluruh kode Anda terjaga dalam satu rumah yang rapi di GitHub.* 🚀
