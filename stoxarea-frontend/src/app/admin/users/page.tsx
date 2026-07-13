'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

const profileColor = (p: string | null) => {
  if (!p) return '#888'
  const pl = p.toLowerCase()
  if (pl === 'konservatif') return '#4CAF50'
  if (pl === 'moderat')     return '#FF9800'
  if (pl === 'agresif')     return '#f44336'
  return '#E040FB'
}

interface UserData {
  id: number
  email: string
  full_name: string | null
  risk_profile: string | null
  virtual_balance: number
  is_admin: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<UserData[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [editId, setEditId]     = useState<number | null>(null)
  const [editData, setEditData] = useState<any>({})
  const [msg, setMsg]           = useState('')
  const [msgType, setMsgType]   = useState<'ok' | 'err'>('ok')

  // Add User Form State
  const [isAdding, setIsAdding]                   = useState(false)
  const [addEmail, setAddEmail]                   = useState('')
  const [addPassword, setAddPassword]             = useState('')
  const [addFullName, setAddFullName]             = useState('')
  const [addRiskProfile, setAddRiskProfile]       = useState('')
  const [addIsAdmin, setAddIsAdmin]               = useState(false)
  const [addVirtualBalance, setAddVirtualBalance] = useState(100000000)

  const resetAddForm = () => {
    setAddEmail('')
    setAddPassword('')
    setAddFullName('')
    setAddRiskProfile('')
    setAddIsAdmin(false)
    setAddVirtualBalance(100000000)
    setIsAdding(false)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addEmail.trim() || !addPassword) {
      showMsg('❌ Email dan Password wajib diisi', 'err')
      return
    }
    if (addPassword.length < 6) {
      showMsg('❌ Password minimal 6 karakter', 'err')
      return
    }

    try {
      const payload = {
        email: addEmail.trim(),
        password: addPassword,
        full_name: addFullName.trim() || null,
        risk_profile: addRiskProfile || null,
        is_admin: addIsAdmin,
        virtual_balance: addVirtualBalance
      }

      const res = await api.post('/admin/users/', payload)
      showMsg(`✅ ${res.data.message}`)
      resetAddForm()
      load()
    } catch (err: any) {
      showMsg(`❌ ${err?.response?.data?.detail || err.message}`, 'err')
    }
  }

  const load = () => {
    setLoading(true)
    api.get('/auth/risk-profiles')
      .then(r => setProfiles(r.data))
      .catch(() => {})

    api.get('/admin/users/')
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 3000)
  }

  const saveEdit = async (id: number) => {
    try {
      await api.patch(`/admin/users/${id}`, editData)
      showMsg('✅ User berhasil diperbarui')
      setEditId(null)
      load()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || e.message}`, 'err')
    }
  }

  const deleteUser = async (u: UserData) => {
    if (!confirm(`Hapus user ${u.email}?`)) return
    try {
      await api.delete(`/admin/users/${u.id}`)
      showMsg(`✅ User ${u.email} dihapus`)
      load()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail || e.message}`, 'err')
    }
  }

  const resetBalance = async (u: UserData) => {
    if (!confirm(`Reset saldo ${u.email} ke Rp 100.000.000?`)) return
    try {
      await api.post(`/admin/users/${u.id}/reset-balance`)
      showMsg(`✅ Saldo ${u.email} direset`)
      load()
    } catch (e: any) {
      showMsg(`❌ ${e?.response?.data?.detail}`, 'err')
    }
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>👥 Kelola User</h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          Total {users.length} user terdaftar
        </p>
      </div>

      {msg && (
        <div style={{
          background: msgType === 'ok' ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
          border: `1px solid ${msgType === 'ok' ? '#4CAF50' : '#f44'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          fontSize: 13, color: msgType === 'ok' ? '#4CAF50' : '#f44',
        }}>
          {msg}
        </div>
      )}

      {/* Search & Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cari email atau nama..."
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, width: 280 }}
        />
        <button onClick={load} style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
        <button onClick={() => setIsAdding(v => !v)} style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}>
          {isAdding ? '✕ Tutup Form' : '➕ Tambah User'}
        </button>
      </div>

      {/* Form Tambah User */}
      {isAdding && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 24, marginBottom: 20
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>➕ Tambah Pengguna Baru</h3>
          <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}>Alamat Email</label>
              <input
                type="email" required value={addEmail} onChange={e => setAddEmail(e.target.value)}
                placeholder="misal: user@gmail.com"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Kata Sandi</label>
              <input
                type="password" required value={addPassword} onChange={e => setAddPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nama Lengkap</label>
              <input
                type="text" value={addFullName} onChange={e => setAddFullName(e.target.value)}
                placeholder="misal: Budi Santoso"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Profil Risiko</label>
              <select
                value={addRiskProfile} onChange={e => setAddRiskProfile(e.target.value)}
                style={formInputStyle}
              >
                <option value="">-- Belum --</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Saldo Virtual (IDR)</label>
              <input
                type="number" value={addVirtualBalance} onChange={e => setAddVirtualBalance(parseFloat(e.target.value) || 0)}
                placeholder="100000000"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Peran (Role)</label>
              <select
                value={addIsAdmin ? 'true' : 'false'} onChange={e => setAddIsAdmin(e.target.value === 'true')}
                style={formInputStyle}
              >
                <option value="false">User</option>
                <option value="true">Admin</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="submit" style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Simpan User
              </button>
              <button type="button" onClick={resetAddForm} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p style={{ color: '#888' }}>Memuat...</p>}

      {/* Tabel */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Email', 'Nama', 'Profil Risiko', 'Saldo Virtual', 'Role', 'Daftar', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {editId === u.id ? (
                  // Mode Edit
                  <>
                    <td style={{ padding: '10px 14px', color: '#888' }}>{u.id}</td>
                    <td style={{ padding: '10px 14px', color: '#888' }}>{u.email}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        value={editData.full_name ?? u.full_name ?? ''}
                        onChange={e => setEditData({ ...editData, full_name: e.target.value })}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, width: 120 }}
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={editData.risk_profile ?? u.risk_profile ?? ''}
                        onChange={e => setEditData({ ...editData, risk_profile: e.target.value })}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }}
                      >
                        <option value="">-- Belum --</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="number"
                        value={editData.virtual_balance ?? u.virtual_balance}
                        onChange={e => setEditData({ ...editData, virtual_balance: parseFloat(e.target.value) })}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, width: 120 }}
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={editData.is_admin !== undefined ? String(editData.is_admin) : String(u.is_admin)}
                        onChange={e => setEditData({ ...editData, is_admin: e.target.value === 'true' })}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }}
                      >
                        <option value="false">User</option>
                        <option value="true">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 11 }}>{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveEdit(u.id)} style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>💾 Simpan</button>
                        <button onClick={() => setEditId(null)} style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Batal</button>
                      </div>
                    </td>
                  </>
                ) : (
                  // Mode Normal
                  <>
                    <td style={{ padding: '10px 14px', color: '#888' }}>{u.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: '10px 14px', color: '#ccc' }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {u.risk_profile ? (
                        <span style={{ background: `${profileColor(u.risk_profile)}22`, color: profileColor(u.risk_profile), borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          {u.risk_profile}
                        </span>
                      ) : <span style={{ color: '#666', fontSize: 11 }}>Belum diisi</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>
                      Rp {u.virtual_balance.toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        background: u.is_admin ? 'rgba(255,68,68,0.15)' : 'rgba(33,150,243,0.1)',
                        color: u.is_admin ? '#ff6666' : '#64B5F6',
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                      }}>
                        {u.is_admin ? '🛡️ Admin' : '👤 User'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 11 }}>
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => { setEditId(u.id); setEditData({}) }} style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>✏️ Edit</button>
                        <button onClick={() => resetBalance(u)} style={{ background: '#FF9800', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }} title="Reset saldo ke 100 juta">💰</button>
                        {!u.is_admin && (
                          <button onClick={() => deleteUser(u)} style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Tidak ada user yang cocok</div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6
}

const formInputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box'
}
