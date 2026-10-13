import React from 'react';
import {
  FileText,
  Clock,
  CalendarCheck,
  Wrench,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export type JobStatusStep = 'draft' | 'open' | 'bidding' | 'confirmed' | 'in_progress' | 'completed' | 'disputed';

export interface JobStatusStepperProps {
  currentStatus: string;
  type?: 'ordinary' | 'emergency';
}

interface StepDef {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export const JobStatusStepper: React.FC<JobStatusStepperProps> = ({ currentStatus, type = 'ordinary' }) => {
  const steps: StepDef[] = [
    { key: 'posted',      label: 'Posted',            icon: <FileText size={14} /> },
    { key: 'matching',    label: type === 'emergency' ? 'Bidding' : 'Matched', icon: <Clock size={14} /> },
    { key: 'confirmed',   label: 'Scheduled',         icon: <CalendarCheck size={14} /> },
    { key: 'in_progress', label: 'In Progress',       icon: <Wrench size={14} /> },
    { key: 'completed',   label: 'Done & Reviewed',   icon: <CheckCircle size={14} /> }
  ];

  // Determine active step index (0-based)
  const getStepIndex = (status: string): number => {
    switch (status) {
      case 'draft':
      case 'pending':
      case 'open':
        return 0;
      case 'bidding_active':
      case 'interest_window':
      case 'bidding_open':
      case 'notified':
      case 'widen_radius':
      case 'extended':
        return 1;
      case 'assigned':
      case 'confirmed':
      case 'hold':
        return 2;
      case 'in_progress':
        return 3;
      case 'completed':
        return 4;
      default:
        return 1;
    }
  };

  const isDisputed = currentStatus === 'disputed' || currentStatus === 'noshow';
  const activeIdx = isDisputed ? -1 : getStepIndex(currentStatus);

  return (
    <div
      style={{
        padding: '12px 14px',
        backgroundColor: '#ffffff',
        border: '2px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '12px'
      }}
      aria-label="Job Status Stepper"
    >
      {isDisputed ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          color: 'var(--color-crimson)', fontWeight: 700, fontSize: 'var(--text-sm)'
        }}>
          <AlertCircle size={16} />
          <span>Job in Dispute / No-Show Resolution</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: '6px',
          alignItems: 'center'
        }}>
          {steps.map((st, i) => {
            const isCompleted = i < activeIdx;
            const isCurrent = i === activeIdx;

            const borderColor = isCurrent
              ? 'var(--color-primary)'
              : isCompleted
                ? 'var(--color-emerald)'
                : 'var(--color-border)';

            const bgColor = isCurrent
              ? 'var(--color-primary-light)'
              : isCompleted
                ? 'var(--color-emerald-light)'
                : '#f8fafc';

            const textColor = isCurrent
              ? 'var(--color-primary-dark)'
              : isCompleted
                ? 'var(--color-emerald)'
                : 'var(--color-muted)';

            return (
              <div
                key={st.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '6px 4px',
                  borderRadius: 'var(--radius-xs)',
                  border: `2px solid ${borderColor}`,
                  backgroundColor: bgColor,
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ color: textColor, marginBottom: '2px', display: 'flex', alignItems: 'center' }}>
                  {isCompleted ? <CheckCircle size={14} /> : st.icon}
                </div>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: isCurrent ? 800 : 600,
                  color: textColor,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%'
                }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
