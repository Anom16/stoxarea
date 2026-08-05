'use client'
import { useState, useEffect } from 'react'
import api from '@/lib/api'

type PipelineStatus = 'idle' | 'running' | 'success' | 'error'

function PipelineCard({
  icon, title, desc, buttonLabel, buttonColor, onRun, status, estimatedTime,
}: {
  icon: string; title: string; desc: string; buttonLabel: string
  buttonColor: string; onRun: () => void; status: PipelineStatus; estimatedTime: string
}) {
  const statusConfig = {
    idle:    { color: '#888',    text: 'Menunggu' },
    running: { color: '#FF9800', text: '⏳ Sedang berjalan...' },
    success: { color: '#4CAF50', text: '✅ Berhasil!' },
    error:   { color: '#f44336', text: '❌ Gagal' },
  }
  const s = statusConfig[status]

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${status === 'running' ? buttonColor : 'var(--border, #1a1a2e)'}`,
      borderRadius: 12, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 32 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{desc}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        ⏱ Estimasi waktu: <b style={{ color: '#ccc' }}>{estimatedTime}</b>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onRun}
          disabled={status === 'running'}
          style={{
            background: status === 'running' ? '#333' : buttonColor,
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
            opacity: status === 'running' ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
        >
          {status === 'running' ? '⏳ Berjalan...' : buttonLabel}
        </button>
        <span style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.text}</span>
      </div>
    </div>
  )
}

export default function MLPipelinePage() {
  const [dailyStatus, setDailyStatus] = useState<PipelineStatus>('idle')
  const [weeklyStatus, setWeeklyStatus] = useState<PipelineStatus>('idle')
  const [logs, setLogs] = useState<string[]>([
    '[INFO] Halaman Pipeline ML siap.',
    '[INFO] Klik tombol untuk memulai pipeline.',
  ])

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('id-ID')
    setLogs(prev => [...prev, `[${ts}] ${msg}`])
  }

  const isRunning = dailyStatus === 'running' || weeklyStatus === 'running'

  // Fungsi untuk fetching log dan status running terkini dari backend
  const fetchStatusAndLogs = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const statusRes = await api.get('/admin/ml/status', { headers })
      const serverRunning = statusRes.data.running

      const logsRes = await api.get('/admin/ml/pipeline-logs', { headers })
      if (logsRes.data && logsRes.data.logs) {
        setLogs(logsRes.data.logs)
      }

      if (!serverRunning) {
        if (dailyStatus === 'running') setDailyStatus('success')
        if (weeklyStatus === 'running') setWeeklyStatus('success')
      }
    } catch (err) {}
  }

  // Cek status saat pertama kali load
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const headers = { Authorization: `Bearer ${token}` }
        const statusRes = await api.get('/admin/ml/status', { headers })
        
        if (statusRes.data.running) {
          setDailyStatus('running')
          // Ambil log awal
          const logsRes = await api.get('/admin/ml/pipeline-logs', { headers })
          if (logsRes.data && logsRes.data.logs) {
            setLogs(logsRes.data.logs)
          }
        }
      } catch (err) {}
    }
    checkInitialStatus()
  }, [])

  // Polling saat pipeline sedang berjalan di background
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(fetchStatusAndLogs, 3000)
    return () => clearInterval(interval)
  }, [isRunning, dailyStatus, weeklyStatus])

  const runPipeline = async (type: 'daily' | 'retrain') => {
    const setter = type === 'daily' ? setDailyStatus : setWeeklyStatus
    const endpoint = type === 'daily' ? '/admin/ml/trigger-pipeline' : '/admin/ml/trigger-retrain'
    const label = type === 'daily' ? 'Pipeline Harian' : 'Full Retrain Mingguan'

    setter('running')
    addLog(`Mengirim request: POST ${endpoint}`)
    addLog(`⏳ ${label} sedang berjalan di background server...`)

    try {
      const res = await api.post(endpoint)
      addLog(`✅ ${res.data.message}`)
      addLog(`ℹ️ Menunggu live streaming log dari server...`)
    } catch (err: any) {
      setter('error')
      const msg = err?.response?.data?.detail || err.message
      addLog(`❌ Gagal: ${msg}`)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>⚙️ Kontrol Pipeline ML</h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          Trigger pipeline secara manual atau monitor jadwal otomatis
        </p>
      </div>

      {/* Pipeline Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20, marginBottom: 28 }}>
        <PipelineCard
          icon="▶️"
          title="Pipeline Harian"
          desc="Ingest OHLCV → Feature Engineering → Inference AI Score & SHAP (Memakai model tersimpan)"
          buttonLabel="▶ Jalankan Pipeline Harian"
          buttonColor="#2196F3"
          estimatedTime="~1-2 menit"
          status={dailyStatus}
          onRun={() => runPipeline('daily')}
        />
        <PipelineCard
          icon="🔄"
          title="Full Retrain Mingguan"
          desc="Ingest → Feature Eng → Full Retrain XGBoost (Walk-Forward CV) → Inference & Evaluasi Metrik"
          buttonLabel="🔄 Jalankan Full Retrain"
          buttonColor="#9C27B0"
          estimatedTime="~3-5 menit"
          status={weeklyStatus}
          onRun={() => runPipeline('retrain')}
        />
      </div>

      {/* Jadwal Info */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border, #1a1a2e)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 24,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📅 Jadwal Otomatis</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          <div style={{ background: 'rgba(33,150,243,0.08)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(33,150,243,0.2)' }}>
            <div style={{ color: '#2196F3', fontWeight: 700, marginBottom: 4 }}>🟢 Harian</div>
            <div>Senin – Jumat</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>17:00 WIB</div>
            <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>Ingest + Feature Eng + Inference</div>
          </div>
          <div style={{ background: 'rgba(156,39,176,0.08)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(156,39,176,0.2)' }}>
            <div style={{ color: '#9C27B0', fontWeight: 700, marginBottom: 4 }}>🔵 Mingguan</div>
            <div>Jumat</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>18:00 WIB</div>
            <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>+ Retrain XGBoost (5-fold WFV)</div>
          </div>
        </div>
      </div>

      {/* Log Console */}
      <div style={{
        background: '#0a0f1a', border: '1px solid var(--border, #1a1a2e)',
        borderRadius: 12, padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Log Aktivitas</div>
          <button
            onClick={() => setLogs(['[INFO] Log dibersihkan.'])}
            style={{ background: 'transparent', border: '1px solid #333', borderRadius: 6, padding: '4px 10px', color: '#888', fontSize: 12, cursor: 'pointer' }}
          >
            Bersihkan
          </button>
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 12, color: '#a0b0c0',
          maxHeight: 280, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{
              color: log.includes('❌') ? '#f44336'
                : log.includes('✅') ? '#4CAF50'
                : log.includes('⏳') ? '#FF9800'
                : '#a0b0c0'
            }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
