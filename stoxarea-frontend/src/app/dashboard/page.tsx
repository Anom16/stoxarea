'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import api from '@/lib/api'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

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
  transparency?: any
}

interface SectorRow {
  sector: string
  total_stocks: number
  avg_ai_score: number
  avg_ai_score_percent: string
  sentiment: string
  top_movers: { ticker: string; ai_score_percent: string }[]
}

const getProfileColor = (p: string) => {
  const norm = p.toLowerCase()
  if (norm.startsWith('konservatif')) return '#10b981'
  if (norm.startsWith('moderat')) return '#3b82f6'
  if (norm.startsWith('agresif')) return '#f59e0b'
  return '#e040fb'
}

export default function DashboardPage() {
  const router = useRouter()
  const [recs, setRecs]       = useState<Recommendation[]>([])
  const [sectors, setSectors] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState('—')
  const [username, setUsername] = useState('Pengguna')
  const [virtualBalance, setVirtualBalance] = useState<number>(100000000)
  const [error, setError]     = useState('')
  const [selectedTransparency, setSelectedTransparency] = useState<any>(null)

  // Layout switch
  const [dashLayout, setDashLayout] = useState<'classic' | 'modern'>('classic')

  // Modern layout state
  const [activeMoverTab, setActiveMoverTab]         = useState<'gainers' | 'losers' | 'active'>('gainers')
  const [momentumStocks, setMomentumStocks]         = useState<any[]>([])
  const [activeSector, setActiveSector]             = useState<string>('')
  const [ihsgData, setIhsgData]                     = useState<any>(null)
  const [ihsgLoading, setIhsgLoading]               = useState<boolean>(true)
  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'sectors'>('overview')

  // Mobile Dashboard Filter States (Compact View)
  const [showAllRanking, setShowAllRanking]         = useState<boolean>(false)
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL')

  // ── Fetch user + data ────────────────────────────────────────────────────
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) { 
      router.replace('/auth/login')
      return 
    }

    // Read saved layout preference
    const savedLayout = localStorage.getItem('dashboard_layout') as 'classic' | 'modern'
    if (savedLayout) setDashLayout(savedLayout)

    const headers = { Authorization: `Bearer ${token}` }

    // Fetch user info
    api.get('/auth/me', { headers })
      .then(r => {
        const name = r.data.full_name?.trim() || r.data.email?.split('@')[0] || 'Pengguna'
        setUsername(name)
        if (typeof r.data.virtual_balance === 'number') {
          setVirtualBalance(r.data.virtual_balance)
        }
        const rawProfile = r.data.risk_profile
        if (rawProfile) {
          const capitalized = rawProfile
            .split('_')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          setProfile(capitalized)
        } else if (!r.data.is_admin) {
          // User biasa yang belum mengisi profil risiko otomatis dialihkan ke /onboarding
          router.replace('/onboarding')
          return
        } else {
          setProfile('—')
        }
      })
      .catch(() => {
        localStorage.removeItem('access_token')
        router.replace('/auth/login')
      })

    // Fetch recommendations, technicals, sectors in parallel safely
    Promise.allSettled([
      api.get('/recommendation/top-picks', { headers }),
      api.get('/market/technical/^JKSE?period=1mo'),
      api.get('/market/sectors')
    ]).then(([recsRes, ihsgRes, sectorsRes]) => {
      if (recsRes.status === 'fulfilled' && Array.isArray(recsRes.value.data)) {
        setRecs(recsRes.value.data)
      } else if (recsRes.status === 'rejected') {
        setError('Gagal memuat data analisis. Pastikan server backend berjalan.')
      }

      if (ihsgRes.status === 'fulfilled' && ihsgRes.value.data && !ihsgRes.value.data.error) {
        setIhsgData(ihsgRes.value.data)
      }
      setIhsgLoading(false)

      if (sectorsRes.status === 'fulfilled' && Array.isArray(sectorsRes.value.data)) {
        setSectors(sectorsRes.value.data)
        const firstValid = sectorsRes.value.data.find((s: any) => s.total_stocks > 0)
        if (firstValid) setActiveSector(firstValid.sector)
      }
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  // Fetch momentum stocks (used by modern layout)
  useEffect(() => {
    api.get('/market/momentum')
      .then(res => { if (Array.isArray(res.data)) setMomentumStocks(res.data) })
      .catch(() => {})
  }, [])



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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
              <img 
                src="/icons/loading.gif" 
                onError={(e) => { (e.target as HTMLImageElement).src = '/icons/icon-192x192.png' }}
                alt="Loading..." 
                style={{ width: 80, height: 80, objectFit: 'contain' }} 
              />
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
            <div className="modern-deck-grid">
              {/* IHSG Card */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Indeks Harga Saham Gabungan
                  </span>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 6, marginBottom: 0 }}>IHSG</h2>
                  {ihsgData ? (
                    <>
                      {(() => {
                        const closeList = ihsgData.candles.close
                        const lastPrice = closeList[closeList.length - 1]
                        const prevPrice = closeList[closeList.length - 2] || lastPrice
                        const pctChange = ((lastPrice - prevPrice) / prevPrice) * 100
                        const isUp = pctChange >= 0
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                              <span style={{ fontSize: 26, fontWeight: 700 }}>
                                {lastPrice.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: isUp ? 'var(--accent)' : '#ef4444' }}>
                                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pctChange.toFixed(2)}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>High</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                                  {ihsgData.candles.high[ihsgData.candles.high.length - 1]?.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Low</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                                  {ihsgData.candles.low[ihsgData.candles.low.length - 1]?.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Prev Close</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                                  {prevPrice.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                         <span style={{ fontSize: 26, fontWeight: 700 }}>7.120,45</span>
                         <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>▲ +0.42%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                         <div><div style={{ color: 'var(--text-muted)' }}>High</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.145,20</div></div>
                         <div><div style={{ color: 'var(--text-muted)' }}>Low</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.095,50</div></div>
                         <div><div style={{ color: 'var(--text-muted)' }}>Prev Close</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.090,65</div></div>
                      </div>
                    </>
                  )}
                </div>

                {/* Sparkline chart - White line */}
                <div style={{ width: 140, height: 65, alignSelf: 'center', marginRight: 5 }}>
                  {ihsgData && ihsgData.candles && ihsgData.candles.close.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ihsgData.candles.close.map((v: number) => ({ v }))}>
                        <defs>
                          <linearGradient id="ihsg-spark-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area 
                          type="monotone" 
                          dataKey="v" 
                          stroke="#ffffff" 
                          fillOpacity={1} 
                          fill="url(#ihsg-spark-grad)" 
                          strokeWidth={1.5}
                          dot={false} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 10 }}>
                      {ihsgLoading ? 'Memuat grafik...' : 'Tidak ada data'}
                    </div>
                  )}
                </div>
              </div>

              {/* Portfolio Card */}
              <div className="card">
                <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Portofolio Virtual
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>Ringkasan Akun</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sisa Saldo Kas</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                      Rp {virtualBalance.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Status Akun</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
                      Aktif
                    </div>
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
              <div className="modern-overview-grid">
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
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                            {r.match_score_percent} Match
                            {r.transparency && (
                              <span 
                                onClick={(e) => { e.preventDefault(); setSelectedTransparency(r); }}
                                style={{ marginLeft: 6, cursor: 'pointer', fontSize: 12, opacity: 0.8 }} 
                                title="Lihat Transparansi Kalkulasi"
                              >
                                ℹ️
                              </span>
                            )}
                          </div>
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
              <div className="card" style={{ padding: 20 }}>
                <div className="section-title" style={{ fontSize: 16, marginBottom: 4, fontWeight: 800 }}>Analisis Sektoral BEI</div>
                <div className="section-sub" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                  Pilih sektor untuk melihat detail emiten dan sentimen pasar.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {validSectors.map((s) => (
                    <div
                      key={s.sector}
                      style={{
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        overflow: 'hidden',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Header button */}
                      <button
                        onClick={() => setActiveSector(activeSector === s.sector ? null : s.sector)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none',
                          background: activeSector === s.sector ? 'var(--accent-glow)' : 'transparent',
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 800, color: activeSector === s.sector ? 'var(--accent)' : 'var(--text-primary)' }}>
                          📁 Sektor {s.sector}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`sentiment-badge ${s.sentiment.toLowerCase()}`} style={{ fontSize: 9 }}>
                            {s.sentiment}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }}>
                            {activeSector === s.sector ? '▼' : '▶'}
                          </span>
                        </div>
                      </button>

                      {/* Details (Accordion body) */}
                      {activeSector === s.sector && (
                        <div style={{ 
                          padding: '16px', 
                          borderTop: '1px solid var(--border)', 
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}>
                          {/* Sub-info */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <div>📈 <strong>{s.total_stocks}</strong> emiten aktif</div>
                            <div>|</div>
                            <div>Nilai Rata-rata AI: <strong style={{ color: 'var(--blue)' }}>{s.avg_ai_score_percent}</strong></div>
                          </div>

                          {/* Top 3 Emiten */}
                          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                              3 Emiten Teratas — Momentum AI Tertinggi
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {s.top_movers.length > 0 ? s.top_movers.map((m, idx) => (
                                <div 
                                  key={m.ticker} 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 12,
                                    padding: '8px 14px', 
                                    background: 'var(--bg-primary)', 
                                    borderRadius: 8, 
                                    border: '1px solid var(--border)',
                                    fontSize: 13,
                                  }}
                                >
                                  <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 14 }}>{idx + 1}.</span>
                                  <Link href={`/market/${m.ticker}`} style={{ fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'none', flex: 1 }}>
                                    {m.ticker.replace('.JK', '')}
                                  </Link>
                                  <span style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 12 }}>AI Score: {m.ai_score_percent}</span>
                                </div>
                              )) : (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak ada emiten aktif di sektor ini</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
              <strong style={{ color: getProfileColor(profile) }}>{profile}</strong>
              {' '}— AI STOXAREA menganalisis emiten yang paling sesuai dengan profil Anda secara matematis.
            </p>
          </div>

          {error && (
            <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 24 }}>
              ⚠️ {error}
            </div>
          )}

          {/* ─── OVERVIEW DECK: IHSG + PORTOFOLIO ─── */}
          <section className="dashboard-section mb-24" role="region" aria-label="Ringkasan Pasar dan Portofolio">
            <div className="modern-deck-grid">
              {/* IHSG Card */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Indeks Harga Saham Gabungan
                  </span>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 6, marginBottom: 0 }}>IHSG</h2>
                  {ihsgData ? (
                    <>
                      {(() => {
                        const closeList = ihsgData.candles.close
                        const lastPrice = closeList[closeList.length - 1]
                        const prevPrice = closeList[closeList.length - 2] || lastPrice
                        const pctChange = ((lastPrice - prevPrice) / prevPrice) * 100
                        const isUp = pctChange >= 0
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                              <span style={{ fontSize: 26, fontWeight: 700 }}>
                                {lastPrice.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: isUp ? 'var(--accent)' : '#ef4444' }}>
                                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pctChange.toFixed(2)}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>High</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                                  {ihsgData.candles.high[ihsgData.candles.high.length - 1]?.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Low</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                                  {ihsgData.candles.low[ihsgData.candles.low.length - 1]?.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Prev Close</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                                  {prevPrice.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                         <span style={{ fontSize: 26, fontWeight: 700 }}>7.120,45</span>
                         <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>▲ +0.42%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                         <div><div style={{ color: 'var(--text-muted)' }}>High</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.145,20</div></div>
                         <div><div style={{ color: 'var(--text-muted)' }}>Low</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.095,50</div></div>
                         <div><div style={{ color: 'var(--text-muted)' }}>Prev Close</div><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>7.090,65</div></div>
                      </div>
                    </>
                  )}
                </div>

                {/* Sparkline chart */}
                <div style={{ width: 140, height: 65, alignSelf: 'center', marginRight: 5 }}>
                  {ihsgData && ihsgData.candles && ihsgData.candles.close.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ihsgData.candles.close.map((v: number) => ({ v }))}>
                        <defs>
                          <linearGradient id="ihsg-spark-classic-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area 
                          type="monotone" 
                          dataKey="v" 
                          stroke="var(--accent)" 
                          fillOpacity={1} 
                          fill="url(#ihsg-spark-classic-grad)" 
                          strokeWidth={2}
                          dot={false} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 10 }}>
                      {ihsgLoading ? 'Memuat grafik...' : 'Tidak ada data'}
                    </div>
                  )}
                </div>
              </div>

              {/* Portfolio Card */}
              <div className="card">
                <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Portofolio Virtual
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 6, marginBottom: 0 }}>Ringkasan Akun</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sisa Saldo Kas</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                      Rp {virtualBalance.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Profil Risiko</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: getProfileColor(profile), marginTop: 4 }}>
                      {profile}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <Link href="/virtual-trading" className="btn-primary" style={{ flex: 1, padding: '10px 14px', fontSize: 12, textDecoration: 'none', textAlign: 'center' }}>
                    ◈ Buka Virtual Trading
                  </Link>
                </div>
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

                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `3px solid ${getProfileColor(profile)}`, marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: getProfileColor(profile), textTransform: 'uppercase', marginBottom: 4 }}>
                        Kenapa Jadi Top Pick?
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                        {profile.toLowerCase().startsWith('agresif')      && `Sangat disarankan karena skor Momentum AI (${r.ai_score_percent}) yang sangat dominan, cocok untuk mengejar kenaikan cepat.`}
                        {profile.toLowerCase().startsWith('moderat')      && `Menawarkan keseimbangan yang baik antara tren kenaikan harga dan stabilitas laba (ROE ${r.roe}%).`}
                        {profile.toLowerCase().startsWith('konservatif')  && `Prioritas pada keamanan finansial dengan tingkat hutang yang rendah (DER ${r.der}) dan profitabilitas yang sehat.`}
                        {(profile === '—' || !profile)                    && `Emiten dengan skor SAW tertinggi berdasarkan data fundamental dan teknikal terkini.`}
                      </div>
                    </div>

                    <div className="pick-actions" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                      <Link 
                        href={`/market/${r.ticker}`} 
                        className="btn-primary" 
                        style={{ textDecoration: 'none', textAlign: 'center', padding: '7px 10px', fontSize: 11, width: '100%', borderRadius: 8, justifyContent: 'center' }}
                      >
                        Detail Analisis
                      </Link>
                      {r.transparency && (
                        <button 
                          className="btn-outline" 
                          onClick={() => setSelectedTransparency(r)}
                          style={{ padding: '6px 10px', fontSize: 11, cursor: 'pointer', background: 'rgba(0, 102, 255, 0.05)', borderColor: 'var(--accent)', color: 'var(--accent)', width: '100%', borderRadius: 8, fontWeight: 700, justifyContent: 'center' }}
                        >
                          ⚖️ Transparansi SAW
                        </button>
                      )}
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
            <div className="ranking-grid-2col">
              <div className="card" style={{ overflowX: 'auto' }}>
                <div className="section-title" style={{ fontSize: 16, marginBottom: 4 }}>📊 Ranking SPK Keseluruhan</div>
                <div className="section-sub" style={{ marginBottom: 16 }}>15 emiten paling sesuai berdasarkan Skor SAW</div>
                <table className="ranking-table">
                  <thead>
                    <tr><th>#</th><th>Ticker</th><th>Sektor</th><th>Match %</th><th>AI Score</th></tr>
                  </thead>
                  <tbody>
                    {(showAllRanking ? recs.slice(0, 15) : recs.slice(0, 5)).map((r, i) => (
                      <tr key={r.ticker}>
                        <td><div className={`rank-num ${rankColor(i)}`}>{i + 1}</div></td>
                        <td><Link href={`/market/${r.ticker}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>{r.ticker.replace('.JK', '')}</Link></td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.sector}</td>
                        <td>
                          <span className="text-accent fw-700">{r.match_score_percent}</span>
                          {r.transparency && (
                            <span 
                              onClick={(e) => { e.preventDefault(); setSelectedTransparency(r); }}
                              style={{ marginLeft: 6, cursor: 'pointer', fontSize: 11, opacity: 0.7 }}
                              title="Lihat Transparansi Kalkulasi"
                            >
                              ℹ️
                            </span>
                          )}
                        </td>
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
                {recs.length > 5 && (
                  <button 
                    onClick={() => setShowAllRanking(!showAllRanking)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: 12,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px dashed var(--border)',
                      borderRadius: 8,
                      color: 'var(--accent)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    {showAllRanking ? '▲ Tampilkan 5 Teratas Saja' : '▼ Lihat 10 Saham Lainnya...'}
                  </button>
                )}
              </div>

              <div className="card" style={{ overflowX: 'auto' }}>
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
            
            {/* Horizontal Sector Selector Pills (Mobile Friendly) */}
            <div className="pills-container" style={{ marginBottom: 16 }}>
              <button 
                onClick={() => setSelectedSectorFilter('ALL')} 
                className={`pill-btn ${selectedSectorFilter === 'ALL' ? 'active' : ''}`}
              >
                Semua Sektor ({validSectors.length})
              </button>
              {validSectors.map(s => (
                <button 
                  key={s.sector} 
                  onClick={() => setSelectedSectorFilter(s.sector)} 
                  className={`pill-btn ${selectedSectorFilter === s.sector ? 'active' : ''}`}
                >
                  {s.sector}
                </button>
              ))}
            </div>

            <div className="sector-mover-grid">
              {(selectedSectorFilter === 'ALL' ? validSectors : validSectors.filter(s => s.sector === selectedSectorFilter)).map(s => (
                <div key={s.sector} className="sector-mover-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <Link href={`/market?sector=${encodeURIComponent(s.sector)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }} className="hover-opacity">
                          {s.sector}
                        </div>
                      </Link>
                      <span className="badge-sector" style={{ fontSize: 10 }}>
                        {s.sentiment || 'Bullish'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                      {s.total_stocks} saham dipantau
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Top Movers AI:
                    </div>
                    {s.top_movers.map((m, i) => (
                      <div key={m.ticker} className="mover-stock-item">
                        <Link href={`/market/${m.ticker}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {i + 1}. {m.ticker.replace('.JK', '')}
                        </Link>
                        <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 12 }}>
                          {m.ai_score_percent}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <DisclaimerFooter />
        </div>
      </main>

      {/* ─── MODAL TRANSPARANSI PERHITUNGAN SAW ─── */}
      {selectedTransparency && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          backdropFilter: 'blur(8px)', fontFamily: 'Inter, sans-serif',
          padding: '16px',
        }}>
          <div style={{
            background: '#16213e', border: '1px solid var(--accent)', borderRadius: 16,
            padding: 'clamp(16px, 4vw, 28px)', maxWidth: 540, width: '100%', boxSizing: 'border-box',
            position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <button 
              onClick={() => setSelectedTransparency(null)}
              style={{
                position: 'absolute', top: 16, right: 16, background: 'transparent',
                border: 'none', color: '#888', fontSize: 20, cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: 'white' }}>
              ⚖️ Transparansi Perhitungan SAW — {selectedTransparency.ticker.replace('.JK', '')}
            </h3>
            <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 20px' }}>
              Bagaimana skor kesesuaian <b>{selectedTransparency.match_score_percent}</b> didapatkan dari Backend?
            </p>

            {/* Formula / Step 1 */}
            <div style={{ background: '#0a0f1a', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
                Rumus Akhir (Weighted SAW Sum)
              </div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#10b981', lineHeight: 1.5, wordBreak: 'break-all' }}>
                {selectedTransparency.transparency.formula}
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left', color: '#ccc', minWidth: 420 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={{ padding: '8px 4px', color: '#fff' }}>Kriteria</th>
                  <th style={{ padding: '8px 4px', color: '#fff' }}>Nilai Asli (Raw)</th>
                  <th style={{ padding: '8px 4px', color: '#fff' }}>Tipe</th>
                  <th style={{ padding: '8px 4px', color: '#fff' }}>Normalisasi (n)</th>
                  <th style={{ padding: '8px 4px', color: '#fff' }}>Bobot (w)</th>
                  <th style={{ padding: '8px 4px', color: '#fff', textAlign: 'right' }}>Hasil (n × w)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(selectedTransparency.transparency.weights).map((indId) => {
                  const rawVal = selectedTransparency.transparency.raw_values[indId] ?? 0.0
                  const normVal = selectedTransparency.transparency.normalized_values[indId] ?? 0.0
                  const weight = selectedTransparency.transparency.weights[indId] ?? 0.0
                  const result = normVal * weight

                  // Label and styling heuristics
                  let displayName = indId.toUpperCase()
                  let typeLabel = "BENEFIT"
                  let typeColor = "#4CAF50"
                  
                  if (indId === 'ai_score') { displayName = "🤖 AI Score" }
                  else if (indId === 'roe') { displayName = "📈 ROE" }
                  else if (indId === 'der') { displayName = "📉 DER"; typeLabel = "COST"; typeColor = "#f44336" }
                  else if (indId === 'pbv') { displayName = "📊 PBV"; typeLabel = "COST"; typeColor = "#f44336" }
                  else {
                    const isCost = indId.toLowerCase().includes('der') || indId.toLowerCase().includes('pbv') || indId.toLowerCase().includes('cost') || indId.toLowerCase().includes('ratio') || indId.toLowerCase().includes('debt')
                    typeLabel = isCost ? "COST" : "BENEFIT"
                    typeColor = isCost ? "#f44336" : "#4CAF50"
                    displayName = indId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  }

                  // Display raw value format
                  let rawStr = rawVal.toFixed(2)
                  if (indId === 'ai_score') rawStr = (rawVal * 100).toFixed(1) + '%'
                  else if (indId === 'roe') rawStr = rawVal.toFixed(1) + '%'
                  else if (indId === 'der' || indId === 'pbv') rawStr = rawVal.toFixed(2) + 'x'

                  return (
                    <tr key={indId} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '10px 4px', fontWeight: 600 }}>{displayName}</td>
                      <td style={{ padding: '10px 4px' }}>{rawStr}</td>
                      <td style={{ padding: '10px 4px', color: typeColor, fontSize: 10, fontWeight: 700 }}>{typeLabel}</td>
                      <td style={{ padding: '10px 4px' }}>{normVal.toFixed(2)}</td>
                      <td style={{ padding: '10px 4px' }}>{(weight * 100).toFixed(0)}%</td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                        {result.toFixed(3)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>

            <div style={{ marginTop: 20, fontSize: 10, color: '#888', lineHeight: 1.4 }}>
              💡 <b>Catatan:</b> Untuk kriteria <b>Benefit</b> (ROE & AI Score), nilai dinormalisasi dengan membagi nilai emiten dengan nilai maksimal di pasar. Untuk kriteria <b>Cost</b> (DER & PBV), nilai dinormalisasi dengan membagi nilai minimal di pasar dengan nilai emiten.
            </div>

            <button 
              onClick={() => setSelectedTransparency(null)}
              style={{
                width: '100%', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 8, padding: '12px', fontSize: 14,
                fontWeight: 700, cursor: 'pointer', marginTop: 20
              }}
            >
              Tutup Transparansi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
