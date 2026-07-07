'use client'
import { useState, useEffect, useContext, createContext } from 'react'
import { createPortal } from 'react-dom'

// ── Context global agar hanya 1 tooltip bisa terbuka sekaligus ───────────────
const TooltipContext = createContext<{
  activeId: string | null
  setActiveId: (id: string | null) => void
}>({ activeId: null, setActiveId: () => {} })

export function FundamentalTooltipProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Tutup semua saat klik di luar semua tooltip
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-tooltip-root]') && !target.closest('[data-tooltip-portal]')) {
        setActiveId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <TooltipContext.Provider value={{ activeId, setActiveId }}>
      {children}
    </TooltipContext.Provider>
  )
}

// ── Definisi semua indikator fundamental ──────────────────────────────────────
interface MetricInfo {
  fullName: string
  description: string
  howToRead: { label: string; color: string; range: string }[]
  spkRole: string
  getInterpretation: (value: number | null) => { text: string; color: string } | null
}

export const METRIC_INFO: Record<string, MetricInfo> = {
  roe: {
    fullName: 'Return on Equity (ROE)',
    description: 'Mengukur seberapa efisien perusahaan menghasilkan laba bersih dari modal yang ditanamkan pemegang saham. Formula: Laba Bersih ÷ Total Ekuitas × 100%.',
    howToRead: [
      { range: '> 20%',  label: 'Sangat Baik',  color: '#10b981' },
      { range: '10-20%', label: 'Baik',          color: '#3b82f6' },
      { range: '5-10%',  label: 'Cukup',         color: '#f59e0b' },
      { range: '< 5%',   label: 'Kurang / Rugi', color: '#ef4444' },
    ],
    spkRole: 'Kriteria Benefit — semakin tinggi ROE, semakin besar bobotnya dalam ranking SAW. Mencerminkan kualitas manajemen.',
    getInterpretation: (v) => {
      if (v === null) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 20)  return { text: `${pct.toFixed(1)}% — Sangat baik. Perusahaan sangat efisien menghasilkan laba.`, color: '#10b981' }
      if (pct > 10)  return { text: `${pct.toFixed(1)}% — Baik. Profitabilitas di atas rata-rata.`, color: '#3b82f6' }
      if (pct > 5)   return { text: `${pct.toFixed(1)}% — Cukup. Profitabilitas rata-rata.`, color: '#f59e0b' }
      if (pct >= 0)  return { text: `${pct.toFixed(1)}% — Kurang. Profitabilitas rendah.`, color: '#ef4444' }
      return { text: `${pct.toFixed(1)}% — Negatif. Perusahaan sedang merugi.`, color: '#ef4444' }
    },
  },
  der: {
    fullName: 'Debt to Equity Ratio (DER)',
    description: 'Mengukur proporsi utang terhadap modal sendiri. Formula: Total Utang ÷ Total Ekuitas. Semakin tinggi, semakin besar ketergantungan pada utang.',
    howToRead: [
      { range: '< 0.5',  label: 'Sangat Sehat', color: '#10b981' },
      { range: '0.5–1',  label: 'Sehat',        color: '#3b82f6' },
      { range: '1–2',    label: 'Waspada',      color: '#f59e0b' },
      { range: '> 2',    label: 'Berisiko',     color: '#ef4444' },
    ],
    spkRole: 'Kriteria Cost — semakin rendah DER, semakin tinggi skornya dalam SAW. DER tinggi berisiko gagal bayar utang.',
    getInterpretation: (v) => {
      if (v === null) return null
      if (v < 0)    return { text: `${v.toFixed(2)}x — Ekuitas negatif. Utang melebihi total aset.`, color: '#ef4444' }
      if (v < 0.5)  return { text: `${v.toFixed(2)}x — Sangat sehat. Minim ketergantungan pada utang.`, color: '#10b981' }
      if (v < 1)    return { text: `${v.toFixed(2)}x — Sehat. Utang masih dalam batas wajar.`, color: '#3b82f6' }
      if (v < 2)    return { text: `${v.toFixed(2)}x — Waspada. Utang cukup besar.`, color: '#f59e0b' }
      return { text: `${v.toFixed(2)}x — Berisiko tinggi. Leverage sangat besar.`, color: '#ef4444' }
    },
  },
  pbv: {
    fullName: 'Price to Book Value (PBV)',
    description: 'Membandingkan harga saham dengan nilai buku per lembar. Formula: Harga Saham ÷ Nilai Buku per Lembar. Mengukur apakah saham mahal atau murah relatif terhadap aset bersihnya.',
    howToRead: [
      { range: '< 1',   label: 'Undervalued',  color: '#10b981' },
      { range: '1–2',   label: 'Wajar',        color: '#3b82f6' },
      { range: '2–4',   label: 'Premium',      color: '#f59e0b' },
      { range: '> 4',   label: 'Sangat Mahal', color: '#ef4444' },
    ],
    spkRole: 'Kriteria Cost — PBV rendah berarti saham relatif murah, mendapat skor lebih tinggi dalam SAW. Mencegah user membeli saham overvalued.',
    getInterpretation: (v) => {
      if (v === null) return null
      if (v <= 0)  return { text: `${v.toFixed(2)}x — Tidak valid. Kemungkinan ekuitas negatif.`, color: '#ef4444' }
      if (v < 1)   return { text: `${v.toFixed(2)}x — Undervalued. Harga di bawah nilai buku, potensi murah.`, color: '#10b981' }
      if (v < 2)   return { text: `${v.toFixed(2)}x — Valuasi wajar.`, color: '#3b82f6' }
      if (v < 4)   return { text: `${v.toFixed(2)}x — Premium. Investor percaya pertumbuhan tinggi.`, color: '#f59e0b' }
      return { text: `${v.toFixed(2)}x — Sangat mahal. Hati-hati risiko overvalued.`, color: '#ef4444' }
    },
  },
  per: {
    fullName: 'Price to Earnings Ratio (PER)',
    description: 'Mengukur berapa kali investor bersedia membayar untuk setiap rupiah laba yang dihasilkan. Formula: Harga Saham ÷ Laba Per Saham (EPS).',
    howToRead: [
      { range: '< 10x',  label: 'Murah',        color: '#10b981' },
      { range: '10–20x', label: 'Wajar',         color: '#3b82f6' },
      { range: '20–30x', label: 'Agak Mahal',   color: '#f59e0b' },
      { range: '> 30x',  label: 'Mahal',         color: '#ef4444' },
      { range: 'Negatif',label: 'Perusahaan Rugi', color: '#9333ea' },
    ],
    spkRole: 'Informasi valuasi. Digunakan sebagai referensi harga saham. Saham dengan PER negatif otomatis dikeluarkan dari rekomendasi.',
    getInterpretation: (v) => {
      if (v === null) return null
      if (v < 0)   return { text: `${v.toFixed(1)}x — Negatif. Perusahaan sedang merugi.`, color: '#9333ea' }
      if (v < 10)  return { text: `${v.toFixed(1)}x — Murah. Valuasi di bawah pasar.`, color: '#10b981' }
      if (v < 20)  return { text: `${v.toFixed(1)}x — Wajar. Sesuai rata-rata pasar.`, color: '#3b82f6' }
      if (v < 30)  return { text: `${v.toFixed(1)}x — Agak mahal.`, color: '#f59e0b' }
      return { text: `${v.toFixed(1)}x — Mahal. Ekspektasi pertumbuhan tinggi sudah terprice.`, color: '#ef4444' }
    },
  },
  beta: {
    fullName: 'Beta',
    description: 'Mengukur sensitivitas pergerakan saham terhadap pasar (IHSG). Beta = 1 artinya saham bergerak seiring IHSG. Beta > 1 lebih volatil, Beta < 1 lebih stabil.',
    howToRead: [
      { range: '< 0.5',   label: 'Sangat Stabil',   color: '#10b981' },
      { range: '0.5–1',   label: 'Defensif',         color: '#3b82f6' },
      { range: '1–1.5',   label: 'Agresif',          color: '#f59e0b' },
      { range: '> 1.5',   label: 'Sangat Volatil',   color: '#ef4444' },
    ],
    spkRole: 'Informasi risiko. Digunakan untuk memahami volatilitas saham, terutama relevan untuk profil Konservatif yang menghindari saham berisiko.',
    getInterpretation: (v) => {
      if (v === null) return null
      if (v < 0)    return { text: `${v.toFixed(2)} — Bergerak berlawanan dengan IHSG (langka).`, color: '#9333ea' }
      if (v < 0.5)  return { text: `${v.toFixed(2)} — Sangat stabil, kurang sensitif terhadap IHSG.`, color: '#10b981' }
      if (v < 1)    return { text: `${v.toFixed(2)} — Lebih stabil dari IHSG. Cocok investor defensif.`, color: '#3b82f6' }
      if (v < 1.5)  return { text: `${v.toFixed(2)} — Lebih volatil dari IHSG.`, color: '#f59e0b' }
      return { text: `${v.toFixed(2)} — Sangat volatil. High risk, high return.`, color: '#ef4444' }
    },
  },
  div_yield: {
    fullName: 'Dividend Yield',
    description: 'Persentase dividen yang dibagikan terhadap harga saham. Formula: Dividen per Lembar ÷ Harga Saham × 100%. Mengukur return dari dividen saja.',
    howToRead: [
      { range: '> 5%',  label: 'Sangat Menarik', color: '#10b981' },
      { range: '3–5%',  label: 'Menarik',        color: '#3b82f6' },
      { range: '1–3%',  label: 'Cukup',          color: '#f59e0b' },
      { range: '< 1%',  label: 'Rendah',         color: '#94a3b8' },
      { range: '0%',    label: 'Tidak Berdividen', color: '#64748b' },
    ],
    spkRole: 'Informasi pendapatan pasif. Relevan untuk investor yang mengutamakan dividen rutin (umumnya profil Konservatif).',
    getInterpretation: (v) => {
      if (v === null) return null
      const pct = v > 1 ? v : v * 100
      if (pct === 0)  return { text: 'Tidak membagikan dividen.', color: '#64748b' }
      if (pct > 5)    return { text: `${pct.toFixed(2)}% — Sangat menarik untuk investor dividen.`, color: '#10b981' }
      if (pct > 3)    return { text: `${pct.toFixed(2)}% — Yield menarik.`, color: '#3b82f6' }
      if (pct > 1)    return { text: `${pct.toFixed(2)}% — Yield cukup.`, color: '#f59e0b' }
      return { text: `${pct.toFixed(2)}% — Yield sangat rendah.`, color: '#94a3b8' }
    },
  },
  roa: {
    fullName: 'Return on Assets (ROA)',
    description: 'Mengukur efisiensi perusahaan dalam menggunakan seluruh asetnya untuk menghasilkan laba. Formula: Laba Bersih ÷ Total Aset × 100%.',
    howToRead: [
      { range: '> 10%',  label: 'Sangat Baik', color: '#10b981' },
      { range: '5–10%',  label: 'Baik',        color: '#3b82f6' },
      { range: '2–5%',   label: 'Cukup',       color: '#f59e0b' },
      { range: '< 2%',   label: 'Rendah',      color: '#ef4444' },
    ],
    spkRole: 'Informasi efisiensi aset. Melengkapi analisis ROE. ROA rendah tapi ROE tinggi bisa mengindikasikan leverage tinggi.',
    getInterpretation: (v) => {
      if (v === null) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 10)  return { text: `${pct.toFixed(1)}% — Sangat efisien menggunakan aset.`, color: '#10b981' }
      if (pct > 5)   return { text: `${pct.toFixed(1)}% — Penggunaan aset yang baik.`, color: '#3b82f6' }
      if (pct > 2)   return { text: `${pct.toFixed(1)}% — Cukup efisien.`, color: '#f59e0b' }
      if (pct >= 0)  return { text: `${pct.toFixed(1)}% — Efisiensi aset rendah.`, color: '#ef4444' }
      return { text: `${pct.toFixed(1)}% — Negatif, perusahaan merugi.`, color: '#ef4444' }
    },
  },
  net_margin: {
    fullName: 'Net Profit Margin',
    description: 'Persentase laba bersih dari total pendapatan. Formula: Laba Bersih ÷ Total Pendapatan × 100%. Mengukur seberapa banyak dari setiap rupiah pendapatan yang berhasil menjadi laba.',
    howToRead: [
      { range: '> 20%',   label: 'Sangat Baik', color: '#10b981' },
      { range: '10–20%',  label: 'Baik',        color: '#3b82f6' },
      { range: '5–10%',   label: 'Cukup',       color: '#f59e0b' },
      { range: '< 5%',    label: 'Tipis',       color: '#ef4444' },
    ],
    spkRole: 'Informasi profitabilitas. Margin tipis bisa berarti bisnis sangat kompetitif atau biaya tinggi. Berguna untuk analisis kualitas laba.',
    getInterpretation: (v) => {
      if (v === null) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 20)  return { text: `${pct.toFixed(1)}% — Margin sangat tebal.`, color: '#10b981' }
      if (pct > 10)  return { text: `${pct.toFixed(1)}% — Margin bagus.`, color: '#3b82f6' }
      if (pct > 5)   return { text: `${pct.toFixed(1)}% — Margin cukup.`, color: '#f59e0b' }
      if (pct >= 0)  return { text: `${pct.toFixed(1)}% — Margin sangat tipis.`, color: '#ef4444' }
      return { text: `${pct.toFixed(1)}% — Margin negatif (rugi).`, color: '#ef4444' }
    },
  },

  // ── Harga & Pasar ─────────────────────────────────────────────────────────
  market_cap: {
    fullName: 'Market Capitalization (Kapitalisasi Pasar)',
    description: 'Total nilai pasar seluruh saham yang beredar. Formula: Harga Saham × Jumlah Saham Beredar. Mengukur ukuran dan skala perusahaan.',
    howToRead: [
      { range: '> 100T',  label: 'Big Cap (Blue Chip)', color: '#10b981' },
      { range: '10–100T', label: 'Mid Cap',             color: '#3b82f6' },
      { range: '< 10T',   label: 'Small Cap',           color: '#f59e0b' },
    ],
    spkRole: 'Informasi skala perusahaan. Saham big cap umumnya lebih stabil dan likuid.',
    getInterpretation: () => null,
  },
  open: {
    fullName: 'Harga Pembukaan (Open)',
    description: 'Harga pertama transaksi pada sesi perdagangan hari ini saat pasar dibuka pukul 09:00 WIB.',
    howToRead: [
      { range: 'Open > Close kemarin', label: 'Gap Up (Bullish)', color: '#10b981' },
      { range: 'Open < Close kemarin', label: 'Gap Down (Bearish)', color: '#ef4444' },
      { range: 'Open = Close kemarin', label: 'Flat Open', color: '#f59e0b' },
    ],
    spkRole: 'Informasi harga intraday. Berguna untuk mengukur sentimen awal sesi perdagangan.',
    getInterpretation: () => null,
  },
  day_high: {
    fullName: 'Harga Tertinggi Hari Ini (Day High)',
    description: 'Harga tertinggi yang dicapai saham selama sesi perdagangan hari ini. Mencerminkan batas atas tekanan beli pada hari ini.',
    howToRead: [
      { range: 'Mendekati 52W High', label: 'Momentum Kuat',   color: '#10b981' },
      { range: 'Jauh dari 52W High', label: 'Masih Ada Ruang', color: '#3b82f6' },
    ],
    spkRole: 'Informasi volatilitas harian. Jarak antara Day High dan Day Low menunjukkan range pergerakan harga.',
    getInterpretation: () => null,
  },
  day_low: {
    fullName: 'Harga Terendah Hari Ini (Day Low)',
    description: 'Harga terendah yang dicapai saham selama sesi perdagangan hari ini. Mencerminkan batas bawah tekanan jual pada hari ini.',
    howToRead: [
      { range: 'Dekat Day Low saat ini', label: 'Tekanan Jual Tinggi', color: '#ef4444' },
      { range: 'Jauh dari Day Low',      label: 'Sudah Rebound',       color: '#10b981' },
    ],
    spkRole: 'Bersama Day High, membentuk range harian yang menggambarkan volatilitas intraday.',
    getInterpretation: () => null,
  },
  week_52_high: {
    fullName: '52 Week High (Tertinggi 52 Minggu)',
    description: 'Harga tertinggi yang pernah dicapai saham dalam 52 minggu (1 tahun) terakhir. Merupakan level resistensi psikologis penting.',
    howToRead: [
      { range: 'Harga dekat 52W High', label: 'Mendekati Resistensi', color: '#f59e0b' },
      { range: 'Harga = 52W High',     label: 'Breakout / All-Time',  color: '#10b981' },
      { range: 'Harga jauh di bawah',  label: 'Jauh dari Puncak',     color: '#ef4444' },
    ],
    spkRole: 'Level teknikal penting. Saham yang menembus 52W High sering menjadi sinyal momentum kuat.',
    getInterpretation: () => null,
  },
  week_52_low: {
    fullName: '52 Week Low (Terendah 52 Minggu)',
    description: 'Harga terendah yang pernah dicapai saham dalam 52 minggu (1 tahun) terakhir. Merupakan level support psikologis penting.',
    howToRead: [
      { range: 'Harga dekat 52W Low',  label: 'Dekat Support Kuat',  color: '#3b82f6' },
      { range: 'Harga = 52W Low',      label: 'Menyentuh Bottom',    color: '#ef4444' },
      { range: 'Harga jauh di atas',   label: 'Sudah Recovery',      color: '#10b981' },
    ],
    spkRole: 'Level support 52 minggu. Saham yang memantul dari 52W Low bisa menjadi peluang beli bagi value investor.',
    getInterpretation: () => null,
  },
  volume: {
    fullName: 'Volume Perdagangan Harian',
    description: 'Jumlah lembar saham yang diperdagangkan pada hari ini. Volume tinggi mengkonfirmasi kekuatan pergerakan harga.',
    howToRead: [
      { range: 'Volume > Avg Volume × 1.5', label: 'Volume Tinggi (Konfirmasi)',  color: '#10b981' },
      { range: 'Volume = Avg Volume',       label: 'Volume Normal',               color: '#3b82f6' },
      { range: 'Volume < Avg Volume × 0.5', label: 'Volume Rendah (Lemah)',       color: '#f59e0b' },
    ],
    spkRole: 'Konfirmasi tren. Volume tinggi saat harga naik = sinyal bullish kuat.',
    getInterpretation: () => null,
  },
  avg_volume: {
    fullName: 'Rata-rata Volume (Average Volume)',
    description: 'Rata-rata jumlah lembar saham yang diperdagangkan per hari dalam periode tertentu (biasanya 20–30 hari). Digunakan sebagai baseline perbandingan volume harian.',
    howToRead: [
      { range: 'Avg > 1 Juta/hari',  label: 'Sangat Likuid',   color: '#10b981' },
      { range: '500rb–1 Juta/hari',  label: 'Likuid',          color: '#3b82f6' },
      { range: '< 500rb/hari',       label: 'Kurang Likuid',   color: '#f59e0b' },
    ],
    spkRole: 'Ukuran likuiditas. Saham dengan avg volume tinggi lebih mudah dibeli/dijual tanpa menggerakkan harga.',
    getInterpretation: () => null,
  },
  payout_ratio: {
    fullName: 'Payout Ratio',
    description: 'Persentase laba bersih yang dibagikan sebagai dividen. Formula: Dividen per Lembar ÷ EPS × 100%. Mengukur kebijakan distribusi laba perusahaan.',
    howToRead: [
      { range: '30–60%',   label: 'Sehat & Berkelanjutan', color: '#10b981' },
      { range: '60–80%',   label: 'Agresif',               color: '#f59e0b' },
      { range: '> 80%',    label: 'Tidak Berkelanjutan',   color: '#ef4444' },
      { range: '< 30%',    label: 'Konservatif',           color: '#3b82f6' },
    ],
    spkRole: 'Payout ratio yang terlalu tinggi (>80%) mengindikasikan dividen mungkin tidak bisa dipertahankan jika laba turun.',
    getInterpretation: (v) => {
      if (v === null) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 80)  return { text: `${pct.toFixed(1)}% — Sangat tinggi. Dividen mungkin tidak berkelanjutan.`, color: '#ef4444' }
      if (pct > 60)  return { text: `${pct.toFixed(1)}% — Agresif. Perlu diperhatikan.`, color: '#f59e0b' }
      if (pct > 30)  return { text: `${pct.toFixed(1)}% — Sehat. Keseimbangan baik antara dividen dan reinvestasi.`, color: '#10b981' }
      return { text: `${pct.toFixed(1)}% — Konservatif. Sebagian besar laba diinvestasikan kembali.`, color: '#3b82f6' }
    },
  },

  // ── Teknikal ─────────────────────────────────────────────────────────────
  rsi: {
    fullName: 'Relative Strength Index (RSI)',
    description: 'Oscillator momentum yang mengukur kecepatan dan perubahan pergerakan harga pada skala 0–100. Dikembangkan oleh J. Welles Wilder (1978).',
    howToRead: [
      { range: '> 70',   label: 'Overbought (Jenuh Beli)',  color: '#ef4444' },
      { range: '55–70',  label: 'Bullish',                  color: '#10b981' },
      { range: '45–55',  label: 'Netral',                   color: '#f59e0b' },
      { range: '30–45',  label: 'Bearish',                  color: '#ef4444' },
      { range: '< 30',   label: 'Oversold (Jenuh Jual)',    color: '#10b981' },
    ],
    spkRole: 'Salah satu dari 11 fitur teknikal yang digunakan model XGBoost untuk menghasilkan AI Score.',
    getInterpretation: (v) => {
      if (v === null) return null
      if (v >= 70) return { text: `RSI ${v.toFixed(1)} — Overbought. Harga mungkin akan koreksi.`, color: '#ef4444' }
      if (v >= 55) return { text: `RSI ${v.toFixed(1)} — Bullish. Momentum naik masih kuat.`, color: '#10b981' }
      if (v >= 45) return { text: `RSI ${v.toFixed(1)} — Netral. Tidak ada sinyal jelas.`, color: '#f59e0b' }
      if (v >= 30) return { text: `RSI ${v.toFixed(1)} — Bearish. Momentum turun.`, color: '#ef4444' }
      return { text: `RSI ${v.toFixed(1)} — Oversold. Harga mungkin akan rebound.`, color: '#10b981' }
    },
  },
  macd: {
    fullName: 'MACD (Moving Average Convergence Divergence)',
    description: 'Indikator tren yang menunjukkan hubungan antara dua Exponential Moving Average. MACD = EMA(12) − EMA(26). Dikembangkan oleh Gerald Appel (1979).',
    howToRead: [
      { range: 'MACD > Signal',  label: 'Bullish Cross',  color: '#10b981' },
      { range: 'MACD < Signal',  label: 'Bearish Cross',  color: '#ef4444' },
      { range: 'Histogram naik', label: 'Momentum Kuat',  color: '#10b981' },
      { range: 'Histogram turun',label: 'Momentum Lemah', color: '#ef4444' },
    ],
    spkRole: 'MACD dan turunannya (Signal, Histogram) adalah 3 dari 11 fitur yang digunakan model XGBoost.',
    getInterpretation: (v) => {
      if (v === null) return null
      if (v > 0) return { text: `MACD positif (${v.toFixed(4)}) — Tren naik mendominasi.`, color: '#10b981' }
      return { text: `MACD negatif (${v.toFixed(4)}) — Tren turun mendominasi.`, color: '#ef4444' }
    },
  },
  ma20: {
    fullName: 'Moving Average 20 Hari (MA20)',
    description: 'Rata-rata harga penutupan 20 hari terakhir. Digunakan untuk mengidentifikasi tren jangka pendek. Harga di atas MA20 = bullish jangka pendek.',
    howToRead: [
      { range: 'Harga > MA20', label: 'Di Atas (Bullish)',  color: '#10b981' },
      { range: 'Harga = MA20', label: 'Menyentuh (Pivot)',  color: '#f59e0b' },
      { range: 'Harga < MA20', label: 'Di Bawah (Bearish)', color: '#ef4444' },
    ],
    spkRole: 'Jarak harga terhadap MA20 adalah salah satu dari 11 fitur input model XGBoost.',
    getInterpretation: () => null,
  },
  ma50: {
    fullName: 'Moving Average 50 Hari (MA50)',
    description: 'Rata-rata harga penutupan 50 hari terakhir. Digunakan untuk mengidentifikasi tren menengah. Lebih lambat bereaksi dari MA20.',
    howToRead: [
      { range: 'Harga > MA50', label: 'Tren Menengah Naik',   color: '#10b981' },
      { range: 'MA20 > MA50',  label: 'Golden Cross (Bullish)', color: '#10b981' },
      { range: 'MA20 < MA50',  label: 'Death Cross (Bearish)',  color: '#ef4444' },
    ],
    spkRole: 'Jarak harga terhadap MA50 adalah salah satu dari 11 fitur input model XGBoost.',
    getInterpretation: () => null,
  },
  bb: {
    fullName: 'Bollinger Bands (BB)',
    description: 'Pita volatilitas yang terdiri dari MA20 ± 2 standar deviasi. Ketika pita menyempit (BB Width kecil), biasanya akan terjadi pergerakan besar (breakout).',
    howToRead: [
      { range: 'Harga > BB Upper',  label: 'Overbought / Breakout Atas',  color: '#ef4444' },
      { range: 'Harga di tengah',   label: 'Normal',                       color: '#3b82f6' },
      { range: 'Harga < BB Lower',  label: 'Oversold / Breakout Bawah',   color: '#10b981' },
      { range: 'BB Width menyempit',label: 'Squeeze — Volatilitas Rendah', color: '#f59e0b' },
    ],
    spkRole: 'BB Width dan BB Position adalah 2 dari 11 fitur input model XGBoost.',
    getInterpretation: () => null,
  },
}

// ── Komponen Utama ────────────────────────────────────────────────────────────

interface Props {
  metricKey: string
  value: number | null
  displayValue?: string
  label?: string
}

export default function FundamentalTooltip({ metricKey, value, displayValue, label }: Props) {
  const { activeId, setActiveId } = useContext(TooltipContext)
  // ID unik per instance: metricKey sudah cukup karena satu halaman tidak pakai key sama 2x
  const id = metricKey
  const open = activeId === id

  const info = METRIC_INFO[metricKey]
  if (!info) return null

  const interp = info.getInterpretation(value)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation() // cegah event naik ke document handler
    setActiveId(open ? null : id)
  }

  return (
    <div data-tooltip-root style={{ position: 'relative', display: 'inline-block' }}>
      {/* Tombol ⓘ */}
      <button
        onClick={toggle}
        title={`Penjelasan ${info.fullName}`}
        style={{
          background: open ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${open ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '50%',
          width: 16, height: 16,
          fontSize: 9, fontWeight: 800,
          color: open ? '#3b82f6' : '#94a3b8',
          cursor: 'pointer', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', padding: 0, flexShrink: 0,
        }}
      >
        i
      </button>

      {/* Popup — dirender ke document.body via Portal agar tidak terpotong parent */}
      {open && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop blur transparan */}
          <div
            onClick={(e) => { e.stopPropagation(); setActiveId(null) }}
            style={{
              position: 'fixed', inset: 0,
              zIndex: 99998,
              background: 'rgba(0,0,0,0.15)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          {/* Modal di tengah layar */}
          <div
            data-tooltip-portal=""
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: typeof window !== 'undefined' && window.innerWidth < 540 ? '90vw' : 500,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#1e293b',
              border: '1px solid rgba(59,130,246,0.4)',
              borderRadius: 14,
              padding: 24,
              zIndex: 99999,
              boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
              transition: 'all 0.15s',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
                {info.fullName}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveId(null) }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#94a3b8', 
                  cursor: 'pointer', 
                  fontSize: 22, 
                  lineHeight: 1, 
                  padding: 0, 
                  marginLeft: 12,
                  fontWeight: 'bold',
                }}
              >
                ×
              </button>
            </div>

            {/* Deskripsi */}
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 16px' }}>
              {info.description}
            </p>

            {/* Interpretasi nilai saham ini */}
            {interp && (
              <div style={{
                background: `${interp.color}15`,
                border: `1px solid ${interp.color}40`,
                borderRadius: 8, padding: '10px 12px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                  Nilai {label || metricKey.toUpperCase()} saham ini:
                </div>
                <div style={{ fontSize: 13, color: interp.color, fontWeight: 700 }}>
                  {interp.text}
                </div>
              </div>
            )}

            {/* Panduan Baca */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Panduan Baca
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {info.howToRead.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: r.color, fontWeight: 600, minWidth: 70 }}>{r.range}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Peran di SPK */}
            <div style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Peran dalam SPK
              </div>
              <div style={{ fontSize: 13, color: '#10b981', lineHeight: 1.5 }}>
                {info.spkRole}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
