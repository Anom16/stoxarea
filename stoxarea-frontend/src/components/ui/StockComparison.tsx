'use client'

import { useState, useMemo } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts'

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

const COMPARISON_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899']

export default function StockComparison({
  allStocks,
  onOpenTradeModal,
  onToggleWatchlist,
  isWatchlisted,
}: StockComparisonProps) {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['BBCA', 'BMRI', 'BBRI'])
  const [radarMode, setRadarMode] = useState<'sideBySide' | 'overlay'>('sideBySide')

  // Filter selected stock data
  const selectedStocks = useMemo(() => {
    return selectedTickers
      .map(t => allStocks.find(s => s.ticker.toUpperCase().replace('.JK', '') === t.toUpperCase()))
      .filter((s): s is StockMetricData => s !== undefined)
  }, [selectedTickers, allStocks])

  const handleAddTicker = (tickerToAdd: string) => {
    const clean = tickerToAdd.trim().toUpperCase().replace('.JK', '')
    if (!clean) return
    if (selectedTickers.length >= 4) return
    if (!selectedTickers.includes(clean)) {
      setSelectedTickers(prev => [...prev, clean])
    }
  }

  const handleRemoveTicker = (tickerToRemove: string) => {
    if (selectedTickers.length <= 2) return // minimal 2 untuk komparasi
    setSelectedTickers(prev => prev.filter(t => t !== tickerToRemove))
  }

  // Calculate normalized criteria (0 - 100) per stock for individual Radar Charts
  const getSingleStockRadarData = (s: StockMetricData) => {
    const maxAi = 1
    const maxRoe = Math.max(...allStocks.map(st => st.roe || 0), 30)
    const maxDer = Math.max(...allStocks.map(st => st.der || 0), 5)
    const maxPbv = Math.max(...allStocks.map(st => st.pbv || 0), 10)
    const maxPer = Math.max(...allStocks.map(st => st.per || 0), 50)

    const derScore = Math.round((1 - Math.min(s.der / maxDer, 1)) * 100)
    const pbvScore = Math.round((1 - Math.min(s.pbv / maxPbv, 1)) * 100)
    const perScore = Math.round((1 - Math.min(s.per / maxPer, 1)) * 100)
    const roeScore = Math.round(Math.min(Math.max((s.roe / maxRoe) * 100, 0), 100))
    const aiScore  = Math.round((s.ai_score / maxAi) * 100)

    return [
      { criterion: 'AI Momentum', score: aiScore, raw: `${(s.ai_score * 100).toFixed(1)}%` },
      { criterion: 'ROE (Laba)', score: roeScore, raw: `${s.roe?.toFixed(1)}%` },
      { criterion: 'Solvabilitas (DER)', score: derScore, raw: `${s.der?.toFixed(2)}x` },
      { criterion: 'Valuasi Buku (PBV)', score: pbvScore, raw: `${s.pbv?.toFixed(2)}x` },
      { criterion: 'Valuasi Laba (PER)', score: perScore, raw: `${s.per?.toFixed(1)}x` },
    ]
  }

  // Overlay Radar Data
  const overlayRadarData = useMemo(() => {
    if (selectedStocks.length === 0) return []

    const maxAi = 1
    const maxRoe = Math.max(...allStocks.map(s => s.roe || 0), 30)
    const maxDer = Math.max(...allStocks.map(s => s.der || 0), 5)
    const maxPbv = Math.max(...allStocks.map(s => s.pbv || 0), 10)
    const maxPer = Math.max(...allStocks.map(s => s.per || 0), 50)

    const criteria = [
      { key: 'ai_score', label: 'AI Momentum' },
      { key: 'roe', label: 'ROE (Laba)' },
      { key: 'der_inv', label: 'Solvabilitas (DER)' },
      { key: 'pbv_inv', label: 'Valuasi Buku (PBV)' },
      { key: 'per_inv', label: 'Valuasi Laba (PER)' },
    ]

    return criteria.map(c => {
      const row: Record<string, any> = { criterion: c.label }
      selectedStocks.forEach(s => {
        const t = s.ticker.replace('.JK', '')
        let normVal = 50

        if (c.key === 'ai_score') normVal = (s.ai_score / maxAi) * 100
        else if (c.key === 'roe') normVal = Math.min(Math.max((s.roe / maxRoe) * 100, 0), 100)
        else if (c.key === 'der_inv') normVal = (1 - Math.min(s.der / maxDer, 1)) * 100
        else if (c.key === 'pbv_inv') normVal = (1 - Math.min(s.pbv / maxPbv, 1)) * 100
        else if (c.key === 'per_inv') normVal = (1 - Math.min(s.per / maxPer, 1)) * 100

        row[t] = Math.round(normVal)
      })
      return row
    })
  }, [selectedStocks, allStocks])

  // Determine winners
  const winners = useMemo(() => {
    if (selectedStocks.length === 0) return { aiWinner: null, valuationWinner: null, fundamentalWinner: null }

    const aiWinner = [...selectedStocks].sort((a, b) => b.ai_score - a.ai_score)[0]
    const valuationWinner = [...selectedStocks].sort((a, b) => (a.per + a.pbv) - (b.per + b.pbv))[0]
    const fundamentalWinner = [...selectedStocks].sort((a, b) => (b.roe / (b.der || 1)) - (a.roe / (a.der || 1)))[0]

    return { aiWinner, valuationWinner, fundamentalWinner }
  }, [selectedStocks])

  const presets = [
    { label: '🏦 Big Bank (BBCA vs BMRI vs BBRI vs BBNI)', tickers: ['BBCA', 'BMRI', 'BBRI', 'BBNI'] },
    { label: '📡 Telco (TLKM vs ISAT vs EXCL)', tickers: ['TLKM', 'ISAT', 'EXCL'] },
    { label: '⛏️ Tambang (ADRO vs ITMG vs PTBA)', tickers: ['ADRO', 'ITMG', 'PTBA'] },
    { label: '🛒 Consumer (ICBP vs INDF vs UNVR)', tickers: ['ICBP', 'INDF', 'UNVR'] },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Controls */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>⚔️ Komparasi Saham Head-to-Head</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Bandingkan hingga 4 saham sekaligus secara komprehensif.
            </p>
          </div>

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
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Ticker Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Saham Komparasi:</span>

          {selectedTickers.map((t, idx) => (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-primary)',
                border: `2px solid ${COMPARISON_COLORS[idx % COMPARISON_COLORS.length]}`,
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
                }}
              />
              {t}
              {selectedTickers.length > 2 && (
                <button
                  onClick={() => handleRemoveTicker(t)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    marginLeft: 4,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {selectedTickers.length < 4 && (
            <select
              value=""
              onChange={e => { if (e.target.value) handleAddTicker(e.target.value) }}
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">+ Tambah Saham...</option>
              {allStocks
                .map(s => s.ticker.replace('.JK', ''))
                .filter(t => !selectedTickers.includes(t))
                .sort()
                .map(t => (
                  <option key={t} value={t}>+ {t}</option>
                ))}
            </select>
          )}
        </div>
      </div>

      {/* Winner Badges Section */}
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
            PER: <strong>{winners.valuationWinner?.per?.toFixed(1)}x</strong> | PBV: <strong>{winners.valuationWinner?.pbv?.toFixed(2)}x</strong>
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
            ROE: <strong>{winners.fundamentalWinner?.roe?.toFixed(1)}%</strong> | DER: <strong>{winners.fundamentalWinner?.der?.toFixed(2)}x</strong>
          </div>
        </div>
      </div>

      {/* Radar Layout Switcher & Section */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h4 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
            🕸️ Grafik Radar Kriteria SAW 5-Kriteria
          </h4>
          <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setRadarMode('sideBySide')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: radarMode === 'sideBySide' ? 'var(--accent)' : 'transparent',
                color: radarMode === 'sideBySide' ? 'white' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              📊 Dijejerkan Side-by-Side
            </button>
            <button
              onClick={() => setRadarMode('overlay')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: radarMode === 'overlay' ? 'var(--accent)' : 'transparent',
                color: radarMode === 'overlay' ? 'white' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              🕸️ Tumpang Tindih (Gabungan)
            </button>
          </div>
        </div>

        {/* Option A: SIDE-BY-SIDE INDIVIDUAL RADARS (Dijejerkan) */}
        {radarMode === 'sideBySide' ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`, gap: 20 }}>
            {selectedStocks.map((s, idx) => {
              const t = s.ticker.replace('.JK', '')
              const color = COMPARISON_COLORS[idx % COMPARISON_COLORS.length]
              const singleData = getSingleStockRadarData(s)

              return (
                <div
                  key={t}
                  style={{
                    background: 'var(--bg-primary)',
                    border: `1.5px solid ${color}`,
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 16, fontWeight: 800 }}>{t}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.sector || 'Saham'}</span>
                  </div>

                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={singleData}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis dataKey="criterion" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                        <RechartsTooltip 
                          formatter={(value: any, name: any, props: any) => [`Score: ${value}/100 (${props.payload.raw})`, props.payload.criterion]}
                          contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: 8 }}
                        />
                        <Radar
                          name={t}
                          dataKey="score"
                          stroke={color}
                          fill={color}
                          fillOpacity={0.35}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Option B: OVERLAY RADAR */
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={overlayRadarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="criterion" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                <RechartsTooltip 
                  contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: 8 }}
                />
                <Legend />
                {selectedStocks.map((s, idx) => {
                  const t = s.ticker.replace('.JK', '')
                  const color = COMPARISON_COLORS[idx % COMPARISON_COLORS.length]
                  return (
                    <Radar
                      key={t}
                      name={t}
                      dataKey={t}
                      stroke={color}
                      fill={color}
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  )
                })}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Matrix Comparison Table */}
      <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
        <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 16px 0' }}>
          📊 Tabel Matriks Perbandingan Detail
        </h4>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Metrik / Indikator</th>
              {selectedStocks.map((s, idx) => (
                <th key={s.ticker} style={{ padding: '10px 8px', color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length], fontWeight: 800 }}>
                  {s.ticker.replace('.JK', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Sektor */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sektor Industri</td>
              {selectedStocks.map(s => (
                <td key={s.ticker} style={{ padding: '10px 8px', fontWeight: 600 }}>
                  {s.sector || 'Umum'}
                </td>
              ))}
            </tr>

            {/* Harga */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Harga Saham</td>
              {selectedStocks.map(s => (
                <td key={s.ticker} style={{ padding: '10px 8px', fontWeight: 700 }}>
                  {s.current_price ? `Rp ${s.current_price.toLocaleString('id-ID')}` : '—'}
                </td>
              ))}
            </tr>

            {/* AI Score */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>AI Momentum Score</td>
              {selectedStocks.map(s => {
                const pct = ((s.ai_score || 0) * 100).toFixed(1)
                const isTop = s.ticker === winners.aiWinner?.ticker
                return (
                  <td key={s.ticker} style={{ padding: '10px 8px', fontWeight: 800, color: isTop ? '#10b981' : 'inherit' }}>
                    {pct}% {isTop && '👑'}
                  </td>
                )
              })}
            </tr>

            {/* ROE */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>ROE (Profitabilitas)</td>
              {selectedStocks.map(s => {
                const isGood = s.roe >= 15
                return (
                  <td key={s.ticker} style={{ padding: '10px 8px', fontWeight: 700, color: isGood ? '#10b981' : '#f59e0b' }}>
                    {s.roe?.toFixed(1)}%
                  </td>
                )
              })}
            </tr>

            {/* DER */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>DER (Rasio Hutang)</td>
              {selectedStocks.map(s => {
                const isSafe = s.der <= 1.5
                return (
                  <td key={s.ticker} style={{ padding: '10px 8px', fontWeight: 700, color: isSafe ? '#10b981' : '#ef4444' }}>
                    {s.der?.toFixed(2)}x
                  </td>
                )
              })}
            </tr>

            {/* PBV */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>PBV (Valuasi Aset)</td>
              {selectedStocks.map(s => {
                const isCheap = s.pbv <= 1.5
                return (
                  <td key={s.ticker} style={{ padding: '10px 8px', fontWeight: 700, color: isCheap ? '#10b981' : '#f59e0b' }}>
                    {s.pbv?.toFixed(2)}x
                  </td>
                )
              })}
            </tr>

            {/* PER */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>PER (Valuasi Laba)</td>
              {selectedStocks.map(s => {
                const isCheap = s.per <= 15
                return (
                  <td key={s.ticker} style={{ padding: '10px 8px', fontWeight: 700, color: isCheap ? '#10b981' : '#f59e0b' }}>
                    {s.per?.toFixed(1)}x
                  </td>
                )
              })}
            </tr>

            {/* Action Buttons */}
            <tr>
              <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Aksi Cepat</td>
              {selectedStocks.map(s => {
                const cleanT = s.ticker.replace('.JK', '')
                const inWatch = isWatchlisted ? isWatchlisted(cleanT) : false
                return (
                  <td key={s.ticker} style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        onClick={() => onOpenTradeModal && onOpenTradeModal(s.ticker, s.current_price || 0)}
                        style={{
                          background: 'var(--accent)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🛒 Beli
                      </button>
                      {onToggleWatchlist && (
                        <button
                          onClick={() => onToggleWatchlist(cleanT)}
                          style={{
                            background: inWatch ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-primary)',
                            color: inWatch ? '#f59e0b' : 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            padding: '4px 8px',
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
