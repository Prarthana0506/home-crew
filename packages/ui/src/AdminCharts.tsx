import React from 'react';

// ============================================================================
// Donut Chart: Request Status Distribution
// ============================================================================

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface AdminDonutChartProps {
  title: string;
  data: DonutSegment[];
  size?: number;
  innerRadiusRatio?: number;
}

export const AdminDonutChart: React.FC<AdminDonutChartProps> = ({
  title,
  data,
  size = 200,
  innerRadiusRatio = 0.62
}) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const radius = size / 2;
  const strokeWidth = radius * (1 - innerRadiusRatio);
  const chartRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * chartRadius;

  let cumulativeAngle = 0;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '2px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
      aria-label={title}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-dark)' }}>
          {title}
        </h4>
        <span className="flat-badge badge-neutral" style={{ fontSize: '11px' }}>
          {total} Total
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            {total === 0 ? (
              <circle
                cx={radius}
                cy={radius}
                r={chartRadius}
                fill="none"
                stroke="var(--color-slate-light)"
                strokeWidth={strokeWidth}
              />
            ) : (
              data.map((seg, idx) => {
                if (seg.value <= 0) return null;
                const strokeDasharray = `${(seg.value / total) * circumference} ${circumference}`;
                const strokeDashoffset = -cumulativeAngle * circumference;
                cumulativeAngle += seg.value / total;

                return (
                  <circle
                    key={idx}
                    cx={radius}
                    cy={radius}
                    r={chartRadius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dasharray 0.3s ease' }}
                  />
                );
              })
            )}
          </svg>

          {/* Center Callout */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-dark)', lineHeight: 1 }}>
              {total}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', marginTop: '3px' }}>
              Jobs
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px' }}>
          {data.map((seg, idx) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: 'var(--text-xs)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: seg.color,
                      borderRadius: '2px',
                      display: 'inline-block'
                    }}
                  />
                  <span style={{ color: 'var(--color-dark)', fontWeight: 600 }}>{seg.label}</span>
                </div>
                <span style={{ color: 'var(--color-muted)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {seg.value} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Line Chart: Booking / Coin Volume Trend
// ============================================================================

export interface LineDataPoint {
  label: string;
  value: number;
}

export interface AdminLineChartProps {
  title: string;
  data: LineDataPoint[];
  color?: string;
  unit?: string;
  height?: number;
}

export const AdminLineChart: React.FC<AdminLineChartProps> = ({
  title,
  data,
  color = 'var(--color-primary)',
  unit = '',
  height = 180
}) => {
  const width = 420;
  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartW = width - paddingX * 2;
  const chartH = height - paddingTop - paddingBottom;

  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 10);
  const minVal = 0;

  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = paddingTop + chartH - ((d.value - minVal) / (maxVal - minVal)) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    : '';

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '2px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
      aria-label={title}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-dark)' }}>
          {title}
        </h4>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>
          Last {data.length} periods
        </span>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: `${height}px` }}
        >
          {/* Horizontal grid lines */}
          {[0, 0.5, 1].map((ratio, idx) => {
            const y = paddingTop + chartH * (1 - ratio);
            const val = Math.round(minVal + (maxVal - minVal) * ratio);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="var(--color-slate-light)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingX - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--color-muted)"
                  fontWeight="600"
                >
                  {val}{unit}
                </text>
              </g>
            );
          })}

          {/* Trend line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data point nodes */}
          {points.map((pt, idx) => (
            <g key={idx}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4"
                fill="#ffffff"
                stroke={color}
                strokeWidth="2"
              />
              {/* X label */}
              <text
                x={pt.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-muted)"
                fontWeight="600"
              >
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
