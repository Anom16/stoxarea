'use client'
import { createChart, ColorType, IChartApi } from 'lightweight-charts'
import { useEffect, useRef } from 'react'

interface ChartProps {
  data: {
    ticker?: string
    dates: string[]
    candles: {
      open: number[]
      high: number[]
      low: number[]
      close: number[]
      volume?: number[]
    }
    indicators?: {
      ma_20?: number[]
      ma_50?: number[]
      rsi?: number[]
      macd?: number[]
      macd_signal?: number[]
      bb_upper?: number[]
      bb_lower?: number[]
      bb_mid?: number[]
    }
  }
  showVolume?: boolean
  showMA?: boolean
  showBB?: boolean
}

export default function TechnicalChart({ data, showVolume = true, showMA = true, showBB = false }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || !data?.dates?.length) return

    // Cleanup previous
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1424' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(16,185,129,0.4)', width: 1, style: 3 },
        horzLine: { color: 'rgba(16,185,129,0.4)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.28 : 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: 420,
    })
    chartRef.current = chart

    // ── Candlestick ──
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })
    // Sort ascending + deduplicate (lightweight-charts requirement)
    const seen = new Set<string>()
    const candleData = data.dates
      .map((date: string, i: number) => ({
        time: date as any,
        open: data.candles.open[i],
        high: data.candles.high[i],
        low: data.candles.low[i],
        close: data.candles.close[i],
      }))
      .filter((d: any) => {
        if (seen.has(d.time)) return false
        seen.add(d.time)
        return (
          d.open != null && d.high != null &&
          d.low  != null && d.close != null &&
          !isNaN(d.open) && !isNaN(d.high) &&
          !isNaN(d.low)  && !isNaN(d.close)
        )
      })
      .sort((a: any, b: any) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))

    if (candleData.length === 0) return
    candleSeries.setData(candleData)

    // Helper: build sorted, deduplicated line data
    const buildLine = (values: number[]) => {
      const seenL = new Set<string>()
      return data.dates
        .map((d: string, i: number) => ({ time: d as any, value: values[i] }))
        .filter((p: any) => {
          if (p.value == null || isNaN(p.value)) return false
          if (seenL.has(p.time)) return false
          seenL.add(p.time)
          return true
        })
        .sort((a: any, b: any) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    }

    // ── MA-20 ──
    if (showMA && data.indicators?.ma_20?.length) {
      const ma20 = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      ma20.setData(buildLine(data.indicators.ma_20))
    }

    // ── MA-50 ──
    if (showMA && data.indicators?.ma_50?.length) {
      const ma50 = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      ma50.setData(buildLine(data.indicators.ma_50))
    }

    // ── Bollinger Bands ──
    if (showBB && data.indicators?.bb_upper?.length) {
      const bbUpper = chart.addLineSeries({ color: 'rgba(139,92,246,0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 })
      const bbLower = chart.addLineSeries({ color: 'rgba(139,92,246,0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 })
      const bbMid   = chart.addLineSeries({ color: 'rgba(139,92,246,0.3)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 3 })
      bbUpper.setData(buildLine(data.indicators.bb_upper))
      bbLower.setData(buildLine(data.indicators.bb_lower ?? []))
      bbMid.setData(buildLine(data.indicators.bb_mid ?? []))
    }

    // ── Volume ──
    if (showVolume && data.candles.volume?.length) {
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      })
      const seenV = new Set<string>()
      const volData = data.dates
        .map((d: string, i: number) => ({
          time: d as any,
          value: data.candles.volume![i],
          color: data.candles.close[i] >= data.candles.open[i]
            ? 'rgba(16,185,129,0.35)'
            : 'rgba(239,68,68,0.35)',
        }))
        .filter((p: any) => {
          if (p.value == null || isNaN(p.value)) return false
          if (seenV.has(p.time)) return false
          seenV.add(p.time)
          return true
        })
        .sort((a: any, b: any) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
      volSeries.setData(volData)
    }

    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [data, showVolume, showMA, showBB])

  return <div ref={containerRef} style={{ width: '100%', height: 420 }} />
}
