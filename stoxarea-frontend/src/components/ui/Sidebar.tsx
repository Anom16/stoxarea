'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard Anda', icon: '⊞' },
  { href: '/market',    label: 'Jelajah Pasar',  icon: '◎' },
  { href: '/virtual-trading', label: 'Virtual Trading', icon: '◈' },
]

const bottomNav = [
  { href: '/settings', label: 'Profil & Pengaturan', icon: '⚙' },
  { href: '/auth/login', label: 'Keluar', icon: '→' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/icons/icon-192x192.png" alt="StoxArea Logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <span className="logo-text">Stox<span>Area</span></span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu Utama</div>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
          >
            <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
        <Link
          href="/settings"
          className={`nav-item mobile-only ${pathname.startsWith('/settings') ? 'active' : ''}`}
        >
          <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>⚙</span>
          <span className="nav-label">Pengaturan</span>
        </Link>
      </nav>

      {/* Footer Nav */}
      <div className="sidebar-footer">
        {bottomNav.map(item => (
          <Link key={item.href} href={item.href} className="nav-item">
            <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  )
}
