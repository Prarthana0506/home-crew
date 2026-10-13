import React from 'react';
import { Star } from 'lucide-react';

export interface ProviderRatingBarProps {
  ratingAvg: number;
  reviewCount: number;
  distribution?: { [stars: number]: number };
}

export const ProviderRatingBar: React.FC<ProviderRatingBarProps> = ({
  ratingAvg,
  reviewCount,
  distribution
}) => {
  // Fallback synthetic distribution if not provided
  const dist = distribution || {
    5: Math.round(reviewCount * 0.7),
    4: Math.round(reviewCount * 0.2),
    3: Math.round(reviewCount * 0.08),
    2: Math.round(reviewCount * 0.02),
    1: 0
  };

  const total = Math.max(reviewCount, 1);

  return (
    <div
      style={{
        padding: '14px 16px',
        backgroundColor: 'var(--bg-card)',
        border: '2px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
      aria-label="Provider Rating Breakdown"
    >
      {/* Top summary row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-dark)', fontVariantNumeric: 'tabular-nums' }}>
            {ratingAvg > 0 ? Number(ratingAvg).toFixed(1) : '--'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--color-amber)' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Star
                key={n}
                size={16}
                fill={n <= Math.round(ratingAvg) ? 'var(--color-amber)' : 'none'}
                stroke="var(--color-amber)"
              />
            ))}
          </div>
        </div>

        <span className="flat-badge badge-muted">
          {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      {/* 5-bar breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[5, 4, 3, 2, 1].map(star => {
          const count = dist[star] || 0;
          const pct = Math.min(100, Math.round((count / total) * 100));

          return (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)' }}>
              <span style={{ width: '22px', fontWeight: 700, color: 'var(--color-muted)' }}>
                {star}&#9733;
              </span>
              <div style={{
                flex: 1,
                height: '8px',
                backgroundColor: 'var(--color-slate-light)',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: star >= 4 ? 'var(--color-amber)' : star === 3 ? 'var(--color-slate-mid)' : 'var(--color-crimson)',
                  transition: 'width 0.2s ease'
                }} />
              </div>
              <span style={{ width: '28px', textAlign: 'right', fontWeight: 600, color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
