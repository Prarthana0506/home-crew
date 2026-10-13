import React from 'react';
import { X } from 'lucide-react';
import { AwningBanner } from './AwningBanner';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  canDismiss?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  canDismiss = true
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (canDismiss && onClose) onClose();
      }}
    >
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <AwningBanner height={10} />
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
            <div>
              <h2 id="modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                  {subtitle}
                </p>
              )}
            </div>
            {canDismiss && onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  padding: '4px'
                }}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};
