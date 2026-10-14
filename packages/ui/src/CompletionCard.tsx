import React, { useState, useEffect, useCallback } from 'react';
import {
  markComplete,
  submitReview,
  claimNoshow,
  reopenAfterNoshow,
  getCompletionStatus,
  subscribeToBookingCompletion,
  type HistoryEntry
} from '@urbanclap/lib';
import { Button } from './Button';
import { Modal } from './Modal';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-react';

// -----------------------------------------------------------------------
// Shared: star input
// -----------------------------------------------------------------------
const StarInput: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="review-modal-stars" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          id={`star-btn-${n}`}
          className={`review-star-btn ${n <= (hovered || value) ? 'active' : ''}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          &#9733;
        </button>
      ))}
    </div>
  );
};

// -----------------------------------------------------------------------
// Inline star display (read-only)
// -----------------------------------------------------------------------
const StarDisplay: React.FC<{ stars: number; size?: number }> = ({ stars, size = 16 }) => (
  <span style={{ display: 'inline-flex', gap: '1px', alignItems: 'center' }}>
    {[1, 2, 3, 4, 5].map(n => (
      <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={n <= stars ? '#f59e0b' : '#d1d5db'} style={{ display: 'block' }}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </span>
);

// -----------------------------------------------------------------------
// CompletionCard: shown on active/confirmed bookings
// -----------------------------------------------------------------------
export interface CompletionCardProps {
  bookingId: string;
  role: 'customer' | 'provider';
  jobTitle: string;
  jobStart: string;
  jobEnd: string;
  onReviewOpen?: () => void;
  onNoshowClaimed?: () => void;
  onReopened?: (newRequestId: string) => void;
}

export const CompletionCard: React.FC<CompletionCardProps> = ({
  bookingId, role, jobTitle, jobStart, jobEnd,
  onReviewOpen, onNoshowClaimed, onReopened
}) => {
  const [status, setStatus]       = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showNoshow, setShowNoshow] = useState(false);
  const [msg, setMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const s = await getCompletionStatus(bookingId);
    setStatus(s);
    if (s?.review_window_open && !s.my_review_submitted) {
      onReviewOpen?.();
    }
  }, [bookingId]);

  useEffect(() => {
    refresh();
    const unsub = subscribeToBookingCompletion(bookingId, () => refresh());
    return unsub;
  }, [bookingId, refresh]);

  const handleMarkComplete = async () => {
    setLoading(true);
    try {
      const res = await markComplete(bookingId, role);
      if (res.both_complete) {
        setMsg({ type: 'success', text: `Both parties confirmed. Review opens at ${new Date(res.review_opens_at!).toLocaleTimeString()}.` });
      } else {
        setMsg({ type: 'success', text: `Your completion marked. Waiting for the other party.` });
      }
      await refresh();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!status) return null;

  const myMark     = role === 'provider' ? status.provider_marked_complete_at : status.customer_marked_complete_at;
  const otherMark  = role === 'provider' ? status.customer_marked_complete_at : status.provider_marked_complete_at;
  const isComplete = status.status === 'completed';
  const isDisputed = status.status === 'disputed';

  const jobStartDate = new Date(jobStart);
  const minsAfterStart = Math.floor((Date.now() - jobStartDate.getTime()) / 60000);

  const canQuickMark = !isComplete && !isDisputed && !myMark;

  return (
    <div
      style={{
        border: `2px solid ${isComplete ? 'var(--color-emerald)' : isDisputed ? 'var(--color-crimson)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        marginTop: '12px',
        backgroundColor: isComplete ? 'var(--color-emerald-light)' : 'var(--bg-card)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 16px' }}>
        <button
          id={`completion-toggle-${bookingId}`}
          onClick={() => setExpanded(e => !e)}
          style={{
            flex: 1, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isComplete
              ? <CheckCircle size={17} color="var(--color-emerald)" />
              : isDisputed
              ? <ShieldAlert size={17} color="var(--color-crimson)" />
              : <Clock size={17} color="var(--color-indigo)" />
            }
            <span style={{ fontWeight: 800, fontSize: 'var(--text-sm)' }}>
              {isComplete ? 'Completed' : isDisputed ? 'Disputed' : 'In Progress'}
            </span>
            {!isComplete && !isDisputed && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 600 }}>
                ({myMark ? 'You marked done' : 'Mark when done'}{otherMark ? ', other party done' : ''})
              </span>
            )}
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {canQuickMark && (
          <Button
            id={`quick-mark-complete-btn-${bookingId}`}
            variant="primary"
            size="sm"
            onClick={handleMarkComplete}
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            <CheckCircle size={14} />
            {loading ? 'Finishing...' : 'Finish Job'}
          </Button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }} className="animate-fadeIn">
          {msg && (
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-xs)',
              backgroundColor: msg.type === 'success' ? 'var(--color-emerald-light)' : 'var(--color-crimson-light)',
              border: `2px solid ${msg.type === 'success' ? 'var(--color-emerald)' : 'var(--color-crimson)'}`,
              fontSize: 'var(--text-sm)', fontWeight: 700,
              color: msg.type === 'success' ? '#065f46' : '#991b1b'
            }}>
              {msg.text}
            </div>
          )}

          {/* Completion progress indicators */}
          {!isComplete && !isDisputed && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{
                padding: '10px', borderRadius: 'var(--radius-xs)',
                border: `2px solid ${status.provider_marked_complete_at ? 'var(--color-emerald)' : 'var(--color-border)'}`,
                backgroundColor: status.provider_marked_complete_at ? 'var(--color-emerald-light)' : '#f8fafc',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Provider</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, marginTop: '4px', color: status.provider_marked_complete_at ? 'var(--color-emerald)' : 'var(--color-muted)' }}>
                  {status.provider_marked_complete_at ? 'Done' : 'Pending'}
                </div>
              </div>
              <div style={{
                padding: '10px', borderRadius: 'var(--radius-xs)',
                border: `2px solid ${status.customer_marked_complete_at ? 'var(--color-emerald)' : 'var(--color-border)'}`,
                backgroundColor: status.customer_marked_complete_at ? 'var(--color-emerald-light)' : '#f8fafc',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Customer</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, marginTop: '4px', color: status.customer_marked_complete_at ? 'var(--color-emerald)' : 'var(--color-muted)' }}>
                  {status.customer_marked_complete_at ? 'Done' : 'Pending'}
                </div>
              </div>
            </div>
          )}

          {/* Mark complete button */}
          {!isComplete && !isDisputed && !myMark && (
            <Button
              id={`mark-complete-btn-${bookingId}`}
              variant="primary"
              size="sm"
              onClick={handleMarkComplete}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <CheckCircle size={14} />
              {loading ? 'Marking...' : 'Mark Job Complete'}
            </Button>
          )}

          {/* Review window */}
          {isComplete && status.review_window_open && !status.my_review_submitted && (
            <Button
              id={`open-review-btn-${bookingId}`}
              variant="gold"
              size="sm"
              onClick={() => setShowReview(true)}
              style={{ width: '100%' }}
            >
              <Star size={14} /> Leave Review
            </Button>
          )}

          {isComplete && !status.review_window_open && status.review_opens_at && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 700, textAlign: 'center' }}>
              Review opens {new Date(status.review_opens_at).toLocaleTimeString()}
            </div>
          )}

          {isComplete && status.my_review_submitted && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-emerald)', fontWeight: 700, textAlign: 'center' }}>
              {status.reviews_revealed ? 'Reviews revealed.' : `Waiting for the other review (or auto-reveal in ${Math.ceil((new Date(status.review_opens_at || '').getTime() + 7 * 86400000 - Date.now()) / 86400000)}d).`}
            </div>
          )}

          {/* No-show claim (customer only, 30+ min after start) */}
          {role === 'customer' && !isDisputed && !isComplete && status.can_claim_noshow && !status.noshow_claimed && (
            <button
              id={`noshow-claim-btn-${bookingId}`}
              className="noshow-btn"
              onClick={() => setShowNoshow(true)}
            >
              <AlertTriangle size={14} /> Provider didn't show up
            </button>
          )}

          {status.can_claim_noshow === false && role === 'customer' && !isComplete && !isDisputed && minsAfterStart > 0 && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
              No-show button available {Math.max(0, 30 - minsAfterStart)}min after job start
            </div>
          )}

          {/* Reopen after no-show */}
          {isDisputed && status.noshow_claimed && role === 'customer' && (
            <Button
              id={`reopen-btn-${bookingId}`}
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  setLoading(true);
                  const res = await reopenAfterNoshow(bookingId);
                  onReopened?.(res.new_request_id!);
                  setMsg({ type: 'success', text: 'New request created with the no-show provider blocked.' });
                } catch (err: any) {
                  setMsg({ type: 'error', text: err.message });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <RotateCcw size={14} /> Reopen This Job (No-Show)
            </Button>
          )}
        </div>
      )}

      {/* Review Modal */}
      {showReview && (
        <ReviewModal
          bookingId={bookingId}
          role={role}
          jobTitle={jobTitle}
          onClose={() => setShowReview(false)}
          onSuccess={() => {
            setShowReview(false);
            setMsg({ type: 'success', text: 'Review submitted. Coins will be awarded when both reviews are in.' });
            refresh();
          }}
        />
      )}

      {/* No-show Modal */}
      {showNoshow && (
        <NoshowModal
          bookingId={bookingId}
          jobTitle={jobTitle}
          jobStart={jobStart}
          onClose={() => setShowNoshow(false)}
          onSuccess={() => {
            setShowNoshow(false);
            onNoshowClaimed?.();
            refresh();
          }}
        />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------
// ReviewModal: blind review for both roles
// -----------------------------------------------------------------------
export interface ReviewModalProps {
  bookingId: string;
  role: 'customer' | 'provider';
  jobTitle: string;
  onClose: () => void;
  onSuccess: (result: { completion_coins: number; bonus_coins: number }) => void;
}

const PROVIDER_TAGS = [
  'Professional',
  'On Time',
  'Good Communication',
  'Clean Workspace',
  'Skilled',
  'Friendly',
  'Thorough',
  'Value for Money',
];

const CUSTOMER_TAGS = [
  'Clear Instructions',
  'Polite',
  'Home was Ready',
  'Quick Payment',
  'Good Location Access',
  'Responsive',
];

export const ReviewModal: React.FC<ReviewModalProps> = ({
  bookingId, role, jobTitle, onClose, onSuccess
}) => {
  const [stars, setStars]             = useState(0);
  const [feedback, setFeedback]       = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [paidAgreed, setPaidAgreed]   = useState<boolean | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const tags = role === 'provider' ? CUSTOMER_TAGS : PROVIDER_TAGS;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stars === 0) { setError('Please select a star rating.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await submitReview({
        bookingId,
        stars,
        feedback: feedback.trim() || undefined,
        tags: selectedTags.length ? selectedTags : undefined,
        paidAgreedAmount: role === 'provider' ? paidAgreed ?? undefined : undefined,
      });
      onSuccess({ completion_coins: res.completion_coins ?? 0, bonus_coins: res.bonus_coins ?? 0 });
    } catch (err: any) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
      <div className="modal-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 id="review-modal-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>
              {role === 'customer' ? 'Rate Your Technician' : 'Rate This Customer'}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>
              {jobTitle} &mdash; Blind review (revealed when both submit or in 7 days)
            </p>
          </div>
          <button
            id="review-modal-close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--color-muted)' }}
            aria-label="Close review modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stars */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: 'var(--text-sm)', marginBottom: '2px' }}>
              Star Rating <span style={{ color: 'var(--color-crimson)' }}>*</span>
            </label>
            <StarInput value={stars} onChange={setStars} />
            {stars > 0 && (
              <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                {['', 'Very unsatisfied', 'Unsatisfied', 'Okay', 'Satisfied', 'Very satisfied'][stars]}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: 'var(--text-sm)', marginBottom: '8px' }}>
              Tags (optional)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  id={`tag-${tag.replace(/\s+/g, '-').toLowerCase()}`}
                  className={`tag-chip ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Provider: paid agreed amount */}
          {role === 'provider' && (
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: 'var(--text-sm)', marginBottom: '8px' }}>
                Did the customer pay the agreed amount?
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    type="button"
                    id={`paid-agreed-${v}`}
                    className={`btn-flat btn-flat-sm ${paidAgreed === v ? '' : 'btn-flat-secondary'}`}
                    onClick={() => setPaidAgreed(v)}
                  >
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          <div>
            <label
              htmlFor="review-feedback"
              style={{ display: 'block', fontWeight: 800, fontSize: 'var(--text-sm)', marginBottom: '4px' }}
            >
              Feedback (optional)
            </label>
            <textarea
              id="review-feedback"
              className="flat-input flat-textarea"
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              maxLength={500}
              placeholder="Share details about your experience..."
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
              {feedback.length}/500
            </div>
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--color-crimson-light)', border: '2px solid var(--color-crimson)',
              fontSize: 'var(--text-sm)', fontWeight: 700, color: '#991b1b'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              id="submit-review-btn"
              type="submit"
              variant="gold"
              disabled={loading || stars === 0}
              style={{ flex: 1 }}
            >
              <Star size={14} />
              {loading ? 'Submitting...' : 'Submit Review'}
            </Button>
            <Button id="cancel-review-btn" type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------
// NoshowModal: compulsory reason before filing no-show claim
// -----------------------------------------------------------------------
export interface NoshowModalProps {
  bookingId: string;
  jobTitle: string;
  jobStart: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NoshowModal: React.FC<NoshowModalProps> = ({
  bookingId, jobTitle, jobStart, onClose, onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) { setError('Please provide at least 10 characters explaining what happened.'); return; }
    setLoading(true);
    setError('');
    try {
      await claimNoshow(bookingId, reason.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit no-show claim.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="noshow-modal-title">
      <div className="modal-card" style={{ padding: '24px', maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-crimson-light)', border: '2px solid var(--color-crimson)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <AlertTriangle size={20} color="var(--color-crimson)" />
          </div>
          <div>
            <h2 id="noshow-modal-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>
              Provider Didn't Show Up
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
              {jobTitle} at {new Date(jobStart).toLocaleString()}
            </p>
          </div>
        </div>

        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-xs)',
          backgroundColor: 'var(--color-amber-light)', border: '2px solid var(--color-amber)',
          fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '16px',
          color: '#78350f'
        }}>
          Filing a no-show claim will automatically apply a penalty to the provider and create a dispute for admin review. This action cannot be undone.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="noshow-reason"
              style={{ display: 'block', fontWeight: 800, fontSize: 'var(--text-sm)', marginBottom: '4px' }}
            >
              What happened? <span style={{ color: 'var(--color-crimson)' }}>*</span>
            </label>
            <textarea
              id="noshow-reason"
              className="flat-input flat-textarea"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe the situation (e.g. waited 45 minutes, no call or message)..."
              minLength={10}
              required
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: reason.length < 10 ? 'var(--color-crimson)' : 'var(--color-muted)', marginTop: '2px' }}>
              {reason.length} / 10 min
            </div>
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--color-crimson-light)', border: '2px solid var(--color-crimson)',
              fontSize: 'var(--text-sm)', fontWeight: 700, color: '#991b1b'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              id="submit-noshow-btn"
              type="submit"
              variant="red"
              disabled={loading || reason.trim().length < 10}
              style={{ flex: 1 }}
            >
              <AlertTriangle size={14} />
              {loading ? 'Filing...' : 'File No-Show Claim'}
            </Button>
            <Button id="cancel-noshow-btn" type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------
// HistoryCard: reusable in both apps
// -----------------------------------------------------------------------
export interface HistoryCardProps {
  entry: HistoryEntry;
  role: 'customer' | 'provider';
  onReview?: (bookingId: string) => void;
  onReopen?: (bookingId: string) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ entry, role, onReview, onReopen }) => {
  const [expanded, setExpanded] = useState(false);
  const isNoshow  = !!entry.noshow_claimed_at;
  const myStars   = entry.my_review_stars;
  const otherStars = entry.other_review_stars;

  const statusColor: Record<string, string> = {
    completed: 'var(--color-emerald)',
    disputed:  'var(--color-crimson)',
  };

  return (
    <div className="history-card animate-fadeIn">
      <div className="history-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span
              className="flat-badge"
              style={{
                color: statusColor[entry.status] || 'var(--color-muted)',
                borderColor: statusColor[entry.status] || 'var(--color-muted)',
                backgroundColor: 'transparent'
              }}
            >
              {entry.status}
            </span>
            <span className={`flat-badge ${entry.request_type === 'emergency' ? 'badge-emergency' : 'badge-ordinary'}`}>
              {entry.request_type}
            </span>
            {isNoshow && <span className="flat-badge badge-warning">No-show filed</span>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 'var(--text-md)', marginBottom: '2px' }}>{entry.title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            {role === 'customer'
              ? `Technician: ${entry.provider_name}`
              : `Customer: ${entry.customer_name}`
            }
            {' | '}
            {new Date(entry.job_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' | Rs '}
            {entry.offered_price}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {/* My review stars */}
          {myStars && entry.my_review_revealed && (
            <StarDisplay stars={myStars} size={14} />
          )}
          <button
            id={`history-toggle-${entry.booking_id}`}
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="history-card-body animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Review status row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* My review */}
            <div style={{
              padding: '10px', borderRadius: 'var(--radius-xs)',
              border: '2px solid var(--color-border)', backgroundColor: 'var(--bg-card)'
            }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Your Review
              </div>
              {myStars ? (
                <>
                  <StarDisplay stars={myStars} size={16} />
                  {entry.my_review_revealed && entry.my_review_feedback && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px' }}>
                      &quot;{entry.my_review_feedback}&quot;
                    </div>
                  )}
                  {!entry.my_review_revealed && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      Hidden until both reviews submitted or 7 days
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                    {entry.review_opens_at
                      ? new Date(entry.review_opens_at) > new Date()
                        ? `Opens ${new Date(entry.review_opens_at).toLocaleTimeString()}`
                        : 'Window open'
                      : 'Not yet open'}
                  </span>
                  {entry.review_opens_at && new Date(entry.review_opens_at) <= new Date() && onReview && (
                    <button
                      id={`inline-review-btn-${entry.booking_id}`}
                      className="btn-flat btn-flat-sm btn-flat-gold"
                      onClick={() => onReview(entry.booking_id)}
                    >
                      <Star size={12} /> Review Now
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Other party review */}
            <div style={{
              padding: '10px', borderRadius: 'var(--radius-xs)',
              border: '2px solid var(--color-border)', backgroundColor: 'var(--bg-card)'
            }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {role === 'customer' ? 'Technician Review' : 'Customer Review'}
              </div>
              {otherStars && entry.other_review_revealed ? (
                <>
                  <StarDisplay stars={otherStars} size={16} />
                  {entry.other_review_feedback && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px' }}>
                      &quot;{entry.other_review_feedback}&quot;
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                  {otherStars ? 'Submitted, waiting for reveal' : 'Not yet submitted'}
                </div>
              )}
            </div>
          </div>

          {/* Completion source */}
          {entry.completion_source && entry.completion_source !== 'both' && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 600 }}>
              Auto-completed: {entry.completion_source.replace(/_/g, ' ')}
            </div>
          )}

          {/* No-show reopen button */}
          {isNoshow && role === 'customer' && onReopen && (
            <Button
              id={`reopen-hist-btn-${entry.booking_id}`}
              variant="secondary"
              size="sm"
              onClick={() => onReopen(entry.booking_id)}
            >
              <RotateCcw size={13} /> Reopen Job (No-Show)
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
