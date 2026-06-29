'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import api from '@/lib/api'
import { useDashboardData } from '@/hooks/useRecommendation'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface JciData {
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  prevClose: number
  chart: { date: string; value: number }[]
  loading: boolean
}

interface PortfolioSummary {
  balance: number
  totalEquity: number
  totalValue: number
  totalPL: number
  totalPLPct: number
  loading: boolean
}

export interface SectorRow {
  sector: string
  total_stocks: number
  avg_ai_score: number
  avg_ai_score_percent: string
  sentiment: string
  top_movers: { ticker: string; ai_score_percent: string }[]
}

export default function DashboardPage() {
  const { recs, sectors, loading: mainLoading, profile, username, error } = useDashboardData()
  const [activeMoverTab, setActiveMoverTab] = useState<'gainers' | 'losers' | 'active'>('gainers')
  const [momentumStocks, setMomentumStocks] = useState<any[]>([])
  const [visibleWatchlistCount, setVisibleWatchlistCount] = useState(5)
  const [activeSector, setActiveSector] = useState<string>('')
  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'sectors'>('overview')

  useEffect(() => {
    if (sectors.length > 0 && !activeSector) {
      const firstValid = sectors.find(s => s.total_stocks > 0)
      if (firstValid) {
        setActiveSector(firstValid.sector)
      }
    }
  }, [sectors, activeSector])

  // JCI state
  const [jci, setJci] = useState<JciData>({
    price: 7120.45,
    change: 29.80,
    changePercent: 0.42,
    high: 7145.20,
    low: 7095.50,
    prevClose: 7090.65,
    chart: [],
    loading: true
  })

  // Mini Portfolio Summary States
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    balance: 0,
    totalEquity: 0,
    totalValue: 0,
    totalPL: 0,
    totalPLPct: 0,
    loading: true
  })

  // Fetch JCI live price and chart history
  useEffect(() => {
    const fetchJciData = async () => {
      try {
        const [liveRes, techRes] = await Promise.all([
          api.get('/market/live-price/^JKSE'),
          api.get('/market/technical/^JKSE?period=1mo&interval=1d')
        ])

        // Live JCI details
        const livePrice = liveRes.data.price || 7120.45
        
        // JCI historical technicals for chart
        const dates = techRes.data.dates || []
        const closes = techRes.data.candles?.close || []
        const formattedChart = dates.map((date: string, idx: number) => ({
          date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          value: closes[idx]
        }))

        // Calculate high/low/prev close from technicals if available
        const latestCandles = techRes.data.candles || {}
        const highs = latestCandles.high || []
        const lows = latestCandles.low || []
        const prevClose = closes[closes.length - 2] || (livePrice - 29.80)
        
        const currentHigh = highs[highs.length - 1] || Math.max(livePrice, ...closes.slice(-5))
        const currentLow = lows[lows.length - 1] || Math.min(livePrice, ...closes.slice(-5))
        const change = livePrice - prevClose
        const changePercent = (change / prevClose) * 100

        setJci({
          price: livePrice,
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          high: parseFloat(currentHigh.toFixed(2)),
          low: parseFloat(currentLow.toFixed(2)),
          prevClose: parseFloat(prevClose.toFixed(2)),
          chart: formattedChart,
          loading: false
        })
      } catch (err) {
        console.error('Error fetching JCI chart/live data:', err)
        // Fallback realistic mock data if it fails
        const mockChart = Array.from({ length: 20 }, (_, i) => ({
          date: `${i + 1} Jun`,
          value: 7000 + Math.sin(i * 0.5) * 80 + Math.random() * 30
        }))
        setJci(prev => ({
          ...prev,
          chart: mockChart,
          loading: false
        }))
      }
    }

    fetchJciData()
  }, [])

  // Fetch Virtual Portfolio Summary
  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        const token = localStorage.getItem('access_token')
        if (!token) return

        const headers = { Authorization: `Bearer ${token}` }
        const [portRes, userRes] = await Promise.all([
          api.get('/portfolio/', { headers }),
          api.get('/auth/me', { headers })
        ])

        const balance = userRes.data.virtual_balance || 0
        const holdings = portRes.data || []

        let totalEquity = 0
        let totalCost = 0

        await Promise.all(
          holdings.map(async (item: any) => {
            let currentPrice = item.avg_price
            try {
              const livePriceRes = await api.get(`/market/live-price/${item.ticker}`)
              currentPrice = livePriceRes.data.price || item.avg_price
            } catch {}
            totalEquity += item.qty * currentPrice
            totalCost += item.qty * item.avg_price
          })
        )

        const totalValue = balance + totalEquity
        const totalPL = totalEquity - totalCost
        const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0

        setPortfolioSummary({
          balance,
          totalEquity,
          totalValue,
          totalPL,
          totalPLPct,
          loading: false
        })
      } catch {
        setPortfolioSummary(prev => ({ ...prev, loading: false }))
      }
    }

    fetchPortfolioData()
  }, [])

  // Fetch all stocks for Market Movers
  useEffect(() => {
    api.get('/market/momentum')
      .then(res => {
        setMomentumStocks(res.data)
      })
      .catch(() => {})
  }, [])

  // Calculate Market Movers Lists
  const getGainers = () => {
    return [...momentumStocks]
      .sort((a, b) => parseFloat(b.ai_score_percent) - parseFloat(a.ai_score_percent))
      .slice(0, 5)
  }

  const getLosers = () => {
    return [...momentumStocks]
      .filter(s => s.ai_score && s.ai_score > 0)
      .sort((a, b) => parseFloat(a.ai_score_percent) - parseFloat(b.ai_score_percent))
      .slice(0, 5)
  }

  const getActive = () => {
    const activeTickers = ['BBCA', 'BBRI', 'TLKM', 'BMRI', 'GOTO', 'ASII', 'ADRO']
    return momentumStocks
      .filter(s => activeTickers.includes(s.ticker.replace('.JK', '')))
      .slice(0, 5)
  }

  // Sentiment calculation
  const validSectors = sectors.filter(s => s.total_stocks > 0)
  const averageSentimentScore = validSectors.length > 0 
    ? (validSectors.reduce((acc, s) => acc + s.avg_ai_score, 0) / validSectors.length) * 100 
    : 35

  const getSentimentText = (score: number) => {
    if (score >= 45) return { label: 'Optimis (Sangat Bullish)', color: 'var(--accent)', icon: '🔥' }
    if (score >= 40) return { label: 'Bullish', color: 'var(--accent)', icon: '▲' }
    if (score >= 30) return { label: 'Netral (Konsolidasi)', color: 'var(--yellow)', icon: '●' }
    if (score >= 20) return { label: 'Bearish', color: 'var(--red)', icon: '▼' }
    return { label: 'Pesimis (Sangat Bearish)', color: 'var(--red)', icon: '❄️' }
  }

  const sentimentInfo = getSentimentText(averageSentimentScore)
  const isJciUp = jci.change >= 0

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />

        <div className="page-body" style={{ paddingTop: 24 }}>
          
          {/* TOP OVERVIEW DECK */}
          <div className="dashboard-overview-deck">
            {/* IHSG Card */}
            <div className="dashboard-card JCI-card" style={{ position: 'relative', overflow: 'hidden', minHeight: 180 }}>
              {/* JCI Info */}
              <div style={{ zIndex: 2 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Indeks Harga Saham Gabungan</span>
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginTop: 6, color: 'var(--text-primary)' }}>IHSG</h2>
                
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {jci.price.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isJciUp ? 'var(--accent)' : 'var(--red)' }}>
                    {isJciUp ? '▲ +' : '▼ '}{jci.changePercent}%
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 11, color: 'var(--text-secondary)', zIndex: 2 }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>High</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{jci.high.toLocaleString('id-ID')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Low</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{jci.low.toLocaleString('id-ID')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Prev Close</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{jci.prevClose.toLocaleString('id-ID')}</div>
                </div>
              </div>

              {/* JCI Area Chart */}
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                left: 0, 
                height: 80, 
                opacity: 0.85,
                zIndex: 1
              }}>
                {jci.loading ? (
                  <div className="skeleton" style={{ height: '100%', width: '100%' }}></div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={jci.chart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="jciGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isJciUp ? 'var(--accent)' : 'var(--red)'} stopOpacity={0.15}/>
                          <stop offset="95%" stopColor={isJciUp ? 'var(--accent)' : 'var(--red)'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide={true} />
                      <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide={true} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                        labelStyle={{ color: 'var(--text-secondary)', fontSize: 11 }}
                        itemStyle={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        name="IHSG"
                        stroke={isJciUp ? 'var(--accent)' : 'var(--red)'} 
                        strokeWidth={1.5}
                        fillOpacity={1} 
                        fill="url(#jciGradient)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Portfolio Overview Card */}
            <div className="dashboard-card portfolio-card" style={{ minHeight: 180 }}>
              <div>
                <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Portofolio Virtual</span>
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginTop: 6, color: 'var(--text-primary)' }}>Ringkasan Akun</h2>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Nilai Portofolio</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                    {portfolioSummary.loading ? '...' : `Rp ${portfolioSummary.totalValue.toLocaleString('id-ID')}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Return (ROI)</div>
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 800, 
                    color: portfolioSummary.totalPL >= 0 ? 'var(--accent)' : 'var(--red)', 
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 4
                  }}>
                    {portfolioSummary.loading ? '...' : (
                      <>
                        {portfolioSummary.totalPL >= 0 ? '▲ +' : '▼ '}
                        {portfolioSummary.totalPLPct.toFixed(2)}%
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <Link href="/virtual-trading" className="btn-primary" style={{ flex: 1, padding: '8px 16px', fontSize: 12, textAlign: 'center' }}>
                  Buka Simulator Edu-Trading
                </Link>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--red)', marginBottom: 24, padding: '12px 16px', border: '1px solid var(--red)', borderRadius: 8 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Main Tab Switcher */}
          <div className="dashboard-tab-nav">
            <button 
              onClick={() => setActiveDashboardTab('overview')}
              className={`dashboard-tab-btn ${activeDashboardTab === 'overview' ? 'active' : ''}`}
            >
              Ringkasan Pasar
              {activeDashboardTab === 'overview' && <div className="tab-underline" />}
            </button>
            <button 
              onClick={() => setActiveDashboardTab('sectors')}
              className={`dashboard-tab-btn ${activeDashboardTab === 'sectors' ? 'active' : ''}`}
            >
              Analisis Sektoral
              {activeDashboardTab === 'sectors' && <div className="tab-underline" />}
            </button>
          </div>

          {/* Tab Contents */}
          {activeDashboardTab === 'overview' ? (
            /* 1. Ringkasan Pasar Tab */
            <div className="dashboard-main-grid">
              {/* LEFT COLUMN: Recommendations */}
              <div>
                <section style={{ marginBottom: 32 }}>
                  <div className="section-title" style={{ fontSize: 15 }}>AI Watchlist — Top Matches</div>
                  <div className="section-sub">Emiten terbaik sesuai profil risiko <strong>{profile}</strong> Anda</div>

                  {mainLoading ? (
                    <div className="clean-list">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ height: 60, marginBottom: 12 }} />
                      ))}
                    </div>
                  ) : recs.length === 0 ? (
                    <div className="empty-state" style={{ border: '1px dashed var(--border)', borderRadius: 12 }}>
                      <div className="empty-icon">📋</div>
                      <div className="empty-text">Belum ada rekomendasi. Selesaikan kuesioner profil risiko Anda terlebih dahulu.</div>
                      <Link href="/profile" className="btn-primary" style={{ fontSize: 13, marginTop: 8 }}>
                        Isi Profil Risiko
                      </Link>
                    </div>
                  ) : (
                    <div className="clean-list">
                      {recs.slice(0, visibleWatchlistCount).map((r) => (
                        <div key={r.ticker} className="list-item watchlist-item">
                          <div className="watchlist-item-left">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Link href={`/market/${r.ticker}`} className="list-item-ticker">
                                {r.ticker.replace('.JK', '')}
                              </Link>
                              <span className="badge-sector">{r.sector}</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              ROE: {r.roe}% · PBV: {r.pbv}x · DER: {r.der}
                            </span>
                          </div>
                          
                          <div className="watchlist-item-right">
                            <div className="desktop-only" style={{ maxWidth: 280, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
                              {profile === 'Agresif' && 'Fokus momentum pertumbuhan tinggi.'}
                              {profile === 'Moderat' && 'Keseimbangan pertumbuhan & kesehatan kas.'}
                              {profile === 'Konservatif' && 'Kesehatan finansial aman & hutang rendah.'}
                            </div>
                            
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                                {r.match_score_percent} Match
                              </div>
                              <div className="ai-bar-wrap" style={{ marginTop: 4 }}>
                                <div className="ai-bar-track">
                                  <div className="ai-bar-fill" style={{ width: r.ai_score_percent }} />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 24 }}>{r.ai_score_percent}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {recs.length > 5 && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                          <button 
                            className="btn-outline" 
                            onClick={() => setVisibleWatchlistCount(prev => prev === 5 ? 10 : 5)}
                            style={{ width: '100%', padding: '8px', fontSize: 12, borderStyle: 'dashed' }}
                          >
                            {visibleWatchlistCount === 5 ? 'Lihat Lebih Banyak (Top 10) ▾' : 'Tampilkan Lebih Sedikit ▴'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* RIGHT COLUMN: Market Movers and Sentiment Index */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                
                {/* AI Sentimen Pasar */}
                <section className="dashboard-card sentiment-card">
                  <div className="section-title">AI Sentimen Pasar</div>
                  <div className="section-sub">Rata-rata optimisme seluruh sektor hari ini</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
                    <span style={{ fontSize: 32 }}>{sentimentInfo.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: sentimentInfo.color }}>
                        {sentimentInfo.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Index Sentimen: {averageSentimentScore.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Progress bar representing overall sentiment */}
                  <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
                    <div style={{ width: `${averageSentimentScore}%`, height: '100%', background: sentimentInfo.color, borderRadius: 3 }} />
                  </div>
                </section>
                
                {/* MARKET MOVERS */}
                <section style={{ marginBottom: 32 }}>
                  <div className="tabs-container">
                    <button className={`tab-btn ${activeMoverTab === 'gainers' ? 'active' : ''}`} onClick={() => setActiveMoverTab('gainers')}>
                      Momentum
                    </button>
                    <button className={`tab-btn ${activeMoverTab === 'losers' ? 'active' : ''}`} onClick={() => setActiveMoverTab('losers')}>
                      Terlemah
                    </button>
                    <button className={`tab-btn ${activeMoverTab === 'active' ? 'active' : ''}`} onClick={() => setActiveMoverTab('active')}>
                      Teraktif
                    </button>
                  </div>

                  <div className="clean-list">
                    {momentumStocks.length === 0 ? (
                      [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 50, marginBottom: 8 }} />)
                    ) : (
                      (activeMoverTab === 'gainers' ? getGainers() : activeMoverTab === 'losers' ? getLosers() : getActive()).map((stock) => (
                        <div key={stock.ticker} className="list-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Link href={`/market/${stock.ticker}`} className="list-item-ticker">
                              {stock.ticker.replace('.JK', '')}
                            </Link>
                            <span className="badge-sector">{stock.sector}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span className={`sentiment-badge ${stock.sentiment?.toLowerCase() || 'netral'}`}>
                              {stock.sentiment || 'Netral'}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>
                              AI: {stock.ai_score_percent}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            /* 2. Analisis Sektoral Tab */
            <div>
              {/* === MOBILE: horizontal pills scroll === */}
              <div className="sector-pills-mobile" style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  paddingBottom: 8,
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch' as any
                }}>
                  {validSectors.map((s) => (
                    <button
                      key={s.sector}
                      onClick={() => setActiveSector(s.sector)}
                      style={{
                        flexShrink: 0,
                        padding: '8px 14px',
                        borderRadius: 20,
                        border: '1px solid',
                        borderColor: activeSector === s.sector ? 'var(--accent)' : 'var(--border)',
                        background: activeSector === s.sector ? 'var(--accent-glow)' : 'transparent',
                        color: activeSector === s.sector ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s'
                      }}
                    >
                      {s.sector}
                    </button>
                  ))}
                </div>
              </div>

              {/* === DESKTOP: two-column layout === */}
              <div className="dashboard-sector-grid">
                {/* LEFT: Sector list sidebar */}
                <div className="sector-list-col" style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>Daftar Sektor BEI</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>Pilih sektor untuk analisis emiten teratas</p>
                  <div className="sector-list-inner" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {validSectors.map((s) => (
                      <button
                        key={s.sector}
                        onClick={() => setActiveSector(s.sector)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: activeSector === s.sector ? 'var(--accent-glow)' : 'transparent',
                          border: '1px solid',
                          borderColor: activeSector === s.sector ? 'var(--accent)' : 'transparent',
                          borderRadius: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { if (activeSector !== s.sector) e.currentTarget.style.background = 'var(--border)' }}
                        onMouseOut={(e) => { if (activeSector !== s.sector) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: activeSector === s.sector ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {s.sector}
                        </span>
                        <span className={`sentiment-badge ${s.sentiment.toLowerCase()}`} style={{ fontSize: 9 }}>
                          {s.sentiment}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* RIGHT: Detail panel (desktop only shows here; mobile shows below pills above) */}
                <div className="sector-detail-right">
                  {(() => {
                    const s = validSectors.find(sec => sec.sector === activeSector)
                    if (!s) return (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
                        Pilih sektor dari daftar di kiri untuk melihat detail dan emiten terbaik.
                      </div>
                    )
                    return (
                      <div className="sector-detail-panel" style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 20,
                        padding: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Detail Analisis Sektor</span>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, wordBreak: 'break-word' }}>
                              Sektor {s.sector}
                            </h2>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                              {s.total_stocks} emiten aktif terlacak
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <span className={`sentiment-badge ${s.sentiment.toLowerCase()}`} style={{ fontSize: 11, padding: '4px 10px' }}>
                              {s.sentiment}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                              Avg: {s.avg_ai_score_percent}
                            </span>
                          </div>
                        </div>

                        <div style={{ height: 1, background: 'var(--border)' }} />

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
                            3 Emiten Teratas — Momentum AI Tertinggi
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                            {s.top_movers && s.top_movers.length > 0 ? (
                              s.top_movers.map((m) => (
                                <div key={m.ticker} style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12,
                                  padding: 16,
                                  background: 'var(--bg-primary)',
                                  borderRadius: 14,
                                  border: '1px solid var(--border)',
                                  transition: 'transform 0.2s, border-color 0.2s'
                                }}
                                className="sector-card-hover"
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Link href={`/market/${m.ticker}`} style={{
                                      fontWeight: 800,
                                      fontSize: 17,
                                      color: 'var(--text-primary)',
                                      textDecoration: 'none'
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                                    onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                                    >
                                      {m.ticker.replace('.JK', '')}
                                    </Link>
                                    <span className="badge-sector" style={{ fontSize: 9 }}>{s.sector}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>AI Score</span>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue)' }}>{m.ai_score_percent}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak ada emiten aktif di sektor ini</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

          )}

          <DisclaimerFooter />
        </div>
      </main>
    </div>
  )
}
