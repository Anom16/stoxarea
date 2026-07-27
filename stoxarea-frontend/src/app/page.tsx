'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Unregister any old service worker lingering in browser
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
        }
      }).catch(() => {})
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (token) {
      router.replace('/dashboard')
    } else {
      router.replace('/auth/login')
    }
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#090d16',
      color: '#ffffff',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>StoxArea</h1>
        <p style={{ color: '#94a3b8' }}>Mengalihkan ke terminal...</p>
      </div>
    </div>
  )
}
