'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminBottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/admin', label: 'Overview', icon: '⊞' },
    { href: '/admin/users', label: 'User', icon: '⍟' },
    { href: '/admin/spk', label: 'SPK', icon: '⬡' },
    { href: '/admin/stocks', label: 'Saham', icon: '◎' },
    { href: '/admin/ml-pipeline', label: 'ML', icon: '⬢' },
    { href: '/dashboard', label: 'User View', icon: '👤' },
  ]

  return (
    <nav className="admin-bottom-nav">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/admin' && item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              color: isActive ? '#ef4444' : 'var(--text-muted)',
              padding: '6px 0',
              fontSize: 10,
              fontWeight: 700,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 16, marginBottom: 2, fontWeight: 800 }}>{item.icon}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
