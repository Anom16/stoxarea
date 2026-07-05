'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import ToastContainer from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newProfile, setNewProfile] = useState('')
  const [profiles, setProfiles] = useState<any[]>([])
  const { toasts, removeToast, toast } = useToast()

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data)
      setNewProfile(res.data.risk_profile || 'moderat')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfiles = async () => {
    try {
      const res = await api.get('/auth/risk-profiles')
      const mapped = res.data.map((p: any) => {
        let emoji = '⚖️'
        let color = 'var(--accent)'
        const pid = p.id.toLowerCase()
        if (pid === 'konservatif') { emoji = '🛡️'; color = 'var(--blue)' }
        else if (pid === 'agresif') { emoji = '🚀'; color = '#ef4444' }
        else if (pid === 'moderat') { emoji = '⚖️'; color = 'var(--accent)' }
        else { emoji = '📊'; color = '#E040FB' }
        
        return {
          id: p.id,
          title: `${emoji} ${p.name}`,
          desc: p.description || `Bobot: AI ${((p.weights?.ai_score || 0)*100).toFixed(0)}%, ROE ${((p.weights?.roe || 0)*100).toFixed(0)}%`,
          color: color
        }
      })
      setProfiles(mapped)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    Promise.all([fetchUser(), fetchProfiles()])
  }, [])

  const handleUpdateProfile = async () => {
    setSaving(true)
    try {
      await api.put('/auth/profile', { risk_profile: newProfile })
      toast.success(
        'Profil Risiko Diperbarui ✅',
        `Profil Anda sekarang: ${newProfile}`,
        'Rekomendasi AI akan disesuaikan'
      )
      fetchUser()
    } catch (err) {
      toast.error('Gagal Memperbarui', 'Terjadi kesalahan saat menyimpan profil risiko')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar title="Pengaturan Profil" />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        
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
