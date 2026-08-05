'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ToastContainer from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '355574542227-34seejmplvimiufmu400g6sk00lcoto1.apps.googleusercontent.com'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const { toasts, removeToast, toast } = useToast()
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    setMounted(true)
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Load Official Google Identity Services SDK untuk Jendela Popup Akun Perangkat Asli
    if (typeof window !== 'undefined') {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        if ((window as any).google?.accounts?.id) {
          ;(window as any).google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              try {
                const base64Url = response.credential.split('.')[1]
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))
                const payload = JSON.parse(jsonPayload)
                if (payload.email) {
                  executeGoogleAuth(payload.email, payload.name)
                }
              } catch (e) {
                console.error('Google credential parse error:', e)
              }
            }
          })

          const btnContainer = document.getElementById('googleNativeBtn')
          if (btnContainer) {
            ;(window as any).google.accounts.id.renderButton(btnContainer, {
              theme: 'outline',
              size: 'large',
              width: 360,
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'center'
            })
          }
        }
      }
      document.body.appendChild(script)
    }

    // Auto-login jika token Remember Me tersimpan di browser
    const existingToken = localStorage.getItem('access_token') || sessionStorage.getItem('access_token')
    if (existingToken) {
      api.get('/auth/me')
        .then((res) => {
          const isAdmin = res.data.is_admin || (res.data.email && res.data.email.toLowerCase().includes('admin'))
          if (isAdmin) {
            router.push('/admin')
          } else if (!res.data.risk_profile) {
            router.push('/onboarding')
          } else {
            router.push('/dashboard')
          }
        })
        .catch(() => {
          // Token expired, biarkan pengguna di halaman login
        })
    }

    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [router])

  const handleLoginWithCredentials = async (loginEmail: string, loginPass: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.append('username', loginEmail)
      params.append('password', loginPass)
      const res = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      if (rememberMe) {
        localStorage.setItem('access_token', res.data.access_token)
        sessionStorage.removeItem('access_token')
      } else {
        sessionStorage.setItem('access_token', res.data.access_token)
        localStorage.removeItem('access_token')
      }

      // Reset watchlist agar setiap akun mulai dari kondisi bersih
      localStorage.removeItem('stoxarea_watchlist')
      localStorage.removeItem('stoxarea_stock_notes')

      const userRes = await api.get('/auth/me')
      const name = userRes.data.full_name || userRes.data.email?.split('@')[0] || 'Pengguna'
      toast.success(`Selamat Datang, ${name}! 👋`, 'Login berhasil. Mengalihkan...')
      
      setTimeout(() => {
        const isAdmin = userRes.data.is_admin || (userRes.data.email && userRes.data.email.toLowerCase().includes('admin'))
        if (isAdmin) {
          router.push('/admin')
          return
        }
        if (!userRes.data.risk_profile) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      }, 1000)
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login gagal. Periksa email dan password Anda.'
      setError(msg)
      toast.error('Login Gagal', msg)
    } finally {
      setLoading(false)
    }
  }

  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false)
  const [googleEmailInput, setGoogleEmailInput] = useState('')

  const executeGoogleAuth = async (targetEmail: string, targetName?: string) => {
    setLoading(true)
    setError('')
    setIsGoogleModalOpen(false)
    try {
      const emailClean = targetEmail.trim().toLowerCase()
      if (!emailClean || !emailClean.includes('@')) {
        toast.error('Email Tidak Valid', 'Masukkan email Google yang valid.')
        return
      }
      let res
      try {
        res = await api.post('/auth/google', {
          email: emailClean,
          full_name: targetName || emailClean.split('@')[0].toUpperCase(),
        })
      } catch (postErr: any) {
        // Double-fail-safe: Tembak langsung ke localhost:8000/auth/google jika proxy Next 404
        const axios = (await import('axios')).default
        const targetBackend = process.env.NEXT_PUBLIC_API_URL || 'https://stoxarea-backend-production.up.railway.app'
        res = await axios.post(`${targetBackend}/auth/google`, {
          email: emailClean,
          full_name: targetName || emailClean.split('@')[0].toUpperCase(),
        })
      }
      if (rememberMe) {
        localStorage.setItem('access_token', res.data.access_token)
        sessionStorage.removeItem('access_token')
      } else {
        sessionStorage.setItem('access_token', res.data.access_token)
        localStorage.removeItem('access_token')
      }
      // Reset watchlist agar setiap akun mulai dari kondisi bersih
      localStorage.removeItem('stoxarea_watchlist')
      localStorage.removeItem('stoxarea_stock_notes')
      const userRes = await api.get('/auth/me')
      const name = userRes.data.full_name || 'Pengguna'
      toast.success(`Selamat Datang, ${name}! 🎉`, 'Login Google berhasil.')
      setTimeout(() => {
        const isAdmin = userRes.data.is_admin || (userRes.data.email && userRes.data.email.toLowerCase().includes('admin'))
        if (isAdmin) {
          router.push('/admin')
          return
        }
        if (!userRes.data.risk_profile) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      }, 1000)
    } catch (err: any) {
      toast.error('Google Login Gagal', err.response?.data?.detail || 'Gagal autentikasi Google.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              try {
                const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                })
                const googleUser = await googleRes.json()
                if (googleUser.email) {
                  executeGoogleAuth(googleUser.email, googleUser.name)
                }
              } catch (err) {
                console.error('Fetch Google userinfo failed:', err)
              }
            }
          }
        })
        client.requestAccessToken()
        return
      } catch (e) {
        console.error('OAuth2 token client error:', e)
      }
    }
    setIsGoogleModalOpen(true)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleLoginWithCredentials(email, password)
  }

  // Kalkulasi presisi offset pupil mata melirik kursor mouse secara live
  const getEyeOffset = (svgX: number, svgY: number, maxRadius = 9) => {
    if (isPasswordFocused || !svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    // Konversi koordinat SVG viewBox (400x400) ke piksel layar aktual
    const eyeViewportX = rect.left + (svgX / 400) * rect.width
    const eyeViewportY = rect.top + (svgY / 400) * rect.height
    const dx = mousePos.x - eyeViewportX
    const dy = mousePos.y - eyeViewportY
    const angle = Math.atan2(dy, dx)
    const dist = Math.min(maxRadius, Math.hypot(dx, dy) / 10)
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    }
  }

  // Posisi pupil mata melirik kursor untuk Kucing Utama StoxArea
  const mainCatEyeL = getEyeOffset(170, 170, 9)
  const mainCatEyeR = getEyeOffset(230, 170, 9)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: "url('/images/login-bg.png') center / cover no-repeat #eef2ff",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif",
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {mounted && <ToastContainer toasts={toasts} onRemove={removeToast} />}

      {/* Modern Floating Card Container */}
      <div
        style={{
          width: '100%',
          maxWidth: 940,
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid rgba(224, 231, 255, 0.8)',
          boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.22), 0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          minHeight: 530,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* ── SISI KIRI: Area Karakter Kucing Utama (Mentok ke Dasar Kartu) ── */}
        <div
          className="auth-mascot-panel"
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
            padding: '40px 40px 0 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 440,
            borderRight: '1px solid #f1f5f9',
          }}
        >
          {/* Header Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
            <img
              src="/icons/icon-192x192.png"
              alt="StoxArea Logo"
              style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'contain' }}
            />
            <span style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: -0.5 }}>
              STOX<span style={{ color: '#2563eb' }}>AREA</span>
            </span>
          </div>

          {/* SVG Canvas Kucing Utama Mentok Dasar Kartu (Tidak Ngambang) */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 380,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginTop: 'auto',
              marginBottom: 0,
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: isPasswordFocused ? 'translateY(110px)' : 'translateY(0px)',
            }}
          >
            <svg
              ref={svgRef}
              viewBox="0 0 400 400"
              style={{
                width: '100%',
                maxHeight: 380,
                overflow: 'visible',
                display: 'block',
              }}
            >
              {/* ── KUCING PUTIH UTAMA (Grounded di Dasar y=400) ── */}

              {/* Ekor Kucing Putih Melengkung */}
              <path
                d="M 120 370 C 60 350, 40 240, 85 240 C 98 240, 98 262, 85 262 C 65 262, 75 330, 125 350 Z"
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth="2.5"
              />

              {/* Badan Kucing Putih (Rata Lurus Mentok Garis Tepi Bawah y=400) */}
              <path
                d="M 110 400 L 110 260 C 110 215, 290 215, 290 260 L 290 400 Z"
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth="3"
              />
              
              {/* Telinga Kucing (Kiri & Kanan) */}
              <polygon points="125,130 145,68 175,120" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />
              <polygon points="134,126 145,80 168,122" fill="#f472b6" />
              
              <polygon points="225,120 255,68 275,130" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />
              <polygon points="232,122 255,80 266,126" fill="#f472b6" />

              {/* Kepala Kucing Putih */}
              <circle cx="200" cy="180" r="75" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />
              
              {/* Pipi Merah Muda (Blush) */}
              <circle cx="150" cy="195" r="14" fill="#fecdd3" opacity="0.85" />
              <circle cx="250" cy="195" r="14" fill="#fecdd3" opacity="0.85" />

              {/* Hidung Pink & Mulut 'w' Kucing */}
              <polygon points="193,190 207,190 200,197" fill="#f43f5e" />
              <path
                d="M 190 200 Q 195 206 200 200 Q 205 206 210 200"
                fill="none"
                stroke="#0f172a"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Kumis Kucing Putih */}
              <line x1="120" y1="190" x2="150" y2="193" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="120" y1="202" x2="150" y2="200" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="250" y1="193" x2="280" y2="190" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="250" y1="200" x2="280" y2="202" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

              {/* Dasi Kupu-Kupu Pink (*Bowtie*) */}
              <polygon points="172,235 200,246 172,257" fill="#f43f5e" />
              <polygon points="228,235 200,246 228,257" fill="#f43f5e" />
              <circle cx="200" cy="246" r="6.5" fill="#e11d48" />

              {/* Tablet Analitik StoxArea Dipegang Kucing */}
              <g transform="rotate(-8 230 270)">
                <rect x="220" y="260" width="85" height="65" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="3" />
                <rect x="226" y="266" width="73" height="53" rx="6" fill="#1e293b" />
                <path d="M 232 305 L 248 292 L 265 298 L 288 278" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="282" cy="282" r="4.5" fill="#fbbf24" />
              </g>

              {/* Mata Besar Kucing Putih (Live Eye Tracking) */}
              {!isPasswordFocused ? (
                <>
                  {/* Mata Kiri */}
                  <circle cx="170" cy="170" r="16" fill="#0f172a" />
                  <circle cx={170 + mainCatEyeL.x} cy={170 + mainCatEyeL.y} r="7" fill="#ffffff" />
                  <circle cx={170 + mainCatEyeL.x + 2} cy={170 + mainCatEyeL.y - 2} r="2.5" fill="#ffffff" />

                  {/* Mata Kanan */}
                  <circle cx="230" cy="170" r="16" fill="#0f172a" />
                  <circle cx={230 + mainCatEyeR.x} cy={170 + mainCatEyeR.y} r="7" fill="#ffffff" />
                  <circle cx={230 + mainCatEyeR.x + 2} cy={170 + mainCatEyeR.y - 2} r="2.5" fill="#ffffff" />
                </>
              ) : (
                /* Mode Pejam Mata Imut (^ ^) saat Ketik Password */
                <>
                  <path d="M 152 170 Q 170 154 188 170" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
                  <path d="M 212 170 Q 230 154 248 170" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
                </>
              )}
            </svg>
          </div>
        </div>

        {/* ── SISI KANAN: Form Input Sign In Clean (Light Card) ── */}
        <div
          style={{
            padding: 44,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#ffffff',
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: '#0f172a',
                margin: '0 0 8px 0',
                letterSpacing: -0.5,
              }}
            >
              Sign In
            </h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
              Masuk untuk mengakses STOXAREA.
            </p>
          </div>

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '12px 16px',
                color: '#dc2626',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}
          {/* Custom Google Button 100% Mirip Kotakan Input Email & Password */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%',
              height: 48,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: '0 16px',
              color: '#0f172a',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxSizing: 'border-box',
              transition: 'border-color 0.2s, background 0.2s',
              marginBottom: 16
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Lanjutkan dengan Google
          </button>

          {/* Hidden Google SDK Native Button Container */}
          <div id="googleNativeBtn" style={{ display: 'none' }}></div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 20px 0', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              ATAU DENGAN EMAIL
            </span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Input Email  */}
            <div>
              <label
                style={{
                  color: '#1e293b',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Username or email
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0.4,
                    fontSize: 16,
                  }}
                >
                  👤
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsPasswordFocused(false)}
                  placeholder="Akun Anda"
                  required
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: '14px 16px 14px 44px',
                    color: '#0f172a',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <label
                style={{
                  color: '#1e293b',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0.4,
                    fontSize: 16,
                  }}
                >
                  🔒
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: '14px 44px 14px 44px',
                    color: '#0f172a',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.5,
                    fontSize: 16,
                    padding: 0,
                  }}
                  title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Checkbox Remember Me & Link Forgot Password */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
                marginTop: -4,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#64748b' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ borderRadius: 4, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                Remember me
              </label>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  toast.info('Lupa Password', 'Silakan hubungi administrator sistem untuk mereset kata sandi.')
                }}
                style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '15px',
                fontSize: 16,
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'transform 0.15s, boxShadow 0.15s',
              }}
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
          </form>

          {/* Link to Register */}
          <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: '#64748b' }}>
            New here?{' '}
            <Link
              href="/auth/register"
              style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}
            >
              Create an Account
            </Link>
          </div>
        </div>
      </div>

      {/* Modal Fail-Safe Akun Google */}
      {isGoogleModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 400,
            padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Pilih Akun Google</span>
              </div>
              <button 
                onClick={() => setIsGoogleModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Lanjutkan ke <strong>STOXAREA</strong> menggunakan akun Google Anda.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); if (googleEmailInput) executeGoogleAuth(googleEmailInput); }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
                MASUKKAN EMAIL GOOGLE ANDA:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  placeholder="email.google@gmail.com"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                    fontSize: 13, outline: 'none'
                  }}
                  required
                />
                <button
                  type="submit"
                  style={{
                    padding: '10px 14px', borderRadius: 8, border: 'none', background: '#2563eb',
                    color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer'
                  }}
                >
                  Lanjut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
