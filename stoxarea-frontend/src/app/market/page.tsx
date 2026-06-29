'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
}

interface SectorRow {
  sector: string
  total_stocks: number
}

function MarketExplorerContent() {
  const searchParams = useSearchParams()
  const initialSector = searchParams.get('sector') || ''
  
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [sectors, setSectors] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>(initialSector)
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockRow; direction: 'asc' | 'desc' }>({ key: 'ai_score_percent', direction: 'desc' })
  const [visibleCount, setVisibleCount] = useState(30)

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
        const stocksRes = await api.get('/market/momentum')
        const sectorsRes = await api.get('/market/sectors')
        setStocks(stocksRes.data)
        setSectors(sectorsRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const sortedAndFilteredStocks = stocks
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

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <div className="page-body">
          
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Jelajah Pasar</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Eksplorasi tren dan sentimen kecerdasan buatan (AI Score) emiten IDX
            </p>
          </div>

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
              {/* Desktop Table View (Divider-line based) */}
              <div className="market-table-desktop" style={{ overflowX: 'auto', marginTop: 16 }}>
                <table className="clean-table">
                  <thead>
                    <tr>
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
                    {sortedAndFilteredStocks.slice(0, visibleCount).map((s) => (
                      <tr key={s.ticker}>
                        <td>
                          <Link href={`/market/${s.ticker}`} style={{ textDecoration: 'none' }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                              {s.ticker.replace('.JK', '')}
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
                          <Link href={`/market/${s.ticker}`} className="btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>
                            Detail Analisis
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile List View (Card list redesign using bottom divider lines only) */}
              <div className="market-card-mobile" style={{ marginTop: 16 }}>
                {sortedAndFilteredStocks.slice(0, visibleCount).map((s) => (
                  <Link key={s.ticker} href={`/market/${s.ticker}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {s.ticker.replace('.JK', '')}
                          </div>
                          {s.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.name}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Rp {s.current_price?.toLocaleString('id-ID') || '0'}
                          </div>
                          <span className="badge-sector" style={{ marginTop: 4 }}>{s.sector}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div className="ai-bar-wrap">
                            <div className="ai-bar-track" style={{ flex: 1 }}>
                              <div className="ai-bar-fill" style={{ width: s.ai_score_percent, background: 'var(--blue)' }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', minWidth: 32 }}>{s.ai_score_percent}</span>
                          </div>
                        </div>
                        {s.sentiment && (
                          <span className={`sentiment-badge ${s.sentiment.toLowerCase()}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                            {s.sentiment}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
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

        </div>
      </main>
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
