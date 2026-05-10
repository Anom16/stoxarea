import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'StoxArea — ashichii',
  description: 'Platform Sistem Pendukung Keputusan Investasi Saham IDX dengan AI XGBoost dan Metode SAW',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
