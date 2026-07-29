'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface RiskProfileData {
  id: string
  name: string
  description: string
  min_score_threshold: number
  max_score_threshold: number
  weights: Record<string, number>
}

interface IndicatorItem {
  id: string
  name: string
  type: string
}

const DEFAULT_INDICATORS: IndicatorItem[] = [
  { id: 'ai_score', name: '🤖 AI Momentum Score', type: 'benefit' },
  { id: 'roe', name: '📈 ROE Profitabilitas', type: 'benefit' },
  { id: 'der', name: '📉 DER Solvabilitas', type: 'cost' },
  { id: 'pbv', name: '📊 PBV Valuasi Aset', type: 'cost' },
  { id: 'per', name: '🏷️ PER Valuasi Laba', type: 'cost' }
]

export default function AdminRiskProfilesPage() {
  const [profiles, setProfiles] = useState<RiskProfileData[]>([])
  const [indicatorsList, setIndicatorsList] = useState<IndicatorItem[]>(DEFAULT_INDICATORS)
  const [loading, setLoading] = useState(true)
  
  // Form State - Add / Edit Profile
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [maxScore, setMaxScore] = useState(30)
  const [formWeights, setFormWeights] = useState<Record<string, number>>({
    ai_score: 0.20,
    roe: 0.20,
    der: 0.20,
    pbv: 0.20,
    per: 0.20
  })

  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')

  const loadData = async () => {
    setLoading(true)
    try {
      const [pRes, iRes] = await Promise.all([
        api.get('/admin/risk-profiles/'),
        api.get('/admin/indicators/').catch(() => null)
      ])
      setProfiles(pRes.data)
      if (iRes?.data && Array.isArray(iRes.data) && iRes.data.length > 0) {
        setIndicatorsList(iRes.data.map((ind: any) => ({
          id: ind.id,
          name: ind.name || ind.id,
          type: ind.type || 'benefit'
        })))
      }
    } catch (e: any) {
      showMsg(e.response?.data?.detail || 'Gagal memuat profil', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  const handleEditInit = (p: RiskProfileData) => {
    setId(p.id)
    setName(p.name)
    setDescription(p.description || '')
    setMinScore(p.min_score_threshold)
    setMaxScore(p.max_score_threshold)
    
    // Inisialisasi bobot untuk semua indikator aktif
    const initialWeights: Record<string, number> = {}
    const count = indicatorsList.length || 1
    const equalWeight = parseFloat((1.0 / count).toFixed(2))
    
    indicatorsList.forEach(ind => {
      initialWeights[ind.id] = p.weights?.[ind.id] ?? equalWeight
    })
    setFormWeights(initialWeights)
    
    setIsEditing(true)
    setIsAdding(false)
  }

  const handleAddInit = () => {
    setId('')
    setName('')
    setDescription('')
    setMinScore(0)
    setMaxScore(30)
    
    const initialWeights: Record<string, number> = {}
    const count = indicatorsList.length || 1
    const equalWeight = parseFloat((1.0 / count).toFixed(2))
    indicatorsList.forEach(ind => {
      initialWeights[ind.id] = equalWeight
    })
    setFormWeights(initialWeights)
    
    setIsAdding(true)
    setIsEditing(false)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validasi total bobot kriteria = 100%
    const total = parseFloat(Object.values(formWeights).reduce((sum, val) => sum + val, 0).toFixed(4))
    if (Math.abs(total - 1.0) > 1e-4) {
      showMsg(`❌ Total bobot kriteria harus tepat 1.0 (100%). Total Anda: ${(total * 100).toFixed(1)}%`, 'err')
      return
    }

    const payload = {
      name,
      description,
      min_score_threshold: minScore,
      max_score_threshold: maxScore,
      weights: formWeights
    }

    try {
      if (isAdding) {
        await api.post('/admin/risk-profiles/', { ...payload, id })
        showMsg('✅ Profil risiko baru berhasil dibuat!')
      } else {
        await api.put(`/admin/risk-profiles/${id}`, payload)
        showMsg('✅ Profil risiko berhasil diperbarui!')
      }
      setIsAdding(false)
      setIsEditing(false)
      loadData()
    } catch (err: any) {
      showMsg(`❌ ${err.response?.data?.detail || err.message}`, 'err')
    }
  }

  const totalWeight = Object.values(formWeights).reduce((sum, val) => sum + val, 0)
  const isWeightValid = Math.abs(totalWeight - 1.0) < 1e-4

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>⚙️ Master Data Profil Risiko</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Daftar seluruh profil risiko aktif di sistem StoxArea.
          </p>
        </div>
        {!isAdding && !isEditing && (
          <button onClick={handleAddInit} style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ➕ Tambah Profil Risiko
          </button>
        )}
      </div>

      {msg && (
        <div style={{
          background: msgType === 'ok' ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
          border: `1px solid ${msgType === 'ok' ? '#4CAF50' : '#f44'}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
          fontSize: 13, color: msgType === 'ok' ? '#4CAF50' : '#f44',
        }}>
          {msg}
        </div>
      )}

      {loading && !isAdding && !isEditing && <p style={{ color: '#888' }}>Memuat data profil...</p>}

      {/* DAFTAR PROFIL RISIKO */}
      {!loading && !isAdding && !isEditing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {profiles.map(p => {
            const isDefault = ['konservatif', 'moderat', 'agresif'].includes(p.id.toLowerCase())
            return (
              <div key={p.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{p.name}</h3>
                  <span style={{ fontSize: 10, background: isDefault ? 'rgba(33,150,243,0.15)' : 'rgba(156,39,176,0.15)', color: isDefault ? '#2196F3' : '#E040FB', padding: '2px 6px', borderRadius: 5, fontWeight: 600 }}>
                    {isDefault ? 'BAWAAN' : 'KUSTOM'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>{p.description || 'Tidak ada deskripsi.'}</p>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  🔑 <b>Skor Onboarding:</b> {p.min_score_threshold} – {p.max_score_threshold}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 10, borderTop: '1px solid #222' }}>
                  <button onClick={() => handleEditInit(p)} style={{ flex: 1, background: 'rgba(33,150,243,0.15)', border: '1px solid #2196F3', color: '#2196F3', borderRadius: 6, padding: '6px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    ✏️ Edit Profil
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FORM TAMBAH / EDIT PROFIL */}
      {(isAdding || isEditing) && (
        <form onSubmit={handleSaveProfile} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
            {isAdding ? '➕ Tambah Profil Risiko Baru' : '✏️ Edit Profil Risiko'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', display: 'block', marginBottom: 6 }}>ID Profil (Huruf kecil, angka, underscore)</label>
              <input
                type="text" value={id} onChange={e => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="misal: agresif_fundamental"
                required
                disabled={isEditing}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', display: 'block', marginBottom: 6 }}>Nama Profil (Tampilan UI)</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="misal: Agresif Fundamental"
                required
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', display: 'block', marginBottom: 6 }}>Deskripsi</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Deskripsi profil risiko..."
                rows={3}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--bg-secondary)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 6 }}>Skor Minimal Onboarding</label>
                <input
                  type="number" value={minScore} onChange={e => setMinScore(parseInt(e.target.value) || 0)}
                  min={0} max={30}
                  required
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 6 }}>Skor Maksimal Onboarding</label>
                <input
                  type="number" value={maxScore} onChange={e => setMaxScore(parseInt(e.target.value) || 0)}
                  min={0} max={30}
                  required
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Sliders untuk Bobot Kriteria */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#aaa' }}>Bobot Kriteria SAW (Jumlah harus 100%)</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: isWeightValid ? '#4CAF50' : '#f44336' }}>
                  Total: {(totalWeight * 100).toFixed(0)}% {isWeightValid ? '✅' : '❌'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {indicatorsList.map(ind => (
                  <div key={ind.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>{ind.name}</span>
                      <span style={{ fontWeight: 600 }}>{((formWeights[ind.id] || 0.0) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.05} value={formWeights[ind.id] || 0.0}
                      onChange={e => setFormWeights({ ...formWeights, [ind.id]: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: ind.type === 'benefit' ? '#2196F3' : '#f44336' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button type="submit" style={{ flex: 1, background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              💾 Simpan Profil
            </button>
            <button type="button" onClick={() => { setIsAdding(false); setIsEditing(false); }} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 14, cursor: 'pointer' }}>
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
