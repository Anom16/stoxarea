'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()

  useEffect(() => {
    // Redirect halaman 404 / typo URL ke dashboard atau login
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
      <p style={{ color: '#94a3b8' }}>Mengalihkan ke halaman yang benar...</p>
    </div>
  )
}
