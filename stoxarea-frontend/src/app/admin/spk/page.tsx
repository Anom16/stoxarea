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
    } catch { showMsg('Gagal memuat data', 'err') } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 4000)
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Question handlers
  const handleSaveQuestion = async (q: Question) => {
    try {
      await api.put(`/admin/users/questions/${q.id}`, { question: q.question, options: q.options.sort((a, b) => a.value - b.value) })
      showMsg('Pertanyaan berhasil diperbarui')
      setEditingQuestion(null)
      loadData()
    } catch (e: any) { showMsg(e?.response?.data?.detail || 'Gagal menyimpan', 'err') }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Hapus pertanyaan ini?')) return
    try { await api.delete(`/admin/users/questions/${id}`); showMsg('Pertanyaan dihapus'); loadData() }
    catch (e: any) { showMsg(e?.response?.data?.detail || 'Gagal menghapus', 'err') }
  }

  // Profile handlers
  const handleSaveProfile = async (p: Profile) => {
    try {
      await api.put(`/admin/risk-profiles/${p.id}`, { name: p.name, description: p.description, min_score_threshold: p.min_score_threshold, max_score_threshold: p.max_score_threshold, weights: p.weights })
      showMsg('Profil berhasil diperbarui')
      setEditingProfile(null)
      loadData()
    } catch (e: any) { showMsg(e?.response?.data?.detail || 'Gagal menyimpan', 'err') }
  }

  const handleDeleteProfile = async (id: string) => {
    if (['konservatif', 'moderat', 'agresif'].includes(id)) { showMsg('Profil bawaan tidak bisa dihapus', 'err'); return }
    if (!confirm('Hapus profil ini?')) return
    try { await api.delete(`/admin/risk-profiles/${id}`); showMsg('Profil dihapus'); loadData() }
    catch (e: any) { showMsg(e?.response?.data?.detail || 'Gagal menghapus', 'err') }
  }

  // Indicator handlers
  const handleSaveIndicator = async (ind: Indicator) => {
    try { await api.put(`/admin/indicators/${ind.id}`, { id: ind.id, name: ind.name, type: ind.type, description: ind.description || '' }); showMsg('Indikator berhasil diperbarui'); setEditingIndicator(null); loadData() }
    catch (e: any) { showMsg(e?.response?.data?.detail || 'Gagal menyimpan', 'err') }
  }

  const handleDeleteIndicator = async (id: string) => {
    if (DEFAULT_INDICATORS_IDS.includes(id)) { showMsg('Indikator default tidak bisa dihapus', 'err'); return }
    if (!confirm('Hapus indikator ini?')) return
    try { await api.delete(`/admin/indicators/${id}`); showMsg('Indikator dihapus'); loadData() }
    catch (e: any) { showMsg(e?.response?.data?.detail || 'Gagal menghapus', 'err') }
  }

  const questionsByCategory = Object.keys(CATEGORY_LABELS).map(cat => ({ category: cat, label: CATEGORY_LABELS[cat], questions: questions.filter(q => q.category === cat) }))

  const btnPrimary = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' as const }
  const btnDanger = { ...btnPrimary, background: 'var(--red, #ef4444)' }
  const btnSuccess = { ...btnPrimary, background: 'var(--green, #10b981)' }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>Pengaturan SPK</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>Kelola Kuesioner, Profil Risiko, dan Indikator SAW - Master Settings</p>

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {[
          { key: 'questions', label: '📋 Kuesioner', count: questions.length },
          { key: 'profiles', label: '🎯 Profil Risiko', count: profiles.length },
          { key: 'indicators', label: '📊 Indikator', count: indicators.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
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
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', fontSize: '15px' }}>Memuat data...</div>
      ) : (
        <>
          {/* TAB 1: QUESTIONS */}
          {activeTab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questionsByCategory.map(({ category, label, questions: catQuestions }) => (
                <div key={category} style={{
                  background: 'var(--bg-card)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
                  overflow: 'hidden'
                }}>
                  <div onClick={() => toggleCategory(category)}
                    style={{
                      padding: '18px 22px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-hover)',
                      borderLeft: '4px solid var(--accent)'
                    }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{catQuestions.length} pertanyaan</span>
                      <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>{expandedCategories.has(category) ? '▼' : '▶'}</span>
                    </div>
                  </div>
                  {expandedCategories.has(category) && (
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {catQuestions.map(q => (
                        <div key={q.id} style={{
                          background: 'var(--bg-primary)',
                          borderRadius: '12px',
                          padding: '18px',
                          border: '1px solid var(--border)'
                        }}>
                          {editingQuestion?.id === q.id ? (
                            <QuestionEditForm question={editingQuestion} onSave={handleSaveQuestion} onCancel={() => setEditingQuestion(null)} />
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '16px' }}>
                                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', flex: 1, lineHeight: 1.5 }}>{q.question}</div>
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                  <button onClick={() => setEditingQuestion(q)} style={btnPrimary}>✏️ Edit</button>
                                  <button onClick={() => handleDeleteQuestion(q.id)} style={btnDanger}>🗑️</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {q.options.sort((a, b) => a.value - b.value).map((opt, i) => (
                                  <span key={i} style={{
                                    background: opt.value <= 2 ? 'rgba(16, 185, 129, 0.12)' : opt.value <= 4 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                    color: opt.value <= 2 ? '#059669' : opt.value <= 4 ? '#d97706' : '#dc2626',
                                    border: `1px solid ${opt.value <= 2 ? 'rgba(16, 185, 129, 0.3)' : opt.value <= 4 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                    padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700
                                  }}>
                                    Skor {opt.value}: {opt.text.substring(0, 45)}{opt.text.length > 45 ? '...' : ''}
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

          {/* TAB 2: PROFILES */}
          {activeTab === 'profiles' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {profiles.map(p => (
                  <div key={p.id} style={{
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-card)'
                  }}>
                    {editingProfile?.id === p.id ? (
                      <ProfileEditForm profile={editingProfile} onSave={handleSaveProfile} onCancel={() => setEditingProfile(null)} />
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</h3>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Skor: {p.min_score_threshold} - {p.max_score_threshold}</span>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            background: ['konservatif', 'moderat', 'agresif'].includes(p.id) ? 'rgba(0, 102, 255, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                            color: ['konservatif', 'moderat', 'agresif'].includes(p.id) ? 'var(--accent)' : '#a855f7',
                            border: `1px solid ${['konservatif', 'moderat', 'agresif'].includes(p.id) ? 'rgba(0, 102, 255, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                            padding: '4px 10px', borderRadius: '6px', fontWeight: 800
                          }}>
                            {['konservatif', 'moderat', 'agresif'].includes(p.id) ? 'BAWAAN' : 'KUSTOM'}
                          </span>
                        </div>

                        <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '12px', letterSpacing: '0.5px' }}>BOBOT KRITERIA</div>
                          {Object.entries(p.weights || {}).map(([key, val]) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                              <span style={{ width: '85px', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>{key.toUpperCase()}</span>
                              <div style={{ flex: 1, height: '10px', background: 'var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${(val as number) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: '6px' }} />
                              </div>
                              <span style={{ width: '45px', fontSize: '12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{(val as number * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => setEditingProfile(p)} style={{ flex: 1, ...btnPrimary }}>✏️ Edit</button>
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

          {/* TAB 3: INDICATORS */}
          {activeTab === 'indicators' && (
            <div>
              <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                      {['ID', 'Nama', 'Tipe', 'Aksi'].map(h => (
                        <th key={h} style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.map(ind => (
                      <tr key={ind.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent)', fontSize: '14px' }}>{ind.id}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>
                          {editingIndicator?.id === ind.id ? (
                            <input value={editingIndicator.name} onChange={e => setEditingIndicator({ ...editingIndicator, name: e.target.value })} style={inputStyle} />
                          ) : ind.name}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            background: ind.type === 'benefit' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: ind.type === 'benefit' ? '#059669' : '#dc2626',
                            border: `1px solid ${ind.type === 'benefit' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 800
                          }}>
                            {ind.type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {editingIndicator?.id === ind.id ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleSaveIndicator(editingIndicator)} style={btnSuccess}>💾</button>
                              <button onClick={() => setEditingIndicator(null)} style={{ ...btnPrimary, background: 'var(--text-muted)' }}>✕</button>
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
              <div style={{ marginTop: '20px', padding: '14px 18px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                ℹ️ Indikator default (ai_score, roe, der, pbv, per) tidak dapat dihapus demi menjaga konsistensi kalkulasi SAW.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const inputStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box' as const
}

function QuestionEditForm({ question, onSave, onCancel }: { question: Question; onSave: (q: Question) => void; onCancel: () => void }) {
  const [q, setQ] = useState(question)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <textarea value={q.question} onChange={e => setQ({ ...q, question: e.target.value })} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {q.options.sort((a, b) => a.value - b.value).map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ width: '70px', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>Skor {opt.value}</span>
            <input value={opt.text} onChange={e => { const newOpts = [...q.options]; newOpts[i] = { ...opt, text: e.target.value }; setQ({ ...q, options: newOpts }) }} style={{ flex: 1, ...inputStyle }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
        <button onClick={onCancel} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
        <button onClick={() => onSave(q)} style={{ background: 'var(--green, #10b981)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: 'pointer', fontWeight: 700 }}>💾 Simpan</button>
      </div>
    </div>
  )
}

function ProfileEditForm({ profile, onSave, onCancel }: { profile: Profile; onSave: (p: Profile) => void; onCancel: () => void }) {
  const [p, setP] = useState(profile)
  const totalWeight = Object.values(p.weights || {}).reduce((sum, v) => sum + (v as number), 0)
  const isValid = Math.abs(totalWeight - 1.0) < 0.01

  const updateWeight = (key: string, val: number) => { setP({ ...p, weights: { ...p.weights, [key]: val } }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px' }}>Nama Profil</label>
        <input value={p.name} onChange={e => setP({ ...p, name: e.target.value })} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px' }}>Skor Min</label>
          <input type="number" value={p.min_score_threshold} onChange={e => setP({ ...p, min_score_threshold: parseInt(e.target.value) || 0 })} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px' }}>Skor Max</label>
          <input type="number" value={p.max_score_threshold} onChange={e => setP({ ...p, max_score_threshold: parseInt(e.target.value) || 50 })} style={inputStyle} />
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Bobot Kriteria</span>
          <span style={{ fontSize: '13px', color: isValid ? '#10b981' : '#ef4444', fontWeight: 800 }}>Total: {(totalWeight * 100).toFixed(0)}% {isValid ? '✅' : '❌'}</span>
        </div>
        {Object.keys(p.weights || {}).map(key => (
          <div key={key} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>
              <span>{key.toUpperCase()}</span>
              <span>{(((p.weights?.[key] as number) || 0) * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={p.weights?.[key] as number || 0} onChange={e => updateWeight(key, parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
        <button onClick={onCancel} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
        <button onClick={() => isValid && onSave(p)} disabled={!isValid} style={{ background: isValid ? '#10b981' : 'var(--border)', color: isValid ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: isValid ? 'pointer' : 'not-allowed', fontWeight: 700 }}>💾 Simpan</button>
      </div>
    </div>
  )
}
