import { NextResponse } from 'next/server'
import aiScores from '@/data/ai_scores.json'

const SECTORS_MAP: Record<string, string> = {
  'BBCA.JK': 'Financials', 'BBRI.JK': 'Financials', 'BMRI.JK': 'Financials', 'BBNI.JK': 'Financials', 'BRIS.JK': 'Financials', 'ARTO.JK': 'Financials', 'BBTN.JK': 'Financials', 'BDMN.JK': 'Financials', 'BJBR.JK': 'Financials', 'BJTM.JK': 'Financials',
  'ASII.JK': 'Consumer Cyclical', 'ACES.JK': 'Consumer Cyclical', 'MAPI.JK': 'Consumer Cyclical', 'ERAA.JK': 'Consumer Cyclical', 'AUTO.JK': 'Consumer Cyclical',
  'TLKM.JK': 'Infrastructure', 'ISAT.JK': 'Infrastructure', 'EXCL.JK': 'Infrastructure', 'TOWR.JK': 'Infrastructure', 'JSMR.JK': 'Infrastructure',
  'ADRO.JK': 'Energy', 'PGAS.JK': 'Energy', 'PTBA.JK': 'Energy', 'ITMG.JK': 'Energy', 'MEDC.JK': 'Energy', 'AKRA.JK': 'Energy', 'DOID.JK': 'Energy', 'ELSA.JK': 'Energy',
  'UNVR.JK': 'Consumer Non-Cyclical', 'ICBP.JK': 'Consumer Non-Cyclical', 'INDF.JK': 'Consumer Non-Cyclical', 'AMRT.JK': 'Consumer Non-Cyclical', 'MYOR.JK': 'Consumer Non-Cyclical', 'CPIN.JK': 'Consumer Non-Cyclical', 'JPFA.JK': 'Consumer Non-Cyclical',
  'ANTM.JK': 'Basic Materials', 'MDKA.JK': 'Basic Materials', 'TPIA.JK': 'Basic Materials', 'INKP.JK': 'Basic Materials', 'TKIM.JK': 'Basic Materials', 'INTP.JK': 'Basic Materials', 'SMGR.JK': 'Basic Materials',
  'KLBF.JK': 'Healthcare', 'MIKA.JK': 'Healthcare', 'HEAL.JK': 'Healthcare', 'SIDO.JK': 'Healthcare',
  'CTRA.JK': 'Real Estate', 'BSDE.JK': 'Real Estate', 'PWON.JK': 'Real Estate', 'SMRA.JK': 'Real Estate',
  'BUKA.JK': 'Technology', 'EMTK.JK': 'Technology', 'MTDL.JK': 'Technology',
}

const STOCK_NAMES: Record<string, string> = {
  'BBCA.JK': 'Bank Central Asia Tbk', 'BBRI.JK': 'Bank Rakyat Indonesia Tbk', 'BMRI.JK': 'Bank Mandiri Tbk', 'BBNI.JK': 'Bank Negara Indonesia Tbk', 'BRIS.JK': 'Bank Syariah Indonesia Tbk',
  'ASII.JK': 'Astra International Tbk', 'TLKM.JK': 'Telkom Indonesia Tbk', 'ADRO.JK': 'Adaro Energy Indonesia Tbk', 'PGAS.JK': 'Perusahaan Gas Negara Tbk', 'PTBA.JK': 'Bukit Asam Tbk',
  'UNVR.JK': 'Unilever Indonesia Tbk', 'ICBP.JK': 'Indofood CBP Sukses Makmur Tbk', 'INDF.JK': 'Indofood Sukses Makmur Tbk', 'ANTM.JK': 'Aneka Tambang Tbk', 'KLBF.JK': 'Kalbe Farma Tbk'
}

const KNOWN_PRICES: Record<string, number> = {
  'BBCA': 9850, 'BBRI': 5150, 'BMRI': 6650, 'BBNI': 5200, 'BRIS': 2950,
  'TLKM': 3850, 'ASII': 5050, 'ADRO': 3180, 'UNVR': 3100, 'ICBP': 11150,
  'INDF': 6800, 'ANTM': 1520, 'KLBF': 1480, 'PGAS': 1550, 'PTBA': 2450,
  'ITMG': 26800, 'MEDC': 1320, 'AMRT': 2850, 'MYOR': 2450, 'CPIN': 5100,
  'JPFA': 1250, 'MDKA': 2350, 'TPIA': 9250, 'INKP': 7800, 'TKIM': 6900,
  'INTP': 7100, 'SMGR': 3950, 'MIKA': 2800, 'HEAL': 1350, 'SIDO': 650,
  'CTRA': 1150, 'BSDE': 1050, 'PWON': 440, 'SMRA': 550, 'BUKA': 140,
  'EMTK': 450, 'MTDL': 620, 'ACES': 820, 'MAPI': 1450, 'ERAA': 430,
  'AUTO': 2100, 'ISAT': 10500, 'EXCL': 2250, 'TOWR': 780, 'JSMR': 4850,
  'AKRA': 1650, 'DOID': 610, 'ELSA': 480, 'ARTO': 2850, 'BBTN': 1320,
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const targetSector = searchParams.get('sector')

    const result = Object.entries(aiScores as Record<string, any>)
      .map(([ticker, info]) => {
        const sector = info.sector || SECTORS_MAP[ticker] || 'Keuangan'
        const name = info.name || STOCK_NAMES[ticker] || ticker.replace('.JK', '')
        const score = info.ai_score || 0
        const percentStr = info.ai_score_percent || `${(score * 100).toFixed(1)}%`
        const sentiment = score >= 0.085 ? 'Bullish' : score >= 0.060 ? 'Neutral' : 'Bearish'

        const cleanT = ticker.replace('.JK', '')
        const basePrice = KNOWN_PRICES[cleanT] || (500 + Math.abs(cleanT.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17) % 4500)

        const sparkline = sentiment === 'Bullish'
          ? [Math.round(basePrice * 0.94), Math.round(basePrice * 0.95), Math.round(basePrice * 0.945), Math.round(basePrice * 0.97), Math.round(basePrice * 0.965), Math.round(basePrice * 0.99), basePrice]
          : sentiment === 'Bearish'
          ? [Math.round(basePrice * 1.06), Math.round(basePrice * 1.05), Math.round(basePrice * 1.03), Math.round(basePrice * 1.04), Math.round(basePrice * 1.02), Math.round(basePrice * 1.01), basePrice]
          : [Math.round(basePrice * 0.98), Math.round(basePrice * 1.01), Math.round(basePrice * 0.99), Math.round(basePrice * 1.02), Math.round(basePrice * 0.98), Math.round(basePrice * 1.00), basePrice]

        return {
          ticker,
          name,
          sector,
          ai_score: score,
          ai_score_percent: percentStr,
          sentiment,
          current_price: basePrice,
          price: basePrice,
          is_qualified: true,
          roe: info.roe ?? 14.5,
          der: info.der ?? 0.85,
          pbv: info.pbv ?? 2.1,
          per: info.per ?? 12.8,
          sparkline
        }
      })
      .filter(item => !targetSector || item.sector.toLowerCase() === targetSector.toLowerCase())
      .sort((a, b) => b.ai_score - a.ai_score)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }
}
