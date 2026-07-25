'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import ToastContainer from '@/components/ui/Toast'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import { useToast } from '@/hooks/useToast'
import api from '@/lib/api'
import TransactionModal from '@/components/ui/Modal'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

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

const COLORS = ['#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6']

export default function VirtualTradingPage() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history'>('portfolio')
  const { toasts, removeToast, toast } = useToast()

  // Modal Trading States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTicker, setModalTicker] = useState('')
  const [modalCompanyName, setModalCompanyName] = useState('')
  const [modalActionType, setModalActionType] = useState<'BUY' | 'SELL'>('BUY')
  const [modalCurrentPrice, setModalCurrentPrice] = useState(0)
  const [modalHoldingQty, setModalHoldingQty] = useState(0)

  const handleDownloadPDF = async () => {
    try {
      toast.info('Memproses PDF 📄', 'Mohon tunggu sebentar...', '')
      const response = await api.get('/portfolio/transactions/pdf', { responseType: 'blob' })
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
    } catch {
      toast.error('Gagal Mengunduh PDF', 'Terjadi kesalahan saat memproses laporan PDF.', '')
    }
  }

  const handleDownloadReceipt = async (txId: number) => {
    try {
      toast.info('Memproses Kuitansi 📄', 'Mohon tunggu sebentar...', '')
      const response = await api.get(`/portfolio/transactions/${txId}/pdf`, { responseType: 'blob' })
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
    } catch {
      toast.error('Gagal Mengunduh', 'Terjadi kesalahan saat memproses kuitansi PDF.', '')
    }
  }

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
        qty: lots * 100 
      })
      const data = res.data
      const tickerClean = modalTicker.replace('.JK', '')

      toast.success(
        `${modalActionType === 'BUY' ? 'Pembelian' : 'Penjualan'} Berhasil 💰`,
        `${lots} Lot ${tickerClean} pada harga Rp ${data.executed_price?.toLocaleString('id-ID')}`,
        `Total: Rp ${data.net_value?.toLocaleString('id-ID')}`
      )
      setIsModalOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error('Transaksi Gagal', err.response?.data?.detail || 'Terjadi kesalahan saat memproses order')
    } finally { 
      setProcessing(false) 
    }
  }

  // Format helper Juta / Miliar
  const formatJuta = (val: number) => {
    const absVal = Math.abs(val)
    if (absVal >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(2)} Miliar`
    }
    if (absVal >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(2)} Juta`
    }
    if (absVal >= 1_000) {
      return `${(val / 1_000).toFixed(1)} Ribu`
    }
    return `${val}`
  }

  // Portfolio calculations
  const totalEquity = portfolio.reduce((a, i) => a + i.qty * (i.current_price || 0), 0)
  const totalCost   = portfolio.reduce((a, i) => a + i.qty * i.avg_price, 0)
  const totalPL     = totalEquity - totalCost
  const totalPLPct  = totalCost > 0 ? (totalPL / totalCost) * 100 : 0
  const totalValue  = balance + totalEquity

  // Donut chart asset allocation calculation
  const allocationData = [
    { name: 'Kas (Cash)', value: balance },
    ...portfolio.map(s => ({
      name: s.ticker.replace('.JK', ''),
      value: s.qty * (s.current_price || s.avg_price)
    }))
  ].filter(item => item.value > 0)

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <div className="page-body">

          {/* Header */}
          <div className="page-header vt-header-row">
            <div>
              <h1>Virtual Trading</h1>
              <p>Simulasi transaksi saham BEI real-time tanpa risiko finansial</p>
            </div>
            <button onClick={fetchData} className="btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}>
              🔄 Refresh
            </button>
          </div>

          {/* Vertical-Divider Stats summary row */}
          <div className="stats-row" style={{ marginBottom: 32 }}>
            <div className="stat-card">
              <span className="stat-label">Total Nilai Akun</span>
              <span className="stat-value" style={{ color: 'var(--blue)' }}>
                Rp {totalValue.toLocaleString('id-ID')}
              </span>
              <span className="stat-sub" style={{ fontWeight: 600, color: 'var(--blue)' }}>
                ~{formatJuta(totalValue)} (Kas + Saham)
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Saldo Kas (Cash)</span>
              <span className="stat-value" style={{ color: 'var(--accent)' }}>
                Rp {balance.toLocaleString('id-ID')}
              </span>
              <span className="stat-sub" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                ~{formatJuta(balance)} siap dipakai
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Uang di Saham (Portofolio)</span>
              <span className="stat-value">
                Rp {totalEquity.toLocaleString('id-ID')}
              </span>
              <span className="stat-sub" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                ~{formatJuta(totalEquity)} ({portfolio.length} emiten)
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Gain / Loss Total</span>
              <span className="stat-value" style={{ color: totalPL >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                {totalPL >= 0 ? '+' : ''}{totalPLPct.toFixed(2)}%
              </span>
              <span className="stat-sub" style={{ fontWeight: 700, color: totalPL >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                {totalPL >= 0 ? '+' : ''}Rp {totalPL.toLocaleString('id-ID')} ({totalPL >= 0 ? '+' : ''}{formatJuta(totalPL)})
              </span>
            </div>
          </div>

          {/* Split 60/40 Layout */}
          <div className="split-layout">
            
            {/* LEFT PANEL: Portfolio list / history */}
            <div className="panel-left">
              <div className="tabs-container">
                <button className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>
                  💼 Portofolio Aktif ({portfolio.length})
                </button>
                <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                  🕐 Riwayat Transaksi
                </button>
              </div>

              {activeTab === 'portfolio' && (
                <div>
                  {loading ? (
                    <div className="clean-list">
                      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}
                    </div>
                  ) : portfolio.length === 0 ? (
                    <div className="empty-state" style={{ padding: '60px 0' }}>
                      <div className="empty-icon">💼</div>
                      <div className="empty-text">Anda belum memiliki aset saham apapun.</div>
                      <Link href="/market" className="btn-primary" style={{ fontSize: 13, marginTop: 8 }}>
                        Cari Saham & Beli
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Portfolio Table */}
                      <div className="market-table-desktop">
                        <table className="clean-table">
                          <thead>
                            <tr>
                              <th>Emiten & Lot</th>
                              <th style={{ textAlign: 'right' }}>Total Uang Beli (Modal)</th>
                              <th style={{ textAlign: 'right' }}>Nilai Uang Sekarang</th>
                              <th style={{ textAlign: 'right' }}>Keuntungan Total</th>
                              <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portfolio.map((s) => {
                              const cp = s.current_price || s.avg_price
                              const currentValue = cp * s.qty
                              const totalInvested = s.avg_price * s.qty
                              const pl = cp - s.avg_price
                              const totalPL = pl * s.qty
                              const plPct = (pl / s.avg_price) * 100
                              const isProfit = pl >= 0
                              return (
                                <tr key={s.ticker}>
                                  <td>
                                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{s.ticker.replace('.JK', '')}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                                      {s.qty / 100} Lot <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({s.qty.toLocaleString('id-ID')} lbr)</span>
                                    </div>
                                  </td>
                                  {/* TOTAL UANG BELI / MODAL */}
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                                      Rp {totalInvested.toLocaleString('id-ID')}
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>
                                      ({formatJuta(totalInvested)})
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                      Avg: Rp {s.avg_price.toLocaleString('id-ID')} /lbr
                                    </div>
                                  </td>
                                  {/* NILAI UANG SEKARANG */}
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--blue)' }}>
                                      Rp {currentValue.toLocaleString('id-ID')}
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>
                                      ({formatJuta(currentValue)})
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                      Kini: Rp {cp.toLocaleString('id-ID')} /lbr
                                    </div>
                                  </td>
                                  {/* TOTAL KEUNTUNGAN */}
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: isProfit ? 'var(--accent)' : 'var(--red)' }}>
                                      {isProfit ? '+' : ''}Rp {totalPL.toLocaleString('id-ID')}
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isProfit ? 'var(--accent)' : 'var(--red)', marginTop: 2 }}>
                                      {isProfit ? '+' : ''}{formatJuta(totalPL)} ({isProfit ? '+' : ''}{plPct.toFixed(2)}%)
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                      <button className="btn-outline" style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', borderColor: 'rgba(16,185,129,0.3)' }}
                                        onClick={() => handleQuickTrade(s.ticker, 'buy', cp)}>+ Beli</button>
                                      <button className="btn-outline" style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}
                                        onClick={() => handleQuickTrade(s.ticker, 'sell', cp)}>− Jual</button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Portfolio Cards */}
                      <div className="market-card-mobile">
                        {portfolio.map((s) => {
                          const cp = s.current_price || s.avg_price
                          const currentValue = cp * s.qty
                          const totalInvested = s.avg_price * s.qty
                          const pl = cp - s.avg_price
                          const totalPL = pl * s.qty
                          const plPct = (pl / s.avg_price) * 100
                          const isProfit = pl >= 0
                          return (
                            <div key={s.ticker} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontSize: 16, fontWeight: 800 }}>{s.ticker.replace('.JK', '')}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                                    {s.qty / 100} Lot ({s.qty.toLocaleString('id-ID')} lbr)
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: isProfit ? 'var(--accent)' : 'var(--red)' }}>
                                    {isProfit ? '+' : ''}Rp {totalPL.toLocaleString('id-ID')}
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: isProfit ? 'var(--accent)' : 'var(--red)' }}>
                                    {isProfit ? '+' : ''}{formatJuta(totalPL)} ({isProfit ? '+' : ''}{plPct.toFixed(2)}%)
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, marginTop: 8 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>UANG BELI (MODAL)</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                                    Rp {totalInvested.toLocaleString('id-ID')} <span style={{ color: '#f59e0b' }}>({formatJuta(totalInvested)})</span>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>NILAI UANG SEKARANG</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--blue)', marginTop: 2 }}>
                                    Rp {currentValue.toLocaleString('id-ID')} <span>({formatJuta(currentValue)})</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                                  <div>Avg: Rp {s.avg_price.toLocaleString('id-ID')}</div>
                                  <div>Kini: Rp {cp.toLocaleString('id-ID')}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button className="btn-outline" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--accent)' }}
                                    onClick={() => handleQuickTrade(s.ticker, 'buy', cp)}>+ Beli</button>
                                  <button className="btn-outline" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red)' }}
                                    onClick={() => handleQuickTrade(s.ticker, 'sell', cp)}>− Jual</button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <button onClick={handleDownloadPDF} className="btn-outline" style={{ padding: '6px 12px', fontSize: 12 }}>
                      📄 Unduh Riwayat PDF
                    </button>
                  </div>
                  {transactions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🕐</div>
                      <div className="empty-text">Belum ada catatan transaksi di akun simulator Anda.</div>
                    </div>
                  ) : (
                    <>
                      {/* Desktop History Table */}
                      <div className="market-table-desktop">
                        <table className="clean-table">
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Emiten</th>
                              <th style={{ textAlign: 'center' }}>Tipe</th>
                              <th style={{ textAlign: 'right' }}>Lot</th>
                              <th style={{ textAlign: 'right' }}>Harga</th>
                              <th style={{ textAlign: 'right' }}>Net Value</th>
                              <th style={{ textAlign: 'center' }}>Nota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.slice(0, 20).map((tx) => (
                              <tr key={tx.id}>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {new Date(tx.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ fontWeight: 700 }}>{tx.ticker.replace('.JK', '')}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`sentiment-badge ${tx.type === 'BUY' ? 'bullish' : 'bearish'}`} style={{ fontSize: 10 }}>
                                    {tx.type}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>{tx.qty / 100} Lot</td>
                                <td style={{ textAlign: 'right' }}>Rp {tx.price.toLocaleString('id-ID')}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  Rp {tx.net_value.toLocaleString('id-ID')}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button onClick={() => handleDownloadReceipt(tx.id)} className="btn-outline" style={{ padding: '4px 8px', fontSize: 10 }}>
                                    Nota
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile History Cards */}
                      <div className="market-card-mobile">
                        {transactions.slice(0, 20).map((tx) => (
                          <div key={tx.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                              <div>
                                <span style={{ fontWeight: 800, fontSize: 15 }}>{tx.ticker.replace('.JK', '')}</span>
                                <span className={`sentiment-badge ${tx.type === 'BUY' ? 'bullish' : 'bearish'}`} style={{ fontSize: 9, marginLeft: 8 }}>
                                  {tx.type}
                                </span>
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 14, color: tx.type === 'BUY' ? 'var(--red)' : 'var(--accent)' }}>
                                Rp {tx.net_value.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                              <div>
                                {new Date(tx.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div>
                                {tx.qty / 100} Lot @ Rp {tx.price.toLocaleString('id-ID')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT PANEL: Asset Allocation Pie Chart (replaces the order form) */}
            <div className="panel-right" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 className="section-title" style={{ fontSize: 18 }}>Alokasi Aset</h2>
                <p className="section-sub" style={{ marginBottom: 12 }}>Distribusi portofolio virtual Anda</p>
              </div>

              {allocationData.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Belum ada aset untuk divisualisasikan.
                </div>
              ) : (
                <div style={{ height: 280, width: '100%', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => `Rp ${value.toLocaleString('id-ID')}`}
                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  💡 <strong>Tip Edukasi:</strong> Diversifikasi aset membantu menekan risiko fluktuasi pasar. Usahakan alokasi per emiten tidak melebihi 20-30% dari total nilai akun.
                </div>
                <Link href="/market" className="btn-primary" style={{ textAlign: 'center', marginTop: 10 }}>
                  + Tambah Aset Baru (Beli Saham)
                </Link>
              </div>
            </div>

          </div>

          <DisclaimerFooter />
        </div>
      </main>

      {/* Transaction Confirmation Modal */}
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
