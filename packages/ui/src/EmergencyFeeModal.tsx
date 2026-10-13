import React, { useState } from 'react';
import { recordEmergencyFeePayment } from '@urbanclap/lib';
import { Modal } from './Modal';
import { Button } from './Button';
import { Zap, CheckCircle, ShieldCheck, AlertCircle, CreditCard } from 'lucide-react';

export interface EmergencyFeeModalProps {
  isOpen: boolean;
  feeAmount: number;
  customerId: string;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
}

export const EmergencyFeeModal: React.FC<EmergencyFeeModalProps> = ({
  isOpen,
  feeAmount,
  customerId,
  onClose,
  onSuccess
}) => {
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isWaived = feeAmount <= 0;

  const handleConfirmOrPay = async () => {
    if (!customerId) {
      setErrorMsg('Customer identification required for payment record.');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);

    try {
      if (isWaived) {
        const paymentId = await recordEmergencyFeePayment({
          customerId,
          amount: 0,
          status: 'waived',
          paymentMethod: 'WAIVED_POLICY'
        });
        onSuccess(paymentId);
      } else {
        // Simulated instant payment
        const paymentId = await recordEmergencyFeePayment({
          customerId,
          amount: feeAmount,
          status: 'paid',
          paymentMethod: 'UPI'
        });
        onSuccess(paymentId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment processing failed');
      setProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={processing ? () => {} : onClose}
      title={isWaived ? 'Emergency Dispatch Fee' : 'Pay Emergency Dispatch Fee'}
      subtitle={
        isWaived
          ? 'Platform emergency dispatch fee policy'
          : 'Emergency jobs trigger instant 45-minute live bidding across local providers.'
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {errorMsg && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              border: '2px solid #ef4444',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#991b1b',
              fontSize: '0.85rem',
              fontWeight: 700
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {isWaived ? (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '2px solid var(--color-teal-dark)',
              borderRadius: '10px',
              padding: '18px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                padding: '10px',
                backgroundColor: '#dcfce7',
                borderRadius: '8px',
                border: '2px solid var(--color-teal-dark)',
                marginBottom: '10px'
              }}
            >
              <CheckCircle size={28} color="var(--color-teal-dark)" />
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
              No fee right now
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--color-muted)', marginTop: '6px' }}>
              The emergency dispatch fee is currently waived by platform settings. Your request will broadcast live into the bidding arena immediately.
            </p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--color-coral-light)',
              border: '2px solid var(--color-terracotta)',
              borderRadius: '10px',
              padding: '18px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="flat-badge badge-emergency" style={{ fontSize: '0.72rem' }}>
                  URGENT DISPATCH
                </span>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-terracotta)', marginTop: '4px' }}>
                  Rs {feeAmount}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '2px solid var(--color-terracotta)',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
              >
                <Zap size={14} color="var(--color-terracotta)" />
                <span>Live Arena Access</span>
              </div>
            </div>

            <div
              style={{
                marginTop: '14px',
                borderTop: '1px dashed var(--color-terracotta)',
                paddingTop: '12px',
                fontSize: '0.82rem',
                color: 'var(--color-dark)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color="var(--color-teal-dark)" />
                <span>Broadcasting to providers within 13 km search radius</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={16} color="var(--color-teal-dark)" />
                <span>Simulated payment test environment (Always succeeds)</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <Button
            type="button"
            variant="secondary"
            disabled={processing}
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant={isWaived ? 'primary' : 'red'}
            disabled={processing}
            onClick={handleConfirmOrPay}
            style={{ flex: 2 }}
          >
            {processing ? (
              'Processing...'
            ) : isWaived ? (
              'Proceed (Fee Waived)'
            ) : (
              `Simulate Payment (Rs ${feeAmount})`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
