import React, { useState } from 'react';
import { AuthModal } from './AuthModal';
import { useApp } from '../context/AppContext';
import {
  Wrench, Zap, Star, ShieldCheck, Clock, MessageCircle,
  Calendar, Coins, ChevronRight, User, CheckCircle2, ArrowRight,
  Sparkles, Wind, Paintbrush, Hammer, Tv, ShieldAlert, MapPin, Check
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);
  const { navigateToView } = useApp();

  const features = [
    {
      icon: <Wrench size={24} color="#fff" />,
      bg: 'var(--color-teal-dark)',
      title: 'Home Maintenance',
      desc: 'Plumbing, electrical, deep cleaning, and appliance servicing. Book certified technicians for scheduled household needs.'
    },
    {
      icon: <Zap size={24} color="#fff" />,
      bg: 'var(--color-terracotta)',
      title: 'Emergency Dispatch',
      desc: 'Urgent leak or power loss? Emergency bidding routes your request to verified technicians within a 13-kilometer radius.'
    },
    {
      icon: <MessageCircle size={24} color="var(--color-dark)" />,
      bg: 'var(--color-gold)',
      title: 'Direct Chat',
      desc: 'Coordinate directly with assigned providers. Exchange site photographs, clarify diagnostic details, and confirm arrival times.'
    },
    {
      icon: <Calendar size={24} color="#fff" />,
      bg: 'var(--color-teal-mid)',
      title: 'Conflict Prevention',
      desc: 'Automated scheduling algorithms prevent overlapping bookings, ensuring reliable arrival windows.'
    },
    {
      icon: <Star size={24} color="var(--color-dark)" />,
      bg: 'var(--color-gold-light)',
      title: 'Mandatory Star Evaluation',
      desc: 'Every completed work order requires an objective customer evaluation before new orders can be requested.'
    },
    {
      icon: <Coins size={24} color="var(--color-dark)" />,
      bg: 'var(--color-gold-light)',
      title: 'Provider Coin Economy',
      desc: 'Technicians earn marketplace coins for fulfilled assignments, unlocking access to high-value emergency dispatches.'
    },
  ];

  const steps = [
    { num: '01', icon: <User size={20} />, title: 'Create Single Account', desc: 'One registration. Switch between Customer and Provider portals from the top navigation.', color: '#0ea5e9' },
    { num: '02', icon: <Wrench size={20} />, title: 'Post Requirement', desc: 'Select your trade category, specify labor parameters, and select standard or urgent emergency priority.', color: 'var(--color-terracotta)' },
    { num: '03', icon: <ShieldCheck size={20} />, title: 'Review Bids & Confirm', desc: 'Examine incoming provider proposals, confirm scheduling, and coordinate via in-app chat.', color: '#22c55e' },
    { num: '04', icon: <CheckCircle2 size={20} />, title: 'Inspect & Rate', desc: 'Inspect completed repairs, submit your mandatory review, and close the service ticket.', color: 'var(--color-gold)' },
  ];

  const services = [
    { icon: <Wrench size={24} color="var(--color-teal-dark)" />, name: 'Plumbing', base: '₹500' },
    { icon: <Zap size={24} color="var(--color-teal-dark)" />, name: 'Electrical', base: '₹600' },
    { icon: <Sparkles size={24} color="var(--color-teal-dark)" />, name: 'Deep Cleaning', base: '₹1200' },
    { icon: <Wind size={24} color="var(--color-teal-dark)" />, name: 'AC & Cooling', base: '₹800' },
    { icon: <Paintbrush size={24} color="var(--color-teal-dark)" />, name: 'Painting', base: '₹1500' },
    { icon: <Hammer size={24} color="var(--color-teal-dark)" />, name: 'Carpentry', base: '₹550' },
    { icon: <Tv size={24} color="var(--color-teal-dark)" />, name: 'Appliance Repair', base: '₹800' },
    { icon: <ShieldAlert size={24} color="var(--color-teal-dark)" />, name: 'Pest Control', base: '₹700' },
  ];

  return (
    <>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── TOP NAVIGATION ────────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          backgroundColor: 'var(--color-teal-dark)',
          borderBottom: '2px solid var(--color-teal-mid)',
          padding: '0 20px',
        }}>
          <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--color-terracotta)', borderRadius: '6px', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '2px 2px 0 rgba(0,0,0,0.3)', flexShrink: 0 }}>
                <Wrench size={18} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 'clamp(1rem, 3vw, 1.25rem)', color: '#ffffff', letterSpacing: '-0.3px' }}>UrbanClap</span>
            </div>

            {/* Nav links */}
            <div style={{ display: 'flex', gap: '4px', overflow: 'hidden' }}>
              <a href="#services" style={{ color: '#c8dfe3', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', padding: '6px 12px', borderRadius: '4px' }}>
                Services
              </a>
              <a href="#how-it-works" style={{ color: '#c8dfe3', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', padding: '6px 12px', borderRadius: '4px' }}>
                How It Works
              </a>
              <a href="#for-providers" style={{ color: '#c8dfe3', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', padding: '6px 12px', borderRadius: '4px' }}>
                For Providers
              </a>
            </div>

            {/* Action buttons (Clean rectangular shape, no pill radius) */}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => setShowAuth(true)}
                className="btn-flat btn-flat-secondary"
                style={{ padding: '8px 14px', fontSize: '0.85rem', color: 'var(--color-teal-dark)', gap: '6px' }}
              >
                <User size={15} /> Sign In
              </button>
              <button
                onClick={() => setShowAuth(true)}
                className="btn-flat btn-flat-red"
                style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
              >
                Get Started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </nav>

        <main style={{ flex: 1 }}>

          {/* ── HERO SECTION ────────────────────────────────────────────── */}
          <section style={{ background: 'var(--color-teal-dark)', padding: '56px 20px 72px', position: 'relative' }}>
            <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
              {/* Grounded, concrete copy */}
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
                  <span className="flat-badge badge-emergency" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={12} /> Local Metro Network
                  </span>
                  <span className="flat-badge badge-ordinary" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <ShieldCheck size={12} /> Verified Identity &amp; Trade Checks
                  </span>
                </div>

                <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 800, color: '#ffffff', lineHeight: 1.18, letterSpacing: '-0.5px' }}>
                  On-Demand Home Services and Urgent Repair Dispatch
                </h1>

                <p style={{ color: '#b8d8de', fontSize: 'clamp(0.92rem, 2vw, 1.05rem)', marginTop: '16px', lineHeight: 1.65, maxWidth: '520px' }}>
                  Schedule professional electrical, plumbing, appliance repair, and cleaning services. When urgent failures occur, trigger emergency dispatch with real-time technician bidding within 13 kilometers.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '28px' }}>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="btn-flat btn-flat-red"
                    style={{ padding: '12px 22px', fontSize: '0.95rem', gap: '8px' }}
                  >
                    Request a Service <ChevronRight size={17} />
                  </button>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="btn-flat btn-flat-gold"
                    style={{ padding: '12px 22px', fontSize: '0.95rem', gap: '8px' }}
                  >
                    <Wrench size={17} /> Join as Service Provider
                  </button>
                </div>

                {/* Practical operational parameters (No fake counters or fake metrics) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '20px' }}>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>Catalog Base Rates</div>
                    <div style={{ fontSize: '0.78rem', color: '#8dc0ca', marginTop: '2px' }}>Standard labor charges published upfront</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>Emergency Surge</div>
                    <div style={{ fontSize: '0.78rem', color: '#8dc0ca', marginTop: '2px' }}>Fixed +30% rate for 45-min bidding window</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>Single Account</div>
                    <div style={{ fontSize: '0.78rem', color: '#8dc0ca', marginTop: '2px' }}>Customer and Provider access unified</div>
                  </div>
                </div>
              </div>

              {/* Functional Dashboard Cards (No fake reviews or fake metrics) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#fff', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.2)', padding: '20px', boxShadow: '4px 4px 0 rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span className="flat-badge badge-emergency" style={{ marginBottom: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={11} /> Emergency Order
                      </span>
                      <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-teal-dark)' }}>Main Water Line Fracture: Kitchen</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Locality: Indiranagar Central | Dispatch Radius: 13 km | Active Bidding Window
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>₹650</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Base ₹500 + 30% urgent surge</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-teal-dark)', background: 'var(--color-teal-light)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--color-teal-mid)' }}>
                      Qualified Providers Notified
                    </span>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#166534', background: '#f0fdf4', padding: '4px 10px', borderRadius: '4px', border: '1px solid #22c55e' }}>
                      Status: Active Dispatch
                    </span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '8px', border: '1.5px solid rgba(255,255,255,0.2)', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'var(--color-terracotta)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', flexShrink: 0 }}>
                      <Wrench size={20} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff' }}>Rajesh QuickFix Services</div>
                      <div style={{ fontSize: '0.76rem', color: '#b8d8de' }}>Verified Plumber | 2.4 km from site | Background Checked</div>
                    </div>
                  </div>
                  <span className="flat-badge" style={{ background: '#22c55e', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} /> Bid Accepted
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Awning stripe separator */}
          <div className="awning-banner" />

          {/* ── SERVICES SECTION ───────────────────────────────────────── */}
          <section id="services" className="container-fluid px-3 px-md-4 px-xl-5" style={{ padding: '60px 0', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <span className="flat-badge badge-ordinary" style={{ marginBottom: '10px', display: 'inline-flex' }}>
                Service Catalog
              </span>
              <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                Comprehensive Trade Categories
              </h2>
              <p style={{ color: 'var(--color-muted)', marginTop: '8px', fontSize: '0.92rem', maxWidth: '520px', margin: '8px auto 0' }}>
                Transparent baseline pricing for scheduled appointments or emergency response.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
              {services.map(s => (
                <div
                  key={s.name}
                  onClick={() => setShowAuth(true)}
                  className="flat-card flat-card-hover"
                  style={{ textAlign: 'center', cursor: 'pointer', padding: '20px 12px', borderRadius: '8px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '44px', height: '44px', background: 'var(--color-teal-light)', border: '1.5px solid var(--color-teal-mid)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.icon}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-teal-dark)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '4px' }}>Base rate: {s.base}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── PLATFORM CAPABILITIES ─────────────────────────────────── */}
          <section style={{ background: 'var(--color-teal-dark)', padding: '60px 20px' }}>
            <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                <span className="flat-badge badge-emergency" style={{ marginBottom: '10px', display: 'inline-flex' }}>
                  Platform Architecture
                </span>
                <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: '#ffffff' }}>
                  Engineered for Reliability and Accountability
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {features.map(f => (
                  <div
                    key={f.title}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '22px' }}
                  >
                    <div style={{ width: '44px', height: '44px', borderRadius: '6px', background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                      {f.icon}
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: '0.96rem', color: '#ffffff', marginBottom: '6px' }}>{f.title}</h3>
                    <p style={{ fontSize: '0.84rem', color: '#a0c4cc', lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── PROCESS STEPS ─────────────────────────────────────────── */}
          <section id="how-it-works" className="container-fluid px-3 px-md-4 px-xl-5" style={{ padding: '60px 0', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <span className="flat-badge badge-coins" style={{ marginBottom: '10px', display: 'inline-flex' }}>
                Service Workflow
              </span>
              <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                How the Platform Operates
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {steps.map(s => (
                <div key={s.num} className="flat-card" style={{ height: '100%', padding: '22px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                      {s.icon}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-teal-light)' }}>{s.num}</div>
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--color-teal-dark)', marginBottom: '6px' }}>{s.title}</h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── FOR SERVICE PROVIDERS ─────────────────────────────────── */}
          <section id="for-providers" style={{ background: 'var(--color-gold-light)', borderTop: '2px solid var(--color-gold)', borderBottom: '2px solid var(--color-gold)', padding: '60px 20px' }}>
            <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', alignItems: 'center' }}>
              <div>
                <span className="flat-badge badge-coins" style={{ marginBottom: '12px', display: 'inline-flex' }}>
                  Technician Network
                </span>
                <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-teal-dark)', lineHeight: 1.25 }}>
                  Expand Your Trade Operations with Verified Work Orders
                </h2>
                <p style={{ color: 'var(--color-muted)', marginTop: '12px', lineHeight: 1.65, fontSize: '0.92rem' }}>
                  Register as an independent contractor or trade company. Review local service requests, submit bids on urgent emergency jobs within your radius, and accumulate coin balances for quality delivery.
                </p>
                <button
                  onClick={() => setShowAuth(true)}
                  className="btn-flat btn-flat-gold"
                  style={{ marginTop: '20px', padding: '12px 22px' }}
                >
                  <Wrench size={17} /> Register Provider Profile <ChevronRight size={17} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { icon: <Coins size={20} color="var(--color-dark)" />, title: 'Guaranteed Base Compensation', desc: 'Pre-set minimum labor rates with bonus platform coins for top customer ratings.' },
                  { icon: <Clock size={20} color="var(--color-dark)" />, title: 'Calendar Conflict Prevention', desc: 'System alerts and checks ensure you never face overlapping job commitments.' },
                  { icon: <ShieldCheck size={20} color="var(--color-dark)" />, title: 'Identity-Verified Marketplace', desc: 'Direct client interactions backed by documented work orders and mutual reviews.' },
                ].map(item => (
                  <div key={item.title} style={{ background: '#fff', border: '2px solid var(--color-gold)', borderRadius: '8px', padding: '16px', boxShadow: '3px 3px 0 var(--color-gold)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', background: 'var(--color-gold-light)', borderRadius: '6px', border: '1.5px solid var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-teal-dark)' }}>{item.title}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '3px' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA SECTION ───────────────────────────────────────────── */}
          <section className="container-fluid px-3 px-md-4 px-xl-5" style={{ padding: '60px 0', maxWidth: '1600px', margin: '0 auto', textAlign: 'center' }}>
            <div className="flat-card flat-card-teal" style={{ padding: '44px 24px', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
              <div className="awning-banner" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
              <div style={{ marginTop: '16px' }}>
                <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: '#fff' }}>
                  Ready to Book or Offer Services?
                </h2>
                <p style={{ color: '#b8d8de', marginTop: '10px', fontSize: '0.92rem', maxWidth: '520px', margin: '10px auto 0' }}>
                  Register once and access both customer booking and technician bidding portals.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="btn-flat btn-flat-red"
                    style={{ padding: '12px 24px', fontSize: '0.95rem', gap: '8px' }}
                  >
                    <User size={17} /> Book a Service
                  </button>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="btn-flat btn-flat-gold"
                    style={{ padding: '12px 24px', fontSize: '0.95rem', gap: '8px' }}
                  >
                    <Wrench size={17} /> Offer Services
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer style={{ backgroundColor: 'var(--color-teal-dark)', color: '#fff', borderTop: '2px solid var(--color-teal-mid)', padding: '28px 20px 24px' }}>
          <div className="awning-banner" style={{ marginBottom: '20px' }} />
          <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '30px', height: '30px', background: 'var(--color-terracotta)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wrench size={16} color="#fff" />
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>UrbanClap</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#8dc0ca', lineHeight: 1.6 }}>
                Verified home services and emergency maintenance marketplace.
              </p>
              <div style={{ fontSize: '0.78rem', color: '#b8d8de', marginTop: '10px' }}>
                Custom Domain: <strong>urbanclap.local</strong>
              </div>
            </div>

            <div>
              <h4 style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '10px', color: '#c8dfe3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Platform
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem', color: '#8dc0ca' }}>
                <a href="#services" style={{ color: 'inherit', textDecoration: 'none' }}>Trade Categories</a>
                <a href="#how-it-works" style={{ color: 'inherit', textDecoration: 'none' }}>Dispatch Process</a>
                <a href="#for-providers" style={{ color: 'inherit', textDecoration: 'none' }}>Provider Requirements</a>
              </div>
            </div>

            <div>
              <h4 style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '10px', color: '#c8dfe3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Legal &amp; Policy
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem' }}>
                <button
                  onClick={() => navigateToView('privacy')}
                  style={{ background: 'none', border: 'none', color: '#8dc0ca', textAlign: 'left', padding: 0, cursor: 'pointer', fontSize: '0.84rem' }}
                >
                  Privacy Policy
                </button>
                <button
                  onClick={() => navigateToView('terms')}
                  style={{ background: 'none', border: 'none', color: '#8dc0ca', textAlign: 'left', padding: 0, cursor: 'pointer', fontSize: '0.84rem' }}
                >
                  Terms and Conditions
                </button>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '20px', paddingTop: '16px', textAlign: 'center', fontSize: '0.78rem', color: '#6a9aa6' }}>
            © 2026 UrbanClap Marketplace. All rights reserved. No artificial metrics or simulated testimonials.
          </div>
        </footer>
      </div>
    </>
  );
};
