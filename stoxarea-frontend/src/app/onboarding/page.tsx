'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function OnboardingPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<any[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({}) // Menyimpan list skor per kategori
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const res = await api.get('/auth/questionnaire')
      setQuestions(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (value: number) => {
    const q = questions[currentStep]
    const category = q.category
    
    // Tambahkan skor ke list kategori tersebut
    const currentCategoryAnswers = answers[category] || []
    setAnswers({ 
      ...answers, 
      [category]: [...currentCategoryAnswers, value] 
    })
    
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Hitung Rata-rata skor per kategori sebelum dikirim ke Backend
      const finalPayload: Record<string, number> = {}
      Object.keys(answers).forEach(cat => {
        const scores = answers[cat]
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        finalPayload[cat] = avg
      })

      await api.post('/auth/submit-profiling', finalPayload)
      router.push('/dashboard')
    } catch (err) {
      alert("Gagal mengirim jawaban.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      Memuat Kuesioner...
    </div>
  )

  const q = questions[currentStep]
  const progress = ((currentStep + 1) / questions.length) * 100

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: 500, padding: 24 }}>
        
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 900, color: 'white'
          }}>S</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>Analisis <span style={{ color: '#10b981' }}>Profil Risiko</span></h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            Bantu AI memahami gaya investasi Anda
          </p>
        </div>

        <div style={{
          background: '#1e293b', padding: 32, borderRadius: 16,
          border: '1px solid #334155', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Progress Bar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
              <span>Pertanyaan {currentStep + 1} / {questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 4, background: '#0f172a', borderRadius: 2 }}>
              <div style={{ height: '100%', background: '#10b981', width: `${progress}%`, transition: 'width 0.3s', borderRadius: 2 }} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5, color: 'white' }}>
              {q.question}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {q.options.map((opt: any, i: number) => (
              <button 
                key={i}
                className="option-item"
                onClick={() => handleAnswer(opt.value)}
                style={{
                  width: '100%', textAlign: 'left', background: '#0f172a', 
                  border: '1px solid #334155', borderRadius: 10, padding: '16px',
                  color: 'white', fontSize: 14, cursor: 'pointer',
                  transition: 'all 0.2s', outline: 'none'
                }}
              >
                {opt.text}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, alignItems: 'center' }}>
            <button 
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 0}
              style={{ 
                background: 'transparent', border: 'none', color: '#94a3b8', 
                fontSize: 13, cursor: currentStep === 0 ? 'default' : 'pointer',
                opacity: currentStep === 0 ? 0.3 : 1
              }}
            >
              ← Kembali
            </button>

            {currentStep === questions.length - 1 && Object.keys(answers).length >= 5 && (
              <button 
                onClick={handleSubmit} 
                disabled={submitting}
                style={{
                  background: '#10b981', color: 'white', border: 'none',
                  borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {submitting ? 'Menganalisis...' : 'Selesai & Lihat Hasil'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .option-item:hover {
          background: rgba(16, 185, 129, 0.1) !important;
          border-color: #10b981 !important;
        }
      `}</style>
    </div>
  )
}
