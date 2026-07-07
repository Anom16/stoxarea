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

  // Create State
  const [isAdding, setIsAdding] = useState(false)
  const [addCategory, setAddCategory] = useState('k1_target_keuntungan')
  const [addQuestion, setAddQuestion] = useState('')
  const [addOpt1Val, setAddOpt1Val] = useState(1)
  const [addOpt1Text, setAddOpt1Text] = useState('')
  const [addOpt2Val, setAddOpt2Val] = useState(3)
  const [addOpt2Text, setAddOpt2Text] = useState('')
  const [addOpt3Val, setAddOpt3Val] = useState(5)
  const [addOpt3Text, setAddOpt3Text] = useState('')

  // Edit State
  const [editId, setEditId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editOpt1Val, setEditOpt1Val] = useState(1)
  const [editOpt1Text, setEditOpt1Text] = useState('')
  const [editOpt2Val, setEditOpt2Val] = useState(3)
  const [editOpt2Text, setEditOpt2Text] = useState('')
  const [editOpt3Val, setEditOpt3Val] = useState(5)
  const [editOpt3Text, setEditOpt3Text] = useState('')
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
    
    // Sort options by value
    const sorted = [...q.options].sort((a, b) => a.value - b.value)
    
    setEditOpt1Val(sorted[0]?.value ?? 1)
    setEditOpt1Text(sorted[0]?.text ?? '')
    
    setEditOpt2Val(sorted[1]?.value ?? 3)
    setEditOpt2Text(sorted[1]?.text ?? '')
    
    setEditOpt3Val(sorted[2]?.value ?? 5)
    setEditOpt3Text(sorted[2]?.text ?? '')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return

    if (!editQuestion.trim() || !editOpt1Text.trim() || !editOpt2Text.trim() || !editOpt3Text.trim()) {
      showMsg('❌ Semua kolom pertanyaan dan opsi wajib diisi.', 'err')
      return
    }

    setSaving(true)
    try {
      const payload = {
        question: editQuestion.trim(),
        options: [
          { value: editOpt1Val, text: editOpt1Text.trim() },
          { value: editOpt2Val, text: editOpt2Text.trim() },
          { value: editOpt3Val, text: editOpt3Text.trim() }
        ]
      }

      await api.put(`/admin/users/questions/${editId}`, payload)
      showMsg(`✅ Pertanyaan ${editId.toUpperCase()} berhasil diperbarui!`)
      setEditId(null)
      loadQuestions()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    } finally {
      setSaving(false)
    }
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addCategory || !addQuestion.trim() || !addOpt1Text.trim() || !addOpt2Text.trim() || !addOpt3Text.trim()) {
      showMsg('❌ Semua kolom pertanyaan dan pilihan jawaban wajib diisi.', 'err')
      return
    }

    setSaving(true)
    try {
      const payload = {
        category: addCategory,
        question: addQuestion.trim(),
        options: [
          { value: addOpt1Val, text: addOpt1Text.trim() },
          { value: addOpt2Val, text: addOpt2Text.trim() },
          { value: addOpt3Val, text: addOpt3Text.trim() }
        ]
      }

      const res = await api.post('/admin/users/questions/', payload)
      showMsg(`✅ Pertanyaan baru berhasil dibuat!`)
      setIsAdding(false)
      
      // Reset fields
      setAddQuestion('')
      setAddOpt1Val(1)
      setAddOpt1Text('')
      setAddOpt2Val(3)
      setAddOpt2Text('')
      setAddOpt3Val(5)
      setAddOpt3Text('')
      
      loadQuestions()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (qId: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus pertanyaan ${qId.toUpperCase()}?`)) return
    
    try {
      await api.delete(`/admin/users/questions/${qId}`)
      showMsg(`✅ Pertanyaan ${qId.toUpperCase()} berhasil dihapus!`)
      loadQuestions()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>❓ Kelola Kuesioner</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Atur teks pertanyaan onboarding (SPK Lapis 1), nilai skor opsi jawaban, serta tambah/hapus pertanyaan.
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(v => !v)}
          style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {isAdding ? '✕ Tutup Form' : '➕ Tambah Pertanyaan'}
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

      {/* Form Tambah Pertanyaan */}
      {isAdding && (
        <div style={{
          background: 'var(--card-bg, #16213e)', border: '1px solid var(--border, #2a2e3d)',
          borderRadius: 12, padding: 24, marginBottom: 24
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>➕ Tambah Pertanyaan Baru</h3>
          <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kategori Kriteria</label>
              <select
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
                style={selectStyle}
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Teks Pertanyaan</label>
              <textarea
                value={addQuestion}
                onChange={(e) => setAddQuestion(e.target.value)}
                style={textareaStyle}
                placeholder="Masukkan teks pertanyaan kuesioner..."
                rows={3}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={labelStyle}>Pilihan Jawaban & Nilai Skor</label>
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="number"
                  value={addOpt1Val}
                  onChange={(e) => setAddOpt1Val(parseInt(e.target.value) || 0)}
                  style={{ ...inputStyle, maxWidth: 80, textAlign: 'center' }}
                  placeholder="Skor"
                  required
                />
                <input
                  type="text"
                  value={addOpt1Text}
                  onChange={(e) => setAddOpt1Text(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Pernyataan opsi pertama (biasanya bernilai rendah)..."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="number"
                  value={addOpt2Val}
                  onChange={(e) => setAddOpt2Val(parseInt(e.target.value) || 0)}
                  style={{ ...inputStyle, maxWidth: 80, textAlign: 'center' }}
                  placeholder="Skor"
                  required
                />
                <input
                  type="text"
                  value={addOpt2Text}
                  onChange={(e) => setAddOpt2Text(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Pernyataan opsi kedua (biasanya bernilai menengah)..."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="number"
                  value={addOpt3Val}
                  onChange={(e) => setAddOpt3Val(parseInt(e.target.value) || 0)}
                  style={{ ...inputStyle, maxWidth: 80, textAlign: 'center' }}
                  placeholder="Skor"
                  required
                />
                <input
                  type="text"
                  value={addOpt3Text}
                  onChange={(e) => setAddOpt3Text(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Pernyataan opsi ketiga (biasanya bernilai tinggi)..."
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
                {saving ? 'Menyimpan...' : '💾 Simpan Pertanyaan'}
              </button>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
              >
                Batal
              </button>
            </div>
          </form>
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
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        onClick={() => startEdit(q)}
                        style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(q.id)}
                        style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}
                        title="Hapus Pertanyaan"
                      >
                        🗑 Hapus
                      </button>
                    </div>
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
                        <input
                          type="number"
                          value={editOpt1Val}
                          onChange={(e) => setEditOpt1Val(parseInt(e.target.value) || 0)}
                          style={{ ...inputStyle, maxWidth: 80, textAlign: 'center' }}
                          required
                        />
                        <input
                          type="text"
                          value={editOpt1Text}
                          onChange={(e) => setEditOpt1Text(e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input
                          type="number"
                          value={editOpt2Val}
                          onChange={(e) => setEditOpt2Val(parseInt(e.target.value) || 0)}
                          style={{ ...inputStyle, maxWidth: 80, textAlign: 'center' }}
                          required
                        />
                        <input
                          type="text"
                          value={editOpt2Text}
                          onChange={(e) => setEditOpt2Text(e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input
                          type="number"
                          value={editOpt3Val}
                          onChange={(e) => setEditOpt3Val(parseInt(e.target.value) || 0)}
                          style={{ ...inputStyle, maxWidth: 80, textAlign: 'center' }}
                          required
                        />
                        <input
                          type="text"
                          value={editOpt3Text}
                          onChange={(e) => setEditOpt3Text(e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
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
                          key={opt.value + '_' + opt.text} 
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
                            background: opt.value <= 2 ? 'rgba(76,175,80,0.1)' : opt.value <= 4 ? 'rgba(255,152,0,0.1)' : 'rgba(244,67,54,0.1)',
                            color: opt.value <= 2 ? '#4CAF50' : opt.value <= 4 ? '#FF9800' : '#f44336',
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
  background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, boxSizing: 'border-box', outline: 'none'
}

const selectStyle: React.CSSProperties = {
  width: '100%', background: '#0a0f1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, boxSizing: 'border-box', outline: 'none', cursor: 'pointer'
}
