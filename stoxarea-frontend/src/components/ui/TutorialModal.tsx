'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    icon: '🎉',
    title: 'Selamat Datang di StoxArea!',
    content: `StoxArea adalah platform analitik dan edukasi pasar saham Indonesia berbasis kecerdasan buatan (AI). Di sini, Anda dapat menemukan saham terbaik yang paling sesuai dengan kepribadian investasi Anda.

Tutorial singkat ini akan memandu Anda memahami fitur-fitur utama dalam beberapa langkah.`,
    note: '⚠️ Disclaimer: StoxArea adalah platform edukasi. Seluruh analisis bukan merupakan saran investasi.',
  },
  {
    icon: '🛡️',
    title: 'Profil Risiko Investasi Anda',
    content: `Sistem kami menyesuaikan rekomendasi berdasarkan tipe investasi Anda:

🛡️ Konservatif — Fokus keamanan modal, hindari risiko tinggi. Cocok untuk saham blue-chip & dividen stabil.

⚖️ Moderat — Keseimbangan antara risiko & keuntungan. Pertumbuhan jangka menengah.

🚀 Agresif — Mengejar momentum & keuntungan maksimal. Siap hadapi fluktuasi tinggi.`,
    note: '💡 Ubah profil risiko kapan saja di menu Pengaturan → Profil Risiko.',
  },
  {
    icon: '📊',
    title: 'Dashboard — Pantau Pasar',
    content: `Halaman Dashboard adalah pusat informasi utama Anda:

• IHSG Overview — Pantau indeks pasar saham Indonesia secara real-time beserta grafik tren harian.

• AI Watchlist — Daftar saham terbaik yang paling cocok dengan profil risiko Anda, diurutkan dari yang paling sesuai.

• Market Movers — Saham dengan momentum tertinggi, terendah, dan volume terbesar hari ini.`,
    note: '💡 AI Watchlist diperbarui setiap hari kerja pukul 17:00 WIB.',
  },
  {
    icon: '🏆',
    title: 'AI Watchlist & Match Score',
    content: `Setiap saham di AI Watchlist memiliki dua skor penting:

🎯 Match Score — Seberapa cocok saham ini dengan profil risiko Anda (0–100%). Dihitung oleh metode SAW berdasarkan fundamental & AI Score.

🤖 AI Score — Kekuatan tren teknikal saham saat ini, diprediksi oleh algoritma Machine Learning (XGBoost).

Klik nama saham untuk melihat analisis lengkapnya!`,
    note: '💡 Klik ikon ⓘ di setiap metrik (ROE, DER, dll) untuk penjelasan lengkap indikator tersebut.',
  },
  {
    icon: '🔍',
    title: 'Jelajah Pasar',
    content: `Halaman Jelajah Pasar memungkinkan Anda menjelajahi seluruh saham IDX:

• Filter berdasarkan Sektor industri (Perbankan, Energi, Teknologi, dll).

• Lihat AI Score dan data fundamental ringkas semua emiten dalam satu tabel.

• Klik nama saham untuk langsung masuk ke halaman analisis detail.`,
    note: '💡 Gunakan filter sektor untuk fokus pada industri yang Anda minati.',
  },
  {
    icon: '📈',
    title: 'Analisis Detail Saham',
    content: `Halaman detail setiap saham menampilkan analisis lengkap:

• Grafik Teknikal interaktif dengan periode 1 minggu hingga 5 tahun.

• Indikator Fundamental (ROE, DER, PBV, Net Margin, dll) — klik ikon ⓘ untuk memahami artinya.

• AI Score & AI Momentum — prediksi tren berdasarkan Machine Learning.

• Laporan Keuangan & Riwayat Dividen perusahaan.`,
    note: '💡 Coba klik saham mana saja di Jelajah Pasar untuk melihat analisis detailnya.',
  },
  {
    icon: '💰',
    title: 'Virtual Trading — Berlatih Tanpa Risiko',
    content: `Virtual Trading adalah fitur simulasi investasi menggunakan saldo kas virtual:

• Saldo awal Rp 100.000.000 (tidak ada uang nyata yang digunakan).

• Beli & jual saham layaknya di pasar saham sungguhan, dengan harga real-time.

• Pantau portofolio virtual Anda: total nilai aset, keuntungan/kerugian, dan riwayat transaksi.`,
    note: '⚠️ Virtual Trading hanya untuk simulasi & edukasi. Tidak ada transaksi keuangan nyata.',
  },
  {
    icon: '✅',
    title: 'Anda Siap Memulai!',
    content: `Anda sudah memahami fitur-fitur utama StoxArea. Mulailah perjalanan investasi yang lebih cerdas!

📊 Dashboard — Pantau IHSG & AI Watchlist Anda.

🔍 Jelajah Pasar — Eksplorasi seluruh saham IDX.

💰 Virtual Trading — Latihan transaksi tanpa risiko.

⚙️ Pengaturan — Atur profil risiko & baca FAQ.`,
    note: '🎓 Ingin melihat tutorial ini lagi? Buka Pengaturan → Akun → Lihat Tutorial.',
  },
]

interface TutorialModalProps {
  onClose: () => void
}

export default function TutorialModal({ onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('stoxarea_tour_done', 'true')
    }
    onClose()
  }

  // Navigate to page WITHOUT closing the tutorial modal
  const handleNavigate = (href: string) => {
    router.push(href)
  }

  const handleNext = () => {
    if (isLast) { handleClose(); return }
    setStep(s => s + 1)
  }

  const handlePrev = () => setStep(s => Math.max(0, s - 1))

  if (typeof window === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 99998,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(540px, 94vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#0f172a',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 20,
          padding: '32px 32px 24px',
          zIndex: 99999,
          boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          animation: 'fadeIn 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Langkah {step + 1} dari {STEPS.length}
          </span>
          <button
            onClick={handleClose}
            title="Lewati Tutorial"
            style={{
              background: 'transparent', border: 'none', color: '#64748b',
              fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0,
            }}
          >×</button>
        </div>

        {/* Icon + Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12, lineHeight: 1 }}>{current.icon}</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.3 }}>
            {current.title}
          </h2>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Content */}
        <div style={{
          fontSize: 14, color: 'var(--text-secondary)',
          lineHeight: 1.9, whiteSpace: 'pre-line',
        }}>
          {current.content}
        </div>

        {/* Note */}
        <div style={{
          background: 'rgba(59,130,246,0.07)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10, padding: '10px 14px',
          fontSize: 12, color: '#93c5fd', lineHeight: 1.6,
        }}>
          {current.note}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 20 : 7,
                height: 7,
                borderRadius: 4,
                background: i === step ? '#10b981' : '#334155',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handlePrev}
            disabled={step === 0}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: step === 0 ? '#334155' : 'var(--text-secondary)',
              borderRadius: 10, padding: '10px 18px',
              fontSize: 13, fontWeight: 600,
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            ← Sebelumnya
          </button>

          <button
            onClick={handleNext}
            style={{
              background: isLast ? '#10b981' : 'var(--accent)',
              color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 22px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              flex: 1,
              transition: 'all 0.15s',
            }}
          >
            {isLast ? '✅ Mulai Gunakan StoxArea!' : 'Selanjutnya →'}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
