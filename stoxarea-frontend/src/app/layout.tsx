import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NextTopLoader from 'nextjs-toploader'
import ErrorBoundary from '@/components/ErrorBoundary'
import ClientTutorialProvider from '@/components/ui/ClientTutorialProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'STOXAREA — ashichii',
  description: 'Platform Sistem Pendukung Keputusan Investasi Saham IDX dengan AI XGBoost dan Metode SAW',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('app_theme') || 'dark';
            if (theme === 'light') {
              document.body.classList.add('light-mode');
            }
            // Bersihkan Service Worker lama di Vercel/Local agar PWA selalu pakai versi terbaru
            if ('serviceWorker' in navigator) {
              var lastClean = localStorage.getItem('sw_clean_timestamp');
              var now = Date.now();
              if (!lastClean || (now - parseInt(lastClean)) > 3600000) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var i = 0; i < registrations.length; i++) {
                    registrations[i].unregister();
                  }
                  localStorage.setItem('sw_clean_timestamp', now.toString());
                });
              }
            }
          })()
        ` }} />
        <NextTopLoader color="#10b981" showSpinner={false} height={3} />
        <ErrorBoundary>
          <ClientTutorialProvider>
            {children}
          </ClientTutorialProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
