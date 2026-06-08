'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface Flag {
  id: number
  ticker: string
  prev_close: number
  curr_close: number
  change_pct: number
  flagged_at: string
  description?: string
}

const ACTION_TYPES = [
  { value: 'normal_drop',   label: '✅ Penurunan Normal',  desc: 'Bukan corporate action, pipeline lanjut' },
  { value: 'normal_surge',  label: '✅ Kenaikan Normal',   desc: 'Bukan corporate action, pipeline lanjut' },
  { value: 'stock_split',   label: '✂️ Stock Split',       desc: 'Harga turun karena split (perlu split ratio)' },
  { value: 'reverse_split', label: '↕ Reverse Split',     desc: 'Harga naik karena reverse split (perlu split ratio)' },
  { value: 'other',         label: '📝 Lainnya',           desc: 'Aksi korporasi lain, pipeline lanjut' },
]

function FlagCard({ flag, onResolved }: { flag: Flag; onResolved: () => void }) {
  const [action, setAction] = useState('normal_drop')
  const [ratio, setRatio] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const needsRatio = ['stock_split', 'reverse_split'].includes(action)
  const changePct = ((flag.curr_close - flag.prev_close) / flag.prev_close * 100).toFixed(1)
  const isDown = flag.curr_close < flag.prev_close

  const resolve = async () => {
    if (needsRatio && !ratio) { setMsg('Split ratio wajib diisi'); return }
    setLoading(true)
    setMsg('')
    try {
      await api.post(`/admin/ml/corporate-actions/${flag.id}/resolve`, {
        action_type: action,
        split_ratio: needsRatio ? parseFloat(ratio) : null,
        admin_notes: notes,
      })
      setMsg('✅ Berhasil diresolve!')
      setTimeout(() => onResolved(), 1200)
    } catch (e: any) {
      setMsg(`❌ ${e?.response?.data?.detail || e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--card-bg, #16213e)',
      border: `1px solid ${isDown ? 'rgba(244,67,54,0.4)' : 'rgba(76,175,80,0.4)'}`,
      borderRadius: 12, padding: 24, marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{flag.ticker}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            📅 {new Date(flag.flagged_at).toLocaleString('id-ID')}
          </div>
        </div>
        <div style={{
          background: isDown ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.15)',
          border: `1px solid ${isDown ? '#f44336' : '#4CAF50'}`,
          borderRadius: 8, padding: '6px 12px', textAlign: 'right',
        }}>
          <div style={{ fontSize: 11, color: '#888' }}>Perubahan Harga</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isDown ? '#f44336' : '#4CAF50' }}>
            {isDown ? '▼' : '▲'} {Math.abs(parseFloat(changePct))}%
          </div>
        </div>
      </div>

      {/* Harga */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#888' }}>Harga Sebelumnya</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Rp {flag.prev_close?.toLocaleString('id-ID')}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#888' }}>Harga Sekarang</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: isDown ? '#f44336' : '#4CAF50' }}>
            Rp {flag.curr_close?.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Form Resolve */}
      <div style={{ borderTop: '1px solid var(--border, #1a1a2e)', paddingTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>🔧 Tindakan Admin:</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {ACTION_TYPES.map(a => (
            <label key={a.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: action === a.value ? 'rgba(34,85,170,0.2)' : 'transparent', border: action === a.value ? '1px solid rgba(34,85,170,0.5)' : '1px solid transparent' }}>
              <input type="radio" value={a.value} checked={action === a.value} onChange={() => setAction(a.value)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{a.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {needsRatio && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Split Ratio (contoh: 5 untuk split 1:5)</label>
            <input
              type="number" value={ratio} onChange={e => setRatio(e.target.value)}
              placeholder="Masukkan ratio..."
              style={{ background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, width: '200px' }}
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Catatan Admin (opsional)</label>
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Catatan tambahan..."
            style={{ background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={resolve} disabled={loading}
            style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Memproses...' : '✅ Resolve Flag'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('✅') ? '#4CAF50' : '#f44336' }}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}

export default function CorporateActionsPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.get('/admin/ml/corporate-actions')
      .then(r => setFlags(r.data.flags || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🚨 Corporate Action Review</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Emiten dengan pergerakan harga ekstrem (&gt;35% dalam 1 hari) yang menunggu validasi
          </p>
        </div>
        <button onClick={load} style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {loading && <p style={{ color: '#888' }}>Memuat data...</p>}

      {!loading && flags.length === 0 && (
        <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: '#4CAF50' }}>Tidak ada corporate action yang perlu direview</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Semua emiten berjalan normal</div>
        </div>
      )}

      {flags.map(flag => (
        <FlagCard key={flag.id} flag={flag} onResolved={load} />
      ))}

      {/* Info */}
      <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 12, color: '#aaa' }}>
        ℹ️ Emiten yang di-flag akan <b>dilewati oleh pipeline ML</b> sampai admin menyelesaikan review. Tindakan <b>Stock Split</b> akan otomatis menyesuaikan jumlah saham di semua portofolio virtual pengguna.
      </div>
    </div>
  )
}
