'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface StockData {
  ticker: string
  name: string | null
  sector: string | null
  is_qualified: boolean
  roe: number | null
  der: number | null
  pbv: number | null
  ai_score: number | null
  ai_score_pct: string | null
}

const aiScoreColor = (score: number | null) => {
  if (!score) return '#888'
  if (score >= 0.6) return '#4CAF50'
  if (score >= 0.4) return '#FF9800'
  return '#f44336'
}

export default function AdminStocksPage() {
  const [stocks, setStocks]     = useState<StockData[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [sector, setSector]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'qualified' | 'disqualified'>('all')
  const [msg, setMsg]           = useState('')
  const [msgType, setMsgType]   = useState<'ok' | 'err'>('ok')

  const load = () => {
    setLoading(true)
    api.get('/admin/users/stocks/list')
      .then(r => setStocks(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 3000)
  }

  const toggleQualified = async (ticker: string, current: boolean) => {
    try {
      const r = await api.patch(`/admin/users/stocks/${ticker}/toggle-qualified`)
      showMsg(`✅ ${r.data.message}`)
      load()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || e.message}`, 'err')
    }
  }

  // Daftar sektor unik
  const sectors = Array.from(new Set(stocks.map(s => s.sector).filter(Boolean))).sort()

  const filtered = stocks.filter(s => {
    const matchSearch = s.ticker.toLowerCase().includes(search.toLowerCase()) ||
      (s.name || '').toLowerCase().includes(search.toLowerCase())
    const matchSector = !sector || s.sector === sector
    const matchFilter = filter === 'all' ? true : filter === 'qualified' ? s.is_qualified : !s.is_qualified
    return matchSearch && matchSector && matchFilter
  })

  const qualifiedCount = stocks.filter(s => s.is_qualified).length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📈 Daftar Saham</h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          Total {stocks.length} saham — <span style={{ color: '#4CAF50' }}>{qualifiedCount} qualified</span> — <span style={{ color: '#f44' }}>{stocks.length - qualifiedCount} disqualified</span>
        </p>
      </div>

      {msg && (
        <div style={{
          background: msgType === 'ok' ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
          border: `1px solid ${msgType === 'ok' ? '#4CAF50' : '#f44'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          fontSize: 13, color: msgType === 'ok' ? '#4CAF50' : '#f44',
        }}>
          {msg}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cari ticker atau nama..."
          style={{ background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '9px 14px', color: '#fff', fontSize: 13, width: 220 }}
        />
        <select
          value={sector} onChange={e => setSector(e.target.value)}
          style={{ background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13 }}
        >
          <option value="">Semua Sektor</option>
          {sectors.map(s => <option key={s!} value={s!}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'qualified', 'disqualified'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#2255AA' : 'transparent',
              color: filter === f ? '#fff' : '#888',
              border: '1px solid #333', borderRadius: 8,
              padding: '8px 14px', fontSize: 12, cursor: 'pointer',
            }}>
              {f === 'all' ? 'Semua' : f === 'qualified' ? '✅ Qualified' : '❌ Disqualified'}
            </button>
          ))}
        </div>
        <button onClick={load} style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        Menampilkan {filtered.length} dari {stocks.length} saham
      </div>

      {/* Tabel */}
      <div style={{ background: 'var(--card-bg, #16213e)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
              {['Ticker', 'Nama', 'Sektor', 'ROE', 'DER', 'PBV', 'AI Score', 'Status', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Tidak ada saham yang cocok</td></tr>
            ) : filtered.map(s => (
              <tr key={s.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: s.is_qualified ? 1 : 0.5 }}>
                <td style={{ padding: '10px 14px', fontWeight: 800, fontFamily: 'monospace', color: '#64B5F6' }}>{s.ticker.replace('.JK', '')}</td>
                <td style={{ padding: '10px 14px', color: '#ccc', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    {s.sector || '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: (s.roe ?? 0) > 0 ? '#4CAF50' : '#f44' }}>
                  {s.roe != null ? `${s.roe.toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '10px 14px', color: (s.der ?? 0) > 2 ? '#f44' : '#ccc' }}>
                  {s.der != null ? s.der.toFixed(2) : '—'}
                </td>
                <td style={{ padding: '10px 14px', color: '#ccc' }}>
                  {s.pbv != null ? s.pbv.toFixed(2) : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {s.ai_score != null ? (
                    <span style={{ color: aiScoreColor(s.ai_score), fontWeight: 700 }}>
                      {s.ai_score_pct ?? `${(s.ai_score * 100).toFixed(1)}%`}
                    </span>
                  ) : <span style={{ color: '#666' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    background: s.is_qualified ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                    color: s.is_qualified ? '#4CAF50' : '#f44',
                    borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                  }}>
                    {s.is_qualified ? '✅ Aktif' : '❌ Nonaktif'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    onClick={() => toggleQualified(s.ticker, s.is_qualified)}
                    style={{
                      background: s.is_qualified ? 'rgba(244,67,54,0.2)' : 'rgba(76,175,80,0.2)',
                      color: s.is_qualified ? '#f44' : '#4CAF50',
                      border: `1px solid ${s.is_qualified ? '#f44' : '#4CAF50'}`,
                      borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    {s.is_qualified ? '🚫 Nonaktifkan' : '✅ Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div style={{ background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 12, color: '#aaa' }}>
        ℹ️ <b>Nonaktifkan</b> saham akan mengeluarkannya dari daftar rekomendasi SAW. Saham yang dinonaktifkan tidak akan muncul di Top Picks meski AI Score-nya tinggi. Perubahan aktif setelah SAW Cache kedaluarsa (10 menit) atau setelah cache dibersihkan manual.
      </div>
    </div>
  )
}
