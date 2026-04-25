import React, { useMemo, useRef, useEffect } from 'react';
import { formatBytes } from '../../lib/format';

const PAD_X = 40;
const PAD_TOP = 16;
const AXIS_H = 36;
const Y_TICKS = 5;
const POINT_GAP = 60;

const STATUSES = [
  { key: 'success',   color: 'var(--accent)',     label: 'Success' },
  { key: 'error',     color: 'var(--system-red)', label: 'Error'   },
  { key: 'cancelled', color: 'var(--system-gray)',label: 'Cancelled' },
];

export default function CandleChart({ entries }) {
  const series = useMemo(() => {
    const sorted = (entries || [])
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const totals = { success: 0, error: 0, cancelled: 0 };
    return sorted.map((e) => {
      const status = STATUSES.find((s) => s.key === e.status)?.key || 'cancelled';
      totals[status] += e.totalBytes || 0;
      return {
        id: e.id,
        ts: new Date(e.timestamp),
        success: totals.success,
        error: totals.error,
        cancelled: totals.cancelled,
        total: totals.success + totals.error + totals.cancelled,
      };
    });
  }, [entries]);

  const chartHeight = 340;
  const plotH = chartHeight - PAD_TOP - AXIS_H;
  const innerW = Math.max(series.length - 1, 0) * POINT_GAP;
  const width = Math.max(innerW + PAD_X * 2, 360);

  const maxTotal = series.length > 0 ? series[series.length - 1].total : 0;
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (maxTotal * i) / Y_TICKS);

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [series.length]);

  if (series.length === 0) {
    return <div className="chart-empty">No backups yet</div>;
  }

  const xAt = (i) => PAD_X + i * POINT_GAP;
  const yAt = (v) => maxTotal > 0
    ? PAD_TOP + plotH - (v / maxTotal) * plotH
    : PAD_TOP + plotH;

  // Build stacked-area paths bottom-up: cancelled → error → success on top.
  const order = ['cancelled', 'error', 'success'];
  const stacks = order.map((key, idx) => {
    const lower = (i) => order.slice(0, idx).reduce((s, k) => s + series[i][k], 0);
    const upper = (i) => lower(i) + series[i][key];
    const top = series.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(upper(i))}`).join(' ');
    const bottom = series
      .map((_, i) => `L ${xAt(series.length - 1 - i)} ${yAt(lower(series.length - 1 - i))}`)
      .join(' ');
    return {
      key,
      d: `${top} ${bottom} Z`,
      color: STATUSES.find((s) => s.key === key).color,
    };
  });

  const lineD = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.total)}`).join(' ');

  return (
    <div className="candles">
      <div className="candles__yaxis" aria-hidden="true">
        {yTicks.slice().reverse().map((v, i) => (
          <div key={i} className="candles__ytick">{v > 0 ? formatBytes(v) : '0'}</div>
        ))}
      </div>
      <div className="candles__scroll" ref={scrollRef}>
        <svg width={width} height={chartHeight} role="img" aria-label="Cumulative bytes backed up over time, by status">
          {yTicks.map((_, i) => {
            const y = PAD_TOP + (plotH * i) / Y_TICKS;
            return (
              <line
                key={i}
                x1={PAD_X}
                x2={width - PAD_X}
                y1={y}
                y2={y}
                stroke="var(--separator)"
                strokeWidth="0.5"
              />
            );
          })}
          {stacks.map((s) => (
            <path
              key={s.key}
              d={s.d}
              fill={s.color}
              opacity={s.key === 'success' ? 0.45 : s.key === 'error' ? 0.6 : 0.4}
              stroke="none"
            />
          ))}
          <path
            d={lineD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.95"
          />
          {series.map((p, i) => (
            <g key={p.id}>
              <circle cx={xAt(i)} cy={yAt(p.total)} r="3" fill="var(--accent)" stroke="var(--bg-content)" strokeWidth="1.5">
                <title>{`${p.ts.toLocaleDateString()} — total ${formatBytes(p.total)}`}</title>
              </circle>
              <text
                x={xAt(i)}
                y={PAD_TOP + plotH + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--label-secondary)"
              >
                {String(p.ts.getDate()).padStart(2, '0')}/{String(p.ts.getMonth() + 1).padStart(2, '0')}
              </text>
            </g>
          ))}
        </svg>
        <div className="candles__legend">
          {STATUSES.map((s) => (
            <span key={s.key}>
              <span className="legend-dot" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
