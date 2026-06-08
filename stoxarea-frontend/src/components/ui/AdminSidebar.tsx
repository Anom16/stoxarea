'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const adminNav = [
  { href: '/admin',                  label: 'Dashboard Admin',    icon: '⊞' },
  { href: '/admin/users',            label: 'Kelola User',        icon: '👥' },
  { href: '/admin/stocks',           label: 'Daftar Saham',       icon: '📈' },
  { href: '/admin/ml-pipeline',      label: 'Pipeline ML',        icon: '⚙️' },
  { href: '/admin/model-performance',label: 'Performa Model AI',  icon: '🧠' },
  { href: '/admin/corporate-actions',label: 'Corporate Action',   icon: '🚨' },
  { href: '/admin/cache',            label: 'Cache Monitor',      icon: '🗄️' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    router.push('/auth/login')
  }

  return (
    <aside className="sidebar" style={{ borderRight: '1px solid #ff444422' }}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/icons/icon-192x192.png" alt="StoxArea Logo"
          style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <span className="logo-text">Stox<span>Area</span></span>
      </div>

      {/* Admin Badge */}
      <div style={{
        margin: '0 12px 12px',
        background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)',
        borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#ff6666',
        fontWeight: 700, textAlign: 'center', letterSpacing: 1,
      }}>
        🛡️ ADMIN PANEL
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Admin Menu</div>
        {adminNav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <Link href="/dashboard" className="nav-item">
          <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>👤</span>
          Tampilan User
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
