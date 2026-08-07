'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface AnalyticsSummary {
  visitors_today: number
  visitors_today_change_pct: number
  visitors_7d_total: number
  mobile_device_ratio: string
}

interface TrendData {
  labels: string[]
  values: number[]
}

interface DeviceItem {
  device: string
  percentage: number
  count: number
}

interface AnalyticsData {
  is_live_cloudflare: boolean
  summary: AnalyticsSummary
  trends_7d: TrendData
  device_breakdown: DeviceItem[]
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAnalytics = () => {
    setLoading(true)
    setError('')
    api.get('/admin/analytics/visitors')
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Gagal mengambil data analitik:', err)
        setError('Gagal memuat data analitik pengunjung.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary, #888)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <p>Memuat data analitik pengunjung...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: 20, color: '#ef4444' }}>
          <p style={{ fontWeight: 600 }}>⚠️ {error || 'Data tidak ditemukan'}</p>
          <button 
            onClick={fetchAnalytics}
            style={{ marginTop: 12, padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const { summary, trends_7d, device_breakdown, is_live_cloudflare } = data
  const values = trends_7d.values
  const labels = trends_7d.labels
  const maxVal = Math.max(...values, 100)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1

  // Perhitungan Koordinat SVG Line Chart
  const chartHeight = 180
  const chartWidth = 700
  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * chartWidth
    const y = chartHeight - ((val - minVal) / range) * (chartHeight - 40) - 20
    return { x, y, val, label: labels[idx] }
  })

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
  }, '')

  const areaD = `${pathD} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #fff)', marginBottom: 4 }}>
            📊 Analitik Pengunjung
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted, #888)' }}>
            Pantau statistik statistik pengunjung manusia dan tren aktivitas lalu lintas web.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: is_live_cloudflare ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
            color: is_live_cloudflare ? '#22c55e' : '#eab308',
            border: `1px solid ${is_live_cloudflare ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: is_live_cloudflare ? '#22c55e' : '#eab308' }} />
            {is_live_cloudflare ? 'Live Cloudflare Analytics' : 'Mode Database Riil (Data Asli)'}
          </span>

          <button
            onClick={fetchAnalytics}
            style={{
              background: 'var(--bg-card, #12131a)',
              border: '1px solid var(--border, #222)',
              color: 'var(--text-primary, #fff)',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* 3 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card, #12131a)', border: '1px solid var(--border, #222)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Pengunjung Hari Ini
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6', marginBottom: 4 }}>
            {summary.visitors_today.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
            ↑ +{summary.visitors_today_change_pct}% dibanding kemarin
          </div>
        </div>

        <div style={{ background: 'var(--bg-card, #12131a)', border: '1px solid var(--border, #222)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Total 7 Hari Terakhir
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#a855f7', marginBottom: 4 }}>
            {summary.visitors_7d_total.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
            Pengunjung unik terakumulasi
          </div>
        </div>

        <div style={{ background: 'var(--bg-card, #12131a)', border: '1px solid var(--border, #222)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Rasio Perangkat Mobile
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>
            {summary.mobile_device_ratio}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
            Pengguna dari Smartphone
          </div>
        </div>
      </div>

      {/* SVG Line Chart - Tren 7 Hari */}
      <div style={{ background: 'var(--bg-card, #12131a)', border: '1px solid var(--border, #222)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 4 }}>
              📈 Line Chart Tren Pengunjung (7 Hari)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
              Visualisasi tren garis pergerakan lalu lintas pengunjung harian.
            </p>
          </div>
        </div>

        {/* SVG Container */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div style={{ minWidth: 600, padding: '10px 0' }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0.25, 0.5, 0.75].map((ratio, i) => (
                <line
                  key={i}
                  x1="0"
                  y1={chartHeight * ratio}
                  x2={chartWidth}
                  y2={chartHeight * ratio}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Gradient Area Fill */}
              <path d={areaD} fill="url(#lineGrad)" />

              {/* Main Trend Line */}
              <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Data Points & Data Labels */}
              {points.map((pt, i) => {
                const isLast = i === points.length - 1
                return (
                  <g key={i}>
                    {/* Circle Dot */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isLast ? 6 : 4.5}
                      fill={isLast ? '#3b82f6' : '#12131a'}
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                    />
                    {/* Value Badge above dot */}
                    <text
                      x={pt.x}
                      y={pt.y - 12}
                      textAnchor="middle"
                      fill={isLast ? '#3b82f6' : '#cbd5e1'}
                      fontSize="11"
                      fontWeight={isLast ? "700" : "600"}
                    >
                      {pt.val}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* X-Axis Day Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
              {points.map((pt, i) => {
                const isLast = i === points.length - 1
                return (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      color: isLast ? '#3b82f6' : 'var(--text-muted, #888)',
                      fontWeight: isLast ? 700 : 400
                    }}
                  >
                    {pt.label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Device Breakdown Section */}
      <div style={{ background: 'var(--bg-card, #12131a)', border: '1px solid var(--border, #222)', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 16 }}>
          📱 Breakdown Tipe Perangkat Pengunjung
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {device_breakdown.map((item, idx) => {
            const colors = ['#f59e0b', '#3b82f6', '#10b981']
            const color = colors[idx % colors.length]

            return (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{item.device}</span>
                  <span style={{ fontWeight: 700, color }}>{item.percentage}% ({item.count})</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${item.percentage}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
