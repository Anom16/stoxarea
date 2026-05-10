'use client'
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

interface ChartProps {
  data: {
    dates: string[];
    candles: {
      open: number[];
      high: number[];
      low: number[];
      close: number[];
    };
  };
}

export default function TechnicalChart({ data }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#161d2e' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1f2d45' },
        horzLines: { color: '#1f2d45' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });
    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const formattedData = data.dates.map((date, i) => ({
      time: date,
      open: data.candles.open[i],
      high: data.candles.high[i],
      low: data.candles.low[i],
      close: data.candles.close[i],
    }));

    candlestickSeries.setData(formattedData);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: 400 }} />;
}
