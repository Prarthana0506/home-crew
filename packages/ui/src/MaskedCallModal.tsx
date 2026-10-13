import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, ShieldCheck, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface MaskedCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  counterpartyName: string;
  counterpartyRole: string;
}

export const MaskedCallModal: React.FC<MaskedCallModalProps> = ({
  isOpen,
  onClose,
  counterpartyName,
  counterpartyRole
}) => {
  const [callState, setCallState] = useState<'dialing' | 'connected' | 'ended'>('dialing');
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Auto connect after 2 seconds
  useEffect(() => {
    if (!isOpen) {
      setCallState('dialing');
      setSeconds(0);
      setIsMuted(false);
      setIsSpeaker(false);
      return;
    }

    const connectTimer = setTimeout(() => {
      setCallState('connected');
    }, 2200);

    return () => clearTimeout(connectTimer);
  }, [isOpen]);

  // Call duration counter
  useEffect(() => {
    if (callState !== 'connected') return;

    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleEndCall} title="Secure Voice Bridge">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '16px 8px 8px',
          gap: '16px'
        }}
      >
        {/* Masked Number Banner */}
        <div
          style={{
            backgroundColor: 'var(--color-primary-light)',
            border: '1.5px solid var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={18} color="var(--color-primary)" />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
            Masked Number: +91 80 4719 0281 (Relay)
          </span>
        </div>

        {/* Counterparty avatar and name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-slate-light)',
              border: '2px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-dark)'
            }}
          >
            <Phone size={28} />
          </div>

          <h3 style={{ margin: '4px 0 0', fontSize: '1.2rem', fontWeight: 800 }}>
            {counterpartyName}
          </h3>
          <span className="flat-badge badge-neutral">
            {counterpartyRole}
          </span>
        </div>

        {/* Call State / Duration */}
        <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
          {callState === 'dialing' && (
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-muted)' }}>
              Connecting to secure bridge...
            </span>
          )}
          {callState === 'connected' && (
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-emerald)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(seconds)}
            </span>
          )}
          {callState === 'ended' && (
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-crimson)' }}>
              Call Ended
            </span>
          )}
        </div>

        {/* Privacy Notice */}
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-muted)', maxWidth: '320px', lineHeight: 1.4 }}>
          Personal phone numbers are strictly protected. Both parties communicate exclusively through HomeCrew encrypted relay.
        </p>

        {/* In-Call Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
          {/* Mute Button */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            disabled={callState !== 'connected'}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-sm)',
              border: `2px solid ${isMuted ? 'var(--color-terracotta)' : 'var(--color-border)'}`,
              backgroundColor: isMuted ? 'var(--color-terracotta-light)' : '#ffffff',
              color: isMuted ? 'var(--color-terracotta)' : 'var(--color-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: callState === 'connected' ? 'pointer' : 'default',
              opacity: callState === 'connected' ? 1 : 0.5
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={handleEndCall}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-sm)',
              border: '2px solid var(--color-crimson)',
              backgroundColor: 'var(--color-crimson)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-flat)'
            }}
            title="End Call"
          >
            <PhoneOff size={24} />
          </button>

          {/* Speaker Button */}
          <button
            type="button"
            onClick={() => setIsSpeaker(!isSpeaker)}
            disabled={callState !== 'connected'}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-sm)',
              border: `2px solid ${isSpeaker ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: isSpeaker ? 'var(--color-primary-light)' : '#ffffff',
              color: isSpeaker ? 'var(--color-primary)' : 'var(--color-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: callState === 'connected' ? 'pointer' : 'default',
              opacity: callState === 'connected' ? 1 : 0.5
            }}
            title={isSpeaker ? 'Speaker Off' : 'Speaker On'}
          >
            <Volume2 size={20} />
          </button>
        </div>
      </div>
    </Modal>
  );
};
