'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import api from '@/lib/api'
import BottomNav from './BottomNav'

interface TopbarProps {
  username?: string
  riskProfile?: string
  title?: string
}

export default function Topbar({ username: initialUsername, riskProfile: initialRiskProfile, title }: TopbarProps) {
  const pathname = usePathname()
  const [username, setUsername] = useState(initialUsername || 'Pengguna')
  const [riskProfile, setRiskProfile] = useState(initialRiskProfile || '—')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (!initialUsername) {
            const name = r.data.full_name?.trim() || r.data.email?.split('@')[0] || 'Pengguna'
            setUsername(name)
          }
          if (!initialRiskProfile) setRiskProfile(r.data.risk_profile || '—')
          if (r.data.is_admin || (r.data.email && r.data.email.toLowerCase().includes('admin'))) {
            setIsAdmin(true)
          }
        })
        .catch(() => {})
    }
  }, [initialUsername, initialRiskProfile])

  const isInAdminPage = pathname.startsWith('/admin')

  return (
    <>
      <header className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div className="mobile-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img 
            src="/icons/icon-192x192.png" 
            alt="StoxArea Logo" 
            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} 
          />
          <span className="logo-text" style={{ fontSize: 18, fontWeight: 900 }}>
            STOX<span style={{ color: 'var(--accent)' }}>AREA</span>
          </span>
        </div>

        {/* Admin Mode Switcher Button (Tampil di Mobile & Desktop untuk Akun Admin) */}
        {isAdmin && (
          <Link
            href={isInAdminPage ? '/dashboard' : '/admin'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
              background: isInAdminPage ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: isInAdminPage ? '#3b82f6' : '#ef4444',
              border: `1px solid ${isInAdminPage ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              transition: 'all 0.15s',
            }}
          >
            <span>{isInAdminPage ? '👤 Tampilan User' : '🛡️ Panel Admin'}</span>
          </Link>
        )}
      </header>

      {/* Render Bottom Navigation Bar on Mobile Screens (Hanya jika di area user) */}
      {!isInAdminPage && <BottomNav isAdmin={isAdmin} />}
    </>
  )
}
