'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, type IChartApi, ColorType } from 'lightweight-charts';
import { useTheme } from 'next-themes';
import type { PricePoint } from '@/lib/types/market';

interface PriceChartProps {
  coinId: string;
}

const TIME_RANGES = [
  { label: '24h', days: '1' },
  { label: '7d', days: '7' },
  { label: '30d', days: '30' },
  { label: '90d', days: '90' },
  { label: '1y', days: '365' },
];

/**
 * Interactive price chart using Lightweight Charts
 * @param coinId - CoinGecko coin ID to display chart for
 */
export function PriceChart({ coinId }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [activeDays, setActiveDays] = useState('7');
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = theme === 'dark';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#a1a1aa' : '#71717a',
      },
      grid: {
        vertLines: { color: isDark ? '#27272a' : '#e4e4e7' },
        horzLines: { color: isDark ? '#27272a' : '#e4e4e7' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: isDark ? '#27272a' : '#e4e4e7',
      },
      rightPriceScale: {
        borderColor: isDark ? '#27272a' : '#e4e4e7',
      },
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#6366f1',
      topColor: 'rgba(99, 102, 241, 0.4)',
      bottomColor: 'rgba(99, 102, 241, 0.0)',
      lineWidth: 2,
    });

    /**
     * Fetch chart data and update the series
     */
    async function loadData() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/market/chart/${coinId}?days=${activeDays}`);
        if (!response.ok) throw new Error('Failed to fetch chart data');
        const data = await response.json() as { prices: PricePoint[] };

        const chartData = data.prices.map((p) => ({
          time: Math.floor(p.timestamp / 1000) as number,
          value: p.price,
        }));

        areaSeries.setData(chartData as Parameters<typeof areaSeries.setData>[0]);
        chart.timeScale().fitContent();
      } catch {
        // Chart will show empty state
      } finally {
        setIsLoading(false);
      }
    }

    loadData();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [coinId, activeDays, theme]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {TIME_RANGES.map(({ label, days }) => (
          <button
            key={days}
            onClick={() => setActiveDays(days)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeDays === days
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative rounded-lg border border-border p-2">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div ref={chartContainerRef} />
      </div>
    </div>
  );
}
