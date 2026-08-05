'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import StoxCatLoader from '@/components/ui/StoxCatLoader'

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
    <StoxCatLoader message="Loading..." />
  )
}
