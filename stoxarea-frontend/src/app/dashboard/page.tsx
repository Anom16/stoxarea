'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'

interface Recommendation {
  ticker: string
  sector: string
  match_score: number
  match_score_percent: string
  ai_score_percent: string
  roe: number
  der: number
  per: number
  insights: { feature: string; description: string; contribution: number }[]
}

interface SectorRow {
  sector: string
  total_stocks: number
  avg_ai_score: number
  avg_ai_score_percent: string
  sentiment: string
  top_movers: { ticker: string; ai_score_percent: string }[]
}

const PROFILE_COLORS: Record<string, string> = {
  Konservatif: '#10b981',
  Moderat: '#3b82f6',
  Agresif: '#f59e0b',
}

export default function DashboardPage() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [sectors, setSectors] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState('—')
  const [username, setUsername] = useState('Pengguna')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { window.location.href = '/auth/login'; return }

    const headers = { Authorization: `Bearer ${token}` }

    // Fetch user profile
    api.get('/auth/me', { headers })
      .then(r => {
        // Prioritas: full_name → bagian depan email → fallback 'Pengguna'
        const name = r.data.full_name?.trim() || r.data.email?.split('@')[0] || 'Pengguna'
        setUsername(name)
        setProfile(r.data.risk_profile || '—')
      })
      .catch(() => { localStorage.removeItem('access_token'); window.location.href = '/auth/login' })

    // Fetch top picks SPK Lapis 3
    api.get('/recommendation/top-picks', { headers })
      .then(r => setRecs(r.data))
      .catch(() => setError('Gagal memuat data analisis. Pastikan server backend berjalan.'))

    // Fetch sector overview
    api.get('/market/sectors')
      .then(r => setSectors(r.data))
      .finally(() => setLoading(false))
  }, [])

  const rankColor = (i: number) => {
    if (i === 0) return 'gold'
    if (i === 1) return 'silver'
    if (i === 2) return 'bronze'
    return ''
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="logo-mark" style={{ width: 48, height: 48, fontSize: 20 }}>S</div>
        <p style={{ color: 'var(--text-secondary)' }}>Memuat data pasar...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Greeting */}
      <div className="mb-24">
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Halo, {username}! 👋</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Profil Risiko Anda:{' '}
          <strong style={{ color: PROFILE_COLORS[profile] || 'var(--accent)' }}>{profile}</strong>
          {' '}— AI StoxArea menganalisis emiten yang paling sesuai dengan profil Anda secara matematis.
        </p>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 24 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ─── STATS ROW ─── */}
      <section className="dashboard-section mb-24" role="region" aria-label="Statistik Ringkasan Pasar">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Saham Dipantau</div>
            <div className="stat-value text-accent">{sectors.length > 0 ? sectors.reduce((acc, s) => acc + s.total_stocks, 0).toString() : '—'}</div>
            <div className="stat-sub">Emiten IDX aktif dianalisis</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Match Score Tertinggi</div>
            <div className="stat-value text-accent">{recs[0]?.match_score_percent || '—'}</div>
            <div className="stat-sub">
              {recs[0]?.ticker ? (
                <Link href={`/market/${recs[0].ticker}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                  {recs[0].ticker.replace('.JK', '')}
                </Link>
              ) : '—'} untuk profil {profile}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sektor Paling Bullish</div>
            <div className="stat-value" style={{ fontSize: 16, fontWeight: 700 }}>
              {sectors[0]?.sector ? (
                <Link href={`/market?sector=${encodeURIComponent(sectors[0].sector)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="hover-opacity">{sectors[0].sector}</span>
                </Link>
              ) : '—'}
            </div>
            <div className="stat-sub stat-up">{sectors[0]?.avg_ai_score_percent || '—'} AI Score rata-rata</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sektor Aktif Terpantau</div>
            <div className="stat-value text-blue">{sectors.filter(s => s.total_stocks > 0).length}</div>
            <div className="stat-sub">dari 12 Sektor Resmi BEI</div>
          </div>
        </div>
      </section>

      {/* ─── TOP PICKS ─── */}
      <section className="dashboard-section mb-24" role="region" aria-label="AI Watchlist Emiten Pilihan">
        <div className="section-title">🏆 AI Watchlist — Top Matches</div>
        <div className="section-sub">Emiten Paling Sesuai Profil {profile} Anda berdasarkan Kalkulasi SAW · Bukan Saran Investasi</div>

        {recs.length === 0 ? (
          <div className="card empty-state mb-24">
            <div className="empty-icon">📋</div>
            <div className="empty-text">
              Belum ada data analisis. Silakan selesaikan kuesioner profil risiko terlebih dahulu.
            </div>
            <Link href="/profile" className="btn-primary" style={{ padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
              Isi Kuesioner Sekarang
            </Link>
          </div>
        ) : (
          <div className="top-picks-grid">
            {recs.slice(0, 5).map((r) => (
              <div key={r.ticker} className="pick-card">
                <Link href={`/market/${r.ticker}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="pick-ticker hover-opacity">{r.ticker.replace('.JK', '')}</div>
                </Link>
                <div className="pick-name">Sektor: <span className="pick-sector">{r.sector}</span></div>

                <div className="match-badge">
                  <span className="match-pct">{r.match_score_percent}</span>
                  <span className="match-label">Match dengan Profil Anda</span>
                </div>

                <div className="pick-metrics">
                  <div className="metric">
                    <div className="metric-label">AI Score</div>
                    <div className="metric-value text-accent">{r.ai_score_percent}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">ROE</div>
                    <div className="metric-value">{r.roe}%</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">PER</div>
                    <div className="metric-value">{r.per}x</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">DER</div>
                    <div className="metric-value">{r.der}</div>
                  </div>
                </div>

                {/* SHAP Insight Pills */}
                {r.insights.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {r.insights.slice(0, 2).map((ins, i) => (
                      <span key={i} className="insight-pill">💡 {ins.description.split(' ').slice(0, 5).join(' ')}</span>
                    ))}
                  </div>
                )}

                {/* 🎯 Why Top Pick Logic */}
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `3px solid ${PROFILE_COLORS[profile]}`, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: PROFILE_COLORS[profile], textTransform: 'uppercase', marginBottom: 4 }}>
                    Kenapa Jadi Top Pick?
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                    {profile === 'Agresif' && `Sangat disarankan karena skor Momentum AI (${r.ai_score_percent}) yang sangat dominan, cocok untuk mengejar kenaikan cepat.`}
                    {profile === 'Moderat' && `Menawarkan keseimbangan yang baik antara tren kenaikan harga dan stabilitas laba (ROE ${r.roe}%).`}
                    {profile === 'Konservatif' && `Prioritas pada keamanan finansial dengan tingkat hutang yang rendah (DER ${r.der}) dan profitabilitas yang sehat.`}
                  </div>
                </div>

                <div className="pick-actions">
                  <Link href={`/market/${r.ticker}`} className="btn-outline" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
                    Detail Analisis
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Disclaimer OJK ── */}
      <div style={{
        margin: '0 0 24px',
        padding: '12px 16px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 10,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <p style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.7, margin: 0 }}>
          <strong>Pernyataan Penting:</strong> Seluruh hasil analisis di halaman ini — termasuk AI Watchlist, Match Score, dan AI Score — merupakan <strong>output kalkulasi matematis algoritmik</strong> (metode SAW + XGBoost) berdasarkan data historis dan teknikal. Hasil ini <strong>bukan merupakan saran, ajakan, atau rekomendasi investasi</strong> dalam bentuk apapun. Keputusan investasi sepenuhnya merupakan tanggung jawab pengguna. StoxArea tidak memiliki lisensi Penasihat Investasi dari OJK. Investasi di pasar modal mengandung risiko, termasuk risiko kehilangan seluruh modal.
        </p>
      </div>

      {/* ─── RANKING TABLE ─── */}
      <section className="dashboard-section mb-24" role="region" aria-label="Ranking dan Radar Sektor Pasar">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          {/* Ranking all */}
          <div className="card">
            <div className="section-title" style={{ fontSize: 16, marginBottom: 4 }}>📊 Ranking SPK Keseluruhan</div>
            <div className="section-sub" style={{ marginBottom: 16 }}>15 Emiten Paling Sesuai berdasarkan Skor SAW</div>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ticker</th>
                  <th>Sektor</th>
                  <th>Match %</th>
                  <th>AI Score</th>
                </tr>
              </thead>
              <tbody>
                {recs.slice(0, 15).map((r, i) => (
                  <tr key={r.ticker}>
                    <td>
                      <div className={`rank-num ${rankColor(i)}`}>{i + 1}</div>
                    </td>
                    <td>
                      <Link href={`/market/${r.ticker}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>
                        {r.ticker.replace('.JK', '')}
                      </Link>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.sector}</td>
                    <td><span className="text-accent fw-700">{r.match_score_percent}</span></td>
                    <td>
                      <div className="ai-bar-wrap">
                        <div className="ai-bar-track">
                          <div className="ai-bar-fill" style={{ width: r.ai_score_percent }} />
                        </div>
                        <span className="fs-12 text-muted">{r.ai_score_percent}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sector Overview */}
          <div className="card">
            <div className="section-title" style={{ fontSize: 16, marginBottom: 4 }}>🌐 Radar Sektor BEI</div>
            <div className="section-sub" style={{ marginBottom: 16 }}>Sentimen AI per Sektor (Bullish/Netral/Bearish)</div>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Sektor</th>
                  <th>Saham</th>
                  <th>AI Avg</th>
                  <th>Sentimen</th>
                </tr>
              </thead>
              <tbody>
                {sectors.filter(s => s.total_stocks > 0).map((s) => (
                  <tr key={s.sector}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>
                      <Link href={`/market?sector=${encodeURIComponent(s.sector)}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover-opacity">
                        {s.sector}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.total_stocks}</td>
                    <td>
                      <div className="ai-bar-wrap">
                        <div className="ai-bar-track">
                          <div className="ai-bar-fill" style={{ width: s.avg_ai_score_percent }} />
                        </div>
                        <span className="fs-12 text-muted">{s.avg_ai_score_percent}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`sentiment-badge ${(s.sentiment || '').toLowerCase()}`}>
                        {s.sentiment === 'Bullish' ? '▲' : s.sentiment === 'Bearish' ? '▼' : '●'} {s.sentiment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── TOP MOVERS PER SECTOR ─── */}
      <section className="dashboard-section mb-24" role="region" aria-label="Top Movers Per Sektor Saham">
        <div className="section-title">🚀 Top Mover Per Sektor</div>
        <div className="section-sub" style={{ marginBottom: 16 }}>Saham dengan Momentum AI Tertinggi di Masing-masing Sektor</div>
        <div className="sector-grid" style={{ marginBottom: 24 }}>
          {sectors.filter(s => s.total_stocks > 0).map(s => (
            <div key={s.sector} className="sector-card">
              <div className="sector-card-top">
                <div>
                  <Link href={`/market?sector=${encodeURIComponent(s.sector)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className="sector-name hover-opacity">{s.sector}</div>
                  </Link>
                  <div className="sector-count">{s.total_stocks} saham dipantau</div>
                </div>
                <span className={`sentiment-badge ${(s.sentiment || '').toLowerCase()}`} style={{ fontSize: 11 }}>
                  {s.sentiment}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Top Movers:</div>
              {s.top_movers.map((m, i) => (
                <div key={m.ticker} className="flex-between" style={{ marginBottom: 4 }}>
                  <Link href={`/market/${m.ticker}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {i + 1}. {m.ticker.replace('.JK', '')}
                  </Link>
                  <span className="text-accent fs-12">{m.ai_score_percent}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
      <DisclaimerFooter />
    </div>
  )
}
