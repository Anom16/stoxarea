'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface BottomNavProps {
  isAdmin?: boolean
}

export default function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
    { href: '/market', label: 'Pasar', icon: '◎' },
    { href: '/virtual-trading', label: 'Trading', icon: '◈' },
    { href: '/settings', label: 'Pengaturan', icon: '⚙' },
  ]

  if (isAdmin) {
    navItems.push({ href: '/admin', label: 'Admin', icon: '🛡️' })
  }

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            style={item.href === '/admin' ? { color: '#ef4444', fontWeight: 800 } : {}}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
