import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Play, Zap, Users } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { requests, users, triggerAdminBidding, openChat } = useApp();

  const handleForceStartBidding = async (requestId: string) => {
    try {
      await triggerAdminBidding(requestId);
      alert('Emergency bidding started manually by Admin!');
    } catch (err: any) {
      alert(err.message || 'Failed to start bidding');
    }
  };

  const providers = users.filter(u => u.role === 'provider');
  const emergencyRequests = requests.filter(r => r.service_type === 'emergency');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="flat-card flat-card-teal" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--color-terracotta)', padding: '10px', borderRadius: '12px' }}>
            <Shield size={28} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              UrbanClap Operations & Bidding Admin Console
            </h2>
            <p style={{ color: '#d0e5e8', fontSize: '0.9rem', marginTop: '2px' }}>
              Override bidding timers, monitor provider eligibility, inspect coins distribution & platform work orders.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-muted)' }}>TOTAL REQUESTS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginTop: '4px' }}>
            {requests.length}
          </div>
        </div>

        <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>EMERGENCY LISTINGS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-terracotta)', marginTop: '4px' }}>
            {emergencyRequests.length} (+30% Surcharge)
          </div>
        </div>

        <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-gold)' }}>VERIFIED PROVIDERS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-dark)', marginTop: '4px' }}>
            {providers.length}
          </div>
        </div>

        <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#166534' }}>COINS IN CIRCULATION</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
            {providers.reduce((sum, p) => sum + p.coins, 0)} Coins
          </div>
        </div>
      </div>

      {/* Emergency Requests Bidding Override Panel */}
      <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={20} color="var(--color-terracotta)" /> Emergency Bidding Controller & Manual Override
        </h3>

        {emergencyRequests.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>No emergency requests recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {emergencyRequests.map(req => (
              <div
                key={req.id}
                style={{
                  border: '2px solid var(--color-teal-dark)',
                  borderRadius: '12px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-sand)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="flat-badge badge-emergency">{req.status.toUpperCase()}</span>
                    <span className="flat-badge badge-coins">Price: ₹{req.final_price}</span>
                    <span className="flat-badge badge-ordinary">Scheduled: {req.scheduled_date}</span>
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginTop: '4px' }}>
                    {req.title}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-dark)' }}>
                    Customer: {req.customer_name} ({req.area}) | Bidders: {req.bids?.length || 0} Providers
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => openChat(req.id)} className="btn-flat btn-flat-gold">
                    Inspect Chat
                  </button>

                  {req.status === 'pending_bidding' && (
                    <button
                      onClick={() => handleForceStartBidding(req.id)}
                      className="btn-flat btn-flat-red"
                    >
                      <Play size={16} /> Force Start Bidding Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified Providers Roster & Ratings Audit */}
      <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={20} /> Service Providers Roster & Bidding Criteria Audit
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-teal-dark)', backgroundColor: 'var(--color-teal-light)' }}>
                <th style={{ padding: '10px' }}>Provider Name</th>
                <th style={{ padding: '10px' }}>Type</th>
                <th style={{ padding: '10px' }}>Distance</th>
                <th style={{ padding: '10px' }}>Rating</th>
                <th style={{ padding: '10px' }}>Wallet Coins</th>
                <th style={{ padding: '10px' }}>Emergency Bidding Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(p => {
                const isRatingOk = (p.rating_avg || 0) >= 3.5;
                const isDistanceOk = (p.distance_km || 0) <= 13.0;
                const isEligible = isRatingOk && isDistanceOk;

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--color-teal-dark)' }}>{p.name}</td>
                    <td style={{ padding: '10px' }}>{p.provider_type?.toUpperCase()}</td>
                    <td style={{ padding: '10px' }}>{p.distance_km} km</td>
                    <td style={{ padding: '10px' }}>
                      <span className="flat-badge badge-coins">{p.rating_avg}★</span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 800, color: 'var(--color-terracotta)' }}>
                      {p.coins} Coins
                    </td>
                    <td style={{ padding: '10px' }}>
                      {isEligible ? (
                        <span className="flat-badge" style={{ backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#22c55e' }}>
                          ELIGIBLE (≤13km & ≥3.5★)
                        </span>
                      ) : (
                        <span className="flat-badge badge-emergency">
                          {!isRatingOk ? 'DISQUALIFIED (<3.5★)' : 'DISQUALIFIED (>13km)'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
