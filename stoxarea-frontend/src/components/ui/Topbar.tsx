'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TopbarProps {
  username?: string
  riskProfile?: string
}

export default function Topbar({ username = 'Pengguna', riskProfile = '—' }: TopbarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/market/detail/${query.trim().toUpperCase()}`)
  }

  return (
    <header className="topbar">
      <div className="topbar-greeting">
        <h2>Halo, {username}! 👋</h2>
        <p>Profil Risiko Anda: <strong style={{ color: 'var(--accent)' }}>{riskProfile}</strong></p>
      </div>

      <form onSubmit={handleSearch}>
        <div className="search-box">
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari Ticker Saham... (mis: BBCA)"
            id="search-ticker"
          />
        </div>
      </form>

      <div className="profile-avatar" title={username}>
        {username.charAt(0).toUpperCase()}
      </div>
    </header>
  )
}
