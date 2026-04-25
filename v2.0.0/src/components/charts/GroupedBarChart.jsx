import React, { useMemo } from 'react';

const BAR_W = 14;
const GROUP_GAP = 28;
const PAD_X = 24;
const PAD_TOP = 16;
const AXIS_H = 32;
const Y_TICKS = 4;

export default function GroupedBarChart({ tasks, history }) {
  const data = useMemo(() => {
    return (tasks || []).map((t) => {
      const runs = history.filter((h) => h.taskId === t.id);
      const success = runs.filter((h) => h.status === 'success').length;
      const error = runs.filter((h) => h.status === 'error').length;
      return { id: t.id, name: t.name, success, error };
    });
  }, [tasks, history]);

  const maxCount = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.success, d.error))),
    [data],
  );

  const chartHeight = 200;
  const plotH = chartHeight - PAD_TOP - AXIS_H;
  const groupW = BAR_W * 2 + 4;
  const innerW = data.length * (groupW + GROUP_GAP);
  const width = Math.max(innerW + PAD_X * 2, 320);

  if (data.length === 0) {
    return <div className="chart-empty">No tasks</div>;
  }

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => Math.round((maxCount * i) / Y_TICKS));

  return (
    <div className="grouped-bars">
      <div className="grouped-bars__yaxis" aria-hidden="true">
        {yTicks.slice().reverse().map((v, i) => (
          <div key={i} className="grouped-bars__ytick">{v}</div>
        ))}
      </div>
      <div className="grouped-bars__scroll">
        <svg width={width} height={chartHeight} role="img" aria-label="Successes vs errors per task">
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
          {data.map((d, i) => {
            const baseX = PAD_X + i * (groupW + GROUP_GAP);
            const sH = (d.success / maxCount) * plotH;
            const eH = (d.error / maxCount) * plotH;
            const sY = PAD_TOP + plotH - sH;
            const eY = PAD_TOP + plotH - eH;
            return (
              <g key={d.id}>
                <rect x={baseX} y={sY} width={BAR_W} height={Math.max(sH, 2)} rx="2" fill="var(--accent)" opacity="0.85">
                  <title>{`${d.name} — ${d.success} success`}</title>
                </rect>
                <rect x={baseX + BAR_W + 4} y={eY} width={BAR_W} height={Math.max(eH, 2)} rx="2" fill="var(--system-red)" opacity="0.85">
                  <title>{`${d.name} — ${d.error} error`}</title>
                </rect>
                <text
                  x={baseX + groupW / 2}
                  y={chartHeight - 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--label-secondary)"
                >
                  {d.name.length > 10 ? d.name.slice(0, 9) + '…' : d.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grouped-bars__legend">
        <span><span className="legend-dot" style={{ background: 'var(--accent)' }} /> Success</span>
        <span><span className="legend-dot" style={{ background: 'var(--system-red)' }} /> Error</span>
      </div>
    </div>
  );
}
