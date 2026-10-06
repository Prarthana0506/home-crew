import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { CustomerDashboard } from './components/CustomerDashboard';
import { ProviderDashboard } from './components/ProviderDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ChatModal } from './components/ChatModal';
import { CompulsoryReviewModal } from './components/CompulsoryReviewModal';
import './index.css';

const MainContent: React.FC = () => {
  const { activeRole, isAuthenticated, loading } = useApp();

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-teal-dark)', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-terracotta)', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '4px 4px 0 rgba(0,0,0,0.3)' }}>
          <span style={{ fontSize: '1.5rem' }}>🔧</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>Loading UrbanClap…</p>
          <p style={{ color: '#8dc0ca', fontSize: '0.85rem', marginTop: '4px' }}>Connecting to platform</p>
        </div>
        <div style={{ width: '160px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--color-gold)', borderRadius: '4px', width: '60%', animation: 'shimmer 1.2s ease-in-out infinite alternate' }} />
        </div>
        <style>{`@keyframes shimmer { from { width: 20%; } to { width: 90%; } }`}</style>
      </div>
    );
  }

  // ── NOT LOGGED IN → Show Landing Page (no Navbar needed, landing has its own nav) ──
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // ── LOGGED IN → Navbar + role dashboards ──
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

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--color-teal-dark)', color: '#fff', borderTop: '2px solid var(--color-terracotta)', padding: '20px', textAlign: 'center' }}>
        <div className="awning-banner" style={{ marginBottom: '14px' }} />
        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>UrbanClap Service Marketplace</p>
        <p style={{ fontSize: '0.78rem', color: '#8dc0ca', marginTop: '4px' }}>
          Your one account — switch between Customer &amp; Provider anytime.
        </p>
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
