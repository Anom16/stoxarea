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
        const sentiment = score > 0.25 ? 'Bullish' : score > 0.15 ? 'Neutral' : 'Bearish'

        return {
          ticker,
          name,
          sector,
          ai_score: score,
          ai_score_percent: percentStr,
          sentiment,
          current_price: Math.floor(1000 + Math.random() * 8000),
          is_qualified: true,
          roe: info.roe ?? 14.5,
          der: info.der ?? 0.85,
          pbv: info.pbv ?? 2.1,
          per: info.per ?? 12.8,
          sparkline: [score * 10, score * 12, score * 11, score * 14, score * 13, score * 15, score * 16]
        }
      })
      .filter(item => !targetSector || item.sector.toLowerCase() === targetSector.toLowerCase())
      .sort((a, b) => b.ai_score - a.ai_score)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }
}
