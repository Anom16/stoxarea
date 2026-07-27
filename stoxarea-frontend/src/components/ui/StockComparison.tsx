'use client'

import { useState, useMemo } from 'react'

export interface StockMetricData {
  ticker: string
  company_name?: string
  sector?: string
  current_price?: number
  ai_score: number
  ai_score_percent?: string
  roe: number
  der: number
  pbv: number
  per: number
}

interface StockComparisonProps {
  allStocks: StockMetricData[]
  onOpenTradeModal?: (ticker: string, price: number) => void
  onToggleWatchlist?: (ticker: string) => void
  isWatchlisted?: (ticker: string) => boolean
}

const COLUMN_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']

export default function StockComparison({
  allStocks,
  onOpenTradeModal,
  onToggleWatchlist,
  isWatchlisted,
}: StockComparisonProps) {
  // Free dynamic tickers array - user can change, add, or remove ANY slot
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['BBCA', 'BMRI', 'BBRI'])

  // Get full metric data for each selected slot
  const selectedStocks = useMemo(() => {
    return selectedTickers.map(t => {
      const clean = t.toUpperCase().replace('.JK', '')
      const found = allStocks.find(s => s.ticker.toUpperCase().replace('.JK', '') === clean)
      return (
        found || {
          ticker: clean,
          company_name: 'Emiten IDX',
          sector: 'Umum',
          current_price: 0,
          ai_score: 0,
          ai_score_percent: '0%',
          roe: 0,
          der: 0,
          pbv: 0,
          per: 0,
        }
      )
    })
  }, [selectedTickers, allStocks])

  // Change ticker for a specific slot index
  const handleSlotChange = (index: number, newTicker: string) => {
    const clean = newTicker.trim().toUpperCase().replace('.JK', '')
    if (!clean) return
    const updated = [...selectedTickers]
    updated[index] = clean
    setSelectedTickers(updated)
  }

  // Add new comparison column
  const handleAddColumn = () => {
    if (selectedTickers.length >= 5) return
    // Pick the first available ticker not currently selected
    const available = allStocks
      .map(s => s.ticker.replace('.JK', ''))
      .find(t => !selectedTickers.includes(t)) || 'TLKM'

    setSelectedTickers(prev => [...prev, available])
  }

  // Remove comparison column
  const handleRemoveColumn = (index: number) => {
    if (selectedTickers.length <= 1) return // Boleh tersisa 1 saham jika diinginkan
    setSelectedTickers(prev => prev.filter((_, idx) => idx !== index))
  }

  // Determine winners among selected stocks
  const winners = useMemo(() => {
    if (selectedStocks.length === 0) return { aiWinner: null, valuationWinner: null, fundamentalWinner: null }

    const aiWinner = [...selectedStocks].sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))[0]
    const valuationWinner = [...selectedStocks].sort((a, b) => ((a.per || 999) + (a.pbv || 999)) - ((b.per || 999) + (b.pbv || 999)))[0]
    const fundamentalWinner = [...selectedStocks].sort((a, b) => ((b.roe || 0) / (b.der || 1)) - ((a.roe || 0) / (a.der || 1)))[0]

    return { aiWinner, valuationWinner, fundamentalWinner }
  }, [selectedStocks])

  // Quick Presets
  const presets = [
    { label: '🏦 Perbankan (BBCA, BMRI, BBRI, BBNI)', tickers: ['BBCA', 'BMRI', 'BBRI', 'BBNI'] },
    { label: '📡 Telekomunikasi (TLKM, ISAT, EXCL)', tickers: ['TLKM', 'ISAT', 'EXCL'] },
    { label: '⛏️ Batubara & Tambang (ADRO, ITMG, PTBA)', tickers: ['ADRO', 'ITMG', 'PTBA'] },
    { label: '🛒 Consumer (ICBP, INDF, UNVR)', tickers: ['ICBP', 'INDF', 'UNVR'] },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* Top Header Card */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📊 Matriks Komparasi Saham Head-to-Head</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Bandingkan indikator teknikal, valuasi (PER/PBV), dan AI score saham favorit Anda. Pilih saham secara bebas pada setiap kolom.
            </p>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedTickers(p.tickers)}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Winner Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="card" style={{ borderLeft: '4px solid #10b981', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            🚀 AI Momentum Champion
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            {winners.aiWinner?.ticker.replace('.JK', '') || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Skor AI: <strong>{winners.aiWinner?.ai_score_percent || `${((winners.aiWinner?.ai_score || 0) * 100).toFixed(1)}%`}</strong>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #3b82f6', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            🏆 Valuasi Termurah (PER & PBV)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>
            {winners.valuationWinner?.ticker.replace('.JK', '') || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            PER: <strong>{winners.valuationWinner?.per ? `${winners.valuationWinner.per.toFixed(1)}x` : '—'}</strong> | PBV: <strong>{winners.valuationWinner?.pbv ? `${winners.valuationWinner.pbv.toFixed(2)}x` : '—'}</strong>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            🛡️ Fundamental Efisien (ROE vs DER)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
            {winners.fundamentalWinner?.ticker.replace('.JK', '') || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            ROE: <strong>{winners.fundamentalWinner?.roe ? `${winners.fundamentalWinner.roe.toFixed(1)}%` : '—'}</strong> | DER: <strong>{winners.fundamentalWinner?.der ? `${winners.fundamentalWinner.der.toFixed(2)}x` : '—'}</strong>
          </div>
        </div>
      </div>

      {/* Fully Dynamic Comparison Table */}
      <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
            📋 Tabel Perbandingan Saham Bebas & Dinamis
          </h4>
          {selectedTickers.length < 5 && (
            <button
              onClick={handleAddColumn}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Tambah Kolom Saham
            </button>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 10px', color: 'var(--text-secondary)', minWidth: 160 }}>Metrik / Saham</th>
              
              {/* Dynamic Selectors per Header Column */}
              {selectedStocks.map((s, idx) => {
                const color = COLUMN_COLORS[idx % COLUMN_COLORS.length]
                const cleanT = s.ticker.replace('.JK', '')

                return (
                  <th key={idx} style={{ padding: '12px 10px', minWidth: 180, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Header Dropdown to change stock for this column */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <select
                          value={cleanT}
                          onChange={e => handleSlotChange(idx, e.target.value)}
                          style={{
                            flex: 1,
                            background: 'var(--bg-primary)',
                            color,
                            fontWeight: 800,
                            fontSize: 15,
                            border: `1.5px solid ${color}`,
                            borderRadius: 6,
                            padding: '6px 8px',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {allStocks
                            .map(item => item.ticker.replace('.JK', ''))
                            .sort()
                            .map(tickerOption => (
                              <option key={tickerOption} value={tickerOption}>
                                {tickerOption}
                              </option>
                            ))}
                        </select>

                        {selectedTickers.length > 1 && (
                          <button
                            onClick={() => handleRemoveColumn(idx)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: 6,
                              width: 28,
                              height: 30,
                              fontSize: 14,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Hapus Kolom Ini"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {/* Nama Perusahaan */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Nama Perusahaan</td>
              {selectedStocks.map((s, idx) => (
                <td key={idx} style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {s.company_name || 'Emiten Saham IDX'}
                </td>
              ))}
            </tr>

            {/* Sektor Industri */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sektor Industri</td>
              {selectedStocks.map((s, idx) => (
                <td key={idx} style={{ padding: '12px 10px', fontWeight: 600 }}>
                  <span className="badge-sector">{s.sector || 'Umum'}</span>
                </td>
              ))}
            </tr>

            {/* Harga Saham */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Harga Saat Ini</td>
              {selectedStocks.map((s, idx) => (
                <td key={idx} style={{ padding: '12px 10px', fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                  {s.current_price ? `Rp ${s.current_price.toLocaleString('id-ID')}` : '—'}
                </td>
              ))}
            </tr>

            {/* AI Momentum Score */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>AI Momentum Score</td>
              {selectedStocks.map((s, idx) => {
                const pct = ((s.ai_score || 0) * 100).toFixed(1)
                const isTop = s.ticker === winners.aiWinner?.ticker && selectedStocks.length > 1
                return (
                  <td key={idx} style={{ padding: '12px 10px', fontWeight: 800, color: isTop ? '#10b981' : 'var(--blue)' }}>
                    {pct}% {isTop && '👑'}
                  </td>
                )
              })}
            </tr>

            {/* ROE */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>ROE (Profitabilitas)</td>
              {selectedStocks.map((s, idx) => {
                const isGood = (s.roe || 0) >= 15
                return (
                  <td key={idx} style={{ padding: '12px 10px', fontWeight: 700, color: isGood ? '#10b981' : '#f59e0b' }}>
                    {s.roe ? `${s.roe.toFixed(1)}%` : '—'}
                  </td>
                )
              })}
            </tr>

            {/* DER */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>DER (Rasio Hutang)</td>
              {selectedStocks.map((s, idx) => {
                const isSafe = (s.der || 0) <= 1.5
                return (
                  <td key={idx} style={{ padding: '12px 10px', fontWeight: 700, color: isSafe ? '#10b981' : '#ef4444' }}>
                    {s.der ? `${s.der.toFixed(2)}x` : '—'}
                  </td>
                )
              })}
            </tr>

            {/* PBV */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>PBV (Valuasi Buku)</td>
              {selectedStocks.map((s, idx) => {
                const isCheap = (s.pbv || 0) <= 1.5
                return (
                  <td key={idx} style={{ padding: '12px 10px', fontWeight: 700, color: isCheap ? '#10b981' : '#f59e0b' }}>
                    {s.pbv ? `${s.pbv.toFixed(2)}x` : '—'}
                  </td>
                )
              })}
            </tr>

            {/* PER */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>PER (Valuasi Laba)</td>
              {selectedStocks.map((s, idx) => {
                const isCheap = (s.per || 0) <= 15
                return (
                  <td key={idx} style={{ padding: '12px 10px', fontWeight: 700, color: isCheap ? '#10b981' : '#f59e0b' }}>
                    {s.per ? `${s.per.toFixed(1)}x` : '—'}
                  </td>
                )
              })}
            </tr>

            {/* Quick Actions Row */}
            <tr>
              <td style={{ padding: '14px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Aksi Cepat</td>
              {selectedStocks.map((s, idx) => {
                const cleanT = s.ticker.replace('.JK', '')
                const inWatch = isWatchlisted ? isWatchlisted(cleanT) : false
                return (
                  <td key={idx} style={{ padding: '14px 10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        onClick={() => onOpenTradeModal && onOpenTradeModal(s.ticker, s.current_price || 0)}
                        style={{
                          background: 'var(--accent)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🛒 Beli Virtual
                      </button>
                      {onToggleWatchlist && (
                        <button
                          onClick={() => onToggleWatchlist(cleanT)}
                          style={{
                            background: inWatch ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-primary)',
                            color: inWatch ? '#f59e0b' : 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {inWatch ? '⭐ Di-pantau' : '☆ Watchlist'}
                        </button>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
