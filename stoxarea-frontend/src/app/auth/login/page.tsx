'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      // OAuth2PasswordRequestForm menggunakan form-data bukan JSON
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const res = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      localStorage.setItem('access_token', res.data.access_token)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login gagal. Periksa email dan password Anda.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="logo-mark" style={{ width: 56, height: 56, fontSize: 24, margin: '0 auto 12px' }}>S</div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Stox<span className="text-accent">Area</span></h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Terminal Riset Saham Berbasis AI</p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Masuk ke Akun Anda</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
            Belum punya akun?{' '}
            <Link href="/auth/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Daftar di sini</Link>
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
              <input
                type="email" id="login-email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@gmail.com"
                required
                style={{
                  width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Password</label>
              <input
                type="password" id="login-password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ padding: '12px', fontSize: 15, fontWeight: 600, borderRadius: 8 }}
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
