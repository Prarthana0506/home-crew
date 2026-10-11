import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, FileText, Database, UserCheck, Bell } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-sand)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <header style={{
        background: 'var(--color-teal-dark)',
        borderBottom: '2px solid var(--color-teal-mid)',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <button
            onClick={onBack}
            className="btn-flat btn-flat-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
          >
            <ArrowLeft size={16} /> Back to Platform
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <Shield size={18} color="var(--color-gold)" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>UrbanClap Legal &amp; Compliance</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px 20px 80px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div className="flat-card" style={{ padding: '36px 32px' }}>
          <div style={{ borderBottom: '2px solid var(--color-teal-light)', paddingBottom: '20px', marginBottom: '28px' }}>
            <span className="flat-badge badge-ordinary" style={{ marginBottom: '10px', display: 'inline-flex' }}>
              Data Protection
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
              Privacy Policy
            </h1>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
              Effective Date: January 1, 2025 | Last Updated: October 2026
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', color: 'var(--color-dark)', lineHeight: 1.7, fontSize: '0.95rem' }}>
            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} color="var(--color-terracotta)" /> 1. Information We Collect
              </h2>
              <p>
                UrbanClap collects personal and service details necessary to provide home maintenance and emergency dispatch. This information includes:
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong>Customer Details:</strong> Name, verified contact telephone number, and precise residential service address.</li>
                <li><strong>Provider Profile Information:</strong> Full legal identity, government-issued photo identification (Aadhaar or national ID), registered trade license or GST details, primary service trade, and emergency radius qualifications.</li>
                <li><strong>Service Records:</strong> Specific scope of work, labor charges, scheduling timestamps, and photographic evidence submitted for diagnostic review.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} color="var(--color-terracotta)" /> 2. Location Data and Dispatch Radius
              </h2>
              <p>
                To route emergency work orders within our 13-kilometer radius guarantee, we process area locality and geographic coordinates. Service provider distance is calculated relative to customer premises to ensure dispatch eligibility and reduce response delays.
              </p>
              <p style={{ marginTop: '8px' }}>
                Exact residential coordinates are only revealed to an assigned technician once a service order is mutually confirmed.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} color="var(--color-terracotta)" /> 3. Real-Time Chat &amp; Operational Security
              </h2>
              <p>
                In-app communications between customers and technicians are maintained exclusively to facilitate work order coordination, parts specifications, and schedule adjustments. Chat logs are securely stored and monitored for fraud prevention, safety compliance, and dispute mediation.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="var(--color-terracotta)" /> 4. Ratings, Feedback &amp; Review Integrity
              </h2>
              <p>
                Every completed service order mandates an objective star evaluation. These ratings directly calculate technician qualification thresholds (such as the minimum 3.5-star emergency bidding requirement). Customer comments are published with the reviewer's first name to maintain transparency while protecting private contact details.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--color-terracotta)" /> 5. Data Disclosure and Third Parties
              </h2>
              <p>
                UrbanClap does not sell, rent, or monetize your personal profile data. We disclose information solely to:
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>Contracted service professionals assigned to fulfill your specific booking.</li>
                <li>Regulated payment gateways processing labor charges and platform deposits.</li>
                <li>Law enforcement or municipal authorities when compelled by statutory legal obligations.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="var(--color-terracotta)" /> 6. Your Rights and Data Erasure
              </h2>
              <p>
                You may request a copy of your stored records, correct profile details, or initiate account termination by contacting our compliance desk at <strong>privacy@urbanclap.local</strong>. Upon termination, active job history is retained only as required to meet tax and accounting standards.
              </p>
            </section>
          </div>

          <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '2px solid var(--color-teal-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              Questions about this policy? Contact grievance@urbanclap.local
            </span>
            <button
              onClick={onBack}
              className="btn-flat btn-flat-secondary"
              style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            >
              Return to Previous Screen
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
