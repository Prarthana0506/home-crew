import React, { useState } from 'react';
import { useAuth, legacySubmitReview, type ServiceRequest, type PendingReviewInfo } from '@urbanclap/lib';
import { Modal } from './Modal';
import { Button } from './Button';
import { Star, ShieldAlert } from 'lucide-react';

export interface CompulsoryReviewModalProps {
  request: ServiceRequest | PendingReviewInfo | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CompulsoryReviewModal: React.FC<CompulsoryReviewModalProps> = ({
  request,
  onClose,
  onSuccess
}) => {
  const { authUser } = useAuth();
  const [stars, setStars] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!request) return null;

  const requestId = 'request_id' in request ? request.request_id : request.id;
  const isPendingInfo = 'category_name' in request && !('status' in request);

  const revieweeId = isPendingInfo
    ? (request as PendingReviewInfo).provider_user_id || undefined
    : (request as ServiceRequest).customer_id === authUser?.id
    ? (request as ServiceRequest).assigned_provider?.user_id
    : (request as ServiceRequest).customer_id;

  const direction = isPendingInfo
    ? 'customer_to_provider'
    : (request as ServiceRequest).customer_id === authUser?.id
    ? 'customer_to_provider'
    : 'provider_to_customer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser?.id) return;

    setLoading(true);
    setErrorMsg('');
    try {
      await legacySubmitReview({
        requestId,
        reviewerId: authUser.id,
        revieweeId,
        direction,
        rating: stars,
        feedback: feedback.trim()
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(request)}
      onClose={onClose}
      title="Compulsory Service Review"
      subtitle="Reviews remain blind until both customer and provider submit, ensuring fair, honest evaluation."
    >
      {errorMsg && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '8px',
          padding: '10px 12px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#991b1b',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>
            Rating (1 to 5 Stars)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3, 4, 5].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setStars(val)}
                style={{
                  background: val <= stars ? 'var(--color-gold)' : '#ffffff',
                  border: '2px solid var(--color-teal-dark)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: val <= stars ? '#ffffff' : 'var(--color-dark)',
                  fontWeight: 800,
                  boxShadow: '2px 2px 0px var(--color-teal-dark)'
                }}
              >
                <Star size={16} fill={val <= stars ? '#ffffff' : 'none'} />
                <span>{val}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
            Optional Feedback
          </label>
          <textarea
            className="flat-textarea"
            rows={3}
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Share details about the service quality, timeliness, and professionalism..."
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Submitting...' : 'Submit Blind Review'}
        </Button>
      </form>
    </Modal>
  );
};
