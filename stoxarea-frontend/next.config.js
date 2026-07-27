/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  // Matikan PWA sepenuhnya agar cache tidak mengganggu update aplikasi
  disable: true,
})

const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)
