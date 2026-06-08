'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import AdminSidebar from '@/components/ui/AdminSidebar'
import Topbar from '@/components/ui/Topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api.get('/auth/me')
      .then(r => {
        if (!r.data.is_admin) {
          router.replace('/dashboard') // redirect non-admin ke user dashboard
        } else {
          setChecking(false)
        }
      })
      .catch(() => router.replace('/auth/login'))
  }, [router])

  if (checking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d1117' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
        <p>Memverifikasi akses admin...</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg, #0d1117)' }}>
      <AdminSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main style={{ flex: 1, padding: '24px 32px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
