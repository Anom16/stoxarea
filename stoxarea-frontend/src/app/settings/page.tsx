'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import api from '@/lib/api'

const dict = {
  id: {
    title: "Pengaturan Sistem",
    subtitle: "Profil & Pengaturan Akun",
    tabAccount: "👤 Akun Saya",
    tabSecurity: "🛡️ Keamanan & Sandi",
    tabPref: "🌐 Preferensi Tampilan",
    logout: "🚪 Keluar (Logout)",
    personalInfo: "Informasi Pribadi",
    fullName: "Nama Lengkap",
    email: "Alamat Email (Terverifikasi)",
    phone: "Nomor Handphone",
    invData: "Data Investasi StoxArea",
    riskProfile: "Profil Risiko Anda",
    virtualBal: "Saldo Virtual (Trading)",
    saveBtn: "Simpan Perubahan",
    securityPass: "Keamanan Kata Sandi",
    currPass: "Kata Sandi Saat Ini",
    newPass: "Kata Sandi Baru",
    updatePassBtn: "Perbarui Kata Sandi",
    tfa: "Autentikasi Dua Faktor (2FA)",
    tfaDesc: "Tingkatkan keamanan akun Anda dengan mewajibkan kode verifikasi tambahan saat masuk.",
    enableTfa: "Aktifkan 2FA",
    displaySettings: "Pengaturan Tampilan",
    appLang: "Bahasa Aplikasi",
    appTheme: "Tema Tampilan (Tema Visual)",
    themeDark: "🌙 Mode Gelap",
    themeLight: "☀️ Mode Terang",
    notif: "Notifikasi",
    notif1: "Terima notifikasi rekap pasar harian",
    notif2: "Peringatan saat pergerakan harga ekstrem",
    savePref: "Simpan Preferensi",
  },
  en: {
    title: "System Settings",
    subtitle: "Profile & Account Settings",
    tabAccount: "👤 My Account",
    tabSecurity: "🛡️ Security & Password",
    tabPref: "🌐 Display Preferences",
    logout: "🚪 Logout",
    personalInfo: "Personal Information",
    fullName: "Full Name",
    email: "Email Address (Verified)",
    phone: "Phone Number",
    invData: "StoxArea Investment Data",
    riskProfile: "Your Risk Profile",
    virtualBal: "Virtual Balance (Trading)",
    saveBtn: "Save Changes",
    securityPass: "Password Security",
    currPass: "Current Password",
    newPass: "New Password",
    updatePassBtn: "Update Password",
    tfa: "Two-Factor Authentication (2FA)",
    tfaDesc: "Improve your account security by requiring an additional verification code upon login.",
    enableTfa: "Enable 2FA",
    displaySettings: "Display Settings",
    appLang: "Application Language",
    appTheme: "Visual Theme",
    themeDark: "🌙 Dark Mode",
    themeLight: "☀️ Light Mode",
    notif: "Notifications",
    notif1: "Receive daily market recap notifications",
    notif2: "Alerts on extreme price movements",
    savePref: "Save Preferences",
  }
}

export default function SettingsPage() {
  const [user, setUser] = useState<{ email?: string; risk_profile?: string; virtual_balance?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('account')

  // Theme & Language state
  const [lang, setLang] = useState<'id' | 'en'>('id')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // Load preferences from local storage if available
    const savedLang = localStorage.getItem('app_lang') as 'id' | 'en'
    if (savedLang) setLang(savedLang)
    
    const savedTheme = localStorage.getItem('app_theme') as 'dark' | 'light'
    if (savedTheme) {
      setTheme(savedTheme)
      if (savedTheme === 'light') {
        document.body.classList.add('light-mode')
      } else {
        document.body.classList.remove('light-mode')
      }
    }

    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => setUser(r.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      window.location.href = '/auth/login'
    }
  }, [])

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    localStorage.setItem('app_theme', newTheme)
    if (newTheme === 'light') {
      document.body.classList.add('light-mode')
    } else {
      document.body.classList.remove('light-mode')
    }
  }

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as 'id' | 'en'
    setLang(newLang)
    localStorage.setItem('app_lang', newLang)
  }

  const handleSavePref = () => {
    alert(lang === 'id' ? 'Preferensi berhasil disimpan!' : 'Preferences saved successfully!')
  }

  const handleSaveAccount = () => {
    alert(lang === 'id' ? 'Profil berhasil diperbarui!' : 'Profile updated successfully!')
  }

  const handleUpdatePassword = () => {
    alert(lang === 'id' ? 'Kata sandi berhasil diperbarui!' : 'Password updated successfully!')
  }

  const handleToggle2FA = () => {
    alert(lang === 'id' ? 'Fitur 2FA saat ini sedang dalam pengembangan.' : '2FA feature is currently under development.')
  }

  const t = dict[lang]

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar title={t.title} />
        
        <div className="page-body">
          <h2 className="section-title mb-24">{t.subtitle}</h2>
          
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            
            {/* Sidebar Menu Pengaturan */}
            <div className="card" style={{ width: 250, padding: 12 }}>
              <div 
                className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('account')}
              >
                {t.tabAccount}
              </div>
              <div 
                className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                {t.tabSecurity}
              </div>
              <div 
                className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
                onClick={() => setActiveTab('preferences')}
              >
                {t.tabPref}
              </div>
              <hr style={{ margin: '16px 0', borderColor: 'var(--border)' }} />
              <div 
                className="settings-tab text-red"
                onClick={() => {
                  if(confirm(lang === 'id' ? 'Yakin ingin keluar?' : 'Are you sure you want to log out?')) {
                    localStorage.removeItem('access_token');
                    window.location.href = '/auth/login';
                  }
                }}
              >
                {t.logout}
              </div>
            </div>

            {/* Konten Pengaturan */}
            <div className="card" style={{ flex: 1, minHeight: 400 }}>
              {loading ? (
                <p className="text-muted">Loading...</p>
              ) : (
                <>
                  {/* TAB: AKUN SAYA */}
                  {activeTab === 'account' && (
                    <div className="fade-in">
                      <h3 className="mb-16" style={{ fontSize: 18 }}>{t.personalInfo}</h3>
                      <div className="form-group mb-16">
                        <label className="fs-12 text-muted fw-700">{t.fullName}</label>
                        <input type="text" className="input-field mt-4" defaultValue={user?.email?.split('@')[0].toUpperCase()} style={{ width: '100%', maxWidth: 400 }} />
                      </div>
                      <div className="form-group mb-16">
                        <label className="fs-12 text-muted fw-700">{t.email}</label>
                        <input type="email" className="input-field mt-4" value={user?.email || ''} disabled style={{ width: '100%', maxWidth: 400, opacity: 0.7 }} />
                      </div>
                      <div className="form-group mb-24">
                        <label className="fs-12 text-muted fw-700">{t.phone}</label>
                        <input type="text" className="input-field mt-4" placeholder="+62 812-XXXX-XXXX" style={{ width: '100%', maxWidth: 400 }} />
                      </div>

                      <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />

                      <h3 className="mb-16" style={{ fontSize: 18 }}>{t.invData}</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
                        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div className="fs-12 text-muted fw-700 mb-4">{t.riskProfile}</div>
                          <div className="fs-16 fw-700 text-accent">{user?.risk_profile || '-'}</div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div className="fs-12 text-muted fw-700 mb-4">{t.virtualBal}</div>
                          <div className="fs-16 fw-700 text-green">Rp {user?.virtual_balance?.toLocaleString() || '0'}</div>
                        </div>
                      </div>

                      <button className="btn-primary mt-24" onClick={handleSaveAccount}>{t.saveBtn}</button>
                    </div>
                  )}

                  {/* TAB: KEAMANAN */}
                  {activeTab === 'security' && (
                    <div className="fade-in">
                      <h3 className="mb-16" style={{ fontSize: 18 }}>{t.securityPass}</h3>
                      <div className="form-group mb-16">
                        <label className="fs-12 text-muted fw-700">{t.currPass}</label>
                        <input type="password" className="input-field mt-4" placeholder="••••••••" style={{ width: '100%', maxWidth: 400 }} />
                      </div>
                      <div className="form-group mb-16">
                        <label className="fs-12 text-muted fw-700">{t.newPass}</label>
                        <input type="password" className="input-field mt-4" placeholder="••••••••" style={{ width: '100%', maxWidth: 400 }} />
                      </div>
                      <button className="btn-outline mt-8 mb-24" onClick={handleUpdatePassword}>{t.updatePassBtn}</button>

                      <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />

                      <h3 className="mb-16" style={{ fontSize: 18 }}>{t.tfa}</h3>
                      <p className="fs-13 text-muted mb-16">
                        {t.tfaDesc}
                      </p>
                      <button className="btn-primary" style={{ background: '#3b82f6', color: 'white', border: 'none' }} onClick={handleToggle2FA}>
                        {t.enableTfa}
                      </button>
                    </div>
                  )}

                  {/* TAB: PREFERENSI */}
                  {activeTab === 'preferences' && (
                    <div className="fade-in">
                      <h3 className="mb-16" style={{ fontSize: 18 }}>{t.displaySettings}</h3>
                      
                      <div className="form-group mb-24">
                        <label className="fs-12 text-muted fw-700 mb-8 d-block">{t.appLang}</label>
                        <select className="input-field" style={{ width: '100%', maxWidth: 300, cursor: 'pointer' }} value={lang} onChange={handleLangChange}>
                          <option value="id">Bahasa Indonesia</option>
                          <option value="en">English (US)</option>
                        </select>
                      </div>

                      <div className="form-group mb-24">
                        <label className="fs-12 text-muted fw-700 mb-8 d-block">{t.appTheme}</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div 
                            onClick={() => handleThemeChange('dark')}
                            style={{ 
                              padding: '12px 24px', 
                              border: theme === 'dark' ? '2px solid var(--accent)' : '1px solid var(--border)', 
                              borderRadius: 8, 
                              cursor: 'pointer', 
                              background: 'var(--bg-secondary)', 
                              fontWeight: theme === 'dark' ? 600 : 400 
                            }}
                          >
                            {t.themeDark} {theme === 'dark' && '✓'}
                          </div>
                          <div 
                            onClick={() => handleThemeChange('light')}
                            style={{ 
                              padding: '12px 24px', 
                              border: theme === 'light' ? '2px solid var(--accent)' : '1px solid var(--border)', 
                              borderRadius: 8, 
                              cursor: 'pointer',
                              background: 'var(--bg-secondary)',
                              fontWeight: theme === 'light' ? 600 : 400 
                            }}
                          >
                            {t.themeLight} {theme === 'light' && '✓'}
                          </div>
                        </div>
                      </div>
                      
                      <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />
                      
                      <h3 className="mb-16" style={{ fontSize: 18 }}>{t.notif}</h3>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 12 }}>
                        <input type="checkbox" defaultChecked />
                        <span className="fs-14">{t.notif1}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <input type="checkbox" defaultChecked />
                        <span className="fs-14">{t.notif2}</span>
                      </label>
                      
                      <button className="btn-primary mt-24" onClick={handleSavePref}>{t.savePref}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .settings-tab {
          padding: 12px 16px;
          margin-bottom: 4px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .settings-tab:hover {
          background: rgba(255,255,255,0.05);
          color: var(--text-primary);
        }
        .settings-tab.active {
          background: var(--accent);
          color: #fff;
        }
        .input-field {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 14px;
        }
        .input-field:focus {
          outline: none;
          border-color: var(--accent);
        }
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
