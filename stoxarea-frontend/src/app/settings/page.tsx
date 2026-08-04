'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import ToastContainer from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'

type Tab = 'account' | 'security' | 'risk' | 'preferences' | 'faq'

const FAQ_ITEMS = [
  {
    category: '🗂 Platform & Akun',
    items: [
      {
        q: 'Apa itu STOXAREA?',
        a: 'STOXAREA adalah platform analitik dan edukasi pasar saham Indonesia berbasis kecerdasan buatan. Sistem ini menggabungkan algoritma Machine Learning (XGBoost) dan metode Sistem Pendukung Keputusan (SAW) untuk menghasilkan rekomendasi saham yang dipersonalisasi sesuai profil risiko Anda.'
      },
      {
        q: 'Apakah STOXAREA gratis digunakan?',
        a: 'Ya, STOXAREA sepenuhnya gratis. Seluruh fitur termasuk AI Watchlist, analisis fundamental/teknikal, dan Virtual Trading tersedia tanpa biaya apapun.'
      },
      {
        q: 'Bagaimana cara mengubah nama profil saya?',
        a: 'Masuk ke Pengaturan → Akun, ketik nama baru pada kolom "Nama Lengkap", lalu klik tombol Simpan. Perubahan akan langsung terlihat di sapaan Dashboard.'
      },
      {
        q: 'Bagaimana cara mengubah password?',
        a: 'Buka Pengaturan → Keamanan. Masukkan password lama, password baru, dan konfirmasi password baru. Klik Perbarui Password untuk menyimpan perubahan.'
      },
      {
        q: 'Apa yang terjadi jika saya lupa password?',
        a: 'Saat ini fitur reset password via email masih dalam pengembangan. Hubungi administrator sistem untuk pemulihan akun Anda.'
      },
    ]
  },
  {
    category: '🤖 AI & Rekomendasi',
    items: [
      {
        q: 'Apa itu AI Score dan bagaimana cara kerjanya?',
        a: '**AI Score (0–100%)** adalah skor momentum teknikal yang dihasilkan oleh algoritma Machine Learning XGBoost.\n\n' +
          '**Cara kerjanya:**\n' +
          '• Model ini dilatih dengan data historis pergerakan harga saham.\n' +
          '• Menganalisis 11 indikator teknikal, termasuk RSI, MACD, Volume, dan Moving Average.\n' +
          '• Menghasilkan probabilitas kekuatan tren harga ke depan.\n\n' +
          '**Mengapa penting?**\n' +
          'AI Score membantu Anda mengukur potensi momentum sebuah saham berdasarkan data objektif, bukan rumor atau berita viral.'
      },
      {
        q: 'Apa itu Match Score?',
        a: '**Match Score (0–100%)** adalah skor kecocokan personal antara saham dengan profil risiko Anda.\n\n' +
          '**Cara kerjanya:**\n' +
          '• Dihitung oleh metode SAW (Simple Additive Weighting).\n' +
          '• Memadukan AI Score (momentum teknikal) dengan data fundamental (ROE, DER, PBV).\n' +
          '• Setiap kriteria diberi bobot berbeda tergantung profil risiko Anda (Konservatif, Moderat, atau Agresif).\n\n' +
          '**Mengapa penting?**\n' +
          'Match Score memastikan rekomendasi saham sesuai dengan karakter investasi Anda. Pengguna konservatif akan melihat saham dengan fundamental kuat di urutan atas, sementara pengguna agresif akan melihat saham dengan momentum tinggi.'
      },
      {
        q: 'Mengapa rekomendasi saya berbeda dengan pengguna lain?',
        a: 'Rekomendasi STOXAREA bersifat personal, bukan generik. Perbedaan terjadi karena metode SAW memberikan bobot berbeda pada setiap kriteria (AI Score, ROE, DER, PBV) tergantung profil risiko Anda. Dua pengguna dengan profil berbeda akan melihat urutan rekomendasi yang berbeda meskipun melihat sektor yang sama.'
      },
      {
        q: 'Apakah rekomendasi STOXAREA dapat dijadikan dasar keputusan investasi?',
        a: '**Tidak.** Seluruh output STOXAREA — termasuk AI Score, Match Score, dan AI Watchlist — adalah hasil kalkulasi matematis algoritmik, bukan saran investasi.\n\n' +
          '**Batasan penting:**\n' +
          '• STOXAREA tidak terdaftar sebagai Penasihat Investasi di OJK.\n' +
          '• Sistem tidak memprediksi harga saham secara pasti, melainkan mengukur probabilitas tren berdasarkan data historis.\n' +
          '• Selalu lakukan riset mandiri dan pertimbangkan kondisi keuangan Anda sebelum berinvestasi.'
      },
      {
        q: 'Seberapa sering data rekomendasi diperbarui?',
        a: 'Data AI Score dan rekomendasi diperbarui setiap hari kerja (Senin–Jumat) pukul 17:00 WIB, setelah pasar tutup. Data harga saham real-time diambil langsung dari Yahoo Finance.'
      },
    ]
  },
  {
    category: '📈 Virtual Trading',
    items: [
      {
        q: 'Apa itu Virtual Trading?',
        a: 'Virtual Trading adalah fitur simulasi jual-beli saham menggunakan saldo kas virtual (bukan uang nyata). Fitur ini dirancang untuk membantu Anda berlatih strategi investasi dan memahami mekanisme pasar saham tanpa risiko kehilangan uang.'
      },
      {
        q: 'Berapa saldo awal Virtual Trading saya?',
        a: 'Setiap pengguna mendapatkan saldo awal sebesar Rp 100.000.000 (seratus juta rupiah) secara virtual untuk mulai berinvestasi di fitur simulasi.'
      },
      {
        q: 'Apakah saldo Virtual Trading bisa direset?',
        a: 'Ya. Hubungi administrator atau gunakan fitur reset portofolio jika tersedia di halaman Virtual Trading. Reset akan mengembalikan saldo ke Rp 100.000.000 dan menghapus seluruh riwayat transaksi virtual Anda.'
      },
    ]
  },
  {
    category: '🔒 Data & Keamanan',
    items: [
      {
        q: 'Dari mana data harga saham diambil?',
        a: 'Data harga saham dan indeks pasar (termasuk IHSG) diambil secara real-time dari Yahoo Finance melalui library yfinance. Data ini digunakan untuk keperluan edukasi dan analisis, bukan transaksi keuangan nyata.'
      },
      {
        q: 'Apakah data pribadi saya aman di STOXAREA?',
        a: '**Ya, data Anda aman.** Kami menerapkan standar keamanan industri untuk melindungi informasi pribadi Anda.\n\n' +
          '**Rincian teknis:**\n' +
          '• Data pribadi (email, nama, profil risiko) disimpan di database PostgreSQL yang dihosting di Supabase.\n' +
          '• Database dilindungi enkripsi standar industri.\n' +
          '• Password disimpan dalam bentuk hash menggunakan algoritma bcrypt — tidak ada yang bisa melihat password asli Anda, termasuk administrator.\n' +
          '• STOXAREA tidak menyimpan informasi keuangan atau rekening bank Anda.'
      },
    ]
  },
]

const PROFILE_OPTIONS = [
  {
    id: 'Konservatif',
    emoji: '🛡️',
    color: '#3b82f6',
    desc: 'Fokus keamanan modal. Saham bluechip & dividen stabil.',
  },
  {
    id: 'Moderat',
    emoji: '⚖️',
    color: '#f59e0b',
    desc: 'Keseimbangan risiko & keuntungan. Pertumbuhan jangka menengah.',
  },
  {
    id: 'Agresif',
    emoji: '🚀',
    color: '#10b981',
    desc: 'Mengejar momentum maksimal. Siap hadapi fluktuasi tinggi.',
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const { toasts, removeToast, toast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const [mobileView, setMobileView] = useState<'menu' | 'content'>('menu')
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  // Tab: Akun
  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Tab: Keamanan
  const [currPass, setCurrPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const currPassRef = useRef<HTMLInputElement>(null)

  // Tab: Profil Risiko
  const [selectedProfile, setSelectedProfile] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Tab: Preferensi
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [dashboardLayout, setDashboardLayout] = useState<'classic' | 'modern'>('classic')
  const [lang, setLang] = useState<'id' | 'en'>('id')
  const [notifyAiSignals, setNotifyAiSignals] = useState(true)
  const [notifyPortfolioAlert, setNotifyPortfolioAlert] = useState(true)
  const [showSparklines, setShowSparklines] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/auth/login'); return }

    const savedTheme = (localStorage.getItem('app_theme') as 'light' | 'dark') || 'light'
    setTheme(savedTheme)
    document.body.classList.toggle('dark-mode', savedTheme === 'dark')
    const savedLang = localStorage.getItem('app_lang') as 'id' | 'en'
    if (savedLang) setLang(savedLang)
    const savedDashLayout = localStorage.getItem('dashboard_layout') as 'classic' | 'modern'
    if (savedDashLayout) setDashboardLayout(savedDashLayout)

    api.get('/auth/me')
      .then(r => {
        setUser(r.data)
        setFullName(r.data.full_name || '')
        const raw = r.data.risk_profile || 'moderat'
        const normalized = raw.charAt(0).toUpperCase() + raw.slice(1)
        setSelectedProfile(normalized)
      })
      .catch(() => router.push('/auth/login'))
      .finally(() => setLoading(false))
  }, [])

  // ── Handler: Update Nama ──────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!fullName.trim()) {
      toast.error('Nama tidak valid', 'Nama lengkap tidak boleh kosong.')
      return
    }
    setSavingName(true)
    try {
      const res = await api.put('/auth/update-name', { full_name: fullName.trim() })
      setUser(res.data)
      toast.success('Nama Diperbarui ✅', `Nama Anda sekarang: ${res.data.full_name}`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      toast.error('Gagal Menyimpan', typeof msg === 'string' ? msg : 'Terjadi kesalahan.')
    } finally {
      setSavingName(false)
    }
  }

  // ── Handler: Update Password ──────────────────────────────────────────────
  const handleUpdatePassword = async () => {
    if (!currPass || !newPass || !confirmPass) {
      toast.error('Form Tidak Lengkap', 'Isi semua field kata sandi.')
      return
    }
    if (newPass !== confirmPass) {
      toast.error('Kata Sandi Tidak Cocok', 'Konfirmasi kata sandi baru tidak sesuai.')
      return
    }
    if (newPass.length < 8) {
      toast.error('Kata Sandi Terlalu Pendek', 'Minimal 8 karakter.')
      return
    }
    setSavingPass(true)
    try {
      await api.put('/auth/update-password', {
        current_password: currPass,
        new_password: newPass,
      })
      toast.success('Kata Sandi Diperbarui 🔒', 'Kata sandi baru Anda sudah aktif.')
      setCurrPass(''); setNewPass(''); setConfirmPass('')
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      toast.error('Gagal Memperbarui', typeof msg === 'string' ? msg : 'Kata sandi saat ini salah.')
    } finally {
      setSavingPass(false)
    }
  }

  // ── Handler: Update Profil Risiko ─────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await api.put('/auth/profile', { risk_profile: selectedProfile.toLowerCase() })
      setUser(res.data)
      toast.success(
        'Profil Risiko Diperbarui ✅',
        `Profil Anda: ${selectedProfile}`,
        'Rekomendasi AI akan disesuaikan.'
      )
    } catch (err: any) {
      toast.error('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan profil risiko.')
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Handler: Preferensi Tampilan ──────────────────────────────────────
  const handleThemeChange = (t: 'light' | 'dark') => {
    setTheme(t)
    localStorage.setItem('app_theme', t)
    document.body.classList.toggle('dark-mode', t === 'dark')
  }

  const handleDashLayoutChange = (layout: 'classic' | 'modern') => {
    setDashboardLayout(layout)
    localStorage.setItem('dashboard_layout', layout)
  }

  const handleSavePreferences = () => {
    toast.success(
      'Preferensi Disimpan ✅',
      `Tema: ${theme === 'dark' ? 'Gelap' : 'Terang'} · Tampilan: ${dashboardLayout === 'classic' ? 'Klasik' : 'Modern'}`
    )
  }

  // ── Handler: Logout ───────────────────────────────────────────────────────
  const handleLogout = () => {
    if (confirm('Yakin ingin keluar dari STOXAREA?')) {
      localStorage.removeItem('access_token')
      router.push('/auth/login')
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'account',     label: '👤 Akun Saya' },
    { id: 'security',    label: '🔒 Keamanan & Sandi' },
    { id: 'risk',        label: '📊 Profil Risiko' },
    { id: 'preferences', label: '🌐 Preferensi' },
    { id: 'faq',         label: '❓ FAQ' },
  ]

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar title="Pengaturan" />
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <div className="page-body">
          {/* Breadcrumb & Subtitle */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
              STOXAREA / <span style={{ color: 'var(--text-primary)' }}>Pengaturan</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Kelola akun dan preferensi aplikasi kamu.
            </p>
          </div>

          <div className="settings-layout">

            {/* ── LEFT COLUMN ── */}
            <div className={`settings-left-col ${mobileView === 'content' ? 'hidden-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Profile Badge Card */}
              <div className="card" style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 22,
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: '#fff', fontSize: 30, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(59,130,246,0.3)',
                  marginBottom: 12
                }}>
                  {(user?.full_name || fullName || 'A').substring(0, 1).toUpperCase()}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {user?.full_name || fullName || 'Anom Pangestu'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {user?.email || 'anom01@gmail.com'}
                </div>
                <div style={{
                  background: 'rgba(16,185,129,0.1)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.25)',
                  padding: '3px 10px', borderRadius: 12, fontSize: 11,
                  fontWeight: 700, marginTop: 10, display: 'inline-flex',
                  alignItems: 'center', gap: 4
                }}>
                  ● Aktif
                </div>
              </div>

              {/* Sidebar Menu Nav Card */}
              <div className="card" style={{ padding: 10 }}>
                {TABS.map(tab => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setMobileView('content')
                      }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        width: '100%', padding: '12px 14px', marginBottom: 4, borderRadius: 10,
                        border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                        background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                        color: isActive ? '#2563eb' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{tab.label}</span>
                      {isActive && <span style={{ fontSize: 12 }}>›</span>}
                    </button>
                  )
                })}
                <hr style={{ margin: '8px 0', borderColor: 'var(--border)' }} />
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    width: '100%', padding: '12px 14px', borderRadius: 10, border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: 'transparent', color: '#ef4444', transition: 'all 0.15s ease'
                  }}
                >
                  <span>🚪 Keluar</span>
                </button>
              </div>
            </div>

            {/* ── RIGHT COLUMN CONTENT ── */}
            <div className={`settings-content-col ${mobileView === 'menu' ? 'hidden-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Mobile Back Button */}
              <button
                className="settings-back-btn"
                onClick={() => setMobileView('menu')}
              >
                ← Kembali ke Menu Pengaturan
              </button>

              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                  <img 
                    src="/icons/loading.gif" 
                    onError={(e) => { (e.target as HTMLImageElement).src = '/icons/icon-192x192.png' }}
                    alt="Loading..." 
                    style={{ width: 64, height: 64, objectFit: 'contain' }} 
                  />
                </div>
              ) : (
                <>
                  {/* ── TAB 1: AKUN SAYA ── */}
                  {activeTab === 'account' && (
                    <>
                      {/* Card 1: Informasi Pribadi */}
                      <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>Informasi Pribadi</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                          Perubahan nama akan langsung tersimpan.
                        </p>

                        <div style={{ width: '100%' }}>
                          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
                            NAMA LENGKAP
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Masukkan nama lengkap Anda"
                            style={{
                              width: '100%', padding: '12px 16px', borderRadius: 12,
                              border: '1px solid var(--border)', background: 'var(--bg-primary)',
                              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                              boxSizing: 'border-box', outline: 'none'
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                          />

                          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6, marginTop: 18 }}>
                            ALAMAT EMAIL
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="email"
                              value={user?.email || ''}
                              disabled
                              style={{
                                width: '100%', padding: '12px 16px', borderRadius: 12,
                                border: '1px solid var(--border)', background: 'rgba(241,245,249,0.5)',
                                fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
                                cursor: 'not-allowed', boxSizing: 'border-box'
                              }}
                            />
                            <span style={{
                              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                              background: '#e2e8f0', color: '#64748b', padding: '2px 8px', borderRadius: 8,
                              fontSize: 10, fontWeight: 700
                            }}>
                              Terkunci
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            Email digunakan sebagai identitas login dan tidak bisa diubah.
                          </p>

                          <button
                            onClick={handleSaveName}
                            disabled={savingName}
                            style={{
                              background: '#2563eb', color: '#fff', border: 'none',
                              borderRadius: 10, padding: '12px 24px', fontSize: 13,
                              fontWeight: 700, cursor: 'pointer', marginTop: 20,
                              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {savingName ? 'Menyimpan...' : 'Simpan Perubahan'}
                          </button>
                        </div>
                      </div>

                      {/* Card 2: Data Investasi */}
                      <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Data Investasi</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                          {/* Profil Risiko */}
                          <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 12, padding: '14px 16px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#9a3412', marginBottom: 4 }}>Profil Risiko</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#c2410c' }}>
                              {user?.risk_profile ? user.risk_profile.charAt(0).toUpperCase() + user.risk_profile.slice(1) : 'Moderat'}
                            </div>
                          </div>
                          {/* Saldo Virtual */}
                          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 12, padding: '14px 16px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Saldo Virtual</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>
                              Rp {user?.virtual_balance?.toLocaleString('id-ID') || '100.000.000'}
                            </div>
                          </div>
                          {/* Bergabung Sejak */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Bergabung Sejak</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                              {user?.created_at
                                ? new Date(user.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '09 Jun 2026'}
                            </div>
                          </div>
                          {/* Status Akun */}
                          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 12, padding: '14px 16px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Status Akun</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>Aktif</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}


                  {/* ── TAB 2: KEAMANAN ── */}
                  {activeTab === 'security' && (
                    <>
                      {/* Card 1: Ubah Kata Sandi */}
                      <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>Ubah Kata Sandi</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                          Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.
                        </p>

                        <div style={{ width: '100%' }}>
                          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
                            KATA SANDI SAAT INI
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              ref={currPassRef}
                              type={showPass ? 'text' : 'password'}
                              value={currPass}
                              onChange={e => setCurrPass(e.target.value)}
                              placeholder="••••••••"
                              style={{
                                width: '100%', padding: '12px 40px 12px 16px', borderRadius: 12,
                                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                                boxSizing: 'border-box', outline: 'none'
                              }}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowPass(v => !v);
                              }}
                              style={{
                                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                fontSize: 16, color: 'var(--text-muted)'
                              }}
                              title={showPass ? 'Sembunyikan' : 'Tampilkan'}
                            >
                              {showPass ? '🙈' : '👁️'}
                            </button>
                          </div>

                          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6, marginTop: 18 }}>
                            KATA SANDI BARU
                          </label>
                          <input
                            type={showPass ? 'text' : 'password'}
                            value={newPass}
                            onChange={e => setNewPass(e.target.value)}
                            placeholder="••••••••"
                            style={{
                              width: '100%', padding: '12px 16px', borderRadius: 12,
                              border: '1px solid var(--border)', background: 'var(--bg-primary)',
                              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                              boxSizing: 'border-box', outline: 'none'
                            }}
                          />

                          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6, marginTop: 18 }}>
                            KONFIRMASI SANDI BARU
                          </label>
                          <input
                            type={showPass ? 'text' : 'password'}
                            value={confirmPass}
                            onChange={e => setConfirmPass(e.target.value)}
                            placeholder="••••••••"
                            style={{
                              width: '100%', padding: '12px 16px', borderRadius: 12,
                              border: confirmPass && confirmPass !== newPass ? '1px solid #ef4444' : '1px solid var(--border)',
                              background: 'var(--bg-primary)', fontSize: 14, fontWeight: 600,
                              color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none'
                            }}
                          />

                          <button
                            onClick={handleUpdatePassword}
                            disabled={savingPass}
                            style={{
                              background: '#2563eb', color: '#fff', border: 'none',
                              borderRadius: 10, padding: '12px 24px', fontSize: 13,
                              fontWeight: 700, cursor: 'pointer', marginTop: 20,
                              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                              display: 'inline-flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <span>🔒</span> {savingPass ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
                          </button>
                        </div>
                      </div>

                      {/* Card 2: Autentikasi Dua Faktor */}
                      <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'rgba(16,185,129,0.1)', color: '#10b981',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18
                          }}>
                            🛡️
                          </div>
                          <div>
                            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Autentikasi Dua Faktor</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Lapisan keamanan tambahan untuk akun kamu.</p>
                          </div>
                        </div>

                        <div style={{
                          background: 'var(--bg-primary)', borderRadius: 12,
                          border: '1px solid var(--border)', padding: '14px 16px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginTop: 16, marginBottom: 16
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>2FA via Authenticator App</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Google Authenticator / Authy</div>
                          </div>
                          <span style={{
                            background: '#fff7ed', color: '#c2410c',
                            border: '1px solid #ffedd5', padding: '3px 10px',
                            borderRadius: 12, fontSize: 11, fontWeight: 700
                          }}>
                            Belum aktif
                          </span>
                        </div>

                        <button
                          onClick={() => toast.warning('Segera Hadir 🚧', 'Fitur 2FA sedang dalam pengembangan.')}
                          style={{
                            width: '100%', background: 'transparent', color: '#2563eb',
                            border: '1px solid rgba(37,99,235,0.4)', borderRadius: 10,
                            padding: '12px', fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', textAlign: 'center'
                          }}
                        >
                          Aktifkan 2FA
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── TAB 3: PROFIL RISIKO ── */}
                  {activeTab === 'risk' && (
                    <div className="card" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>Profil Risiko Investasi</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                        Pilih profil yang sesuai dengan toleransi risiko kamu.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
                        {[
                          {
                            id: 'Konservatif',
                            icon: '🛡️',
                            badge: 'Rendah',
                            badgeColor: '#166534',
                            badgeBg: '#f0fdf4',
                            badgeBorder: '#dcfce7',
                            desc: 'Prioritas keamanan modal. Cocok untuk investor pemula yang menghindari risiko tinggi.',
                            returnText: 'Estimasi return: 4–8% / tahun',
                          },
                          {
                            id: 'Moderat',
                            icon: '⚖️',
                            badge: 'Sedang',
                            badgeColor: '#9a3412',
                            badgeBg: '#fff7ed',
                            badgeBorder: '#ffedd5',
                            desc: 'Keseimbangan antara pertumbuhan dan keamanan. Cocok untuk investor menengah.',
                            returnText: 'Estimasi return: 8–15% / tahun',
                          },
                          {
                            id: 'Agresif',
                            icon: '🚀',
                            badge: 'Tinggi',
                            badgeColor: '#991b1b',
                            badgeBg: '#fef2f2',
                            badgeBorder: '#fee2e2',
                            desc: 'Fokus pada pertumbuhan maksimal. Toleransi tinggi terhadap fluktuasi pasar.',
                            returnText: 'Estimasi return: 15–30%+ / tahun',
                          },
                        ].map(p => {
                          const isActive = selectedProfile.toLowerCase() === p.id.toLowerCase()
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedProfile(p.id)
                                api.put('/auth/profile', { risk_profile: p.id.toLowerCase() })
                                  .then(res => {
                                    setUser(res.data)
                                    toast.success('Profil Risiko Diperbarui ✅', `Profil Anda: ${p.id}`)
                                  })
                                  .catch(() => {})
                              }}
                              style={{
                                padding: '18px 20px', borderRadius: 14, cursor: 'pointer',
                                border: isActive ? '2px solid #2563eb' : '1px solid var(--border)',
                                background: isActive ? '#f0f7ff' : 'var(--bg-primary)',
                                transition: 'all 0.2s ease', position: 'relative',
                                boxShadow: isActive ? '0 4px 12px rgba(37,99,235,0.15)' : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                                    {p.id}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{
                                    background: p.badgeBg, color: p.badgeColor,
                                    border: `1px solid ${p.badgeBorder}`, padding: '2px 10px',
                                    borderRadius: 10, fontSize: 11, fontWeight: 700
                                  }}>
                                    {p.badge}
                                  </span>
                                  {isActive && (
                                    <span style={{
                                      width: 20, height: 20, borderRadius: '50%',
                                      background: '#2563eb', color: '#fff', fontSize: 11,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 800
                                    }}>
                                      ✓
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px 30px', lineHeight: 1.5 }}>
                                {p.desc}
                              </p>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', paddingLeft: 30 }}>
                                {p.returnText}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── TAB 4: PREFERENSI ── */}
                  {activeTab === 'preferences' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Card 1: Tampilan Visual */}
                      <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>🎨 Tampilan Visual</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                          Atur tema warna dan tata letak halaman utama aplikasi.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                          {/* Tema Tampilan */}
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 10 }}>
                              TEMA TAMPILAN
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {(['dark', 'light'] as const).map(t => (
                                <div
                                  key={t}
                                  onClick={() => handleThemeChange(t)}
                                  style={{
                                    flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                                    border: theme === t ? '2px solid #2563eb' : '1px solid var(--border)',
                                    background: theme === t ? '#eff6ff' : 'var(--bg-primary)',
                                    fontWeight: 700, fontSize: 12, transition: 'all 0.15s ease',
                                    color: theme === t ? '#2563eb' : 'var(--text-secondary)',
                                    textAlign: 'center'
                                  }}
                                >
                                  {t === 'dark' ? '🌙 Gelap' : '☀️ Terang'}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Layout Dashboard */}
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 10 }}>
                              LAYOUT DASHBOARD
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {[
                                { id: 'classic' as const, name: '📊 Klasik' },
                                { id: 'modern' as const, name: '🖥️ Modern' },
                              ].map(opt => (
                                <div
                                  key={opt.id}
                                  onClick={() => handleDashLayoutChange(opt.id)}
                                  style={{
                                    flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                                    border: dashboardLayout === opt.id ? '2px solid #2563eb' : '1px solid var(--border)',
                                    background: dashboardLayout === opt.id ? '#eff6ff' : 'var(--bg-primary)',
                                    fontWeight: 700, fontSize: 12, transition: 'all 0.15s ease',
                                    color: dashboardLayout === opt.id ? '#2563eb' : 'var(--text-secondary)',
                                    textAlign: 'center'
                                  }}
                                >
                                  {opt.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Notifikasi & Sinyal AI */}
                      <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>🔔 Notifikasi & Sinyal AI</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                          Atur pemberitahuan rekomendasi dan peringatan portofolio.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* Item 1 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Sinyal AI Top Picks Harian (17:00 WIB)</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pengingat saat model Machine Learning selesai di-update</div>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={notifyAiSignals} 
                              onChange={e => setNotifyAiSignals(e.target.checked)}
                              style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                          </div>

                          {/* Item 2 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Waspada Pergerakan Portofolio (&gt;3%)</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pemberitahuan saat saham simpanan mengalami lonjakan/penurunan</div>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={notifyPortfolioAlert} 
                              onChange={e => setNotifyPortfolioAlert(e.target.checked)}
                              style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Preferensi Data & Panduan */}
                      <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>📊 Display Data & Panduan</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                          Pengaturan tambahan untuk grafik dan tur edukasi aplikasi.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Tampilkan Mini Sparkline Chart 7-Hari</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Menampilkan tren grafik mini di daftar pasar & portofolio</div>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={showSparklines} 
                              onChange={e => setShowSparklines(e.target.checked)}
                              style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              localStorage.removeItem('stoxarea_tour_done')
                              window.dispatchEvent(new Event('STOXAREA:open-tutorial'))
                              toast.info('Tutorial Dibuka 🎓', 'Petunjuk panduan aplikasi sedang ditampilkan...')
                            }}
                            style={{
                              background: 'transparent', color: '#2563eb',
                              border: '1px solid rgba(37,99,235,0.4)', borderRadius: 10,
                              padding: '10px 18px', fontSize: 12, fontWeight: 700,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <span>🎓</span> Lihat Tutorial Aplikasi
                          </button>

                          <button 
                            onClick={handleSavePreferences} 
                            style={{
                              background: '#2563eb', color: '#fff', border: 'none',
                              borderRadius: 10, padding: '10px 24px', fontSize: 13,
                              fontWeight: 700, cursor: 'pointer',
                              boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
                            }}
                          >
                            Simpan Preferensi
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TAB 5: FAQ (PERTANYAAN UMUM) ── */}
                  {activeTab === 'faq' && (
                    <div className="card" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>Pertanyaan Umum</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                        Temukan jawaban dari pertanyaan yang sering ditanyakan.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', marginBottom: 24 }}>
                        {FAQ_ITEMS.map((group) => (
                          <div key={group.category}>
                            <div style={{
                              fontSize: 11, fontWeight: 800, color: 'var(--text-muted)',
                              textTransform: 'uppercase', letterSpacing: 0.8,
                              marginBottom: 10, paddingBottom: 6,
                              borderBottom: '1px solid var(--border)'
                            }}>
                              {group.category}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {group.items.map((item, idx) => {
                                const key = `${group.category}-${idx}`
                                const isOpen = openFaq === key
                                return (
                                  <div key={key} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                                    <button
                                      onClick={() => setOpenFaq(isOpen ? null : key)}
                                      style={{
                                        width: '100%', display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', padding: '14px 16px',
                                        background: 'transparent', border: 'none',
                                        cursor: 'pointer', textAlign: 'left',
                                        fontSize: 14, fontWeight: 700, color: isOpen ? '#2563eb' : 'var(--text-primary)',
                                        gap: 12
                                      }}
                                    >
                                      <span>{item.q}</span>
                                      <span style={{ fontSize: 12, color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                                        ▼
                                      </span>
                                    </button>
                                    {isOpen && (
                                      <div style={{ padding: '0 16px 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, borderTop: '1px dashed var(--border)', paddingTop: 12, whiteSpace: 'pre-line' }}>
                                        {item.a}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Support Contact Box */}
                      <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 14, padding: '16px 20px', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1d4ed8', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                          <span>ⓘ</span> Masih ada pertanyaan?
                        </div>
                        <div style={{ fontSize: 12, color: '#1e40af' }}>
                          Hubungi tim support kami melalui email <a href="mailto:anompangestu16@gmail.com" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>anompangestu16@gmail.com</a>
                        </div>
                      </div>
                    </div>
                  )}

                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Shared inline styles ──────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '11px 24px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const btnOutline: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const statBox: React.CSSProperties = {
  padding: '14px 16px',
  background: 'var(--bg-primary)',
  borderRadius: 10,
  border: '1px solid var(--border)',
}
