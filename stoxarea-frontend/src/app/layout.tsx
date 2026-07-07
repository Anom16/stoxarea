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
            // Hapus Service Worker secara otomatis jika dijalankan di local network/localhost
            if ('serviceWorker' in navigator && (
              window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1' || 
              window.location.hostname.startsWith('192.168.') ||
              window.location.hostname.startsWith('10.')
            )) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for (var i = 0; i < registrations.length; i++) {
                  registrations[i].unregister().then(function() {
                    console.log('Local Service Worker unregistered to prevent stale cache.');
                  });
                }
              });
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
