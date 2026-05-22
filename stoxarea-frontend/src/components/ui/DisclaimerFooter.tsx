/**
 * DisclaimerFooter — Pernyataan penting OJK
 *
 * Ditampilkan di bagian bawah setiap halaman yang menampilkan
 * hasil analisis AI atau data pasar saham.
 *
 * Tujuan: memenuhi prinsip kehati-hatian regulasi OJK terkait
 * penyebaran informasi pasar modal kepada publik.
 */
export default function DisclaimerFooter() {
  return (
    <footer style={{
      marginTop: 40,
      padding: '14px 18px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      fontSize: 10,
      color: 'var(--text-muted)',
      lineHeight: 1.8,
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>
        ⚠️ Pernyataan Penting &amp; Penafian (Disclaimer)
      </p>
      <p style={{ margin: 0 }}>
        StoxArea adalah platform analitik dan edukasi pasar modal berbasis kecerdasan buatan.
        Seluruh konten di platform ini — termasuk AI Score, Match Score, AI Watchlist, sinyal teknikal,
        dan hasil kalkulasi SAW — merupakan <strong style={{ color: 'var(--text-secondary)' }}>output
        matematis algoritmik</strong> yang dihasilkan secara otomatis berdasarkan data historis dan teknikal.
        Konten ini <strong style={{ color: 'var(--text-secondary)' }}>bukan merupakan saran, rekomendasi,
        ajakan, atau tawaran untuk membeli atau menjual efek</strong> dalam bentuk apapun.
        StoxArea tidak terdaftar sebagai Penasihat Investasi di Otoritas Jasa Keuangan (OJK).
        Investasi di pasar modal mengandung risiko, termasuk risiko kehilangan seluruh modal yang diinvestasikan.
        Pengguna bertanggung jawab penuh atas setiap keputusan investasi yang diambil.
        Selalu lakukan riset mandiri (<em>due diligence</em>) dan konsultasikan dengan penasihat keuangan
        berlisensi sebelum mengambil keputusan investasi.
      </p>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', opacity: 0.6 }}>
        © {new Date().getFullYear()} StoxArea · Data bersumber dari Yahoo Finance · Untuk keperluan edukasi
      </p>
    </footer>
  )
}
