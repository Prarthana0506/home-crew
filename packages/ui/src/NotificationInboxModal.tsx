import React, { useState, useEffect } from 'react';
import {
  Bell,
  ExternalLink,
  ShieldAlert,
  Info,
  X,
  Share2
} from 'lucide-react';

import {
  fetchInAppNotifications,
  markNotificationOpened,
  subscribeToInAppNotifications,
  requestPushPermissionAndRegister,
  getPushPermissionState,
  isIOS,
  isIOSStandalone,
  getIOSPushLimitationMessage,
  type InAppNotification
} from '@urbanclap/lib';
import { Modal } from './Modal';
import { Button } from './Button';

export interface NotificationInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onNavigate?: (url: string) => void;
}

export const NotificationInboxModal: React.FC<NotificationInboxModalProps> = ({
  isOpen,
  onClose,
  userId,
  onNavigate
}) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionState, setPermissionState] = useState(getPushPermissionState());
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const loadNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchInAppNotifications(userId);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !userId) return;
    loadNotifications();

    const unsub = subscribeToInAppNotifications(userId, newNotif => {
      setNotifications(prev => [newNotif, ...prev]);
    });

    setPermissionState(getPushPermissionState());

    return unsub;
  }, [isOpen, userId]);

  const handleEnablePush = async () => {
    setEnablingPush(true);
    setPushMsg(null);
    try {
      const res = await requestPushPermissionAndRegister(userId);
      if (res.success) {
        setPushMsg('Push notifications successfully activated!');
        setPermissionState('granted');
      } else {
        setPushMsg(res.error || 'Failed to activate push notifications.');
      }
    } finally {
      setEnablingPush(false);
    }
  };

  const handleNotificationClick = async (notif: InAppNotification) => {
    // 1. Mark opened in database
    await markNotificationOpened(notif.id);

    setNotifications(prev =>
      prev.map(n => (n.id === notif.id ? { ...n, read: true, opened_at: new Date().toISOString() } : n))
    );

    // 2. Navigate to target URL if present
    const url = notif.data?.url;
    if (url && onNavigate) {
      onClose();
      onNavigate(url);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notification Inbox">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh' }}>
        {/* Push Permission Prompt / iOS Limitation Banner */}
        {permissionState !== 'granted' && (
          <div
            style={{
              backgroundColor: 'var(--color-primary-light)',
              border: '1.5px solid var(--color-primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bell size={16} color="var(--color-primary)" />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-primary)' }}>
                  Device Push Alerts
                </span>
              </div>
              <Button size="sm" variant="primary" onClick={handleEnablePush} disabled={enablingPush}>
                {enablingPush ? 'Activating...' : 'Enable Push'}
              </Button>
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-muted)', lineHeight: 1.4 }}>
              Receive instant alerts for emergency bidding, outbid updates, arrival notices, and schedule confirmations.
            </p>

            {/* Document iOS Limitation */}
            {isIOS() && !isIOSStandalone() && (
              <div
                style={{
                  marginTop: '4px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  fontSize: '11px',
                  color: 'var(--color-slate-mid)'
                }}
              >
                <Share2 size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>
                  <strong>iOS Requirement:</strong> On iPhone/iPad, push notifications work only after you tap{' '}
                  <strong>Share &gt; Add to Home Screen</strong> in Safari.
                </span>
              </div>
            )}

            {pushMsg && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: pushMsg.includes('success') ? 'var(--color-emerald)' : 'var(--color-crimson)' }}>
                {pushMsg}
              </span>
            )}
          </div>
        )}

        {/* Notification List */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
          {loading && notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-muted)' }}>
              <Bell size={32} style={{ margin: '0 auto 8px', color: 'var(--color-muted)' }} />
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>No alerts yet</div>
              <div style={{ fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                Job broadcasts and service updates will appear here.
              </div>
            </div>
          ) : (
            notifications.map(n => {
              const isUnread = !n.read;
              const isEmergency = n.priority === 'emergency';

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    backgroundColor: isUnread ? (isEmergency ? 'var(--color-coral-light)' : 'var(--color-primary-light)') : '#ffffff',
                    border: `1.5px solid ${isUnread ? (isEmergency ? 'var(--color-coral)' : 'var(--color-primary)') : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-xs)',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.1s ease',
                    boxShadow: isUnread ? 'var(--shadow-flat)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: isUnread ? 800 : 700,
                        color: isEmergency ? 'var(--color-coral-dark)' : 'var(--color-dark)'
                      }}
                    >
                      {n.title}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-dark)', lineHeight: 1.4 }}>
                    {n.body}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span className="flat-badge badge-neutral" style={{ fontSize: '9px' }}>
                      {n.type.replace(/_/g, ' ')}
                    </span>
                    {n.data?.url && (
                      <span style={{ fontSize: '10px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                        Tap to open <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};