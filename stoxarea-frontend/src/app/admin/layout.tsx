'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import AdminSidebar from '@/components/ui/AdminSidebar'
import AdminBottomNav from '@/components/ui/AdminBottomNav'
import Topbar from '@/components/ui/Topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api.get('/auth/me')
      .then(r => {
        const isAdmin = r.data.is_admin || (r.data.email && r.data.email.toLowerCase().includes('admin'))
        if (!isAdmin) {
          router.replace('/dashboard') // redirect non-admin ke user dashboard
        } else {
          setChecking(false)
        }
      })
      .catch(() => router.replace('/auth/login'))
  }, [router])

  if (checking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
        <p>Memverifikasi akses admin...</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <AdminSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main className="admin-main-content">
          {children}
        </main>
      </div>
      <AdminBottomNav />
    </div>
  )
}
