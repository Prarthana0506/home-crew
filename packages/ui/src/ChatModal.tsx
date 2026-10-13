import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAuth,
  confirmBookingTime,
  getOrCreateBookingConversation,
  fetchChatMessages,
  sendChatMessage,
  reportChatMessage,
  subscribeToBookingChat,
  processImageAttachment,
  supabase,
  type ServiceRequest,
  type ChatMessageItem,
  type ConversationInfo,
  type ChatMessageType
} from '@urbanclap/lib';
import {
  X,
  Send,
  Phone,
  Clock,
  MapPin,
  Truck,
  Image as ImageIcon,
  Flag,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { MaskedCallModal } from './MaskedCallModal';

export interface ChatModalProps {
  request?: ServiceRequest | null;
  bookingId?: string;
  onClose: () => void;
  onBookingConfirmed?: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  request,
  bookingId: propBookingId,
  onClose,
  onBookingConfirmed
}) => {
  const { authUser, profile } = useAuth();

  const [activeBookingId, setActiveBookingId] = useState<string | null>(
    propBookingId || (request?.bookings && request.bookings.length > 0 ? request.bookings[0].id : null)
  );

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notConfirmedNotice, setNotConfirmedNotice] = useState<string | null>(null);

  // Modals & Panels
  const [showCallModal, setShowCallModal] = useState(false);
  const [reportTargetMsg, setReportTargetMsg] = useState<ChatMessageItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Time proposal form inside chat
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [propDate, setPropDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [propTime, setPropTime] = useState('10:00');
  const [propDuration, setPropDuration] = useState(2.0);

  // Share Address card form inside chat
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressStreet, setAddressStreet] = useState('');
  const [addressLandmark, setAddressLandmark] = useState('');

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Determine counterparty details
  const isCustomer = authUser?.id === request?.customer_id;
  const counterpartyName = isCustomer
    ? (request?.assigned_provider?.organization?.name || request?.assigned_provider?.profile?.name || 'Technician')
    : (request?.customer?.name || 'Customer');
  const counterpartyRole = isCustomer ? 'Assigned Provider' : 'Customer';

  // 1. Initialize Conversation & Load Messages
  const loadChat = useCallback(async () => {
    let targetBookingId = activeBookingId;

    if (!targetBookingId && request?.id) {
      try {
        const { data: bData } = await supabase
          .from('bookings')
          .select('id')
          .eq('request_id', request.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (bData && bData.length > 0) {
          targetBookingId = bData[0].id;
          setActiveBookingId(targetBookingId);
        } else {
          targetBookingId = request.id;
        }
      } catch {
        targetBookingId = request.id;
      }
    }

    if (!targetBookingId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      setNotConfirmedNotice(null);

      const conv = await getOrCreateBookingConversation(targetBookingId);
      setConversation(conv);
      setActiveBookingId(targetBookingId);

      const msgs = await fetchChatMessages(targetBookingId);
      setMessages(msgs);
    } catch (err: any) {
      const msg = err.message || 'Chat error';
      if (msg.includes('only once a provider is confirmed') || msg.includes('Booking not found')) {
        setNotConfirmedNotice('Chat is only available once a technician is confirmed for this booking.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBookingId, request?.id]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // 2. Realtime Subscription
  useEffect(() => {
    if (!activeBookingId) return;

    const unsub = subscribeToBookingChat(activeBookingId, newMsg => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      scrollToBottom();
    });

    return unsub;
  }, [activeBookingId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 3. Send Text Message
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeBookingId || sending) return;

    setErrorMsg(null);
    setSending(true);

    try {
      const res = await sendChatMessage({
        bookingId: activeBookingId,
        messageType: 'text',
        content: inputText.trim()
      });

      setMessages(prev => {
        if (prev.some(m => m.id === res.id)) return prev;
        return [...prev, res];
      });
      setInputText('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // 4. Send Image Message (with EXIF strip and compression)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBookingId) return;

    setErrorMsg(null);
    setSending(true);

    try {
      // Client-side EXIF strip and compression
      const processed = await processImageAttachment(file, 1280, 0.82);

      const res = await sendChatMessage({
        bookingId: activeBookingId,
        messageType: 'image',
        mediaUrl: processed.dataUrl,
        content: `Image (${Math.round(processed.compressedSizeBytes / 1024)} KB)`
      });

      setMessages(prev => {
        if (prev.some(m => m.id === res.id)) return prev;
        return [...prev, res];
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send image');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 5. Send Propose Time Card
  const handleSendProposeTime = async () => {
    if (!activeBookingId) return;
    setErrorMsg(null);
    setSending(true);

    try {
      const startIso = `${propDate}T${propTime}:00`;
      const res = await sendChatMessage({
        bookingId: activeBookingId,
        messageType: 'card_propose_time',
        content: `Proposed service slot: ${propDate} at ${propTime} (${propDuration}h)`,
        metadata: {
          proposed_start: startIso,
          proposed_duration_hours: propDuration,
          date: propDate,
          time: propTime
        }
      });

      setMessages(prev => [...prev, res]);
      setShowTimePicker(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send time proposal');
    } finally {
      setSending(false);
    }
  };

  // 6. Confirm Proposed Time
  const handleAcceptProposal = async (msg: ChatMessageItem) => {
    if (!request?.id || !activeBookingId) return;
    setErrorMsg(null);
    setSending(true);

    try {
      const meta = msg.metadata || {};
      const newStart = meta.proposed_start;
      const duration = meta.proposed_duration_hours || 2;

      await confirmBookingTime({
        requestId: request.id,
        confirmedStart: newStart,
        durationHours: duration
      });

      // Send confirmation card into chat
      await sendChatMessage({
        bookingId: activeBookingId,
        messageType: 'card_confirm_time',
        content: `Service schedule confirmed for ${meta.date} at ${meta.time}`,
        metadata: {
          confirmed_start: newStart,
          confirmed_duration: duration
        }
      });

      onBookingConfirmed?.();
      await loadChat();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to confirm booking time');
    } finally {
      setSending(false);
    }
  };

  // 7. Send Share Address Card (Customer Only)
  const handleSendAddress = async () => {
    if (!activeBookingId || !addressStreet.trim()) return;
    setErrorMsg(null);
    setSending(true);

    try {
      const res = await sendChatMessage({
        bookingId: activeBookingId,
        messageType: 'card_share_address',
        content: `Service Location: ${addressStreet.trim()}`,
        metadata: {
          full_address: addressStreet.trim(),
          landmark: addressLandmark.trim(),
          area_name: request?.area?.name || 'Area'
        }
      });

      setMessages(prev => [...prev, res]);
      setShowAddressForm(false);
      setAddressStreet('');
      setAddressLandmark('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to share address');
    } finally {
      setSending(false);
    }
  };

  // 8. Send "On The Way" Card (Provider Only)
  const handleSendOnTheWay = async () => {
    if (!activeBookingId) return;
    setErrorMsg(null);
    setSending(true);

    try {
      const res = await sendChatMessage({
        bookingId: activeBookingId,
        messageType: 'card_on_the_way',
        content: 'Technician is en route! Estimated arrival in 15 to 20 minutes.',
        metadata: {
          eta_minutes: 15,
          sent_at: new Date().toISOString()
        }
      });

      setMessages(prev => [...prev, res]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send status card');
    } finally {
      setSending(false);
    }
  };

  // 9. Report Message Submission
  const handleSubmitReport = async () => {
    if (!reportTargetMsg || !reportReason.trim()) return;
    setReporting(true);

    try {
      await reportChatMessage(reportTargetMsg.id, reportReason.trim());
      setReportSuccess(true);
      setTimeout(() => {
        setReportTargetMsg(null);
        setReportReason('');
        setReportSuccess(false);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to report message');
    } finally {
      setReporting(false);
    }
  };

  if (!request && !propBookingId) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '2px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-flat)',
            width: '100%',
            maxWidth: '680px',
            height: '85vh',
            maxHeight: '750px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* ------------------------------------------------------------- */}
          {/* Header */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '2px solid var(--color-border)',
              backgroundColor: 'var(--bg-app)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-primary-light)',
                  border: '1.5px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)'
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800 }}>
                    {counterpartyName}
                  </h3>
                  <span className="flat-badge badge-neutral" style={{ fontSize: '10px' }}>
                    {counterpartyRole}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                  {request?.title || 'Service Booking'} | Realtime Encrypted Relay
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Call button opens simulated masked call */}
              <button
                type="button"
                id="call-masked-btn"
                onClick={() => setShowCallModal(true)}
                disabled={!conversation?.can_call}
                title={
                  conversation?.can_call
                    ? 'Start Masked Voice Call'
                    : 'Call enabled only around scheduled service time'
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: conversation?.can_call ? 'var(--color-primary)' : 'var(--color-slate-light)',
                  color: conversation?.can_call ? '#ffffff' : 'var(--color-muted)',
                  border: `1.5px solid ${conversation?.can_call ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: conversation?.can_call ? 'pointer' : 'not-allowed',
                  opacity: conversation?.can_call ? 1 : 0.6
                }}
              >
                <Phone size={14} />
                <span>Call</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-xs)',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-dark)'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Readonly / Lock / Error Banners */}
          {/* ------------------------------------------------------------- */}
          {notConfirmedNotice && (
            <div
              style={{
                backgroundColor: 'var(--color-amber-light)',
                borderBottom: '1px solid var(--color-amber)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#92400e',
                fontSize: 'var(--text-xs)',
                fontWeight: 600
              }}
            >
              <AlertCircle size={16} />
              <span>{notConfirmedNotice}</span>
            </div>
          )}

          {conversation?.is_readonly && (
            <div
              style={{
                backgroundColor: 'var(--color-slate-light)',
                borderBottom: '1px solid var(--color-border)',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-slate-mid)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700
              }}
            >
              <Clock size={15} />
              <span>This conversation is read-only (closed or 7 days post-completion).</span>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                backgroundColor: 'var(--color-crimson-light)',
                borderBottom: '1px solid var(--color-crimson)',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--color-crimson)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-crimson)' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Messages Body */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              backgroundColor: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {loading && messages.length === 0 ? (
              <div style={{ margin: 'auto', color: 'var(--color-muted)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                Connecting to conversation...
              </div>
            ) : notConfirmedNotice ? (
              <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '360px', padding: '24px 16px' }}>
                <Clock size={36} color="var(--color-muted)" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Awaiting Provider Confirmation</h4>
                <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                  For community privacy, realtime chat and masked calls activate once a technician is assigned to your job.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-muted)' }}>
                <ShieldCheck size={32} style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Conversation Initialized</div>
                <div style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>
                  Messages are end-to-end moderated. Sharing phone numbers or links is blocked.
                </div>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === authUser?.id;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '100%'
                    }}
                  >
                    {/* Sender Name & Timestamp */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '3px',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: 'var(--color-muted)'
                      }}
                    >
                      <span>{isMe ? 'You' : msg.sender_name || msg.sender_role}</span>
                      <span>&bull;</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {/* Discrete Report Flag */}
                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => setReportTargetMsg(msg)}
                          title="Report this message"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: msg.is_reported ? 'var(--color-crimson)' : 'var(--color-muted)',
                            cursor: 'pointer',
                            padding: '0 2px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Flag size={11} fill={msg.is_reported ? 'var(--color-crimson)' : 'none'} />
                        </button>
                      )}
                    </div>

                    {/* Bubble Content by Message Type */}
                    {msg.message_type === 'text' && (
                      <div
                        style={{
                          backgroundColor: isMe ? 'var(--color-primary)' : '#ffffff',
                          color: isMe ? '#ffffff' : 'var(--color-dark)',
                          border: `1.5px solid ${isMe ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 14px',
                          maxWidth: '78%',
                          wordBreak: 'break-word',
                          fontSize: 'var(--text-sm)',
                          lineHeight: 1.45,
                          boxShadow: 'var(--shadow-flat)'
                        }}
                      >
                        {msg.content}
                      </div>
                    )}

                    {/* Image Bubble */}
                    {msg.message_type === 'image' && (
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          border: '2px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px',
                          maxWidth: '78%',
                          boxShadow: 'var(--shadow-flat)'
                        }}
                      >
                        {msg.media_url ? (
                          <img
                            src={msg.media_url}
                            alt="Attachment"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '240px',
                              borderRadius: 'var(--radius-xs)',
                              display: 'block'
                            }}
                          />
                        ) : (
                          <div style={{ padding: '12px', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                            [Image attachment]
                          </div>
                        )}
                        {msg.content && (
                          <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '4px', textAlign: 'right' }}>
                            {msg.content}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card: Propose Time */}
                    {msg.message_type === 'card_propose_time' && (
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          border: '2px solid var(--color-terracotta)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '14px',
                          maxWidth: '85%',
                          width: '320px',
                          boxShadow: 'var(--shadow-flat)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-terracotta)', marginBottom: '8px' }}>
                          <Clock size={16} />
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase' }}>
                            Proposed Service Time
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-dark)' }}>
                          {msg.metadata?.date} at {msg.metadata?.time}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                          Estimated Duration: {msg.metadata?.proposed_duration_hours || 2} hours
                        </div>

                        {!isMe && !conversation?.is_readonly && (
                          <button
                            type="button"
                            onClick={() => handleAcceptProposal(msg)}
                            disabled={sending}
                            style={{
                              marginTop: '10px',
                              width: '100%',
                              padding: '8px',
                              backgroundColor: 'var(--color-terracotta)',
                              color: '#ffffff',
                              border: '1.5px solid var(--color-terracotta-dark)',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span>Accept Proposed Time</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Card: Confirm Time */}
                    {msg.message_type === 'card_confirm_time' && (
                      <div
                        style={{
                          backgroundColor: 'var(--color-emerald-light)',
                          border: '2px solid var(--color-emerald)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 14px',
                          maxWidth: '85%',
                          width: '300px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-emerald)', fontWeight: 800, fontSize: 'var(--text-xs)' }}>
                          <CheckCircle2 size={16} />
                          <span>SCHEDULE CONFIRMED</span>
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-dark)', marginTop: '4px' }}>
                          {msg.content}
                        </div>
                      </div>
                    )}

                    {/* Card: Share Address (Masked if Completed) */}
                    {msg.message_type === 'card_share_address' && (
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          border: '2px solid var(--color-primary)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '14px',
                          maxWidth: '85%',
                          width: '320px',
                          boxShadow: 'var(--shadow-flat)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', marginBottom: '6px' }}>
                          <MapPin size={16} />
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase' }}>
                            Service Location
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-dark)' }}>
                          {msg.metadata?.full_address || msg.content}
                        </div>
                        {msg.metadata?.landmark && (
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '3px' }}>
                            Landmark: {msg.metadata.landmark}
                          </div>
                        )}
                        <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                          Protected address. Automatically masked 7 days after completion.
                        </div>
                      </div>
                    )}

                    {/* Card: On The Way */}
                    {msg.message_type === 'card_on_the_way' && (
                      <div
                        style={{
                          backgroundColor: 'var(--color-coral-light)',
                          border: '2px solid var(--color-coral)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 14px',
                          maxWidth: '85%',
                          width: '300px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-coral)', fontWeight: 800, fontSize: 'var(--text-xs)' }}>
                          <Truck size={16} />
                          <span>TECHNICIAN ON THE WAY</span>
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-dark)', marginTop: '4px' }}>
                          {msg.content}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Quick Action Cards Bar */}
          {/* ------------------------------------------------------------- */}
          {!conversation?.is_readonly && !notConfirmedNotice && (
            <div
              style={{
                padding: '8px 14px',
                borderTop: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflowX: 'auto'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                Cards:
              </span>

              {/* Propose Time */}
              <button
                type="button"
                onClick={() => {
                  setShowTimePicker(!showTimePicker);
                  setShowAddressForm(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: showTimePicker ? 'var(--color-primary-light)' : '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Calendar size={13} />
                <span>Propose Time</span>
              </button>

              {/* Share Address (Customer Only) */}
              {isCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddressForm(!showAddressForm);
                    setShowTimePicker(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: showAddressForm ? 'var(--color-primary-light)' : '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <MapPin size={13} />
                  <span>Share Address</span>
                </button>
              )}

              {/* On The Way (Provider Only) */}
              {!isCustomer && (
                <button
                  type="button"
                  onClick={handleSendOnTheWay}
                  disabled={sending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Truck size={13} />
                  <span>On The Way</span>
                </button>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Card Form Drawers */}
          {/* ------------------------------------------------------------- */}
          {showTimePicker && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--color-slate-light)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>Date:</span>
                <input
                  type="date"
                  value={propDate}
                  onChange={e => setPropDate(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>Time:</span>
                <input
                  type="time"
                  value={propTime}
                  onChange={e => setPropTime(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>Hours:</span>
                <select
                  value={propDuration}
                  onChange={e => setPropDuration(Number(e.target.value))}
                  style={{ padding: '4px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)' }}
                >
                  <option value={1.0}>1 hour</option>
                  <option value={2.0}>2 hours</option>
                  <option value={3.0}>3 hours</option>
                  <option value={4.0}>4 hours</option>
                </select>
              </div>

              <Button size="sm" variant="primary" onClick={handleSendProposeTime} disabled={sending}>
                Send Proposal Card
              </Button>
            </div>
          )}

          {showAddressForm && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--color-primary-light)',
                borderTop: '1px solid var(--color-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                Share Full Street Address (Only with Assigned Technician):
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Flat/House No, Street, Apartment Name..."
                  value={addressStreet}
                  onChange={e => setAddressStreet(e.target.value)}
                  style={{ flex: 1, minWidth: '220px', padding: '6px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)' }}
                />
                <input
                  type="text"
                  placeholder="Landmark (Optional)"
                  value={addressLandmark}
                  onChange={e => setAddressLandmark(e.target.value)}
                  style={{ width: '160px', padding: '6px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)' }}
                />
                <Button size="sm" variant="primary" onClick={handleSendAddress} disabled={sending || !addressStreet.trim()}>
                  Send Address Card
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Input Footer */}
          {/* ------------------------------------------------------------- */}
          <form
            onSubmit={handleSendText}
            style={{
              padding: '12px 16px',
              borderTop: '2px solid var(--color-border)',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {/* Hidden file input for images */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />

            {/* Image attachment button */}
            <button
              type="button"
              id="attach-image-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={conversation?.is_readonly || !!notConfirmedNotice || sending}
              title="Send photo (auto-compressed, EXIF metadata stripped)"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-xs)',
                border: '1.5px solid var(--color-border)',
                backgroundColor: '#ffffff',
                color: 'var(--color-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: conversation?.is_readonly ? 'not-allowed' : 'pointer'
              }}
            >
              <ImageIcon size={18} />
            </button>

            {/* Text input */}
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                id="chat-input-text"
                placeholder={
                  conversation?.is_readonly
                    ? 'Chat is closed / read-only'
                    : notConfirmedNotice
                      ? 'Waiting for provider confirmation...'
                      : 'Type a message (max 1000 chars)...'
                }
                value={inputText}
                maxLength={1000}
                onChange={e => setInputText(e.target.value)}
                disabled={conversation?.is_readonly || !!notConfirmedNotice || sending}
                style={{
                  width: '100%',
                  padding: '9px 60px 9px 12px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1.5px solid var(--color-border)',
                  fontSize: 'var(--text-sm)',
                  backgroundColor: conversation?.is_readonly ? 'var(--color-slate-light)' : '#ffffff',
                  outline: 'none'
                }}
              />
              {/* Character counter */}
              <span
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: inputText.length > 900 ? 'var(--color-crimson)' : 'var(--color-muted)'
                }}
              >
                {inputText.length}/1000
              </span>
            </div>

            {/* Send Button */}
            <Button
              id="send-chat-btn"
              type="submit"
              variant="primary"
              disabled={!inputText.trim() || conversation?.is_readonly || !!notConfirmedNotice || sending}
              style={{ height: '38px', padding: '0 16px' }}
            >
              <Send size={15} />
            </Button>
          </form>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Masked Call Screen Modal */}
      {/* ----------------------------------------------------------------- */}
      {showCallModal && (
        <MaskedCallModal
          isOpen={showCallModal}
          onClose={() => setShowCallModal(false)}
          counterpartyName={counterpartyName}
          counterpartyRole={counterpartyRole}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Report Abuse Modal */}
      {/* ----------------------------------------------------------------- */}
      {reportTargetMsg && (
        <Modal
          isOpen={!!reportTargetMsg}
          onClose={() => {
            setReportTargetMsg(null);
            setReportReason('');
            setReportSuccess(false);
          }}
          title="Report Inappropriate Conduct"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-dark)' }}>
              Report this message to platform safety. All reports immediately open an official case in the Disputes registry for administrator investigation.
            </p>

            <div
              style={{
                backgroundColor: 'var(--color-slate-light)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xs)',
                padding: '10px',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-muted)'
              }}
            >
              <strong>Message snippet:</strong> {reportTargetMsg.content || '[Structured card message]'}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '4px' }}>
                Reason for report:
              </label>
              <select
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-xs)', border: '1.5px solid var(--color-border)', fontSize: 'var(--text-xs)' }}
              >
                <option value="">Select a reason...</option>
                <option value="Solicitation of off-platform payment">Solicitation of off-platform payment</option>
                <option value="Sharing unauthorized personal phone number">Sharing unauthorized personal phone number</option>
                <option value="Abusive or inappropriate language">Abusive or inappropriate language</option>
                <option value="Harassment or safety concern">Harassment or safety concern</option>
                <option value="Other violation of terms">Other violation of terms</option>
              </select>
            </div>

            {reportSuccess ? (
              <div style={{ color: 'var(--color-emerald)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                Report filed successfully into Disputes registry.
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <Button size="sm" variant="secondary" onClick={() => setReportTargetMsg(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSubmitReport}
                  disabled={!reportReason || reporting}
                >
                  {reporting ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
