'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import StockComparison, { StockMetricData } from '@/components/ui/StockComparison'
import TransactionModal from '@/components/ui/Modal'
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
  const [visibleCount, setVisibleCount] = useState(30)

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

  const requestSort = (key: keyof StockRow) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [stocksRes, sectorsRes, recsRes] = await Promise.allSettled([
          api.get('/market/momentum'),
          api.get('/market/sectors'),
          api.get('/recommendation/top-picks').catch(() => ({ data: [] }))
        ])

        let stockList: StockRow[] = []
        if (stocksRes.status === 'fulfilled' && Array.isArray(stocksRes.value.data)) {
          stockList = stocksRes.value.data
        }

        // Merge metrics (roe, der, pbv, per) from recommendations if available
        if (recsRes.status === 'fulfilled' && Array.isArray(recsRes.value.data)) {
          const recsMap = new Map(recsRes.value.data.map((r: any) => [r.ticker.replace('.JK', ''), r]))
          stockList = stockList.map(s => {
            const cleanT = s.ticker.replace('.JK', '')
            const matched = recsMap.get(cleanT)
            if (matched) {
              return {
                ...s,
                roe: matched.roe,
                der: matched.der,
                pbv: matched.pbv,
                per: matched.per,
              }
            }
            return s
          })
        }

        setStocks(stockList)

        if (sectorsRes.status === 'fulfilled' && Array.isArray(sectorsRes.value.data)) {
          setSectors(sectorsRes.value.data)
        }
      } catch (err) {
        console.error('Failed to fetch market data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filtered stocks for "Semua Saham" tab
  const sortedAndFilteredStocks = useMemo(() => {
    return stocks
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
      const payload = {
        ticker: tradeTicker,
        action,
        lot_qty: lotQty,
      }
      const res = await api.post('/portfolio/trade', payload)
      toast.success(
        `Transaksi ${action === 'BUY' ? 'Pembelian' : 'Penjualan'} Berhasil! 🎉`,
        res.data.message || `${lotQty} Lot ${tradeTicker} berhasil diproses.`,
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
          
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Jelajah Pasar & Terminal Riset</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
              Terminal riset pasar terpadu: Eksplorasi Sektoral, Daftar Pantau Watchlist, & Komparasi Saham Head-to-Head.
            </p>
          </div>

          {/* Integrated Top Workspace Tab Bar */}
          <div style={{
            display: 'flex',
            gap: 8,
            borderBottom: '2px solid var(--border)',
            marginBottom: 24,
            paddingBottom: 0,
            overflowX: 'auto'
          }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'all' ? '3px solid var(--accent)' : '3px solid transparent',
                fontWeight: 800,
                fontSize: 14,
                color: activeTab === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                marginBottom: -2,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              🌐 Semua Saham ({stocks.length})
            </button>

            <button
              onClick={() => setActiveTab('watchlist')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'watchlist' ? '3px solid #f59e0b' : '3px solid transparent',
                fontWeight: 800,
                fontSize: 14,
                color: activeTab === 'watchlist' ? '#f59e0b' : 'var(--text-secondary)',
                cursor: 'pointer',
                marginBottom: -2,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              ⭐ Watchlist Saya ({watchlist.length})
            </button>

            <button
              onClick={() => setActiveTab('compare')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'compare' ? '3px solid #3b82f6' : '3px solid transparent',
                fontWeight: 800,
                fontSize: 14,
                color: activeTab === 'compare' ? '#3b82f6' : 'var(--text-secondary)',
                cursor: 'pointer',
                marginBottom: -2,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              ⚔️ Komparasi Saham
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
                  Semua Sektor ({stocks.length})
                </button>
                {sectors.filter(s => s.total_stocks > 0).map(s => (
                  <button 
                    key={s.sector} 
                    className={`pill-btn ${selectedSector === s.sector ? 'active' : ''}`}
                    onClick={() => { setSelectedSector(s.sector); setVisibleCount(30); }}
                  >
                    {s.sector} ({s.total_stocks})
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
                  {/* Desktop Table View */}
                  <div className="market-table-desktop" style={{ overflowX: 'auto', marginTop: 16 }}>
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
                                <Link href={`/market/${s.ticker}`} style={{ textDecoration: 'none' }}>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                    {cleanT}
                                  </div>
                                  {s.name && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.name}</div>
                                  )}
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
                                  {s.sparkline && s.sparkline.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={s.sparkline.map((v) => ({ v }))}>
                                        <defs>
                                          <linearGradient id={`grad-${s.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={s.sentiment === 'Bullish' ? 'var(--accent)' : 'var(--red)'} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={s.sentiment === 'Bullish' ? 'var(--accent)' : 'var(--red)'} stopOpacity={0}/>
                                          </linearGradient>
                                        </defs>
                                        <Area 
                                          type="monotone" 
                                          dataKey="v" 
                                          stroke={s.sentiment === 'Bullish' ? 'var(--accent)' : 'var(--red)'} 
                                          fillOpacity={1} 
                                          fill={`url(#grad-${s.ticker})`} 
                                          strokeWidth={1.5}
                                          dot={false} 
                                        />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  ) : (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>No Data</div>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => handleOpenTradeModal(s.ticker, s.current_price || 0)}
                                    style={{
                                      background: 'var(--accent)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Beli
                                  </button>
                                  <Link href={`/market/${s.ticker}`} className="btn-outline" style={{ padding: '6px 12px', fontSize: 12 }}>
                                    Detail
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile List View */}
                  <div className="market-card-mobile" style={{ marginTop: 16 }}>
                    {sortedAndFilteredStocks.slice(0, visibleCount).map((s) => {
                      const cleanT = s.ticker.replace('.JK', '')
                      const inWatch = isWatchlisted(cleanT)

                      return (
                        <div key={s.ticker} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <button
                                onClick={() => toggleWatchlist(cleanT)}
                                style={{ background: 'none', border: 'none', fontSize: 20, color: inWatch ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer' }}
                              >
                                {inWatch ? '⭐' : '☆'}
                              </button>
                              <div>
                                <Link href={`/market/${s.ticker}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {cleanT}
                                  </div>
                                  {s.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.name}</div>}
                                </Link>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                Rp {s.current_price?.toLocaleString('id-ID') || '0'}
                              </div>
                              <button
                                onClick={() => handleOpenTradeModal(s.ticker, s.current_price || 0)}
                                style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700, marginTop: 4, cursor: 'pointer' }}
                              >
                                Beli
                              </button>
                            </div>
                          </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Dipantau Saat Ini
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                    ⭐ {watchlist.length} Saham
                  </div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Sentimen Bullish
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                    🟢 {watchlistedStocks.filter(s => s.sentiment === 'Bullish').length} Emiten
                  </div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Rata-Rata AI Score
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                    {watchlistedStocks.length > 0
                      ? `${(watchlistedStocks.reduce((acc, curr) => acc + parseFloat(curr.ai_score_percent || '0'), 0) / watchlistedStocks.length).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
              </div>

              {watchlistedStocks.length === 0 ? (
                <div className="empty-state" style={{ background: 'var(--bg-card)', padding: 48, borderRadius: 16, border: '1px dashed var(--border)' }}>
                  <div className="empty-icon" style={{ fontSize: 48 }}>⭐</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginTop: 12 }}>Watchlist Anda Masih Kosong</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 400, margin: '8px auto 20px' }}>
                    Klik ikon bintang (⭐) pada saham mana saja di tab <strong>Semua Saham</strong> untuk memantaunya di sini.
                  </p>
                  <button
                    onClick={() => setActiveTab('all')}
                    className="btn-primary"
                    style={{ padding: '10px 20px', fontSize: 13 }}
                  >
                    🔍 Jelajah Saham Sekarang
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {watchlistedStocks.map(s => {
                    const cleanT = s.ticker.replace('.JK', '')
                    const noteText = notes[cleanT] || ''
                    const isEditingThisNote = editingNoteTicker === cleanT

                    return (
                      <div key={s.ticker} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          {/* Card Top */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{cleanT}</span>
                                <span className="badge-sector" style={{ fontSize: 10 }}>{s.sector}</span>
                              </div>
                              {s.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.name}</div>}
                            </div>
                            <button
                              onClick={() => toggleWatchlist(cleanT)}
                              style={{ background: 'none', border: 'none', fontSize: 20, color: '#f59e0b', cursor: 'pointer' }}
                              title="Hapus dari Watchlist"
                            >
                              ⭐
                            </button>
                          </div>

                          {/* Price & AI Score */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Harga Saat Ini</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                                Rp {s.current_price?.toLocaleString('id-ID') || '—'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI Score</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)', marginTop: 2 }}>
                                {s.ai_score_percent}
                              </div>
                            </div>
                          </div>

                          {/* Personal Notes Section */}
                          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>📝 Catatan Pribadi</span>
                              {!isEditingThisNote && (
                                <button
                                  onClick={() => { setEditingNoteTicker(cleanT); setNoteInputText(noteText); }}
                                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
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
                                  placeholder="Tulis catatan target beli/jual untuk saham ini..."
                                  rows={2}
                                  style={{
                                    width: '100%',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 6,
                                    padding: 8,
                                    fontSize: 12,
                                    outline: 'none',
                                    resize: 'none',
                                    boxSizing: 'border-box',
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                                  <button
                                    onClick={() => setEditingNoteTicker(null)}
                                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    onClick={() => { saveNote(cleanT, noteInputText); setEditingNoteTicker(null); }}
                                    style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    Simpan
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: 12, color: noteText ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: noteText ? 'normal' : 'italic', margin: 0 }}>
                                {noteText || 'Belum ada catatan. Klik + Tambah untuk menulis target Anda.'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                          <button
                            onClick={() => handleOpenTradeModal(s.ticker, s.current_price || 0)}
                            style={{ flex: 1, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          >
                            🛒 Beli Virtual Trading
                          </button>
                          <Link
                            href={`/market/${s.ticker}`}
                            className="btn-outline"
                            style={{ padding: '10px 14px', fontSize: 13, textDecoration: 'none', textAlign: 'center' }}
                          >
                            Detail
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
