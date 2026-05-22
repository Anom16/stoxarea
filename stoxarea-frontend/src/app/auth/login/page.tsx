'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ToastContainer from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()
  const { toasts, removeToast, toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const res = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      localStorage.setItem('access_token', res.data.access_token)
      
      const userRes = await api.get('/auth/me')
      const name = userRes.data.full_name || userRes.data.email?.split('@')[0] || 'Pengguna'
      toast.success(
        `Selamat Datang, ${name}! 👋`,
        'Login berhasil. Mengalihkan ke dashboard...',
      )
      setTimeout(() => {
        if (!userRes.data.risk_profile) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      }, 1200)
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login gagal. Periksa email dan password Anda.'
      setError(msg)
      toast.error('Login Gagal', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        
        {/* Logo Section */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: 'white',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
          }}>S</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white', margin: 0 }}>
            Stox<span style={{ color: '#10b981' }}>Area</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
            Terminal Riset Saham Berbasis AI
          </p>
        </div>

        <div style={{
          background: '#1e293b', padding: 32, borderRadius: 16,
          border: '1px solid #334155', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8 }}>Masuk ke Akun Anda</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
            Belum punya akun?{' '}
            <Link href="/auth/register" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>Daftar di sini</Link>
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ color: 'white', fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Email</label>
              <input
                type="email" id="login-email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@gmail.com"
                required
                style={{
                  width: '100%', background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 8, padding: '12px 16px', color: 'white',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ color: 'white', fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Password</label>
              <input
                type="password" id="login-password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 8, padding: '12px 16px', color: 'white',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#10b981', color: 'white', border: 'none',
                borderRadius: 8, padding: '14px', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', marginTop: 12, transition: 'background 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#059669')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#10b981')}
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
