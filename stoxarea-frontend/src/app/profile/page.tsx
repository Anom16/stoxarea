'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import api from '@/lib/api'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newProfile, setNewProfile] = useState('')

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data)
      setNewProfile(res.data.risk_profile || 'Moderat')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    setSaving(true)
    try {
      await api.put('/auth/profile', { risk_profile: newProfile })
      alert("Profil risiko berhasil diperbarui!")
      fetchUser()
    } catch (err) {
      alert("Gagal memperbarui profil.")
    } finally {
      setSaving(false)
    }
  }

  const profiles = [
    { 
      id: 'Konservatif', 
      title: '🛡️ Konservatif', 
      desc: 'Fokus pada keamanan modal. Cocok untuk Anda yang menghindari risiko besar dan memilih saham stabil (Bluechip).',
      color: 'var(--blue)'
    },
    { 
      id: 'Moderat', 
      title: '⚖️ Moderat', 
      desc: 'Keseimbangan antara risiko dan keuntungan. Cocok untuk investasi jangka menengah dengan pertumbuhan stabil.',
      color: 'var(--accent)'
    },
    { 
      id: 'Agresif', 
      title: '🚀 Agresif', 
      desc: 'Mengejar keuntungan maksimal. Siap menghadapi fluktuasi tinggi demi potensi pertumbuhan eksponensial.',
      color: '#ef4444'
    }
  ]

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar title="Pengaturan Profil" />
        
        <div className="page-body">
          <div className="grid-2">
            {/* 1. Informasi User */}
            <div className="card">
              <h3 className="section-title mb-24">Informasi Akun</h3>
              {loading ? (
                <div className="skeleton" style={{ height: 150 }} />
              ) : (
                <div className="user-info">
                  <div className="info-item mb-16">
                    <label className="text-muted fs-12 d-block">Nama Lengkap</label>
                    <div className="fw-700 fs-18">{user?.full_name}</div>
                  </div>
                  <div className="info-item mb-16">
                    <label className="text-muted fs-12 d-block">Alamat Email</label>
                    <div className="fw-600">{user?.email}</div>
                  </div>
                  <div className="info-item">
                    <label className="text-muted fs-12 d-block">Status Akun</label>
                    <div className="sentiment-badge bullish mt-4">Premium User</div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Pemilihan Profil Risiko */}
            <div className="card">
              <h3 className="section-title mb-8">Pilih Profil Risiko</h3>
              <p className="text-muted fs-13 mb-24">Tentukan karakter investasi Anda agar AI bisa memberikan rekomendasi yang tepat.</p>
              
              <div className="profile-selector">
                {profiles.map(p => (
                  <div 
                    key={p.id}
                    className={`profile-card ${newProfile === p.id ? 'active' : ''}`}
                    onClick={() => setNewProfile(p.id)}
                    style={{ borderLeft: `4px solid ${p.color}` }}
                  >
                    <div className="fw-700 mb-4">{p.title}</div>
                    <div className="fs-11 text-muted">{p.desc}</div>
                    {newProfile === p.id && <div className="active-check">✓</div>}
                  </div>
                ))}
              </div>

              <button 
                className="btn-primary w-full mt-24" 
                style={{ height: 48 }}
                onClick={handleUpdateProfile}
                disabled={saving || loading}
              >
                {saving ? 'Menyimpan...' : 'Simpan Profil Risiko'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 24px;
        }
        .profile-selector {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .profile-card {
          padding: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .profile-card:hover {
          background: rgba(255,255,255,0.05);
        }
        .profile-card.active {
          background: rgba(var(--accent-rgb), 0.1);
          border-color: var(--accent);
        }
        .active-check {
          position: absolute;
          top: 12px;
          right: 16px;
          color: var(--accent);
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}
