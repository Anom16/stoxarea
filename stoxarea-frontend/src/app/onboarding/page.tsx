'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import CatLoading from '@/components/ui/CatLoading'

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

   
    const payload: Record<string, number> = {}
    Object.entries(categoryScores).forEach(([cat, scores]) => {
      const freq: Record<number, number> = {}
      scores.forEach(s => { freq[s] = (freq[s] || 0) + 1 })
      const maxFreq = Math.max(...Object.values(freq))
      const candidates = Object.keys(freq)
        .map(Number)
        .filter(s => freq[s] === maxFreq)
      
      payload[cat] = Math.min(...candidates)
    })

    return payload
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = buildPayload(answers)

      
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

      
      const profile = res.data.risk_profile || 'moderat'
      const normalized = profile.charAt(0).toUpperCase() + profile.slice(1)
      setResultProfile(normalized)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
       
        setError(detail[0]?.msg || 'Jawaban tidak valid.')
      } else {
        setError('Gagal mengirim jawaban. Coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={styles.fullPage}>
      <CatLoading text="Kucing AI sedang menyusun lembar kuesioner Anda... 🐾" />
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
      {/* Background glow effects */}
      <div className="bg-glow-1"></div>
      <div className="bg-glow-2"></div>
      
      <div style={{ width: '100%', maxWidth: 540, padding: 24, position: 'relative', zIndex: 10 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40, animation: 'fadeInDown 0.6s ease-out' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: 'white',
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
          }}>S</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
            Analisis <span style={{ background: 'linear-gradient(to right, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Profil Risiko</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6 }}>
            Bantu AI menyesuaikan strategi investasi terbaik untuk Anda
          </p>
        </div>

        <div className="glass-card question-transition" key={currentStep}>
          {/* Progress Bar */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>Pertanyaan {currentStep + 1} / {questions.length}</span>
              <span style={{ color: '#10b981' }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(15, 23, 42, 0.6)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{
                height: '100%', 
                background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                width: `${progress}%`, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)', 
                borderRadius: 3,
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
              }} />
            </div>
          </div>

          {/* Pertanyaan */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.6, color: '#f8fafc' }}>
              {q.question}
            </h2>
          </div>

          {/* Pilihan Jawaban */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {q.options.map((opt: any, i: number) => {
              const isSelected = answers[currentStep] === opt.value
              return (
                <button
                  key={i}
                  className={`option-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleAnswer(opt.value)}
                >
                  <div style={{ paddingRight: 30 }}>{opt.text}</div>
                </button>
              )
            })}
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              marginTop: 20, padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10, color: '#f87171', fontSize: 13,
              animation: 'fadeIn 0.3s'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Navigasi */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, alignItems: 'center' }}>
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 0}
              style={{
                background: 'transparent', border: 'none', color: '#94a3b8',
                fontSize: 14, fontWeight: 600, cursor: currentStep === 0 ? 'default' : 'pointer',
                opacity: currentStep === 0 ? 0.3 : 1, transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { if(currentStep !== 0) e.currentTarget.style.color = 'white' }}
              onMouseOut={(e) => { if(currentStep !== 0) e.currentTarget.style.color = '#94a3b8' }}
            >
              ← Kembali
            </button>

            {/* Tombol Selesai muncul di pertanyaan terakhir setelah dijawab */}
            {isLastQuestion && answers[currentStep] !== undefined && (
              <button
                className="finish-btn"
                onClick={handleSubmit}
                disabled={submitting || !allAnswered}
              >
                {submitting ? 'Menganalisis...' : 'Selesai & Lihat Hasil →'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .bg-glow-1 {
          position: fixed;
          top: -100px;
          right: -100px;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%;
          z-index: 1;
        }
        .bg-glow-2 {
          position: fixed;
          bottom: -100px;
          left: -100px;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%;
          z-index: 1;
        }
        .glass-card {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          padding: 40px;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .question-transition {
          animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .option-btn {
          position: relative;
          width: 100%;
          text-align: left;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 18px 20px;
          color: #cbd5e1;
          font-size: 15px;
          line-height: 1.5;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          font-family: inherit;
        }
        .option-btn:hover:not(.selected) {
          background: rgba(30, 41, 59, 0.9);
          border-color: rgba(59, 130, 246, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
          color: white;
        }
        .option-btn.selected {
          background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.1) 100%);
          border-color: #10b981;
          color: white;
          font-weight: 600;
          box-shadow: 0 0 20px rgba(16,185,129,0.15), inset 0 0 0 1px #10b981;
          transform: scale(1.02);
        }
        .option-btn.selected::after {
          content: '✓';
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          color: #10b981;
          font-weight: 900;
          font-size: 18px;
          background: rgba(16,185,129,0.15);
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .finish-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
          animation: pulseGlow 2s infinite;
        }
        .finish-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -5px rgba(16, 185, 129, 0.4);
        }
        .finish-btn:disabled {
          background: #334155;
          box-shadow: none;
          cursor: not-allowed;
          animation: none;
          color: #94a3b8;
        }
        
        /* Animations */
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: translateY(-50%) scale(0.5); }
          50% { transform: translateY(-50%) scale(1.2); }
          100% { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />
    </div>
  )
}

const styles = {
  fullPage: {
    minHeight: '100vh',
    background: '#0a0f1a',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontFamily: 'Inter, sans-serif',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  card: {
    background: 'rgba(30, 41, 59, 0.7)',
    backdropFilter: 'blur(16px)',
    padding: '40px',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    width: '100%',
  }
}

