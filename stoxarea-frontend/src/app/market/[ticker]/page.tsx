'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import TechnicalChart from '@/components/charts/TechnicalChart'
import { usePortfolioStore } from '@/store/portfolioStore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// --- Skeleton Component ---
const Skeleton = ({ height = 20, width = '100%', mb = 12 }) => (
  <div className="skeleton" style={{ height, width, marginBottom: mb, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }} />
)

const FEATURE_LABELS: Record<string, string> = {
  rsi_14: 'Momentum RSI',
  ma_50_dist: 'Tren MA50',
  vol_ma_ratio: 'Volume Ratio',
  roe: 'Profitabilitas (ROE)',
  der: 'Hutang (DER)',
  per: 'Valuasi (PER)',
  close: 'Harga Terakhir',
  bb_width: 'Volatilitas (Bollinger)',
  log_ret_1d: 'Return Harian',
}

export default function StockDetailPage() {
  const { ticker } = useParams()
  const tickerStr = typeof ticker === 'string' ? ticker.toUpperCase() : ''
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tradeAmount, setTradeAmount] = useState(100)
  
  const [activeTab, setActiveTab] = useState<'ai' | 'financials' | 'dividends'>('ai')
  const [historyData, setHistoryData] = useState<any>(null)
  const [loadingHist, setLoadingHist] = useState(false)
  
  const { buyStock, sellStock, cash, holdings } = usePortfolioStore()
  const holding = holdings.find(h => h.ticker === (tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'))

  useEffect(() => {
    const fetchMainData = async () => {
      setLoading(true)
      try {
        const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
        const [fundRes, techRes, aiRes] = await Promise.all([
          api.get(`/market/fundamental/${fullTicker}`),
          api.get(`/market/technical/${fullTicker}?period=1y`),
          api.get(`/market/ai-score/${fullTicker}`)
        ])
        setData({
          fundamental: fundRes.data,
          technical: techRes.data,
          ai: aiRes.data
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (tickerStr) fetchMainData()
  }, [tickerStr])

  // Lazy Load untuk Laporan Keuangan & Dividen
  useEffect(() => {
    if ((activeTab === 'financials' || activeTab === 'dividends') && !historyData && tickerStr) {
      const fetchHistory = async () => {
        setLoadingHist(true)
        try {
          const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
          const res = await api.get(`/market/history/${fullTicker}`)
          setHistoryData(res.data)
        } catch (e) {
          console.error(e)
        } finally {
          setLoadingHist(false)
        }
      }
      fetchHistory()
    }
  }, [activeTab, tickerStr, historyData])

  if (loading) return (
    <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div className="logo-mark">S</div>
      <p className="text-secondary">Menganalisis {tickerStr}...</p>
    </div>
  )

  if (!data || data.fundamental.error) return (
    <div className="flex-center" style={{ height: '100vh' }}>
      <div className="card text-center">
        <h2 className="text-red">Emiten Tidak Ditemukan</h2>
        <Link href="/market" className="btn-primary mt-16" style={{ textDecoration: 'none' }}>Kembali ke Jelajah Pasar</Link>
      </div>
    </div>
  )

  const f = data.fundamental
  const ai = data.ai
  const currentPrice = f.price?.current || 0

  const formatMoney = (val: number) => {
    if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T'
    if (val >= 1e9) return (val / 1e9).toFixed(2) + ' B'
    if (val >= 1e6) return (val / 1e6).toFixed(2) + ' M'
    return val.toLocaleString()
  }

  const handleBuy = () => {
    const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
    buyStock(fullTicker, tradeAmount, currentPrice)
    alert(`Berhasil membeli ${tradeAmount} lembar ${tickerStr}`)
  }

  const handleSell = () => {
    const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
    sellStock(fullTicker, tradeAmount, currentPrice)
    alert(`Berhasil menjual ${tradeAmount} lembar ${tickerStr}`)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <div className="page-body">
          {/* Header & Price */}
          <div className="flex-between mb-24">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ fontSize: 32, fontWeight: 800 }}>{f.ticker.replace('.JK', '')}</h1>
                <span className="pick-sector">{f.sector}</span>
              </div>
              <p className="text-secondary fs-14">{f.name} — {f.industry}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                Rp {currentPrice.toLocaleString()}
              </div>
              <div className="text-secondary fs-13">Volume: {f.price?.volume.toLocaleString()}</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex mb-24" style={{ gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <button 
              className={activeTab === 'ai' ? 'btn-primary' : 'btn-outline'} 
              onClick={() => setActiveTab('ai')}
              style={{ padding: '8px 20px', borderRadius: 20 }}
            >
              📡 Radar AI & Chart
            </button>
            <button 
              className={activeTab === 'financials' ? 'btn-primary' : 'btn-outline'} 
              onClick={() => setActiveTab('financials')}
              style={{ padding: '8px 20px', borderRadius: 20 }}
            >
              📊 Laporan Keuangan
            </button>
            <button 
              className={activeTab === 'dividends' ? 'btn-primary' : 'btn-outline'} 
              onClick={() => setActiveTab('dividends')}
              style={{ padding: '8px 20px', borderRadius: 20 }}
            >
              💰 Dividen
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Left Column Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {activeTab === 'ai' && (
                <>
                  {/* Technical Chart */}
                  <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="fw-700">Interactive Technical Chart</span>
                      <span className="text-muted fs-12">Period: 1 Year (Daily)</span>
                    </div>
                    <div style={{ background: '#0a0e1a' }}>
                      <TechnicalChart data={data.technical} />
                    </div>
                  </div>

                  {/* Fundamental Stats Grid */}
                  <div className="card">
                    <h3 className="section-title mb-16" style={{ fontSize: 16 }}>Fundamental & Market Statistics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>Market Cap</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{formatMoney(f.price.market_cap)}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>Beta</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{f.price.beta || '—'}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>PER</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{f.valuation.per}x</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>PBV</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{f.valuation.pbv}x</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>ROE</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{(f.profitability.roe * 100).toFixed(2)}%</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>DER</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{f.health.der}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>Div. Yield</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{(f.dividend.yield_pct * 100).toFixed(2)}%</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>Avg Vol</div>
                        <div className="stat-value" style={{ fontSize: 16 }}>{formatMoney(f.price.avg_volume)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'financials' && (
                <>
                  {loadingHist ? (
                    <div className="card">
                      <Skeleton height={24} width="60%" mb={20} />
                      <Skeleton height={200} mb={20} />
                      <Skeleton height={24} width="60%" mb={20} />
                      <Skeleton height={200} />
                    </div>
                  ) : historyData ? (
                    <>
                      <div className="card">
                        <h3 className="section-title mb-16" style={{ fontSize: 16 }}>Laporan Laba Rugi (Tahunan)</h3>
                        <div style={{ height: 300, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...(historyData.financials_history || [])].reverse()}>
                              <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
                              <YAxis tickFormatter={formatMoney} stroke="#94a3b8" fontSize={12} />
                              <Tooltip 
                                formatter={(v: any) => formatMoney(v)}
                                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
                              />
                              <Bar dataKey="revenue" name="Total Revenue" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="net_income" name="Net Income" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="fs-11 text-muted mt-8">Perbandingan pertumbuhan pendapatan dan laba bersih dalam 4 tahun terakhir.</p>
                      </div>

                      <div className="card">
                        <h3 className="section-title mb-16" style={{ fontSize: 16 }}>Neraca Keuangan (Balance Sheet)</h3>
                        <div style={{ height: 300, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...(historyData.balance_sheet_history || [])].reverse()}>
                              <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
                              <YAxis tickFormatter={formatMoney} stroke="#94a3b8" fontSize={12} />
                              <Tooltip 
                                formatter={(v: any) => formatMoney(v)}
                                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
                              />
                              <Bar dataKey="assets" name="Total Assets" fill="#10b981" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="liabilities" name="Total Liabilities" fill="#ef4444" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="equity" name="Total Equity" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="fs-11 text-muted mt-8">Struktur kekayaan (Aset) dibandingkan dengan Hutang (Liabilitas) dan Modal (Ekuitas).</p>
                      </div>
                    </>
                  ) : (
                    <div className="card flex-center" style={{ height: 200 }}>
                      <p className="text-red">Gagal memuat data laporan keuangan.</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'dividends' && (
                <div className="card">
                  <h3 className="section-title mb-16" style={{ fontSize: 16 }}>Riwayat Pembagian Dividen</h3>
                  {loadingHist ? (
                    <>
                      <Skeleton height={200} mb={24} />
                      <Skeleton height={40} mb={8} />
                      <Skeleton height={40} mb={8} />
                      <Skeleton height={40} />
                    </>
                  ) : historyData ? (
                    <>
                      <div style={{ height: 300, width: '100%', marginBottom: 24 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={historyData.dividend_history}>
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }} />
                            <Bar dataKey="amount" name="Dividend (IDR)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <table className="ranking-table">
                        <thead>
                          <tr>
                            <th>Tanggal (Ex-Date)</th>
                            <th style={{ textAlign: 'right' }}>Jumlah per Lembar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...(historyData.dividend_history || [])].reverse().map((d: any, i: number) => (
                            <tr key={i}>
                              <td>{d.date}</td>
                              <td style={{ textAlign: 'right' }} className="text-accent fw-700">Rp {d.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <div className="flex-center" style={{ height: 200 }}>
                      <p className="text-red">Data dividen tidak tersedia.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Technical Indicators Grid */}
              <div className="card">
                <h3 className="section-title mb-16" style={{ fontSize: 16 }}>Technical Indicators</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div className="stat-card" style={{ padding: 12, borderLeft: '3px solid var(--blue)' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>RSI (14)</div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{data.technical?.indicators?.rsi?.slice(-1)[0] || '—'}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12, borderLeft: '3px solid var(--accent)' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>MACD</div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{data.technical?.indicators?.macd?.slice(-1)[0] || '—'}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12, borderLeft: '3px solid var(--yellow)' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>MA-20</div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{data.technical?.indicators?.ma_20?.slice(-1)[0] || '—'}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12, borderLeft: '3px solid var(--red)' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>BB Upper</div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{data.technical?.indicators?.bb_upper?.slice(-1)[0] || '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: AI & Trading */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* AI Score & SHAP */}
              <div className="card">
                <h3 className="section-title" style={{ fontSize: 16 }}>Hasil AI Score (XGBoost)</h3>
                <p className="section-sub mb-16">Analisis momentum kenaikan harga berbasis SHAP Explainability.</p>
                
                <div className="match-badge mb-24" style={{ padding: 20 }}>
                  <span className="match-pct" style={{ fontSize: 32 }}>{ai.ai_score_percent}</span>
                  <span className="match-label">Probabilitas Bullish</span>
                </div>

                <div style={{ height: 180, width: '100%', marginBottom: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ai.insights.map((i: any) => ({ name: FEATURE_LABELS[i.feature] || i.feature, value: i.contribution }))} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {ai.insights.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.contribution > 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ai.insights.map((ins: any, i: number) => {
                    // Cari data asli dari technical indicators jika tersedia
                    let rawValue = '—';
                    const indicators = data?.technical?.indicators;
                    if (ins.feature === 'rsi_14') rawValue = indicators?.rsi?.slice(-1)[0] || '—';
                    if (ins.feature === 'ma_50_dist') rawValue = indicators?.ma_50?.slice(-1)[0] || '—';
                    if (ins.feature === 'vol_ma_ratio') rawValue = 'Tinggi'; // Simulasi untuk volume
                    
                    return (
                      <div 
                        key={i} 
                        className="insight-pill" 
                        style={{ 
                          background: 'var(--bg-primary)', 
                          border: '1px solid var(--border)', 
                          borderRadius: 8, 
                          padding: 10,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => alert(`Data Sumber (${FEATURE_LABELS[ins.feature] || ins.feature}):\nNilai saat ini: ${rawValue}\n\n${ins.description}`)}
                      >
                        <div className="flex-between">
                          <div className="fw-700 fs-12 text-accent">{FEATURE_LABELS[ins.feature] || ins.feature}</div>
                          <div className="fs-10 text-muted">Klik untuk Data ℹ️</div>
                        </div>
                        <div className="fs-11 text-secondary">{ins.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trading Module */}
              <div className="card" style={{ border: '1px solid var(--accent-glow)' }}>
                <h3 className="section-title mb-16" style={{ fontSize: 16 }}>🚀 Modul Trading Virtual</h3>
                <div className="flex-between mb-16">
                  <span className="text-secondary fs-13">Saldo Kas:</span>
                  <span className="fw-700 text-accent">Rp {cash.toLocaleString()}</span>
                </div>
                <div className="flex-between mb-16">
                  <span className="text-secondary fs-13">Kepemilikan:</span>
                  <span className="fw-700">{holding ? `${holding.shares} Lembar` : '0 Lembar'}</span>
                </div>

                <div className="mb-16">
                  <label className="fs-12 text-muted mb-8 d-block">Jumlah Lembar (Shares)</label>
                  <input 
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(parseInt(e.target.value))}
                    className="search-box"
                    style={{ width: '100%', background: 'var(--bg-primary)', padding: '10px 14px' }}
                  />
                </div>

                <div className="flex-between gap-12">
                  <button className="btn-primary" onClick={handleBuy} style={{ flex: 1, padding: 12 }}>BELI</button>
                  <button className="btn-outline" onClick={handleSell} style={{ flex: 1, padding: 12, borderColor: 'var(--red)', color: 'var(--red)' }}>JUAL</button>
                </div>
              </div>

              {/* Profile */}
              <div className="card">
                <h3 className="section-title mb-8" style={{ fontSize: 16 }}>Profil Perusahaan</h3>
                <p className="fs-12 text-secondary" style={{ lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
                  {f.description || 'Deskripsi tidak tersedia.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
