import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, LogIn, UserPlus, User, Wrench, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { loginUser, signupUser } = useApp();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<'customer' | 'provider' | 'both'>('both');
  const [providerType, setProviderType] = useState<'freelancer' | 'organization'>('freelancer');
  const [mobileNumber, setMobileNumber] = useState('');
  const [exactAddress, setExactAddress] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [orgName, setOrgName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [area, setArea] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await loginUser(email, password || 'password123');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Incorrect email or password.');
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!acceptTerms) { setError('You must accept the Terms & Conditions and Service Agreement to register.'); return; }

    if (role === 'provider' || role === 'both') {
      if (!mobileNumber.trim()) { setError('Mobile Phone Number is required for provider verification.'); return; }
      if (!exactAddress.trim()) { setError('Exact Address is required for safety verification.'); return; }
      if (!aadharNumber.trim()) { setError('Aadhar Card / Govt ID number is required for background checks.'); return; }
      if (providerType === 'organization') {
        if (!orgName.trim()) { setError('Organization registered name is required.'); return; }
        if (!gstNumber.trim()) { setError('GST / Trade Reg Number is required for organization accounts.'); return; }
      }
    }

    setError(''); setLoading(true);
    try {
      await signupUser({
        name,
        email,
        password: password || 'password123',
        role,
        area: area || 'Downtown Metro',
        provider_type: (role === 'customer') ? 'either' : providerType,
        mobile_number: mobileNumber,
        exact_address: exactAddress,
        aadhar_number: aadharNumber,
        org_name: orgName,
        gst_number: gstNumber
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not create account. Try a different email.');
    } finally { setLoading(false); }
  };

  // Quick demo logins
  const demos = [
    { email: 'aarav@urbanclap.com', label: 'Demo Customer', role: 'Customer' },
    { email: 'rajesh@quickfix.com', label: 'Demo Provider', role: 'Provider' },
  ];

  const handleDemo = async (demoEmail: string) => {
    setError(''); setLoading(true);
    try {
      await loginUser(demoEmail, 'password123');
      onClose();
    } catch (err: any) { setError('Demo login failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {/* Top awning stripe */}
        <div className="awning-banner" style={{ borderRadius: '18px 18px 0 0' }} />

        {/* Header */}
        <div style={{ padding: '20px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-teal-dark)' }}>
              {tab === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '2px' }}>
              One account: switch roles anytime after login.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-muted)' }}>
            <X size={22} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ padding: '14px 22px 0', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setTab('login'); reset(); }}
            className={`btn-flat ${tab === 'login' ? '' : 'btn-flat-secondary'}`}
            style={{ flex: 1, fontSize: '0.9rem', padding: '9px', boxShadow: tab === 'login' ? 'var(--shadow-flat)' : 'none' }}>
            <LogIn size={16} /> Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); reset(); }}
            className={`btn-flat ${tab === 'signup' ? 'btn-flat-gold' : 'btn-flat-secondary'}`}
            style={{ flex: 1, fontSize: '0.9rem', padding: '9px', boxShadow: tab === 'signup' ? 'var(--shadow-flat-gold)' : 'none' }}>
            <UserPlus size={16} /> Register
          </button>
        </div>

        {/* Form body */}
        <div style={{ padding: '18px 22px 22px' }}>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--color-coral-light)', border: '2px solid var(--color-terracotta)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-terracotta-dark)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px', color: 'var(--color-teal-dark)' }}>Email</label>
                <input type="email" className="flat-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px', color: 'var(--color-teal-dark)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} className="flat-input" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-flat btn-flat-red" style={{ width: '100%', padding: '12px', marginTop: '4px' }}>
                <LogIn size={17} /> {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Role selector */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', color: 'var(--color-teal-dark)' }}>I want to join as</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                  <button type="button" onClick={() => setRole('customer')} style={{
                    padding: '10px 8px', borderRadius: '10px', border: `2px solid ${role === 'customer' ? '#0ea5e9' : 'var(--color-teal-dark)'}`,
                    background: role === 'customer' ? '#e0f2fe' : '#fff', cursor: 'pointer', transition: 'all .15s',
                    boxShadow: role === 'customer' ? '2px 2px 0 #0369a1' : 'none'
                  }}>
                    <User size={20} color={role === 'customer' ? '#0369a1' : 'var(--color-teal-dark)'} style={{ margin: '0 auto 4px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: role === 'customer' ? '#0369a1' : 'var(--color-teal-dark)' }}>Customer</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '2px' }}>Need services</div>
                  </button>

                  <button type="button" onClick={() => setRole('provider')} style={{
                    padding: '10px 8px', borderRadius: '10px', border: `2px solid ${role === 'provider' ? '#c47e1a' : 'var(--color-teal-dark)'}`,
                    background: role === 'provider' ? 'var(--color-gold-light)' : '#fff', cursor: 'pointer', transition: 'all .15s',
                    boxShadow: role === 'provider' ? 'var(--shadow-flat-gold)' : 'none'
                  }}>
                    <Wrench size={20} color={role === 'provider' ? '#c47e1a' : 'var(--color-teal-dark)'} style={{ margin: '0 auto 4px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: role === 'provider' ? '#c47e1a' : 'var(--color-teal-dark)' }}>Provider</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '2px' }}>Offer services</div>
                  </button>

                  <button type="button" onClick={() => setRole('both')} style={{
                    padding: '10px 8px', borderRadius: '10px', border: `2px solid ${role === 'both' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                    background: role === 'both' ? 'var(--color-coral-light)' : '#fff', cursor: 'pointer', transition: 'all .15s',
                    boxShadow: role === 'both' ? 'var(--shadow-flat-red)' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', margin: '0 auto 4px' }}>
                      <User size={18} color={role === 'both' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'} />
                      <Wrench size={18} color={role === 'both' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: role === 'both' ? 'var(--color-terracotta-dark)' : 'var(--color-teal-dark)' }}>Both Roles</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '2px' }}>Switch pill enabled</div>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px', color: 'var(--color-teal-dark)' }}>Full Name</label>
                <input type="text" className="flat-input" placeholder="e.g. Priya Sharma" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px', color: 'var(--color-teal-dark)' }}>Email</label>
                <input type="email" className="flat-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px', color: 'var(--color-teal-dark)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} className="flat-input" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '5px', color: 'var(--color-teal-dark)' }}>Your Area / City</label>
                <input type="text" className="flat-input" placeholder="e.g. Downtown, Bangalore" value={area} onChange={e => setArea(e.target.value)} />
              </div>

              {/* Provider & Organization Verification Details (For safety & future dispute resolution) */}
              {(role === 'provider' || role === 'both') && (
                <div style={{ backgroundColor: 'var(--color-gold-light)', border: '2px solid var(--color-gold)', borderRadius: '12px', padding: '14px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-teal-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="var(--color-teal-dark)" /> Provider Identity &amp; Safety Verification
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '-6px' }}>
                    Required for identity verification, background safety checks, and resolving future customer disputes.
                  </p>

                  {/* Provider Entity Type */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px', color: 'var(--color-teal-dark)' }}>Are you an Individual or an Organization? *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => setProviderType('freelancer')} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${providerType === 'freelancer' ? 'var(--color-teal-dark)' : '#cbd5e1'}`,
                        background: providerType === 'freelancer' ? '#fff' : 'transparent', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                        boxShadow: providerType === 'freelancer' ? 'var(--shadow-flat-sm)' : 'none'
                      }}>
                        Individual / Freelancer
                      </button>
                      <button type="button" onClick={() => setProviderType('organization')} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${providerType === 'organization' ? 'var(--color-gold)' : '#cbd5e1'}`,
                        background: providerType === 'organization' ? '#fff' : 'transparent', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                        boxShadow: providerType === 'organization' ? 'var(--shadow-flat-gold)' : 'none'
                      }}>
                        Registered Organization
                      </button>
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px', color: 'var(--color-teal-dark)' }}>Mobile Phone Number *</label>
                    <input type="tel" className="flat-input" placeholder="+91 98765 43210" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} required />
                  </div>

                  {/* Exact Address */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px', color: 'var(--color-teal-dark)' }}>Exact Street / Shop Address *</label>
                    <textarea className="flat-textarea" rows={2} placeholder="Door No, Street Name, Landmark, Pincode" value={exactAddress} onChange={e => setExactAddress(e.target.value)} required />
                  </div>

                  {/* Aadhar / Govt ID */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px', color: 'var(--color-teal-dark)' }}>Aadhar Card / Govt ID Number *</label>
                    <input type="text" className="flat-input" placeholder="e.g. 1234 5678 9012" value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} required />
                  </div>

                  {/* Organization specific details */}
                  {providerType === 'organization' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px', color: 'var(--color-teal-dark)' }}>Organization Registered Name *</label>
                        <input type="text" className="flat-input" placeholder="e.g. QuickFix Services Pvt Ltd" value={orgName} onChange={e => setOrgName(e.target.value)} required />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px', color: 'var(--color-teal-dark)' }}>GST / Trade Registration Number *</label>
                        <input type="text" className="flat-input" placeholder="e.g. 29ABCDE1234F1ZH" value={gstNumber} onChange={e => setGstNumber(e.target.value)} required />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Terms and Conditions Checkbox */}
              <div style={{
                backgroundColor: 'var(--bg-sand)',
                border: '2px solid var(--color-teal-dark)',
                borderRadius: '10px',
                padding: '10px 12px'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--color-teal-dark)', lineHeight: 1.4 }}>
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={e => setAcceptTerms(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: 'var(--color-terracotta)', width: '16px', height: '16px', cursor: 'pointer' }}
                    required
                  />
                  <span>
                    I agree to the <strong>Terms & Conditions & Service Agreement</strong>. I understand that amounts listed or offered are <strong>charges for service labor only</strong>, and <strong>not for materials</strong> (spare parts/materials are paid separately).
                  </span>
                </label>
              </div>

              <button type="submit" disabled={loading} className="btn-flat btn-flat-gold" style={{ width: '100%', padding: '12px', marginTop: '4px' }}>
                <UserPlus size={17} /> {loading ? 'Creating…' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Quick demo logins */}
          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '2px dashed var(--color-teal-light)' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textAlign: 'center', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Try a demo account</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {demos.map(d => (
                <button key={d.email} type="button" onClick={() => handleDemo(d.email)} disabled={loading}
                  className="btn-flat btn-flat-secondary"
                  style={{ flex: 1, fontSize: '0.8rem', padding: '8px 6px', gap: '5px' }}>
                  {d.role === 'Customer' ? <User size={14} /> : <Wrench size={14} />}
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
