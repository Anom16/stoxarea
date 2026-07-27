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
        q: 'Apa itu StoxArea?',
        a: 'StoxArea adalah platform analitik dan edukasi pasar saham Indonesia berbasis kecerdasan buatan. Sistem ini menggabungkan algoritma Machine Learning (XGBoost) dan metode Sistem Pendukung Keputusan (SAW) untuk menghasilkan rekomendasi saham yang dipersonalisasi sesuai profil risiko Anda.'
      },
      {
        q: 'Apakah StoxArea gratis digunakan?',
        a: 'Ya, StoxArea sepenuhnya gratis. Seluruh fitur termasuk AI Watchlist, analisis fundamental/teknikal, dan Virtual Trading tersedia tanpa biaya apapun.'
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
        a: 'Rekomendasi StoxArea bersifat personal, bukan generik. Perbedaan terjadi karena metode SAW memberikan bobot berbeda pada setiap kriteria (AI Score, ROE, DER, PBV) tergantung profil risiko Anda. Dua pengguna dengan profil berbeda akan melihat urutan rekomendasi yang berbeda meskipun melihat sektor yang sama.'
      },
      {
        q: 'Apakah rekomendasi StoxArea dapat dijadikan dasar keputusan investasi?',
        a: '**Tidak.** Seluruh output StoxArea — termasuk AI Score, Match Score, dan AI Watchlist — adalah hasil kalkulasi matematis algoritmik, bukan saran investasi.\n\n' +
          '**Batasan penting:**\n' +
          '• StoxArea tidak terdaftar sebagai Penasihat Investasi di OJK.\n' +
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
        q: 'Apakah data pribadi saya aman di StoxArea?',
        a: '**Ya, data Anda aman.** Kami menerapkan standar keamanan industri untuk melindungi informasi pribadi Anda.\n\n' +
          '**Rincian teknis:**\n' +
          '• Data pribadi (email, nama, profil risiko) disimpan di database PostgreSQL yang dihosting di Supabase.\n' +
          '• Database dilindungi enkripsi standar industri.\n' +
          '• Password disimpan dalam bentuk hash menggunakan algoritma bcrypt — tidak ada yang bisa melihat password asli Anda, termasuk administrator.\n' +
          '• StoxArea tidak menyimpan informasi keuangan atau rekening bank Anda.'
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
    if (confirm('Yakin ingin keluar dari StoxArea?')) {
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
          <div className="settings-layout">

            {/* ── Sidebar Tab ── */}
            <div className={`card settings-sidebar ${mobileView === 'content' ? 'hidden-mobile' : ''}`}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMobileView('content')
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '11px 14px', marginBottom: 4, borderRadius: 8,
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
              <hr style={{ margin: '12px 0', borderColor: 'var(--border)' }} />
              <button
                onClick={handleLogout}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '11px 14px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: 'transparent', color: '#ef4444', transition: 'all 0.15s',
                }}
              >
                🚪 Keluar (Logout)
              </button>
            </div>

            {/* ── Konten ── */}
            <div className={`card settings-content ${mobileView === 'menu' ? 'hidden-mobile' : ''}`}>
              {/* Tombol kembali untuk mobile */}
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

                  {/* ── TAB: AKUN SAYA ── */}
                  {activeTab === 'account' && (
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Informasi Pribadi</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                        Perubahan nama akan langsung tersimpan ke database.
                      </p>

                      <div style={{ maxWidth: 440 }}>
                        <label style={labelStyle}>Nama Lengkap</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder="Masukkan nama lengkap Anda"
                          style={inputStyle}
                          onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        />

                        <label style={{ ...labelStyle, marginTop: 16 }}>Alamat Email</label>
                        <input
                          type="email"
                          value={user?.email || ''}
                          disabled
                          style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Email tidak dapat diubah karena digunakan sebagai identitas login.
                        </p>

                        <button
                          onClick={handleSaveName}
                          disabled={savingName}
                          style={{ ...btnPrimary, marginTop: 24 }}
                        >
                          {savingName ? 'Menyimpan...' : 'Simpan Nama'}
                        </button>
                      </div>

                      <hr style={{ margin: '28px 0', borderColor: 'var(--border)' }} />

                      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Data Investasi</h3>
                      <div className="stat-grid">
                        <div style={statBox}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Profil Risiko</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
                            {user?.risk_profile || '—'}
                          </div>
                        </div>
                        <div style={statBox}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Saldo Virtual</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>
                            Rp {user?.virtual_balance?.toLocaleString('id-ID') || '0'}
                          </div>
                        </div>
                        <div style={statBox}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bergabung Sejak</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {user?.created_at
                              ? new Date(user.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                              : '—'}
                          </div>
                        </div>
                        <div style={statBox}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Status Akun</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>● Aktif</div>
                        </div>
                      </div>

                      <hr style={{ margin: '28px 0', borderColor: 'var(--border)' }} />

                      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Panduan Aplikasi</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                        Tampilkan kembali tutorial langkah demi langkah penggunaan StoxArea.
                      </p>
                      <button
                        onClick={() => {
                          localStorage.removeItem('stoxarea_tour_done')
                          window.dispatchEvent(new Event('stoxarea:open-tutorial'))
                        }}
                        style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        🎓 Lihat Tutorial Aplikasi
                      </button>
                    </div>
                  )}


                  {/* ── TAB: KEAMANAN ── */}
                  {activeTab === 'security' && (
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Ubah Kata Sandi</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                        Kata sandi baru minimal 8 karakter dan harus berbeda dari yang lama.
                      </p>

                      <div style={{ maxWidth: 440 }}>
                        <label style={labelStyle}>Kata Sandi Saat Ini</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            ref={currPassRef}
                            type={showPass ? 'text' : 'password'}
                            value={currPass}
                            onChange={e => setCurrPass(e.target.value)}
                            placeholder="Masukkan kata sandi saat ini"
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (currPassRef.current) {
                                setCurrPass(currPassRef.current.value);
                              }
                              setShowPass(v => !v);
                            }}
                            style={{ ...btnOutline, padding: '10px 14px', whiteSpace: 'nowrap' }}
                          >
                            {showPass ? '🙈 Sembunyikan' : '👁 Tampilkan'}
                          </button>
                        </div>

                        <label style={{ ...labelStyle, marginTop: 16 }}>Kata Sandi Baru</label>
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          placeholder="Min. 8 karakter"
                          style={inputStyle}
                        />
                        {newPass.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                            {['Panjang ≥8', 'Huruf besar', 'Angka'].map((req, i) => {
                              const ok = i === 0 ? newPass.length >= 8 : i === 1 ? /[A-Z]/.test(newPass) : /\d/.test(newPass)
                              return (
                                <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700, background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: ok ? '#10b981' : 'var(--text-muted)' }}>
                                  {ok ? '✓' : '○'} {req}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        <label style={{ ...labelStyle, marginTop: 16 }}>Konfirmasi Kata Sandi Baru</label>
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={confirmPass}
                          onChange={e => setConfirmPass(e.target.value)}
                          placeholder="Ulangi kata sandi baru"
                          style={{ ...inputStyle, borderColor: confirmPass && confirmPass !== newPass ? '#ef4444' : undefined }}
                        />
                        {confirmPass && confirmPass !== newPass && (
                          <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Kata sandi tidak cocok.</p>
                        )}

                        <button
                          onClick={handleUpdatePassword}
                          disabled={savingPass}
                          style={{ ...btnPrimary, marginTop: 24 }}
                        >
                          {savingPass ? 'Memperbarui...' : '🔒 Perbarui Kata Sandi'}
                        </button>
                      </div>

                      <hr style={{ margin: '28px 0', borderColor: 'var(--border)' }} />
                      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Autentikasi Dua Faktor (2FA)</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                        Tambahkan lapisan keamanan ekstra dengan kode OTP saat login. Fitur ini sedang dalam pengembangan.
                      </p>
                      <button
                        onClick={() => toast.warning('Segera Hadir 🚧', 'Fitur 2FA sedang dalam pengembangan.')}
                        style={{ ...btnOutline }}
                      >
                        Aktifkan 2FA (Coming Soon)
                      </button>
                    </div>
                  )}

                  {/* ── TAB: PROFIL RISIKO ── */}
                  {activeTab === 'risk' && (
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Profil Risiko Investasi</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                        Profil ini menentukan bobot kriteria dalam algoritma rekomendasi SAW. Ubah sesuai kondisi finansial Anda saat ini.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, marginBottom: 24 }}>
                        {PROFILE_OPTIONS.map(p => {
                          const isActive = selectedProfile === p.id
                          return (
                            <div
                              key={p.id}
                              onClick={() => setSelectedProfile(p.id)}
                              style={{
                                padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                                border: isActive ? `2px solid ${p.color}` : '1px solid var(--border)',
                                background: isActive ? `${p.color}12` : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.2s', position: 'relative',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <span style={{ fontSize: 20 }}>{p.emoji}</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: isActive ? p.color : 'var(--text-primary)' }}>
                                  {p.id}
                                </span>
                                {isActive && (
                                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: p.color }}>✓ Aktif</span>
                                )}
                              </div>
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, paddingLeft: 30 }}>{p.desc}</p>
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <button
                          onClick={handleSaveProfile}
                          disabled={savingProfile || selectedProfile === user?.risk_profile}
                          style={{ ...btnPrimary, opacity: selectedProfile === user?.risk_profile ? 0.5 : 1 }}
                        >
                          {savingProfile ? 'Menyimpan...' : 'Simpan Profil Risiko'}
                        </button>
                        {selectedProfile === user?.risk_profile && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ini sudah profil aktif Anda.</span>
                        )}
                      </div>

                      <div style={{ marginTop: 24, padding: '14px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10 }}>
                        <p style={{ fontSize: 12, color: '#f59e0b', margin: 0 }}>
                          💡 Ingin profil yang lebih akurat? <a href="/onboarding" style={{ color: '#f59e0b', fontWeight: 700 }}>Isi ulang kuesioner profil risiko →</a>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── TAB: PREFERENSI ── */}
                  {activeTab === 'preferences' && (
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Preferensi Tampilan</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                        Pengaturan ini disimpan di browser Anda (localStorage).
                      </p>

                      {/* Tampilan Dashboard */}
                      <label style={labelStyle}>Tampilan Dashboard</label>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, marginTop: 4 }}>
                        Pilih tampilan halaman utama Dashboard sesuai preferensi Anda.
                      </p>
                      <div className="pref-grid">
                        {[
                          {
                            id: 'classic' as const,
                            emoji: '📊',
                            name: 'Klasik',
                            desc: 'Stats ringkasan, kartu top pick emiten, tabel Ranking SPK & Radar Sektor, Top Mover per sektor.',
                            color: '#10b981',
                          },
                          {
                            id: 'modern' as const,
                            emoji: '🖥️',
                            name: 'Modern',
                            desc: 'Widget IHSG, ringkasan portofolio virtual, tab Ringkasan Pasar & Analisis Sektoral interaktif.',
                            color: '#3b82f6',
                          },
                        ].map(opt => {
                          const isActive = dashboardLayout === opt.id
                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleDashLayoutChange(opt.id)}
                              style={{
                                padding: '16px 18px',
                                borderRadius: 12,
                                cursor: 'pointer',
                                border: isActive ? `2px solid ${opt.color}` : '1px solid var(--border)',
                                background: isActive ? `${opt.color}12` : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: isActive ? opt.color : 'var(--text-primary)' }}>
                                  {opt.name}
                                </span>
                                {isActive && (
                                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: opt.color }}>✓ Aktif</span>
                                )}
                              </div>
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{opt.desc}</p>
                            </div>
                          )
                        })}
                      </div>

                      <hr style={{ margin: '0 0 24px', borderColor: 'var(--border)' }} />

                      {/* Tema */}
                      <label style={labelStyle}>Tema Tampilan</label>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 24, marginTop: 8 }}>
                        {(['dark', 'light'] as const).map(t => (
                          <div
                            key={t}
                            onClick={() => handleThemeChange(t)}
                            style={{
                              padding: '14px 24px', borderRadius: 10, cursor: 'pointer',
                              border: theme === t ? '2px solid var(--accent)' : '1px solid var(--border)',
                              background: theme === t ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                              fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
                              color: theme === t ? 'var(--accent)' : 'var(--text-secondary)',
                            }}
                          >
                            {t === 'dark' ? '🌙 Mode Gelap' : '☀️ Mode Terang'}
                            {theme === t && <span style={{ marginLeft: 8 }}>✓</span>}
                          </div>
                        ))}
                      </div>

                      <button onClick={handleSavePreferences} style={{ ...btnPrimary, marginTop: 8 }}>
                        Simpan Preferensi
                      </button>
                    </div>
                  )}

                  {/* ── TAB: FAQ ── */}
                  {activeTab === 'faq' && (
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Pertanyaan yang Sering Diajukan</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>Klik pertanyaan untuk melihat jawabannya.</p>

                      {FAQ_ITEMS.map((group) => (
                        <div key={group.category} style={{ marginBottom: 28 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: 0.8,
                            marginBottom: 10, paddingBottom: 6,
                            borderBottom: '1px solid var(--border)'
                          }}>
                            {group.category}
                          </div>

                          {group.items.map((item, idx) => {
                            const key = `${group.category}-${idx}`
                            const isOpen = openFaq === key
                            return (
                              <div key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                                <button
                                  onClick={() => setOpenFaq(isOpen ? null : key)}
                                  style={{
                                    width: '100%', display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', padding: '14px 0',
                                    background: 'transparent', border: 'none',
                                    cursor: 'pointer', textAlign: 'left', gap: 12,
                                  }}
                                >
                                  <span style={{
                                    fontSize: 14, fontWeight: 600,
                                    color: isOpen ? 'var(--accent)' : 'var(--text-primary)',
                                    transition: 'color 0.15s',
                                  }}>
                                    {item.q}
                                  </span>
                                  <span style={{
                                    fontSize: 18, color: 'var(--text-muted)',
                                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s',
                                    flexShrink: 0,
                                  }}>▾</span>
                                </button>
                                {isOpen && (
                                  <div style={{
                                    padding: '0 0 16px 0',
                                    fontSize: 13, color: 'var(--text-secondary)',
                                    lineHeight: 1.8,
                                    animation: 'fadeIn 0.2s ease',
                                  }}>
                                    {item.a}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))}
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
