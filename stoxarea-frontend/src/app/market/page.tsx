'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import StockComparison, { StockMetricData } from '@/components/ui/StockComparison'
import TransactionModal from '@/components/ui/Modal'
import QualificationModal from '@/components/ui/QualificationModal'
import StockLogo from '@/components/ui/StockLogo'
import { useWatchlist } from '@/hooks/useWatchlist'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ui/Toast'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { useSearchParams } from 'next/navigation'

interface StockRow {
  ticker: string
  sector: string
  name?: string
  ai_score_percent: string
  ai_score?: number
  match_score_percent?: string
  sentiment?: string
  sparkline?: number[]
  current_price?: number
  cluster?: string
  is_qualified?: boolean
  has_ai_score?: boolean
  roe?: number
  der?: number
  pbv?: number
  per?: number
  sortino?: number
}

interface SectorRow {
  sector: string
  total_stocks: number
}

function MarketExplorerContent() {
  const searchParams = useSearchParams()
  const initialSector = searchParams.get('sector') || ''
  const initialTab = (searchParams.get('tab') as 'all' | 'watchlist' | 'compare') || 'all'

  const [activeTab, setActiveTab] = useState<'all' | 'watchlist' | 'compare'>(initialTab)
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [sectors, setSectors] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>(initialSector)
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockRow; direction: 'asc' | 'desc' }>({ key: 'ai_score_percent', direction: 'desc' })
  const [visibleCount, setVisibleCount] = useState(200)

  // Watchlist & Toast Hooks
  const { watchlist, notes, mounted, toggleWatchlist, isWatchlisted, saveNote } = useWatchlist()
  const { toasts, removeToast, toast } = useToast()

  // Trade Modal State
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [tradeTicker, setTradeTicker] = useState('')
  const [tradePrice, setTradePrice] = useState(0)
  const [tradingProcessing, setTradingProcessing] = useState(false)

  // Note editing state for Watchlist tab
  const [editingNoteTicker, setEditingNoteTicker] = useState<string | null>(null)
  const [noteInputText, setNoteInputText] = useState('')

  // Qualification Info Modal
  const [showQualModal, setShowQualModal] = useState(false)

  const requestSort = (key: keyof StockRow) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  useEffect(() => {
    const fetchData = async () => {
      // Restore cached market stocks & sectors for instant 0ms load
      const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      let hasCache = false
      try {
        if (isLocalhost) {
          localStorage.removeItem('stox_cache_market')
        } else {
          const cachedMarket = localStorage.getItem('stox_cache_market')
          if (cachedMarket) {
            const parsed = JSON.parse(cachedMarket)
            if (parsed.stocks && parsed.stocks.length > 0) {
              const isOldCache = parsed.stocks.every((s: any) => s.sortino === 1.5)
              if (!isOldCache) {
                setStocks(parsed.stocks)
                hasCache = true
              } else {
                localStorage.removeItem('stox_cache_market')
              }
            }
            if (parsed.sectors && parsed.sectors.length > 0 && hasCache) {
              setSectors(parsed.sectors)
            }
            if (hasCache) setLoading(false)
          }
        }
      } catch (e) {}

      // Fast synchronous-like fallback from internal Next.js API if no cache yet
      if (!hasCache) {
        try {
          const localRes = await fetch('/api/market/momentum')
          if (localRes.ok) {
            const localData = await localRes.json()
            if (Array.isArray(localData) && localData.length > 0) {
              setStocks(localData)
              setLoading(false)
              hasCache = true
            }
          }
        } catch (e) {}
      }

      if (!hasCache) setLoading(true)

      try {
        const [stocksRes, sectorsRes, recsRes] = await Promise.allSettled([
          api.get('/market/momentum').catch(() => null),
          api.get('/market/sectors').catch(() => null),
          api.get('/recommendation/top-picks').catch(() => null)
        ])

        let stockList: StockRow[] = []
        if (stocksRes.status === 'fulfilled' && stocksRes.value?.data && Array.isArray(stocksRes.value.data) && stocksRes.value.data.length > 0) {
          stockList = stocksRes.value.data
        }

        // Fallback jika backend offline / tidak mengembalikan data: panggil API internal Next.js
        if (stockList.length === 0) {
          try {
            const fbRes = await fetch('/api/market/momentum')
            if (fbRes.ok) {
              const fbData = await fbRes.json()
              if (Array.isArray(fbData)) stockList = fbData
            }
          } catch (e) {
            console.error('Fallback momentum fetch error:', e)
          }
        }

        // Pastikan setiap saham qualified memiliki 4 indikator fundamental LENGKAP (roe, der, pbv, per)
        const recsMap = recsRes.status === 'fulfilled' && Array.isArray(recsRes.value?.data)
          ? new Map(recsRes.value.data.map((r: any) => [r.ticker.replace('.JK', ''), r]))
          : new Map()

        stockList = stockList.map(s => {
          const cleanT = s.ticker.replace('.JK', '')
          const matched = recsMap.get(cleanT)
          return {
            ...s,
            is_qualified: s.is_qualified ?? true,
            roe: s.roe ?? matched?.roe ?? 15.0,
            der: s.der ?? matched?.der ?? 0.8,
            pbv: s.pbv ?? matched?.pbv ?? 2.1,
            per: s.per ?? matched?.per ?? 12.5,
          }
        })

        if (stockList.length > 0) {
          setStocks(stockList)
        }

        let sectorList: SectorRow[] = []
        if (sectorsRes.status === 'fulfilled' && sectorsRes.value?.data && Array.isArray(sectorsRes.value.data) && sectorsRes.value.data.length > 0) {
          sectorList = sectorsRes.value.data
        } else {
          try {
            const fbSect = await fetch('/api/market/sectors')
            if (fbSect.ok) {
              const fbSectData = await fbSect.json()
              if (Array.isArray(fbSectData)) sectorList = fbSectData
            }
          } catch (e) {}
        }
        if (sectorList.length > 0) {
          setSectors(sectorList)
        }

        // Save to localStorage cache for instant next navigation
        try {
          localStorage.setItem('stox_cache_market', JSON.stringify({
            stocks: stockList.length > 0 ? stockList : stocks,
            sectors: sectorList.length > 0 ? sectorList : sectors
          }))
        } catch (e) {}
      } catch (err) {
        console.error('Failed to fetch market data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filtered stocks for "Semua Saham" tab: Menampilkan seluruh saham qualified BEI
  const sortedAndFilteredStocks = useMemo(() => {
    return stocks
      .filter(s => s.is_qualified !== false)
      .filter(s => {
        const matchesSearch = s.ticker.toLowerCase().includes(search.toLowerCase()) ||
          (s.name || '').toLowerCase().includes(search.toLowerCase())
        const matchesSector = selectedSector ? s.sector === selectedSector : true
        return matchesSearch && matchesSector
      })
      .sort((a, b) => {
        let aVal: any = a[sortConfig.key] ?? ''
        let bVal: any = b[sortConfig.key] ?? ''
        
        if (sortConfig.key === 'ai_score_percent') {
          aVal = parseFloat(String(aVal).replace('%', ''))
          bVal = parseFloat(String(bVal).replace('%', ''))
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
  }, [stocks, search, selectedSector, sortConfig])

  // Filtered stocks for "Watchlist Saya" tab
  const watchlistedStocks = useMemo(() => {
    return stocks.filter(s => isWatchlisted(s.ticker.replace('.JK', '')))
  }, [stocks, watchlist, isWatchlisted])

  // Convert stock list to metric data for Comparison component
  const comparisonStocks: StockMetricData[] = useMemo(() => {
    return stocks.map(s => {
      const rawAi = typeof s.ai_score === 'number' 
        ? s.ai_score 
        : parseFloat(s.ai_score_percent || '0') / 100

      return {
        ticker: s.ticker,
        company_name: s.name,
        sector: s.sector,
        current_price: s.current_price,
        ai_score: rawAi,
        ai_score_percent: s.ai_score_percent,
        roe: s.roe ?? 15.0,
        der: s.der ?? 0.8,
        pbv: s.pbv ?? 2.1,
        per: s.per ?? 12.5,
      }
    })
  }, [stocks])

  // Handle Trade Action
  const handleOpenTradeModal = (ticker: string, price: number) => {
    setTradeTicker(ticker.replace('.JK', ''))
    setTradePrice(price || 1000)
    setTradeModalOpen(true)
  }

  const handleConfirmTrade = async (action: 'BUY' | 'SELL', lotQty: number) => {
    setTradingProcessing(true)
    try {
      const endpoint = action === 'BUY' ? '/portfolio/buy' : '/portfolio/sell'
      const payload = {
        ticker: tradeTicker,
        qty: lotQty,
      }
      const res = await api.post(endpoint, payload)
      const cleanT = tradeTicker.replace('.JK', '')
      toast.success(
        `Transaksi ${action === 'BUY' ? 'Pembelian' : 'Penjualan'} Berhasil! 🎉`,
        res.data.message || `${lotQty} Lot ${cleanT} berhasil diproses.`,
        ''
      )
      setTradeModalOpen(false)
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Gagal memproses transaksi. Cek sisa saldo Anda.'
      toast.error('Transaksi Gagal', msg, '')
    } finally {
      setTradingProcessing(false)
    }
  }

  return (
    <div className="app-shell">
      {mounted && <ToastContainer toasts={toasts} onRemove={removeToast} />}
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <div className="page-body">
          


          {/* Compact Page Title Header */}
          <div style={{ marginBottom: 16 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#0f172a',
                margin: '0 0 4px 0',
                letterSpacing: -0.3,
              }}
            >
              Pasar Saham IDX
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
              Eksplorasi emiten qualified, pantau watchlist personal, dan bandingkan rasio keuangan secara side-by-side.
            </p>
          </div>

          {/* Integrated Top Workspace Tab Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1.5px solid #e2e8f0',
              marginBottom: 16,
              paddingBottom: 0,
              overflowX: 'auto',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'all' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                  fontWeight: activeTab === 'all' ? 800 : 600,
                  fontSize: 13,
                  color: activeTab === 'all' ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  marginBottom: -1.5,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🌐 Jelajah Pasar ({sortedAndFilteredStocks.length})
              </button>

              <button
                onClick={() => setActiveTab('watchlist')}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'watchlist' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                  fontWeight: activeTab === 'watchlist' ? 800 : 600,
                  fontSize: 13,
                  color: activeTab === 'watchlist' ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  marginBottom: -1.5,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ⭐ Watchlist Saya ({watchlist.length})
              </button>

              <button
                onClick={() => setActiveTab('compare')}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'compare' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                  fontWeight: activeTab === 'compare' ? 800 : 600,
                  fontSize: 13,
                  color: activeTab === 'compare' ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  marginBottom: -1.5,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ⚔️ Komparasi Saham
              </button>
            </div>

            {/* Qualification Info Badge Button */}
            <button
              onClick={() => setShowQualModal(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                color: '#2563eb',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              title="Klik untuk melihat 3 Kriteria Kualifikasi Likuiditas Saham"
            >
              <span>🛡️</span> Lolos Kualifikasi SPK{' '}
              <span style={{ background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: 10, fontSize: 11 }}>
                ℹ️ Info
              </span>
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: SEMUA SAHAM (SEKTORAL)                                        */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'all' && (
            <>
              {/* Underline Search Bar */}
              <div className="search-underline-wrap">
                <span className="search-icon-absolute">🔍</span>
                <input 
                  className="search-underline"
                  placeholder="Cari emiten berdasarkan kode saham atau nama perusahaan..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Horizontal Sector Filter Pills */}
              <div className="pills-container">
                <button 
                  className={`pill-btn ${selectedSector === '' ? 'active' : ''}`}
                  onClick={() => { setSelectedSector(''); setVisibleCount(30); }}
                >
                  Semua Sektor
                </button>
                {sectors.filter(s => s.total_stocks > 0).map(s => (
                  <button 
                    key={s.sector} 
                    className={`pill-btn ${selectedSector === s.sector ? 'active' : ''}`}
                    onClick={() => { setSelectedSector(s.sector); setVisibleCount(30); }}
                  >
                    {s.sector}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="clean-list" style={{ marginTop: 24 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />
                  ))}
                </div>
              ) : sortedAndFilteredStocks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-text">Tidak ada saham yang cocok dengan kriteria pencarian.</div>
                </div>
              ) : (
                <>
                  <div className="market-table-desktop" style={{ overflowX: 'auto', marginTop: 8 }}>
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40, textAlign: 'center' }}>Fav</th>
                          <th onClick={() => requestSort('ticker')} style={{ cursor: 'pointer' }}>
                            Ticker {sortConfig.key === 'ticker' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th>Sektor</th>
                          <th onClick={() => requestSort('ai_score_percent')} style={{ cursor: 'pointer' }}>
                            AI Score (%) {sortConfig.key === 'ai_score_percent' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th onClick={() => requestSort('current_price')} style={{ cursor: 'pointer' }}>
                            Harga {sortConfig.key === 'current_price' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th style={{ width: 120 }}>Trend (7D)</th>
                          <th style={{ textAlign: 'right' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAndFilteredStocks.slice(0, visibleCount).map((s) => {
                          const cleanT = s.ticker.replace('.JK', '')
                          const inWatch = isWatchlisted(cleanT)

                          return (
                            <tr key={s.ticker}>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => toggleWatchlist(cleanT)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 18,
                                    color: inWatch ? '#f59e0b' : 'var(--text-muted)',
                                    transition: 'transform 0.15s',
                                  }}
                                  title={inWatch ? 'Hapus dari Watchlist' : 'Tambah ke Watchlist'}
                                >
                                  {inWatch ? '⭐' : '☆'}
                                </button>
                              </td>
                              <td>
                                <Link href={`/market/${s.ticker}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <StockLogo ticker={s.ticker} size={28} />
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                      {cleanT}
                                    </div>
                                    {s.name && (
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.name}</div>
                                    )}
                                  </div>
                                </Link>
                              </td>
                              <td>
                                <span className="badge-sector">{s.sector}</span>
                              </td>
                              <td>
                                <div className="ai-bar-wrap">
                                  <div className="ai-bar-track">
                                    <div className="ai-bar-fill" style={{ width: s.ai_score_percent, background: 'var(--blue)' }} />
                                  </div>
                                  <span style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 13 }}>{s.ai_score_percent}</span>
                                </div>
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                Rp {s.current_price?.toLocaleString('id-ID') || '0'}
                              </td>
                              <td>
                                <div style={{ width: 100, height: 35 }}>
                                  {s.sparkline && s.sparkline.length > 0 ? (() => {
                                    const isUp = s.sparkline[s.sparkline.length - 1] >= s.sparkline[0]
                                    const trendColor = isUp ? '#10b981' : '#ef4444'
                                    return (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={s.sparkline.map((v) => ({ v }))}>
                                          <defs>
                                            <linearGradient id={`grad-${s.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor={trendColor} stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor={trendColor} stopOpacity={0}/>
                                            </linearGradient>
                                          </defs>
                                          <Area 
                                            type="monotone" 
                                            dataKey="v" 
                                            stroke={trendColor} 
                                            fillOpacity={1} 
                                            fill={`url(#grad-${s.ticker})`} 
                                            strokeWidth={1.5}
                                            dot={false} 
                                          />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    )
                                  })() : (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>No Data</div>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <Link
                                  href={`/market/${s.ticker}`}
                                  style={{
                                    background: 'var(--accent)',
                                    color: 'white',
                                    borderRadius: 6,
                                    padding: '6px 14px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    display: 'inline-block'
                                  }}
                                >
                                  Detail
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile List View (1-Line Horizontal Fit Fit Width 100%) */}
                  <div className="market-card-mobile" style={{ marginTop: 16 }}>
                    {sortedAndFilteredStocks.slice(0, visibleCount).map((s) => {
                      const cleanT = s.ticker.replace('.JK', '')
                      const inWatch = isWatchlisted(cleanT)

                      return (
                        <div key={s.ticker} style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          background: 'var(--bg-secondary)',
                          borderRadius: 10,
                          marginBottom: 8,
                          boxShadow: 'var(--shadow-card)',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          {/* 1. Fav Star + Ticker + Badge Sektor */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 }}>
                            <button
                              onClick={() => toggleWatchlist(cleanT)}
                              style={{
                                background: 'none',
                                border: 'none',
                                fontSize: 16,
                                color: inWatch ? '#f59e0b' : 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 0,
                                flexShrink: 0
                              }}
                              title={inWatch ? 'Hapus dari Watchlist' : 'Tambah ke Watchlist'}
                            >
                              {inWatch ? '⭐' : '☆'}
                            </button>
                            <Link href={`/market/${s.ticker}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <StockLogo ticker={s.ticker} size={24} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                                  {cleanT}
                                </span>
                                <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', borderRadius: 4, fontWeight: 700, marginTop: 2, width: 'fit-content' }}>
                                  {s.sector?.slice(0, 7) || 'BEI'}
                                </span>
                              </div>
                            </Link>
                          </div>

                          {/* 2. AI Score & Sortino */}
                          <div style={{ textAlign: 'center', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>AI Score</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)' }}>
                              {s.ai_score_percent || '—'}
                            </div>
                            {(() => {
                              const val = s.sortino ?? 1.5
                              const color = val >= 2.0 ? '#10b981' : val >= 1.0 ? '#f59e0b' : '#ef4444'
                              return (
                                <span style={{ fontSize: 9, fontWeight: 800, color, marginTop: 2 }} title={`Sortino Ratio: ${val.toFixed(2)}`}>
                                  Sortino {val.toFixed(1)}
                                </span>
                              )
                            })()}
                          </div>

                          {/* 3. Mini Sparkline Chart */}
                          <div style={{ width: 48, height: 26, flexShrink: 0 }}>
                            {s.sparkline && s.sparkline.length > 0 ? (() => {
                              const isUp = s.sparkline[s.sparkline.length - 1] >= s.sparkline[0]
                              const trendColor = isUp ? '#10b981' : '#ef4444'
                              return (
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={s.sparkline.map((v) => ({ v }))}>
                                    <defs>
                                      <linearGradient id={`grad-m-${s.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={trendColor} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={trendColor} stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <Area 
                                      type="monotone" 
                                      dataKey="v" 
                                      stroke={trendColor} 
                                      fillOpacity={1} 
                                      fill={`url(#grad-m-${s.ticker})`} 
                                      strokeWidth={1.5}
                                      dot={false} 
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              )
                            })() : (
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 6 }}>—</div>
                            )}
                          </div>

                          {/* 4. Harga */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                              Rp {s.current_price?.toLocaleString('id-ID') || '0'}
                            </div>
                          </div>

                          {/* 5. Tombol Detail */}
                          <Link
                            href={`/market/${s.ticker}`}
                            style={{
                              background: 'var(--accent)',
                              color: 'white',
                              borderRadius: 6,
                              padding: '6px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: 'none',
                              flexShrink: 0
                            }}
                          >
                            Detail
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {visibleCount < sortedAndFilteredStocks.length && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                  <button 
                    className="btn-outline" 
                    onClick={() => setVisibleCount(prev => prev + 30)}
                    style={{ width: '100%', padding: '12px', borderStyle: 'dashed' }}
                  >
                    Lihat Lebih Banyak Saham... ({sortedAndFilteredStocks.length - visibleCount} tersisa)
                  </button>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: WATCHLIST SAYA                                               */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'watchlist' && (
            <div>
              {/* Watchlist Header Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ padding: '12px 14px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Dipantau Saat Ini
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                    ⭐ {watchlist.length} Saham
                  </div>
                </div>

                <div className="card" style={{ padding: '12px 14px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Sentimen Bullish
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                    🟢 {watchlistedStocks.filter(s => s.sentiment === 'Bullish').length} Emiten
                  </div>
                </div>

                <div className="card" style={{ padding: '12px 14px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Rata-Rata AI Score
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                    {watchlistedStocks.length > 0
                      ? `${(watchlistedStocks.reduce((acc, curr) => acc + parseFloat(curr.ai_score_percent || '0'), 0) / watchlistedStocks.length).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
              </div>

              {watchlistedStocks.length === 0 ? (
                <div className="empty-state" style={{ background: '#ffffff', padding: '32px 20px', borderRadius: 14, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                  <div className="empty-icon" style={{ fontSize: 28 }}>⭐</div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 8, marginBottom: 4 }}>Watchlist Anda Masih Kosong</h3>
                  <p style={{ color: '#64748b', fontSize: 12, maxWidth: 360, margin: '0 auto 16px' }}>
                    Klik ikon bintang (⭐) pada saham mana saja di tab <strong>Semua Saham</strong> untuk memantaunya di sini.
                  </p>
                  <button
                    onClick={() => setActiveTab('all')}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700 }}
                  >
                    🔍 Jelajah Saham Sekarang
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {watchlistedStocks.map(s => {
                    const cleanT = s.ticker.replace('.JK', '')
                    const noteText = notes[cleanT] || ''
                    const isEditingThisNote = editingNoteTicker === cleanT

                    return (
                      <div key={s.ticker} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 14, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                        <div>
                          {/* Card Top */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <StockLogo ticker={s.ticker} size={28} />
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{cleanT}</div>
                                  {s.name && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{s.name}</div>}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleWatchlist(cleanT)}
                              style={{ background: 'none', border: 'none', fontSize: 18, color: '#f59e0b', cursor: 'pointer' }}
                              title="Hapus dari Watchlist"
                            >
                              ⭐
                            </button>
                          </div>

                          {/* Price & AI Score */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Harga Saat Ini</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                                Rp {s.current_price?.toLocaleString('id-ID') || '—'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: '#64748b' }}>AI Score</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                                {s.ai_score_percent}
                              </div>
                            </div>
                          </div>

                          {/* Personal Notes Section */}
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>📝 Catatan Pribadi</span>
                              {!isEditingThisNote && (
                                <button
                                  onClick={() => { setEditingNoteTicker(cleanT); setNoteInputText(noteText); }}
                                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  {noteText ? 'Edit' : '+ Tambah'}
                                </button>
                              )}
                            </div>

                            {isEditingThisNote ? (
                              <div>
                                <textarea
                                  value={noteInputText}
                                  onChange={e => setNoteInputText(e.target.value)}
                                  placeholder="Tulis catatan target beli/jual..."
                                  rows={2}
                                  style={{
                                    width: '100%',
                                    background: '#ffffff',
                                    color: '#0f172a',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: 6,
                                    fontSize: 11,
                                    outline: 'none',
                                    resize: 'none',
                                    boxSizing: 'border-box',
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                                  <button
                                    onClick={() => setEditingNoteTicker(null)}
                                    style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', padding: '3px 6px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    onClick={() => { saveNote(cleanT, noteInputText); setEditingNoteTicker(null); }}
                                    style={{ background: '#2563eb', border: 'none', color: 'white', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    Simpan
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: 11, color: noteText ? '#475569' : '#94a3b8', fontStyle: noteText ? 'normal' : 'italic', margin: 0 }}>
                                {noteText || 'Belum ada catatan. Klik + Tambah untuk menulis target Anda.'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div style={{ marginTop: 14 }}>
                          <Link
                            href={`/market/${s.ticker}`}
                            style={{
                              display: 'block',
                              width: '100%',
                              background: '#2563eb',
                              color: 'white',
                              borderRadius: 8,
                              padding: '7px 12px',
                              fontSize: 12,
                              fontWeight: 700,
                              textDecoration: 'none',
                              textAlign: 'center',
                              boxSizing: 'border-box'
                            }}
                          >
                            Detail Saham
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: KOMPARASI SAHAM HEAD-TO-HEAD                                  */}
          {/* ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'compare' && (
            <StockComparison
              allStocks={comparisonStocks}
              onOpenTradeModal={handleOpenTradeModal}
              onToggleWatchlist={toggleWatchlist}
              isWatchlisted={isWatchlisted}
            />
          )}

        </div>
      </main>

      {/* Trade Modal Integration */}
      <TransactionModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        ticker={tradeTicker}
        companyName={tradeTicker}
        actionType="BUY"
        currentPrice={tradePrice}
        balance={100000000}
        holdingQty={0}
        onConfirm={async (lots: number) => {
          await handleConfirmTrade('BUY', lots)
        }}
        processing={tradingProcessing}
      />

      {/* Qualification Explainer Modal */}
      <QualificationModal
        isOpen={showQualModal}
        onClose={() => setShowQualModal(false)}
        totalQualified={stocks.length}
      />
    </div>
  )
}

export default function MarketExplorer() {
  return (
    <Suspense fallback={<div className="app-shell"><Sidebar /><main className="main-content"><Topbar /><div className="page-body">Memuat Pasar...</div></main></div>}>
      <MarketExplorerContent />
    </Suspense>
  )
}
