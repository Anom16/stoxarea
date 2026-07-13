'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ToastContainer from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toasts, removeToast, toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Baca state light mode dari body
    const check = () => setIsLight(document.body.classList.contains('light-mode'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.post('/auth/register', { 
        email, 
        password,
        full_name: fullName 
      })
      toast.success(
        'Pendaftaran Berhasil! 🎉',
        `Akun untuk ${fullName} telah dibuat.`,
        'Mengalihkan ke halaman login...'
      )
      setTimeout(() => router.push('/auth/login'), 1800)
    } catch (err: any) {
      console.error("Register error:", err)
      let msg = 'Pendaftaran gagal. Cek koneksi backend Anda.'
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          msg = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          msg = err.response.data.detail.map((d: any) => d.msg).join(', ')
        }
      }
      setError(msg)
      toast.error('Pendaftaran Gagal', msg)
    } finally {
      setLoading(false)
    }
  }

  // Warna dinamis sesuai mode
  const bg        = isLight ? '#f8fafc' : '#0f172a'
  const cardBg    = isLight ? '#ffffff' : '#1e293b'
  const cardBorder= isLight ? '#e2e8f0' : '#334155'
  const textPrim  = isLight ? '#0f172a' : '#ffffff'
  const textMuted = isLight ? '#64748b' : '#94a3b8'
  const inputBg   = isLight ? '#f8fafc' : '#0f172a'
  const inputBorder= isLight ? '#cbd5e1' : '#334155'
  const accent    = isLight ? '#059669' : '#10b981'

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      transition: 'background 0.3s ease',
    }}>
      {mounted && <ToastContainer toasts={toasts} onRemove={removeToast} />}
      <div style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        
        {/* Logo Section */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/icons/icon-192x192.png" alt="StoxArea Logo" style={{
            width: 80, height: 80, margin: '0 auto 16px',
            display: 'block', objectFit: 'contain'
          }} />
          <h1 style={{ fontSize: 32, fontWeight: 800, color: textPrim, margin: 0 }}>
            Stox<span style={{ color: accent }}>Area</span>
          </h1>
          <p style={{ color: textMuted, fontSize: 14, marginTop: 8 }}>
            Terminal Riset Saham Berbasis AI
          </p>
        </div>

        {/* Form Card */}
        <div style={{
          background: cardBg,
          padding: 32, borderRadius: 16,
          border: `1px solid ${cardBorder}`,
          boxShadow: isLight
            ? '0 4px 24px rgba(0,0,0,0.08)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: textPrim, marginBottom: 8 }}>Daftar Akun Baru</h2>
          <p style={{ color: textMuted, fontSize: 14, marginBottom: 24 }}>
            Sudah punya akun? {' '}
            <Link href="/auth/login" style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}>Masuk di sini</Link>
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ color: textPrim, fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Nama Lengkap</label>
              <input 
                placeholder="Nama Anda"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: 8, padding: '12px 16px',
                  color: textPrim,
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  transition: 'background 0.3s ease, border-color 0.3s ease',
                }}
              />
            </div>
            <div>
              <label style={{ color: textPrim, fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Email</label>
              <input 
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: 8, padding: '12px 16px',
                  color: textPrim,
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  transition: 'background 0.3s ease, border-color 0.3s ease',
                }}
              />
            </div>
            <div>
              <label style={{ color: textPrim, fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Password</label>
              <input 
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: 8, padding: '12px 16px',
                  color: textPrim,
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  transition: 'background 0.3s ease, border-color 0.3s ease',
                }}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              style={{
                background: accent, color: 'white', border: 'none',
                borderRadius: 8, padding: '14px', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', marginTop: 12, transition: 'background 0.2s',
                width: '100%',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = isLight ? '#047857' : '#059669')}
              onMouseOut={(e) => (e.currentTarget.style.background = accent)}
            >
              {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
