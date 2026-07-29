'use client'

import React, { useState, useEffect } from 'react'

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    // Cek apakah user pernah menutup banner ini
    const isDismissed = localStorage.getItem('stoxarea_disclaimer_dismissed')
    if (!isDismissed) {
      setDismissed(false)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('stoxarea_disclaimer_dismissed', 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-200/90 flex items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-2 max-w-5xl mx-auto">
        <span className="text-amber-400 text-sm flex-shrink-0">⚠️</span>
        <p>
          <strong className="font-semibold text-amber-300">Penting (Educational Purpose):</strong> Platform ini merupakan alat bantu analitik kuantitatif &amp; edukasi SPK. Hasil kalkulasi AI <strong>bukan saran/ajakan investasi OJK</strong>. Keputusan transaksi ada di tangan Anda (DYOR).
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs transition flex-shrink-0 font-medium"
      >
        Saya Mengerti
      </button>
    </div>
  )
}
