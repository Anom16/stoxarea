'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

interface TopbarProps {
  username?: string
  riskProfile?: string
  title?: string
}

export default function Topbar({ username: initialUsername, riskProfile: initialRiskProfile, title }: TopbarProps) {
  const [query, setQuery] = useState('')
  const [username, setUsername] = useState(initialUsername || 'Pengguna')
  const [riskProfile, setRiskProfile] = useState(initialRiskProfile || '—')
  const router = useRouter()

  useEffect(() => {
    if (initialUsername && initialRiskProfile) return
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (!initialUsername) setUsername(r.data.email?.split('@')[0] || 'Pengguna')
          if (!initialRiskProfile) setRiskProfile(r.data.risk_profile || '—')
        })
        .catch(() => {})
    }
  }, [initialUsername, initialRiskProfile])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/market/${query.trim().toUpperCase()}`)
  }

  return (
    <header className="topbar">
      <div className="topbar-greeting">
        <h2>Halo, {username}! 👋</h2>
        {title && <p style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 4 }}>{title}</p>}
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
