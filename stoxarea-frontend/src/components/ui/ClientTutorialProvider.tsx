'use client'
import { useEffect, useState } from 'react'
import TutorialModal from '@/components/ui/TutorialModal'

/**
 * ClientTutorialProvider — wrapper global untuk tutorial.
 * Dipasang di root layout agar tutorial tetap muncul lintas halaman.
 * Membaca/menulis state ke localStorage agar persist.
 */
export default function ClientTutorialProvider({ children }: { children: React.ReactNode }) {
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    // Auto-trigger untuk user baru (belum pernah lihat tutorial)
    const done = localStorage.getItem('stoxarea_tour_done')
    if (!done) {
      const t = setTimeout(() => setShowTutorial(true), 1000)
      return () => clearTimeout(t)
    }
  }, [])

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
