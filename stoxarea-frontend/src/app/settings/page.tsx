'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import ToastContainer from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'

type Tab = 'account' | 'security' | 'risk' | 'preferences'

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

  // Tab: Akun
  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Tab: Keamanan
  const [currPass, setCurrPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  // Tab: Profil Risiko
  const [selectedProfile, setSelectedProfile] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Tab: Preferensi
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [lang, setLang] = useState<'id' | 'en'>('id')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/auth/login'); return }

    const savedTheme = localStorage.getItem('app_theme') as 'dark' | 'light'
    if (savedTheme) setTheme(savedTheme)
    const savedLang = localStorage.getItem('app_lang') as 'id' | 'en'
    if (savedLang) setLang(savedLang)

    api.get('/auth/me')
      .then(r => {
        setUser(r.data)
        setFullName(r.data.full_name || '')
        setSelectedProfile(r.data.risk_profile || 'Moderat')
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
      const res = await api.put('/auth/profile', { risk_profile: selectedProfile })
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

  // ── Handler: Preferensi Tampilan ──────────────────────────────────────────
  const handleThemeChange = (t: 'dark' | 'light') => {
    setTheme(t)
    localStorage.setItem('app_theme', t)
    document.body.classList.toggle('light-mode', t === 'light')
  }

  const handleSavePreferences = () => {
    localStorage.setItem('app_lang', lang)
    toast.success('Preferensi Disimpan ✅', `Bahasa: ${lang === 'id' ? 'Indonesia' : 'English'} · Tema: ${theme === 'dark' ? 'Gelap' : 'Terang'}`)
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
  ]

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar title="Pengaturan" />
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <div className="page-body">
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

            {/* ── Sidebar Tab ── */}
            <div className="card" style={{ width: 220, padding: 10, flexShrink: 0 }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
            <div className="card" style={{ flex: 1, minHeight: 420 }}>
              {loading ? (
                <div style={{ color: 'var(--text-muted)', padding: 20 }}>Memuat data akun...</div>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 440 }}>
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
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPass ? 'text' : 'password'}
                            value={currPass}
                            onChange={e => setCurrPass(e.target.value)}
                            placeholder="••••••••"
                            style={inputStyle}
                          />
                          <button
                            onClick={() => setShowPass(v => !v)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
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

                      {/* Bahasa */}
                      <label style={labelStyle}>Bahasa Aplikasi</label>
                      <select
                        value={lang}
                        onChange={e => setLang(e.target.value as 'id' | 'en')}
                        style={{ ...inputStyle, maxWidth: 260, marginTop: 8, marginBottom: 24, cursor: 'pointer' }}
                      >
                        <option value="id">🇮🇩 Bahasa Indonesia</option>
                        <option value="en">🇺🇸 English (US)</option>
                      </select>

                      <hr style={{ margin: '4px 0 24px', borderColor: 'var(--border)' }} />

                      {/* Notifikasi */}
                      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Notifikasi</h3>
                      {[
                        'Terima rekap pasar harian (setiap hari kerja pukul 17.00)',
                        'Peringatan saat pergerakan harga ekstrem (>5% dalam sehari)',
                        'Notifikasi saat rekomendasi AI diperbarui',
                      ].map((label, i) => (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 14 }}>
                          <input type="checkbox" defaultChecked={i < 2} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                        </label>
                      ))}

                      <button onClick={handleSavePreferences} style={{ ...btnPrimary, marginTop: 8 }}>
                        Simpan Preferensi
                      </button>
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
