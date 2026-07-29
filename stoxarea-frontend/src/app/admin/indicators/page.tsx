'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface IndicatorItem {
  id: string
  name: string
  type: 'benefit' | 'cost'
  description?: string
  created_at?: string
}

export default function AdminIndicatorsPage() {
  const [indicators, setIndicators] = useState<IndicatorItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [msg, setMsg]               = useState('')
  const [msgType, setMsgType]       = useState<'ok' | 'err'>('ok')

  // Form State: Add Indicator
  const [isAdding, setIsAdding]         = useState(false)
  const [addId, setAddId]               = useState('')
  const [addName, setAddName]           = useState('')
  const [addType, setAddType]           = useState<'benefit' | 'cost'>('benefit')
  const [addDesc, setAddDesc]           = useState('')

  // Modal / Form State: Upload CSV
  const [uploadIndId, setUploadIndId]   = useState<string | null>(null)
  const [uploadFile, setUploadFile]     = useState<File | null>(null)
  const [uploading, setUploading]       = useState(false)

  const DEFAULT_IDS = ['ai_score', 'roe', 'der', 'pbv', 'per']

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/indicators/')
      setIndicators(res.data)
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || 'Gagal memuat daftar indikator', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addId.trim() || !addName.trim()) {
      showMsg('❌ ID dan Nama Indikator wajib diisi', 'err')
      return
    }

    try {
      const payload = {
        id: addId.toLowerCase().trim().replace(/[^a-z0-9_]/g, ''),
        name: addName.trim(),
        type: addType,
        description: addDesc.trim()
      }

      const res = await api.post('/admin/indicators/', payload)
      showMsg(`✅ ${res.data.message}`)
      setIsAdding(false)
      setAddId(''); setAddName(''); setAddDesc(''); setAddType('benefit')
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || e.message}`, 'err')
    }
  }

  const handleDelete = async (ind: IndicatorItem) => {
    if (DEFAULT_IDS.includes(ind.id.toLowerCase())) {
      showMsg('❌ Indikator default bawaan sistem tidak boleh dihapus', 'err')
      return
    }

    if (!confirm(`Hapus indikator '${ind.name}' (${ind.id})? Seluruh nilai terkait per saham akan dihapus.`)) return

    try {
      const res = await api.delete(`/admin/indicators/${ind.id}`)
      showMsg(`✅ ${res.data.message}`)
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || e.message}`, 'err')
    }
  }

  const handleUploadCSV = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadIndId || !uploadFile) {
      showMsg('❌ Silakan pilih file CSV terlebih dahulu', 'err')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)

      const res = await api.post(`/admin/indicators/${uploadIndId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      showMsg(`✅ ${res.data.message} (${res.data.imported_rows} diimpor, ${res.data.skipped_rows} dilewati)`)
      setUploadIndId(null)
      setUploadFile(null)
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || e.message}`, 'err')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📊 Kelola Master Indikator</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Kelola indikator kriteria SAW, tipe indikator (Benefit/Cost), dan upload data CSV per saham.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(v => !v)}
          style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {isAdding ? '✕ Tutup Form' : '➕ Tambah Indikator'}
        </button>
      </div>

      {msg && (
        <div style={{
          background: msgType === 'ok' ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
          border: `1px solid ${msgType === 'ok' ? '#4CAF50' : '#f44'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
          fontSize: 13, color: msgType === 'ok' ? '#4CAF50' : '#f44',
        }}>
          {msg}
        </div>
      )}

      {/* Form Tambah Indikator Baru */}
      {isAdding && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 24, marginBottom: 24
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>➕ Tambah Indikator Kriteria Baru</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}>ID Indikator (unik, tanpa spasi)</label>
              <input
                type="text" required value={addId} onChange={e => setAddId(e.target.value)}
                placeholder="misal: esg_score"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nama Indikator</label>
              <input
                type="text" required value={addName} onChange={e => setAddName(e.target.value)}
                placeholder="misal: Skor ESG Lingkungan"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Tipe Indikator SAW</label>
              <select
                value={addType} onChange={e => setAddType(e.target.value as any)}
                style={formInputStyle}
              >
                <option value="benefit">Benefit (Semakin Tinggi Semakin Bagus)</option>
                <option value="cost">Cost (Semakin Rendah Semakin Bagus)</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Deskripsi Indikator</label>
              <input
                type="text" value={addDesc} onChange={e => setAddDesc(e.target.value)}
                placeholder="Deskripsi singkat mengenai indikator ini..."
                style={formInputStyle}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Simpan Indikator
              </button>
              <button type="button" onClick={() => setIsAdding(false)} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload CSV Form Overlay */}
      {uploadIndId && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid #2196F3',
          borderRadius: 12, padding: 24, marginBottom: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#2196F3' }}>
              📤 Upload CSV untuk Indikator: <code style={{ color: '#fff' }}>{uploadIndId}</code>
            </h3>
            <button onClick={() => setUploadIndId(null)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 14px 0' }}>
            Berkas CSV harus memiliki kolom header: <b>ticker</b> dan <b>value</b> (contoh: BBCA.JK, 85.5).
          </p>
          <form onSubmit={handleUploadCSV} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file" accept=".csv" required
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13 }}
            />
            <button type="submit" disabled={uploading} style={{ background: '#2196F3', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 'bold', cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? '⏳ Mengunggah...' : '🚀 Unggah & Import'}
            </button>
            <button type="button" onClick={() => setUploadIndId(null)} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
              Batal
            </button>
          </form>
        </div>
      )}

      {loading && <p style={{ color: '#888' }}>Memuat data indikator...</p>}

      {/* Tabel Indikator */}
      {!loading && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
                {['ID Indikator', 'Nama', 'Tipe SAW', 'Deskripsi', 'Kategori', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indicators.map(ind => {
                const isDefault = DEFAULT_IDS.includes(ind.id.toLowerCase())
                return (
                  <tr key={ind.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#64B5F6' }}>{ind.id}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>{ind.name}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: ind.type === 'benefit' ? 'rgba(33,150,243,0.15)' : 'rgba(244,67,54,0.15)',
                        color: ind.type === 'benefit' ? '#2196F3' : '#f44336',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {ind.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#aaa', fontSize: 12 }}>{ind.description || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: isDefault ? 'rgba(76,175,80,0.15)' : 'rgba(156,39,176,0.15)',
                        color: isDefault ? '#4CAF50' : '#E040FB',
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700
                      }}>
                        {isDefault ? 'BAWAAN' : 'KUSTOM'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setUploadIndId(ind.id)}
                          style={{ background: '#2196F3', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                          title="Upload nilai CSV per saham"
                        >
                          📤 CSV
                        </button>
                        {!isDefault && (
                          <button
                            onClick={() => handleDelete(ind)}
                            style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}
                            title="Hapus Indikator Kustom"
                          >
                            🗑 Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {indicators.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Tidak ada indikator terdaftar</div>
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6
}

const formInputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box'
}
