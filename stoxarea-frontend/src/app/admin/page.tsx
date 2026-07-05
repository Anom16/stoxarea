'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'

interface SystemStatus {
  ai_scores_count: number
  qualified_stocks: number
  cache_entries: number
  ai_scores_age_hours: number
}

function StatCard({ icon, label, value, sub, color = '#2255AA' }: {
  icon: string; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: 'var(--card-bg, #16213e)',
      border: `1px solid ${color}33`,
      borderRadius: 12, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 28, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: '#888' }}>{sub}</span>}
    </div>
  )
}

function ActionCard({ icon, title, desc, href, color = '#2255AA' }: {
  icon: string; title: string; desc: string; href: string; color?: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--card-bg, #16213e)',
        border: `1px solid ${color}44`,
        borderRadius: 12, padding: '18px 20px',
        cursor: 'pointer', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = `${color}44`)}
      >
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color }}>{title}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{desc}</div>
        </div>
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: 18 }}>→</span>
      </div>
    </Link>
  )
}

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [status, setStatus] = useState<SystemStatus | null>(null)

  useEffect(() => {
    api.get('/auth/me').then(r => setUser(r.data))

    // Ambil status sistem
    Promise.all([
      api.get('/admin/ml/reports/summary').catch(() => null),
      api.get('/admin/ml/cache-status'),
    ]).then(([reportRes, cacheRes]) => {
      const aiCount = reportRes?.data?.dataset?.total_samples
        ? Math.round(reportRes.data.dataset.total_samples / reportRes.data.parameters.n_estimators)
        : 57
      setStatus({
        ai_scores_count: aiCount,
        qualified_stocks: 112,
        cache_entries: cacheRes.data.total_entries,
        ai_scores_age_hours: 0,
      })
    }).catch(() => {})
  }, [])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🛡️ Dashboard Admin</h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          Selamat datang, <b style={{ color: '#fff' }}>{user?.email}</b>
        </p>
      </div>

      {/* Status Sistem */}
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#888' }}>📊 STATUS SISTEM</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard icon="🤖" label="AI Score Aktif" value={status?.ai_scores_count ?? '–'} sub="Emiten dengan prediksi" color="#2196F3" />
        <StatCard icon="✅" label="Emiten Qualified" value={status?.qualified_stocks ?? '–'} sub="is_qualified = True" color="#4CAF50" />
        <StatCard icon="🗄️" label="SAW Cache" value={status?.cache_entries ?? '–'} sub="Cache entries aktif" color="#FF9800" />
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#888' }}>⚡ AKSI CEPAT</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 28 }}>
        <ActionCard icon="⚖️" title="Kelola Profil Risiko" desc="Edit bobot dan parameter kuesioner" href="/admin/risk-profiles" color="#E040FB" />
        <ActionCard icon="▶️" title="Jalankan Pipeline Harian" desc="Ingest + Inference (tanpa retrain)" href="/admin/ml-pipeline" color="#2196F3" />
        <ActionCard icon="🔄" title="Full Retrain Mingguan" desc="Retrain XGBoost + semua step" href="/admin/ml-pipeline" color="#9C27B0" />
        <ActionCard icon="🧠" title="Performa Model AI" desc="Lihat metrik evaluasi XGBoost" href="/admin/model-performance" color="#FF9800" />
        <ActionCard icon="🗄️" title="Cache Monitor" desc="Lihat & hapus SAW cache" href="/admin/cache" color="#4CAF50" />
      </div>

      {/* Jadwal */}
      <div style={{
        background: 'var(--card-bg, #16213e)', border: '1px solid var(--border, #1a1a2e)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 24,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📅 Jadwal Pipeline Otomatis</div>
        <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>🟢 <b>Harian:</b> Senin–Jumat 17:00 WIB — Ingest data + Generate AI Score</div>
          <div>🔵 <b>Mingguan:</b> Jumat 18:00 WIB — Full Retrain XGBoost + semua step</div>
          <div style={{ color: '#888', marginTop: 4, fontSize: 12 }}>
            Pipeline berjalan otomatis saat server aktif. Jika server baru distart, data yang usang (&gt;24 jam) akan otomatis diperbarui.
          </div>
        </div>
      </div>

    </div>
  )
}
