'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/auth/login')
  }, [router])

  return (
    <div className="flex-center h-screen bg-primary">
      <div className="text-secondary">Mengalihkan ke halaman login...</div>
    </div>
  )
}
