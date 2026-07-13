'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface CacheEntry {
  key: string
  items: number
  ttl_remaining_sec: number
  expired: boolean
}

export default function CacheMonitorPage() {
  const [entries, setEntries] = useState<CacheEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/admin/ml/cache-status')
      .then(r => {
        setEntries(r.data.entries || [])
        setTotal(r.data.total_entries || 0)
      })
      .finally(() => setLoading(false))
  }

  const clearCache = async () => {
    setClearing(true)
    setMsg('')
    try {
      const r = await api.post('/admin/ml/invalidate-cache')
      setMsg(`✅ ${r.data.message} (${r.data.entries_cleared} entries dihapus)`)
      load()
    } catch (e: any) {
      setMsg(`❌ ${e?.response?.data?.detail || e.message}`)
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    load()
    // Auto-refresh setiap 30 detik
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const ttlColor = (sec: number, expired: boolean) => {
    if (expired) return '#f44336'
    if (sec < 120) return '#FF9800'
    return '#4CAF50'
  }

  const formatTTL = (sec: number, expired: boolean) => {
    if (expired) return 'Kadaluarsa'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}m ${s}s`
  }

  // Parse profile & sector dari cache key
  const parseKey = (key: string) => {
    const [profile, sector] = key.split('::')
    return { profile: profile.charAt(0).toUpperCase() + profile.slice(1), sector: sector === 'all' ? 'Semua Sektor' : sector }
  }

  const profileColor = (profile: string) => {
    if (profile === 'Konservatif') return '#4CAF50'
    if (profile === 'Moderat') return '#FF9800'
    if (profile === 'Agresif') return '#f44336'
    return '#888'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🗄️ Cache Monitor</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Monitor SAW Cache — Auto-refresh setiap 30 detik
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
            🔄 Refresh
          </button>
          <button onClick={clearCache} disabled={clearing || total === 0} style={{ background: clearing || total === 0 ? '#333' : '#f44336', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: clearing || total === 0 ? 'not-allowed' : 'pointer', opacity: clearing || total === 0 ? 0.6 : 1 }}>
            {clearing ? 'Menghapus...' : '🗑 Clear All Cache'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('✅') ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)', border: `1px solid ${msg.startsWith('✅') ? '#4CAF50' : '#f44336'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: msg.startsWith('✅') ? '#4CAF50' : '#f44' }}>
          {msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>TOTAL ENTRIES</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#2196F3' }}>{total}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>AKTIF</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#4CAF50' }}>{entries.filter(e => !e.expired).length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>KADALUARSA</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#f44336' }}>{entries.filter(e => e.expired).length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>TTL MAX</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#FF9800' }}>10m</div>
        </div>
      </div>

      {/* Cache Entries Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 16 }}>📋 Cache Entries</div>

        {loading && <p style={{ color: '#888', fontSize: 13 }}>Memuat...</p>}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💤</div>
            <div>Cache kosong — belum ada request rekomendasi</div>
          </div>
        )}

        {entries.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Cache Key', 'Profil', 'Sektor', 'Saham', 'TTL Sisa', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#888', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const { profile, sector } = parseKey(entry.key)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{entry.key}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: `${profileColor(profile)}22`, color: profileColor(profile), borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                        {profile}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{sector}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{entry.items} saham</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: ttlColor(entry.ttl_remaining_sec, entry.expired) }}>
                      {formatTTL(entry.ttl_remaining_sec, entry.expired)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: entry.expired ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.15)',
                        color: entry.expired ? '#f44336' : '#4CAF50',
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                      }}>
                        {entry.expired ? 'Kadaluarsa' : '✅ Aktif'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info */}
      <div style={{ background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 12, color: '#aaa' }}>
        ℹ️ Cache SAW otomatis dihapus setiap kali pipeline ML selesai berjalan (setelah 17:00 atau 18:00 WIB). Clear manual berguna saat ada update fundamental di luar jadwal pipeline.
      </div>
    </div>
  )
}
