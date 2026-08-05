'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface Option { value: number; text: string }
interface Question { id: string; category: string; question: string; options: Option[] }
interface Indicator { id: string; name: string; type: 'benefit' | 'cost'; description?: string }
interface Profile { id: string; name: string; description: string; min_score_threshold: number; max_score_threshold: number; weights: Record<string, number> }

const CATEGORY_LABELS: Record<string, string> = {
  k1_target_keuntungan: 'K1 - Target Keuntungan',
  k2_kualitas_perusahaan: 'K2 - Kualitas Perusahaan',
  k3_toleransi_risiko: 'K3 - Toleransi Risiko',
  k4_sensitivitas_harga: 'K4 - Sensitivitas Harga',
  k5_kapasitas_finansial: 'K5 - Kapasitas Finansial',
}

const DEFAULT_INDICATORS_IDS = ['ai_score', 'roe', 'der', 'pbv', 'per']

export default function AdminSPKPage() {
  const [activeTab, setActiveTab] = useState<'questions' | 'profiles' | 'indicators'>('questions')
  const [questions, setQuestions] = useState<Question[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: 'ok' as 'ok' | 'err' })
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(CATEGORY_LABELS)))

  // State Form Tambah Pertanyaan Dinamis
  const [isAddingQuestion, setIsAddingQuestion] = useState(false)
  const [newCat, setNewCat] = useState('k1_target_keuntungan')
  const [newCatCustom, setNewCatCustom] = useState('')
  const [newQuestionText, setNewQuestionText] = useState('')
  const [newOptions, setNewOptions] = useState<Option[]>([
    { value: 1, text: '' },
    { value: 3, text: '' },
    { value: 5, text: '' }
  ])

  // State Form Tambah Profil Risiko Dinamis
  const [isAddingProfile, setIsAddingProfile] = useState(false)
  const [newProfileId, setNewProfileId] = useState('')
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileDesc, setNewProfileDesc] = useState('')
  const [newProfileMin, setNewProfileMin] = useState(0)
  const [newProfileMax, setNewProfileMax] = useState(35)
  const [newProfileWeights, setNewProfileWeights] = useState<Record<string, number>>({})

  // State Form Tambah Indikator Baru Dinamis
  const [isAddingIndicator, setIsAddingIndicator] = useState(false)
  const [newIndId, setNewIndId] = useState('')
  const [newIndName, setNewIndName] = useState('')
  const [newIndType, setNewIndType] = useState<'benefit' | 'cost'>('benefit')
  const [newIndDesc, setNewIndDesc] = useState('')

  // State Editing
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [qRes, pRes, iRes] = await Promise.all([
        api.get('/admin/users/questions/').catch(() => ({ data: [] })),
        api.get('/admin/risk-profiles/').catch(() => ({ data: [] })),
        api.get('/admin/indicators/').catch(() => ({ data: [] })),
      ])
      setQuestions(qRes.data)
      setProfiles(pRes.data)
      setIndicators(iRes.data)

      // Inisialisasi bobot rata untuk profil baru
      const initW: Record<string, number> = {}
      const count = iRes.data.length || 1
      iRes.data.forEach((ind: Indicator) => {
        initW[ind.id] = parseFloat((1.0 / count).toFixed(2))
      })
      setNewProfileWeights(initW)

      // Expand kategori yang ada
      const cats = new Set(Object.keys(CATEGORY_LABELS))
      qRes.data.forEach((q: Question) => cats.add(q.category))
      setExpandedCategories(cats)
    } catch {
      showMsg('Gagal memuat data SPK', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 4500)
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // ── Handlers Pertanyaan (Tab 1) ──────────────────────────────────────────────

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetCategory = newCat === 'custom' ? newCatCustom.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : newCat
    if (!targetCategory || !newQuestionText.trim()) {
      showMsg('Kategori dan teks pertanyaan wajib diisi', 'err')
      return
    }
    if (newOptions.some(o => !o.text.trim())) {
      showMsg('Semua pilihan jawaban wajib memiliki teks deskripsi', 'err')
      return
    }

    try {
      await api.post('/admin/users/questions/', {
        category: targetCategory,
        question: newQuestionText.trim(),
        options: newOptions.sort((a, b) => a.value - b.value)
      })
      showMsg('✅ Pertanyaan baru berhasil ditambahkan!')
      setIsAddingQuestion(false)
      setNewQuestionText('')
      setNewOptions([{ value: 1, text: '' }, { value: 3, text: '' }, { value: 5, text: '' }])
      loadData()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    }
  }

  const handleSaveQuestion = async (q: Question) => {
    try {
      await api.put(`/admin/users/questions/${q.id}`, { question: q.question, options: q.options.sort((a, b) => a.value - b.value) })
      showMsg('✅ Pertanyaan berhasil diperbarui')
      setEditingQuestion(null)
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || 'Gagal menyimpan'}`, 'err')
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm(`Hapus pertanyaan ${id.toUpperCase()} ini?`)) return
    try {
      await api.delete(`/admin/users/questions/${id}`)
      showMsg('✅ Pertanyaan berhasil dihapus')
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || 'Gagal menghapus'}`, 'err')
    }
  }

  // ── Handlers Profil Risiko (Tab 2) ──────────────────────────────────────────

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanId = newProfileId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!cleanId || !newProfileName.trim()) {
      showMsg('ID dan Nama profil wajib diisi', 'err')
      return
    }

    // Validasi total bobot = 100%
    const totalW = parseFloat(Object.values(newProfileWeights).reduce((sum, v) => sum + v, 0).toFixed(4))
    if (Math.abs(totalW - 1.0) > 1e-4) {
      showMsg(`❌ Total bobot kriteria harus tepat 1.0 (100%). Total Anda: ${(totalW * 100).toFixed(0)}%`, 'err')
      return
    }

    try {
      await api.post('/admin/risk-profiles/', {
        id: cleanId,
        name: newProfileName.trim(),
        description: newProfileDesc.trim(),
        min_score_threshold: newProfileMin,
        max_score_threshold: newProfileMax,
        weights: newProfileWeights
      })
      showMsg('✅ Profil risiko baru berhasil dibuat!')
      setIsAddingProfile(false)
      setNewProfileId('')
      setNewProfileName('')
      setNewProfileDesc('')
      loadData()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    }
  }

  const handleSaveProfile = async (p: Profile) => {
    const totalW = parseFloat(Object.values(p.weights || {}).reduce((sum, v) => sum + (v as number), 0).toFixed(4))
    if (Math.abs(totalW - 1.0) > 1e-4) {
      showMsg(`❌ Total bobot kriteria harus tepat 1.0 (100%). Total Anda: ${(totalW * 100).toFixed(0)}%`, 'err')
      return
    }

    try {
      await api.put(`/admin/risk-profiles/${p.id}`, {
        name: p.name,
        description: p.description,
        min_score_threshold: p.min_score_threshold,
        max_score_threshold: p.max_score_threshold,
        weights: p.weights
      })
      showMsg('✅ Profil risiko berhasil diperbarui')
      setEditingProfile(null)
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || 'Gagal menyimpan'}`, 'err')
    }
  }

  const handleDeleteProfile = async (id: string) => {
    if (['konservatif', 'moderat', 'agresif'].includes(id)) {
      showMsg('Profil bawaan sistem tidak bisa dihapus', 'err')
      return
    }
    if (!confirm(`Hapus profil risiko ${id.toUpperCase()}?`)) return
    try {
      await api.delete(`/admin/risk-profiles/${id}`)
      showMsg('✅ Profil risiko berhasil dihapus')
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || 'Gagal menghapus'}`, 'err')
    }
  }

  // ── Handlers Indikator (Tab 3) ──────────────────────────────────────────────

  const handleCreateIndicator = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanId = newIndId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!cleanId || !newIndName.trim()) {
      showMsg('ID dan Nama Indikator wajib diisi', 'err')
      return
    }

    try {
      await api.post('/admin/indicators/', {
        id: cleanId,
        name: newIndName.trim(),
        type: newIndType,
        description: newIndDesc.trim()
      })
      showMsg('✅ Indikator baru berhasil ditambahkan!')
      setIsAddingIndicator(false)
      setNewIndId('')
      setNewIndName('')
      setNewIndDesc('')
      loadData()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    }
  }

  const handleSaveIndicator = async (ind: Indicator) => {
    try {
      await api.put(`/admin/indicators/${ind.id}`, {
        id: ind.id,
        name: ind.name,
        type: ind.type,
        description: ind.description || ''
      })
      showMsg('✅ Indikator berhasil diperbarui')
      setEditingIndicator(null)
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || 'Gagal menyimpan'}`, 'err')
    }
  }

  const handleDeleteIndicator = async (id: string) => {
    if (DEFAULT_INDICATORS_IDS.includes(id)) {
      showMsg('Indikator default bawaan tidak bisa dihapus', 'err')
      return
    }
    if (!confirm(`Hapus indikator ${id.toUpperCase()}?`)) return
    try {
      await api.delete(`/admin/indicators/${id}`)
      showMsg('✅ Indikator berhasil dihapus')
      loadData()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || 'Gagal menghapus'}`, 'err')
    }
  }

  // Pengelompokan Kategori Pertanyaan
  const allCategoryKeys = Array.from(new Set([...Object.keys(CATEGORY_LABELS), ...questions.map(q => q.category)]))
  const questionsByCategory = allCategoryKeys.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || `Kategori: ${cat.toUpperCase()}`,
    questions: questions.filter(q => q.category === cat)
  }))

  const btnPrimary = { background: 'var(--accent, #2196F3)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' as const }
  const btnDanger = { ...btnPrimary, background: '#ef4444' }
  const btnSuccess = { ...btnPrimary, background: '#10b981' }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>🧮 Master Pengaturan SPK</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '14px' }}>Kelola Kuesioner (N-Opsi), Profil Risiko Dinamis, dan Indikator SAW secara Real-Time</p>
        </div>
      </div>

      {msg.text && (
        <div style={{
          background: msg.type === 'ok' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${msg.type === 'ok' ? '#10b981' : '#ef4444'}`,
          borderRadius: '10px', padding: '12px 18px', marginBottom: '24px', fontSize: '14px', fontWeight: 600,
          color: msg.type === 'ok' ? '#10b981' : '#ef4444'
        }}>
          {msg.text}
        </div>
      )}

      {/* Tabs Navigasi */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {[
          { key: 'questions', label: '📋 Kuesioner (N-Opsi)', count: questions.length },
          { key: 'profiles', label: '🎯 Profil Risiko & Bobot', count: profiles.length },
          { key: 'indicators', label: '📊 Indikator SAW', count: indicators.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.key ? 'var(--accent, #2196F3)' : 'transparent',
              color: activeTab === tab.key ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--accent, #2196F3)' : '3px solid transparent',
              borderRadius: '10px 10px 0 0',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              marginBottom: '-1px',
              transition: 'all 0.2s ease'
            }}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', fontSize: '15px' }}>Memuat data SPK...</div>
      ) : (
        <>
          {/* TAB 1: KUESIONER */}
          {activeTab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsAddingQuestion(v => !v)}
                  style={{ ...btnSuccess, padding: '10px 18px', fontSize: 13 }}
                >
                  {isAddingQuestion ? '✕ Tutup Form' : '➕ Tambah Pertanyaan Baru'}
                </button>
              </div>

              {/* Form Tambah Pertanyaan Baru */}
              {isAddingQuestion && (
                <form onSubmit={handleCreateQuestion} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>➕ Buat Pertanyaan Kuesioner Baru</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Kategori Kriteria</label>
                      <select value={newCat} onChange={e => setNewCat(e.target.value)} style={inputStyle}>
                        {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                        <option value="custom">➕ Kategori Kustom Baru...</option>
                      </select>
                    </div>

                    {newCat === 'custom' && (
                      <div>
                        <label style={labelStyle}>Nama Kategori Baru</label>
                        <input
                          type="text"
                          value={newCatCustom}
                          onChange={e => setNewCatCustom(e.target.value)}
                          placeholder="misal: k6_horizon_waktu"
                          style={inputStyle}
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label style={labelStyle}>Teks Pertanyaan</label>
                      <textarea
                        value={newQuestionText}
                        onChange={e => setNewQuestionText(e.target.value)}
                        placeholder="Masukkan teks pertanyaan..."
                        rows={3}
                        style={inputStyle}
                        required
                      />
                    </div>

                    {/* Builder N-Opsi Dinamis */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={labelStyle}>Pilihan Jawaban & Bobot Nilai (N-Opsi Dinamis)</label>
                        <button
                          type="button"
                          onClick={() => setNewOptions(prev => [...prev, { value: prev.length + 1, text: '' }])}
                          style={{ background: 'rgba(33,150,243,0.15)', color: '#2196F3', border: '1px solid #2196F3', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          ➕ Tambah Opsi
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {newOptions.map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#888', minWidth: 50 }}>Poin:</span>
                            <input
                              type="number"
                              value={opt.value}
                              onChange={e => {
                                const copy = [...newOptions]
                                copy[idx].value = parseInt(e.target.value) || 0
                                setNewOptions(copy)
                              }}
                              style={{ ...inputStyle, width: 70, textAlign: 'center' }}
                              required
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={e => {
                                const copy = [...newOptions]
                                copy[idx].text = e.target.value
                                setNewOptions(copy)
                              }}
                              placeholder={`Teks pilihan jawaban ke-${idx + 1}...`}
                              style={{ ...inputStyle, flex: 1 }}
                              required
                            />
                            {newOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setNewOptions(prev => prev.filter((_, i) => i !== idx))}
                                style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                      <button type="submit" style={btnSuccess}>💾 Simpan Pertanyaan</button>
                      <button type="button" onClick={() => setIsAddingQuestion(false)} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>Batal</button>
                    </div>
                  </div>
                </form>
              )}

              {/* Accordion Kategori Pertanyaan */}
              {questionsByCategory.map(({ category, label, questions: catQuestions }) => (
                <div key={category} style={{
                  background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden'
                }}>
                  <div onClick={() => toggleCategory(category)} style={{
                    padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg-hover)', borderLeft: '4px solid var(--accent, #2196F3)'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{catQuestions.length} pertanyaan</span>
                      <span>{expandedCategories.has(category) ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {expandedCategories.has(category) && (
                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {catQuestions.map(q => (
                        <div key={q.id} style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
                          {editingQuestion?.id === q.id ? (
                            <QuestionEditForm question={editingQuestion} onSave={handleSaveQuestion} onCancel={() => setEditingQuestion(null)} />
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '16px' }}>
                                <div>
                                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: '#888', marginRight: 8 }}>
                                    {q.id.toUpperCase()}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{q.question}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => setEditingQuestion(q)} style={btnPrimary}>✏️ Edit</button>
                                  <button onClick={() => handleDeleteQuestion(q.id)} style={btnDanger}>🗑️</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {q.options.sort((a, b) => a.value - b.value).map((opt, i) => (
                                  <span key={i} style={{
                                    background: opt.value <= 2 ? 'rgba(16, 185, 129, 0.12)' : opt.value <= 4 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                    color: opt.value <= 2 ? '#059669' : opt.value <= 4 ? '#d97706' : '#dc2626',
                                    border: `1px solid ${opt.value <= 2 ? 'rgba(16, 185, 129, 0.3)' : opt.value <= 4 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                    padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700
                                  }}>
                                    Skor {opt.value}: {opt.text}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: PROFIL RISIKO */}
          {activeTab === 'profiles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsAddingProfile(v => !v)}
                  style={{ ...btnSuccess, padding: '10px 18px', fontSize: 13 }}
                >
                  {isAddingProfile ? '✕ Tutup Form' : '➕ Tambah Profil Risiko Baru'}
                </button>
              </div>

              {/* Form Tambah Profil Risiko Baru */}
              {isAddingProfile && (
                <form onSubmit={handleCreateProfile} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>➕ Buat Profil Risiko Baru</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>ID Profil (Huruf kecil, angka, underscore)</label>
                      <input
                        type="text"
                        value={newProfileId}
                        onChange={e => setNewProfileId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="misal: dividen_hunter"
                        style={inputStyle}
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Nama Profil (Tampilan UI)</label>
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={e => setNewProfileName(e.target.value)}
                        placeholder="misal: Dividen Hunter"
                        style={inputStyle}
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Deskripsi Profil</label>
                      <textarea
                        value={newProfileDesc}
                        onChange={e => setNewProfileDesc(e.target.value)}
                        placeholder="Deskripsi strategi profil risiko ini..."
                        rows={2}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: 'var(--bg-primary)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div>
                        <label style={labelStyle}>Rentang Skor Min (%)</label>
                        <input type="number" min={0} max={100} value={newProfileMin} onChange={e => setNewProfileMin(parseInt(e.target.value) || 0)} style={inputStyle} required />
                      </div>
                      <div>
                        <label style={labelStyle}>Rentang Skor Max (%)</label>
                        <input type="number" min={0} max={100} value={newProfileMax} onChange={e => setNewProfileMax(parseInt(e.target.value) || 0)} style={inputStyle} required />
                      </div>
                    </div>

                    {/* Dynamic Sliders for ALL Active Indicators */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={labelStyle}>Bobot Kriteria SAW Dinamis (Total 100%)</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: Math.abs(Object.values(newProfileWeights).reduce((a,b)=>a+b,0) - 1.0) < 1e-4 ? '#10b981' : '#ef4444' }}>
                          Total: {(Object.values(newProfileWeights).reduce((a,b)=>a+b,0) * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {indicators.map(ind => (
                          <div key={ind.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span>{ind.name} ({ind.id})</span>
                              <span style={{ fontWeight: 700 }}>{((newProfileWeights[ind.id] || 0) * 100).toFixed(0)}%</span>
                            </div>
                            <input
                              type="range" min={0} max={1} step={0.05}
                              value={newProfileWeights[ind.id] || 0}
                              onChange={e => setNewProfileWeights({ ...newProfileWeights, [ind.id]: parseFloat(e.target.value) })}
                              style={{ width: '100%', accentColor: 'var(--accent, #2196F3)' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                      <button type="submit" style={btnSuccess}>💾 Simpan Profil Baru</button>
                      <button type="button" onClick={() => setIsAddingProfile(false)} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>Batal</button>
                    </div>
                  </div>
                </form>
              )}

              {/* Grid Daftar Profil */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {profiles.map(p => (
                  <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
                    {editingProfile?.id === p.id ? (
                      <ProfileEditForm profile={editingProfile} indicators={indicators} onSave={handleSaveProfile} onCancel={() => setEditingProfile(null)} />
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{p.name}</h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Threshold Skor: {p.min_score_threshold}% - {p.max_score_threshold}%</span>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            background: ['konservatif', 'moderat', 'agresif'].includes(p.id) ? 'rgba(33,150,243,0.15)' : 'rgba(168,85,247,0.15)',
                            color: ['konservatif', 'moderat', 'agresif'].includes(p.id) ? '#2196F3' : '#a855f7',
                            padding: '4px 10px', borderRadius: '6px', fontWeight: 800
                          }}>
                            {['konservatif', 'moderat', 'agresif'].includes(p.id) ? 'BAWAAN' : 'KUSTOM'}
                          </span>
                        </div>

                        <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--bg-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.5px' }}>BOBOT KRITERIA SAW</div>
                          {Object.entries(p.weights || {}).map(([key, val]) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <span style={{ width: '85px', fontSize: '11px', fontWeight: 700 }}>{key.toUpperCase()}</span>
                              <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${(val as number) * 100}%`, height: '100%', background: 'var(--accent, #2196F3)', borderRadius: '4px' }} />
                              </div>
                              <span style={{ width: '40px', fontSize: '11px', textAlign: 'right', fontWeight: 700 }}>{(val as number * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => setEditingProfile(p)} style={{ flex: 1, ...btnPrimary }}>✏️ Edit Profil</button>
                          {!['konservatif', 'moderat', 'agresif'].includes(p.id) && (
                            <button onClick={() => handleDeleteProfile(p.id)} style={btnDanger}>🗑️</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: INDIKATOR */}
          {activeTab === 'indicators' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsAddingIndicator(v => !v)}
                  style={{ ...btnSuccess, padding: '10px 18px', fontSize: 13 }}
                >
                  {isAddingIndicator ? '✕ Tutup Form' : '➕ Tambah Indikator Baru'}
                </button>
              </div>

              {/* Form Tambah Indikator Baru */}
              {isAddingIndicator && (
                <form onSubmit={handleCreateIndicator} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>➕ Tambah Indikator SAW Baru</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>ID Indikator (Huruf kecil, angka, underscore)</label>
                      <input
                        type="text"
                        value={newIndId}
                        onChange={e => setNewIndId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="misal: div_yield"
                        style={inputStyle}
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Nama Tampilan Indikator</label>
                      <input
                        type="text"
                        value={newIndName}
                        onChange={e => setNewIndName(e.target.value)}
                        placeholder="misal: Persentase Dividen (Yield)"
                        style={inputStyle}
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Tipe Kriteria SAW</label>
                      <select value={newIndType} onChange={e => setNewIndType(e.target.value as 'benefit' | 'cost')} style={inputStyle}>
                        <option value="benefit">Benefit (Makin Besar Makin Baik)</option>
                        <option value="cost">Cost (Makin Kecil Makin Baik / Aman)</option>
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Deskripsi Indikator</label>
                      <textarea
                        value={newIndDesc}
                        onChange={e => setNewIndDesc(e.target.value)}
                        placeholder="Deskripsi penjelasan indikator ini..."
                        rows={2}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                      <button type="submit" style={btnSuccess}>💾 Simpan Indikator Baru</button>
                      <button type="button" onClick={() => setIsAddingIndicator(false)} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>Batal</button>
                    </div>
                  </div>
                </form>
              )}

              {/* Tabel Indikator */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                      {['ID', 'Nama Tampilan', 'Tipe', 'Deskripsi', 'Aksi'].map(h => (
                        <th key={h} style={{ padding: '14px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.map(ind => (
                      <tr key={ind.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent, #2196F3)', fontSize: '13px' }}>{ind.id}</td>
                        <td style={{ padding: '14px 18px', fontWeight: 600, fontSize: '13px' }}>
                          {editingIndicator?.id === ind.id ? (
                            <input value={editingIndicator.name} onChange={e => setEditingIndicator({ ...editingIndicator, name: e.target.value })} style={inputStyle} />
                          ) : ind.name}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            background: ind.type === 'benefit' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: ind.type === 'benefit' ? '#059669' : '#dc2626',
                            border: `1px solid ${ind.type === 'benefit' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                          }}>
                            {ind.type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', fontSize: '12px', color: 'var(--text-secondary)' }}>{ind.description || '—'}</td>
                        <td style={{ padding: '14px 18px' }}>
                          {editingIndicator?.id === ind.id ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleSaveIndicator(editingIndicator)} style={btnSuccess}>💾</button>
                              <button onClick={() => setEditingIndicator(null)} style={{ ...btnPrimary, background: '#555' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => setEditingIndicator(ind)} style={btnPrimary}>✏️</button>
                              {!DEFAULT_INDICATORS_IDS.includes(ind.id) && (
                                <button onClick={() => handleDeleteIndicator(ind.id)} style={btnDanger}>🗑️</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4
}

const inputStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box' as const
}

function QuestionEditForm({ question, onSave, onCancel }: { question: Question; onSave: (q: Question) => void; onCancel: () => void }) {
  const [q, setQ] = useState(question)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <textarea value={q.question} onChange={e => setQ({ ...q, question: e.target.value })} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {q.options.sort((a, b) => a.value - b.value).map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, minWidth: 50 }}>Skor {opt.value}</span>
            <input value={opt.text} onChange={e => { const newOpts = [...q.options]; newOpts[i] = { ...opt, text: e.target.value }; setQ({ ...q, options: newOpts }) }} style={{ flex: 1, ...inputStyle }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button onClick={onCancel} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>Batal</button>
        <button onClick={() => onSave(q)} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>💾 Simpan</button>
      </div>
    </div>
  )
}

function ProfileEditForm({ profile, indicators, onSave, onCancel }: { profile: Profile; indicators: Indicator[]; onSave: (p: Profile) => void; onCancel: () => void }) {
  const [p, setP] = useState(profile)
  const totalWeight = Object.values(p.weights || {}).reduce((sum, v) => sum + (v as number), 0)
  const isValid = Math.abs(totalWeight - 1.0) < 1e-4

  const updateWeight = (key: string, val: number) => { setP({ ...p, weights: { ...p.weights, [key]: val } }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={labelStyle}>Nama Profil</label>
        <input value={p.name} onChange={e => setP({ ...p, name: e.target.value })} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>Skor Min (%)</label>
          <input type="number" value={p.min_score_threshold} onChange={e => setP({ ...p, min_score_threshold: parseInt(e.target.value) || 0 })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Skor Max (%)</label>
          <input type="number" value={p.max_score_threshold} onChange={e => setP({ ...p, max_score_threshold: parseInt(e.target.value) || 100 })} style={inputStyle} />
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>Bobot Kriteria SAW</span>
          <span style={{ fontSize: '12px', color: isValid ? '#10b981' : '#ef4444', fontWeight: 800 }}>Total: {(totalWeight * 100).toFixed(0)}% {isValid ? '✅' : '❌'}</span>
        </div>
        {indicators.map(ind => (
          <div key={ind.id} style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '3px' }}>
              <span>{ind.name} ({ind.id})</span>
              <span>{(((p.weights?.[ind.id] as number) || 0) * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={p.weights?.[ind.id] as number || 0} onChange={e => updateWeight(ind.id, parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent, #2196F3)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
        <button onClick={onCancel} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>Batal</button>
        <button onClick={() => isValid && onSave(p)} disabled={!isValid} style={{ background: isValid ? '#10b981' : '#555', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: isValid ? 'pointer' : 'not-allowed', fontWeight: 700 }}>💾 Simpan Profil</button>
      </div>
    </div>
  )
}
