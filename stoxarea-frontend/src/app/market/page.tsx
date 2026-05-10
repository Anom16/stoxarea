'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface StockRow {
  ticker: string
  sector: string
  ai_score_percent: string
  match_score_percent: string
  sentiment: string
  sparkline?: number[]
  current_price?: number
  name?: string
}

interface SectorRow {
  sector: string
  total_stocks: number
}

export default function MarketExplorer() {
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [sectors, setSectors] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockRow; direction: 'asc' | 'desc' }>({ key: 'ai_score_percent', direction: 'desc' })
  const [visibleCount, setVisibleCount] = useState(15)

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
        const token = localStorage.getItem('access_token')
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        
        // Ambil momentum stocks (SPK 2) secara netral untuk scanner pasar
        const [stocksRes, sectorsRes] = await Promise.all([
          api.get('/market/momentum'),
          api.get('/market/sectors')
        ])
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
      const matchesSearch = s.ticker.toLowerCase().includes(search.toLowerCase())
      const matchesSector = selectedSector ? s.sector === selectedSector : true
      return matchesSearch && matchesSector
    })
    .sort((a, b) => {
      let aVal: any = a[sortConfig.key] ?? ''
      let bVal: any = b[sortConfig.key] ?? ''
      
      // Jika sorting berdasarkan AI Score, bersihkan tanda % agar jadi angka asli
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
          {/* 1. Fitur Cari Saham (Paling Atas) */}
          <div className="card mb-24" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-glow)' }}>
            <h2 className="section-title mb-16" style={{ fontSize: 20 }}>Cari Saham & Analisis AI</h2>
            <div className="search-box" style={{ width: '100%', padding: '12px 18px', background: 'var(--bg-primary)' }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <input 
                placeholder="Masukkan Ticker Saham (Contoh: BBCA, ASII, ADRO)..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 16 }}
              />
            </div>
            <p className="fs-12 text-muted mt-8" style={{ marginTop: 12 }}>
              Menampilkan {sortedAndFilteredStocks.length} saham yang terpantau aktif oleh radar StoxArea.
            </p>
          </div>

          {/* 2. Daftar Saham Lengkap */}
          <div className="card mb-24">
            <div className="flex-between mb-16">
              <h3 className="section-title" style={{ fontSize: 18 }}>Daftar Saham</h3>
              <div className="sentiment-badge bullish">SPK Lapis 2 & 3 Aktif</div>
            </div>
            
            {loading ? (
              <div className="skeleton" style={{ height: 400, width: '100%' }}></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ranking-table">
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
                            <div className="fw-700 text-primary" style={{ fontSize: 16 }}>{s.ticker.replace('.JK', '')}</div>
                          </Link>
                        </td>
                        <td className="text-secondary fs-13">{s.sector}</td>
                        <td>
                          <div className="ai-bar-wrap">
                            <div className="ai-bar-track" style={{ width: 80 }}>
                              <div className="ai-bar-fill" style={{ width: s.ai_score_percent, background: 'var(--blue)' }} />
                            </div>
                            <span className="fw-700 text-blue">{s.ai_score_percent}</span>
                          </div>
                        </td>
                        <td className="fw-700 text-accent">
                          Rp {s.current_price?.toLocaleString() || '0'}
                        </td>
                        <td>
                          <div style={{ width: 100, height: 35 }}>
                            {s.sparkline && s.sparkline.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={s.sparkline.map((v, i) => ({ v }))}>
                                  <defs>
                                    <linearGradient id={`grad-${s.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor={s.sentiment === 'Bullish' ? '#10b981' : '#ef4444'} stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor={s.sentiment === 'Bullish' ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <Area 
                                    type="monotone" 
                                    dataKey="v" 
                                    stroke={s.sentiment === 'Bullish' ? '#10b981' : '#ef4444'} 
                                    fillOpacity={1} 
                                    fill={`url(#grad-${s.ticker})`} 
                                    strokeWidth={1.5}
                                    dot={false} 
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="text-muted fs-10">No Data</div>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link href={`/market/${s.ticker}`} className="btn-outline" style={{ padding: '6px 14px', textDecoration: 'none', fontSize: 12 }}>
                            Detail Analisis
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {visibleCount < sortedAndFilteredStocks.length && (
              <div className="flex-center mt-24">
                <button 
                  className="btn-outline" 
                  onClick={() => setVisibleCount(prev => prev + 15)}
                  style={{ width: '100%', padding: '12px', borderStyle: 'dashed' }}
                >
                  Lihat 15 Saham Lagi... ({sortedAndFilteredStocks.length - visibleCount} sisa)
                </button>
              </div>
            )}
          </div>

          {/* 3. Pilihan Sektor (Bawah) */}
          <h3 className="section-title mb-16" style={{ fontSize: 16 }}>Navigasi Sektoral (Radar Sektor)</h3>
          <div className="sector-grid">
            <div 
              className={`sector-card ${selectedSector === '' ? 'active' : ''}`}
              onClick={() => setSelectedSector('')}
              style={{ border: selectedSector === '' ? '1px solid var(--accent)' : '1px solid var(--border)' }}
            >
              <div className="sector-name">Semua Sektor</div>
              <div className="sector-count">61 Saham</div>
            </div>
            {sectors.filter(s => s.total_stocks > 0).map(s => (
              <div 
                key={s.sector} 
                className={`sector-card ${selectedSector === s.sector ? 'active' : ''}`}
                onClick={() => setSelectedSector(s.sector)}
                style={{ border: selectedSector === s.sector ? '1px solid var(--accent)' : '1px solid var(--border)' }}
              >
                <div className="sector-name">{s.sector}</div>
                <div className="sector-count">{s.total_stocks} Saham</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
