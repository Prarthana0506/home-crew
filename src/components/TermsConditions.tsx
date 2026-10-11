import React from 'react';
import { ArrowLeft, ShieldCheck, Scale, AlertCircle, Coins, Clock, CheckCircle } from 'lucide-react';

interface TermsConditionsProps {
  onBack: () => void;
}

export const TermsConditions: React.FC<TermsConditionsProps> = ({ onBack }) => {
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
            <Scale size={18} color="var(--color-gold)" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>UrbanClap Terms of Service</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px 20px 80px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div className="flat-card" style={{ padding: '36px 32px' }}>
          <div style={{ borderBottom: '2px solid var(--color-teal-light)', paddingBottom: '20px', marginBottom: '28px' }}>
            <span className="flat-badge badge-emergency" style={{ marginBottom: '10px', display: 'inline-flex' }}>
              Legal Agreement
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
              Terms and Conditions
            </h1>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
              Applicable to Customers, Service Technicians, and Business Partners | Version 2.4
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', color: 'var(--color-dark)', lineHeight: 1.7, fontSize: '0.95rem' }}>
            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="var(--color-terracotta)" /> 1. Platform Overview &amp; Single-Account Role System
              </h2>
              <p>
                UrbanClap provides an on-demand marketplace connecting homeowners with independent technicians and registered service companies. Users maintain a unified profile allowing seamless switching between Customer and Service Provider roles without duplicate registrations.
              </p>
              <p style={{ marginTop: '8px' }}>
                By registering or placing an order, you confirm that you are at least 18 years of age and legally competent to enter binding agreements.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--color-terracotta)" /> 2. Booking Classifications and Emergency Bidding Protocol
              </h2>
              <p>
                Work requests fall under two distinct operational categories:
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>
                  <strong>Standard Bookings:</strong> Scheduled at least 48 hours in advance at established baseline catalog pricing.
                </li>
                <li>
                  <strong>Emergency Dispatch:</strong> Urgent interventions for immediate safety or structural concerns. A mandatory +30% surge surcharge is applied to standard base pricing to incentivize rapid response. Emergency requests trigger a 45-minute live bidding arena restricted to verified providers located within 13 kilometers.
                </li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="var(--color-terracotta)" /> 3. Provider Eligibility and Quality Standards
              </h2>
              <p>
                To maintain marketplace integrity, service providers participating in emergency bidding must maintain a verified rating average of 3.5 stars or higher, hold valid government credentials, and possess a minimum platform coin balance earned through fulfilled ordinary assignments.
              </p>
              <p style={{ marginTop: '8px' }}>
                The platform monitors scheduling conflicts automatically. Providers cannot submit bids for time slots with existing overlapping appointments.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={18} color="var(--color-terracotta)" /> 4. Mandatory Reviews and Star Evaluations
              </h2>
              <p>
                Following completion of any work order, the customer is required to submit a 1 to 5 star rating before new service requests can be dispatched. This ensures impartial accountability and eliminates unverified reputation gaming.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins size={18} color="var(--color-terracotta)" /> 5. Service Fees, Coins, and Payment Settling
              </h2>
              <p>
                Labor charges represent baseline technician service fees. Extra hardware components or specialized plumbing parts must be approved by the customer prior to purchase and billing.
              </p>
              <p style={{ marginTop: '8px' }}>
                Platform coins awarded to service providers upon verified task completion serve as qualification tokens for high-value dispatch opportunities and priority routing.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} color="var(--color-terracotta)" /> 6. Dispute Resolution and Liability Boundaries
              </h2>
              <p>
                Technicians operate as independent contractors. While UrbanClap verifies credentials and enforces quality requirements, property owners and providers must verify scope of work on site before authorization. Disputed orders are held in escrow status until reviewed by platform operations.
              </p>
            </section>
          </div>

          <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '2px solid var(--color-teal-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              Legal inquiries: legal@urbanclap.local
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
