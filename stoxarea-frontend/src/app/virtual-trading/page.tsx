'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import api from '@/lib/api'

interface PortfolioItem {
  ticker: string
  qty: number
  avg_price: number
  current_price?: number
}

export default function VirtualTradingPage() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState({ ticker: '', qty: 1, type: 'buy' })
  const [processing, setProcessing] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [portRes, userRes] = await Promise.all([
        api.get('/portfolio/'),
        api.get('/auth/me')
      ])
      
      const portData = portRes.data
      setBalance(userRes.data.virtual_balance || 0)

      // Fetch current prices for each ticker in portfolio
      const enhancedPortfolio = await Promise.all(portData.map(async (item: any) => {
        try {
          const priceRes = await api.get(`/market/live-price/${item.ticker}`)
          return { ...item, current_price: priceRes.data.price || item.avg_price }
        } catch {
          return { ...item, current_price: item.avg_price }
        }
      }))
      
      setPortfolio(enhancedPortfolio)
    } catch (err) {
      console.error("Gagal mengambil data portfolio:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleTrade = async () => {
    if (!order.ticker || order.qty <= 0) return alert("Masukkan ticker dan jumlah lot!")
    
    setProcessing(true)
    try {
      // Dapatkan harga live dulu sebelum transaksi
      const priceRes = await api.get(`/market/live-price/${order.ticker.toUpperCase()}`)
      const livePrice = priceRes.data.price

      if (!livePrice) throw new Error("Harga saham tidak ditemukan")

      const endpoint = order.type === 'buy' ? '/portfolio/buy' : '/portfolio/sell'
      await api.post(endpoint, {
        ticker: order.ticker.toUpperCase() + '.JK',
        qty: order.qty * 100, // Convert Lot to Lembar
        price: livePrice
      })
      
      alert(`Berhasil ${order.type === 'buy' ? 'Membeli' : 'Menjual'} ${order.qty} Lot ${order.ticker}`)
      setOrder({ ...order, ticker: '' })
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.detail || "Transaksi Gagal")
    } finally {
      setProcessing(false)
    }
  }

  const totalEquity = portfolio.reduce((acc, item) => acc + (item.qty * (item.current_price || 0)), 0)
  const totalValue = balance + totalEquity
  const totalPL = portfolio.reduce((acc, item) => acc + (item.qty * ((item.current_price || 0) - item.avg_price)), 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        
        <div className="page-body">
          {/* 1. Summary Cards */}
          <div className="stats-grid mb-24">
            <div className="card">
              <div className="stat-label">Total Nilai Akun</div>
              <div className="stat-value text-blue">Rp {totalValue.toLocaleString()}</div>
              <div className="fs-12 text-muted mt-4">Cash + Nilai Saham</div>
            </div>
            <div className="card">
              <div className="stat-label">Sisa Saldo Tunai</div>
              <div className="stat-value">Rp {balance.toLocaleString()}</div>
              <div className="fs-12 text-muted mt-4">Siap untuk investasi</div>
            </div>
            <div className="card">
              <div className="stat-label">Total Profit/Loss</div>
              <div className={`stat-value ${totalPL >= 0 ? 'text-green' : 'text-red'}`}>
                {totalPL >= 0 ? '+' : ''}Rp {totalPL.toLocaleString()}
              </div>
              <div className="fs-12 text-muted mt-4">Berdasarkan harga pasar saat ini</div>
            </div>
          </div>

          <div className="grid-full">
            {/* 2. List Portfolio */}
            <div className="card">
              <h3 className="section-title mb-16">Daftar Aset Anda</h3>
              {loading ? (
                <div className="skeleton" style={{ height: 200 }} />
              ) : portfolio.length === 0 ? (
                <div className="flex-center text-muted" style={{ height: 200, flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 40 }}>📁</span>
                  <span>Anda belum memiliki saham dalam portofolio.</span>
                  <a href="/market" className="btn-primary" style={{ padding: '8px 20px', fontSize: 12 }}>Buka Market Explorer</a>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Kepemilikan (Lot)</th>
                        <th>Avg Price</th>
                        <th>Current Price</th>
                        <th>Value</th>
                        <th>Gain/Loss</th>
                        <th style={{ textAlign: 'right' }}>Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.map((s) => {
                        const pl = (s.current_price || 0) - s.avg_price
                        const plPercent = (pl / s.avg_price) * 100
                        const itemValue = s.qty * (s.current_price || 0)
                        
                        const handleQuickAction = async (type: 'buy' | 'sell') => {
                          const lotInput = prompt(`Berapa LOT ${s.ticker.replace('.JK','')} yang ingin Anda ${type === 'buy' ? 'BELI' : 'JUAL'}?`, "1")
                          if (!lotInput) return
                          const lotCount = parseInt(lotInput)
                          if (isNaN(lotCount) || lotCount <= 0) return alert("Jumlah lot tidak valid")

                          try {
                            setProcessing(true)
                            await api.post(`/portfolio/${type}`, {
                              ticker: s.ticker,
                              qty: lotCount * 100,
                              price: s.current_price
                            })
                            alert(`Transaksi ${type.toUpperCase()} ${lotCount} Lot ${s.ticker} BERHASIL!`)
                            fetchData()
                          } catch (err: any) {
                            alert(err.response?.data?.detail || "Transaksi Gagal")
                          } finally {
                            setProcessing(false)
                          }
                        }

                        return (
                          <tr key={s.ticker}>
                            <td className="fw-700">
                              <div className="text-accent">{s.ticker.replace('.JK','')}</div>
                              <div className="fs-10 text-muted">Saham Aktif</div>
                            </td>
                            <td>{s.qty / 100} Lot</td>
                            <td>Rp {s.avg_price.toLocaleString()}</td>
                            <td className="text-accent">Rp {s.current_price?.toLocaleString()}</td>
                            <td className="fw-700">Rp {itemValue.toLocaleString()}</td>
                            <td className={pl >= 0 ? 'text-green' : 'text-red'}>
                              <div className="fw-700">{pl >= 0 ? '+' : ''}{plPercent.toFixed(2)}%</div>
                              <div className="fs-10">Rp {(pl * s.qty).toLocaleString()}</div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="flex-gap-8" style={{ justifyContent: 'flex-end' }}>
                                <button 
                                  className="btn-action buy" 
                                  onClick={() => handleQuickAction('buy')}
                                  disabled={processing}
                                >
                                  + BELI
                                </button>
                                <button 
                                  className="btn-action sell" 
                                  onClick={() => handleQuickAction('sell')}
                                  disabled={processing}
                                >
                                  - JUAL
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .grid-full {
          width: 100%;
        }
        .btn-action {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .btn-action.buy {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.2);
        }
        .btn-action.buy:hover {
          background: #10b981;
          color: white;
        }
        .btn-action.sell {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
        }
        .btn-action.sell:hover {
          background: #ef4444;
          color: white;
        }
        .text-green { color: #10b981; }
        .text-red { color: #ef4444; }
      `}</style>
    </div>
  )
}
