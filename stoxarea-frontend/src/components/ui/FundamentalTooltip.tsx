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
  ai_score: {
    fullName: 'AI Momentum Score (Probabilitas Terkalibrasi)',
    description: 'Probabilitas statistik terkalibrasi murni (Isotonic Calibration) dari model XGBoost yang mengukur peluang saham tembus target ATR dalam 5 hari bursa. Karena baseline rata-rata bursa adalah 7.16%, nilai 8.5% ke atas sudah merupakan Sinyal Bullish (Top Momentum Bursa).',
    howToRead: [
      { range: '≥ 8.5%',   label: 'Bullish (Sinyal Kuat di Atas Baseline 7.16%)', color: '#10b981' },
      { range: '6.0–8.4%', label: 'Netral (Konsolidasi di Sekitar Rata-rata Bursa)', color: '#f59e0b' },
      { range: '< 6.0%',   label: 'Bearish (Tekanan Jual / Momentum Lemah)', color: '#ef4444' },
    ],
    spkRole: 'Kriteria Utama SPK — Skor AI terkalibrasi digunakan dalam matriks SAW untuk mengurutkan rekomendasi saham terbaik secara objektif.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      const pct = v > 1 ? v : v * 100
      if (pct >= 8.5) return { text: `Probabilitas AI ${pct.toFixed(1)}% — Bullish Kuat! Berada di atas baseline bursa (7.16%) dengan peluang momentum terbaik.`, color: '#10b981' }
      if (pct >= 6.0) return { text: `Probabilitas AI ${pct.toFixed(1)}% — Netral. Pergerakan saham berada di sekitar rata-rata bursa.`, color: '#f59e0b' }
      return { text: `Probabilitas AI ${pct.toFixed(1)}% — Bearish. Pergerakan saham di bawah rata-rata bursa dengan momentum lemah.`, color: '#ef4444' }
    },
  },
  roe: {
    fullName: 'Return on Equity (ROE) — Profit Modal',
    description: 'Mengukur seberapa jago manajemen perusahaan mencetak keuntungan dari setiap rupiah modal pemegang saham. Semakin tinggi angkanya, semakin efektif perusahaan dalam mencetak laba.',
    howToRead: [
      { range: '> 15%',  label: 'Sangat Bagus (Sangat Efisien)', color: '#10b981' },
      { range: '8–15%', label: 'Sedang / Wajar',                 color: '#f59e0b' },
      { range: '< 8%',   label: 'Kurang / Merugi',               color: '#ef4444' },
    ],
    spkRole: 'Kriteria Utama — Saham dengan ROE tinggi mendapatkan bobot nilai rekomendasi lebih tinggi dari sistem AI.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 15)  return { text: `ROE ${pct.toFixed(1)}% — Sangat Bagus. Perusahaan sangat pintar menghasilkan laba dari modal sendiri.`, color: '#10b981' }
      if (pct >= 8)  return { text: `ROE ${pct.toFixed(1)}% — Sedang / Wajar. Tingkat keuntungan modal cukup stabil.`, color: '#f59e0b' }
      if (pct >= 0)  return { text: `ROE ${pct.toFixed(1)}% — Kurang. Efisiensi modal tergolong rendah.`, color: '#ef4444' }
      return { text: `ROE ${pct.toFixed(1)}% — Merugi. Perusahaan sedang mengalami kerugian.`, color: '#ef4444' }
    },
  },
  der: {
    fullName: 'Debt to Equity Ratio (DER) — Beban Utang',
    description: 'Membandingkan total utang perusahaan dengan modal bersih yang dimiliki. Digunakan untuk melihat seberapa aman kondisi keuangan perusahaan dari risiko beban utang.',
    howToRead: [
      { range: '< 1.0x', label: 'Aman & Sehat (Utang Rendah)', color: '#10b981' },
      { range: '1–2.0x', label: 'Waspada (Utang Sedang)',      color: '#f59e0b' },
      { range: '> 2.0x', label: 'Berisiko (Utang Menumpuk)',   color: '#ef4444' },
    ],
    spkRole: 'Kriteria Keamanan — Semakin rendah utang (DER), semakin tinggi skor keamanan investasi yang diberikan AI.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v < 0)    return { text: `DER ${v.toFixed(2)}x — Ekuitas negatif. Total utang melebihi nilai aset perusahaan.`, color: '#ef4444' }
      if (v < 1.0)  return { text: `DER ${v.toFixed(2)}x — Aman. Beban utang sangat kecil dan risiko keuangan rendah.`, color: '#10b981' }
      if (v <= 2.0) return { text: `DER ${v.toFixed(2)}x — Waspada. Utang cukup besar, perhatikan kemampuan bayarnya.`, color: '#f59e0b' }
      return { text: `DER ${v.toFixed(2)}x — Berisiko. Beban utang sangat tinggi, rawan beban bunga.`, color: '#ef4444' }
    },
  },
  pbv: {
    fullName: 'Price to Book Value (PBV) — Kewajaran Harga',
    description: 'Membandingkan harga pasar saham dengan nilai aset bersih per lembar (nilai buku). Membantu mengetahui apakah harga saham murah (undervalued) atau mahal.',
    howToRead: [
      { range: '< 1.0x', label: 'Murah (Di Bawah Nilai Aset)', color: '#10b981' },
      { range: '1–3.0x', label: 'Wajar (Sesuai Nilai)',        color: '#f59e0b' },
      { range: '> 3.0x', label: 'Mahal (Harga Premium)',       color: '#ef4444' },
    ],
    spkRole: 'Kriteria Valuasi — Mencegah pembeli membayar terlalu mahal untuk saham yang asetnya kecil.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v <= 0)  return { text: `PBV ${v.toFixed(2)}x — Tidak valid / ekuitas negatif.`, color: '#ef4444' }
      if (v < 1.0) return { text: `PBV ${v.toFixed(2)}x — Murah. Harga di bawah nilai aset bersih perusahaan (potensi bargain).`, color: '#10b981' }
      if (v <= 3.0) return { text: `PBV ${v.toFixed(2)}x — Wajar. Harga mencerminkan nilai pasar secara seimbang.`, color: '#f59e0b' }
      return { text: `PBV ${v.toFixed(2)}x — Mahal. Harga saham sudah dinilai cukup tinggi di pasar.`, color: '#ef4444' }
    },
  },
  per: {
    fullName: 'Price to Earnings Ratio (PER) — Valuasi Laba',
    description: 'Mengukur berapa tahun waktu yang dibutuhkan dari laba perusahaan untuk mengembalikan harga beli saham. PER kecil artinya waktu kembalinya modal lebih cepat.',
    howToRead: [
      { range: '< 12x',  label: 'Murah (Waktu Kembali Cepat)', color: '#10b981' },
      { range: '12–25x', label: 'Wajar (Standar Pasar)',       color: '#f59e0b' },
      { range: '> 25x',  label: 'Mahal / Perusahaan Merugi',   color: '#ef4444' },
    ],
    spkRole: 'Filter Keamanan — Saham dengan PER negatif (rugi) atau mahal ekstrem disaring dari rekomendasi teratas.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v < 0)   return { text: `PER Negatif (${v.toFixed(1)}x) — Perusahaan sedang merugi.`, color: '#ef4444' }
      if (v < 12)  return { text: `PER ${v.toFixed(1)}x — Murah. Relatif lebih cepat mengembalikan harga pembelian via laba.`, color: '#10b981' }
      if (v <= 25) return { text: `PER ${v.toFixed(1)}x — Wajar. Berada pada rata-rata nilai industri.`, color: '#f59e0b' }
      return { text: `PER ${v.toFixed(1)}x — Mahal. Investor harus optimis akan pertumbuhan laba di masa depan.`, color: '#ef4444' }
    },
  },
  beta: {
    fullName: 'Beta — Gejolak Harga Saham',
    description: 'Mengukur seberapa sensitif atau liar pergerakan harga saham dibandingkan pergerakan pasar (IHSG). Beta 1 artinya saham bergerak seirama IHSG.',
    howToRead: [
      { range: '< 0.8',  label: 'Stabil & Tenang (Defensif)',   color: '#10b981' },
      { range: '0.8–1.2', label: 'Normal (Sejalan IHSG)',       color: '#f59e0b' },
      { range: '> 1.2',  label: 'Sangat Volatil (Fluktuatif)', color: '#ef4444' },
    ],
    spkRole: 'Pengukur Risiko — Digunakan untuk menyesuaikan kecocokan saham dengan Profil Risiko user (Konservatif/Agresif).',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v < 0)    return { text: `Beta ${v.toFixed(2)} — Pergerakan berlawanan arah dengan IHSG.`, color: '#f59e0b' }
      if (v < 0.8)  return { text: `Beta ${v.toFixed(2)} — Stabil & Tenang. Cocok untuk investor pemula/konservatif karena pergerakannya tenang.`, color: '#10b981' }
      if (v <= 1.2) return { text: `Beta ${v.toFixed(2)} — Normal. Bergerak searah dan seirama dengan IHSG.`, color: '#f59e0b' }
      return { text: `Beta ${v.toFixed(2)} — Fluktuatif. Gejolak harga tinggi (naik/turun cepat), cocok untuk agresif.`, color: '#ef4444' }
    },
  },
  div_yield: {
    fullName: 'Dividend Yield — Keuntungan Dividen',
    description: 'Persentase uang bagi hasil (dividen) yang diterima investor dibandingkan dengan harga saham saat ini.',
    howToRead: [
      { range: '> 5%',  label: 'Sangat Menarik (Bagi Hasil Besar)', color: '#10b981' },
      { range: '2–5%',  label: 'Cukup Bagus',                        color: '#f59e0b' },
      { range: '< 2%',  label: 'Kecil / Tidak Ada Dividen',          color: '#ef4444' },
    ],
    spkRole: 'Pendapatan Pasif — Memberikan nilai tambah bagi investor pencari dividen rutin.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      const pct = v > 1 ? v : v * 100
      if (pct === 0) return { text: 'Perusahaan tidak membagikan dividen.', color: '#ef4444' }
      if (pct > 5)   return { text: `Dividend Yield ${pct.toFixed(2)}% — Sangat Menarik! Memberikan hasil pasif di atas deposito.`, color: '#10b981' }
      if (pct >= 2)  return { text: `Dividend Yield ${pct.toFixed(2)}% — Cukup Bagus. Memberikan tambahan bagi hasil berkala.`, color: '#f59e0b' }
      return { text: `Dividend Yield ${pct.toFixed(2)}% — Hasil dividen tergolong kecil.`, color: '#ef4444' }
    },
  },
  roa: {
    fullName: 'Return on Assets (ROA) — Profit Aset',
    description: 'Mengukur efisiensi perusahaan dalam mengolah seluruh aset pabrik/mesin/kas menjadi laba bersih.',
    howToRead: [
      { range: '> 8%',   label: 'Sangat Efisien',  color: '#10b981' },
      { range: '3–8%',  label: 'Sedang / Wajar',   color: '#f59e0b' },
      { range: '< 3%',   label: 'Efisiensi Rendah', color: '#ef4444' },
    ],
    spkRole: 'Filter Kesehatan Operasional — Mengonfirmasi kelayakan aset operasional perusahaan.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 8)  return { text: `ROA ${pct.toFixed(1)}% — Sangat Efisien dalam mengolah aset menjadi laba.`, color: '#10b981' }
      if (pct >= 3) return { text: `ROA ${pct.toFixed(1)}% — Sedang / Wajar. Penggunaan aset mencukupi standar.`, color: '#f59e0b' }
      return { text: `ROA ${pct.toFixed(1)}% — Kurang Efisien. Penggunaan aset belum maksimal.`, color: '#ef4444' }
    },
  },
  net_margin: {
    fullName: 'Net Profit Margin — Margin Laba Bersih',
    description: 'Persentase sisa laba bersih dari total seluruh omzet jualan. Menunjukkan seberapa tahan perusahaan terhadap kenaikan biaya.',
    howToRead: [
      { range: '> 15%',  label: 'Margin Tebal (Sangat Bagus)', color: '#10b981' },
      { range: '5–15%', label: 'Margin Sedang',               color: '#f59e0b' },
      { range: '< 5%',   label: 'Margin Tipis / Merugi',       color: '#ef4444' },
    ],
    spkRole: 'Filter Kualitas Laba — Perusahaan dengan margin tebal lebih tahan terhadap krisis ekonomi.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 15) return { text: `Net Margin ${pct.toFixed(1)}% — Margin Tebal. Bisnis memiliki daya saing tinggi.`, color: '#10b981' }
      if (pct >= 5) return { text: `Net Margin ${pct.toFixed(1)}% — Margin Cukup. Sisa laba penjualan tergolong wajar.`, color: '#f59e0b' }
      return { text: `Net Margin ${pct.toFixed(1)}% — Margin Tipis. Rawan tergerus jika biaya operasional naik.`, color: '#ef4444' }
    },
  },

  // ── Pasar & Ukuran ────────────────────────────────────────────────────────
  market_cap: {
    fullName: 'Market Capitalization — Ukuran Perusahaan',
    description: 'Total nilai uang seluruh saham perusahaan di bursa. Menggambarkan skala besar kecilnya perusahaan.',
    howToRead: [
      { range: '> 50 Triliun',  label: 'Big Cap / Blue Chip (Sangat Stabil)', color: '#10b981' },
      { range: '10–50 Triliun', label: 'Mid Cap (Pertumbuhan Sedang)',        color: '#f59e0b' },
      { range: '< 10 Triliun',  label: 'Small Cap (Volatil / Berisiko)',      color: '#ef4444' },
    ],
    spkRole: 'Filter Keamanan — Perusahaan berukuran besar (Big Cap) cenderung lebih tahan banting terhadap gejolak pasar.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      const inTrillion = v / 1_000_000_000_000
      if (inTrillion >= 50) return { text: `Market Cap Rp ${inTrillion.toFixed(1)}T — Big Chip / Perusahaan Raksasa yang sangat stabil.`, color: '#10b981' }
      if (inTrillion >= 10) return { text: `Market Cap Rp ${inTrillion.toFixed(1)}T — Mid Cap. Perusahaan skala menengah dengan potensi tumbuh.`, color: '#f59e0b' }
      return { text: `Market Cap Rp ${inTrillion.toFixed(1)}T — Small Cap. Perusahaan skala kecil, harga relatif lebih lincah/fluktuatif.`, color: '#ef4444' }
    },
  },
  open: {
    fullName: 'Harga Pembukaan (Open)',
    description: 'Harga transaksi pertama saat pasar bursa dibuka pukul 09:00 WIB.',
    howToRead: [
      { range: 'Open > Penutupan Kemarin', label: 'Antusias Pembeli Tinggi (Bullish)', color: '#10b981' },
      { range: 'Open = Penutupan Kemarin', label: 'Stabil / Normal',                   color: '#f59e0b' },
      { range: 'Open < Penutupan Kemarin', label: 'Tekanan Jual Tinggi (Bearish)',     color: '#ef4444' },
    ],
    spkRole: 'Indikator Sentimen Awal Sesi.',
    getInterpretation: (v) => {
      if (v === null) return { text: 'Harga pembukaan pasar sesi ini. Menunjukkan patokan harga pertama transaksi.', color: '#3b82f6' }
      if (v > 0) return { text: `Harga saat ini +${v.toFixed(2)}% di atas harga pembukaan. Kekuatan pembeli mendominasi perdagangan.`, color: '#10b981' }
      if (v === 0) return { text: `Harga saat ini konsisten sama dengan harga pembukaan (Netral).`, color: '#f59e0b' }
      return { text: `Harga saat ini ${v.toFixed(2)}% di bawah harga pembukaan. Tekanan jual mendominasi sesi perdagangan.`, color: '#ef4444' }
    },
  },
  day_high: {
    fullName: 'Harga Tertinggi Hari Ini (Day High)',
    description: 'Titik harga tertinggi yang berhasil disentuh oleh saham sepanjang hari ini.',
    howToRead: [
      { range: 'Mendekati Day High', label: 'Daya Beli Sangat Kuat', color: '#10b981' },
      { range: 'Jauh di Bawah Peak',  label: 'Daya Beli Melemah',    color: '#ef4444' },
    ],
    spkRole: 'Pengukur Batas Atas Harian.',
    getInterpretation: (v) => {
      if (v === null) return { text: 'Batas harga tertinggi yang berhasil dicapai hari ini.', color: '#3b82f6' }
      if (v >= -1.0) return { text: `Harga saat ini sangat dekat dengan puncak tertinggi hari ini. Antusiasme pembeli sangat tinggi!`, color: '#10b981' }
      return { text: `Harga saat ini melandai ${v.toFixed(2)}% dari titik tertinggi hari ini.`, color: '#f59e0b' }
    },
  },
  day_low: {
    fullName: 'Harga Terendah Hari Ini (Day Low)',
    description: 'Titik harga terendah yang dialami saham selama perdagangan hari ini.',
    howToRead: [
      { range: 'Memantul dari Low', label: 'Penjualan Mereda / Rebound', color: '#10b981' },
      { range: 'Mendekati Low',     label: 'Tekanan Jual Masih Berat', color: '#ef4444' },
    ],
    spkRole: 'Pengukur Batas Bawah Harian.',
    getInterpretation: (v) => {
      if (v === null) return { text: 'Batas lantai harga terendah yang dialami hari ini.', color: '#3b82f6' }
      if (v > 2.0) return { text: `Harga telah memantul +${v.toFixed(2)}% dari lantai terendah hari ini. Tekanan jual mulai mereda.`, color: '#10b981' }
      return { text: `Harga berada dekat dengan lantai terendah hari ini. Masih ada tekanan jual.`, color: '#ef4444' }
    },
  },
  week_52_high: {
    fullName: 'Harga Tertinggi 1 Tahun (52W High)',
    description: 'Harga tertinggi yang pernah dicapai saham ini dalam rentang waktu 1 tahun terakhir (Resistensi Utama).',
    howToRead: [
      { range: 'Dekat Peak (< 10%)', label: 'Sinyal Tren Naik (Breakout)', color: '#10b981' },
      { range: 'Wajar (10–30%)',    label: 'Konsolidasi Normal',            color: '#f59e0b' },
      { range: 'Jauh (> 30%)',        label: 'Tertekan / Diskon Dalam',       color: '#ef4444' },
    ],
    spkRole: 'Acuan Momentum Jangka Panjang.',
    getInterpretation: (v) => {
      if (v === null) return { text: 'Tolak ukur batas atas tertinggi harga saham dalam 1 tahun terakhir.', color: '#3b82f6' }
      if (v >= -10.0) return { text: `Harga sangat dekat (${v.toFixed(1)}%) dengan rekor tertinggi 1 tahun. Potensi penguatan tren (Breakout)!`, color: '#10b981' }
      if (v >= -30.0) return { text: `Harga berada ${Math.abs(v).toFixed(1)}% di bawah puncak 1 tahun terakhir.`, color: '#f59e0b' }
      return { text: `Harga berada ${Math.abs(v).toFixed(1)}% di bawah puncak 1 tahun (Tertekan / Diskon).`, color: '#ef4444' }
    },
  },
  week_52_low: {
    fullName: 'Harga Terendah 1 Tahun (52W Low)',
    description: 'Harga terendah yang pernah dicapai saham dalam 1 tahun terakhir (Lantai Support Utama).',
    howToRead: [
      { range: 'Memantul jauh (> 30%)', label: 'Sudah Pulih (Recovery)', color: '#10b981' },
      { range: 'Area Beli (10–30%)',     label: 'Potensi Beli Murah',      color: '#f59e0b' },
      { range: 'Dekat dasar (< 10%)',   label: 'Risiko Penurunan',         color: '#ef4444' },
    ],
    spkRole: 'Acuan Batas Dasar Jangka Panjang.',
    getInterpretation: (v) => {
      if (v === null) return { text: 'Tolak ukur batas lantai terendah harga saham dalam 1 tahun terakhir.', color: '#3b82f6' }
      if (v > 30.0) return { text: `Harga sudah pulih memantul +${v.toFixed(1)}% dari titik terendah 1 tahun terakhir.`, color: '#10b981' }
      if (v >= 10.0) return { text: `Harga berjarak +${v.toFixed(1)}% di atas dasar terendah 1 tahun (Area Beli Wajar).`, color: '#f59e0b' }
      return { text: `Harga sangat dekat (+${v.toFixed(1)}%) dari lantai terendah 1 tahun. Waspadai risiko penurunan berlanjut.`, color: '#ef4444' }
    },
  },
  volume: {
    fullName: 'Volume Transaksi Harian',
    description: 'Jumlah lembar saham yang berhasil diperjualbelikan hari ini. Volume ramai menandakan minat pasar yang tinggi.',
    howToRead: [
      { range: 'Volume Ramai', label: 'Didukung Minat Pasar Tinggi', color: '#10b981' },
      { range: 'Volume Normal', label: 'Transaksi Stabil',           color: '#f59e0b' },
      { range: 'Volume Sepi',   label: 'Sepi Pembeli (Kurang Likuid)',color: '#ef4444' },
    ],
    spkRole: 'Konfirmasi Kekuatan Tren Harga.',
    getInterpretation: (v) => {
      if (v === null) return { text: 'Menunjukkan seberapa aktif transaksi jual-beli saham pada hari ini.', color: '#3b82f6' }
      if (v > 1.2) return { text: `Volume hari ini di atas rata-rata (+${((v - 1) * 100).toFixed(0)}%). Pergerakan harga didukung minat pasar yang kuat.`, color: '#10b981' }
      if (v >= 0.8) return { text: `Volume transaksi berada pada tingkat rata-rata normal.`, color: '#f59e0b' }
      return { text: `Volume transaksi tergolong sepi hari ini di bawah rata-rata.`, color: '#ef4444' }
    },
  },
  avg_volume: {
    fullName: 'Rata-rata Transaksi (Avg Volume)',
    description: 'Rata-rata kerapian transaksi harian saham. Memastikan Anda bisa menjual/membeli saham dengan mudah kapan saja.',
    howToRead: [
      { range: 'Ramai (> 1 Juta)', label: 'Sangat Mudah Diperdagangkan (Likuid)', color: '#10b981' },
      { range: 'Sedang (500rb–1Jt)',label: 'Cukup Mudah Diperdagangkan',            color: '#f59e0b' },
      { range: 'Sepi (< 500rb)',    label: 'Agak Sulit Dijual Cepat',                color: '#ef4444' },
    ],
    spkRole: 'Pengukur Kemudahan Transaksi.',
    getInterpretation: (v) => {
      if (v === null) return { text: 'Mengukurlikuiditas dan kemudahan mengeksekusi order jual/beli tanpa mempengaruhi harga secara drastis.', color: '#3b82f6' }
      if (v >= 1000000) return { text: `Rata-rata volume sangat ramai (${(v/1000000).toFixed(1)}Jt lembar/hari). Sangat likuid dan mudah ditransaksikan.`, color: '#10b981' }
      if (v >= 500000) return { text: `Rata-rata volume tergolong sedang (${(v/1000).toFixed(0)}rb lembar/hari). Transaksi cukup lancar.`, color: '#f59e0b' }
      return { text: `Rata-rata volume tergolong kecil. Perhatikan risiko likuiditas saat hendak menjual dalam jumlah besar.`, color: '#ef4444' }
    },
  },
  payout_ratio: {
    fullName: 'Dividend Payout Ratio — Proporsi Hasil Laba',
    description: 'Persentase laba bersih perusahaan yang disisihkan untuk dibagikan sebagai uang tunai ke pemegang saham.',
    howToRead: [
      { range: '30–60%',  label: 'Ideal & Sehat (Dividen Stabil)', color: '#10b981' },
      { range: '60–80%',  label: 'Cukup Besar',                    color: '#f59e0b' },
      { range: '> 80%',   label: 'Berisiko / Tidak Berkelanjutan', color: '#ef4444' },
    ],
    spkRole: 'Pengukur Keberlanjutan Dividen.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      const pct = v > 1 ? v : v * 100
      if (pct > 80) return { text: `Payout Ratio ${pct.toFixed(1)}% — Sangat Tinggi. Risiko pembagian dividen berkurang di tahun depan.`, color: '#ef4444' }
      if (pct >= 30) return { text: `Payout Ratio ${pct.toFixed(1)}% — Ideal & Sehat. Keseimbangan yang baik antara dividen dan modal ekspansi.`, color: '#10b981' }
      return { text: `Payout Ratio ${pct.toFixed(1)}% — Konservatif. Sebagian besar laba ditahan untuk ekspansi bisnis.`, color: '#f59e0b' }
    },
  },

  // ── Indikator Teknikal (Kalimat Informatif & Sederhana) ─────────────────────
  rsi: {
    fullName: 'RSI (Relative Strength Index) — Pengukur Kejenuhan Harga',
    description: 'Indikator untuk melihat apakah harga saham sudah terlalu murah karena terus dijual, atau sudah terlalu mahal karena terus dibeli.',
    howToRead: [
      { range: '< 30',   label: 'Sangat Murah / Jenuh Jual (Peluang Beli)',  color: '#10b981' },
      { range: '30–70',  label: 'Normal & Wajar (Tren Stabil)',              color: '#f59e0b' },
      { range: '> 70',   label: 'Sangat Mahal / Jenuh Beli (Waspada Koreksi)', color: '#ef4444' },
    ],
    spkRole: 'Sinyal Waktu Beli/Jual — Fitur utama model AI XGBoost dalam mendeteksi momentum pembalikan harga.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v <= 30) return { text: `RSI ${v.toFixed(1)} — Sangat Murah (Jenuh Jual). Sinyal positif: Harga sudah turun terlalu dalam, berpotensi memantul naik (Rebound).`, color: '#10b981' }
      if (v < 70)  return { text: `RSI ${v.toFixed(1)} — Normal. Harga bergerak dalam kisaran tren yang wajar.`, color: '#f59e0b' }
      return { text: `RSI ${v.toFixed(1)} — Sangat Mahal (Jenuh Beli). Sinyal waspada: Pembeli sudah mulai lelah, rawan penurunan harga (Koreksi).`, color: '#ef4444' }
    },
  },
  macd: {
    fullName: 'MACD — Pengarah Tren & Momentum Saham',
    description: 'Indikator penunjuk arah pergerakan harga. Membantu investor mengetahui apakah tren saham sedang menguat untuk naik atau menguat untuk turun.',
    howToRead: [
      { range: 'Garis Memotong Ke Atas', label: 'Sinyal Naik Kuat (Bullish)',  color: '#10b981' },
      { range: 'Garis Mendatar',         label: 'Pergerakan Netral / Wait & See', color: '#f59e0b' },
      { range: 'Garis Memotong Ke Bawah',label: 'Sinyal Turun (Bearish)',     color: '#ef4444' },
    ],
    spkRole: 'Penentu Arah Tren — Menjadi salah satu fitur teknikal penting dalam kalkulasi skor AI.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v > 0) return { text: `MACD Positif (+${v.toFixed(4)}) — Sinyal Naik Kuat. Tren saham didominasi oleh kekuatan pembeli (Bullish).`, color: '#10b981' }
      return { text: `MACD Negatif (${v.toFixed(4)}) — Sinyal Turun. Tren saham masih didominasi oleh tekanan jual (Bearish).`, color: '#ef4444' }
    },
  },
  ma20: {
    fullName: 'MA20 — Garis Tren 20 Hari (Jangka Pendek)',
    description: 'Garis rata-rata pergerakan harga saham selama 1 bulan (20 hari kerja). Jika harga saham berada di atas garis ini, tren jangka pendek tergolong positif.',
    howToRead: [
      { range: 'Harga di Atas MA20', label: 'Tren Pendek Naik (Bagus)', color: '#10b981' },
      { range: 'Harga Menempel MA20',label: 'Konsolidasi / Netral',     color: '#f59e0b' },
      { range: 'Harga di Bawah MA20',label: 'Tren Pendek Turun (Lemah)', color: '#ef4444' },
    ],
    spkRole: 'Pengukur Tren Jangka Pendek.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v > 0) return { text: `Di Atas MA20 (+${v.toFixed(2)}%) — Bagus! Harga bertahan di atas rata-rata 1 bulan, menandakan tren jangka pendek sedang naik.`, color: '#10b981' }
      if (v === 0) return { text: `Menempel MA20 — Harga tepat di rata-rata 1 bulan (Netral).`, color: '#f59e0b' }
      return { text: `Di Bawah MA20 (${v.toFixed(2)}%) — Lemah. Harga berada di bawah rata-rata 1 bulan, tren jangka pendek cenderung melemah.`, color: '#ef4444' }
    },
  },
  ma50: {
    fullName: 'MA50 — Garis Tren 50 Hari (Jangka Menengah)',
    description: 'Garis rata-rata pergerakan harga saham selama 2,5 bulan (50 hari kerja). Digunakan untuk melihat kekuatan tren harga saham jangka menengah.',
    howToRead: [
      { range: 'Harga di Atas MA50', label: 'Tren Menengah Naik (Bagus)', color: '#10b981' },
      { range: 'Harga Menempel MA50',label: 'Konsolidasi / Netral',        color: '#f59e0b' },
      { range: 'Harga di Bawah MA50',label: 'Tren Menengah Turun (Lemah)',color: '#ef4444' },
    ],
    spkRole: 'Pengukur Pondasi Tren Menengah.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v > 0) return { text: `Di Atas MA50 (+${v.toFixed(2)}%) — Bagus! Saham memiliki pondasi tren jangka menengah yang kuat untuk naik.`, color: '#10b981' }
      if (v === 0) return { text: `Menempel MA50 — Tren jangka menengah berada dalam fase konsolidasi.`, color: '#f59e0b' }
      return { text: `Di Bawah MA50 (${v.toFixed(2)}%) — Waspada. Tren jangka menengah saham ini masih cenderung melemah.`, color: '#ef4444' }
    },
  },
  bb: {
    fullName: 'Bollinger Bands (BB) — Pita Gejolak Harga',
    description: 'Pita pengukur batas atas dan batas bawah pergerakan harga. Saat pita menyempit, harga siap melonjak. Saat menembus pita atas/bawah, sinyal pembalikan arah.',
    howToRead: [
      { range: 'Menyentuh Pita Bawah', label: 'Peluang Beli / Rebound Naik', color: '#10b981' },
      { range: 'Di Dalam Pita',        label: 'Pergerakan Normal',            color: '#f59e0b' },
      { range: 'Menembus Pita Atas',   label: 'Jenuh Beli / Rawan Koreksi',   color: '#ef4444' },
    ],
    spkRole: 'Pengukur Volatilitas & Titik Pembalikan Harga.',
    getInterpretation: (v) => {
      if (v == null || typeof v !== 'number' || isNaN(v)) return null
      if (v < 0.2) return { text: `Menyentuh Pita Bawah (${v.toFixed(2)}) — Peluang Beli! Harga berada di batas terendah wajar, berpotensi memantul naik.`, color: '#10b981' }
      if (v <= 0.8) return { text: `Di Area Tengah (${v.toFixed(2)}) — Harga berada dalam rentang gejolak normal.`, color: '#f59e0b' }
      return { text: `Menembus Pita Atas (${v.toFixed(2)}) — Rawan Koreksi. Harga sudah terlalu tinggi melepasi batas atas wajar.`, color: '#ef4444' }
    },
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
                background: `${interp.color}18`,
                border: `1px solid ${interp.color}50`,
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  Interpretasi Nilai ({label || metricKey.toUpperCase()}):
                </div>
                <div style={{ fontSize: 13, color: interp.color, fontWeight: 700, lineHeight: 1.5 }}>
                  {interp.text}
                </div>
              </div>
            )}

            {/* Panduan Baca */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Panduan Indikator (Kategori Warna)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {info.howToRead.map((r, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10, 
                    background: `${r.color}15`, 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: `1px solid ${r.color}40` 
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0, boxShadow: `0 0 8px ${r.color}` }} />
                    <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 700, minWidth: 90 }}>{r.range}</span>
                    <span style={{ fontSize: 12, color: r.color, fontWeight: 700 }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Peran di SPK */}
            <div style={{
              background: 'rgba(0, 102, 255, 0.05)',
              border: '1px solid rgba(0, 102, 255, 0.15)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Peran dalam SPK
              </div>
              <div style={{ fontSize: 13, color: 'var(--accent)', lineHeight: 1.5, fontWeight: 600 }}>
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
