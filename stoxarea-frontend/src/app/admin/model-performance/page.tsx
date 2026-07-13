'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://stoxarea-production.up.railway.app'

function MetricCard({ label, value, unit = '%', color = '#2255AA' }: {
  label: string; value: number; unit?: string; color?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border, #1a1a2e)',
      borderRadius: 12, padding: '16px 20px', minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}{unit}</div>
    </div>
  )
}

function PlotImage({ title, filename, desc }: { title: string; filename: string; desc: string }) {
  const [err, setErr] = useState(false)
  const [loaded, setLoaded] = useState(false)
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border, #1a1a2e)',
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{desc}</div>
      {err ? (
        <div style={{ color: '#f44', textAlign: 'center', padding: 20, fontSize: 12 }}>
          Plot belum tersedia. Jalankan evaluasi terlebih dahulu.
        </div>
      ) : (
        <div style={{ position: 'relative', minHeight: 180 }}>
          {!loaded && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>Memuat...</div>}
          <img
            src={`${BASE}/reports/${filename}`}
            alt={title}
            onLoad={() => setLoaded(true)}
            onError={() => setErr(true)}
            style={{ width: '100%', borderRadius: 8, display: loaded ? 'block' : 'none', border: '1px solid var(--border, #1a1a2e)' }}
          />
        </div>
      )}
    </div>
  )
}

export default function AdminModelPerformancePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/admin/ml/reports/summary')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const m = data?.metrics_final_model
  const wf = data?.walkforward_mean

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🧠 Performa Model XGBoost</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Evaluasi AI Score — probabilitas kenaikan saham ≥3% dalam 5 hari</p>
        </div>
        <button
          onClick={load}
          style={{ background: '#2255AA', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <p style={{ color: '#888' }}>Memuat data...</p>}

      {!loading && !data && (
        <div style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: 10, padding: 16, color: '#f44', fontSize: 13 }}>
          ⚠️ Laporan belum tersedia. Jalankan: <code>python -m ml.training.evaluate</code>
        </div>
      )}

      {data && (
        <>
          {/* Info */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 20px', marginBottom: 24,
            display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13,
          }}>
            <span>📊 <b>Sampel:</b> {data.dataset.total_samples.toLocaleString()}</span>
            <span>⚖️ <b>Class 0:</b> {data.dataset.class_0_count.toLocaleString()} | <b>Class 1:</b> {data.dataset.class_1_count.toLocaleString()}</span>
            <span>🎯 <b>Target:</b> Naik ≥3% dalam 5 hari</span>
            <span>📈 <b>Positive Rate:</b> {data.dataset.positive_rate}%</span>
          </div>

          {/* Metrik Final */}
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#888' }}>METRIK MODEL FINAL</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <MetricCard label="Accuracy" value={m?.accuracy} color="#2196F3" />
            <MetricCard label="Precision" value={m?.precision} color="#4CAF50" />
            <MetricCard label="Recall" value={m?.recall} color="#FF5722" />
            <MetricCard label="F1-Score" value={m?.f1_score} color="#9C27B0" />
            <MetricCard label="AUC-ROC" value={m?.auc_roc} unit="" color="#FF9800" />
          </div>

          {/* WF Mean */}
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#888' }}>RATA-RATA WALK-FORWARD (5 FOLD)</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <MetricCard label="Accuracy" value={Math.round((wf?.accuracy ?? 0) * 100)} color="#2196F3" />
            <MetricCard label="Precision" value={Math.round((wf?.precision ?? 0) * 100)} color="#4CAF50" />
            <MetricCard label="Recall" value={Math.round((wf?.recall ?? 0) * 100)} color="#FF5722" />
            <MetricCard label="F1-Score" value={Math.round((wf?.f1 ?? 0) * 100)} color="#9C27B0" />
            <MetricCard label="AUC-ROC" value={Math.round((wf?.auc ?? 0) * 100) / 100} unit="" color="#FF9800" />
          </div>

          {/* Tabel Fold */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24, overflowX: 'auto' }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>📋 Detail per Fold</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Fold', 'Train', 'Test', 'Accuracy', 'Precision', 'Recall', 'F1', 'AUC'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.walkforward_per_fold.map((f: any) => (
                  <tr key={f.fold} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Fold {f.fold}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{f.train_size.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{f.test_size.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{(f.accuracy * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4CAF50' }}>{(f.precision * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#FF5722' }}>{(f.recall * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#9C27B0' }}>{(f.f1 * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#FF9800' }}>{f.auc.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Plots */}
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#888' }}>📉 VISUALISASI</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            <PlotImage title="Confusion Matrix" filename="confusion_matrix.png" desc="Distribusi prediksi benar dan salah" />
            <PlotImage title="ROC Curve" filename="roc_curve.png" desc={`AUC-ROC = ${m?.auc_roc ?? '-'}`} />
            <PlotImage title="Feature Importance" filename="feature_importance.png" desc="Kontribusi setiap indikator teknikal" />
            <PlotImage title="Walk-Forward Validation" filename="walkforward_results.png" desc="Performa model per fold" />
          </div>
        </>
      )}
    </div>
  )
}
