import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AuthModal } from './AuthModal';
import { User, Wrench, LogOut, Coins } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, isAuthenticated, activeRole, switchRole, logout } = useApp();
  const [showAuth, setShowAuth] = useState(false);

  const handleSwitch = (role: 'customer' | 'provider') => {
    switchRole(role);
  };

  return (
    <>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'var(--color-teal-dark)',
        borderBottom: '3px solid var(--color-terracotta)',
      }}>
        <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', height: '60px', display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginRight: 'auto' }}>
            <div style={{ width: '34px', height: '34px', background: 'var(--color-terracotta)', borderRadius: '8px', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}>
              <Wrench size={17} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 'clamp(0.95rem, 3vw, 1.2rem)', color: '#ffffff', letterSpacing: '-0.3px' }}>UrbanClap</span>
          </div>

          {/* Desktop: Role switcher + user info (only when logged in) */}
          {isAuthenticated && currentUser && (
            <>
              {/* Role pill toggle — ALWAYS visible so any user can switch between Customer and Provider view */}
              <div className="role-pill" style={{ flexShrink: 0 }}>
                <button
                  className={`role-pill-btn ${activeRole === 'customer' ? 'active-user' : ''}`}
                  onClick={() => handleSwitch('customer')}
                  title="Switch to Customer view">
                  <User size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Customer
                </button>
                <button
                  className={`role-pill-btn ${activeRole === 'provider' ? 'active-provider' : ''}`}
                  onClick={() => handleSwitch('provider')}
                  title="Switch to Provider view">
                  <Wrench size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Provider
                </button>
              </div>

              {/* Coins — ONLY shown in Provider Portal */}
              {activeRole === 'provider' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(226,155,56,0.18)', border: '1.5px solid var(--color-gold)', borderRadius: '20px', padding: '5px 10px', flexShrink: 0 }} title="Provider Coins Wallet">
                  <Coins size={15} color="var(--color-gold)" />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-gold)' }}>{currentUser.coins ?? 25}</span>
                </div>
              )}

              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: activeRole === 'provider' ? 'var(--color-gold)' : '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', flexShrink: 0 }}>
                  {activeRole === 'provider' ? <Wrench size={15} color="#fff" /> : <User size={15} color="#fff" />}
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.name.split(' ')[0]}
                </span>
              </div>

              {/* Logout */}
              <button onClick={logout} title="Log out"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#c8dfe3', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 700, transition: 'background 0.15s', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(217,78,56,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}>
                <LogOut size={15} />
                <span style={{ display: 'none' }} className="nav-logout-label">Logout</span>
              </button>
            </>
          )}

          {/* Not logged in */}
          {!isAuthenticated && (
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-secondary"
                style={{ padding: '7px 14px', fontSize: '0.85rem', border: '2px solid rgba(255,255,255,0.4)', color: 'var(--color-teal-dark)', gap: '5px', boxShadow: 'none' }}>
                <User size={15} /> Login
              </button>
              <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-red"
                style={{ padding: '7px 14px', fontSize: '0.85rem', gap: '5px', boxShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}>
                Sign Up
              </button>
            </div>
          )}
        </div>

        {/* Active role indicator bar */}
        {isAuthenticated && (
          <div style={{ background: activeRole === 'provider' ? 'rgba(226,155,56,0.15)' : 'rgba(14,165,233,0.12)', borderTop: `2px solid ${activeRole === 'provider' ? 'var(--color-gold)' : '#0ea5e9'}`, padding: '5px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeRole === 'provider' ? 'var(--color-gold)' : '#0ea5e9', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: activeRole === 'provider' ? 'var(--color-gold)' : '#7dd3f5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Viewing as {activeRole === 'provider' ? '🛠️ Service Provider' : '👤 Customer'}
              {(currentUser?.role === 'both' || currentUser?.role === 'admin') ? ' — tap the pill above to switch roles anytime' : ' (Single Role Account)'}
            </span>
          </div>
        )}
      </nav>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @media (max-width: 520px) {
          .role-pill { border-radius: 50px; }
          .role-pill-btn { font-size: 0.78rem; padding: 6px 10px; }
        }
      `}</style>
    </>
  );
};
