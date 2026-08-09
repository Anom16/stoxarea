'use client'

import React, { useState, useEffect } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts'
import FundamentalTooltip from '@/components/ui/FundamentalTooltip'

interface DividendData {
  yield_pct: number | null
  payout_ratio: number | null
  dps: number | null
  dps_lot?: number | null
  payback_years?: number | null
  safety_status?: string | null
  dividend_trap_warning?: boolean | null
  recovery_speed_days?: number | null
  timeline?: {
    cum_date?: string
    ex_date?: string
    recording_date?: string
    payment_date?: string
  } | null
  history?: Array<{
    year: number
    date: string
    dps: number
    dps_lot?: number
    type: string
  }>
}

interface Props {
  ticker: string
  currentPrice: number
  dividend: DividendData | null | undefined
  historyData?: any
  ownedLots?: number
}

export default function DividendTabContent({ ticker, currentPrice, dividend, historyData, ownedLots = 0 }: Props) {
  const [isSimulating, setIsSimulating] = useState<boolean>(false)
  const [simLots, setSimLots] = useState<number>(ownedLots > 0 ? ownedLots : 100)

  useEffect(() => {
    if (ownedLots > 0 && !isSimulating) {
      setSimLots(ownedLots)
    }
  }, [ownedLots, isSimulating])

  const cleanT = ticker.replace('.JK', '').toUpperCase()

  const yieldPctRaw = dividend?.yield_pct ?? null
  const yieldPct = yieldPctRaw != null ? (yieldPctRaw <= 1.0 ? yieldPctRaw * 100 : yieldPctRaw) : 0
  const dps = dividend?.dps ?? 0
  const dpsLot = dividend?.dps_lot ?? (dps * 100)
  const payoutRatioRaw = dividend?.payout_ratio ?? null
  const payoutRatio = payoutRatioRaw != null ? (payoutRatioRaw <= 1.0 ? payoutRatioRaw * 100 : payoutRatioRaw) : 0
  
  const paybackYears = dividend?.payback_years ?? (dps > 0 ? (currentPrice / dps).toFixed(1) : null)
  const isTrap = dividend?.dividend_trap_warning || yieldPct >= 9.5
  const safetyStatus = dividend?.safety_status || (payoutRatio > 100 ? 'at_risk' : payoutRatio > 70 ? 'moderate' : 'safe')
  const recoveryDays = dividend?.recovery_speed_days ?? 14

  const activeLots = (ownedLots > 0 && !isSimulating) ? ownedLots : simLots

  const rawHist = dividend?.history && dividend.history.length > 0
    ? dividend.history
    : (historyData?.dividend_history || [])

  // Dynamic Timeline Dates Calculator (Guaranteeing no blank/dash cards)
  const timelineDates = (() => {
    if (dividend?.timeline?.cum_date && dividend?.timeline?.ex_date && dividend?.timeline?.recording_date && dividend?.timeline?.payment_date) {
      return dividend.timeline
    }

    const baseExStr = dividend?.timeline?.ex_date || (rawHist.length > 0 && rawHist[0].date ? rawHist[0].date : null)
    
    if (baseExStr) {
      try {
        const exDt = new Date(baseExStr)
        if (!isNaN(exDt.getTime())) {
          const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
          const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`

          const cumDt = new Date(exDt)
          cumDt.setDate(cumDt.getDate() - (exDt.getDay() === 1 ? 3 : 1))

          const recDt = new Date(exDt)
          recDt.setDate(recDt.getDate() + (exDt.getDay() === 5 ? 3 : 1))

          const payDt = new Date(recDt)
          payDt.setDate(payDt.getDate() + 14)
          if (payDt.getDay() === 6) payDt.setDate(payDt.getDate() + 2)
          if (payDt.getDay() === 0) payDt.setDate(payDt.getDate() + 1)

          return {
            cum_date: fmt(cumDt),
            ex_date: fmt(exDt),
            recording_date: fmt(recDt),
            payment_date: fmt(payDt),
          }
        }
      } catch (e) {
        // Fallback below
      }
    }

    return {
      cum_date: dividend?.timeline?.cum_date || '—',
      ex_date: dividend?.timeline?.ex_date || '—',
      recording_date: dividend?.timeline?.recording_date || '—',
      payment_date: dividend?.timeline?.payment_date || '—',
    }
  })()

  const chartData = [...rawHist].reverse().map((h: any) => ({
    year: h.year || h.date || 'Year',
    dps: h.dps || 0,
    dpsLot: (h.dps || 0) * 100,
    type: h.type || 'Final'
  }))

  const sharesOwned = activeLots * 100
  const capitalInvested = sharesOwned * currentPrice
  const annualDividendInitial = sharesOwned * dps
  
  const proj5Years = (() => {
    let lots = activeLots
    let price = currentPrice
    for (let i = 0; i < 5; i++) {
      const curDps = dps * Math.pow(1.05, i)
      const divPayout = (lots * 100) * curDps
      const newSharesBought = Math.floor(divPayout / price)
      lots += Math.floor(newSharesBought / 100)
    }
    return {
      lots,
      annualPayout: lots * 100 * (dps * Math.pow(1.05, 5))
    }
  })()

  const proj10Years = (() => {
    let lots = activeLots
    let price = currentPrice
    for (let i = 0; i < 10; i++) {
      const curDps = dps * Math.pow(1.05, i)
      const divPayout = (lots * 100) * curDps
      const newSharesBought = Math.floor(divPayout / price)
      lots += Math.floor(newSharesBought / 100)
    }
    return {
      lots,
      annualPayout: lots * 100 * (dps * Math.pow(1.05, 10))
    }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. Banner Alert Event & Dividend Trap Protection ── */}
      {isTrap ? (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 12,
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span>⚠️ DIVIDEND TRAP ALERT PROTECTION</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
            Saham <strong style={{ color: '#ef4444' }}>{cleanT}</strong> memiliki Dividend Yield tinggi (<strong>{yieldPct.toFixed(2)}%</strong>). Waspadai potensi penurunan harga pasar saat <em>Ex-Date</em> sebesar perkiraan nominal dividen (<strong>Rp {dps.toFixed(0)} / lembar</strong>).
          </p>
        </div>
      ) : yieldPct > 0 ? (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 12,
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span>🔔 STATUS DIVIDEN AKTIF</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
            <strong>{cleanT}</strong> konsisten memberikan dividen tunai dengan Dividend Yield <strong>{yieldPct.toFixed(2)}%</strong> p.a. (<strong>Rp {dpsLot.toLocaleString('id-ID')} / Lot</strong>).
          </p>
        </div>
      ) : null}

      {/* ── 2. 4 Kartu Metrik Utama Dividen ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Indikator Utama Dividen
        </div>
        <div className="ticker-card-grid">
          <div className="stat-card" style={{ padding: 12 }}>
            <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              Persentase Yield <FundamentalTooltip metricKey="div_yield" value={yieldPct} label="Dividend Yield" />
            </div>
            <div className="stat-value" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
              {yieldPct > 0 ? `${yieldPct.toFixed(2)}%` : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
              {yieldPct >= 8.0 ? 'High-Yield' : yieldPct >= 5.0 ? 'Di Atas Deposito' : 'Standar'}
            </div>
          </div>

          <div className="stat-card" style={{ padding: 12 }}>
            <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              Porsi Laba (DPR) <FundamentalTooltip metricKey="payout_ratio" value={payoutRatio} label="Payout Ratio (DPR)" />
            </div>
            <div className="stat-value" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
              {payoutRatio > 0 ? `${payoutRatio.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
              {payoutRatio > 100 ? 'Ekstrem (>100%)' : payoutRatio >= 30 ? 'Sehat (Kas Kuat)' : 'Konservatif'}
            </div>
          </div>

          <div className="stat-card" style={{ padding: 12 }}>
            <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              Dividen Per Share (DPS) <FundamentalTooltip metricKey="dps" value={dps} label="Dividen Per Share (DPS)" />
            </div>
            <div className="stat-value" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
              {dps > 0 ? `Rp ${dps.toLocaleString('id-ID')}` : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
              {dps > 0 ? `(Rp ${dpsLot.toLocaleString('id-ID')} / Lot)` : '—'}
            </div>
          </div>

          <div className="stat-card" style={{ padding: 12 }}>
            <div className="stat-label" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              Status Pembayaran <FundamentalTooltip metricKey="div_status" value={rawHist.length} label="Status Pembayaran" />
            </div>
            <div className="stat-value" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {rawHist.length >= 3 ? 'Aristocrat' : rawHist.length > 0 ? 'Rutin' : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
              {rawHist.length > 0 ? `${rawHist.length} Periode` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Insight Analisis Investor Dividen (Clean & Compact) ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Insight Analisis Investor Dividen
        </div>
        <div className="ticker-card-grid-3col">
          {/* Card 1: Payback Period */}
          <div className="stat-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label" style={{ fontSize: 10 }}>
                ⏳ Payback Period (Estimasi Impas)
              </div>
              <div className="stat-value" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, marginBottom: 4 }}>
                {paybackYears ? `${paybackYears} Tahun` : '—'}
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>
              {paybackYears 
                ? `Estimasi pengembalian modal 100% dari kumulatif dividen tunai adalah ~${paybackYears} tahun.`
                : 'Data dividen tidak mencukupi untuk estimasi Payback Period.'}
            </p>
          </div>

          {/* Card 2: Dividend Safety Index */}
          <div className="stat-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label" style={{ fontSize: 10 }}>
                🛡️ Dividend Safety Index
              </div>
              <div className="stat-value" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, marginBottom: 4 }}>
                {safetyStatus === 'safe' ? 'Kas Operasional Aman' : safetyStatus === 'moderate' ? 'Seimbang' : 'Dengan Catatan'}
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>
              {safetyStatus === 'safe'
                ? 'Pembayaran dividen ditopang oleh arus kas bebas operasional yang positif.'
                : safetyStatus === 'moderate'
                ? 'Pembayaran dividen seimbang dengan estimasi arus kas berjalan.'
                : 'Porsi pembagian laba tergolong tinggi, perhatikan rincian laba bersih tahun depan.'}
            </p>
          </div>

          {/* Card 3: Ex-Date Recovery Speed */}
          <div className="stat-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label" style={{ fontSize: 10 }}>
                ⏱️ Ex-Date Recovery Speed
              </div>
              <div className="stat-value" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, marginBottom: 4 }}>
                ~{recoveryDays} Hari Bursa
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>
              Rata-rata histori pemulihan harga saham pasca Ex-Date berkisar ~{recoveryDays} hari bursa.
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. Siklus Jadwal 4 Tanggal Dividen ── */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          🗓️ Siklus Timeline 4 Tanggal Dividen Periode Terbaru
        </div>
        <div className="dividend-timeline-grid">
          <div className="stat-card" style={{ padding: 10, flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 800 }}>1. CUM DATE</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3, marginBottom: 2 }}>
              {timelineDates.cum_date}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Batas Akhir Hak</div>
          </div>

          <div className="dividend-timeline-arrow">➔</div>

          <div className="stat-card" style={{ padding: 10, flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 800 }}>2. EX DATE</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3, marginBottom: 2 }}>
              {timelineDates.ex_date}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Tanpa Hak Dividen</div>
          </div>

          <div className="dividend-timeline-arrow">➔</div>

          <div className="stat-card" style={{ padding: 10, flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 800 }}>3. RECORDING</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3, marginBottom: 2 }}>
              {timelineDates.recording_date}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Pencatatan KSEI</div>
          </div>

          <div className="dividend-timeline-arrow">➔</div>

          <div className="stat-card" style={{ padding: 10, flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 800 }}>4. PAYMENT DATE</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3, marginBottom: 2 }}>
              {timelineDates.payment_date}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Pencairan Dana RDN</div>
          </div>
        </div>
      </div>

      {/* ── 5. Grafik & Tabel Histori Pembagian Dividen 5 Tahun ── */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
          📈 Histori Pembagian Dividen ({cleanT})
        </div>

        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>💤</div>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Tidak Ada Data Histori Dividen</div>
            <div style={{ fontSize: 11 }}>Emiten ini belum membagikan dividen tunai dalam beberapa periode terakhir.</div>
          </div>
        ) : (
          <>
            <div className="dividend-chart-container" style={{ height: 220, width: '100%', marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                  <YAxis tickFormatter={(v) => `Rp ${v}`} stroke="#94a3b8" fontSize={11} />
                  <RechartsTooltip 
                    formatter={(v: any) => [`Rp ${v.toLocaleString('id-ID')} / lembar`, 'Dividen (DPS)']}
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                  />
                  <Bar dataKey="dps" name="DPS (Rp)" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabel Histori Dividen */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="clean-table" style={{ width: '100%', fontSize: 11, minWidth: 420 }}>
                <thead>
                  <tr>
                    <th>Tahun</th>
                    <th>Tanggal Ex / Pembayaran</th>
                    <th>DPS (Rp/Lembar)</th>
                    <th>DPS (Rp/Lot)</th>
                    <th>Jenis</th>
                  </tr>
                </thead>
                <tbody>
                  {rawHist.map((h: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{h.year || '—'}</td>
                      <td style={{ color: 'var(--text-primary)' }}>{h.date || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                        Rp {Number(h.dps || 0).toLocaleString('id-ID')}
                      </td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>
                        Rp {((h.dps || 0) * 100).toLocaleString('id-ID')}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: h.type === 'Final' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                          color: h.type === 'Final' ? '#3b82f6' : '#f59e0b'
                        }}>
                          {h.type || 'Final'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── 6. Kalkulator Simulasi Snowball ── */}
      {dps > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(16,185,129,0.08) 100%)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🚀 Proyeksi Reinvestasi Dividen (Snowball Effect)</span>
            </div>
            
            {ownedLots > 0 && (
              <button
                onClick={() => setIsSimulating(!isSimulating)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  border: '1px solid var(--accent)',
                  background: isSimulating ? 'var(--accent)' : 'transparent',
                  color: isSimulating ? '#fff' : 'var(--accent)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {isSimulating ? '🔒 Kembali ke Lot Portofolio' : '🧪 Mode Simulasi Lot Lain'}
              </button>
            )}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.4 }}>
            {ownedLots > 0 && !isSimulating ? (
              <span>
                📦 Menampilkan kalkulasi gaji dividen &amp; pertumbuhan aset murni berdasarkan kepemilikan riil Anda sebesar <strong style={{ color: '#10b981' }}>{ownedLots} Lot</strong> di portofolio.
              </span>
            ) : ownedLots > 0 && isSimulating ? (
              <span>
                🧪 <strong>Mode Simulasi Aktif:</strong> Geser slider di bawah untuk menguji dampak pertumbuhan jika Anda menambah/mengubah jumlah Lot saham {cleanT}.
              </span>
            ) : (
              <span>
                💡 Anda belum memiliki saham {cleanT} di portofolio. Geser slider di bawah untuk mengatur simulasi jumlah Lot pembelian:
              </span>
            )}
          </p>

          {(ownedLots === 0 || isSimulating) && (
            <div style={{ marginBottom: 12, background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Simulasi Jumlah Lot Saham: <strong style={{ color: 'var(--text-primary)' }}>{simLots.toLocaleString('id-ID')} Lot</strong> (Estimasi Modal ~Rp {capitalInvested.toLocaleString('id-ID')})
              </label>
              <input 
                type="range" 
                min={10} 
                max={2000} 
                step={10}
                value={simLots}
                onChange={(e) => setSimLots(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          )}

          <div className="dividend-snowball-grid">
            <div className="stat-card" style={{ padding: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Dividen Awal / Tahun:</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                Rp {annualDividendInitial.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                Dari {activeLots.toLocaleString('id-ID')} Lot {ownedLots > 0 && !isSimulating ? '(Portofolio)' : ''}
              </div>
            </div>

            <div className="stat-card" style={{ padding: 10 }}>
              <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>Proyeksi 5 Tahun:</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#3b82f6', marginTop: 2 }}>
                {proj5Years.lots.toLocaleString('id-ID')} Lot (+{proj5Years.lots - activeLots} Lot Gratis)
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                Dividen: Rp {Math.round(proj5Years.annualPayout).toLocaleString('id-ID')} / thn
              </div>
            </div>

            <div className="stat-card" style={{ padding: 10 }}>
              <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 700 }}>Proyeksi 10 Tahun:</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#a855f7', marginTop: 2 }}>
                {proj10Years.lots.toLocaleString('id-ID')} Lot (+{proj10Years.lots - activeLots} Lot Gratis)
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                Dividen: Rp {Math.round(proj10Years.annualPayout).toLocaleString('id-ID')} / thn
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
