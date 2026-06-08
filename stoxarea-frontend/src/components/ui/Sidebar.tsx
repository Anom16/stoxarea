'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard',       label: 'Dashboard Anda',  icon: '⊞' },
  { href: '/market',          label: 'Jelajah Pasar',   icon: '◎' },
  { href: '/virtual-trading', label: 'Virtual Trading', icon: '◈' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    router.push('/auth/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/icons/icon-192x192.png" alt="StoxArea Logo"
          style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <span className="logo-text">Stox<span>Area</span></span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu Utama</div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}>
            <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
        <Link href="/settings"
          className={`nav-item mobile-only ${pathname.startsWith('/settings') ? 'active' : ''}`}>
          <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>⚙</span>
          <span className="nav-label">Pengaturan</span>
        </Link>
      </nav>

      <div className="sidebar-footer">
        <Link href="/settings" className="nav-item">
          <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>⚙</span>
          Profil & Pengaturan
        </Link>
        <button onClick={handleLogout} className="nav-item"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', color: 'inherit', padding: 0 }}>
          <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>→</span>
          Keluar
        </button>
      </div>
    </aside>
  )
}
