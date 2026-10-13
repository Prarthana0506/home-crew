import React, { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StateProps {
  message?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

// ─── Spinner / Loading State ──────────────────────────────────────────────────

export const LoadingSpinner: React.FC<StateProps & { size?: 'sm' | 'md' | 'lg'; inline?: boolean }> = ({
  message = 'Loading...',
  size = 'md',
  inline = false,
  style,
}) => {
  const dim = size === 'sm' ? 20 : size === 'md' ? 36 : 52;
  const stroke = size === 'sm' ? 2.5 : 3;

  const spinner = (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 50 50"
      style={{ animation: 'hc-spin 0.9s linear infinite' }}
      aria-hidden="true"
    >
      <style>{`@keyframes hc-spin { 100% { transform: rotate(360deg); } }`}</style>
      <circle
        cx="25" cy="25" r="20"
        fill="none"
        stroke="var(--color-teal-dark, #0e7490)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray="90 150"
        strokeDashoffset="-35"
      />
    </svg>
  );

  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', ...style }}>
        {spinner}
        {message && <span style={{ fontSize: '0.85rem', color: 'var(--color-muted, #64748b)' }}>{message}</span>}
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-label={message}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '14px', padding: '48px 16px', textAlign: 'center', ...style,
      }}
    >
      {spinner}
      {message && (
        <p style={{ fontSize: '0.88rem', color: 'var(--color-muted, #64748b)', margin: 0, fontWeight: 500 }}>
          {message}
        </p>
      )}
    </div>
  );
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

export const SkeletonRow: React.FC<{ rows?: number; style?: React.CSSProperties }> = ({
  rows = 3, style,
}) => {
  const pulse = `@keyframes hc-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`;
  return (
    <div style={style}>
      <style>{pulse}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '8px', backgroundColor: '#e2e8f0', flexShrink: 0, animation: 'hc-pulse 1.5s ease infinite' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div style={{ height: '12px', borderRadius: '6px', backgroundColor: '#e2e8f0', width: `${60 + (i * 13) % 30}%`, animation: 'hc-pulse 1.5s ease infinite' }} />
            <div style={{ height: '10px', borderRadius: '6px', backgroundColor: '#e2e8f0', width: `${40 + (i * 9) % 25}%`, animation: 'hc-pulse 1.5s ease infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

export const EmptyState: React.FC<StateProps & {
  icon?: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
}> = ({ icon, title, message = 'Nothing here yet.', action, style }) => (
  <div
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '12px', padding: '56px 24px', textAlign: 'center', ...style,
    }}
  >
    {icon && (
      <div style={{
        width: '64px', height: '64px', borderRadius: '16px',
        backgroundColor: 'var(--bg-sand, #fdf8f3)', border: '2px solid var(--color-border, #e2e8f0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-muted, #94a3b8)',
      }}>
        {icon}
      </div>
    )}
    {title && (
      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-dark, #1e293b)', margin: 0 }}>
        {title}
      </h3>
    )}
    <p style={{ fontSize: '0.88rem', color: 'var(--color-muted, #64748b)', margin: 0, maxWidth: '340px', lineHeight: 1.6 }}>
      {message}
    </p>
    {action}
  </div>
);

// ─── Error State ──────────────────────────────────────────────────────────────

export const ErrorState: React.FC<StateProps & {
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}> = ({ title = 'Something went wrong', message = 'An unexpected error occurred. Please try again.', onRetry, retryLabel = 'Try Again', style }) => (
  <div
    role="alert"
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '12px', padding: '48px 24px', textAlign: 'center', ...style,
    }}
  >
    {/* Red warning icon */}
    <div style={{
      width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fee2e2',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.8rem', lineHeight: 1,
    }}>
      ⚠
    </div>
    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626', margin: 0 }}>
      {title}
    </h3>
    <p style={{ fontSize: '0.87rem', color: 'var(--color-muted, #64748b)', margin: 0, maxWidth: '360px', lineHeight: 1.6 }}>
      {message}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          marginTop: '4px', padding: '9px 20px', borderRadius: '8px', border: '2px solid #dc2626',
          backgroundColor: '#fff', color: '#dc2626', fontWeight: 800, fontSize: '0.85rem',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
          transition: 'background 0.18s',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fee2e2')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
      >
        ↺ {retryLabel}
      </button>
    )}
  </div>
);

// ─── Inline Error Banner ──────────────────────────────────────────────────────

export const ErrorBanner: React.FC<StateProps & { onDismiss?: () => void }> = ({
  message, onDismiss, style,
}) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '10px', padding: '10px 14px', borderRadius: '8px',
        backgroundColor: '#fee2e2', border: '2px solid #ef4444',
        color: '#991b1b', fontSize: '0.86rem', fontWeight: 600, ...style,
      }}
    >
      <span>⚠ {message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 900, fontSize: '1rem', lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
};

// ─── Success Banner ───────────────────────────────────────────────────────────

export const SuccessBanner: React.FC<StateProps & { onDismiss?: () => void }> = ({
  message, onDismiss, style,
}) => {
  if (!message) return null;
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '10px', padding: '10px 14px', borderRadius: '8px',
        backgroundColor: '#dcfce7', border: '2px solid #16a34a',
        color: '#166534', fontSize: '0.86rem', fontWeight: 600, ...style,
      }}
    >
      <span>✓ {message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 900, fontSize: '1rem', lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
};

// ─── Offline Banner (auto-detect navigator.onLine) ────────────────────────────

export const OfflineBanner: React.FC<{
  offlineMessage?: string;
  onlineMessage?: string;
  /** How long (ms) to show "Back online!" before hiding. Default 3000. */
  restoreTimeout?: number;
}> = ({
  offlineMessage = 'You are offline. Some features may not work.',
  onlineMessage = '✓ Back online!',
  restoreTimeout = 3000,
}) => {
  const [isOnline, setIsOnline]     = useState(() => navigator.onLine);
  const [showRestored, setRestored] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline  = () => {
      setIsOnline(true);
      setRestored(true);
      setTimeout(() => setRestored(false), restoreTimeout);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online',  handleOnline);
    };
  }, [restoreTimeout]);

  if (isOnline && !showRestored) return null;

  const offline = !isOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        padding: '10px 20px', textAlign: 'center', fontWeight: 700, fontSize: '0.88rem',
        backgroundColor: offline ? '#1e293b' : '#16a34a',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        transition: 'background-color 0.3s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      {offline
        ? <><span>📡</span><span>{offlineMessage}</span></>
        : <><span>✓</span><span>{onlineMessage}</span></>
      }
    </div>
  );
};

// ─── Page-level wrapper: combines Loading / Error / Empty / Content ────────────
// Usage:
//   <AsyncState loading={loading} error={error} empty={data.length === 0} onRetry={load}>
//     <MyList data={data} />
//   </AsyncState>

export const AsyncState: React.FC<{
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
  skeletonRows?: number;
  useSkeleton?: boolean;
}> = ({
  loading,
  error,
  empty,
  loadingMessage = 'Loading...',
  emptyMessage   = 'Nothing here yet.',
  emptyIcon,
  emptyTitle,
  emptyAction,
  onRetry,
  children,
  skeletonRows = 3,
  useSkeleton  = false,
}) => {
  if (loading) {
    if (useSkeleton) return <SkeletonRow rows={skeletonRows} style={{ padding: '20px 0' }} />;
    return <LoadingSpinner message={loadingMessage} />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  if (empty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        message={emptyMessage}
        action={emptyAction}
      />
    );
  }
  return <>{children}</>;
};
