import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Coins, Zap, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle,
  MessageSquare, Star, ShieldCheck, MapPin, Award, Send, Briefcase, Check,
  Heart, Bookmark, MoreHorizontal
} from 'lucide-react';

export const ProviderDashboard: React.FC = () => {
  const {
    currentUser,
    categories,
    requests,
    users,
    respondBid,
    bookOrdinaryWorkOrder,
    completeWorkOrder,
    openChat
  } = useApp();

  const [activeTab, setActiveTab] = useState<'ordinary_market' | 'emergency' | 'work_orders' | 'calendar' | 'coins'>('ordinary_market');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [bidAmountInput, setBidAmountInput] = useState<{ [reqId: string]: string }>({});
  const [bidNoteInput, setBidNoteInput] = useState<{ [reqId: string]: string }>({});
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [likedPosts, setLikedPosts] = useState<{ [reqId: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [reqId: string]: boolean }>({});

  const toggleLike = (id: string) => {
    setLikedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSave = (id: string) => {
    setSavedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!currentUser) return null;

  // Rating, Distance & Minimum Coins Eligibility Verification
  const isRatingEligible = (currentUser.rating_avg || 0) >= 3.5;
  const isDistanceEligible = (currentUser.distance_km || 0) <= 13.0;
  const isCoinsEligible = (currentUser.coins || 0) >= 35;

  // Emergency Requests in active bidding state
  const emergencyRequests = requests.filter(r => r.service_type === 'emergency' && r.status === 'bidding_active');

  // Open Ordinary Requests available for booking
  const openOrdinaryRequests = requests.filter(r =>
    r.service_type === 'ordinary' &&
    r.status === 'bidding_active' &&
    (selectedCategory === 'all' || r.category_id === selectedCategory || r.category_name === selectedCategory)
  );

  // Work Orders assigned to current provider
  const assignedOrders = requests.filter(r => r.assigned_provider_id === currentUser.id && r.status !== 'completed');
  const completedOrders = requests.filter(r => r.assigned_provider_id === currentUser.id && r.status === 'completed');

  // Check date schedule collision
  const getProviderScheduledDates = () => {
    return requests
      .filter(r => r.assigned_provider_id === currentUser.id && (r.status === 'assigned' || r.status === 'in_progress'))
      .map(r => r.scheduled_date);
  };

  const scheduledDates = getProviderScheduledDates();

  const handleBookOrdinaryJob = async (requestId: string, title: string) => {
    setActionError('');
    setActionSuccess('');
    try {
      await bookOrdinaryWorkOrder(requestId);
      setActionSuccess(`Ordinary work order "${title}" successfully booked! Added to your Active Work Orders.`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to book ordinary job.');
    }
  };

  const handleResponse = async (requestId: string, response: 'interested' | 'not_interested', targetPrice: number) => {
    setActionError('');
    setActionSuccess('');

    const customBid = bidAmountInput[requestId] ? Number(bidAmountInput[requestId]) : targetPrice;
    const customNote = bidNoteInput[requestId] || '';

    try {
      await respondBid(requestId, response, customBid, customNote);
      setActionSuccess(
        response === 'interested'
          ? `Interest recorded! Your proposal of ₹${customBid} submitted to the customer.`
          : 'Status marked as Not Interested.'
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit response');
    }
  };

  const handleCompleteOrder = async (requestId: string) => {
    try {
      await completeWorkOrder(requestId);
      alert('Work order marked completed! Mandatory customer review requested (Minimum 25 coins + 5 star rating bonus will be awarded).');
    } catch (err: any) {
      alert(err.message || 'Failed to complete order');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Eligibility Banner */}
      <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="flat-badge badge-coins">
                <Coins size={14} /> COIN WALLET: {currentUser.coins} COINS
              </span>
              <span className="flat-badge badge-ordinary">
                <Star size={12} fill="var(--color-gold)" color="var(--color-gold)" /> {currentUser.rating_avg}★ Avg ({currentUser.total_reviews} Reviews)
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginTop: '6px' }}>
              {currentUser.name} ({currentUser.provider_type?.toUpperCase()})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              Location: <strong>{currentUser.area}</strong> ({currentUser.distance_km} km from central hub)
            </p>
          </div>

          {/* Eligibility Badge Matrix */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: `2px solid ${isCoinsEligible ? '#22c55e' : 'var(--color-terracotta)'}`,
              backgroundColor: isCoinsEligible ? '#f0fdf4' : 'var(--color-coral-light)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Coins size={16} color={isCoinsEligible ? '#166534' : 'var(--color-terracotta)'} />
              <span>Coins: {currentUser.coins} (Min 35 Required)</span>
            </div>

            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: `2px solid ${isRatingEligible ? '#22c55e' : 'var(--color-terracotta)'}`,
              backgroundColor: isRatingEligible ? '#f0fdf4' : 'var(--color-coral-light)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {isRatingEligible ? <ShieldCheck size={16} color="#166534" /> : <AlertCircle size={16} color="var(--color-terracotta)" />}
              <span>Rating: {currentUser.rating_avg}★ (Min 3.5★ Required)</span>
            </div>

            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: `2px solid ${isDistanceEligible ? '#22c55e' : 'var(--color-terracotta)'}`,
              backgroundColor: isDistanceEligible ? '#f0fdf4' : 'var(--color-coral-light)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MapPin size={16} />
              <span>Distance: {currentUser.distance_km} km (Max 13 km Radius)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Navigation */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '10px 16px',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-teal-dark)',
        boxShadow: 'var(--shadow-flat)'
      }}>
        <div className="subnav-tabs">
          <button
            onClick={() => setActiveTab('ordinary_market')}
            className={`btn-flat ${activeTab === 'ordinary_market' ? 'btn-flat-gold' : 'btn-flat-secondary'}`}
            style={{ fontSize: '0.88rem', flexShrink: 0 }}
          >
            <Briefcase size={16} /> Available Ordinary Works ({openOrdinaryRequests.length})
          </button>

          <button
            onClick={() => setActiveTab('emergency')}
            className={`btn-flat ${activeTab === 'emergency' ? 'btn-flat-gold' : 'btn-flat-secondary'}`}
            style={{ fontSize: '0.88rem', flexShrink: 0 }}
          >
            <Zap size={16} /> Emergency Bidding Area ({emergencyRequests.length})
          </button>

          <button
            onClick={() => setActiveTab('work_orders')}
            className={`btn-flat ${activeTab === 'work_orders' ? 'btn-flat-red' : 'btn-flat-secondary'}`}
            style={{ fontSize: '0.88rem', flexShrink: 0 }}
          >
            <CheckCircle size={16} /> Active Work Orders ({assignedOrders.length})
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`btn-flat ${activeTab === 'calendar' ? 'btn-flat' : 'btn-flat-secondary'}`}
            style={{ fontSize: '0.88rem', flexShrink: 0 }}
          >
            <CalendarIcon size={16} /> My Work Schedule
          </button>

          <button
            onClick={() => setActiveTab('coins')}
            className={`btn-flat ${activeTab === 'coins' ? 'btn-flat' : 'btn-flat-secondary'}`}
            style={{ fontSize: '0.88rem', flexShrink: 0 }}
          >
            <Coins size={16} /> Earnings & Coins Ledger ({currentUser.coins} coins)
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div style={{
          backgroundColor: '#f0fdf4',
          color: '#166534',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '2px solid #22c55e',
          fontWeight: 700
        }}>
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div style={{
          backgroundColor: 'var(--color-coral-light)',
          color: 'var(--color-terracotta-dark)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '2px solid var(--color-terracotta)',
          fontWeight: 700
        }}>
          {actionError}
        </div>
      )}

      {/* TAB 0: AVAILABLE ORDINARY WORKS MARKETPLACE - INSTAGRAM STYLE FEED */}
      {activeTab === 'ordinary_market' && (
        <div style={{ maxWidth: '620px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          
          {/* Instagram Story / Category Pill Filter Bar */}
          <div className="flat-card" style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                onClick={() => setSelectedCategory('all')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px',
                  border: `2px solid ${selectedCategory === 'all' ? 'var(--color-terracotta)' : '#cbd5e1'}`,
                  background: selectedCategory === 'all' ? 'var(--color-coral-light)' : '#f8fafc',
                  fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0
                }}
              >
                All Work Listings ({requests.filter(r => r.service_type === 'ordinary' && r.status === 'bidding_active').length})
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px',
                    border: `2px solid ${selectedCategory === c.id ? 'var(--color-terracotta)' : '#cbd5e1'}`,
                    background: selectedCategory === c.id ? 'var(--color-coral-light)' : '#f8fafc',
                    fontWeight: selectedCategory === c.id ? 800 : 600, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0
                  }}
                >
                  <span>{c.name.split(' ')[0]}</span> {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Service Feed Cards */}
          {openOrdinaryRequests.length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)', borderRadius: '8px' }}>
              No available service job postings in this feed right now.
            </div>
          ) : (
            openOrdinaryRequests.map(req => {
              const isClashing = scheduledDates.includes(req.scheduled_date);
              const isLiked = likedPosts[req.id];
              const isSaved = savedPosts[req.id];
              const customerObj = users?.find(u => u.id === req.customer_id);

              return (
                <div key={req.id} className="flat-card" style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  padding: '0',
                  overflow: 'hidden',
                  border: '2px solid var(--color-teal-dark)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                }}>
                  {/* 1. Post Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        padding: '2px', background: 'var(--color-teal-mid)', borderRadius: '6px'
                      }}>
                        <img
                          src={customerObj?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt={req.customer_name}
                          style={{ width: '38px', height: '38px', borderRadius: '4px', objectFit: 'cover', border: '1.5px solid #fff' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-teal-dark)' }}>
                          {req.customer_name} <span style={{ fontWeight: 500, color: 'var(--color-muted)', fontSize: '0.78rem' }}>• @{req.customer_name.toLowerCase().replace(/\s+/g, '_')}</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} /> {req.area} • Scheduled: {req.scheduled_date}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="flat-badge badge-ordinary">{req.category_name}</span>
                      <MoreHorizontal size={18} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
                    </div>
                  </div>

                  {/* 2. Media Section with Price Overlay */}
                  <div style={{ position: 'relative', width: '100%', backgroundColor: '#0f172a', overflow: 'hidden' }}>
                    <img
                      src={req.image_url}
                      alt={req.title}
                      style={{ width: '100%', maxHeight: '340px', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute', top: '12px', right: '12px',
                      background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '6px 12px', borderRadius: '6px',
                      backdropFilter: 'blur(4px)', fontWeight: 800, fontSize: '0.88rem', border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      Labor Charge: ₹{req.final_price}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: '10px', left: '12px',
                      background: 'rgba(15, 23, 42, 0.85)', color: '#e2e8f0', padding: '4px 10px', borderRadius: '6px',
                      fontSize: '0.72rem', fontWeight: 700
                    }}>
                      Notice: Service charge for labor only (materials extra)
                    </div>
                  </div>

                  {/* 3. Instagram Action Bar */}
                  <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <button
                        onClick={() => toggleLike(req.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Heart size={24} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'var(--color-teal-dark)'} />
                      </button>
                      <button
                        onClick={() => openChat(req.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <MessageSquare size={22} color="var(--color-teal-dark)" />
                      </button>
                      <button
                        onClick={() => toggleSave(req.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Bookmark size={22} fill={isSaved ? 'var(--color-teal-dark)' : 'none'} color="var(--color-teal-dark)" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleBookOrdinaryJob(req.id, req.title)}
                      disabled={isClashing}
                      className="btn-flat btn-flat-gold"
                      style={{ padding: '8px 16px', fontSize: '0.88rem', gap: '6px' }}
                    >
                      <Check size={16} /> Accept & Book Job
                    </button>
                  </div>

                  {/* 4. Instagram Post Content / Details */}
                  <div style={{ padding: '0 16px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--color-teal-dark)', marginBottom: '4px' }}>
                      {req.title}
                    </div>
                    <p style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 800, color: 'var(--color-teal-dark)', marginRight: '6px' }}>
                        @{req.customer_name.toLowerCase().replace(/\s+/g, '_')}
                      </span>
                      {req.description}
                    </p>
                    
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--color-muted)', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                      <span>Contact: {req.customer_phone}</span>
                      {isClashing && (
                        <span style={{ color: 'var(--color-terracotta)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={13} /> Schedule clash on {req.scheduled_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 1: EMERGENCY BIDDING AREA */}
      {activeTab === 'emergency' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="flat-card flat-card-terracotta" style={{ padding: '16px 20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={20} /> Emergency Service Bidding Broadcasts
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#fef2f2', marginTop: '2px' }}>
              Bidding open to providers within 13 km, ≥3.5★ avg rating, and a <strong>minimum of 35 coins</strong> earned from completing ordinary jobs. (Max 10 bidders).
            </p>
          </div>

          {emergencyRequests.length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
              No active emergency bidding sessions broadcasted right now.
            </div>
          ) : (
            emergencyRequests.map(req => {
              const isClashing = scheduledDates.includes(req.scheduled_date);
              const myExistingBid = req.bids?.find(b => b.provider_id === currentUser.id);
              const isDisqualified = !isCoinsEligible || !isRatingEligible || !isDistanceEligible;

              return (
                <div key={req.id} className="flat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="flat-badge badge-emergency">EMERGENCY (+30% PAID)</span>
                        <span className="flat-badge badge-coins">Target Price: ₹{req.final_price}</span>
                        <span className="flat-badge badge-ordinary">Scheduled: {req.scheduled_date}</span>
                      </div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginTop: '6px' }}>
                        {req.title}
                      </h3>
                      <p style={{ fontSize: '0.88rem', color: 'var(--color-dark)', marginTop: '2px' }}>
                        {req.description}
                      </p>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Customer Area: <strong>{req.area}</strong> | Contact: {req.customer_phone}
                      </div>
                    </div>

                    <button onClick={() => openChat(req.id)} className="btn-flat btn-flat-gold">
                      <MessageSquare size={16} /> Chat Customer
                    </button>
                  </div>

                  {/* Clash Warning */}
                  {isClashing && (
                    <div style={{
                      backgroundColor: 'var(--color-coral-light)',
                      color: 'var(--color-terracotta-dark)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertCircle size={16} />
                      Warning: You already have a service scheduled on {req.scheduled_date}! Bidding blocked to prevent schedule clashes.
                    </div>
                  )}

                  {/* Rating / Distance / Coins Disqualification */}
                  {isDisqualified && (
                    <div style={{
                      backgroundColor: 'var(--color-coral-light)',
                      color: 'var(--color-terracotta-dark)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertCircle size={16} />
                      <span>
                        Disqualified from bidding: {!isCoinsEligible
                          ? `Insufficient Coins (${currentUser.coins}/35 required). Complete ordinary jobs to earn coins!`
                          : (!isRatingEligible ? 'Rating < 3.5★' : 'Distance > 13 km')}
                      </span>
                    </div>
                  )}

                  {/* Interactive Bid Form */}
                  <div style={{
                    borderTop: '2px dashed var(--color-teal-dark)',
                    paddingTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-teal-dark)' }}>
                      Your Bid Status: {myExistingBid ? myExistingBid.status.toUpperCase() : 'NOT RESPONDED'}
                    </div>

                    <div className="responsive-bid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="flat-input"
                        placeholder={`Price (₹${req.final_price})`}
                        value={bidAmountInput[req.id] || ''}
                        onChange={e => setBidAmountInput({ ...bidAmountInput, [req.id]: e.target.value })}
                        disabled={isClashing || isDisqualified}
                      />

                      <input
                        type="text"
                        className="flat-input"
                        placeholder="Bid Note (e.g. Can arrive in 20 mins with tools)"
                        value={bidNoteInput[req.id] || ''}
                        onChange={e => setBidNoteInput({ ...bidNoteInput, [req.id]: e.target.value })}
                        disabled={isClashing || isDisqualified}
                      />

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleResponse(req.id, 'interested', req.final_price)}
                          disabled={isClashing || isDisqualified}
                          className="btn-flat btn-flat-gold"
                        >
                          <Send size={14} /> Submit Interested Bid
                        </button>

                        <button
                          onClick={() => handleResponse(req.id, 'not_interested', req.final_price)}
                          disabled={isClashing}
                          className="btn-flat btn-flat-secondary"
                        >
                          <XCircle size={14} /> Pass
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE WORK ORDERS */}
      {activeTab === 'work_orders' && (
        <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '16px' }}>
            Active Assigned Work Orders
          </h3>

          {assignedOrders.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No active work orders currently assigned to you.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {assignedOrders.map(order => (
                <div
                  key={order.id}
                  style={{
                    border: '2px solid var(--color-teal-dark)',
                    borderRadius: '12px',
                    padding: '16px',
                    backgroundColor: 'var(--color-teal-light)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`flat-badge ${order.service_type === 'emergency' ? 'badge-emergency' : 'badge-ordinary'}`}>
                        {order.service_type.toUpperCase()}
                      </span>
                      <span className="flat-badge badge-coins">Earnings: ₹{order.final_price}</span>
                      <span className="flat-badge badge-ordinary">Target Date: {order.scheduled_date}</span>
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginTop: '4px' }}>
                      {order.title}
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-dark)' }}>
                      Customer: <strong>{order.customer_name}</strong> ({order.customer_phone}) - Area: {order.area}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => openChat(order.id)} className="btn-flat btn-flat-gold">
                      <MessageSquare size={16} /> Chat Customer
                    </button>

                    <button onClick={() => handleCompleteOrder(order.id)} className="btn-flat btn-flat-red">
                      <CheckCircle size={16} /> Mark Completed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CALENDAR SCHEDULER */}
      {activeTab === 'calendar' && (
        <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <CalendarIcon size={24} color="var(--color-teal-dark)" />
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                Provider Calendar Scheduler & Clash Preventer
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                Scheduled dates are automatically blocked from receiving new bidding invitations to prevent double-booking.
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px'
          }}>
            {scheduledDates.length === 0 ? (
              <p style={{ color: 'var(--color-muted)', gridColumn: '1 / -1' }}>No upcoming work dates currently scheduled.</p>
            ) : (
              scheduledDates.map((date, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '2px solid var(--color-teal-dark)',
                    borderRadius: '10px',
                    padding: '14px',
                    backgroundColor: 'var(--bg-sand)',
                    boxShadow: 'var(--shadow-flat-sm)'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>
                    BUSY / RESERVED DATE
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginTop: '4px' }}>
                    {date}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                    Schedule clash check: Active
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: COINS & REWARDS LEDGER */}
      {activeTab === 'coins' && (
        <div className="flat-card" style={{ backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--color-gold)', padding: '10px', borderRadius: '12px', color: '#1e242b' }}>
              <Coins size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                Coins & Star Bonus Ledger
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                Minimum 25 coins per ordinary service + 5 star bonus coins awarded upon customer rating!
              </p>
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--color-gold-light)',
            padding: '16px',
            borderRadius: '12px',
            border: '2px solid var(--color-gold)',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Total Wallet Coin Balance:</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                {currentUser.coins} COINS
              </div>
            </div>
            <Award size={44} color="var(--color-gold)" />
          </div>

          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '12px' }}>
            Completed Jobs & Coin Earnings History
          </h4>

          {completedOrders.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No completed orders history yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {completedOrders.map(order => (
                <div
                  key={order.id}
                  style={{
                    border: '1.5px solid var(--color-teal-dark)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#fafafa'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--color-teal-dark)' }}>{order.title}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                      Completed on {order.scheduled_date} | Rating: {order.review ? `${order.review.stars}★` : 'Pending'}
                    </div>
                  </div>

                  <div className="flat-badge badge-coins" style={{ fontSize: '0.9rem' }}>
                    +{order.review ? order.review.coins_earned : 25} Coins
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
