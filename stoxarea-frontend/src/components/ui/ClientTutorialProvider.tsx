'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import TutorialModal from '@/components/ui/TutorialModal'

/**
 * ClientTutorialProvider — wrapper global untuk tutorial.
 * Dipasang di root layout agar tutorial tetap muncul lintas halaman.
 * Membaca/menulis state ke localStorage agar persist.
 */
export default function ClientTutorialProvider({ children }: { children: React.ReactNode }) {
  const [showTutorial, setShowTutorial] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    // Auto-trigger untuk user baru (belum pernah lihat tutorial)
    // Hanya muncul jika user sudah login (memiliki access_token) dan tidak berada di halaman login/register/landing
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      const done = localStorage.getItem('stoxarea_tour_done')
      const isAuthPage = pathname?.startsWith('/auth') || pathname === '/'

      if (token && !done && !isAuthPage) {
        const t = setTimeout(() => setShowTutorial(true), 1200)
        return () => clearTimeout(t)
      }
    }
  }, [pathname])

  // Expose fungsi buka tutorial ke seluruh app via custom event
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem('stoxarea_tour_done')
      setShowTutorial(true)
    }
    window.addEventListener('stoxarea:open-tutorial', handler)
    return () => window.removeEventListener('stoxarea:open-tutorial', handler)
  }, [])

  return (
    <>
      {children}
      {showTutorial && (
        <TutorialModal onClose={() => setShowTutorial(false)} />
      )}
    </>
  )
}
