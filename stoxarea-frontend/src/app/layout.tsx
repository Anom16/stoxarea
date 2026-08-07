import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NextTopLoader from 'nextjs-toploader'
import ErrorBoundary from '@/components/ErrorBoundary'
import ClientTutorialProvider from '@/components/ui/ClientTutorialProvider'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'STOXAREA — Platform Analitik & Edukasi Saham IDX',
  description: 'Platform Sistem Pendukung Keputusan Kuantitatif Saham IDX berbasis XGBoost dan SAW untuk Edukasi Investasi',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {/* Cloudflare Web Analytics */}
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "7b9e49aa362c461dae9a0b279e7649b4"}'
          strategy="afterInteractive"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('app_theme') || 'light';
            if (theme === 'dark') {
              document.body.classList.add('dark-mode');
            }
            // Hapus dan matikan seluruh PWA Service Worker secara permanen di browser user
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for (var i = 0; i < registrations.length; i++) {
                  registrations[i].unregister();
                }
              });
            }
          })()
        ` }} />
        <NextTopLoader color="#10b981" showSpinner={false} height={3} />
        <DisclaimerBanner />
        <ErrorBoundary>
          <ClientTutorialProvider>
            {children}
          </ClientTutorialProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
