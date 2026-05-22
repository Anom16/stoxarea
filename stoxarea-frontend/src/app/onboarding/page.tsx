'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

// Mapping profil risiko ke warna dan deskripsi untuk halaman verifikasi
const PROFILE_INFO: Record<string, { color: string; emoji: string; desc: string }> = {
  Konservatif: {
    color: '#3b82f6',
    emoji: '🛡️',
    desc: 'Anda mengutamakan keamanan modal. Analisis AI akan fokus pada emiten fundamental kuat dengan dividen stabil.',
  },
  Moderat: {
    color: '#f59e0b',
    emoji: '⚖️',
    desc: 'Anda menyeimbangkan antara pertumbuhan dan keamanan. Analisis AI akan menggabungkan momentum teknikal dan fundamental.',
  },
  Agresif: {
    color: '#10b981',
    emoji: '🚀',
    desc: 'Anda mengejar pertumbuhan maksimal. Analisis AI akan fokus pada emiten dengan momentum teknikal tertinggi.',
  },
}

export default function OnboardingPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<any[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  // Simpan satu jawaban per pertanyaan (bukan per kategori) agar lebih presisi
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State untuk halaman verifikasi hasil
  const [resultProfile, setResultProfile] = useState<string | null>(null)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const res = await api.get('/auth/questionnaire')
      setQuestions(res.data.data)
    } catch (err) {
      setError('Gagal memuat kuesioner. Pastikan server backend berjalan.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (value: number) => {
    // Simpan jawaban untuk pertanyaan saat ini
    const newAnswers = { ...answers, [currentStep]: value }
    setAnswers(newAnswers)

    if (currentStep < questions.length - 1) {
      // Masih ada pertanyaan berikutnya
      setCurrentStep(currentStep + 1)
    }
    // Jika ini pertanyaan terakhir, tidak perlu lakukan apa-apa —
    // tombol "Selesai & Lihat Hasil" akan muncul karena kondisi sudah terpenuhi
  }

  const buildPayload = (currentAnswers: Record<number, number>) => {
    // Kelompokkan jawaban per kategori
    const categoryScores: Record<string, number[]> = {}
    questions.forEach((q, idx) => {
      const score = currentAnswers[idx]
      if (score !== undefined) {
        if (!categoryScores[q.category]) categoryScores[q.category] = []
        categoryScores[q.category].push(score)
      }
    })

    // Ambil nilai yang paling sering muncul (mode) per kategori.
    // Lebih aman dari rata-rata karena hasilnya selalu 1, 3, atau 5.
    // Jika seri (misal [1, 5]), ambil yang lebih konservatif (nilai terkecil).
    const payload: Record<string, number> = {}
    Object.entries(categoryScores).forEach(([cat, scores]) => {
      const freq: Record<number, number> = {}
      scores.forEach(s => { freq[s] = (freq[s] || 0) + 1 })
      const maxFreq = Math.max(...Object.values(freq))
      const candidates = Object.keys(freq)
        .map(Number)
        .filter(s => freq[s] === maxFreq)
      // Jika seri, ambil nilai terkecil (lebih konservatif = lebih aman)
      payload[cat] = Math.min(...candidates)
    })

    return payload
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = buildPayload(answers)

      // Validasi payload sebelum kirim — pastikan semua 5 kategori ada
      const requiredKeys = [
        'k1_target_keuntungan',
        'k2_kualitas_perusahaan',
        'k3_toleransi_risiko',
        'k4_sensitivitas_harga',
        'k5_kapasitas_finansial',
      ]
      const missingKeys = requiredKeys.filter(k => payload[k] === undefined)
      if (missingKeys.length > 0) {
        setError(`Jawaban belum lengkap untuk kategori: ${missingKeys.join(', ')}`)
        setSubmitting(false)
        return
      }

      const res = await api.post('/auth/submit-profiling', payload)

      // Tampilkan halaman verifikasi hasil — JANGAN langsung redirect
      const profile = res.data.risk_profile
      setResultProfile(profile)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        // Pydantic validation error — tampilkan pesan pertama
        setError(detail[0]?.msg || 'Jawaban tidak valid.')
      } else {
        setError('Gagal mengirim jawaban. Coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading State ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={styles.fullPage}>
      <div style={{ color: 'white', fontSize: 16 }}>Memuat Kuesioner...</div>
    </div>
  )

  if (error && questions.length === 0) return (
    <div style={styles.fullPage}>
      <div style={{ color: '#f87171', fontSize: 16, textAlign: 'center', maxWidth: 400 }}>{error}</div>
    </div>
  )

  // ── Halaman Verifikasi Hasil ───────────────────────────────────────────────
  // Ditampilkan SETELAH submit berhasil, sebelum redirect ke dashboard
  if (resultProfile) {
    const info = PROFILE_INFO[resultProfile] || {
      color: '#94a3b8',
      emoji: '📊',
      desc: 'Profil risiko Anda telah tersimpan.',
    }
    return (
      <div style={styles.fullPage}>
        <div style={{ ...styles.card, textAlign: 'center', maxWidth: 480 }}>
          {/* Ikon profil */}
          <div style={{
            width: 80, height: 80, margin: '0 auto 20px',
            background: `${info.color}22`,
            border: `2px solid ${info.color}`,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36,
          }}>
            {info.emoji}
          </div>

          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
            Analisis selesai. Profil risiko Anda adalah:
          </p>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: info.color, marginBottom: 16 }}>
            {resultProfile}
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            {info.desc}
          </p>

          {/* Detail skor yang dikirim */}
          <div style={{
            background: '#0f172a', borderRadius: 10, padding: '16px 20px',
            marginBottom: 28, textAlign: 'left',
          }}>
            <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>
              RINGKASAN JAWABAN ANDA
            </p>
            {Object.entries(buildPayload(answers)).map(([cat, score]) => {
              const label: Record<string, string> = {
                k1_target_keuntungan: 'Target Keuntungan',
                k2_kualitas_perusahaan: 'Kualitas Perusahaan',
                k3_toleransi_risiko: 'Toleransi Risiko',
                k4_sensitivitas_harga: 'Sensitivitas Harga',
                k5_kapasitas_finansial: 'Kapasitas Finansial',
              }
              const scoreLabel: Record<number, string> = { 1: 'Konservatif', 3: 'Moderat', 5: 'Agresif' }
              return (
                <div key={cat} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 0', borderBottom: '1px solid #1e293b',
                  fontSize: 13,
                }}>
                  <span style={{ color: '#94a3b8' }}>{label[cat] || cat}</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{scoreLabel[score] || score}</span>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: '100%', background: info.color, color: 'white',
              border: 'none', borderRadius: 10, padding: '14px',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Mulai Investasi →
          </button>
        </div>
      </div>
    )
  }

  // ── Halaman Kuesioner ──────────────────────────────────────────────────────
  const q = questions[currentStep]
  const progress = ((currentStep + 1) / questions.length) * 100
  const isLastQuestion = currentStep === questions.length - 1
  const allAnswered = Object.keys(answers).length === questions.length

  return (
    <div style={styles.fullPage}>
      <div style={{ width: '100%', maxWidth: 500, padding: 24 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 900, color: 'white',
          }}>S</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
            Analisis <span style={{ color: '#10b981' }}>Profil Risiko</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            Bantu AI memahami gaya investasi Anda
          </p>
        </div>

        <div style={styles.card}>
          {/* Progress Bar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
              <span>Pertanyaan {currentStep + 1} / {questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 4, background: '#0f172a', borderRadius: 2 }}>
              <div style={{
                height: '100%', background: '#10b981',
                width: `${progress}%`, transition: 'width 0.3s', borderRadius: 2,
              }} />
            </div>
          </div>

          {/* Pertanyaan */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5, color: 'white' }}>
              {q.question}
            </h2>
          </div>

          {/* Pilihan Jawaban */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {q.options.map((opt: any, i: number) => {
              const isSelected = answers[currentStep] === opt.value
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt.value)}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: isSelected ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                    border: isSelected ? '1px solid #10b981' : '1px solid #334155',
                    borderRadius: 10, padding: '16px',
                    color: 'white', fontSize: 14, cursor: 'pointer',
                    transition: 'all 0.2s', outline: 'none',
                  }}
                >
                  {opt.text}
                </button>
              )
            })}
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444',
              borderRadius: 8, color: '#f87171', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Navigasi */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, alignItems: 'center' }}>
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 0}
              style={{
                background: 'transparent', border: 'none', color: '#94a3b8',
                fontSize: 13, cursor: currentStep === 0 ? 'default' : 'pointer',
                opacity: currentStep === 0 ? 0.3 : 1,
              }}
            >
              ← Kembali
            </button>

            {/* Tombol Selesai muncul di pertanyaan terakhir setelah dijawab */}
            {isLastQuestion && answers[currentStep] !== undefined && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !allAnswered}
                style={{
                  background: submitting ? '#374151' : '#10b981',
                  color: 'white', border: 'none',
                  borderRadius: 8, padding: '10px 20px',
                  fontSize: 14, fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Menganalisis...' : 'Selesai & Lihat Hasil →'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        button:hover:not(:disabled) {
          opacity: 0.9;
        }
      `}</style>
    </div>
  )
}

const styles = {
  fullPage: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontFamily: 'Inter, sans-serif',
  },
  card: {
    background: '#1e293b',
    padding: 32,
    borderRadius: 16,
    border: '1px solid #334155',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
}
