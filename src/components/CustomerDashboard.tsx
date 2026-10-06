import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ServiceType, ProviderPreference } from '../types';
import {
  PlusCircle, Calendar as CalendarIcon, Clock, MessageSquare,
  CheckCircle, Star, Image as ImageIcon, MapPin, Zap, Phone
} from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const { currentUser, categories, requests, createServiceRequest, acceptBid, openChat, openCompulsoryReview } = useApp();

  const [activeTab, setActiveTab] = useState<'create' | 'bidding' | 'calendar' | 'history'>('create');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || 'cat_plumbing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('ordinary');
  const [providerPreference, setProviderPreference] = useState<ProviderPreference>('either');
  const [area, setArea] = useState(currentUser?.area || 'Downtown Metro');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [imageUrl, setImageUrl] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const categoryObj = categories.find(c => c.id === selectedCategory) || categories[0];
  const basePrice = categoryObj?.base_price || 500;
  const minPrice = serviceType === 'emergency' ? Math.round(basePrice * 1.30) : basePrice;

  const [offeredPrice, setOfferedPrice] = useState<number>(minPrice);

  React.useEffect(() => {
    setOfferedPrice(prev => Math.max(prev, minPrice));
  }, [minPrice]);

  // Minimum date calculation: Ordinary service MUST start at least 2 days from today
  const minOrdinaryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const minDateForInput = serviceType === 'ordinary' ? minOrdinaryDate : new Date().toISOString().split('T')[0];

  const myRequests = requests.filter(r => r.customer_id === currentUser?.id);
  const activeBiddingRequests = myRequests.filter(r => r.service_type === 'emergency' && r.status === 'bidding_active');
  // Posted services (ordinary & emergency) are shown in calendar
  const upcomingBookings = myRequests.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
  // All posted listings history
  const pastHistory = myRequests;

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { setErrorMsg('Please provide a title and issue description.'); return; }
    
    // Validate ordinary service date requirement (+2 days minimum)
    if (serviceType === 'ordinary' && customDate && customDate < minOrdinaryDate) {
      setErrorMsg(`Ordinary home services must be booked at least 2 days in advance (starting from ${minOrdinaryDate}). Today and tomorrow are disabled.`);
      return;
    }

    const finalOffered = Math.max(offeredPrice, minPrice);

    setSubmitting(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await createServiceRequest({
        category_id: selectedCategory,
        title,
        description,
        service_type: serviceType,
        provider_preference: providerPreference,
        area,
        customer_phone: phone,
        image_url: imageUrl.trim() || categoryObj?.default_image,
        custom_date: customDate || (serviceType === 'ordinary' ? minOrdinaryDate : new Date().toISOString().split('T')[0]),
        offered_price: finalOffered
      });
      setSuccessMsg(serviceType === 'emergency' ? `Emergency listing posted at ₹${finalOffered}! 45-min bidding arena broadcasted to eligible providers.` : `Ordinary listing posted at ₹${finalOffered}! Scheduled starting from ${customDate || minOrdinaryDate}.`);
      setTitle(''); setDescription(''); setImageUrl('');
      setActiveTab(serviceType === 'emergency' ? 'bidding' : 'calendar');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptBid = async (requestId: string, providerId: string, amount: number) => {
    try {
      await acceptBid(requestId, providerId, amount);
      alert('Provider accepted! Work order assigned. Chat to confirm timing.');
    } catch (err: any) { alert(err.message); }
  };

  // ── Sub-tab nav ──────────────────────────────────────────────────────────
  const tabs = [
    { id: 'create', icon: <PlusCircle size={15} />, label: 'Post Service' },
    { id: 'bidding', icon: <Zap size={15} />, label: `Bidding${activeBiddingRequests.length ? ` (${activeBiddingRequests.length})` : ''}` },
    { id: 'calendar', icon: <CalendarIcon size={15} />, label: `Calendar (${upcomingBookings.length})` },
    { id: 'history', icon: <Clock size={15} />, label: `History (${pastHistory.length})` },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Sub Nav */}
      <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-teal-dark)', boxShadow: 'var(--shadow-flat)' }}>
        <div className="subnav-tabs">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`btn-flat ${activeTab === tab.id ? (tab.id === 'bidding' ? 'btn-flat-gold' : tab.id === 'create' ? 'btn-flat-red' : 'btn-flat') : 'btn-flat-secondary'}`}
              style={{ fontSize: '0.82rem', padding: '7px 12px', width: 'auto', gap: '5px', flexShrink: 0 }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-teal-dark)', marginTop: '8px' }}>
          Your Area: <strong>{currentUser?.area}</strong>
        </div>
      </div>

      {/* ── TAB: CREATE ─────────────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="flat-card" style={{ backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ background: 'var(--color-terracotta)', padding: '8px', borderRadius: '10px', color: '#fff', flexShrink: 0 }}>
              <PlusCircle size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 'clamp(1rem, 4vw, 1.35rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Post a New Service Request</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Choose ordinary standard service or Emergency Bidding (+30% surcharge).</p>
            </div>
          </div>

          {successMsg && <div style={{ background: '#f0fdf4', color: '#166534', padding: '11px 14px', borderRadius: '8px', border: '2px solid #22c55e', marginBottom: '16px', fontWeight: 700, fontSize: '0.88rem' }}>{successMsg}</div>}
          {errorMsg && <div style={{ background: 'var(--color-coral-light)', color: 'var(--color-terracotta-dark)', padding: '11px 14px', borderRadius: '8px', border: '2px solid var(--color-terracotta)', marginBottom: '16px', fontWeight: 700, fontSize: '0.88rem' }}>{errorMsg}</div>}

          <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Category Grid — always uses auto-fit so it stacks cleanly */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '8px', fontSize: '0.9rem' }}>Select Service Category</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {categories.map(cat => (
                  <div key={cat.id} onClick={() => setSelectedCategory(cat.id)} style={{
                    border: `2px solid ${selectedCategory === cat.id ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                    borderRadius: '10px', padding: '10px', cursor: 'pointer',
                    backgroundColor: selectedCategory === cat.id ? 'var(--color-coral-light)' : '#fff',
                    boxShadow: selectedCategory === cat.id ? 'var(--shadow-flat-red)' : 'none', transition: 'all .15s ease'
                  }}>
                    <img src={cat.default_image} alt={cat.name} style={{ width: '100%', height: '68px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--color-teal-dark)', lineHeight: 1.3 }}>{cat.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '2px' }}>Min ₹{cat.base_price}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Type Toggle */}
            <div style={{ backgroundColor: 'var(--bg-sand)', padding: '16px', borderRadius: '10px', border: '2px solid var(--color-teal-dark)' }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-teal-dark)', marginBottom: '10px' }}>Service Urgency & Pricing</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                {([
                  { type: 'ordinary', label: 'Ordinary Listing', price: basePrice, desc: 'Delivered in 2-3 days. Standard base labor charge.', badgeClass: 'badge-ordinary', borderColor: 'var(--color-teal-dark)', bg: '#fff' },
                  { type: 'emergency', label: 'Emergency (+30%)', price: Math.round(basePrice * 1.30), desc: 'Same/next day! Triggers 45-min live bidding within 13km.', badgeClass: 'badge-emergency', borderColor: 'var(--color-terracotta)', bg: 'var(--color-coral-light)' },
                ] as const).map(opt => (
                  <div key={opt.type} onClick={() => setServiceType(opt.type)} style={{
                    padding: '12px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${serviceType === opt.type ? opt.borderColor : '#cbd5e1'}`,
                    backgroundColor: serviceType === opt.type ? opt.bg : 'transparent',
                    boxShadow: serviceType === opt.type ? (opt.type === 'emergency' ? 'var(--shadow-flat-red)' : 'var(--shadow-flat)') : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span className={`flat-badge ${opt.badgeClass}`}>{opt.label}</span>
                      <strong style={{ fontSize: '1rem', color: opt.type === 'emergency' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)' }}>Min ₹{opt.price}</strong>
                    </div>
                    <p style={{ fontSize: '0.8rem', marginTop: '5px', color: opt.type === 'emergency' ? 'var(--color-dark)' : 'var(--color-muted)', fontWeight: opt.type === 'emergency' ? 600 : 400 }}>{opt.desc}</p>
                  </div>
                ))}
              </div>

              {/* Dynamic Price Adjustment — Cannot go below minPrice, but can go above it */}
              <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '8px', border: '1.5px solid var(--color-teal-dark)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-teal-dark)' }}>
                      Set Your Service Fee (Labor Charge)
                    </label>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-muted)' }}>
                      Minimum floor: <strong>₹{minPrice}</strong>. (You can increase above minimum to attract top providers, but cannot offer below ₹{minPrice}).
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-terracotta-dark)' }}>₹</span>
                    <input
                      type="number"
                      className="flat-input"
                      style={{ width: '100px', fontWeight: 800, fontSize: '1rem', padding: '6px 10px', textAlign: 'right' }}
                      min={minPrice}
                      step={50}
                      value={offeredPrice}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setOfferedPrice(val >= minPrice ? val : minPrice);
                      }}
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={minPrice}
                  max={minPrice * 4}
                  step={50}
                  value={offeredPrice < minPrice ? minPrice : offeredPrice}
                  onChange={e => setOfferedPrice(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-terracotta)', cursor: 'pointer', height: '6px' }}
                />

                {/* Material Fee Clarification Notice */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-teal-dark)', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <span>🛠️</span>
                  <span><strong>Important Notice:</strong> This amount is purely the provider's <strong>service & labor charge</strong>. Material/spare part costs are not included and are payable separately.</span>
                </div>
              </div>
            </div>

            {/* Fields row — 2-col on desktop, 1-col mobile via auto-fit */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '5px', fontSize: '0.88rem' }}>Service Title *</label>
                <input type="text" className="flat-input" placeholder="e.g., Water Pipe Leak under kitchen sink" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '5px', fontSize: '0.88rem' }}>Provider Preference *</label>
                <select className="flat-select" value={providerPreference} onChange={e => setProviderPreference(e.target.value as ProviderPreference)}>
                  <option value="either">Either Organization or Freelancer</option>
                  <option value="organization">Organization (Registered Agency)</option>
                  <option value="freelancer">Individual Freelancer</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '5px', fontSize: '0.88rem' }}>Issue Description *</label>
              <textarea className="flat-textarea" rows={3} placeholder="Describe exact details, parts needed, or access instructions..." value={description} onChange={e => setDescription(e.target.value)} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '5px', fontSize: '0.88rem' }}>
                  <MapPin size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} /> Neighborhood Area *
                </label>
                <input type="text" className="flat-input" placeholder="e.g., Downtown Metro" value={area} onChange={e => setArea(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '5px', fontSize: '0.88rem' }}>
                  <Phone size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} /> Contact Phone *
                </label>
                <input type="text" className="flat-input" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
            </div>

            {/* Image + Date */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '5px', fontSize: '0.88rem' }}>
                  <ImageIcon size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} /> Issue Image URL (Optional)
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="url" className="flat-input" placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} style={{ flex: 1 }} />
                  <img src={imageUrl.trim() || categoryObj?.default_image} alt="preview" style={{ width: '48px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1.5px solid var(--color-teal-dark)', flexShrink: 0 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '5px', fontSize: '0.88rem' }}>Preferred Service Date *</label>
                <input
                  type="date"
                  className="flat-input"
                  min={minDateForInput}
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                />
                <span style={{ fontSize: '0.74rem', color: serviceType === 'ordinary' ? 'var(--color-terracotta)' : 'var(--color-muted)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                  {serviceType === 'emergency'
                    ? '⚡ Emergency: Available for Today & Tomorrow'
                    : `📅 Ordinary: Earliest available date starts from ${minOrdinaryDate} (Today & Tomorrow are greyed out)`}
                </span>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-flat btn-flat-red" style={{ width: '100%', padding: '13px', fontSize: '0.98rem' }}>
              {serviceType === 'emergency' ? <><Zap size={18} /> Broadcast Emergency (₹{minPrice})</> : <><CheckCircle size={18} /> Post Ordinary Listing (₹{basePrice})</>}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB: BIDDING ────────────────────────────────────────────────────── */}
      {activeTab === 'bidding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="flat-card flat-card-teal" style={{ padding: '16px 18px' }}>
            <h2 style={{ fontSize: 'clamp(1rem, 4vw, 1.25rem)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={20} color="var(--color-gold)" /> Emergency Bidding Arena
            </h2>
            <p style={{ color: '#d0e5e8', fontSize: '0.84rem', marginTop: '4px' }}>Providers within 13 km & ≥3.5★ bid within 45 minutes. Select your preferred provider!</p>
          </div>

          {activeBiddingRequests.length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--color-muted)' }}>
              No active emergency bidding requests. Create an Emergency listing to see live bids!
            </div>
          ) : activeBiddingRequests.map(req => (
            <div key={req.id} className="flat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                    <span className="flat-badge badge-emergency">EMERGENCY</span>
                    <span className="flat-badge badge-coins">₹{req.final_price} (+30%)</span>
                  </div>
                  <h3 style={{ fontSize: 'clamp(0.95rem, 3vw, 1.15rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>{req.title}</h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--color-dark)', marginTop: '2px' }}>{req.description}</p>
                </div>
                <button onClick={() => openChat(req.id)} className="btn-flat btn-flat-gold" style={{ flexShrink: 0, width: 'auto', fontSize: '0.84rem' }}>
                  <MessageSquare size={15} /> Chat ({req.chatCount || 0})
                </button>
              </div>

              <div style={{ borderTop: '2px dashed var(--color-teal-dark)', paddingTop: '14px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '10px' }}>
                  Bidders ({req.bids?.filter(b => b.status === 'bid_submitted' || b.status === 'interested').length || 0} / 10)
                </h4>
                {(!req.bids || !req.bids.filter(b => b.status === 'bid_submitted' || b.status === 'interested').length) ? (
                  <p style={{ fontSize: '0.84rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>Waiting for providers to submit bids…</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                    {req.bids.filter(b => b.status === 'bid_submitted' || b.status === 'interested').map(bid => (
                      <div key={bid.id} style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '10px', padding: '12px', backgroundColor: 'var(--bg-sand)', boxShadow: 'var(--shadow-flat-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--color-teal-dark)' }}>{bid.provider_name}</strong>
                          <span className="flat-badge badge-coins"><Star size={11} fill="var(--color-gold)" color="var(--color-gold)" /> {bid.provider_rating}★</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '3px' }}>{bid.provider_type.toUpperCase()}</div>
                        {bid.bid_amount && <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-terracotta)', marginTop: '6px' }}>₹{bid.bid_amount}</div>}
                        {bid.bid_note && <p style={{ fontSize: '0.78rem', fontStyle: 'italic', marginTop: '4px', color: 'var(--color-dark)' }}>"{bid.bid_note}"</p>}
                        <button onClick={() => handleAcceptBid(req.id, bid.provider_id, bid.bid_amount || req.final_price)}
                          className="btn-flat btn-flat-red" style={{ width: '100%', marginTop: '10px', fontSize: '0.82rem', padding: '7px 10px' }}>
                          <CheckCircle size={14} /> Accept & Hire
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: CALENDAR ───────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="flat-card" style={{ backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <CalendarIcon size={22} color="var(--color-teal-dark)" />
            <div>
              <h2 style={{ fontSize: 'clamp(1rem, 4vw, 1.25rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Scheduled Services & Active Postings Calendar</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>All services posted by you appear here with dates, bidding status, and assigned provider info.</p>
            </div>
          </div>
          {upcomingBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--color-muted)' }}>
              No active or upcoming service listings posted yet. Use <strong>Post Service</strong> tab to create one!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {upcomingBookings.map(req => (
                <div key={req.id} style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '12px', padding: '16px', backgroundColor: 'var(--color-teal-light)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                        <span className="flat-badge badge-ordinary">📅 Date: {req.scheduled_date}</span>
                        {req.service_type === 'emergency' ? (
                          <span className="flat-badge badge-emergency">⚡ Emergency</span>
                        ) : (
                          <span className="flat-badge badge-ordinary">🔧 Ordinary</span>
                        )}
                        <span className="flat-badge badge-coins">₹{req.final_price || req.base_price}</span>
                        <span className="flat-badge" style={{ background: req.status === 'assigned' ? '#dcfce7' : req.status === 'in_progress' ? '#fef3c7' : '#e0f2fe', color: 'var(--color-teal-dark)', border: '1.5px solid var(--color-teal-dark)' }}>
                          Status: {req.status === 'bidding_active' ? '🟢 Bidding Active' : req.status === 'assigned' ? '🛠️ Assigned' : req.status === 'in_progress' ? '⏳ In Progress' : req.status}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>{req.title}</h4>
                      <p style={{ fontSize: '0.84rem', color: 'var(--color-dark)', marginTop: '3px' }}>{req.description}</p>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '6px' }}>
                        Category: <strong>{req.category_name}</strong> · Area: <strong>{req.area}</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-teal-dark)', marginTop: '4px', fontWeight: 700 }}>
                        Provider: {req.assigned_provider_name ? <strong>{req.assigned_provider_name}</strong> : <span style={{ fontStyle: 'italic', color: 'var(--color-muted)' }}>Awaiting provider acceptance</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => openChat(req.id)} className="btn-flat btn-flat-gold" style={{ width: 'auto', fontSize: '0.82rem', padding: '8px 12px' }}>
                        <MessageSquare size={14} /> Chat ({req.chatCount || 0})
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HISTORY ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="flat-card" style={{ backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <Clock size={22} color="var(--color-teal-dark)" />
            <div>
              <h2 style={{ fontSize: 'clamp(1rem, 4vw, 1.25rem)', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Your Service Postings History</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Complete list of all service requests previously posted by your account.</p>
            </div>
          </div>

          {pastHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--color-muted)' }}>
              No service postings in history yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {pastHistory.map(req => (
                <div key={req.id} style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '12px', padding: '16px', backgroundColor: req.status === 'completed' ? '#f0fdf4' : req.status === 'cancelled' ? '#fef2f2' : '#fff' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                        <span className="flat-badge badge-ordinary">🗓️ Posted: {new Date(req.created_at || Date.now()).toLocaleDateString()}</span>
                        <span className="flat-badge badge-ordinary">📅 Scheduled: {req.scheduled_date}</span>
                        {req.service_type === 'emergency' ? (
                          <span className="flat-badge badge-emergency">⚡ Emergency</span>
                        ) : (
                          <span className="flat-badge badge-ordinary">🔧 Ordinary</span>
                        )}
                        <span className="flat-badge badge-coins">₹{req.final_price || req.base_price}</span>
                        <span className="flat-badge" style={{
                          background: req.status === 'completed' ? '#22c55e' : req.status === 'cancelled' ? 'var(--color-terracotta)' : 'var(--color-gold)',
                          color: '#fff', border: 'none'
                        }}>
                          {req.status === 'completed' ? '✅ Completed' : req.status === 'cancelled' ? '❌ Cancelled' : `📋 Status: ${req.status}`}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>{req.title}</h4>
                      <p style={{ fontSize: '0.84rem', color: 'var(--color-dark)', marginTop: '2px' }}>{req.description}</p>
                      <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Provider: <strong>{req.assigned_provider_name || 'N/A'}</strong> · Category: <strong>{req.category_name}</strong>
                      </p>
                      {req.review && (
                        <div style={{ marginTop: '8px', background: '#fff', border: '1.5px solid var(--color-gold)', borderRadius: '8px', padding: '8px 10px', fontSize: '0.8rem' }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-dark)' }}>Your Rating: {req.review.stars}★</span>
                          {req.review.feedback && <span style={{ color: 'var(--color-muted)', marginLeft: '8px', fontStyle: 'italic' }}>"{req.review.feedback}"</span>}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => openChat(req.id)} className="btn-flat btn-flat-secondary" style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 10px' }}>
                        <MessageSquare size={14} /> Messages
                      </button>
                      {req.status === 'completed' && !req.review && (
                        <button onClick={() => openCompulsoryReview(req.id)} className="btn-flat btn-flat-gold" style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 10px' }}>
                          <Star size={14} /> Rate & Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
