'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useWatchlist } from '@/hooks/useWatchlist'

const mainNavItems = [
  { href: '/dashboard',       label: 'Dashboard',       icon: '⊞' },
  { href: '/market',          label: 'Jelajah Pasar',   icon: '◎' },
  { href: '/virtual-trading', label: 'Virtual Trading', icon: '◈' },
]

const preferenceNavItems = [
  { href: '/settings',        label: 'Pengaturan',      icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const { watchlist, mounted } = useWatchlist()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me')
        .then(r => {
          if (r.data?.is_admin) {
            setIsAdmin(true)
          }
        })
        .catch(() => {})
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    router.push('/auth/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img 
          src="/icons/icon-192x192.png" 
          alt="StoxArea Logo" 
          style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'contain' }} 
        />
        <span className="logo-text">STOX<span style={{ color: 'var(--accent)' }}>AREA</span></span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">MAIN MENU</div>
        {mainNavItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}>
            <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}

        <div className="nav-section-label" style={{ marginTop: 12 }}>PREFERENCES</div>
        {preferenceNavItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}>
            <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="nav-section-label" style={{ marginTop: 12 }}>ADMINISTRATION</div>
            <Link href="/admin"
              className={`nav-item ${pathname.startsWith('/admin') ? 'active' : ''}`}>
              <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>🛡️</span>
              <span className="nav-label" style={{ color: '#ef4444', fontWeight: 700 }}>Panel Admin</span>
            </Link>
          </>
        )}

        {/* Watchlist Section (Sesuai Referensi Gambar) */}
        {mounted && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px 8px' }}>
              <span className="nav-section-label" style={{ padding: 0 }}>WATCHLISTS</span>
              <Link href="/market?tab=watchlist" style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>+</Link>
            </div>
            
            {watchlist.slice(0, 4).map(t => (
              <Link key={t} href={`/market/${t}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  transition: 'background 0.15s',
                }}
                className="watchlist-hover-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
                    <span>{t}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>+0.0%</span>
                </div>
              </Link>
            ))}

            {watchlist.length === 0 && (
              <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Belum ada watchlist
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="nav-item"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>↳</span>
          Keluar dari Akun
        </button>
      </div>
    </aside>
  )
}
