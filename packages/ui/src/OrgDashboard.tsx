/**
 * OrgDashboard.tsx – Organization owner dashboard
 * All technician management on ONE screen:
 *   - Org aggregate rating banner (active technicians only)
 *   - Add technician form: name, phone, photo, ID proof, skills, categories, hours
 *   - Pending-approval section + Approve button
 *   - Active technicians roster: coins, rating, next free slot, eligibility breakdown
 *   - Remove with confirmation modal + explicit warning about coins/rating/carry-over
 *   - Emergency pick modal: select eligible technician + coin amount
 */
import React, { useState, useCallback } from 'react';
import {
  Users, UserPlus, Star, Coins, Clock, CheckCircle, AlertCircle,
  Lock, Unlock, Phone, FileText, Trash2, RefreshCw,
  ShieldCheck, ShieldAlert, Zap, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TechnicianDashboardRow {
  provider_profile_id: string;
  user_id: string;
  organization_id: string;
  technician_name: string;
  technician_phone?: string;
  avatar?: string;
  photo_url?: string;
  id_proof_url?: string;
  skills?: string[];
  categories?: string[];
  experience?: number;
  working_hours?: { start: string; end: string };
  provider_status: 'active' | 'left' | 'pending' | 'rejected';
  admin_approved: boolean;
  bid_banned_until?: string | null;
  rating_avg: number;
  review_count: number;
  coins: number;
  available_coins: number;
  upcoming_job_count: number;
  next_busy_until?: string | null;
  is_eligible_to_bid: boolean;
  has_enough_coins: boolean;
  has_enough_reviews: boolean;
  has_good_rating: boolean;
  is_active: boolean;
  is_approved: boolean;
  not_banned: boolean;
}

export interface OrgRating {
  active_technician_count: number;
  rating_avg: number;
  total_reviews: number;
  total_active_coins: number;
}

export interface AddTechFormData {
  name: string;
  phone: string;
  photoUrl: string;
  idProofUrl: string;
  skills: string;
  categories: string;
  experience: number;
  workingStart: string;
  workingEnd: string;
}

export interface OrgDashboardProps {
  technicians: TechnicianDashboardRow[];
  orgRating?: OrgRating | null;
  organizationId: string;
  organizationName?: string;
  loading?: boolean;
  onAddTechnician: (form: AddTechFormData) => Promise<{ success: boolean; error?: string; had_prior_record?: boolean }>;
  onApproveTechnician: (profileId: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveTechnician: (profileId: string) => Promise<{ success: boolean; error?: string; warning?: string; upcoming_job_count?: number }>;
  onReassign?: (bookingId: string, newProfileId: string) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  emergencyRequestId?: string;
  onPickForEmergency?: (techProfileId: string, coins: number) => Promise<{ success: boolean; error?: string; reasons?: string[] }>;
}

// ─── CSS-in-JS constants ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-muted)',
  display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px',
};

const statTileStyle: React.CSSProperties = {
  border: '1.5px solid var(--color-border)', borderRadius: '8px',
  padding: '8px 10px', backgroundColor: '#f8fafc', minWidth: '70px', textAlign: 'center',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.64rem', fontWeight: 700, color: 'var(--color-muted)',
  textTransform: 'uppercase', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: '3px', marginBottom: '2px',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', border: '2px solid var(--color-teal-dark)',
  borderRadius: '12px', boxShadow: 'var(--shadow-flat-lg)', padding: '24px',
  width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
};

const CATEGORY_OPTIONS = [
  { value: 'cat_electrical', label: 'Electrical' },
  { value: 'cat_plumbing', label: 'Plumbing' },
  { value: 'cat_cleaning', label: 'Cleaning' },
  { value: 'cat_appliance', label: 'Appliance Repair' },
  { value: 'cat_carpentry', label: 'Carpentry' },
  { value: 'cat_painting', label: 'Painting' },
  { value: 'cat_pest', label: 'Pest Control' },
  { value: 'cat_ac', label: 'AC Service' },
];

const INITIAL_FORM: AddTechFormData = {
  name: '', phone: '', photoUrl: '', idProofUrl: '',
  skills: '', categories: 'cat_electrical', experience: 0,
  workingStart: '08:00', workingEnd: '19:00',
};

// ─── Mini utilities ───────────────────────────────────────────────────────────

const StatusPill: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '2px 7px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800,
    backgroundColor: ok ? 'var(--color-emerald-light)' : 'var(--color-crimson-light)',
    color: ok ? '#065f46' : '#991b1b',
    border: `1px solid ${ok ? '#6ee7b7' : '#fca5a5'}`,
  }}>
    {ok ? <CheckCircle size={10} /> : <X size={10} />}
    {label}
  </span>
);

const MiniBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '3px' }}>
    <div style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`, height: '100%', backgroundColor: color }} />
  </div>
);

const TechAvatar: React.FC<{ tech: TechnicianDashboardRow; size?: number }> = ({ tech, size = 42 }) => {
  const src = tech.photo_url || tech.avatar;
  return (
    <div style={{
      width: size, height: size, borderRadius: '8px',
      border: '2px solid var(--color-teal-dark)', overflow: 'hidden', flexShrink: 0,
      backgroundColor: 'var(--color-teal-light)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: `${size * 0.4}px`, color: 'var(--color-teal-dark)',
    }}>
      {src
        ? <img src={src} alt={tech.technician_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (tech.technician_name?.charAt(0).toUpperCase() || '?')
      }
    </div>
  );
};

// ─── Add Technician Form ──────────────────────────────────────────────────────

const AddTechPanel: React.FC<{ onSubmit: (form: AddTechFormData) => Promise<void>; submitting: boolean }> = ({ onSubmit, submitting }) => {
  const [form, setForm] = useState<AddTechFormData>(INITIAL_FORM);
  const [open, setOpen] = useState(false);
  const set = (key: keyof AddTechFormData, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    setForm(INITIAL_FORM);
    setOpen(false);
  };

  return (
    <div style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px', boxShadow: 'var(--shadow-flat)' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', backgroundColor: 'var(--color-teal-dark)', color: '#ffffff',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '0.95rem',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} /> Add New Technician
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} style={{ padding: '20px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}><Users size={12} /> Full Name <span style={{ color: 'var(--color-terracotta)' }}>*</span></label>
              <input className="flat-input" placeholder="e.g. Ramesh Kumar" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}><Phone size={12} /> Phone <span style={{ color: 'var(--color-terracotta)' }}>*</span></label>
              <input className="flat-input" type="tel" placeholder="9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} required minLength={10} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Photo URL (optional)</label>
              <input className="flat-input" type="url" placeholder="https://…/photo.jpg" value={form.photoUrl} onChange={e => set('photoUrl', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}><FileText size={12} /> ID Proof URL (optional)</label>
              <input className="flat-input" type="url" placeholder="https://…/aadhaar.pdf" value={form.idProofUrl} onChange={e => set('idProofUrl', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.5fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Skills (comma-separated)</label>
              <input className="flat-input" placeholder="wiring, fan, switchboard" value={form.skills} onChange={e => set('skills', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Category <span style={{ color: 'var(--color-terracotta)' }}>*</span></label>
              <select className="flat-select" value={form.categories} onChange={e => set('categories', e.target.value)}>
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Exp (yrs)</label>
              <input className="flat-input" type="number" min={0} max={40} value={form.experience} onChange={e => set('experience', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}><Clock size={12} /> Work Start</label>
              <input className="flat-input" type="time" value={form.workingStart} onChange={e => set('workingStart', e.target.value)} style={{ width: '110px' }} />
            </div>
            <div>
              <label style={labelStyle}>Work End</label>
              <input className="flat-input" type="time" value={form.workingEnd} onChange={e => set('workingEnd', e.target.value)} style={{ width: '110px' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add Technician'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

// ─── Remove Modal ─────────────────────────────────────────────────────────────

const RemoveModal: React.FC<{
  tech: TechnicianDashboardRow;
  onConfirm: () => void;
  onCancel: () => void;
  removing: boolean;
}> = ({ tech, onConfirm, onCancel, removing }) => (
  <div style={overlayStyle}>
    <div style={modalStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <ShieldAlert size={22} color="var(--color-terracotta)" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-dark)' }}>Remove Technician</h3>
      </div>

      <p style={{ fontSize: '0.88rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
        You are about to <strong>archive {tech.technician_name}</strong> from your organization.
      </p>

      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--color-amber-light)', border: '1.5px solid #d97706', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.7 }}>
        <strong>Warning:</strong>
        <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
          <li>Their <strong>{tech.coins} coin(s)</strong> are frozen — coins are <em>non-transferable</em> and cannot be moved.</li>
          <li>Their <strong>{tech.rating_avg.toFixed(1)}★ rating</strong> and {tech.review_count} review(s) will no longer count toward organization rating.</li>
          <li>If this technician <strong>rejoins later</strong>, they start with <strong>0 coins</strong>. Active bid bans and open disputes carry over by verified identity.</li>
          <li>This action is <strong>irreversible</strong> (status = left).</li>
        </ul>
      </div>

      {tech.upcoming_job_count > 0 && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'var(--color-crimson-light)', border: '1.5px solid #ef4444', borderRadius: '8px', fontSize: '0.82rem', color: '#991b1b', fontWeight: 700 }}>
          Cannot remove — {tech.upcoming_job_count} upcoming job(s) assigned. Reassign or complete them first.
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} disabled={removing}>Cancel</Button>
        <Button variant="red" onClick={onConfirm} disabled={removing || tech.upcoming_job_count > 0}>
          {removing ? 'Removing…' : 'Confirm Remove'}
        </Button>
      </div>
    </div>
  </div>
);

// ─── Emergency Pick Modal ─────────────────────────────────────────────────────

const EmergencyPickModal: React.FC<{
  technicians: TechnicianDashboardRow[];
  requestId: string;
  onPick: (techId: string, coins: number) => Promise<void>;
  onClose: () => void;
}> = ({ technicians, onPick, onClose }) => {
  const [selectedId, setSelectedId] = useState('');
  const [coins, setCoins] = useState(36);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const eligible = technicians.filter(t => t.is_eligible_to_bid);
  const selected = technicians.find(t => t.provider_profile_id === selectedId);

  const handlePick = async () => {
    if (!selectedId) return;
    setPicking(true);
    setMsg(null);
    try {
      await onPick(selectedId, coins);
      setMsg({ type: 'success', text: 'Bid placed! Coins are now locked for this technician.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to place bid' });
    } finally {
      setPicking(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: '560px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color="var(--color-terracotta)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Pick Technician for Emergency Bid</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color="var(--color-muted)" />
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: 'var(--color-muted)', marginBottom: '14px' }}>
          Select an eligible technician. Their available coins will be soft-locked. Bid button is disabled if any eligibility check fails.
        </p>

        {eligible.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)', fontWeight: 700 }}>
            No eligible technicians available right now.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
            {eligible.map(tech => (
              <label key={tech.provider_profile_id} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                border: `2px solid ${selectedId === tech.provider_profile_id ? 'var(--color-teal-dark)' : 'var(--color-border)'}`,
                borderRadius: '8px', cursor: 'pointer',
                backgroundColor: selectedId === tech.provider_profile_id ? 'var(--color-teal-light)' : '#ffffff',
              }}>
                <input type="radio" name="tech_pick" value={tech.provider_profile_id} checked={selectedId === tech.provider_profile_id} onChange={() => setSelectedId(tech.provider_profile_id)} />
                <TechAvatar tech={tech} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{tech.technician_name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)' }}>
                    {tech.available_coins} available coins · {tech.rating_avg.toFixed(1)}★ · {tech.review_count} reviews
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {selected && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Coins to bid:</label>
            <input type="number" className="flat-input" style={{ width: '100px' }} min={36} max={selected.available_coins} value={coins} onChange={e => setCoins(parseInt(e.target.value) || 36)} />
            <span style={{ fontSize: '0.76rem', color: 'var(--color-muted)' }}>(max: {selected.available_coins} available)</span>
          </div>
        )}

        {msg && (
          <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 700, backgroundColor: msg.type === 'error' ? 'var(--color-crimson-light)' : 'var(--color-emerald-light)', color: msg.type === 'error' ? '#991b1b' : '#065f46', border: `1.5px solid ${msg.type === 'error' ? '#fca5a5' : '#6ee7b7'}` }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="red" onClick={handlePick} disabled={!selectedId || picking || coins < 36}>
            {picking ? 'Placing Bid…' : 'Place Emergency Bid'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Technician Card ──────────────────────────────────────────────────────────

const TechCard: React.FC<{
  tech: TechnicianDashboardRow;
  onApprove: (id: string) => void;
  onRemoveClick: (tech: TechnicianDashboardRow) => void;
  approving: string | null;
  emergencyRequestId?: string;
  onPickForEmergency?: () => void;
}> = ({ tech, onApprove, onRemoveClick, approving, emergencyRequestId, onPickForEmergency }) => {
  const [showDetails, setShowDetails] = useState(false);

  const statusColor: Record<string, string> = {
    active: '#16a34a', pending: '#d97706', left: '#6b7280', rejected: '#dc2626',
  };
  const color = statusColor[tech.provider_status] ?? '#6b7280';

  const nextFreeLabel = tech.next_busy_until
    ? `Busy until ${new Date(tech.next_busy_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
    : 'Available Now';

  return (
    <div style={{
      border: `2px solid ${tech.provider_status === 'left' ? '#cbd5e1' : 'var(--color-teal-dark)'}`,
      borderRadius: '10px',
      backgroundColor: tech.provider_status === 'left' ? '#f8fafc' : '#ffffff',
      opacity: tech.provider_status === 'left' ? 0.65 : 1,
      boxShadow: tech.provider_status !== 'left' ? 'var(--shadow-flat-sm)' : 'none',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', flexWrap: 'wrap' }}>
        <TechAvatar tech={tech} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--color-dark)' }}>{tech.technician_name}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: `${color}20`, color, border: `1px solid ${color}`, textTransform: 'uppercase' as const }}>
              {tech.provider_status}
            </span>
            {tech.admin_approved && tech.provider_status === 'active' && <ShieldCheck size={14} color="#16a34a" />}
            {!tech.admin_approved && tech.provider_status !== 'left' && <ShieldAlert size={14} color="#d97706" />}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--color-muted)', marginTop: '2px' }}>
            {tech.technician_phone || '–'} · {(tech.categories || []).join(', ') || '–'}
            {tech.experience ? ` · ${tech.experience}yr exp` : ''}
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={statTileStyle}>
            <div style={statLabelStyle}><Coins size={11} /> Coins</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: tech.has_enough_coins ? '#16a34a' : '#dc2626' }}>{tech.available_coins}</div>
            <MiniBar value={tech.available_coins} max={Math.max(35, tech.coins)} color={tech.has_enough_coins ? '#16a34a' : '#dc2626'} />
          </div>

          <div style={statTileStyle}>
            <div style={statLabelStyle}><Star size={11} /> Rating</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: tech.has_good_rating ? '#d97706' : '#dc2626' }}>{tech.rating_avg.toFixed(1)}★</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-muted)' }}>{tech.review_count} reviews</div>
          </div>

          <div style={{ ...statTileStyle, minWidth: '100px' }}>
            <div style={statLabelStyle}><Clock size={11} /> Schedule</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tech.upcoming_job_count > 0 ? '#dc2626' : '#16a34a' }}>
              {tech.upcoming_job_count > 0 ? `${tech.upcoming_job_count} job(s)` : 'Free'}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--color-muted)' }}>{nextFreeLabel}</div>
          </div>

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
            borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: tech.is_eligible_to_bid ? 'var(--color-emerald-light)' : 'var(--color-crimson-light)',
            color: tech.is_eligible_to_bid ? '#065f46' : '#991b1b',
            border: `1.5px solid ${tech.is_eligible_to_bid ? '#6ee7b7' : '#fca5a5'}`,
          }}>
            {tech.is_eligible_to_bid ? <Unlock size={11} /> : <Lock size={11} />}
            {tech.is_eligible_to_bid ? 'BID ELIGIBLE' : 'NOT ELIGIBLE'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          {!tech.admin_approved && tech.provider_status !== 'left' && (
            <Button size="sm" variant="primary" onClick={() => onApprove(tech.provider_profile_id)} disabled={approving === tech.provider_profile_id}>
              {approving === tech.provider_profile_id ? 'Approving…' : 'Approve'}
            </Button>
          )}
          {emergencyRequestId && tech.is_eligible_to_bid && onPickForEmergency && (
            <Button size="sm" variant="red" onClick={onPickForEmergency}>
              <Zap size={13} /> Pick for Emergency
            </Button>
          )}
          {tech.provider_status !== 'left' && (
            <Button size="sm" variant="secondary" onClick={() => onRemoveClick(tech)}>
              <Trash2 size={13} /> Remove
            </Button>
          )}
          <button type="button" onClick={() => setShowDetails(d => !d)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 0' }}>
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showDetails ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {/* Expandable details */}
      {showDetails && (
        <div style={{ borderTop: '1px dashed var(--color-border)', padding: '12px 16px', backgroundColor: '#fafafa' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Eligibility Breakdown</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            <StatusPill ok={tech.has_enough_coins} label={`${tech.available_coins} coins`} />
            <StatusPill ok={tech.has_enough_reviews} label={`${tech.review_count} reviews`} />
            <StatusPill ok={tech.has_good_rating} label={`${tech.rating_avg.toFixed(1)} rating`} />
            <StatusPill ok={tech.is_active} label={tech.provider_status} />
            <StatusPill ok={tech.is_approved} label={tech.admin_approved ? 'Approved' : 'Pending'} />
            <StatusPill ok={tech.not_banned} label={tech.not_banned ? 'Not Banned' : 'Banned'} />
          </div>

          {tech.bid_banned_until && new Date(tech.bid_banned_until) > new Date() && (
            <div style={{ marginTop: '8px', padding: '8px 10px', backgroundColor: 'var(--color-crimson-light)', borderRadius: '6px', fontSize: '0.78rem', color: '#991b1b', fontWeight: 700 }}>
              Bid ban active until: {new Date(tech.bid_banned_until).toLocaleString('en-IN')}
            </div>
          )}

          {tech.working_hours && (
            <div style={{ marginTop: '8px', color: 'var(--color-muted)', fontSize: '0.78rem' }}>
              <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Working hours: {(tech.working_hours as any).start || '08:00'} – {(tech.working_hours as any).end || '19:00'}
            </div>
          )}

          {tech.id_proof_url && (
            <div style={{ marginTop: '6px' }}>
              <a href={tech.id_proof_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-teal-dark)', fontSize: '0.78rem', textDecoration: 'underline' }}>
                <FileText size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> View ID Proof
              </a>
            </div>
          )}

          {tech.skills && tech.skills.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {tech.skills.map((s, i) => (
                <span key={i} style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'var(--color-teal-light)', color: 'var(--color-teal-dark)', border: '1px solid #99f6e4' }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main OrgDashboard ────────────────────────────────────────────────────────

export const OrgDashboard: React.FC<OrgDashboardProps> = ({
  technicians, orgRating, organizationName, loading,
  onAddTechnician, onApproveTechnician, onRemoveTechnician,
  onRefresh, emergencyRequestId, onPickForEmergency,
}) => {
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TechnicianDashboardRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success' | 'warn'; text: string } | null>(null);
  const [showEmergencyPick, setShowEmergencyPick] = useState(false);

  const activeTechs = technicians.filter(t => t.provider_status === 'active');
  const pendingTechs = technicians.filter(t => t.provider_status === 'pending');
  const archivedTechs = technicians.filter(t => t.provider_status === 'left');

  const showMsg = useCallback((type: 'error' | 'success' | 'warn', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 7000);
  }, []);

  const handleAdd = async (form: AddTechFormData) => {
    setSubmittingAdd(true);
    try {
      const res = await onAddTechnician(form);
      if (!res.success) {
        showMsg('error', res.error || 'Failed to add technician');
      } else {
        showMsg('success', res.had_prior_record
          ? 'Technician added! Prior identity detected — bid bans and open disputes carry over. Profile starts with 0 coins.'
          : 'Technician added. Approve them to activate bidding eligibility.');
      }
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await onApproveTechnician(id);
      if (!res.success) showMsg('error', res.error || 'Failed to approve');
      else showMsg('success', 'Technician approved and activated!');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await onRemoveTechnician(removeTarget.provider_profile_id);
      if (!res.success) showMsg('error', res.error || 'Failed to remove technician');
      else {
        showMsg('warn', res.warning || 'Technician archived.');
        setRemoveTarget(null);
      }
    } finally {
      setRemoving(false);
    }
  };

  const handleEmergencyPick = async (techId: string, coins: number) => {
    if (!onPickForEmergency || !emergencyRequestId) return;
    const res = await onPickForEmergency(techId, coins);
    if (!res.success) {
      throw new Error(res.reasons?.length ? res.reasons.join('. ') : res.error || 'Failed to place bid');
    }
    setShowEmergencyPick(false);
    showMsg('success', 'Emergency bid placed! Coins locked for selected technician.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-teal-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} /> {organizationName || 'Organization'} — Technician Dashboard
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
            Manage your team, check eligibility, and assign jobs — all in one place.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {emergencyRequestId && onPickForEmergency && (
            <Button variant="red" size="sm" onClick={() => setShowEmergencyPick(true)}>
              <Zap size={14} /> Pick Tech for Emergency
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Org Rating Banner */}
      {orgRating && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Active Technicians', value: orgRating.active_technician_count, icon: <Users size={16} />, color: 'var(--color-teal-dark)' },
            { label: 'Org Rating (Active Only)', value: `${orgRating.rating_avg.toFixed(2)}★`, icon: <Star size={16} />, color: '#d97706' },
            { label: 'Total Reviews', value: orgRating.total_reviews, icon: <CheckCircle size={16} />, color: '#16a34a' },
            { label: 'Total Active Coins', value: orgRating.total_active_coins, icon: <Coins size={16} />, color: '#92400e' },
          ].map(tile => (
            <div key={tile.label} style={{ border: `2px solid ${tile.color}`, borderRadius: '10px', padding: '14px', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-flat-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: tile.color, marginBottom: '4px' }}>
                {tile.icon}
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>{tile.label}</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: tile.color }}>{tile.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.86rem',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          backgroundColor: msg.type === 'error' ? 'var(--color-crimson-light)' : msg.type === 'warn' ? 'var(--color-amber-light)' : 'var(--color-emerald-light)',
          color: msg.type === 'error' ? '#991b1b' : msg.type === 'warn' ? '#92400e' : '#065f46',
          border: `1.5px solid ${msg.type === 'error' ? '#fca5a5' : msg.type === 'warn' ? '#d97706' : '#6ee7b7'}`,
        }}>
          {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Add Form */}
      <AddTechPanel onSubmit={handleAdd} submitting={submittingAdd} />

      {/* Pending */}
      {pendingTechs.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <ShieldAlert size={16} color="#d97706" />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#92400e' }}>Pending Approval ({pendingTechs.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingTechs.map(tech => (
              <TechCard key={tech.provider_profile_id} tech={tech} onApprove={handleApprove} onRemoveClick={setRemoveTarget} approving={approvingId} emergencyRequestId={emergencyRequestId} onPickForEmergency={emergencyRequestId && onPickForEmergency && tech.is_eligible_to_bid ? () => setShowEmergencyPick(true) : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* Active */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <ShieldCheck size={16} color="#16a34a" />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Active Technicians ({activeTechs.length})</h3>
        </div>
        {activeTechs.length === 0 ? (
          <Card><div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-muted)' }}>No active technicians. Add one above and approve them.</div></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeTechs.map(tech => (
              <TechCard key={tech.provider_profile_id} tech={tech} onApprove={handleApprove} onRemoveClick={setRemoveTarget} approving={approvingId} emergencyRequestId={emergencyRequestId} onPickForEmergency={emergencyRequestId && onPickForEmergency && tech.is_eligible_to_bid ? () => setShowEmergencyPick(true) : undefined} />
            ))}
          </div>
        )}
      </section>

      {/* Archived */}
      {archivedTechs.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <AlertCircle size={16} color="var(--color-muted)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-muted)' }}>Archived / Left ({archivedTechs.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {archivedTechs.map(tech => (
              <TechCard key={tech.provider_profile_id} tech={tech} onApprove={handleApprove} onRemoveClick={setRemoveTarget} approving={approvingId} />
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      {removeTarget && (
        <RemoveModal tech={removeTarget} onConfirm={handleRemoveConfirm} onCancel={() => setRemoveTarget(null)} removing={removing} />
      )}
      {showEmergencyPick && emergencyRequestId && onPickForEmergency && (
        <EmergencyPickModal technicians={technicians} requestId={emergencyRequestId} onPick={handleEmergencyPick} onClose={() => setShowEmergencyPick(false)} />
      )}
    </div>
  );
};

export default OrgDashboard;
