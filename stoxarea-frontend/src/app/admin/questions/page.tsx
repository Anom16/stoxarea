'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface OptionData {
  value: number
  text: string
}

interface QuestionData {
  id: string
  category: string
  question: string
  options: OptionData[]
}

const CATEGORY_LABELS: Record<string, string> = {
  k1_target_keuntungan: 'K1 - Target Keuntungan',
  k2_kualitas_perusahaan: 'K2 - Kualitas Perusahaan',
  k3_toleransi_risiko: 'K3 - Toleransi Risiko',
  k4_sensitivitas_harga: 'K4 - Sensitivitas Harga',
  k5_kapasitas_finansial: 'K5 - Kapasitas Finansial',
}

const categoryColor = (cat: string) => {
  const c = cat.toLowerCase()
  if (c.includes('k1')) return '#2196F3'
  if (c.includes('k2')) return '#4CAF50'
  if (c.includes('k3')) return '#FF9800'
  if (c.includes('k4')) return '#E040FB'
  return '#00BCD4'
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')

  // Edit State
  const [editId, setEditId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editOpt1, setEditOpt1] = useState('')
  const [editOpt3, setEditOpt3] = useState('')
  const [editOpt5, setEditOpt5] = useState('')
  const [saving, setSaving] = useState(false)

  const loadQuestions = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users/questions/')
      setQuestions(res.data)
    } catch (err: any) {
      showMsg('❌ Gagal memuat kuesioner', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [])

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  const startEdit = (q: QuestionData) => {
    setEditId(q.id)
    setEditQuestion(q.question)
    
    // Extract options
    const o1 = q.options.find(o => o.value === 1)?.text || ''
    const o3 = q.options.find(o => o.value === 3)?.text || ''
    const o5 = q.options.find(o => o.value === 5)?.text || ''
    
    setEditOpt1(o1)
    setEditOpt3(o3)
    setEditOpt5(o5)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return

    if (!editQuestion.trim() || !editOpt1.trim() || !editOpt3.trim() || !editOpt5.trim()) {
      showMsg('❌ Semua kolom pertanyaan dan opsi wajib diisi.', 'err')
      return
    }

    setSaving(true)
    try {
      const payload = {
        question: editQuestion.trim(),
        options: [
          { value: 1, text: editOpt1.trim() },
          { value: 3, text: editOpt3.trim() },
          { value: 5, text: editOpt5.trim() }
        ]
      }

      await api.put(`/admin/users/questions/${editId}`, payload)
      showMsg(`✅ Pertanyaan ${editId} berhasil diperbarui!`)
      setEditId(null)
      loadQuestions()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>❓ Kelola Kuesioner</h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          Atur teks pertanyaan onboarding (SPK Lapis 1) dan bobot opsi pilihan jawabannya (1 / 3 / 5).
        </p>
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

      {loading ? (
        <p style={{ color: '#888', fontSize: 14 }}>Memuat pertanyaan...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questions.map((q) => {
            const isEditing = editId === q.id
            const catLabel = CATEGORY_LABELS[q.category] || q.category
            
            return (
              <div 
                key={q.id} 
                style={{ 
                  background: 'var(--card-bg, #16213e)', 
                  border: isEditing ? '1px solid var(--accent, #4CAF50)' : '1px solid var(--border, #2a2e3d)', 
                  borderRadius: 12, 
                  padding: 20,
                  transition: 'all 0.2s'
                }}
              >
                {/* Header Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#888' }}>
                      {q.id.toUpperCase()}
                    </span>
                    <span style={{ background: `${categoryColor(q.category)}22`, color: categoryColor(q.category), padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                      {catLabel}
                    </span>
                  </div>
                  
                  {!isEditing && (
                    <button 
                      onClick={() => startEdit(q)}
                      style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      ✏️ Edit Pertanyaan
                    </button>
                  )}
                </div>

                {isEditing ? (
                  /* Form Edit Mode */
                  <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                    <div>
                      <label style={labelStyle}>Teks Pertanyaan</label>
                      <textarea
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        style={textareaStyle}
                        rows={3}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <label style={labelStyle}>Pilihan Jawaban & Bobot Nilai</label>
                      
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={badgeStyle}>Skor 1 (Konservatif)</span>
                        <input
                          type="text"
                          value={editOpt1}
                          onChange={(e) => setEditOpt1(e.target.value)}
                          style={inputStyle}
                          placeholder="Pernyataan pilihan nilai 1..."
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={badgeStyle}>Skor 3 (Moderat)</span>
                        <input
                          type="text"
                          value={editOpt3}
                          onChange={(e) => setEditOpt3(e.target.value)}
                          style={inputStyle}
                          placeholder="Pernyataan pilihan nilai 3..."
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={badgeStyle}>Skor 5 (Agresif)</span>
                        <input
                          type="text"
                          value={editOpt5}
                          onChange={(e) => setEditOpt5(e.target.value)}
                          style={inputStyle}
                          placeholder="Pernyataan pilihan nilai 5..."
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button 
                        type="submit" 
                        disabled={saving}
                        style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setEditId(null)}
                        style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Display Mode */
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      {q.question}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((opt) => (
                        <div 
                          key={opt.value} 
                          style={{ 
                            display: 'flex', 
                            gap: 12, 
                            alignItems: 'flex-start',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            border: '1px solid rgba(255,255,255,0.03)'
                          }}
                        >
                          <span style={{ 
                            background: opt.value === 1 ? 'rgba(76,175,80,0.1)' : opt.value === 3 ? 'rgba(255,152,0,0.1)' : 'rgba(244,67,54,0.1)',
                            color: opt.value === 1 ? '#4CAF50' : opt.value === 3 ? '#FF9800' : '#f44336',
                            fontWeight: 700,
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 6,
                            minWidth: 54,
                            textAlign: 'center'
                          }}>
                            Skor {opt.value}
                          </span>
                          <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4 }}>
                            {opt.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6
}

const textareaStyle: React.CSSProperties = {
  width: '100%', background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit'
}

const inputStyle: React.CSSProperties = {
  flex: 1, background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, boxSizing: 'border-box', outline: 'none'
}

const badgeStyle: React.CSSProperties = {
  minWidth: 130, fontSize: 11, fontWeight: 700, color: '#888', background: 'rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: 8, textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)'
}
