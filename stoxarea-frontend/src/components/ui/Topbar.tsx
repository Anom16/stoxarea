'use client'
import { useState, useEffect } from 'react'
import api from '@/lib/api'

interface TopbarProps {
  username?: string
  riskProfile?: string
  title?: string
}

export default function Topbar({ username: initialUsername, riskProfile: initialRiskProfile, title }: TopbarProps) {
  const [username, setUsername] = useState(initialUsername || 'Pengguna')
  const [riskProfile, setRiskProfile] = useState(initialRiskProfile || '—')

  useEffect(() => {
    if (initialUsername && initialRiskProfile) return
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (!initialUsername) {
            const name = r.data.full_name?.trim() || r.data.email?.split('@')[0] || 'Pengguna'
            setUsername(name)
          }
          if (!initialRiskProfile) setRiskProfile(r.data.risk_profile || '—')
        })
        .catch(() => {})
    }
  }, [initialUsername, initialRiskProfile])

  return (
    <header className="topbar">
      <div className="topbar-greeting">
        <h2>Halo, {username}! 👋</h2>
        {title && <p style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 4 }}>{title}</p>}
        <p>Profil Risiko Anda: <strong style={{ color: 'var(--accent)' }}>{riskProfile}</strong></p>
      </div>
    </header>
  )
}
