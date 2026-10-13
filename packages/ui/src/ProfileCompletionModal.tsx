import React, { useState, useEffect } from 'react';
import { useAuth, t, fetchAreas, fetchCategories, type Area, type ServiceCategory, type ProviderType, type Language } from '@urbanclap/lib';
import { Modal } from './Modal';
import { Button } from './Button';
import { CheckCircle2, ShieldAlert, Phone, MapPin, Globe, Briefcase } from 'lucide-react';

export const ProfileCompletionModal: React.FC = () => {
  const { authUser, profile, providerProfile, appRole, language, setLanguage, completeProfile, isProfileComplete } = useAuth();

  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [fullName, setFullName] = useState(profile?.name || authUser?.user_metadata?.full_name || '');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language || 'en');
  const [selectedAreaId, setSelectedAreaId] = useState<string>(profile?.area_id || '');
  const [phone, setPhone] = useState(profile?.phone || '+91 98765 43210');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(profile?.phone_demo_verified || false);
  const [otpError, setOtpError] = useState('');

  // Provider specific state
  const [providerType, setProviderType] = useState<ProviderType>(providerProfile?.provider_type || 'freelancer');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(providerProfile?.categories || []);
  const [experience, setExperience] = useState<number>(providerProfile?.experience || 3);
  const [idReference, setIdReference] = useState('Aadhaar: 8492-4810-9301');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchAreas().then(data => {
      setAreas(data);
      if (!selectedAreaId && data.length > 0) {
        setSelectedAreaId(data[0].id);
      }
    });

    if (appRole === 'provider') {
      fetchCategories().then(data => {
        setCategories(data);
        if (selectedCategories.length === 0 && data.length > 0) {
          setSelectedCategories([data[0].slug]);
        }
      });
    }
  }, [appRole]);

  // If already complete or no session, do not render
  if (!authUser || isProfileComplete) return null;

  const handleSendOtp = () => {
    if (!phone.trim()) {
      setOtpError('Please enter a valid mobile number.');
      return;
    }
    setOtpSent(true);
    setOtpError('');
  };

  const handleVerifyOtp = () => {
    if (otpInput.trim() === '123456') {
      setPhoneVerified(true);
      setOtpError('');
    } else {
      setOtpError(t('profile_otp_invalid', selectedLanguage));
    }
  };

  const toggleCategory = (slug: string) => {
    if (selectedCategories.includes(slug)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter(s => s !== slug));
      }
    } else {
      setSelectedCategories([...selectedCategories, slug]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }

    if (!selectedAreaId) {
      setErrorMsg('Please select your Coimbatore locality.');
      return;
    }

    if (!phoneVerified) {
      setErrorMsg('Please verify your mobile number with demo OTP 123456 before continuing.');
      return;
    }

    if (appRole === 'provider' && selectedCategories.length === 0) {
      setErrorMsg('Please select at least one primary service category.');
      return;
    }

    setLoading(true);
    try {
      await completeProfile({
        name: fullName.trim(),
        phone: phone.trim(),
        language: selectedLanguage,
        area_id: selectedAreaId,
        providerDetails:
          appRole === 'provider'
            ? {
                provider_type: providerType,
                categories: selectedCategories,
                experience,
                id_proof_url: idReference
              }
            : undefined
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      title={t('profile_completion_title', selectedLanguage)}
      subtitle={t('profile_completion_subtitle', selectedLanguage)}
      canDismiss={false}
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Full Name */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
            {t('profile_name_label', selectedLanguage)}
          </label>
          <input
            type="text"
            className="flat-input"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Aarav Sharma"
            required
          />
        </div>

        {/* Preferred Language */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Globe size={15} /> {t('profile_language_label', selectedLanguage)}
            </span>
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => { setSelectedLanguage('en'); setLanguage('en'); }}
              className={`btn-flat btn-flat-sm ${selectedLanguage === 'en' ? '' : 'btn-flat-secondary'}`}
              style={{ flex: 1 }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => { setSelectedLanguage('ta'); setLanguage('ta'); }}
              className={`btn-flat btn-flat-sm ${selectedLanguage === 'ta' ? '' : 'btn-flat-secondary'}`}
              style={{ flex: 1 }}
            >
              தமிழ் (Tamil)
            </button>
          </div>
        </div>

        {/* Coimbatore Locality Area Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={15} /> {t('profile_area_label', selectedLanguage)}
            </span>
          </label>
          <select
            className="flat-select"
            value={selectedAreaId}
            onChange={e => setSelectedAreaId(e.target.value)}
            required
          >
            {areas.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} (Pincode: {a.pincode})
              </option>
            ))}
          </select>
        </div>

        {/* Phone & Demo OTP verification */}
        <div style={{ backgroundColor: 'var(--bg-sand)', padding: '12px', borderRadius: '8px', border: '2px solid var(--color-teal-dark)' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={15} /> {t('profile_phone_label', selectedLanguage)}
            </span>
          </label>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="tel"
              className="flat-input"
              value={phone}
              onChange={e => { setPhone(e.target.value); setPhoneVerified(false); }}
              placeholder="+91 98765 43210"
              disabled={phoneVerified}
              style={{ flex: 1 }}
              required
            />
            {!phoneVerified && (
              <Button type="button" size="sm" variant="secondary" onClick={handleSendOtp}>
                {t('profile_otp_button', selectedLanguage)}
              </Button>
            )}
          </div>

          {phoneVerified ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontSize: '0.82rem', fontWeight: 700 }}>
              <CheckCircle2 size={16} />
              <span>{t('profile_otp_verified', selectedLanguage)}</span>
            </div>
          ) : otpSent ? (
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="flat-input"
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value)}
                  placeholder="123456"
                  style={{ maxWidth: '140px' }}
                />
                <Button type="button" size="sm" variant="gold" onClick={handleVerifyOtp}>
                  Verify OTP
                </Button>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                {t('profile_otp_label', selectedLanguage)}
              </div>
              {otpError && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>
                  {otpError}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Provider Specific Trade Details */}
        {appRole === 'provider' && (
          <div style={{ borderTop: '2px dashed var(--color-teal-dark)', paddingTop: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '8px' }}>
              {t('profile_provider_trade_title', selectedLanguage)}
            </h3>

            {/* Provider Type */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                {t('auth_provider_type_label', selectedLanguage)}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setProviderType('freelancer')}
                  className={`btn-flat btn-flat-sm ${providerType === 'freelancer' ? 'btn-flat-red' : 'btn-flat-secondary'}`}
                  style={{ flex: 1 }}
                >
                  {t('auth_type_freelancer', selectedLanguage)}
                </button>
                <button
                  type="button"
                  onClick={() => setProviderType('organization_owner')}
                  className={`btn-flat btn-flat-sm ${providerType === 'organization_owner' ? 'btn-flat-red' : 'btn-flat-secondary'}`}
                  style={{ flex: 1 }}
                >
                  {t('auth_type_organization', selectedLanguage)}
                </button>
              </div>
            </div>

            {/* Primary Categories */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                {t('profile_categories_label', selectedLanguage)}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {categories.map(c => {
                  const selected = selectedCategories.includes(c.slug);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.slug)}
                      className="flat-badge"
                      style={{
                        backgroundColor: selected ? 'var(--color-terracotta)' : '#ffffff',
                        color: selected ? '#ffffff' : 'var(--color-dark)',
                        borderColor: selected ? 'var(--color-terracotta-dark)' : 'var(--color-teal-dark)',
                        cursor: 'pointer',
                        padding: '6px 10px'
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Experience and ID proof */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  {t('profile_experience_label', selectedLanguage)}
                </label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  className="flat-input"
                  value={experience}
                  onChange={e => setExperience(parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  {t('profile_id_proof_label', selectedLanguage)}
                </label>
                <input
                  type="text"
                  className="flat-input"
                  value={idReference}
                  onChange={e => setIdReference(e.target.value)}
                  placeholder="Aadhaar / Trade Card reference"
                  required
                />
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          variant={appRole === 'provider' ? 'red' : 'primary'}
          disabled={loading || !phoneVerified}
          style={{ width: '100%', marginTop: '8px' }}
        >
          {loading ? t('btn_loading', selectedLanguage) : t('btn_complete_profile', selectedLanguage)}
        </Button>
      </form>
    </Modal>
  );
};
