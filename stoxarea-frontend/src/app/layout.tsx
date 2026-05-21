import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'STOXAREA — ashichii',
  description: 'Platform Sistem Pendukung Keputusan Investasi Saham IDX dengan AI XGBoost dan Metode SAW',
  manifest: '/manifest.json',
}

import NextTopLoader from 'nextjs-toploader'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className={inter.className}>
        <NextTopLoader color="#10b981" showSpinner={false} height={3} />
        {children}
      </body>
    </html>
  )
}
