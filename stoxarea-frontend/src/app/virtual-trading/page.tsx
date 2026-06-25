'use client'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import ToastContainer from '@/components/ui/Toast'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'
import TransactionModal from '@/components/ui/Modal'

interface PortfolioItem {
  ticker: string
  qty: number
  avg_price: number
  current_price?: number
}

interface Transaction {
  id: number
  ticker: string
  type: 'BUY' | 'SELL'
  qty: number
  price: number
  fee: number
  net_value: number
  timestamp: string
}

export default function VirtualTradingPage() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history'>('portfolio')
  const { toasts, removeToast, toast } = useToast()

  const handleDownloadPDF = async () => {
    try {
      toast.info('Memproses PDF', 'Mohon tunggu sebentar...', '')
      
      const response = await api.get('/portfolio/transactions/pdf', {
        responseType: 'blob',
      })
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'Riwayat_Transaksi_StoxArea.pdf')
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Unduh Berhasil 📄', 'Laporan riwayat transaksi telah diunduh.', '')
    } catch (err) {
      toast.error('Gagal Mengunduh PDF', 'Terjadi kesalahan saat memproses laporan PDF.', '')
    }
  }

  const handleDownloadReceipt = async (txId: number) => {
    try {
      toast.info('Memproses Kuitansi 📄', 'Mohon tunggu sebentar...', '')
      
      const response = await api.get(`/portfolio/transactions/${txId}/pdf`, {
        responseType: 'blob',
      })
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `StoxArea_Nota_Transaksi_${txId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Unduh Berhasil 🎉', 'Kuitansi transaksi berhasil diunduh.', '')
    } catch (err) {
      toast.error('Gagal Mengunduh', 'Terjadi kesalahan saat memproses kuitansi PDF.', '')
    }
  }

  // Modal Trading States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTicker, setModalTicker] = useState('')
  const [modalCompanyName, setModalCompanyName] = useState('')
  const [modalActionType, setModalActionType] = useState<'BUY' | 'SELL'>('BUY')
  const [modalCurrentPrice, setModalCurrentPrice] = useState(0)
  const [modalHoldingQty, setModalHoldingQty] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [portRes, userRes, txRes] = await Promise.all([
        api.get('/portfolio/'),
        api.get('/auth/me'),
        api.get('/portfolio/transactions').catch(() => ({ data: [] }))
      ])
      setBalance(userRes.data.virtual_balance || 0)
      setTransactions(txRes.data || [])

      const enhanced = await Promise.all(portRes.data.map(async (item: PortfolioItem) => {
        try {
          const r = await api.get(`/market/live-price/${item.ticker}`)
          return { ...item, current_price: r.data.price || item.avg_price }
        } catch {
          return { ...item, current_price: item.avg_price }
        }
      }))
      setPortfolio(enhanced)
    } catch {
      toast.error('Gagal Memuat Data', 'Tidak dapat mengambil data portofolio', 'Coba refresh halaman')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleQuickTrade = (ticker: string, type: 'buy' | 'sell', currentPrice: number) => {
    const tickerUpper = ticker.toUpperCase()
    const holding = portfolio.find(p => p.ticker.toUpperCase() === tickerUpper)
    const holdingQty = holding ? holding.qty : 0

    setModalTicker(tickerUpper)
    setModalCompanyName(tickerUpper.replace('.JK', ''))
    setModalActionType(type === 'buy' ? 'BUY' : 'SELL')
    setModalCurrentPrice(currentPrice)
    setModalHoldingQty(holdingQty)
    setIsModalOpen(true)
  }

  const handleConfirmTrade = async (lots: number) => {
    setProcessing(true)
    const type = modalActionType.toLowerCase() as 'buy' | 'sell'
    try {
      const res = await api.post(`/portfolio/${type}`, { 
        ticker: modalTicker, 
        qty: lots 
      })
      const data = res.data
      const tickerClean = modalTicker.replace('.JK', '')

      if (modalActionType === 'BUY') {
        toast.success(
          `Pembelian Berhasil 📈`,
          `${lots} Lot ${tickerClean} · Rp ${data.executed_price?.toLocaleString('id-ID')}/lembar`,
          `Dibayar: Rp ${data.net_value?.toLocaleString('id-ID')} (fee Rp ${data.fee_amount?.toLocaleString('id-ID')})`
        )
      } else {
        toast.success(
          `Penjualan Berhasil 📉`,
          `${lots} Lot ${tickerClean} · Rp ${data.executed_price?.toLocaleString('id-ID')}/lembar`,
          `Diterima: Rp ${data.net_value?.toLocaleString('id-ID')} (setelah fee Rp ${data.fee_amount?.toLocaleString('id-ID')})`
        )
      }
      setIsModalOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(
        'Transaksi Gagal', 
        err.response?.data?.detail || 'Terjadi kesalahan saat memproses order'
      )
    } finally { 
      setProcessing(false) 
    }
  }

  // Kalkulasi summary
  const totalEquity = portfolio.reduce((a, i) => a + i.qty * (i.current_price || 0), 0)
  const totalCost   = portfolio.reduce((a, i) => a + i.qty * i.avg_price, 0)
  const totalPL     = totalEquity - totalCost
  const totalPLPct  = totalCost > 0 ? (totalPL / totalCost) * 100 : 0
  const totalValue  = balance + totalEquity

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <div className="page-body">

          {/* ── HEADER ── */}
          <div className="vt-header-row mb-16">
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Virtual Trading Simulator</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                Simulasi investasi tanpa risiko modal nyata · Harga real-time dari Yahoo Finance
              </p>
            </div>
            <button onClick={fetchData} className="btn-outline" style={{ flex: 'none', padding: '8px 16px', fontSize: 13 }}>
              🔄 Refresh
            </button>
          </div>

          {/* ── Disclaimer Virtual Trading ── */}
          <div style={{
            marginBottom: 24, padding: '10px 14px',
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, fontSize: 11, color: '#93c5fd', lineHeight: 1.6,
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ flexShrink: 0 }}>ℹ️</span>
            <span>
              <strong>Simulator Edukasi.</strong> Seluruh transaksi di halaman ini menggunakan <strong>saldo virtual</strong> dan tidak melibatkan dana nyata. Fitur ini dirancang untuk tujuan edukasi dan latihan analisis portofolio. Hasil simulasi tidak mencerminkan hasil investasi nyata. Fee broker yang diterapkan (Beli 0.15% · Jual 0.25%) adalah estimasi berdasarkan rata-rata broker online BEI.
            </span>
          </div>

          {/* ── SUMMARY CARDS ── */}
          <div className="vt-summary-grid mb-24">
            <div className="vt-stat-card">
              <div className="vt-stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--blue)' }}>💼</div>
              <div>
                <div className="vt-stat-label">Total Nilai Akun</div>
                <div className="vt-stat-value" style={{ color: 'var(--blue)' }}>
                  Rp {totalValue.toLocaleString('id-ID')}
                </div>
                <div className="vt-stat-sub">Kas + Nilai Saham</div>
              </div>
            </div>
            <div className="vt-stat-card">
              <div className="vt-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent)' }}>💵</div>
              <div>
                <div className="vt-stat-label">Saldo Kas</div>
                <div className="vt-stat-value" style={{ color: 'var(--accent)' }}>
                  Rp {balance.toLocaleString('id-ID')}
                </div>
                <div className="vt-stat-sub">Siap diinvestasikan</div>
              </div>
            </div>
            <div className="vt-stat-card">
              <div className="vt-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--yellow)' }}>📊</div>
              <div>
                <div className="vt-stat-label">Nilai Portofolio</div>
                <div className="vt-stat-value" style={{ color: 'var(--yellow)' }}>
                  Rp {totalEquity.toLocaleString('id-ID')}
                </div>
                <div className="vt-stat-sub">{portfolio.length} emiten aktif</div>
              </div>
            </div>
            <div className="vt-stat-card">
              <div className="vt-stat-icon" style={{
                background: totalPL >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: totalPL >= 0 ? 'var(--accent)' : 'var(--red)'
              }}>
                {totalPL >= 0 ? '📈' : '📉'}
              </div>
              <div>
                <div className="vt-stat-label">Total Profit / Loss</div>
                <div className="vt-stat-value" style={{ color: totalPL >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                  {totalPL >= 0 ? '+' : ''}Rp {totalPL.toLocaleString('id-ID')}
                </div>
                <div className="vt-stat-sub" style={{ color: totalPL >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                  {totalPLPct >= 0 ? '+' : ''}{totalPLPct.toFixed(2)}% dari modal
                </div>
              </div>
            </div>
          </div>

          {/* ── MAIN LAYOUT: PORTFOLIO ── */}
          <div className="vt-main-grid">

            {/* ── PORTFOLIO + HISTORY (full width) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Tab Switch */}
              <div className="vt-tabs">
                <button className={`vt-tab ${activeTab === 'portfolio' ? 'active' : ''}`}
                  onClick={() => setActiveTab('portfolio')}>
                  📁 Portofolio ({portfolio.length})
                </button>
                <button className={`vt-tab ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}>
                  🕐 Riwayat Transaksi
                </button>
              </div>

              {/* PORTFOLIO TABLE */}
              {activeTab === 'portfolio' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {loading ? (
                    <div style={{ padding: 24 }}>
                      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}
                    </div>
                  ) : portfolio.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📁</div>
                      <div className="empty-text">Portofolio masih kosong</div>
                      <a href="/market" className="btn-primary" style={{ flex: 'none', padding: '8px 20px', fontSize: 13, marginTop: 8 }}>
                        Jelajahi Market →
                      </a>
                    </div>
                  ) : (
                    <>
                      {/* Desktop: Tabel Portfolio */}
                      <div className="vt-table-desktop" style={{ overflowX: 'auto' }}>
                        <table className="ranking-table">
                          <thead>
                            <tr>
                              <th>Emiten</th>
                              <th style={{ textAlign: 'right' }}>Kepemilikan</th>
                              <th style={{ textAlign: 'right' }}>Avg. Beli</th>
                              <th style={{ textAlign: 'right' }}>Harga Kini</th>
                              <th style={{ textAlign: 'right' }}>Nilai Pasar</th>
                              <th style={{ textAlign: 'right' }}>Gain / Loss</th>
                              <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portfolio.map((s) => {
                              const cp = s.current_price || s.avg_price
                              const pl = cp - s.avg_price
                              const plPct = (pl / s.avg_price) * 100
                              const marketVal = s.qty * cp
                              const isProfit = pl >= 0
                              return (
                                <tr key={s.ticker}>
                                  <td>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.ticker.replace('.JK', '')}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.qty / 100} Lot · {s.qty.toLocaleString()} lembar</div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600 }}>{s.qty / 100} Lot</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.qty.toLocaleString()} lbr</div>
                                  </td>
                                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Rp {s.avg_price.toLocaleString('id-ID')}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>Rp {cp.toLocaleString('id-ID')}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700 }}>Rp {marketVal.toLocaleString('id-ID')}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: isProfit ? 'var(--accent)' : 'var(--red)' }}>
                                      {isProfit ? '+' : ''}{plPct.toFixed(2)}%
                                    </div>
                                    <div style={{ fontSize: 11, color: isProfit ? 'var(--accent)' : 'var(--red)' }}>
                                      {isProfit ? '+' : ''}Rp {(pl * s.qty).toLocaleString('id-ID')}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                      <button className="btn-action buy" disabled={processing}
                                        onClick={() => handleQuickTrade(s.ticker, 'buy', s.current_price || s.avg_price)}>+ Beli</button>
                                      <button className="btn-action sell" disabled={processing}
                                        onClick={() => handleQuickTrade(s.ticker, 'sell', s.current_price || s.avg_price)}>− Jual</button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile: Card Portfolio */}
                      <div className="vt-card-mobile">
                        {portfolio.map((s) => {
                          const cp = s.current_price || s.avg_price
                          const pl = cp - s.avg_price
                          const plPct = (pl / s.avg_price) * 100
                          const marketVal = s.qty * cp
                          const isProfit = pl >= 0
                          return (
                            <div key={s.ticker} className="vt-portfolio-card">
                              {/* Baris 1: Ticker + Gain/Loss */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div>
                                  <div style={{ fontSize: 18, fontWeight: 800 }}>{s.ticker.replace('.JK', '')}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.qty / 100} Lot · {s.qty.toLocaleString()} lembar</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 16, fontWeight: 800, color: isProfit ? 'var(--accent)' : 'var(--red)' }}>
                                    {isProfit ? '+' : ''}{plPct.toFixed(2)}%
                                  </div>
                                  <div style={{ fontSize: 11, color: isProfit ? 'var(--accent)' : 'var(--red)' }}>
                                    {isProfit ? '+' : ''}Rp {(pl * s.qty).toLocaleString('id-ID')}
                                  </div>
                                </div>
                              </div>
                              {/* Baris 2: Harga avg vs kini */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Avg. Beli</div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>Rp {s.avg_price.toLocaleString('id-ID')}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Harga Kini</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Rp {cp.toLocaleString('id-ID')}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Nilai Pasar</div>
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>Rp {marketVal.toLocaleString('id-ID')}</div>
                                </div>
                              </div>
                              {/* Baris 3: Tombol aksi */}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn-action buy" disabled={processing} style={{ flex: 1, padding: '8px', fontSize: 13 }}
                                  onClick={() => handleQuickTrade(s.ticker, 'buy', s.current_price || s.avg_price)}>+ Beli</button>
                                <button className="btn-action sell" disabled={processing} style={{ flex: 1, padding: '8px', fontSize: 13 }}
                                  onClick={() => handleQuickTrade(s.ticker, 'sell', s.current_price || s.avg_price)}>− Jual</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* HISTORY TABLE */}
              {activeTab === 'history' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {transactions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🕐</div>
                      <div className="empty-text">Belum ada riwayat transaksi</div>
                    </div>
                  ) : (
                    <>
                      {/* Desktop: Tabel History */}
                      <div className="vt-table-desktop" style={{ overflowX: 'auto' }}>
                        <table className="ranking-table">
                          <thead>
                            <tr>
                              <th>Waktu</th>
                              <th>Emiten</th>
                              <th style={{ textAlign: 'center' }}>Tipe</th>
                              <th style={{ textAlign: 'right' }}>Lot</th>
                              <th style={{ textAlign: 'right' }}>Harga/Lbr</th>
                              <th style={{ textAlign: 'right' }}>Fee</th>
                              <th style={{ textAlign: 'right' }}>Net Nilai</th>
                              <th style={{ textAlign: 'center' }}>Nota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.slice(0, 30).map((tx) => (
                              <tr key={tx.id}>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  {new Date(tx.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                                  <div style={{ fontSize: 11 }}>{new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td style={{ fontWeight: 700 }}>{tx.ticker.replace('.JK', '')}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`vt-tx-badge ${tx.type.toLowerCase()}`}>
                                    {tx.type === 'BUY' ? '📈 BELI' : '📉 JUAL'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>{tx.qty / 100} Lot</td>
                                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Rp {tx.price.toLocaleString('id-ID')}</td>
                                <td style={{ textAlign: 'right', fontSize: 12, color: '#f59e0b' }}>−Rp {(tx.fee || 0).toLocaleString('id-ID')}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: tx.type === 'BUY' ? 'var(--red)' : 'var(--accent)' }}>
                                  {tx.type === 'BUY' ? '−' : '+'}Rp {(tx.net_value || tx.qty * tx.price).toLocaleString('id-ID')}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button onClick={() => handleDownloadReceipt(tx.id)} className="btn-action buy" style={{ padding: '3px 8px', fontSize: 11 }}>📄 Nota</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                          💡 Fee Beli: 0.15% · Fee Jual: 0.25% (termasuk PPN & PPh Final) — sesuai standar broker BEI
                        </div>
                      </div>

                      {/* Mobile: Card History */}
                      <div className="vt-card-mobile">
                        {transactions.slice(0, 30).map((tx) => (
                          <div key={tx.id} className="vt-history-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                  <span style={{ fontSize: 16, fontWeight: 800 }}>{tx.ticker.replace('.JK', '')}</span>
                                  <span className={`vt-tx-badge ${tx.type.toLowerCase()}`} style={{ fontSize: 10 }}>
                                    {tx.type === 'BUY' ? '📈 BELI' : '📉 JUAL'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {new Date(tx.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })} · {new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: tx.type === 'BUY' ? 'var(--red)' : 'var(--accent)' }}>
                                  {tx.type === 'BUY' ? '−' : '+'}Rp {(tx.net_value || tx.qty * tx.price).toLocaleString('id-ID')}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tx.qty / 100} Lot · Rp {tx.price.toLocaleString('id-ID')}/lbr</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: 11, color: '#f59e0b' }}>Fee: −Rp {(tx.fee || 0).toLocaleString('id-ID')}</div>
                              <button onClick={() => handleDownloadReceipt(tx.id)} className="btn-action buy" style={{ padding: '4px 10px', fontSize: 11 }}>📄 Nota</button>
                            </div>
                          </div>
                        ))}
                        <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                          💡 Fee Beli: 0.15% · Fee Jual: 0.25%
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <DisclaimerFooter />
        </div>
      </main>

      {/* Transaction Modal Popup */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ticker={modalTicker}
        companyName={modalCompanyName}
        actionType={modalActionType}
        currentPrice={modalCurrentPrice}
        balance={balance}
        holdingQty={modalHoldingQty}
        onConfirm={handleConfirmTrade}
        processing={processing}
      />

      {/* ── TOAST NOTIFICATION ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <style jsx>{`
        /* Header Row */
        .vt-header-row {
          display: flex; justify-content: space-between; align-items: flex-start;
        }

        /* Desktop/Mobile toggle */
        .vt-table-desktop { display: block; }
        .vt-card-mobile   { display: none; }

        /* Portfolio card (mobile) */
        .vt-portfolio-card {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .vt-portfolio-card:last-child { border-bottom: none; }
        .vt-portfolio-card:active { background: var(--bg-hover); }

        /* History card (mobile) */
        .vt-history-card {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .vt-history-card:last-child { border-bottom: none; }

        /* Summary Grid */
        .vt-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .vt-stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .vt-stat-card:hover { border-color: var(--border-bright); transform: translateY(-1px); }
        .vt-stat-icon {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
        }
        .vt-stat-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
        .vt-stat-value { font-size: 18px; font-weight: 800; line-height: 1.2; }
        .vt-stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 3px; }

        /* Main Grid */
        .vt-main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }

        /* Order Form */
        .vt-order-toggle {
          display: grid; grid-template-columns: 1fr 1fr;
          background: var(--bg-primary); border-radius: 10px; padding: 4px;
          border: 1px solid var(--border);
        }
        .vt-toggle-btn {
          padding: 10px; border-radius: 8px; border: none;
          font-size: 13px; font-weight: 700; cursor: pointer;
          background: transparent; color: var(--text-secondary);
          transition: all 0.2s;
        }
        .vt-toggle-btn.active-buy { background: rgba(16,185,129,0.15); color: var(--accent); }
        .vt-toggle-btn.active-sell { background: rgba(239,68,68,0.15); color: var(--red); }

        .vt-field { display: flex; flex-direction: column; gap: 6px; }
        .vt-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .vt-input-wrap { position: relative; }
        .vt-input {
          width: 100%; padding: 10px 14px; border-radius: 8px;
          background: var(--bg-primary); border: 1px solid var(--border);
          color: var(--text-primary); font-size: 14px; font-weight: 600;
          outline: none; transition: border-color 0.2s;
        }
        .vt-input:focus { border-color: var(--accent); }
        .vt-input-badge {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          font-size: 14px;
        }

        .vt-price-box {
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px;
        }
        .vt-price-label { font-size: 11px; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .vt-price-value { min-height: 28px; display: flex; align-items: center; }

        .vt-lot-control { display: flex; gap: 8px; align-items: center; }
        .vt-lot-btn {
          width: 36px; height: 36px; border-radius: 8px;
          background: var(--bg-hover); border: 1px solid var(--border);
          color: var(--text-primary); font-size: 18px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .vt-lot-btn:hover { background: var(--border-bright); }

        .vt-order-summary {
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px;
        }
        .vt-summary-row {
          display: flex; justify-content: space-between;
          font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;
        }
        .vt-summary-row:last-child { margin-bottom: 0; }
        .vt-summary-divider { border-top: 1px solid var(--border); margin: 8px 0; }
        .vt-summary-total { font-weight: 700; font-size: 14px; color: var(--text-primary); }

        .vt-order-btn {
          width: 100%; padding: 14px; border-radius: 10px; border: none;
          font-size: 14px; font-weight: 800; cursor: pointer;
          transition: all 0.2s; letter-spacing: 0.3px;
        }
        .vt-order-btn.buy { background: var(--accent); color: #fff; }
        .vt-order-btn.buy:hover:not(:disabled) { background: var(--accent-dim); transform: scale(1.01); }
        .vt-order-btn.sell { background: var(--red); color: #fff; }
        .vt-order-btn.sell:hover:not(:disabled) { background: #dc2626; transform: scale(1.01); }
        .vt-order-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* Tabs */
        .vt-tabs {
          display: flex; gap: 4px;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 10px; padding: 4px;
        }
        .vt-tab {
          flex: 1; padding: 9px 16px; border-radius: 8px; border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
          background: transparent; color: var(--text-secondary);
          transition: all 0.2s;
        }
        .vt-tab.active { background: var(--bg-hover); color: var(--text-primary); }

        /* Transaction badge */
        .vt-tx-badge {
          display: inline-block; padding: 3px 10px; border-radius: 6px;
          font-size: 11px; font-weight: 700;
        }
        .vt-tx-badge.buy { background: rgba(16,185,129,0.1); color: var(--accent); }
        .vt-tx-badge.sell { background: rgba(239,68,68,0.1); color: var(--red); }

        /* Action buttons */
        .btn-action {
          padding: 5px 10px; border-radius: 6px; font-size: 11px;
          font-weight: 700; cursor: pointer; border: 1px solid transparent;
          transition: all 0.2s;
        }
        .btn-action.buy { background: rgba(16,185,129,0.1); color: var(--accent); border-color: rgba(16,185,129,0.2); }
        .btn-action.buy:hover:not(:disabled) { background: var(--accent); color: #fff; }
        .btn-action.sell { background: rgba(239,68,68,0.1); color: var(--red); border-color: rgba(239,68,68,0.2); }
        .btn-action.sell:hover:not(:disabled) { background: var(--red); color: #fff; }
        .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Responsive */
        @media (max-width: 1024px) {
          .vt-summary-grid { grid-template-columns: repeat(2, 1fr); }
          .vt-main-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .vt-summary-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .vt-stat-card { padding: 12px; gap: 10px; }
          .vt-stat-icon { width: 36px; height: 36px; font-size: 16px; }
          .vt-stat-value { font-size: 14px; }
          .vt-stat-label { font-size: 11px; }
          .vt-stat-sub { font-size: 10px; }
          .vt-header-row { flex-direction: column; align-items: flex-start; gap: 10px; }
          .vt-table-desktop { display: none !important; }
          .vt-card-mobile { display: block !important; }
        }
        @media (max-width: 640px) {
          .vt-summary-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  )
}
