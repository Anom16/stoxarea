'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ToastContainer from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'

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
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const res = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      localStorage.setItem('access_token', res.data.access_token)

      const userRes = await api.get('/auth/me')
      const name = userRes.data.full_name || userRes.data.email?.split('@')[0] || 'Pengguna'
      toast.success(`Selamat Datang, ${name}! 👋`, 'Login berhasil. Mengalihkan...')
      
      setTimeout(() => {
        if (userRes.data.is_admin) {
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
              Stox<span style={{ color: '#2563eb' }}>Area</span>
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
              Masuk untuk mengakses terminal analitik STOXAREA.
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

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Input Email / Username */}
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
                  placeholder="admin01 atau admin01@gmail.com"
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
    </div>
  )
}
