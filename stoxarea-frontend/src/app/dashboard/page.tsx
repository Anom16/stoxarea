'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import api from '@/lib/api'

interface Recommendation {
  ticker: string
  sector: string
  match_score: number
  match_score_percent: string
  ai_score_percent: string
  ai_score: number
  roe: number
  der: number
  pbv: number
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
  Moderat:     '#3b82f6',
  Agresif:     '#f59e0b',
}

export default function DashboardPage() {
  const [recs, setRecs]       = useState<Recommendation[]>([])
  const [sectors, setSectors] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState('—')
  const [username, setUsername] = useState('Pengguna')
  const [error, setError]     = useState('')

  // Layout switch
  const [dashLayout, setDashLayout] = useState<'classic' | 'modern'>('classic')

  // Modern layout state
  const [activeMoverTab, setActiveMoverTab]         = useState<'gainers' | 'losers' | 'active'>('gainers')
  const [momentumStocks, setMomentumStocks]         = useState<any[]>([])
  const [activeSector, setActiveSector]             = useState<string>('')
  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'sectors'>('overview')

  // ── Fetch user + data ────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { window.location.href = '/auth/login'; return }

    // Read saved layout preference
    const savedLayout = localStorage.getItem('dashboard_layout') as 'classic' | 'modern'
    if (savedLayout) setDashLayout(savedLayout)

    const headers = { Authorization: `Bearer ${token}` }

    api.get('/auth/me', { headers })
      .then(r => {
        const name = r.data.full_name?.trim() || r.data.email?.split('@')[0] || 'Pengguna'
        setUsername(name)
        setProfile(r.data.risk_profile || '—')
      })
      .catch(() => { localStorage.removeItem('access_token'); window.location.href = '/auth/login' })

    api.get('/recommendation/top-picks', { headers })
      .then(r => setRecs(r.data))
      .catch(() => setError('Gagal memuat data analisis. Pastikan server backend berjalan.'))

    api.get('/market/sectors')
      .then(r => setSectors(r.data))
      .finally(() => setLoading(false))
  }, [])

  // Fetch momentum stocks (used by modern layout)
  useEffect(() => {
    api.get('/market/momentum')
      .then(res => setMomentumStocks(res.data))
      .catch(() => {})
  }, [])

  // Auto-select first valid sector for modern layout
  useEffect(() => {
    if (sectors.length > 0 && !activeSector) {
      const firstValid = sectors.find(s => s.total_stocks > 0)
      if (firstValid) setActiveSector(firstValid.sector)
    }
  }, [sectors, activeSector])

  const rankColor = (i: number) => {
    if (i === 0) return 'gold'
    if (i === 1) return 'silver'
    if (i === 2) return 'bronze'
    return ''
  }

  const validSectors  = sectors.filter(s => s.total_stocks > 0)
  const bullishSector = [...validSectors].sort((a, b) => b.avg_ai_score - a.avg_ai_score)[0]

  const getMovers = () => {
    if (activeMoverTab === 'gainers') return [...momentumStocks].sort((a, b) => parseFloat(b.ai_score_percent) - parseFloat(a.ai_score_percent)).slice(0, 5)
    if (activeMoverTab === 'losers')  return [...momentumStocks].filter(s => s.ai_score).sort((a, b) => parseFloat(a.ai_score_percent) - parseFloat(b.ai_score_percent)).slice(0, 5)
    const active = ['BBCA', 'BBRI', 'TLKM', 'BMRI', 'GOTO', 'ASII', 'ADRO']
    return momentumStocks.filter(s => active.includes(s.ticker.replace('.JK', ''))).slice(0, 5)
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <Topbar />
          <div className="page-body">
            <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: 16 }}>
              <div className="logo-mark" style={{ width: 48, height: 48, fontSize: 20 }}>S</div>
              <p style={{ color: 'var(--text-secondary)' }}>Memuat data pasar...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // MODERN LAYOUT  (tampilan versi GitHub terbaru)
  // ════════════════════════════════════════════════════════════════════════
  if (dashLayout === 'modern') {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <Topbar />
          <div className="page-body" style={{ paddingTop: 24 }}>

            {error && (
              <div style={{ color: 'var(--red)', marginBottom: 24, padding: '12px 16px', border: '1px solid var(--red)', borderRadius: 8 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Overview Deck: IHSG + Portfolio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* IHSG Card */}
              <div className="card">
                <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Indeks Harga Saham Gabungan
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>IHSG</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 700 }}>7.120,45</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>▲ +0.42%</span>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <div><div style={{ color: 'var(--text-muted)' }}>High</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.145,20</div></div>
                  <div><div style={{ color: 'var(--text-muted)' }}>Low</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.095,50</div></div>
                  <div><div style={{ color: 'var(--text-muted)' }}>Prev Close</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.090,65</div></div>
                </div>
              </div>

              {/* Portfolio Card */}
              <div className="card">
                <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Portofolio Virtual
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>Ringkasan Akun</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Nilai Portofolio</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>Rp 100.000.000</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Return (ROI)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>▲ +0.00%</div>
                  </div>
                </div>
                <Link href="/virtual-trading" className="btn-primary" style={{ display: 'block', padding: '8px 16px', fontSize: 12, textAlign: 'center', textDecoration: 'none', marginTop: 14 }}>
                  Virtual Trading
                </Link>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
              {(['overview', 'sectors'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveDashboardTab(tab)}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeDashboardTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    color: activeDashboardTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                    marginBottom: -1,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'overview' ? 'Ringkasan Pasar' : 'Analisis Sektoral'}
                </button>
              ))}
            </div>

            {/* ── TAB: RINGKASAN PASAR ── */}
            {activeDashboardTab === 'overview' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
                {/* Left: Watchlist */}
                <section>
                  <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>AI Watchlist — Top Matches</div>
                  <div className="section-sub">Emiten terbaik sesuai profil risiko <strong>{profile}</strong> Anda</div>
                  <div style={{ marginTop: 12 }}>
                    {recs.length === 0 ? (
                      <div className="empty-state" style={{ border: '1px dashed var(--border)', borderRadius: 12 }}>
                        <div className="empty-icon">📋</div>
                        <div className="empty-text">Belum ada rekomendasi. Selesaikan kuesioner profil risiko Anda terlebih dahulu.</div>
                        <Link href="/profile" className="btn-primary" style={{ fontSize: 13, marginTop: 8, textDecoration: 'none' }}>Isi Profil Risiko</Link>
                      </div>
                    ) : recs.slice(0, 5).map((r) => (
                      <div key={r.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, transition: 'border-color 0.2s' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Link href={`/market/${r.ticker}`} style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', textDecoration: 'none' }}>
                              {r.ticker.replace('.JK', '')}
                            </Link>
                            <span style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', borderRadius: 5, fontWeight: 700, border: '1px solid rgba(59,130,246,0.2)' }}>
                              {r.sector}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                            ROE: {r.roe}% · PBV: {r.pbv}x · DER: {r.der}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{r.match_score_percent} Match</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
                            <div className="ai-bar-track" style={{ width: 80 }}>
                              <div className="ai-bar-fill" style={{ width: r.ai_score_percent }} />
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.ai_score_percent}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Right: Sentimen + Movers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* AI Sentimen */}
                  <div className="card">
                    <div className="section-title" style={{ fontSize: 14, marginBottom: 4 }}>AI Sentimen Pasar</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Rata-rata optimisme seluruh sektor hari ini</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 28 }}>●</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow)' }}>Netral (Konsolidasi)</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Index Sentimen: 35.0%</div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginTop: 12 }}>
                      <div style={{ width: '35%', height: '100%', background: 'var(--yellow)', borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Market Movers */}
                  <div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {([['gainers', 'Momentum'], ['losers', 'Terlemah'], ['active', 'Teraktif']] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setActiveMoverTab(key)}
                          style={{
                            padding: '5px 10px', borderRadius: 6, border: '1px solid',
                            borderColor: activeMoverTab === key ? 'var(--accent)' : 'var(--border)',
                            background: activeMoverTab === key ? 'var(--accent-glow)' : 'transparent',
                            color: activeMoverTab === key ? 'var(--accent)' : 'var(--text-secondary)',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {momentumStocks.length === 0
                      ? [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 6 }} />)
                      : getMovers().map((stock: any) => (
                        <div key={stock.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Link href={`/market/${stock.ticker}`} style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none' }}>
                              {stock.ticker.replace('.JK', '')}
                            </Link>
                            <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', borderRadius: 4, fontWeight: 700 }}>
                              {stock.sector}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>AI: {stock.ai_score_percent}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

            ) : (
              /* ── TAB: ANALISIS SEKTORAL ── */
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
                {/* Sector List */}
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Daftar Sektor BEI</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Pilih sektor untuk melihat detail</div>
                  {validSectors.map((s) => (
                    <button
                      key={s.sector}
                      onClick={() => setActiveSector(s.sector)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid',
                        borderColor: activeSector === s.sector ? 'var(--accent)' : 'transparent',
                        background: activeSector === s.sector ? 'var(--accent-glow)' : 'transparent',
                        cursor: 'pointer', marginBottom: 4, textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: activeSector === s.sector ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {s.sector}
                      </span>
                      <span className={`sentiment-badge ${s.sentiment.toLowerCase()}`} style={{ fontSize: 9 }}>
                        {s.sentiment}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Sector Detail */}
                <div className="card">
                  {(() => {
                    const s = validSectors.find(sec => sec.sector === activeSector)
                    if (!s) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Pilih sektor dari daftar di kiri untuk melihat detail.</div>
                    return (
                      <div>
                        <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Detail Analisis Sektor
                        </span>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>Sektor {s.sector}</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.total_stocks} emiten aktif terlacak</p>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                          <span className={`sentiment-badge ${s.sentiment.toLowerCase()}`}>{s.sentiment}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>Avg: {s.avg_ai_score_percent}</span>
                        </div>
                        <hr style={{ margin: '16px 0', borderColor: 'var(--border)' }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                          3 Emiten Teratas — Momentum AI Tertinggi
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                          {s.top_movers.length > 0 ? s.top_movers.map((m) => (
                            <div key={m.ticker} style={{ padding: 14, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                              <Link href={`/market/${m.ticker}`} style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', textDecoration: 'none' }}>
                                {m.ticker.replace('.JK', '')}
                              </Link>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>AI Score</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{m.ai_score_percent}</span>
                              </div>
                            </div>
                          )) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak ada emiten aktif di sektor ini</span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            <DisclaimerFooter />
          </div>
        </main>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // CLASSIC LAYOUT  (tampilan lokal / versi lama v1.4)
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <div className="page-body">

          {/* ─── GREETING ─── */}
          <div className="mb-24">
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Halo, {username}! 👋</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Profil Risiko Anda:{' '}
              <strong style={{ color: PROFILE_COLORS[profile] || 'var(--accent)' }}>{profile}</strong>
              {' '}— AI STOXAREA menganalisis emiten yang paling sesuai dengan profil Anda secara matematis.
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
                <div className="stat-value text-accent">
                  {validSectors.length > 0 ? validSectors.reduce((acc, s) => acc + s.total_stocks, 0).toString() : '—'}
                </div>
                <div className="stat-sub">Emiten IDX aktif dianalisis</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Match Score Tertinggi</div>
                <div className="stat-value text-accent">{recs[0]?.match_score_percent || '—'}</div>
                <div className="stat-sub">
                  {recs[0]?.ticker
                    ? <Link href={`/market/${recs[0].ticker}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{recs[0].ticker.replace('.JK', '')}</Link>
                    : '—'
                  } untuk profil {profile}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Sektor Paling Bullish</div>
                <div className="stat-value" style={{ fontSize: 16, fontWeight: 700 }}>
                  {bullishSector?.sector
                    ? <Link href={`/market?sector=${encodeURIComponent(bullishSector.sector)}`} style={{ color: 'inherit', textDecoration: 'none' }}><span className="hover-opacity">{bullishSector.sector}</span></Link>
                    : '—'}
                </div>
                <div className="stat-sub stat-up">{bullishSector?.avg_ai_score_percent || '—'} AI Score rata-rata</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Sektor Aktif Terpantau</div>
                <div className="stat-value text-blue">{validSectors.length}</div>
                <div className="stat-sub">dari 11 Sektor Resmi BEI</div>
              </div>
            </div>
          </section>

          {/* ─── AI WATCHLIST TOP PICKS ─── */}
          <section className="dashboard-section mb-24" role="region" aria-label="AI Watchlist Emiten Pilihan">
            <div className="section-title">🎯 AI Watchlist — Top Matches</div>
            <div className="section-sub">
              Emiten Paling Sesuai Profil {profile} Anda berdasarkan Kalkulasi SAW · Bukan Saran Investasi
            </div>

            {recs.length === 0 ? (
              <div className="card empty-state mb-24">
                <div className="empty-icon">📋</div>
                <div className="empty-text">Belum ada data analisis. Silakan selesaikan kuesioner profil risiko terlebih dahulu.</div>
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
                      <span className="match-label">Match dengan profil Anda</span>
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
                        <div className="metric-label">PBV</div>
                        <div className="metric-value">{r.pbv}x</div>
                      </div>
                      <div className="metric">
                        <div className="metric-label">DER</div>
                        <div className="metric-value">{r.der}</div>
                      </div>
                    </div>

                    {r.insights && r.insights.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        {r.insights.slice(0, 2).map((ins, i) => (
                          <span key={i} className="insight-pill">🔥 {ins.description.split(' ').slice(0, 5).join(' ')}</span>
                        ))}
                      </div>
                    )}

                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `3px solid ${PROFILE_COLORS[profile] || 'var(--accent)'}`, marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: PROFILE_COLORS[profile] || 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Kenapa Jadi Top Pick?
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                        {profile === 'Agresif'      && `Sangat disarankan karena skor Momentum AI (${r.ai_score_percent}) yang sangat dominan, cocok untuk mengejar kenaikan cepat.`}
                        {profile === 'Moderat'      && `Menawarkan keseimbangan yang baik antara tren kenaikan harga dan stabilitas laba (ROE ${r.roe}%).`}
                        {profile === 'Konservatif'  && `Prioritas pada keamanan finansial dengan tingkat hutang yang rendah (DER ${r.der}) dan profitabilitas yang sehat.`}
                        {profile === '—'            && `Emiten dengan skor SAW tertinggi berdasarkan data fundamental dan teknikal terkini.`}
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
          <div style={{ margin: '0 0 24px', padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <p style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.7, margin: 0 }}>
              <strong>Pernyataan Penting:</strong> Seluruh hasil analisis di halaman ini — termasuk AI Watchlist, Match Score, dan AI Score — merupakan <strong>output kalkulasi matematis algoritmik</strong> (metode SAW + XGBoost) berdasarkan data historis dan teknikal. Hasil ini <strong>bukan merupakan saran, ajakan, atau rekomendasi investasi</strong> dalam bentuk apapun. Keputusan investasi sepenuhnya merupakan tanggung jawab pengguna. StoxArea tidak memiliki lisensi Penasihat Investasi dari OJK.
            </p>
          </div>

          {/* ─── RANKING TABLE + RADAR SEKTOR ─── */}
          <section className="dashboard-section mb-24" role="region" aria-label="Ranking dan Radar Sektor Pasar">
            <div className="ranking-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              <div className="card">
                <div className="section-title" style={{ fontSize: 16, marginBottom: 4 }}>📊 Ranking SPK Keseluruhan</div>
                <div className="section-sub" style={{ marginBottom: 16 }}>15 emiten paling sesuai berdasarkan Skor SAW</div>
                <table className="ranking-table">
                  <thead>
                    <tr><th>#</th><th>Ticker</th><th>Sektor</th><th>Match %</th><th>AI Score</th></tr>
                  </thead>
                  <tbody>
                    {recs.slice(0, 15).map((r, i) => (
                      <tr key={r.ticker}>
                        <td><div className={`rank-num ${rankColor(i)}`}>{i + 1}</div></td>
                        <td><Link href={`/market/${r.ticker}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>{r.ticker.replace('.JK', '')}</Link></td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.sector}</td>
                        <td><span className="text-accent fw-700">{r.match_score_percent}</span></td>
                        <td>
                          <div className="ai-bar-wrap">
                            <div className="ai-bar-track"><div className="ai-bar-fill" style={{ width: r.ai_score_percent }} /></div>
                            <span className="fs-12 text-muted">{r.ai_score_percent}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="section-title" style={{ fontSize: 16, marginBottom: 4 }}>🌐 Radar Sektor BEI</div>
                <div className="section-sub" style={{ marginBottom: 16 }}>Sentimen AI per Sektor (Bullish/Netral/Bearish)</div>
                <table className="ranking-table">
                  <thead>
                    <tr><th>Sektor</th><th>Saham</th><th>AI Avg</th><th>Sentimen</th></tr>
                  </thead>
                  <tbody>
                    {validSectors.map((s) => (
                      <tr key={s.sector}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>
                          <Link href={`/market?sector=${encodeURIComponent(s.sector)}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover-opacity">{s.sector}</Link>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.total_stocks}</td>
                        <td>
                          <div className="ai-bar-wrap">
                            <div className="ai-bar-track"><div className="ai-bar-fill" style={{ width: s.avg_ai_score_percent }} /></div>
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
              {validSectors.map(s => (
                <div key={s.sector} className="sector-card">
                  <div className="sector-card-top">
                    <div>
                      <Link href={`/market?sector=${encodeURIComponent(s.sector)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <div className="sector-name hover-opacity">{s.sector}</div>
                      </Link>
                      <div className="sector-count">{s.total_stocks} saham dipantau</div>
                    </div>
                    <span className={`sentiment-badge ${(s.sentiment || '').toLowerCase()}`} style={{ fontSize: 11 }}>{s.sentiment}</span>
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
      </main>
    </div>
  )
}
