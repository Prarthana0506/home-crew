import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Star, AlertCircle, Coins, CheckCircle } from 'lucide-react';

export const CompulsoryReviewModal: React.FC = () => {
  const { compulsoryReviewRequestId, requests, submitReview } = useApp();
  const [stars, setStars] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!compulsoryReviewRequestId) return null;

  const targetRequest = requests.find(r => r.id === compulsoryReviewRequestId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stars === 0) {
      setError('Please select a star rating from 1 to 5 stars (Compulsory).');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await submitReview(compulsoryReviewRequestId, stars, feedback);
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const calculatedCoins = 25 + stars;

  return (
    <div className="modal-overlay">
      <div className="flat-card" style={{ maxWidth: '480px', width: '100%', padding: '28px', backgroundColor: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            backgroundColor: 'var(--color-gold-light)',
            padding: '8px',
            borderRadius: '10px',
            border: '2px solid var(--color-gold)',
            color: 'var(--color-gold)'
          }}>
            <Star size={24} fill="var(--color-gold)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
              Compulsory Service Review
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              {targetRequest?.category_name} - {targetRequest?.assigned_provider_name}
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--color-teal-light)',
          padding: '12px 14px',
          borderRadius: '10px',
          border: '1px solid var(--color-teal-mid)',
          marginBottom: '18px',
          fontSize: '0.88rem'
        }}>
          <p style={{ fontWeight: 700, color: 'var(--color-teal-dark)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Coins size={16} /> Provider Rewards Breakdown:
          </p>
          <ul style={{ paddingLeft: '20px', color: 'var(--color-dark)' }}>
            <li>Base Ordinary Service: <strong>25 coins</strong></li>
            <li>Star Rating Bonus: <strong>+{stars > 0 ? stars : '1 to 5'} bonus coins</strong></li>
            {stars > 0 && (
              <li style={{ color: 'var(--color-terracotta)', fontWeight: 800, marginTop: '4px' }}>
                Total Awarded: {calculatedCoins} Coins to {targetRequest?.assigned_provider_name}!
              </li>
            )}
          </ul>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--color-coral-light)',
            color: 'var(--color-terracotta-dark)',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1.5px solid var(--color-terracotta)',
            marginBottom: '16px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Star Selection */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>
              Rating <span style={{ color: 'var(--color-terracotta)' }}>* (Required)</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setStars(s); setError(''); }}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: '8px',
                    border: `2px solid ${stars >= s ? 'var(--color-gold)' : 'var(--color-teal-dark)'}`,
                    backgroundColor: stars >= s ? 'var(--color-gold-light)' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: stars >= s ? '2px 2px 0px var(--color-gold)' : 'none'
                  }}
                >
                  <Star
                    size={22}
                    color={stars >= s ? 'var(--color-gold)' : '#cbd5e1'}
                    fill={stars >= s ? 'var(--color-gold)' : 'none'}
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-dark)' }}>{s}★</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Written Feedback */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
              Written Feedback <span style={{ fontWeight: 500, color: 'var(--color-muted)' }}>(Optional)</span>
            </label>
            <textarea
              className="flat-textarea"
              rows={3}
              placeholder="Tell us about the service quality, punctuality, or craftsmanship..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn-flat btn-flat-gold"
              style={{ flex: 1 }}
            >
              <CheckCircle size={18} /> Submit Review & Award Coins
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
