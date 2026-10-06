import React, { useState } from 'react';
import { AuthModal } from './AuthModal';
import {
  Wrench, Zap, Star, ShieldCheck, Clock, MessageCircle,
  Calendar, Coins, ChevronRight, User, CheckCircle2, ArrowRight
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);

  const features = [
    {
      icon: <Wrench size={28} color="#fff" />,
      bg: 'var(--color-teal-dark)',
      title: 'Home Services',
      desc: 'Plumbing, electrical, cleaning, AC repair — book trusted professionals for any home need.'
    },
    {
      icon: <Zap size={28} color="#fff" />,
      bg: 'var(--color-terracotta)',
      title: 'Emergency Dispatch',
      desc: 'Urgent issue? Our live bidding system connects you to nearby verified pros within 45 minutes.'
    },
    {
      icon: <MessageCircle size={28} color="var(--color-dark)" />,
      bg: 'var(--color-gold)',
      title: 'Real-time Chat',
      desc: 'Communicate directly with your service provider — share images, schedule timing, and more.'
    },
    {
      icon: <Calendar size={28} color="#fff" />,
      bg: 'var(--color-teal-mid)',
      title: 'Smart Scheduling',
      desc: 'Providers manage their calendar so there are zero double bookings or clashes.'
    },
    {
      icon: <Star size={28} color="var(--color-dark)" />,
      bg: 'var(--color-gold-light)',
      title: 'Verified Reviews',
      desc: 'Every completed service requires a star review — keeping quality high for everyone.'
    },
    {
      icon: <Coins size={28} color="var(--color-dark)" />,
      bg: 'var(--color-gold-light)',
      title: 'Coins & Rewards',
      desc: 'Providers earn coins per job, bonus coins for 5-star ratings — driving excellence.'
    },
  ];

  const steps = [
    { num: '01', icon: <User size={22} />, title: 'Sign Up or Log In', desc: 'One account. Switch between Customer and Service Provider anytime.', color: '#0ea5e9' },
    { num: '02', icon: <Wrench size={22} />, title: 'Post or Bid a Service', desc: 'Customers post needs. Providers browse and respond to matching jobs.', color: 'var(--color-terracotta)' },
    { num: '03', icon: <ShieldCheck size={22} />, title: 'Confirm & Schedule', desc: 'Chat, agree on timing, and get the job done — ordinary or emergency.', color: '#22c55e' },
    { num: '04', icon: <Star size={22} />, title: 'Review & Earn', desc: 'Customer leaves a review. Provider earns coins. Platform stays trusted.', color: 'var(--color-gold)' },
  ];

  const services = [
    { emoji: '🔧', name: 'Plumbing', base: '₹300' },
    { emoji: '⚡', name: 'Electrical', base: '₹400' },
    { emoji: '🧹', name: 'Cleaning', base: '₹250' },
    { emoji: '❄️', name: 'AC Repair', base: '₹500' },
    { emoji: '🎨', name: 'Painting', base: '₹600' },
    { emoji: '🪚', name: 'Carpentry', base: '₹350' },
    { emoji: '📺', name: 'Appliance Repair', base: '₹450' },
    { emoji: '🏠', name: 'Pest Control', base: '₹700' },
  ];

  return (
    <>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── NAV ────────────────────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          backgroundColor: 'var(--color-teal-dark)',
          borderBottom: '2px solid var(--color-teal-mid)',
          padding: '0 20px',
        }}>
          <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--color-terracotta)', borderRadius: '8px', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '2px 2px 0 rgba(0,0,0,0.3)', flexShrink: 0 }}>
                <Wrench size={18} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 'clamp(1rem, 3vw, 1.25rem)', color: '#ffffff', letterSpacing: '-0.3px' }}>UrbanClap</span>
            </div>

            {/* Nav links (hidden on small screens) */}
            <div style={{ display: 'flex', gap: '4px', overflow: 'hidden' }}>
              {['Services', 'How It Works', 'For Providers'].map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} style={{
                  color: '#c8dfe3', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
                  padding: '6px 10px', borderRadius: '6px', whiteSpace: 'nowrap',
                  transition: 'color 0.15s, background 0.15s'
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#c8dfe3')}>
                  {l}
                </a>
              ))}
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-secondary"
                style={{ padding: '8px 14px', fontSize: '0.85rem', boxShadow: '2px 2px 0 rgba(255,255,255,0.3)', border: '2px solid rgba(255,255,255,0.5)', color: 'var(--color-teal-dark)', gap: '5px' }}>
                <User size={15} /> Login
              </button>
              <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-red"
                style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '5px' }}>
                Get Started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </nav>

        <main style={{ flex: 1 }}>

          {/* ── HERO ────────────────────────────────────────────────────── */}
          <section style={{ background: 'var(--color-teal-dark)', padding: '60px 20px 80px', position: 'relative', overflow: 'hidden' }}>
            {/* Background decoration */}
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(217,78,56,0.12)', pointerEvents: 'none' }} />

            <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px', alignItems: 'center' }}>
              {/* Text */}
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
                  <span className="flat-badge badge-emergency" style={{ fontSize: '0.78rem' }}>🚀 Live in Your City</span>
                  <span className="flat-badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>⭐ 4.8 Avg Rating</span>
                </div>
                <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 3rem)', fontWeight: 800, color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.5px' }}>
                  Home Services,<br />
                  <span style={{ color: 'var(--color-gold)' }}>On Your Terms.</span>
                </h1>
                <p style={{ color: '#b8d8de', fontSize: 'clamp(0.9rem, 2.5vw, 1.05rem)', marginTop: '16px', lineHeight: 1.7, maxWidth: '480px' }}>
                  Book trusted professionals for everyday home services — or trigger our emergency dispatch for urgent needs. One account, two roles. Switch anytime.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '28px' }}>
                  <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-red"
                    style={{ padding: '13px 24px', fontSize: '1rem', gap: '8px', boxShadow: '4px 4px 0 rgba(0,0,0,0.3)' }}>
                    Book a Service <ChevronRight size={18} />
                  </button>
                  <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-gold"
                    style={{ padding: '13px 24px', fontSize: '1rem', gap: '8px' }}>
                    <Wrench size={18} /> Offer Services
                  </button>
                </div>
                {/* Trust bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '28px' }}>
                  {[
                    { val: '500+', label: 'Verified Pros' },
                    { val: '12K+', label: 'Jobs Done' },
                    { val: '4.8★', label: 'Avg Rating' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{s.val}</div>
                      <div style={{ fontSize: '0.78rem', color: '#8dc0ca', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hero card illustration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* "Live job" card */}
                <div style={{ background: '#fff', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.15)', padding: '18px', boxShadow: '6px 6px 0 rgba(0,0,0,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span className="flat-badge badge-emergency" style={{ marginBottom: '8px', display: 'inline-flex' }}>⚡ Emergency</span>
                      <h3 style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--color-teal-dark)' }}>Water Pipe Burst — Kitchen</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '3px' }}>Downtown Metro · 13 km radius · 45-min arena</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>₹520</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>+30% surge</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-teal-dark)', background: 'var(--color-teal-light)', padding: '4px 8px', borderRadius: '20px' }}>7 bids received</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', background: '#f0fdf4', padding: '4px 8px', borderRadius: '20px', border: '1px solid #22c55e' }}>🟢 Live now</span>
                  </div>
                </div>
                {/* Provider card */}
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '14px', border: '1.5px solid rgba(255,255,255,0.2)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-terracotta)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', flexShrink: 0 }}>
                      <Wrench size={20} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>Rajesh QuickFix</div>
                      <div style={{ fontSize: '0.75rem', color: '#b8d8de' }}>⭐ 4.8 · Plumber · 2.4km away</div>
                    </div>
                  </div>
                  <span className="flat-badge" style={{ background: '#22c55e', color: '#fff', border: 'none' }}>
                    <CheckCircle2 size={12} /> Accepted
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Awning stripe separator */}
          <div className="awning-banner" />

          {/* ── SERVICES GRID ─────────────────────────────────────────── */}
          <section id="services" className="container-fluid px-3 px-md-4 px-xl-5" style={{ padding: '64px 0', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <span className="flat-badge badge-ordinary" style={{ marginBottom: '10px', display: 'inline-flex' }}>Our Services</span>
              <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Everything Your Home Needs</h2>
              <p style={{ color: 'var(--color-muted)', marginTop: '8px', fontSize: '0.95rem', maxWidth: '500px', margin: '8px auto 0' }}>From everyday maintenance to urgent repairs — all under one platform.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
              {services.map(s => (
                <div key={s.name} onClick={() => setShowAuth(true)}
                  className="flat-card flat-card-hover"
                  style={{ textAlign: 'center', cursor: 'pointer', padding: '18px 10px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{s.emoji}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-teal-dark)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '3px' }}>from {s.base}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FEATURES GRID ─────────────────────────────────────────── */}
          <section style={{ background: 'var(--color-teal-dark)', padding: '64px 20px' }}>
            <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <span className="flat-badge badge-emergency" style={{ marginBottom: '10px', display: 'inline-flex' }}>Platform Features</span>
                <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: '#ffffff' }}>Built for Speed & Trust</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {features.map(f => (
                  <div key={f.title} style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '22px', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', border: '2px solid rgba(255,255,255,0.3)' }}>
                      {f.icon}
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ffffff', marginBottom: '6px' }}>{f.title}</h3>
                    <p style={{ fontSize: '0.84rem', color: '#a0c4cc', lineHeight: 1.65 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
          <section id="how-it-works" className="container-fluid px-3 px-md-4 px-xl-5" style={{ padding: '64px 0', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <span className="flat-badge badge-coins" style={{ marginBottom: '10px', display: 'inline-flex' }}>Simple Process</span>
              <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>How It Works</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {steps.map(s => (
                <div key={s.num} style={{ position: 'relative' }}>
                  <div className="flat-card" style={{ height: '100%', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                        {s.icon}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-teal-light)', lineHeight: 1 }}>{s.num}</div>
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--color-teal-dark)', marginBottom: '6px' }}>{s.title}</h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--color-muted)', lineHeight: 1.65 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FOR PROVIDERS ─────────────────────────────────────────── */}
          <section id="for-providers" style={{ background: 'var(--color-gold-light)', borderTop: '2px solid var(--color-gold)', borderBottom: '2px solid var(--color-gold)', padding: '64px 20px' }}>
            <div className="container-fluid px-3 px-md-4 px-xl-5" style={{ maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', alignItems: 'center' }}>
              <div>
                <span className="flat-badge badge-coins" style={{ marginBottom: '12px', display: 'inline-flex' }}>For Service Providers</span>
                <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-teal-dark)', lineHeight: 1.2 }}>
                  Grow Your Business.<br />Earn More Coins.
                </h2>
                <p style={{ color: 'var(--color-muted)', marginTop: '12px', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  Join as a service provider with your existing account. Browse jobs in your area, bid on emergency requests, and earn coins for every completed service + review.
                </p>
                <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-gold" style={{ marginTop: '20px', padding: '12px 22px' }}>
                  <Wrench size={18} /> Join as Provider <ChevronRight size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { icon: <Coins size={20} color="var(--color-dark)" />, title: 'Min 25 Coins per job', desc: 'Earn bonus coins for 5-star reviews. Base pay guaranteed.' },
                  { icon: <Clock size={20} color="var(--color-dark)" />, title: 'Smart Calendar', desc: 'Auto clash detection — never double-book again.' },
                  { icon: <ShieldCheck size={20} color="var(--color-dark)" />, title: 'Verified Profile', desc: 'Build your reputation with real reviews from real customers.' },
                ].map(item => (
                  <div key={item.title} style={{ background: '#fff', border: '2px solid var(--color-gold)', borderRadius: '12px', padding: '14px 16px', boxShadow: '3px 3px 0 var(--color-gold)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', background: 'var(--color-gold-light)', borderRadius: '8px', border: '2px solid var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-teal-dark)' }}>{item.title}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA BANNER ────────────────────────────────────────────── */}
          <section className="container-fluid px-3 px-md-4 px-xl-5" style={{ padding: '64px 0', maxWidth: '1600px', margin: '0 auto', textAlign: 'center' }}>
            <div className="flat-card flat-card-teal" style={{ padding: '40px 24px', borderRadius: '20px', overflow: 'hidden', position: 'relative' }}>
              <div className="awning-banner" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
              <div style={{ marginTop: '12px' }}>
                <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: '#fff' }}>Ready to Get Started?</h2>
                <p style={{ color: '#b8d8de', marginTop: '10px', fontSize: '0.95rem', maxWidth: '500px', margin: '10px auto 0' }}>
                  Join thousands of happy customers and skilled providers. One account — use it as a customer, a provider, or both.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
                  <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-red"
                    style={{ padding: '13px 28px', fontSize: '1rem', gap: '8px', boxShadow: '4px 4px 0 rgba(0,0,0,0.3)' }}>
                    <User size={18} /> Book a Service
                  </button>
                  <button onClick={() => setShowAuth(true)} className="btn-flat btn-flat-gold"
                    style={{ padding: '13px 28px', fontSize: '1rem', gap: '8px' }}>
                    <Wrench size={18} /> Offer My Services
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
              <p style={{ fontSize: '0.82rem', color: '#8dc0ca', lineHeight: 1.65 }}>
                Your trusted home services marketplace. Professional, verified, and always available.
              </p>
            </div>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '10px', color: '#c8dfe3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Platform</h4>
              {['Home Services', 'Emergency Dispatch', 'Provider Dashboard', 'How It Works'].map(l => (
                <div key={l} style={{ fontSize: '0.84rem', color: '#8dc0ca', marginBottom: '5px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#8dc0ca')}>{l}</div>
              ))}
            </div>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '10px', color: '#c8dfe3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Support</h4>
              {['Help Center', 'Safety Policy', 'Privacy Policy', 'Contact Us'].map(l => (
                <div key={l} style={{ fontSize: '0.84rem', color: '#8dc0ca', marginBottom: '5px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#8dc0ca')}>{l}</div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '20px', paddingTop: '16px', textAlign: 'center', fontSize: '0.78rem', color: '#6a9aa6' }}>
            © 2025 UrbanClap Service Marketplace. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
};
