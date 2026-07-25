'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'

const BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

// Plot images served as static files → /reports/<filename>
function getPlotUrl(filename: string) {
  return `${BASE}/reports/${filename}`
}

interface WalkFoldResult {
  fold: number
  train_size: number
  test_size: number
  accuracy: number
  precision: number
  recall: number
  f1: number
  auc: number
}

interface EvalSummary {
  model: string
  dataset: {
    total_samples: number
    class_0_count: number
    class_1_count: number
    positive_rate: number
  }
  parameters: {
    n_estimators: number
    max_depth: number
    learning_rate: number
    scale_pos_weight: number
    calibration: string
    validation: string
    optimal_threshold?: number
  }
  metrics_final_model: {
    accuracy: number
    precision: number
    recall: number
    f1_score: number
    auc_roc: number
  }
  confusion_matrix: {
    true_negative: number
    false_positive: number
    false_negative: number
    true_positive: number
  }
  walkforward_per_fold: WalkFoldResult[]
  walkforward_mean: {
    accuracy: number
    precision: number
    recall: number
    f1: number
    auc: number
  }
  top3_features: { feature: string; importance: number }[]
}

// ── Komponen Badge Metrik ────────────────────────────────────────────────────
function MetricBadge({ label, value, unit = '%', color = '#2255AA' }: {
  label: string; value: number; unit?: string; color?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border, #1a1a2e)',
      borderRadius: 12, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 800, color }}>
        {value}{unit}
      </span>
    </div>
  )
}

// ── Komponen Plot Image ──────────────────────────────────────────────────────
function PlotCard({ title, plotName, desc }: { title: string; plotName: string; desc: string }) {
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState(false)
  const url = `${BASE}/admin/ml/reports/${plotName}`

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border, #1a1a2e)',
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', marginBottom: 12 }}>{desc}</div>
      {err ? (
        <div style={{ color: '#f44', fontSize: 12, padding: 20, textAlign: 'center' }}>
          Plot belum tersedia. Jalankan evaluasi dulu.
        </div>
      ) : (
        <div style={{ position: 'relative', minHeight: 200 }}>
          {!loaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>
              Memuat gambar...
            </div>
          )}
          <img
            src={url}
            alt={title}
            onLoad={() => setLoaded(true)}
            onError={() => setErr(true)}
            style={{
              width: '100%', borderRadius: 8,
              display: loaded ? 'block' : 'none',
              border: '1px solid var(--border, #1a1a2e)',
            }}
          />
        </div>
      )}
    </div>
  )
}

// ── Halaman Utama ────────────────────────────────────────────────────────────
export default function ModelPerformancePage() {
  const [summary, setSummary] = useState<EvalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/ml/reports/summary')
      .then(r => setSummary(r.data))
      .catch(() => setError('Laporan evaluasi belum tersedia. Jalankan python -m ml.training.evaluate'))
      .finally(() => setLoading(false))
  }, [])

  const m = summary?.metrics_final_model
  const wf = summary?.walkforward_mean

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main style={{ padding: '24px 32px', flex: 1 }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🧠 Performa Model XGBoost</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted, #888)', marginTop: 4 }}>
              Evaluasi model prediksi AI Score — probabilitas kenaikan saham ≥3% dalam 5 hari
            </p>
          </div>

          {loading && <p style={{ color: '#888' }}>Memuat data evaluasi...</p>}
          {error && (
            <div style={{ background: '#1a0a0a', border: '1px solid #f44', borderRadius: 10, padding: 16, color: '#f44', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {summary && (
            <>
              {/* ── Info Model ── */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border, #1a1a2e)',
                borderRadius: 12, padding: '14px 20px', marginBottom: 24,
                display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 13,
              }}>
                <span>🤖 <b>Model:</b> {summary.model}</span>
                <span>📊 <b>Dataset:</b> {summary.dataset.total_samples.toLocaleString()} sampel</span>
                <span>⚖️ <b>Class 0:</b> {summary.dataset.class_0_count.toLocaleString()} | <b>Class 1:</b> {summary.dataset.class_1_count.toLocaleString()}</span>
                <span>🎯 <b>Target:</b> Naik ≥3% dalam 5 hari</span>
              </div>

              {/* ── Metrik Final Model ── */}
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📈 Metrik Model Final</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                <MetricBadge label="Accuracy" value={m?.accuracy ?? 0} color="#2196F3" />
                <MetricBadge label="Precision" value={m?.precision ?? 0} color="#4CAF50" />
                <MetricBadge label="Recall" value={m?.recall ?? 0} color="#FF5722" />
                <MetricBadge label="F1-Score" value={m?.f1_score ?? 0} color="#9C27B0" />
                <MetricBadge label="AUC-ROC" value={m ? Math.round(m.auc_roc * 100) / 100 : 0} unit="" color="#FF9800" />
              </div>

              {/* ── Walk-Forward Mean ── */}
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔄 Rata-rata Walk-Forward Validation (5 Fold)</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                <MetricBadge label="Accuracy" value={Math.round((wf?.accuracy ?? 0) * 100)} color="#2196F3" />
                <MetricBadge label="Precision" value={Math.round((wf?.precision ?? 0) * 100)} color="#4CAF50" />
                <MetricBadge label="Recall" value={Math.round((wf?.recall ?? 0) * 100)} color="#FF5722" />
                <MetricBadge label="F1-Score" value={Math.round((wf?.f1 ?? 0) * 100)} color="#9C27B0" />
                <MetricBadge label="AUC-ROC" value={Math.round((wf?.auc ?? 0) * 100) / 100} unit="" color="#FF9800" />
              </div>

              {/* ── Tabel Walk-Forward Per Fold ── */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border, #1a1a2e)',
                borderRadius: 12, padding: 20, marginBottom: 24, overflowX: 'auto',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>📋 Detail per Fold</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border, #1a1a2e)' }}>
                      {['Fold', 'Train Size', 'Test Size', 'Accuracy', 'Precision', 'Recall', 'F1', 'AUC'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.walkforward_per_fold.map(fold => (
                      <tr key={fold.fold} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Fold {fold.fold}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{fold.train_size.toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{fold.test_size.toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{(fold.accuracy * 100).toFixed(1)}%</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4CAF50' }}>{(fold.precision * 100).toFixed(1)}%</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#FF5722' }}>{(fold.recall * 100).toFixed(1)}%</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#9C27B0' }}>{(fold.f1 * 100).toFixed(1)}%</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#FF9800' }}>{fold.auc.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Confusion Matrix Data ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border, #1a1a2e)',
                  borderRadius: 12, padding: 20,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>🔲 Confusion Matrix</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'True Negative', value: summary.confusion_matrix.true_negative, color: '#4CAF50' },
                      { label: 'False Positive', value: summary.confusion_matrix.false_positive, color: '#FF5722' },
                      { label: 'False Negative', value: summary.confusion_matrix.false_negative, color: '#FF9800' },
                      { label: 'True Positive', value: summary.confusion_matrix.true_positive, color: '#2196F3' },
                    ].map(item => (
                      <div key={item.label} style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px',
                        border: `1px solid ${item.color}33`,
                      }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>
                          {item.value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Parameter Model ── */}
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border, #1a1a2e)',
                  borderRadius: 12, padding: 20,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>⚙️ Parameter Model</div>
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(summary.parameters).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#888' }}>{k}</span>
                        <span style={{ fontWeight: 600 }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Plot Visualisasi ── */}
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📉 Visualisasi Evaluasi</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 20 }}>
                <PlotCard
                  title="Confusion Matrix"
                  plotName="confusion_matrix"
                  desc="Distribusi prediksi benar dan salah model"
                />
                <PlotCard
                  title="ROC Curve"
                  plotName="roc_curve"
                  desc={`AUC-ROC = ${m?.auc_roc ?? '-'} (semakin mendekati 1 semakin baik)`}
                />
                <PlotCard
                  title="Feature Importance"
                  plotName="feature_importance"
                  desc="Kontribusi setiap indikator teknikal terhadap prediksi model"
                />
                <PlotCard
                  title="Walk-Forward Validation"
                  plotName="walkforward"
                  desc="Performa model di setiap fold validasi time-series"
                />
              </div>

              {/* ── Disclaimer ── */}
              <div style={{
                marginTop: 32, padding: '12px 16px',
                background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)',
                borderRadius: 8, fontSize: 12, color: '#aaa',
              }}>
                ⚠️ <b>Catatan:</b> AI Score adalah salah satu dari 4 kriteria dalam metode SAW. Nilai metrik di atas menggambarkan kemampuan model memprediksi sinyal teknikal, bukan akurasi rekomendasi akhir. Rekomendasi akhir juga mempertimbangkan ROE, DER, dan PBV sesuai profil risiko pengguna.
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
