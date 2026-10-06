import React from 'react';
import { Store, ShieldCheck, Zap, Clock, Star, Coins } from 'lucide-react';

export const FlatIllustrationStore: React.FC = () => {
  return (
    <div className="flat-card flat-card-teal" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
      <div className="awning-banner"></div>
      <div style={{ padding: '20px 24px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span className="flat-badge badge-emergency">FLAT DESIGN SERVICE HUB</span>
              <span className="flat-badge badge-coins">
                <Coins size={12} /> 25+ COINS
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.15rem, 4vw, 1.7rem)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              UrbanClap Service & Emergency Bidding Marketplace
            </h1>
            <p style={{ color: '#c8dfe3', fontSize: 'clamp(0.78rem, 2.5vw, 0.9rem)', maxWidth: '600px', marginTop: '4px' }}>
              Ordinary home services (2-3 days) or same-day Emergency Bidding (+30% price, 13km radius, 3.5★+ providers).
            </p>
          </div>

          <div style={{
            background: 'var(--color-terracotta)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '2px solid #ffffff',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexShrink: 0
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#fdf7ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-teal-dark)'
            }}>
              <Store size={26} color="var(--color-terracotta)" />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#fdf7ed' }}>Instant Dispatch</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>45 Min Bidding</div>
            </div>
          </div>
        </div>

        {/* Feature pills row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
          paddingTop: '14px',
          borderTop: '1px dashed rgba(255,255,255,0.2)'
        }}>
          {[
            { icon: <Zap size={15} color="var(--color-gold)" />, text: 'Emergency: +30% Surcharge' },
            { icon: <ShieldCheck size={15} color="#4ade80" />, text: 'Providers ≤13km & ≥3.5★' },
            { icon: <Clock size={15} color="#60a5fa" />, text: 'Max 10 Providers / 45 Min' },
            { icon: <Star size={15} color="var(--color-gold)" />, text: 'Compulsory Reviews' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.12)', padding: '5px', borderRadius: '6px', flexShrink: 0 }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', fontWeight: 600, color: '#ffffff' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
