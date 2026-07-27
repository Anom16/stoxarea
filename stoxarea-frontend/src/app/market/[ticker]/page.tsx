'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'
import TechnicalChart from '@/components/charts/TechnicalChart'
import ToastContainer from '@/components/ui/Toast'
import FundamentalTooltip, { FundamentalTooltipProvider } from '@/components/ui/FundamentalTooltip'
import DisclaimerFooter from '@/components/ui/DisclaimerFooter'
import { useToast } from '@/hooks/useToast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import TransactionModal from '@/components/ui/Modal'

// --- Skeleton Component ---
const Skeleton = ({ height = 20, width = '100%', mb = 12 }) => (
  <div className="skeleton" style={{ height, width, marginBottom: mb, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }} />
)

// --- Last Updated Badge ---
// Menampilkan label "Data per: ..." di pojok kanan bawah grafik
const LastUpdatedBadge = ({ label, sub }: { label: string; sub?: string }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 10, color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: 6, padding: '3px 8px',
  }}>
    <span style={{ opacity: 0.5 }}>🕐</span>
    <span>{label}{sub ? <span style={{ opacity: 0.6 }}> · {sub}</span> : null}</span>
  </div>
)

const FEATURE_LABELS: Record<string, string> = {
  rsi_14: 'Kekuatan Jenuh Beli/Jual (RSI)',
  ma_20_dist: 'Posisi Harga vs Rata-rata 20 Hari (MA-20)',
  ma_50_dist: 'Posisi Harga vs Rata-rata 50 Hari (MA-50)',
  vol_ma_ratio: 'Lonjakan Volume Transaksi',
  roe: 'Keuntungan dari Modal (ROE)',
  der: 'Tingkat Utang vs Modal (DER)',
  pbv: 'Kewajaran Harga (PBV)',
  close: 'Harga Saham Saat Ini',
  bb_width: 'Gejolak Rentang Harga (Bollinger Bands)',
  bb_position: 'Posisi Harga vs Bollinger Bands',
  macd_norm: 'Kekuatan Tren Pergerakan (MACD)',
  macd_signal_norm: 'Sinyal Pemicu Tren (MACD Signal)',
  macd_hist_norm: 'Selisih Kekuatan Tren (MACD Histogram)',
  log_ret_1d: 'Hasil Naik-Turun Harian',
  log_ret_5d: 'Tren Pergerakan 5 Hari Terakhir',
}

// ── Collapsible Card — standalone component (di luar StockDetailPage) ──
function CollapsibleCard({
  id, title, defaultOpen = true, children, style = {},
  collapsed, onToggle
}: {
  id: string
  title: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
  collapsed: Record<string, boolean>
  onToggle: (key: string) => void
}) {
  const isOpen = collapsed[id] === undefined ? defaultOpen : !collapsed[id]
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', ...style }}>
      <div
        onClick={() => onToggle(id)}
        style={{
          padding: '12px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none',
          borderBottom: isOpen ? '1px solid var(--border)' : 'none',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <span style={{
          fontSize: 12, color: 'var(--text-muted)',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s', display: 'inline-block'
        }}>▼</span>
      </div>
      {isOpen && <div style={{ padding: 18 }}>{children}</div>}
    </div>
  )
}

export default function StockDetailPage() {
  const { ticker } = useParams()
  const tickerStr = typeof ticker === 'string' ? ticker.toUpperCase() : ''
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ai' | 'financials' | 'dividends'>('ai')
  const [historyData, setHistoryData] = useState<any>(null)
  const [loadingHist, setLoadingHist] = useState(false)

  // Chart period state
  const [chartPeriod, setChartPeriod] = useState<string>('1y')
  const [chartInterval, setChartInterval] = useState<string>('1d')
  const [chartLoading, setChartLoading] = useState(false)
  const [showMA, setShowMA] = useState(true)
  const [showBB, setShowBB] = useState(false)

  // Collapsible cards state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggleCard = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  // Translated description
  const [translatedDesc, setTranslatedDesc] = useState<string>('')
  const [translating, setTranslating] = useState(false)
  
  // States for Trading
  const [dbCash, setDbCash] = useState(0)
  const [dbHoldingShares, setDbHoldingShares] = useState(0)
  const { toasts, removeToast, toast } = useToast()

  // Modal Trading States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalActionType, setModalActionType] = useState<'BUY' | 'SELL'>('BUY')
  const [tradeProcessing, setTradeProcessing] = useState(false)

  useEffect(() => {
    const fetchMainData = async () => {
      setLoading(true)
      try {
        const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
        const [fundRes, techRes, aiRes, userRes, portRes] = await Promise.all([
          api.get(`/market/fundamental/${fullTicker}`),
          api.get(`/market/technical/${fullTicker}?period=1y`),
          api.get(`/market/ai-score/${fullTicker}`),
          api.get('/auth/me'),
          api.get('/portfolio/')
        ])
        setData({
          fundamental: fundRes.data,
          technical: techRes.data,
          ai: aiRes.data
        })
        setDbCash(userRes.data.virtual_balance || 0)
        
        const currentHolding = portRes.data.find(
          (h: any) => h.ticker.toUpperCase() === fullTicker.toUpperCase()
        )
        if (currentHolding) {
          setDbHoldingShares(currentHolding.qty)
        }

        // Terjemahkan deskripsi perusahaan
        if (fundRes.data.description) {
          translateDescription(fundRes.data.description)
        }
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
    // Re-fetch jika: belum ada data, ATAU data ada tapi dividend_history kosong dan tab dividen aktif
    const needsFetch = !historyData ||
      (activeTab === 'dividends' && historyData && (historyData.dividend_history || []).length === 0)

    if ((activeTab === 'financials' || activeTab === 'dividends') && needsFetch && tickerStr) {
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <img 
        src="/icons/loading.gif" 
        onError={(e) => { (e.target as HTMLImageElement).src = '/icons/icon-192x192.png' }}
        alt="Loading..." 
        style={{ width: 80, height: 80, objectFit: 'contain' }} 
      />
    </div>
  )

  if (!data || data.fundamental.error) return (
    <div className="flex-center" style={{ height: '100vh' }}>
      <div className="card text-center" style={{ maxWidth: 400 }}>
        <h2 className="text-red" style={{ marginBottom: 8 }}>Data Tidak Tersedia</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          {data?.fundamental?.error?.includes('throttle')
            ? 'Yahoo Finance sedang sibuk. Coba lagi dalam beberapa detik.'
            : `Data untuk ${tickerStr} tidak ditemukan.`}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => window.location.reload()}
            style={{ fontSize: 13 }}
          >
            🔄 Coba Lagi
          </button>
          <Link href="/market" className="btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
            ← Kembali ke Jelajah Pasar
          </Link>
        </div>
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

  // Format last_updated dari backend menjadi string yang mudah dibaca
  const formatLastUpdated = (lu: any): { label: string; sub?: string } => {
    if (!lu) return { label: '—' }
    // Untuk data teknikal: tampilkan tanggal candle terakhir
    if (lu.last_candle_date) {
      const d = new Date(lu.last_candle_date)
      const label = `Data per ${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`
      const fetched = lu.fetched_at ? new Date(lu.fetched_at) : null
      const sub = fetched ? `Diambil ${fetched.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` : undefined
      return { label, sub }
    }
    // Untuk data fundamental: tampilkan waktu update harga dari Yahoo
    if (lu.market_time_display) {
      return { label: `Yahoo: ${lu.market_time_display}` }
    }
    if (lu.market_time) {
      const d = new Date(lu.market_time)
      return { label: `Yahoo: ${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` }
    }
    // Untuk laporan keuangan: tampilkan tahun fiskal terakhir
    if (lu.display) {
      return { label: lu.display, sub: lu.source === 'database' ? 'dari DB lokal' : 'dari Yahoo Finance' }
    }
    return { label: '—' }
  }

  const handleConfirmTrade = async (tradeLots: number) => {
    const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
    setTradeProcessing(true)
    const endpoint = modalActionType === 'BUY' ? '/portfolio/buy' : '/portfolio/sell'
    try {
      const res = await api.post(endpoint, {
        ticker: fullTicker,
        qty: tradeLots,
      })
      const data = res.data
      if (modalActionType === 'BUY') {
        toast.success(
          `Order Masuk 📈`,
          `${tradeLots} Lot ${tickerStr} · Rp ${data.executed_price?.toLocaleString('id-ID')}/lembar`,
          `Dibayar: Rp ${data.net_value?.toLocaleString('id-ID')} (fee Rp ${data.fee_amount?.toLocaleString('id-ID')})`
        )
        setDbCash(prev => prev - (data.net_value || 0))
        setDbHoldingShares(prev => prev + (data.qty_lembar || tradeLots * 100))
      } else {
        toast.success(
          `Order Keluar 📉`,
          `${tradeLots} Lot ${tickerStr} · Rp ${data.executed_price?.toLocaleString('id-ID')}/lembar`,
          `Diterima: Rp ${data.net_value?.toLocaleString('id-ID')} (setelah fee Rp ${data.fee_amount?.toLocaleString('id-ID')})`
        )
        setDbCash(prev => prev + (data.net_value || 0))
        setDbHoldingShares(prev => Math.max(0, prev - (data.qty_lembar || tradeLots * 100)))
      }
      setIsModalOpen(false)
    } catch (err: any) {
      toast.error(
        'Order Gagal',
        err.response?.data?.detail || 'Terjadi kesalahan saat memproses order'
      )
    } finally {
      setTradeProcessing(false)
    }
  }

  // ── Terjemahkan deskripsi perusahaan via MyMemory API (gratis, tanpa key) ──
  const translateDescription = async (text: string) => {
    if (!text || text.length < 10) return
    setTranslating(true)
    try {
      // Potong max 500 karakter per request (batas MyMemory free tier)
      const encoded = encodeURIComponent(text.slice(0, 500))
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|id`
      )
      const json = await res.json()
      if (json.responseStatus === 200 && json.responseData?.translatedText) {
        setTranslatedDesc(json.responseData.translatedText)
      }
    } catch {
      // Gagal translate — biarkan tampil teks asli
    } finally {
      setTranslating(false)
    }
  }

  // ── Fetch chart data saat period berubah ──
  const fetchChartData = async (period: string, interval: string) => {
    if (!tickerStr) return
    setChartLoading(true)
    try {
      const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
      const res = await api.get(`/market/technical/${fullTicker}?period=${period}&interval=${interval}`)
      setData((prev: any) => ({ ...prev, technical: res.data }))
    } catch (e) {
      toast.error('Gagal Memuat Chart', 'Tidak dapat mengambil data periode ini')
    } finally {
      setChartLoading(false)
    }
  }

  const handlePeriodChange = (period: string) => {
    const intervalMap: Record<string, string> = {
      '1mo': '1d',
      '3mo': '1d',
      '6mo': '1d',
      '1y':  '1d',
      '2y':  '1wk',
      '3y':  '1wk',
      '5y':  '1wk',
    }
    const interval = intervalMap[period] || '1d'
    setChartPeriod(period)
    setChartInterval(interval)
    fetchChartData(period, interval)
  }

  // ── Download XLSX — pure client-side, 0 beban server ──
  const handleDownloadXLSX = async () => {
    if (!data?.technical) return
    
    // Lazy-load history data if not loaded yet
    let hist = historyData
    if (!hist) {
      try {
        toast.info('Memuat data historis untuk Excel...', 'Mohon tunggu sebentar...', '')
        const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
        const res = await api.get(`/market/history/${fullTicker}`)
        hist = res.data
        setHistoryData(res.data)
      } catch (e) {
        console.error('Failed to lazy load history for excel download', e)
      }
    }

    import('xlsx').then(XLSX => {
      const tech = data.technical
      const f    = data.fundamental
      const ai   = data.ai
      const ticker = tickerStr.replace('.JK', '')
      const wb = XLSX.utils.book_new()

      // ── Sheet 1: OHLCV + Indikator ──
      const dataRows = tech.dates.map((date: string, i: number) => ({
        'Tanggal':        date,
        'Open':           tech.candles.open[i]              ?? '',
        'High':           tech.candles.high[i]              ?? '',
        'Low':            tech.candles.low[i]               ?? '',
        'Close':          tech.candles.close[i]             ?? '',
        'Volume':         tech.candles.volume?.[i]          ?? '',
        'MA-20':          tech.indicators?.ma_20?.[i]       ?? '',
        'MA-50':          tech.indicators?.ma_50?.[i]       ?? '',
        'RSI (14)':       tech.indicators?.rsi?.[i]         ?? '',
        'MACD':           tech.indicators?.macd?.[i]        ?? '',
        'MACD Signal':    tech.indicators?.macd_signal?.[i] ?? '',
        'MACD Hist':      tech.indicators?.macd_hist?.[i]   ?? '',
        'BB Upper':       tech.indicators?.bb_upper?.[i]    ?? '',
        'BB Mid':         tech.indicators?.bb_mid?.[i]      ?? '',
        'BB Lower':       tech.indicators?.bb_lower?.[i]    ?? '',
      }))

      const ws1 = XLSX.utils.json_to_sheet(dataRows)

      // Lebar kolom
      ws1['!cols'] = [
        { wch: 12 }, // Tanggal
        { wch: 10 }, // Open
        { wch: 10 }, // High
        { wch: 10 }, // Low
        { wch: 10 }, // Close
        { wch: 14 }, // Volume
        { wch: 10 }, // MA-20
        { wch: 10 }, // MA-50
        { wch: 10 }, // RSI
        { wch: 10 }, // MACD
        { wch: 12 }, // MACD Signal
        { wch: 12 }, // MACD Hist
        { wch: 10 }, // BB Upper
        { wch: 10 }, // BB Mid
        { wch: 10 }, // BB Lower
      ]
      XLSX.utils.book_append_sheet(wb, ws1, 'Data Teknikal')

      // ── Sheet 2: Ringkasan Fundamental ──
      const summaryRows = [
        { 'Keterangan': 'Ticker',           'Nilai': ticker },
        { 'Keterangan': 'Nama Perusahaan',  'Nilai': f?.name || '—' },
        { 'Keterangan': 'Sektor',           'Nilai': f?.sector || '—' },
        { 'Keterangan': 'Industri',         'Nilai': f?.industry || '—' },
        { 'Keterangan': '',                 'Nilai': '' },
        { 'Keterangan': '── Harga ──',      'Nilai': '' },
        { 'Keterangan': 'Harga Terakhir',   'Nilai': f?.price?.current ?? '—' },
        { 'Keterangan': '52W High',         'Nilai': f?.price?.week_52_high ?? '—' },
        { 'Keterangan': '52W Low',          'Nilai': f?.price?.week_52_low ?? '—' },
        { 'Keterangan': 'Volume',           'Nilai': f?.price?.volume ?? '—' },
        { 'Keterangan': 'Market Cap',       'Nilai': f?.price?.market_cap ?? '—' },
        { 'Keterangan': 'Beta',             'Nilai': f?.price?.beta ?? '—' },
        { 'Keterangan': '── Valuasi ──',    'Nilai': '' },
        { 'Keterangan': 'PBV',              'Nilai': f?.valuation?.pbv ?? '—' },
        { 'Keterangan': '',                 'Nilai': '' },
        { 'Keterangan': '── Profitabilitas ──', 'Nilai': '' },
        { 'Keterangan': 'ROE',              'Nilai': f?.profitability?.roe != null ? `${(f.profitability.roe * 100).toFixed(2)}%` : '—' },
        { 'Keterangan': 'ROA',              'Nilai': f?.profitability?.roa != null ? `${(f.profitability.roa * 100).toFixed(2)}%` : '—' },
        { 'Keterangan': 'Net Margin',       'Nilai': f?.profitability?.net_margin != null ? `${(f.profitability.net_margin * 100).toFixed(2)}%` : '—' },
        { 'Keterangan': '',                 'Nilai': '' },
        { 'Keterangan': '── Kesehatan ──',  'Nilai': '' },
        { 'Keterangan': 'DER',              'Nilai': f?.health?.der ?? '—' },
        { 'Keterangan': '',                 'Nilai': '' },
        { 'Keterangan': '── Dividen ──',    'Nilai': '' },
        { 'Keterangan': 'Dividend Yield',   'Nilai': f?.dividend?.yield_pct != null ? `${(f.dividend.yield_pct * 100).toFixed(2)}%` : '—' },
        { 'Keterangan': 'Payout Ratio',     'Nilai': f?.dividend?.payout_ratio ?? '—' },
        { 'Keterangan': '',                 'Nilai': '' },
        { 'Keterangan': '── AI Score ──',   'Nilai': '' },
        { 'Keterangan': 'AI Score',         'Nilai': ai?.ai_score_percent ?? '—' },
        { 'Keterangan': 'Sinyal',           'Nilai': (ai?.ai_score ?? 0) >= 0.6 ? 'Bullish Kuat' : (ai?.ai_score ?? 0) >= 0.4 ? 'Netral' : 'Bearish' },
        { 'Keterangan': '',                 'Nilai': '' },
        { 'Keterangan': '── Info Ekspor ──','Nilai': '' },
        { 'Keterangan': 'Periode Chart',    'Nilai': chartPeriod },
        { 'Keterangan': 'Interval',         'Nilai': chartInterval },
        { 'Keterangan': 'Total Baris Data', 'Nilai': tech.dates.length },
        { 'Keterangan': 'Tanggal Unduh',    'Nilai': new Date().toLocaleString('id-ID') },
        { 'Keterangan': 'Sumber',           'Nilai': 'StoxArea — stoxarea.app' },
      ]

      const ws2 = XLSX.utils.json_to_sheet(summaryRows)
      ws2['!cols'] = [{ wch: 22 }, { wch: 28 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan')

      // ── Sheet 3: Laba Rugi ──
      const financialsRows = hist?.financials_history?.map((d: any) => ({
        'Tahun Fiskal': d.year,
        'Pendapatan (Revenue)': d.revenue != null ? d.revenue : '—',
        'Laba Bersih (Net Income)': d.net_income != null ? d.net_income : '—',
      })) || []
      const wsLabaRugi = XLSX.utils.json_to_sheet(financialsRows)
      wsLabaRugi['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(wb, wsLabaRugi, 'Laba Rugi')

      // ── Sheet 4: Neraca (Balance Sheet) ──
      const balanceRows = hist?.balance_sheet_history?.map((d: any) => ({
        'Tahun Fiskal': d.year,
        'Aset (Assets)': d.assets != null ? d.assets : '—',
        'Liabilitas (Liabilities)': d.liabilities != null ? d.liabilities : '—',
        'Ekuitas (Equity)': d.equity != null ? d.equity : '—',
      })) || []
      const wsNeraca = XLSX.utils.json_to_sheet(balanceRows)
      wsNeraca['!cols'] = [{ wch: 15 }, { wch: 22 }, { wch: 22 }, { wch: 22 }]
      XLSX.utils.book_append_sheet(wb, wsNeraca, 'Neraca')

      // ── Sheet 5: Riwayat Dividen ──
      const dividendRows = hist?.dividend_history?.map((d: any) => ({
        'Tanggal Ex-Dividend': d.date,
        'Jumlah Dividen (per Lembar)': d.amount != null ? d.amount : '—',
      })) || []
      const wsDividen = XLSX.utils.json_to_sheet(dividendRows)
      wsDividen['!cols'] = [{ wch: 20 }, { wch: 28 }]
      XLSX.utils.book_append_sheet(wb, wsDividen, 'Riwayat Dividen')

      // ── Sheet 6: SHAP Insights ──
      if (ai?.insights?.length) {
        const shapRows = (ai.insights as any[]).map((ins: any, i: number) => ({
          'Rank':        i + 1,
          'Fitur':       ins.feature,
          'Label':       ins.description?.split(' ').slice(0, 4).join(' ') || ins.feature,
          'Kontribusi':  ins.contribution,
          'Arah':        ins.contribution > 0 ? '▲ Bullish' : '▼ Bearish',
          'Deskripsi':   ins.description,
        }))
        const ws3 = XLSX.utils.json_to_sheet(shapRows)
        ws3['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 50 }]
        XLSX.utils.book_append_sheet(wb, ws3, 'SHAP Insights')
      }

      const numSheets = ai?.insights?.length ? 6 : 5
      const filename = `${ticker}_${chartPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)

      toast.success(
        'Excel Berhasil Diunduh 📥',
        `${ticker} · ${tech.dates.length} baris · ${numSheets} sheet`,
        `File: ${filename}`
      )
    })
  }

  // ── Download PDF Laporan Lengkap ──
  const handleDownloadPDF = async () => {
    try {
      toast.info('Memproses PDF Laporan 📄', 'Mohon tunggu sebentar...', '')
      const fullTicker = tickerStr.endsWith('.JK') ? tickerStr : tickerStr + '.JK'
      const response = await api.get(`/market/report/${fullTicker}/pdf`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `StoxArea_Laporan_${tickerStr.replace('.JK', '')}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Unduh Berhasil 📄', 'Laporan PDF emiten berhasil diunduh.', '')
    } catch (e) {
      console.error(e)
      toast.error('Gagal Mengunduh PDF', 'Terjadi kesalahan saat memproses laporan PDF.', '')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="page-body">
          {/* Header & Price */}
          <div className="flex-between mb-24">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ fontSize: 32, fontWeight: 800 }}>{f.ticker.replace('.JK', '')}</h1>
                <span className="pick-sector">{f.sector}</span>
                {f.cluster && (
                  <span style={{ 
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: f.cluster.includes('Sultan') ? 'rgba(16, 185, 129, 0.1)' : 
                                f.cluster.includes('Value') ? 'rgba(59, 130, 246, 0.1)' : 
                                'rgba(245, 158, 11, 0.1)',
                    color: f.cluster.includes('Sultan') ? '#10b981' : 
                           f.cluster.includes('Value') ? '#3b82f6' : 
                           '#f59e0b',
                    border: `1px solid currentColor`,
                    textTransform: 'uppercase'
                  }}>
                    {f.cluster}
                  </span>
                )}
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

          <div className="ticker-split-layout">
            {/* Left Column Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {activeTab === 'ai' && (
                <>
                  {/* Technical Chart */}
                  <div className="card" style={{ padding: 0 }}>
                    {/* Chart Header */}
                    <div style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      flexWrap: 'wrap', gap: 10
                    }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>📈 Interactive Chart</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>
                          {tickerStr.replace('.JK', '')} · {chartPeriod.toUpperCase()} · {chartInterval}
                        </span>
                        {/* Last updated badge — tanggal candle terakhir dari Yahoo */}
                        {data?.technical?.last_updated && (() => {
                          const lu = formatLastUpdated(data.technical.last_updated)
                          return (
                            <span style={{ marginLeft: 10 }}>
                              <LastUpdatedBadge label={lu.label} sub={lu.sub} />
                            </span>
                          )
                        })()}
                      </div>

                      {/* Controls row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{
                          display: 'flex', gap: 3,
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8, padding: 3
                        }}>
                          {[
                            { label: '1M',  value: '1mo' },
                            { label: '3M',  value: '3mo' },
                            { label: '6M',  value: '6mo' },
                            { label: '1T',  value: '1y'  },
                            { label: '2T',  value: '2y'  },
                            { label: '3T',  value: '3y'  },
                            { label: '5T',  value: '5y'  },
                          ].map(p => (
                            <button
                              key={p.value}
                              onClick={() => handlePeriodChange(p.value)}
                              disabled={chartLoading}
                              style={{
                                padding: '5px 10px', borderRadius: 6, border: 'none',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                background: chartPeriod === p.value ? 'var(--accent)' : 'transparent',
                                color: chartPeriod === p.value ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.15s',
                                opacity: chartLoading ? 0.5 : 1,
                              }}
                            >{p.label}</button>
                          ))}
                        </div>

                        {/* Indicator toggles */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setShowMA(v => !v)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid',
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              borderColor: showMA ? '#3b82f6' : 'var(--border)',
                              background: showMA ? 'rgba(59,130,246,0.15)' : 'transparent',
                              color: showMA ? '#3b82f6' : 'var(--text-muted)',
                              transition: 'all 0.15s',
                            }}
                          >MA</button>
                          <button
                            onClick={() => setShowBB(v => !v)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid',
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              borderColor: showBB ? '#8b5cf6' : 'var(--border)',
                              background: showBB ? 'rgba(139,92,246,0.15)' : 'transparent',
                              color: showBB ? '#8b5cf6' : 'var(--text-muted)',
                              transition: 'all 0.15s',
                            }}
                          >BB</button>
                        </div>

                        {/* Download XLSX */}
                        <button
                          onClick={handleDownloadXLSX}
                          title="Download data sebagai Excel (.xlsx)"
                          style={{
                            padding: '5px 12px', borderRadius: 6,
                            border: '1px solid rgba(16,185,129,0.4)',
                            background: 'rgba(16,185,129,0.08)',
                            color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
                        >
                          ⬇ Excel
                        </button>

                        {/* Download PDF */}
                        <button
                          onClick={handleDownloadPDF}
                          title="Download laporan lengkap sebagai PDF"
                          style={{
                            padding: '5px 12px', borderRadius: 6,
                            border: '1px solid rgba(59,130,246,0.4)',
                            background: 'rgba(59,130,246,0.08)',
                            color: '#3b82f6', fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)' }}
                        >
                          📄 PDF
                        </button>
                      </div>
                    </div>

                    {/* Legend */}
                    <div style={{
                      padding: '8px 20px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', gap: 16, alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#10b981' }}>
                        <div style={{ width: 10, height: 3, background: '#10b981', borderRadius: 2 }} /> Naik
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#ef4444' }}>
                        <div style={{ width: 10, height: 3, background: '#ef4444', borderRadius: 2 }} /> Turun
                      </div>
                      {showMA && <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#3b82f6' }}>
                          <div style={{ width: 14, height: 2, background: '#3b82f6', borderRadius: 2 }} /> MA-20
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#f59e0b' }}>
                          <div style={{ width: 14, height: 2, background: '#f59e0b', borderRadius: 2 }} /> MA-50
                        </div>
                      </>}
                      {showBB && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8b5cf6' }}>
                          <div style={{ width: 14, height: 2, background: '#8b5cf6', borderRadius: 2, opacity: 0.7 }} /> Bollinger
                        </div>
                      )}
                      <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                        Vol ditampilkan di bawah
                      </div>
                    </div>

                    {/* Chart area */}
                    <div style={{ background: '#0d1424', position: 'relative' }}>
                      {chartLoading && (
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 10,
                          background: 'rgba(13,20,36,0.8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column', gap: 10
                        }}>
                          <div style={{ fontSize: 24 }}>⏳</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Memuat data {chartPeriod.toUpperCase()}...</div>
                        </div>
                      )}
                      <TechnicalChart
                        data={data.technical}
                        showMA={showMA}
                        showBB={showBB}
                        showVolume={true}
                      />
                    </div>
                  </div>

                  {/* Fundamental Stats Grid */}
                  <FundamentalTooltipProvider>
                  <CollapsibleCard id="fundamental" title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>📊 Fundamental & Market Statistics</span>
                      {data?.fundamental?.last_updated && (() => {
                        const lu = formatLastUpdated(data.fundamental.last_updated)
                        return <LastUpdatedBadge label={lu.label} sub={lu.sub} />
                      })()}
                    </div>
                  } collapsed={collapsed} onToggle={toggleCard}>
                    {/* ── Harga & Pasar ── */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Harga &amp; Pasar</div>
                    <div className="ticker-card-grid">
                      {[
                        { label: 'Nilai Pasar (Market Cap)',  val: formatMoney(f.price?.market_cap),  key: 'market_cap',  raw: null },
                        { label: 'Harga Pembuka (Open)',        val: f.price?.open ? `Rp ${f.price.open.toLocaleString('id-ID')}` : '—', key: 'open', raw: null },
                        { label: 'Harga Tertinggi Hari Ini',    val: f.price?.day_high ? `Rp ${f.price.day_high.toLocaleString('id-ID')}` : '—', key: 'day_high', raw: null, color: '#10b981' },
                        { label: 'Harga Terendah Hari Ini',     val: f.price?.day_low  ? `Rp ${f.price.day_low.toLocaleString('id-ID')}`  : '—', key: 'day_low',  raw: null, color: '#ef4444' },
                        { label: 'Harga Tertinggi 1 Tahun',    val: f.price?.week_52_high ? `Rp ${f.price.week_52_high.toLocaleString('id-ID')}` : '—', key: 'week_52_high', raw: null, color: '#10b981' },
                        { label: 'Harga Terendah 1 Tahun',     val: f.price?.week_52_low  ? `Rp ${f.price.week_52_low.toLocaleString('id-ID')}`  : '—', key: 'week_52_low',  raw: null, color: '#ef4444' },
                        { label: 'Volume Transaksi',      val: formatMoney(f.price?.volume),     key: 'volume',     raw: null },
                        { label: 'Rata-rata Volume',  val: formatMoney(f.price?.avg_volume), key: 'avg_volume', raw: null },
                      ].map((item, i) => (
                        <div key={i} className="stat-card" style={{ padding: 12 }}>
                          <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
                            {item.label}
                            <FundamentalTooltip metricKey={item.key} value={item.raw} label={item.label} />
                          </div>
                          <div className="stat-value" style={{ fontSize: 15, color: (item as any).color || undefined }}>{item.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* ── Valuasi & Pergerakan ── */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Valuasi &amp; Gejolak Pergerakan</div>
                    <div className="ticker-card-grid">
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>Kewajaran Harga (PBV) <FundamentalTooltip metricKey="pbv" value={f.valuation?.pbv} label="Kewajaran Harga (PBV)" /></div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.valuation?.pbv != null ? `${f.valuation.pbv}x` : '—'}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>Gejolak Harga vs IHSG (Beta) <FundamentalTooltip metricKey="beta" value={f.price?.beta} label="Gejolak Harga (Beta)" /></div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.price?.beta ?? '—'}</div>
                      </div>
                    </div>

                    {/* ── Profitabilitas & Kesehatan ── */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Kinerja Keuntungan &amp; Kesehatan Keuangan</div>
                    <div className="ticker-card-grid">
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>Untung dari Modal (ROE) <FundamentalTooltip metricKey="roe" value={f.profitability?.roe} label="Untung dari Modal (ROE)" /></div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.profitability?.roe != null ? `${(f.profitability.roe * 100).toFixed(2)}%` : '—'}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>Untung dari Aset (ROA) <FundamentalTooltip metricKey="roa" value={f.profitability?.roa} label="Untung dari Aset (ROA)" /></div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.profitability?.roa != null ? `${(f.profitability.roa * 100).toFixed(2)}%` : '—'}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>Persentase Untung Bersih (Net Margin) <FundamentalTooltip metricKey="net_margin" value={f.profitability?.net_margin} label="Persentase Untung Bersih (Net Margin)" /></div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.profitability?.net_margin != null ? `${(f.profitability.net_margin * 100).toFixed(2)}%` : '—'}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>Tingkat Utang vs Modal (DER) <FundamentalTooltip metricKey="der" value={f.health?.der} label="Tingkat Utang vs Modal (DER)" /></div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.health?.der ?? '—'}</div>
                      </div>
                    </div>

                    {/* ── Dividen ── */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Pembagian Keuntungan (Dividen)</div>
                    <div className="ticker-card-grid-nobottom">
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>Persentase Hasil Dividen (Yield) <FundamentalTooltip metricKey="div_yield" value={f.dividend?.yield_pct} label="Persentase Hasil Dividen (Yield)" /></div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.dividend?.yield_pct != null ? `${(f.dividend.yield_pct * 100).toFixed(2)}%` : '—'}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 10 }}>Porsi Laba untuk Dividen (Payout Ratio)</div>
                        <div className="stat-value" style={{ fontSize: 15 }}>{f.dividend?.payout_ratio != null ? `${(f.dividend.payout_ratio * 100).toFixed(1)}%` : '—'}</div>
                      </div>
                    </div>
                  </CollapsibleCard>
                  </FundamentalTooltipProvider>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <h3 className="section-title" style={{ fontSize: 16, margin: 0 }}>Laporan Laba Rugi (Tahunan)</h3>
                          {historyData?.last_updated && (() => {
                            const lu = formatLastUpdated(historyData.last_updated)
                            return <LastUpdatedBadge label={lu.label} sub={lu.sub} />
                          })()}
                        </div>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <h3 className="section-title" style={{ fontSize: 16, margin: 0 }}>Neraca Keuangan (Balance Sheet)</h3>
                          {historyData?.last_updated && (() => {
                            const lu = formatLastUpdated(historyData.last_updated)
                            return <LastUpdatedBadge label={lu.label} sub={lu.sub} />
                          })()}
                        </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 className="section-title" style={{ fontSize: 16, margin: 0 }}>Riwayat Pembagian Dividen</h3>
                    {historyData?.last_updated && (() => {
                      const lu = formatLastUpdated(historyData.last_updated)
                      return <LastUpdatedBadge label={lu.label} sub={lu.sub} />
                    })()}
                  </div>
                  {loadingHist ? (
                    <>
                      <Skeleton height={200} mb={24} />
                      <Skeleton height={40} mb={8} />
                      <Skeleton height={40} mb={8} />
                      <Skeleton height={40} />
                    </>
                  ) : historyData ? (
                    <>
                      {(historyData.dividend_history || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#888' }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>💤</div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>Tidak Ada Riwayat Dividen</div>
                          <div style={{ fontSize: 12 }}>Perusahaan ini tidak membagikan dividen atau data belum tersedia di Yahoo Finance.</div>
                        </div>
                      ) : (
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
                      )}
                    </>
                  ) : (
                    <div className="flex-center" style={{ height: 200 }}>
                      <p className="text-red">Data dividen tidak tersedia.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Technical Indicators Grid */}
              <FundamentalTooltipProvider>
              <CollapsibleCard id="tech-indicators" title="⚡ Technical Indicators" collapsed={collapsed} onToggle={toggleCard}>
                {(() => {
                  const ind = data.technical?.indicators
                  const rsi   = ind?.rsi?.slice(-1)[0]
                  const macd  = ind?.macd?.slice(-1)[0]
                  const macdSig = ind?.macd_signal?.slice(-1)[0]
                  const macdHist = ind?.macd_hist?.slice(-1)[0]
                  const ma20  = ind?.ma_20?.slice(-1)[0]
                  const ma50  = ind?.ma_50?.slice(-1)[0]
                  const bbUp  = ind?.bb_upper?.slice(-1)[0]
                  const bbMid = ind?.bb_mid?.slice(-1)[0]
                  const bbLow = ind?.bb_lower?.slice(-1)[0]

                  const fmt = (v: any) => v != null ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '—'
                  const fmtF = (v: any, d = 4) => v != null ? Number(v).toFixed(d) : '—'

                  const techItems = [
                    { key: 'rsi',  label: 'Kekuatan Tren Jenuh Beli/Jual (RSI)',      val: fmt(rsi),      raw: rsi,   color: '#3b82f6' },
                    { key: 'macd', label: 'Tren Pergerakan Harga (MACD)',          val: fmtF(macd),    raw: macd,  color: '#10b981' },
                    { key: 'macd', label: 'Sinyal Pemicu Tren (MACD Signal)',   val: fmtF(macdSig), raw: macdSig, color: '#f59e0b' },
                    { key: 'macd', label: 'Selisih Tren (MACD Histogram)',val: fmtF(macdHist),raw: macdHist,color: '#9333ea' },
                    { key: 'ma20', label: 'Harga Rata-rata 20 Hari (MA-20)',         val: `Rp ${fmt(ma20)}`, raw: null, color: '#2196F3' },
                    { key: 'ma50', label: 'Harga Rata-rata 50 Hari (MA-50)',         val: `Rp ${fmt(ma50)}`, raw: null, color: '#FF9800' },
                    { key: 'bb',   label: 'Batas Atas Rentang Harga (Bollinger Upper)',      val: `Rp ${fmt(bbUp)}`, raw: null, color: '#ef4444' },
                    { key: 'bb',   label: 'Batas Tengah Rentang Harga (Bollinger Mid)', val: `Rp ${fmt(bbMid)}`,raw: null, color: '#888' },
                    { key: 'bb',   label: 'Batas Bawah Rentang Harga (Bollinger Lower)',      val: `Rp ${fmt(bbLow)}`,raw: null, color: '#10b981' },
                  ]

                  return (
                    <div className="ticker-card-grid-3col">
                      {techItems.map((item, i) => (
                        <div key={i} className="stat-card" style={{ padding: 12, borderLeft: `3px solid ${item.color}` }}>
                          <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
                            {item.label}
                            <FundamentalTooltip metricKey={item.key} value={item.raw ?? null} label={item.label} />
                          </div>
                          <div className="stat-value" style={{ fontSize: 15, color: item.color }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CollapsibleCard>
              </FundamentalTooltipProvider>


            </div>

            {/* Right: AI & Trading */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* AI Score & SHAP */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(16,185,129,0.2)' }}>

                {/* ── Header gradient ── */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(59,130,246,0.12) 100%)',
                  borderBottom: '1px solid rgba(16,185,129,0.2)',
                  padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3 }}>🤖 AI Score Engine</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>XGBoost + SHAP Explainability</div>
                  </div>

                </div>

                <div style={{ padding: 20 }}>

                  {/* ── Gauge / Score Ring ── */}
                  {(() => {
                    const score = ai.ai_score ?? 0
                    const pct = Math.round(score * 100)
                    const radius = 52
                    const circ = 2 * Math.PI * radius
                    const dash = (pct / 100) * circ
                    const scoreColor = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
                    const scoreLabel = pct >= 60 ? 'Bullish Kuat' : pct >= 40 ? 'Netral' : 'Bearish'
                    const scoreBg = pct >= 60 ? 'rgba(16,185,129,0.1)' : pct >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'

                    // Deskripsi dinamis berdasarkan level score
                    const scoreDesc =
                      pct >= 70 ? 'Sinyal teknikal sangat kuat. Model AI mendeteksi momentum bullish tinggi dengan probabilitas kenaikan >5% dalam 5 hari ke depan.' :
                      pct >= 60 ? 'Sinyal teknikal cukup kuat. Momentum bullish terdeteksi, namun tetap perhatikan konfirmasi volume.' :
                      pct >= 50 ? 'Sinyal teknikal sedikit condong bullish. Belum ada momentum yang meyakinkan, pantau pergerakan selanjutnya.' :
                      pct >= 40 ? 'Sinyal teknikal netral. Pasar sedang konsolidasi, belum ada arah yang jelas.' :
                      pct >= 30 ? 'Sinyal teknikal sedikit condong bearish. Tekanan jual mulai terdeteksi, waspadai penurunan lebih lanjut.' :
                      'Sinyal teknikal bearish. Model AI mendeteksi tekanan jual dominan, risiko penurunan harga cukup tinggi.'

                    // Ambil nilai indikator teknikal terkini
                    const ind = data?.technical?.indicators
                    const rsi = ind?.rsi?.slice(-1)[0] ?? null
                    const macd = ind?.macd?.slice(-1)[0] ?? null
                    const macdSignal = ind?.macd_signal?.slice(-1)[0] ?? null
                    const ma20 = ind?.ma_20?.slice(-1)[0] ?? null
                    const ma50 = ind?.ma_50?.slice(-1)[0] ?? null
                    const close = data?.technical?.candles?.close?.slice(-1)[0] ?? null

                    // Interpretasi tiap indikator
                    const rsiSignal =
                      rsi === null ? null :
                      rsi >= 70 ? { label: 'Overbought', color: '#ef4444' } :
                      rsi <= 30 ? { label: 'Oversold', color: '#10b981' } :
                      rsi >= 55 ? { label: 'Bullish', color: '#10b981' } :
                      rsi <= 45 ? { label: 'Bearish', color: '#ef4444' } :
                      { label: 'Netral', color: '#f59e0b' }

                    const macdSignalStatus =
                      macd === null || macdSignal === null ? null :
                      macd > macdSignal ? { label: 'Bullish', color: '#10b981' } :
                      macd < macdSignal ? { label: 'Bearish', color: '#ef4444' } :
                      { label: 'Netral', color: '#f59e0b' }

                    const maStatus =
                      close === null || ma20 === null || ma50 === null ? null :
                      close > ma20 && close > ma50 ? { label: 'Di atas MA', color: '#10b981' } :
                      close < ma20 && close < ma50 ? { label: 'Di bawah MA', color: '#ef4444' } :
                      { label: 'Konsolidasi', color: '#f59e0b' }

                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                          {/* SVG Ring */}
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <svg width={130} height={130} style={{ transform: 'rotate(-90deg)' }}>
                              <circle cx={65} cy={65} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
                              <circle
                                cx={65} cy={65} r={radius} fill="none"
                                stroke={scoreColor} strokeWidth={10}
                                strokeDasharray={`${dash} ${circ}`}
                                strokeLinecap="round"
                                style={{ filter: `drop-shadow(0 0 6px ${scoreColor})`, transition: 'stroke-dasharray 1s ease' }}
                              />
                            </svg>
                            <div style={{
                              position: 'absolute', inset: 0,
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center'
                            }}>
                              <div style={{ fontSize: 26, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{pct}%</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Score</div>
                            </div>
                          </div>

                          {/* Score info */}
                          <div style={{ flex: 1 }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              background: scoreBg, border: `1px solid ${scoreColor}40`,
                              borderRadius: 8, padding: '5px 12px', marginBottom: 10
                            }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreColor, boxShadow: `0 0 6px ${scoreColor}` }} />
                              <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor }}>{scoreLabel}</span>
                            </div>
                            {/* Deskripsi dinamis — berbeda tiap saham sesuai score */}
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                              {scoreDesc}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                              Diperbarui: {ai.last_updated ? new Date(ai.last_updated).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </div>
                          </div>
                        </div>

                        {/* ── Mini Indikator Teknikal ── */}
                        <div className="ticker-card-grid-3col-mini">
                          {/* RSI */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>RSI (14)</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: rsiSignal?.color ?? 'var(--text-primary)' }}>
                              {rsi !== null ? rsi.toFixed(1) : '—'}
                            </div>
                            {rsiSignal && (
                              <div style={{
                                fontSize: 9, fontWeight: 700, marginTop: 3,
                                color: rsiSignal.color,
                                background: `${rsiSignal.color}18`,
                                borderRadius: 4, padding: '2px 6px',
                                display: 'inline-block'
                              }}>
                                {rsiSignal.label}
                              </div>
                            )}
                          </div>

                          {/* MACD */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>MACD</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: macdSignalStatus?.color ?? 'var(--text-primary)' }}>
                              {macd !== null ? macd.toFixed(2) : '—'}
                            </div>
                            {macdSignalStatus && (
                              <div style={{
                                fontSize: 9, fontWeight: 700, marginTop: 3,
                                color: macdSignalStatus.color,
                                background: `${macdSignalStatus.color}18`,
                                borderRadius: 4, padding: '2px 6px',
                                display: 'inline-block'
                              }}>
                                {macdSignalStatus.label}
                              </div>
                            )}
                          </div>

                          {/* MA Position */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>vs MA</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: maStatus?.color ?? 'var(--text-primary)' }}>
                              {close !== null ? `${close.toLocaleString()}` : '—'}
                            </div>
                            {maStatus && (
                              <div style={{
                                fontSize: 9, fontWeight: 700, marginTop: 3,
                                color: maStatus.color,
                                background: `${maStatus.color}18`,
                                borderRadius: 4, padding: '2px 6px',
                                display: 'inline-block'
                              }}>
                                {maStatus.label}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )
                  })()}

                  {/* ── Divider ── */}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '0 0 16px' }} />

                  {/* ── SHAP Title ── */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>🔍 SHAP Feature Importance</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Faktor yang paling mempengaruhi skor AI ini</div>
                  </div>

                  {/* ── SHAP Horizontal Bar Chart ── */}
                  <div style={{ marginBottom: 16 }}>
                    {(ai?.insights || []).map((ins: any, i: number) => {
                      const absMax = Math.max(...(ai?.insights || []).map((x: any) => Math.abs(x.contribution)))
                      const barPct = absMax > 0 ? (Math.abs(ins.contribution) / absMax) * 100 : 0
                      const isPos = ins.contribution > 0
                      const barColor = isPos ? '#10b981' : '#ef4444'
                      const indicators = data?.technical?.indicators
                      let rawValue: string | number = '—'
                      if (ins.feature === 'rsi_14') rawValue = indicators?.rsi?.slice(-1)[0] ?? '—'
                      if (ins.feature === 'ma_50_dist') rawValue = indicators?.ma_50?.slice(-1)[0] ?? '—'
                      if (ins.feature === 'ma_20_dist') rawValue = indicators?.ma_20?.slice(-1)[0] ?? '—'
                      if (ins.feature === 'macd_norm' || ins.feature === 'macd_hist_norm') rawValue = indicators?.macd?.slice(-1)[0] ?? '—'
                      if (ins.feature === 'bb_width' || ins.feature === 'bb_position') rawValue = indicators?.bb_upper?.slice(-1)[0] ?? '—'

                      return (
                        <div key={i} style={{ marginBottom: 14 }}>
                          {/* Label row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: barColor, boxShadow: `0 0 4px ${barColor}`
                              }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {FEATURE_LABELS[ins.feature] || ins.feature}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: barColor,
                                background: isPos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                padding: '2px 7px', borderRadius: 5
                              }}>
                                {isPos ? '▲' : '▼'} {isPos ? '+' : ''}{ins.contribution.toFixed(3)}
                              </span>
                            </div>
                          </div>
                          {/* Bar */}
                          <div style={{
                            height: 8, borderRadius: 4,
                            background: 'rgba(255,255,255,0.05)',
                            overflow: 'hidden', position: 'relative'
                          }}>
                            <div style={{
                              height: '100%', borderRadius: 4,
                              width: `${barPct}%`,
                              background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                              boxShadow: `0 0 8px ${barColor}60`,
                              transition: 'width 0.8s ease'
                            }} />
                          </div>
                          {/* Description */}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                            {ins.description}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Divider ── */}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '0 0 14px' }} />

                  {/* ── Signal Summary Cards ── */}
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Sinyal Teknikal Aktif
                  </div>
                  <div className="ticker-card-grid-2col-mini">
                    {(() => {
                      const ind = data?.technical?.indicators
                      const rsi = ind?.rsi?.slice(-1)[0]
                      const macd = ind?.macd?.slice(-1)[0]
                      const macdSig = ind?.macd_signal?.slice(-1)[0]
                      const ma20 = ind?.ma_20?.slice(-1)[0]
                      const cp = currentPrice

                      const signals = [
                        {
                          label: 'RSI (14)',
                          value: rsi ? rsi.toFixed(1) : '—',
                          signal: rsi ? (rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Normal') : '—',
                          color: rsi ? (rsi > 70 ? '#ef4444' : rsi < 30 ? '#10b981' : '#f59e0b') : '#94a3b8',
                          icon: rsi ? (rsi > 70 ? '🔴' : rsi < 30 ? '🟢' : '🟡') : '⚪'
                        },
                        {
                          label: 'MACD',
                          value: macd ? macd.toFixed(2) : '—',
                          signal: (macd && macdSig) ? (macd > macdSig ? 'Bullish Cross' : 'Bearish Cross') : '—',
                          color: (macd && macdSig) ? (macd > macdSig ? '#10b981' : '#ef4444') : '#94a3b8',
                          icon: (macd && macdSig) ? (macd > macdSig ? '📈' : '📉') : '⚪'
                        },
                        {
                          label: 'vs MA-20',
                          value: (cp && ma20) ? `${((cp - ma20) / ma20 * 100).toFixed(1)}%` : '—',
                          signal: (cp && ma20) ? (cp > ma20 ? 'Di Atas MA' : 'Di Bawah MA') : '—',
                          color: (cp && ma20) ? (cp > ma20 ? '#10b981' : '#ef4444') : '#94a3b8',
                          icon: (cp && ma20) ? (cp > ma20 ? '⬆️' : '⬇️') : '⚪'
                        },
                        {
                          label: 'Trend',
                          value: ai.ai_score >= 0.5 ? 'Bullish' : 'Bearish',
                          signal: `Score ${Math.round((ai.ai_score ?? 0) * 100)}%`,
                          color: (ai.ai_score ?? 0) >= 0.5 ? '#10b981' : '#ef4444',
                          icon: (ai.ai_score ?? 0) >= 0.5 ? '🚀' : '⚠️'
                        }
                      ]

                      return signals.map((s, i) => (
                        <div key={i} style={{
                          background: 'var(--bg-primary)',
                          border: `1px solid ${s.color}30`,
                          borderRadius: 10, padding: '10px 12px',
                          borderLeft: `3px solid ${s.color}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</span>
                            <span style={{ fontSize: 14 }}>{s.icon}</span>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: s.color, marginTop: 2, fontWeight: 600 }}>{s.signal}</div>
                        </div>
                      ))
                    })()}
                  </div>

                  {/* ── Disclaimer OJK ── */}
                  <div style={{
                    marginTop: 14, padding: '10px 12px',
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 8, fontSize: 10, color: '#f59e0b', lineHeight: 1.6
                  }}>
                    ⚠️ <strong>Bukan Saran Investasi.</strong> AI Score adalah output kalkulasi matematis algoritmik (XGBoost + SHAP) berdasarkan data historis teknikal. Bukan ajakan beli atau jual. Keputusan investasi sepenuhnya tanggung jawab pengguna.
                  </div>
                </div>
              </div>

              {/* Trading Module */}
              <div className="card" style={{ border: '1px solid rgba(16,185,129,0.3)', position: 'relative', overflow: 'hidden', padding: 0 }}>
                
                {/* Header */}
                <div style={{ 
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.1))',
                  borderBottom: '1px solid var(--border)',
                  padding: '14px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>📋 Transaksi Virtual</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Simulasi Virtual Trading</div>
                  </div>
                  <span style={{ 
                    background: 'var(--accent)', color: '#000',
                    fontSize: 10, fontWeight: 800, padding: '3px 10px',
                    borderRadius: 20, letterSpacing: 0.5
                  }}>VIRTUAL</span>
                </div>

                <div style={{ padding: 20 }}>

                  {/* Account Info */}
                  <div className="ticker-card-grid-2col-mini-spaced">
                    <div style={{ 
                      background: 'var(--bg-primary)', borderRadius: 10, padding: '12px 14px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>💵 Saldo Kas</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>
                        Rp {dbCash.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div style={{ 
                      background: 'var(--bg-primary)', borderRadius: 10, padding: '12px 14px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>📦 Kepemilikan</div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>
                        {dbHoldingShares > 0 ? `${(dbHoldingShares / 100).toFixed(0)} Lot` : '0 Lot'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {dbHoldingShares > 0 ? `${dbHoldingShares.toLocaleString()} lembar` : 'Belum punya'}
                      </div>
                    </div>
                  </div>

                  {/* Harga Pasar */}
                  <div className="ticker-trade-info">
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Harga Pasar Saat Ini</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                        Rp {currentPrice.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>52W Range</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {f.price?.week_52_low?.toLocaleString('id-ID')} – {f.price?.week_52_high?.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons to open popup */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button 
                      onClick={() => { setModalActionType('BUY'); setIsModalOpen(true); }}
                      style={{ 
                        width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 14, fontWeight: 800, cursor: 'pointer',
                        transition: 'all 0.2s', letterSpacing: 0.3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
                    >
                      📈 BELI SAHAM
                    </button>
                    <button 
                      onClick={() => { setModalActionType('SELL'); setIsModalOpen(true); }}
                      style={{ 
                        width: '100%', padding: '14px', borderRadius: 10,
                        border: '1px solid var(--red)', background: 'rgba(239,68,68,0.1)',
                        color: 'var(--red)', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                        transition: 'all 0.2s', letterSpacing: 0.3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = '#fff' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'var(--red)' }}
                    >
                      📉 JUAL SAHAM
                    </button>
                  </div>

                  <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                    ⚠️ Klik tombol untuk membuka menu transaksi
                  </p>
                </div>
              </div>

            </div>
          </div>
          <DisclaimerFooter />
        </div>
      </main>

      {/* Transaction Modal Popup */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ticker={f.ticker}
        companyName={f.name}
        actionType={modalActionType}
        currentPrice={currentPrice}
        balance={dbCash}
        holdingQty={dbHoldingShares}
        onConfirm={handleConfirmTrade}
        processing={tradeProcessing}
      />
      <style>{`
        .ticker-split-layout {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
          align-items: start;
        }
        .ticker-card-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        .ticker-card-grid-nobottom {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .ticker-card-grid-3col {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .ticker-card-grid-3col-mini {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(255,255,255,0.02);
          borderRadius: 10;
          border: 1px solid var(--border);
        }
        .ticker-card-grid-2col-mini {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .ticker-card-grid-2col-mini-spaced {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        .ticker-trade-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(16,185,129,0.06);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .ticker-split-layout {
            grid-template-columns: 1fr !important;
          }
          .ticker-card-grid, .ticker-card-grid-nobottom {
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important;
          }
          .ticker-card-grid-3col {
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important;
          }
          .ticker-card-grid-3col-mini {
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)) !important;
          }
          .ticker-card-grid-2col-mini, .ticker-card-grid-2col-mini-spaced {
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important;
          }
          .ticker-trade-info {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .ticker-trade-info > div:last-child {
            text-align: left !important;
          }
        }
      `}</style>
    </div>
  )
}
