import { NextResponse } from 'next/server'
import aiScores from '@/data/ai_scores.json'

export async function GET() {
  try {
    const recommendations = Object.entries(aiScores as Record<string, any>)
      .slice(0, 10)
      .map(([ticker, info], idx) => ({
        rank: idx + 1,
        ticker,
        ai_score: info.ai_score,
        ai_score_percent: info.ai_score_percent,
        saw_score: (info.ai_score * 0.8 + 0.15).toFixed(4),
        saw_score_percent: `${((info.ai_score * 0.8 + 0.15) * 100).toFixed(1)}%`,
        veto_passed: true,
        sentiment: info.ai_score > 0.25 ? 'Bullish' : 'Neutral'
      }))

    return NextResponse.json(recommendations)
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }
}
