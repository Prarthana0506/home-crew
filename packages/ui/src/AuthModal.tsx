import React, { useState } from 'react';
import { useAuth, t, type ProviderType } from '@urbanclap/lib';
import { Modal } from './Modal';
import { Button } from './Button';
import { Mail, Lock, User, Briefcase, Building, AlertCircle } from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'signin'
}) => {
  const { appRole, language, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(appRole === 'admin' ? 'signin' : defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [providerType, setProviderType] = useState<ProviderType>('freelancer');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalTitle =
    mode === 'signin'
      ? appRole === 'admin'
        ? t('auth_admin_title', language)
        : appRole === 'provider'
        ? t('auth_provider_title', language)
        : t('auth_customer_title', language)
      : appRole === 'provider'
      ? t('auth_provider_signup_title', language)
      : t('auth_customer_signup_title', language);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, fullName.trim(), providerType);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setErrorMsg('Supabase is not connected. Please set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
      } else {
        setErrorMsg(msg || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication failed.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      {/* Switcher between sign in and sign up if not admin */}
      {appRole !== 'admin' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMsg(''); }}
            className={`btn-flat btn-flat-sm ${mode === 'signin' ? '' : 'btn-flat-secondary'}`}
            style={{ flex: 1 }}
          >
            {t('btn_sign_in', language)}
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg(''); }}
            className={`btn-flat btn-flat-sm ${mode === 'signup' ? '' : 'btn-flat-secondary'}`}
            style={{ flex: 1 }}
          >
            {t('btn_sign_up', language)}
          </button>
        </div>
      )}

      {/* Google OAuth Button */}
      {appRole !== 'admin' && (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="btn-flat btn-flat-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{t('auth_continue_google', language)}</span>
          </button>
          <div style={{ textAlign: 'center', margin: '14px 0 4px', fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 700 }}>
            {t('auth_or_email', language)}
          </div>
        </div>
      )}

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
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Full Name for signup */}
        {mode === 'signup' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-dark)' }}>
              {t('profile_name_label', language)}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="flat-input"
                placeholder="Aarav Sharma"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
              <User size={16} color="var(--color-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
            </div>
          </div>
        )}

        {/* Provider Type Selection for provider signup */}
        {mode === 'signup' && appRole === 'provider' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-dark)' }}>
              {t('auth_provider_type_label', language)}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                onClick={() => setProviderType('freelancer')}
                style={{
                  border: `2px solid ${providerType === 'freelancer' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                  backgroundColor: providerType === 'freelancer' ? 'var(--color-coral-light)' : '#ffffff',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: providerType === 'freelancer' ? '2px 2px 0px var(--color-terracotta)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-dark)' }}>
                  <Briefcase size={16} color="var(--color-terracotta)" />
                  {t('auth_type_freelancer', language)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                  {t('auth_type_freelancer_desc', language)}
                </div>
              </div>

              <div
                onClick={() => setProviderType('organization_owner')}
                style={{
                  border: `2px solid ${providerType === 'organization_owner' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                  backgroundColor: providerType === 'organization_owner' ? 'var(--color-coral-light)' : '#ffffff',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: providerType === 'organization_owner' ? '2px 2px 0px var(--color-terracotta)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-dark)' }}>
                  <Building size={16} color="var(--color-teal-dark)" />
                  {t('auth_type_organization', language)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                  {t('auth_type_organization_desc', language)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-dark)' }}>
            {t('auth_email_label', language)}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              className="flat-input"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Mail size={16} color="var(--color-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
          </div>
        </div>

        {/* Password */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-dark)' }}>
            {t('auth_password_label', language)}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              className="flat-input"
              placeholder="password123"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Lock size={16} color="var(--color-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant={appRole === 'provider' ? 'red' : 'primary'}
          disabled={loading}
          style={{ width: '100%', marginTop: '6px' }}
        >
          {loading ? t('btn_loading', language) : mode === 'signin' ? t('btn_sign_in', language) : t('btn_sign_up', language)}
        </Button>
      </form>
    </Modal>
  );
};
