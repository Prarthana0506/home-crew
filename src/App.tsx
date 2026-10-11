import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { CustomerDashboard } from './components/CustomerDashboard';
import { ProviderDashboard } from './components/ProviderDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ChatModal } from './components/ChatModal';
import { CompulsoryReviewModal } from './components/CompulsoryReviewModal';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsConditions } from './components/TermsConditions';
import { Wrench } from 'lucide-react';
import './index.css';

const MainContent: React.FC = () => {
  const { activeRole, isAuthenticated, loading, currentView, navigateToView } = useApp();

  // ── Privacy Policy & Terms Pages ──
  if (currentView === 'privacy') {
    return <PrivacyPolicy onBack={() => navigateToView('main')} />;
  }

  if (currentView === 'terms') {
    return <TermsConditions onBack={() => navigateToView('main')} />;
  }

  // Loading state (no emojis, no purple gradients, crisp clean presentation)
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-teal-dark)', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--color-terracotta)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '3px 3px 0 rgba(0,0,0,0.3)' }}>
          <Wrench size={22} color="#fff" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>UrbanClap Platform</p>
          <p style={{ color: '#8dc0ca', fontSize: '0.85rem', marginTop: '4px' }}>Loading services and verified accounts</p>
        </div>
        <div style={{ width: '160px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--color-gold)', borderRadius: '4px', width: '60%', animation: 'shimmer 1.2s ease-in-out infinite alternate' }} />
        </div>
        <style>{`@keyframes shimmer { from { width: 20%; } to { width: 90%; } }`}</style>
      </div>
    );
  }

  // ── NOT LOGGED IN -> Show Landing Page (no Navbar needed, landing has its own nav) ──
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // ── LOGGED IN -> Navbar + role dashboards ──
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-sand)' }}>
      <Navbar />

      <main className="container-fluid px-3 px-md-4 px-xl-5 py-4 flex-grow-1" style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {activeRole === 'customer' && <CustomerDashboard />}
        {activeRole === 'provider' && <ProviderDashboard />}
        {activeRole === 'admin' && <AdminDashboard />}
      </main>

      {/* Global Modals */}
      <ChatModal />
      <CompulsoryReviewModal />

      {/* Footer (No em dashes, no pill buttons, clear links to legal pages) */}
      <footer style={{ backgroundColor: 'var(--color-teal-dark)', color: '#fff', borderTop: '2px solid var(--color-terracotta)', padding: '24px 20px', textAlign: 'center' }}>
        <div className="awning-banner" style={{ marginBottom: '16px' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '0.95rem' }}>UrbanClap Service Marketplace</p>
          <p style={{ fontSize: '0.8rem', color: '#8dc0ca' }}>
            Single account access. Switch between Customer and Provider views anytime.
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => navigateToView('privacy')}
              style={{ background: 'none', border: 'none', color: '#b8d8de', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Privacy Policy
            </button>
            <span style={{ color: '#6a9aa6' }}>|</span>
            <button
              onClick={() => navigateToView('terms')}
              style={{ background: 'none', border: 'none', color: '#b8d8de', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Terms and Conditions
            </button>
            <span style={{ color: '#6a9aa6' }}>|</span>
            <span style={{ color: '#8dc0ca', fontSize: '0.82rem' }}>Domain: urbanclap.local</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
