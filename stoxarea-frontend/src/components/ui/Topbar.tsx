'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import BottomNav from './BottomNav'

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
    <>
      <header className="topbar">
        <div className="mobile-brand">
          <img 
            src="/icons/icon-192x192.png" 
            alt="StoxArea Logo" 
            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} 
          />
          <span className="logo-text" style={{ fontSize: 18 }}>Stox<span>Area</span></span>
        </div>

        <div className="topbar-greeting">
          <h2>Selamat datang kembali, {username}! 👋</h2>
          <p style={{ marginTop: 2 }}>
            {title ? title : 'Jangan lupa pantau rekomendasi AI dan portofolio Anda hari ini 😎'}
            {riskProfile && riskProfile !== '—' && (
              <span style={{ marginLeft: 8, background: '#f1f5f9', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontWeight: 700, fontSize: 11 }}>
                Profil: {riskProfile}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="profile-avatar">
            {username.substring(0, 1).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Render Bottom Navigation Bar on Mobile Screens */}
      <BottomNav />
    </>
  )
}
