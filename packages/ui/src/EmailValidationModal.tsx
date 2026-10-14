import React, { useState } from 'react';
import { Mail, AlertCircle, CheckCircle, Send, X } from 'lucide-react';
import { Button } from './Button';

export interface EmailValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'request_confirmation' | 'booking_confirmation';
  recipientRole: 'customer' | 'provider';
  initialEmail?: string;
  jobTitle?: string;
  onSend: (email: string) => Promise<{ success: boolean; message?: string }>;
}

export const EmailValidationModal: React.FC<EmailValidationModalProps> = ({
  isOpen,
  onClose,
  reason,
  recipientRole,
  initialEmail = '',
  jobTitle,
  onSend,
}) => {
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const isValid = emailRegex.test(emailInput.trim().toLowerCase());

  const handleSend = async () => {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg('Mail is not valid. Provide a valid mail and send the mail to the given mail.');
      return;
    }

    setSending(true);
    setErrorMsg(null);
    try {
      const res = await onSend(cleanEmail);
      if (res.success) {
        setSuccessMsg(res.message || `Confirmation mail sent to ${cleanEmail}!`);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setErrorMsg(res.message || 'Not valid mail. Provide a valid mail and send the mail to the given mail.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Not valid mail. Provide a valid mail and send the mail to the given mail.');
    } finally {
      setSending(false);
    }
  };

  const isRequest = reason === 'request_confirmation';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '14px',
          border: '2px solid #ea580c',
          boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: '#fff7ed',
                border: '1.5px solid #ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.12rem', fontWeight: 900, color: '#9a3412', margin: 0 }}>
                Mail is not valid
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {isRequest ? 'Request Confirmation Delivery' : 'Booking Confirmation Delivery'} · {recipientRole}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Warning notification banner */}
        <div
          style={{
            backgroundColor: '#fff7ed',
            border: '1.5px solid #fed7aa',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '0.86rem',
            color: '#9a3412',
            lineHeight: 1.5,
          }}
        >
          {isRequest ? (
            <>
              <strong>Work order posted!</strong> However, the registered email address is not valid.
              Provide a valid mail to receive your <strong>Request Confirmation</strong> with order reference.
            </>
          ) : (
            <>
              <strong>Booking confirmed!</strong> However, the email address is not valid.
              Provide a valid mail to send the <strong>Booking Confirmation</strong> with arrival schedule and contact details.
            </>
          )}
        </div>

        {jobTitle && (
          <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '14px', fontWeight: 600 }}>
            Service: <span style={{ color: '#0f766e' }}>{jobTitle}</span>
          </div>
        )}

        {/* Form input */}
        <div style={{ marginBottom: '14px' }}>
          <label
            htmlFor="confirm-email-input"
            style={{ display: 'block', fontSize: '0.83rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}
          >
            Provide a valid mail:
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="confirm-email-input"
              type="email"
              autoFocus
              className="flat-input"
              placeholder="e.g. name@example.com"
              value={emailInput}
              onChange={e => {
                setEmailInput(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              style={{
                width: '100%',
                paddingRight: '36px',
                borderColor: emailInput && !isValid ? '#dc2626' : undefined,
              }}
            />
            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <Mail size={16} />
            </div>
          </div>
          {emailInput && !isValid && (
            <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', fontWeight: 600 }}>
              Please enter a complete email format (e.g. user@domain.com).
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '6px',
              color: '#16a34a',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Dismiss
          </Button>
          <Button
            id="send-confirm-email-btn"
            variant="primary"
            onClick={handleSend}
            disabled={sending || !emailInput.trim()}
            style={{ minWidth: '160px' }}
          >
            {sending ? (
              'Sending…'
            ) : (
              <>
                <Send size={14} /> Send Mail
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
