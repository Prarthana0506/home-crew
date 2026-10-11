import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  LogIn, UserPlus, Zap, Coins, MapPin,
  ArrowRight, Store, AlertCircle
} from 'lucide-react';

export const EntryDashboard: React.FC = () => {
  const { loginUser, signupUser } = useApp();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<'customer' | 'provider' | 'admin'>('customer');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('Downtown Metro');
  const [providerType, setProviderType] = useState<'freelancer' | 'organization'>('freelancer');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser(email, password || 'password123');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signupUser({ name, email, password: password || 'password123', role, area, provider_type: role === 'provider' ? providerType : 'either' });
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (userEmail: string) => {
    setError('');
    setLoading(true);
    try {
      await loginUser(userEmail, 'password123');
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero Banner */}
      <div className="flat-card flat-card-teal" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="awning-banner"></div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div style={{ flex: '1 1 220px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                <span className="flat-badge badge-emergency">ENTERPRISE MARKETPLACE</span>
                <span className="flat-badge badge-coins"><Coins size={12} /> 25+ COINS</span>
              </div>
              <h1 style={{ fontSize: 'clamp(1.2rem, 5vw, 2rem)', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                UrbanClap Service Platform & Bidding Arena
              </h1>
              <p style={{ color: '#c8dfe3', fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)', marginTop: '6px' }}>
                Connect customers needing home services or instant 45-min Emergency Bidding (+30%) with verified providers.
              </p>
            </div>
            <div style={{
              background: 'var(--color-terracotta)', padding: '14px 18px', borderRadius: '14px',
              border: '2px solid #fff', boxShadow: '4px 4px 0 rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fdf7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-teal-dark)' }}>
                <Store size={30} color="var(--color-terracotta)" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#fdf7ed' }}>Verified Dispatch</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Entry Portal</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-column grid → stacks on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>

        {/* ── LEFT: Auth Card ── */}
        <div className="flat-card" style={{ backgroundColor: '#fff', padding: '22px' }}>
          {/* Tab Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-sand)', padding: '3px', borderRadius: '10px', border: '2px solid var(--color-teal-dark)', gap: '3px', marginBottom: '20px' }}>
            <button type="button" onClick={() => { setMode('login'); setError(''); }}
              className={`btn-flat ${mode === 'login' ? 'btn-flat-red' : 'btn-flat-secondary'}`}
              style={{ flex: 1, padding: '9px', fontSize: '0.9rem' }}>
              <LogIn size={16} /> Sign In
            </button>
            <button type="button" onClick={() => { setMode('signup'); setError(''); }}
              className={`btn-flat ${mode === 'signup' ? 'btn-flat-gold' : 'btn-flat-secondary'}`}
              style={{ flex: 1, padding: '9px', fontSize: '0.9rem' }}>
              <UserPlus size={16} /> Register
            </button>
          </div>

          {error && (
            <div style={{ backgroundColor: 'var(--color-coral-light)', color: 'var(--color-terracotta-dark)', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--color-terracotta)', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '5px' }}>Email Address *</label>
                <input type="email" className="flat-input" placeholder="e.g. aarav@urbanclap.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '5px' }}>Password *</label>
                <input type="password" className="flat-input" placeholder="Default: password123" value={password} onChange={e => setPassword(e.target.value)} />
                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '3px', display: 'block' }}>Demo accounts: <code>password123</code></span>
              </div>
              <button type="submit" disabled={loading} className="btn-flat btn-flat-red" style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: '4px' }}>
                <LogIn size={17} /> {loading ? 'Logging in...' : 'Login to Platform'} <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            /* SIGNUP FORM */
            <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Account Type */}
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-teal-dark)', marginBottom: '8px' }}>Account Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {(['customer', 'provider'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setRole(r)} style={{
                      padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem',
                      border: `2px solid ${role === r ? (r === 'customer' ? 'var(--color-terracotta)' : 'var(--color-gold)') : 'var(--color-teal-dark)'}`,
                      backgroundColor: role === r ? (r === 'customer' ? 'var(--color-coral-light)' : 'var(--color-gold-light)') : '#fff',
                      boxShadow: role === r ? (r === 'customer' ? 'var(--shadow-flat-red)' : '2px 2px 0 var(--color-gold)') : 'none',
                      color: 'var(--color-teal-dark)'
                    }}>
                      {r === 'customer' ? 'Customer Account' : 'Service Provider'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '5px' }}>Full Name / Business Title *</label>
                <input type="text" className="flat-input" placeholder={role === 'customer' ? 'e.g. Rohan Gupta' : 'e.g. Rohan Ace Plumbing'} value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '5px' }}>Email Address *</label>
                <input type="email" className="flat-input" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '5px' }}>Password *</label>
                <input type="password" className="flat-input" placeholder="Set a password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '5px' }}>
                  <MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Neighborhood Area *
                </label>
                <input type="text" className="flat-input" placeholder="e.g. Downtown Metro, North Hills" value={area} onChange={e => setArea(e.target.value)} required />
              </div>

              {role === 'provider' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '5px' }}>Provider Classification *</label>
                  <select className="flat-select" value={providerType} onChange={e => setProviderType(e.target.value as any)}>
                    <option value="freelancer">Individual Freelancer Craftsman</option>
                    <option value="organization">Registered Organization / Agency</option>
                  </select>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-flat btn-flat-gold" style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: '4px' }}>
                <UserPlus size={17} /> {loading ? 'Creating account...' : 'Create Account'} <ArrowRight size={17} />
              </button>
            </form>
          )}

          {/* Quick Demo Logins */}
          <div style={{ marginTop: '20px', borderTop: '2px dashed var(--color-teal-dark)', paddingTop: '16px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '8px' }}>
              Demo Login Accounts:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {[
                { email: 'aarav@urbanclap.com', label: 'Customer: Aarav Sharma', badge: 'Customer', badgeClass: 'badge-ordinary' },
                { email: 'rajesh@quickfix.com', label: 'Provider: Rajesh QuickFix', badge: 'Provider', badgeClass: 'badge-coins' },
                { email: 'admin@urbanclap.com', label: 'Admin: Operations Console', badge: 'Admin', badgeClass: 'badge-emergency' },
              ].map(item => (
                <button key={item.email} type="button" onClick={() => handleQuickDemoLogin(item.email)}
                  className="btn-flat btn-flat-secondary"
                  style={{ justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.82rem', width: '100%' }}>
                  <span style={{ textAlign: 'left' }}>{item.label}</span>
                  <span className={`flat-badge ${item.badgeClass}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>{item.badge}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Platform Rules ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="flat-card flat-card-terracotta" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={20} /> Emergency Service Bidding Arena
            </h3>
            <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
              <li><strong>+30% Emergency Price:</strong> Customers pay 30% higher base rate for same-day/next-day dispatch.</li>
              <li><strong>13 km Radius Restriction:</strong> Only providers within 13 km are notified.</li>
              <li><strong>≥ 3.5★ Rating Criterion:</strong> Minimum 3.5★ average to enter emergency bidding.</li>
              <li><strong>Schedule Clash Lockout:</strong> Automated check blocks double-booking on occupied dates.</li>
              <li><strong>Max 10 Providers / 45 Mins:</strong> Arena closes after 10 entries or 45-min countdown.</li>
            </ul>
          </div>

          <div className="flat-card" style={{ backgroundColor: '#fff', padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Coins size={18} color="var(--color-gold)" /> Provider Coins & Compulsory Reviews
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-dark)', lineHeight: 1.65 }}>
              Every completed ordinary service guarantees a minimum of <strong>25 coins</strong> to the provider. Customers must submit a compulsory 1-5 star review after service completion, granting <strong>+1 to +5 bonus coins</strong> based on star rating!
            </p>
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[5,4,3,2,1].map(s => (
                <div key={s} className="flat-badge badge-coins" style={{ fontSize: '0.8rem' }}>
                  {s}★ = {25+s} coins
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
