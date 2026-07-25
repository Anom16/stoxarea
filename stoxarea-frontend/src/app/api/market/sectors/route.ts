import { NextResponse } from 'next/server'
import aiScores from '@/data/ai_scores.json'

const SECTORS_MAP: Record<string, string> = {
  'BBCA.JK': 'Financials', 'BBRI.JK': 'Financials', 'BMRI.JK': 'Financials', 'BBNI.JK': 'Financials', 'BRIS.JK': 'Financials', 'ARTO.JK': 'Financials', 'BBTN.JK': 'Financials',
  'ASII.JK': 'Consumer Cyclical', 'ACES.JK': 'Consumer Cyclical', 'MAPI.JK': 'Consumer Cyclical', 'ERAA.JK': 'Consumer Cyclical',
  'TLKM.JK': 'Infrastructure', 'ISAT.JK': 'Infrastructure', 'EXCL.JK': 'Infrastructure', 'TOWR.JK': 'Infrastructure',
  'ADRO.JK': 'Energy', 'PGAS.JK': 'Energy', 'PTBA.JK': 'Energy', 'ITMG.JK': 'Energy', 'MEDC.JK': 'Energy',
  'UNVR.JK': 'Consumer Non-Cyclical', 'ICBP.JK': 'Consumer Non-Cyclical', 'INDF.JK': 'Consumer Non-Cyclical', 'AMRT.JK': 'Consumer Non-Cyclical',
  'ANTM.JK': 'Basic Materials', 'MDKA.JK': 'Basic Materials', 'TPIA.JK': 'Basic Materials', 'INKP.JK': 'Basic Materials',
  'KLBF.JK': 'Healthcare', 'MIKA.JK': 'Healthcare', 'HEAL.JK': 'Healthcare',
  'CTRA.JK': 'Real Estate', 'BSDE.JK': 'Real Estate', 'PWON.JK': 'Real Estate',
  'BUKA.JK': 'Technology', 'EMTK.JK': 'Technology'
}

export async function GET() {
  try {
    const counts: Record<string, number> = {}
    Object.keys(aiScores).forEach(ticker => {
      const sector = SECTORS_MAP[ticker] || 'Financials'
      counts[sector] = (counts[sector] || 0) + 1
    })

    const sectors = Object.entries(counts).map(([sector, total_stocks]) => ({
      sector,
      total_stocks
    }))

    return NextResponse.json(sectors)
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }
}
