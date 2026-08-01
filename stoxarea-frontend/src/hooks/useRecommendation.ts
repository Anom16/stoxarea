'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export interface Recommendation {
  ticker: string
  sector: string
  match_score: number
  match_score_percent: string
  ai_score_percent: string
  roe: number
  der: number
  pbv: number
  insights: { feature: string; description: string; contribution: number }[]
  transparency?: any
}

export interface SectorRow {
  sector: string
  total_stocks: number
  avg_ai_score: number
  avg_ai_score_percent: string
  sentiment: string
  top_movers: { ticker: string; ai_score_percent: string }[]
}

export function useDashboardData() {
  const router = useRouter()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [sectors, setSectors] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState('—')
  const [username, setUsername] = useState('Pengguna')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/auth/login')
      return
    }

    const headers = { Authorization: `Bearer ${token}` }

    api.get('/auth/me', { headers })
      .then(r => {
        if (r.data.is_admin) {
          router.push('/admin')
          return
        }
        const name = r.data.full_name?.trim() || r.data.email?.split('@')[0] || 'Pengguna'
        setUsername(name)
        setProfile(r.data.risk_profile || '—')
      })
      .catch(() => {
        localStorage.removeItem('access_token')
        router.push('/auth/login')
      })

    api.get('/recommendation/top-picks', { headers })
      .then(r => setRecs(r.data))
      .catch((err) => {
        if (err?.response?.status === 400) {
          // User belum mengisi kuesioner — ini kondisi normal, bukan error server
          setRecs([])
        } else {
          setError('Gagal memuat data analisis. Pastikan server backend berjalan.')
        }
      })

    api.get('/market/sectors')
      .then(r => setSectors(r.data))
      .finally(() => setLoading(false))
  }, [router])

  return { recs, sectors, loading, profile, username, error }
}
