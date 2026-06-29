/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  // Matikan PWA sepenuhnya saat development agar cache tidak ganggu
  disable: process.env.NODE_ENV === 'development',
  register: true,
  // Aktifkan SW baru langsung tanpa tunggu tab browser ditutup
  skipWaiting: true,
  // Bersihkan cache SW lama otomatis saat versi baru diinstall
  cleanupOutdatedCaches: true,
  // Jangan cache halaman navigasi — selalu ambil dari network
  reloadOnOnline: true,
})

const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)
