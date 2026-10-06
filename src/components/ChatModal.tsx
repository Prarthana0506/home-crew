import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { ChatMessage } from '../types';
import { X, Send, Image as ImageIcon, Clock, User } from 'lucide-react';

export const ChatModal: React.FC = () => {
  const { activeChatRequestId, closeChat, requests, currentUser, sendChatMessage } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const request = requests.find(r => r.id === activeChatRequestId);

  const loadMessages = async () => {
    if (!activeChatRequestId) return;
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${activeChatRequestId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.warn('Failed to load chat messages', err);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [activeChatRequestId]);

  if (!activeChatRequestId || !request) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !imageUrl.trim()) return;

    setLoading(true);
    try {
      await sendChatMessage(activeChatRequestId, inputText, imageUrl);
      setInputText('');
      setImageUrl('');
      setShowImageInput(false);
      await loadMessages();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="flat-card" style={{
        maxWidth: '560px',
        width: '100%',
        height: '600px',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        {/* Chat Header */}
        <div style={{
          backgroundColor: 'var(--color-teal-dark)',
          color: '#ffffff',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--color-teal-dark)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`flat-badge ${request.service_type === 'emergency' ? 'badge-emergency' : 'badge-ordinary'}`}>
                {request.service_type.toUpperCase()}
              </span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{request.title}</h3>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#d0e5e8', marginTop: '2px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> Customer: {request.customer_name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Scheduled: {request.scheduled_date}</span>
            </div>
          </div>

          <button
            onClick={closeChat}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Work Info Bar */}
        <div style={{
          backgroundColor: 'var(--bg-sand)',
          padding: '10px 16px',
          borderBottom: '1.5px solid var(--color-teal-dark)',
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Assigned Provider:</strong> {request.assigned_provider_name || 'Pending Bidding Selection'}
          </div>
          <div>
            <strong>Price:</strong> ₹{request.final_price}
          </div>
        </div>

        {/* Message Stream */}
        <div style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: '#fafafa'
        }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-muted)', margin: 'auto', fontSize: '0.9rem' }}>
              No chat messages yet. Start discussing appointment timing or share photo details!
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUser?.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '2px', fontWeight: 600 }}>
                    {msg.sender_name} ({msg.sender_role})
                  </span>

                  <div style={{
                    backgroundColor: isMe ? 'var(--color-teal-dark)' : '#ffffff',
                    color: isMe ? '#ffffff' : 'var(--color-dark)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--color-teal-dark)',
                    boxShadow: '2px 2px 0px rgba(0,0,0,0.1)',
                    fontSize: '0.9rem'
                  }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                    {msg.attachment_url && (
                      <img
                        src={msg.attachment_url}
                        alt="attachment"
                        style={{
                          marginTop: '8px',
                          maxWidth: '100%',
                          maxHeight: '180px',
                          borderRadius: '8px',
                          border: '1px solid #ddd'
                        }}
                      />
                    )}
                  </div>

                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSend} style={{
          padding: '12px 16px',
          borderTop: '2px solid var(--color-teal-dark)',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {showImageInput && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="url"
                className="flat-input"
                placeholder="Paste Image URL (e.g., https://images.unsplash.com/...)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              />
              <button
                type="button"
                className="btn-flat btn-flat-secondary"
                onClick={() => setShowImageInput(false)}
                style={{ padding: '6px 10px', fontSize: '0.78rem' }}
              >
                Cancel
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-flat btn-flat-secondary"
              onClick={() => setShowImageInput(!showImageInput)}
              style={{ padding: '10px', borderRadius: '8px' }}
              title="Attach Image"
            >
              <ImageIcon size={18} />
            </button>

            <input
              type="text"
              className="flat-input"
              placeholder="Type timing updates, exact address, or issues..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={{ flex: 1 }}
            />

            <button type="submit" disabled={loading} className="btn-flat btn-flat-red">
              <Send size={18} /> Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
