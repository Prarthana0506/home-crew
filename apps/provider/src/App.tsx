import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AuthProvider,
  useAuth,
  fetchServiceRequests,
  fetchProviderOrdinaryFeed,
  acceptOrdinaryJob,
  fetchProviderBookings,
  respondEmergencyInterest,
  placeEmergencyBid,
  fetchBidsForRequest,
  subscribeToArenaUpdates,
  subscribeToNewBids,
  subscribeToUserNotifications,
  completeWorkOrder,
  fetchCoinLedger,
  fetchTechnicians,
  fetchOrganizationRating,
  orgAddTechnician,
  orgApproveTechnician,
  orgRemoveTechnician,
  orgReassignTechnician,
  orgPickTechnicianForEmergency,
  fetchSettings,
  getHistory,
  fetchInAppNotifications,
  subscribeToInAppNotifications,
  requestPushPermissionAndRegister,
  supabase,
  type ServiceRequest,
  type CoinLedgerEntry,
  type ProviderProfile,
  type HistoryEntry
} from '@urbanclap/lib';
import {
  Navbar,
  Button,
  Card,
  AuthModal,
  ProfileCompletionModal,
  FlatIllustrationStore,
  LandingHero,
  ChatModal,
  CompulsoryReviewModal,
  ScheduleCalendar,
  CompletionCard,
  HistoryCard,
  ReviewModal,
  JobStatusStepper,
  ProviderRatingBar,
  NotificationInboxModal,
  OrgDashboard,
  PrivacyPolicyPage,
  TermsPage,
  AppFooter,
  type AddTechFormData
} from '@urbanclap/ui';
import {
  Zap,
  Briefcase,
  Calendar,
  Coins,
  Users,
  Star,
  CheckCircle,
  MessageSquare,
  AlertCircle,
  Lock,
  Unlock,
  TrendingUp,
  Clock
} from 'lucide-react';

const ProviderAppContent: React.FC = () => {
  const { authUser, profile, providerProfile, _language } = useAuth() as any;

  const [emergencyRequests, setEmergencyRequests] = useState<ServiceRequest[]>([]);
  const [ordinaryFeed, setOrdinaryFeed] = useState<any[]>([]);
  const [assignedBookings, setAssignedBookings] = useState<ServiceRequest[]>([]);
  const [calendarBookings, setCalendarBookings] = useState<any[]>([]);
  const [coinLedger, setCoinLedger] = useState<CoinLedgerEntry[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [orgRating, setOrgRating] = useState<any | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({
    min_gap_hours: 8.0,
    bidding_min_coins: 35,
    bidding_min_reviews: 3,
    bidding_min_rating: 3.5
  });

  const [_loading, setLoading] = useState(false);

  // Sub nav tab
  const [activeTab, setActiveTab] = useState<'bidding' | 'ordinary' | 'calendar' | 'coins' | 'technicians' | 'history'>('ordinary');

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Active modals
  const [chatRequest, setChatRequest] = useState<ServiceRequest | null>(null);
  const [reviewRequest, setReviewRequest] = useState<ServiceRequest | null>(null);

  // History
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!authUser?.id) return;
    setHistoryLoading(true);
    try {
      const entries = await getHistory('provider');
      setHistoryEntries(entries);
    } catch (err) {
      console.warn('loadHistory error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  // Legal page overlay
  const [legalPage, setLegalPage] = useState<'privacy' | 'terms' | null>(null);

  // Notification Inbox & Push State
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  const loadUnreadNotifs = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const notifs = await fetchInAppNotifications(authUser.id);
      setUnreadNotifsCount(notifs.filter(n => !n.read).length);
    } catch {
      // ignore
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;
    loadUnreadNotifs();

    const unsub = subscribeToInAppNotifications(authUser.id, () => {
      loadUnreadNotifs();
    });

    return unsub;
  }, [authUser?.id, loadUnreadNotifs]);

  // Sensible moment: when provider views the emergency bidding arena or is active
  useEffect(() => {
    if (authUser?.id && activeTab === 'bidding') {
      requestPushPermissionAndRegister(authUser.id).catch(() => { });
    }
  }, [authUser?.id, activeTab]);

  const handleNotificationNavigate = (url: string) => {
    if (url.includes('tab=bidding')) setActiveTab('bidding');
    else if (url.includes('tab=calendar')) setActiveTab('calendar');
    else if (url.includes('tab=history')) setActiveTab('history');
    else if (url.includes('tab=ordinary')) setActiveTab('ordinary');
    else if (url.includes('tab=coins')) setActiveTab('coins');
    else if (url.includes('tab=technicians')) setActiveTab('technicians');
  };

  // Emergency bidding inputs
  const [bidCoinsInput, setBidCoinsInput] = useState<{ [reqId: string]: number }>({});
  const [bidNoteInput, setBidNoteInput] = useState<{ [reqId: string]: string }>({});

  // Live arena realtime state: top bid and countdown per request
  const [liveArena, setLiveArena] = useState<{
    [reqId: string]: {
      topBid: number;
      closesAt: string | null;
      status: string;
      secsRemaining: number | null;
    };
  }>({});

  // Live bids feed (new bids streamed via Realtime)
  const [liveBids, setLiveBids] = useState<{ [reqId: string]: Array<{ id: string; coins: number; status: string; created_at: string }> }>({});

  // In-app notification toast
  const [toast, setToast] = useState<{ text: string; type: 'info' | 'warn' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, type: 'info' | 'warn' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Technician addition form for organization owners
  const [techName, setTechName] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [_techEmail, _setTechEmail] = useState('');
  const [techCategory, setTechCategory] = useState('cat_electrical');
  const [techExperience, _setTechExperience] = useState(3);
  const [addingTech, setAddingTech] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emerg, stt] = await Promise.all([
        fetchServiceRequests({ type: 'emergency', status: 'bidding_active' }),
        fetchSettings()
      ]);
      setEmergencyRequests(emerg);
      setSettings(stt);

      if (authUser?.id) {
        // Fetch provider feed (within 13km, preference match, 8h gap fit)
        const feed = await fetchProviderOrdinaryFeed(authUser.id);
        setOrdinaryFeed(feed);
      }

      if (providerProfile?.id) {
        const [ledgerData, myBookings, providerCalBookings] = await Promise.all([
          fetchCoinLedger(providerProfile.id),
          supabase
            .from('service_requests')
            .select(`
              *,
              category:service_categories(*),
              area:areas(*),
              customer:profiles!service_requests_customer_id_fkey(*)
            `)
            .eq('assigned_provider_profile_id', providerProfile.id)
            .order('preferred_start', { ascending: true }),
          fetchProviderBookings(providerProfile.id)
        ]);

        setCoinLedger(ledgerData);
        setAssignedBookings(myBookings.data || []);
        setCalendarBookings(providerCalBookings);

        if (providerProfile.organization_id) {
          const [techs, orgRat] = await Promise.all([
            fetchTechnicians(providerProfile.organization_id),
            fetchOrganizationRating(providerProfile.organization_id),
          ]);
          setTechnicians(techs);
          setOrgRating(orgRat);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authUser?.id, providerProfile?.id]);

  // ------------------------------------------------------------------
  // Realtime subscriptions for each live emergency request
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!emergencyRequests.length) return;

    const unsubs: Array<() => void> = [];

    for (const req of emergencyRequests) {
      // Initialize arena state from current DB values
      setLiveArena(prev => ({
        ...prev,
        [req.id]: {
          topBid: req.top_bid_coins ?? 0,
          closesAt: req.bidding_closes_at ?? null,
          status: req.status,
          secsRemaining: req.bidding_closes_at
            ? Math.max(0, Math.round((new Date(req.bidding_closes_at).getTime() - Date.now()) / 1000))
            : null,
        },
      }));

      // Stream top-bid updates
      unsubs.push(
        subscribeToArenaUpdates(req.id, ({ top_bid_coins, bidding_closes_at, status }) => {
          setLiveArena(prev => ({
            ...prev,
            [req.id]: {
              ...prev[req.id],
              topBid: top_bid_coins,
              closesAt: bidding_closes_at,
              status,
              secsRemaining: bidding_closes_at
                ? Math.max(0, Math.round((new Date(bidding_closes_at).getTime() - Date.now()) / 1000))
                : null,
            },
          }));
        })
      );

      // Stream new bids
      unsubs.push(
        subscribeToNewBids(req.id, (bid) => {
          setLiveBids(prev => ({
            ...prev,
            [req.id]: [bid, ...(prev[req.id] ?? [])].slice(0, 20),
          }));
        })
      );
    }

    // Countdown ticker (every second)
    const ticker = setInterval(() => {
      setLiveArena(prev => {
        const next = { ...prev };
        for (const reqId of Object.keys(next)) {
          const arena = next[reqId];
          if (arena.closesAt && arena.secsRemaining !== null && arena.secsRemaining > 0) {
            next[reqId] = { ...arena, secsRemaining: arena.secsRemaining - 1 };
          }
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(ticker);
      unsubs.forEach(fn => fn());
    };
  }, [emergencyRequests]);

  // User notification subscription
  useEffect(() => {
    if (!authUser?.id) return;
    const unsub = subscribeToUserNotifications(authUser.id, (n) => {
      if (n.type === 'outbid') {
        showToast(`You have been outbid! New top bid: ${(n.data?.new_top_bid as number) ?? '?'} coins. Bid higher to reclaim top spot.`, 'warn');
      } else if (n.type === 'bidding_open') {
        showToast('Live bidding room is open! Place your coin bid now.', 'info');
        loadData();
      } else if (n.type === 'bid_won') {
        showToast('Congratulations! You won the bid. Job assigned to you.', 'info');
        loadData();
      } else if (n.type === 'emergency_broadcast') {
        showToast('New emergency job available within 13 km. Express interest now!', 'info');
        loadData();
      }
    });
    return unsub;
  }, [authUser?.id]);

  // Provider eligibility checks for emergency bidding room
  const currentCoins = providerProfile?.coins || 0;
  const currentRating = providerProfile?.rating_avg || 0;
  const currentReviews = providerProfile?.review_count || 0;

  const minCoinsThreshold = Number(settings.bidding_min_coins) || 35;
  const minReviewsThreshold = Number(settings.bidding_min_reviews) || 3;
  const minRatingThreshold = Number(settings.bidding_min_rating) || 3.5;

  const hasEnoughCoins = currentCoins >= minCoinsThreshold;
  const hasEnoughReviews = currentReviews >= minReviewsThreshold;
  const hasEnoughRating = currentRating >= minRatingThreshold;

  const isEligibleForBidding =
    hasEnoughCoins &&
    hasEnoughReviews &&
    hasEnoughRating &&
    providerProfile?.status === 'active';

  // Construct locked reasons list
  const lockedReasons: string[] = [];
  if (!hasEnoughCoins) {
    lockedReasons.push(`Needs at least ${minCoinsThreshold} coins (current balance: ${currentCoins}, need ${minCoinsThreshold - currentCoins} more).`);
  }
  if (!hasEnoughReviews) {
    lockedReasons.push(`Needs at least ${minReviewsThreshold} completed customer reviews (current count: ${currentReviews}, need ${minReviewsThreshold - currentReviews} more).`);
  }
  if (!hasEnoughRating) {
    lockedReasons.push(`Average rating must be at least ${minRatingThreshold} stars (current: ${currentRating.toFixed(1)}).`);
  }

  // Handle emergency interest (yes / no)
  const handleInterest = async (reqId: string, interested: boolean) => {
    if (!authUser?.id) return;
    try {
      const res = await respondEmergencyInterest(reqId, authUser.id, interested);
      if (res.bidding_auto_opened) {
        showToast('The 10th provider joined! Bidding room is now live.', 'info');
        await loadData();
      } else {
        showToast(
          interested
            ? `Interest recorded (${res.current_interested_count ?? '?'}/${res.max_interested ?? 10}). Bidding opens when the room is full or after 45 min.`
            : 'Marked as not interested.',
          'info'
        );
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to record interest' });
    }
  };

  const handlePlaceBid = async (reqId: string) => {
    if (!authUser?.id) return;
    const coinsToBid = bidCoinsInput[reqId] || 36;
    const note = bidNoteInput[reqId] || '';
    const topBid = liveArena[reqId]?.topBid ?? 0;

    if (coinsToBid <= topBid) {
      setActionMsg({ type: 'error', text: `Bid must be at least ${topBid + 1} coins (current top bid: ${topBid}).` });
      return;
    }

    try {
      const res = await placeEmergencyBid({
        requestId: reqId,
        providerUserId: authUser.id,
        coins: coinsToBid,
        note: note || undefined,
      });
      showToast(`Bid of ${res.coins} coins placed! You are the top bidder.`, 'info');
      setBidCoinsInput(prev => ({ ...prev, [reqId]: 0 }));
      setBidNoteInput(prev => ({ ...prev, [reqId]: '' }));
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to place bid' });
    }
  };

  // Countdown formatter
  const formatCountdown = (secs: number | null): string => {
    if (secs === null) return '--:--';
    if (secs <= 0) return 'CLOSED';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Atomic Accept Ordinary Job Flow
  const handleAcceptOrdinaryJob = async (req: any) => {
    if (!authUser?.id) return;
    setActionMsg(null);

    try {
      const res = await acceptOrdinaryJob(req.id, authUser.id);

      if (!res.success && res.error === 'already taken') {
        setActionMsg({
          type: 'error',
          text: 'Job has already been accepted by another provider.'
        });
        await loadData();
        return;
      }

      setActionMsg({
        type: 'success',
        text: `Work order accepted! A ${res.hold_hours || 2}-hour pending hold is placed on your calendar. Open chat with customer to confirm arrival time.`
      });

      await loadData();
      setActiveTab('calendar');
    } catch (err: any) {
      if (err.message && err.message.includes('already taken')) {
        setActionMsg({
          type: 'error',
          text: 'Job has already been accepted by another provider.'
        });
      } else {
        setActionMsg({
          type: 'error',
          text: err.message || 'Failed to accept job due to gap rule or calendar conflict.'
        });
      }
      await loadData();
    }
  };

  const _handleCompleteJob = async (req: ServiceRequest) => {
    if (!providerProfile?.id) return;
    try {
      await completeWorkOrder(req.id, providerProfile.id);
      alert('Work order marked as completed! Completion reward of 20 coins added to your ledger balance.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark job as complete');
    }
  };

  // Organization management callbacks
  const handleOrgAddTechnician = async (form: AddTechFormData) => {
    if (!providerProfile?.organization_id) return { success: false, error: 'No organization' };
    const skillsArr = form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    const res = await orgAddTechnician({
      organizationId: providerProfile.organization_id,
      name: form.name,
      phone: form.phone,
      skills: skillsArr,
      categories: [form.categories],
      experience: form.experience,
      workingHours: { start: form.workingStart + ':00', end: form.workingEnd + ':00' },
      photoUrl: form.photoUrl || undefined,
      idProofUrl: form.idProofUrl || undefined,
    });
    if (res.success) await loadData();
    return res;
  };

  const handleOrgApproveTechnician = async (profileId: string) => {
    const res = await orgApproveTechnician(profileId);
    if (res.success) await loadData();
    return res;
  };

  const handleOrgRemoveTechnician = async (profileId: string) => {
    const res = await orgRemoveTechnician(profileId);
    if (res.success) await loadData();
    return res;
  };

  const handleOrgReassign = async (bookingId: string, newProfileId: string) => {
    const res = await orgReassignTechnician({ bookingId, newProviderProfileId: newProfileId });
    if (res.success) await loadData();
    return res;
  };

  const handleOrgPickForEmergency = async (techProfileId: string, coins: number) => {
    const emergencyReq = emergencyRequests[0];
    if (!emergencyReq) return { success: false, error: 'No active emergency request' };
    const res = await orgPickTechnicianForEmergency({
      requestId: emergencyReq.id,
      technicianProfileId: techProfileId,
      coins,
    });
    if (res.success) await loadData();
    return res;
  };

  // Legal page overlay
  if (legalPage) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar
          onOpenAuth={() => setAuthModalOpen(true)}
          brandSubtitle="Partner Portal"
          onOpenNotifications={() => setInboxOpen(true)}
          unreadNotificationsCount={unreadNotifsCount}
        />
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', padding: '0 16px' }}>
          <button
            onClick={() => setLegalPage(null)}
            style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '2px solid var(--color-terracotta)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, color: 'var(--color-terracotta)', fontSize: '0.85rem' }}
          >
            ← Back
          </button>
          {legalPage === 'privacy' ? <PrivacyPolicyPage /> : <TermsPage />}
        </div>
        <AppFooter onPrivacy={() => setLegalPage('privacy')} onTerms={() => setLegalPage('terms')} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onOpenAuth={() => setAuthModalOpen(true)}
        brandSubtitle="Partner Portal"
        onOpenNotifications={() => setInboxOpen(true)}
        unreadNotificationsCount={unreadNotifsCount}
      />
      <ProfileCompletionModal />

      <main style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '24px 16px', flex: 1 }}>
        {!authUser ? (
          <>
            <LandingHero
              onPrimaryCta={() => {
                setAuthMode('signup');
                setAuthModalOpen(true);
              }}
              onSecondaryCta={() => {
                setAuthMode('signin');
                setAuthModalOpen(true);
              }}
            />
            <FlatIllustrationStore />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Provider Header Stats Banner */}
            <div
              className="flat-card"
              style={{
                backgroundColor: 'var(--color-terracotta)',
                color: '#ffffff',
                border: '2px solid var(--color-teal-dark)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#fdf7ed' }}>
                  {providerProfile?.provider_type === 'organization_owner' ? 'Organization Account' : 'Freelance Partner'}
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px' }}>
                  {profile?.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', marginTop: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={14} fill="#ffffff" /> {currentRating.toFixed(1)} Rating ({currentReviews} reviews)
                  </span>
                  <span>|</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Locality: {profile?.area?.name || 'Coimbatore'}
                  </span>
                </div>
              </div>

              <div style={{
                backgroundColor: '#ffffff',
                color: 'var(--color-dark)',
                border: '2px solid var(--color-teal-dark)',
                borderRadius: '8px',
                padding: '10px 16px',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-gold-light)',
                  border: '2px solid var(--color-teal-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#92400e'
                }}>
                  <Coins size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    Available Coins
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                    {currentCoins} Coins
                  </div>
                </div>
              </div>
            </div>

            {/* Action Feedback Banner */}
            {actionMsg && (
              <div
                style={{
                  backgroundColor: actionMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                  border: `2px solid ${actionMsg.type === 'error' ? '#ef4444' : '#16a34a'}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: actionMsg.type === 'error' ? '#991b1b' : '#166534',
                  fontWeight: 700
                }}
              >
                {actionMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                <span>{actionMsg.text}</span>
              </div>
            )}

            {/* Progress Card for Bid Arena Requirement */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={20} color="var(--color-terracotta)" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                    Live Emergency Bid Arena Progress
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className={`flat-badge ${isEligibleForBidding ? 'badge-verified' : 'badge-emergency'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {isEligibleForBidding ? <Unlock size={12} /> : <Lock size={12} />}
                    {isEligibleForBidding ? 'ARENA UNLOCKED' : 'ARENA LOCKED'}
                  </span>
                </div>
              </div>

              {/* Progress Gauges Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {/* 1. Coins Gauge */}
                <div
                  style={{
                    border: '1.5px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)' }}>Coins Balance</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: hasEnoughCoins ? 'var(--color-teal-dark)' : 'var(--color-terracotta)' }}>
                      {currentCoins} / {minCoinsThreshold}
                    </span>
                  </div>
                  {/* Flat progress bar */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (currentCoins / minCoinsThreshold) * 100)}%`,
                        height: '100%',
                        backgroundColor: hasEnoughCoins ? 'var(--color-teal-dark)' : 'var(--color-terracotta)'
                      }}
                    />
                  </div>
                </div>

                {/* 2. Reviews Gauge */}
                <div
                  style={{
                    border: '1.5px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)' }}>Reviews Completed</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: hasEnoughReviews ? 'var(--color-teal-dark)' : 'var(--color-terracotta)' }}>
                      {currentReviews} / {minReviewsThreshold}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (currentReviews / minReviewsThreshold) * 100)}%`,
                        height: '100%',
                        backgroundColor: hasEnoughReviews ? 'var(--color-teal-dark)' : 'var(--color-terracotta)'
                      }}
                    />
                  </div>
                </div>

                {/* 3. Rating Breakdown & Gauge */}
                <ProviderRatingBar
                  ratingAvg={currentRating}
                  reviewCount={currentReviews}
                />
              </div>

              {/* Exact Reason Locked Readout */}
              {!isEligibleForBidding && lockedReasons.length > 0 && (
                <div
                  style={{
                    marginTop: '12px',
                    backgroundColor: '#fffbeb',
                    border: '1.5px solid #b45309',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '0.8rem',
                    color: '#92400e'
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: '4px' }}>
                    Reasons Live Arena is Locked:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {lockedReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: '6px', fontSize: '0.74rem', color: '#78350f' }}>
                    Accept open standard jobs in your feed to earn base coins (20 coins per completion) and reviews.
                  </div>
                </div>
              )}
            </Card>

            {/* Navigation Tabs */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              backgroundColor: '#ffffff',
              padding: '8px',
              borderRadius: '12px',
              border: '2px solid var(--color-teal-dark)',
              boxShadow: 'var(--shadow-flat)'
            }}>
              {[
                { id: 'ordinary', icon: <Briefcase size={15} />, label: `Open Jobs (${ordinaryFeed.length})` },
                { id: 'calendar', icon: <Calendar size={15} />, label: `My Schedule (${calendarBookings.length})` },
                { id: 'bidding', icon: <Zap size={15} />, label: `Emergency Arena (${emergencyRequests.length})` },
                { id: 'coins', icon: <Coins size={15} />, label: `Earnings & Ledger` },
                { id: 'history', icon: <Clock size={15} />, label: `History (${historyEntries.length})` },
                ...(providerProfile?.provider_type === 'organization_owner'
                  ? [{ id: 'technicians', icon: <Users size={15} />, label: `Technicians (${technicians.length})` }]
                  : [])
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`btn-flat btn-flat-sm ${activeTab === tab.id ? 'btn-flat-red' : 'btn-flat-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab 1: Open Ordinary Job Feed (13km radius, preference match, 8h gap fit) */}
            {activeTab === 'ordinary' && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                      Open Standard Home Services (Within 13 km)
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                      Filtered for your locality ({profile?.area?.name || 'Coimbatore'}), provider preference, and 8-hour gap schedule availability.
                    </p>
                  </div>

                  <span className="flat-badge badge-verified">
                    {ordinaryFeed.length} Jobs Available
                  </span>
                </div>

                {ordinaryFeed.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--color-muted)' }}>
                    No matching open standard jobs found within 13 km that fit your calendar gap rules. Check back soon.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {ordinaryFeed.map(job => (
                      <div
                        key={job.id}
                        style={{
                          border: '2px solid var(--color-teal-dark)',
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '14px',
                          backgroundColor: '#ffffff',
                          boxShadow: 'var(--shadow-flat)'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '260px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="flat-badge badge-ordinary">{job.category_name}</span>
                            <span className="flat-badge badge-coins">Rs {job.offered_price}</span>
                            {job.distance_km !== undefined && (
                              <span className="flat-badge badge-warning">
                                {job.distance_km} km away
                              </span>
                            )}
                            <span className="flat-badge">
                              Pref: {job.provider_preference}
                            </span>
                          </div>

                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '6px' }}>
                            {job.title}
                          </h3>

                          <p style={{ fontSize: '0.84rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                            {job.description}
                          </p>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: 'var(--color-teal-dark)', marginTop: '8px', flexWrap: 'wrap' }}>
                            <span>
                              <strong>Locality:</strong> {job.area_name} ({job.pincode})
                            </span>
                            <span>
                              <strong>Scheduled:</strong> {new Date(job.preferred_start).toLocaleString()}
                            </span>
                            <span>
                              <strong>Customer:</strong> {job.customer_name}
                            </span>
                          </div>

                          {job.images && job.images.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                              {job.images.map((img: string, idx: number) => (
                                <img
                                  key={idx}
                                  src={img}
                                  alt="Attachment"
                                  style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-teal-dark)' }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                          <Button
                            variant="primary"
                            onClick={() => handleAcceptOrdinaryJob(job)}
                          >
                            Accept Work Order
                          </Button>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                            Atomic lock with 2-hour hold
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Tab 2: Calendar & Schedule (Week view, Day view, Gap Rule Slot Calculation) */}
            {activeTab === 'calendar' && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                      Provider Calendar & Schedule
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                      Enforcing 8-hour mandatory gaps between consecutive assignments and 8 AM to 7 PM operating hours.
                    </p>
                  </div>
                </div>

                <ScheduleCalendar
                  bookings={calendarBookings}
                  role="provider"
                  minGapHours={Number(settings.min_gap_hours) || 8.0}
                  onSelectBooking={b => {
                    if (b.request) {
                      setChatRequest(b.request as any);
                    }
                  }}
                />

                {/* Active Assignments and Completion Pipeline */}
                {assignedBookings.length > 0 && (
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-dark)', margin: 0 }}>
                        Active Assignments ({assignedBookings.length})
                      </h3>
                      <span className="flat-badge badge-neutral">Completion Pipeline</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {assignedBookings.map(req => {
                        const booking = (req.bookings && req.bookings.length > 0)
                          ? req.bookings[0]
                          : calendarBookings.find(b => b.request?.id === req.id || b.request_id === req.id);
                        const bookingId = booking?.id || req.id;
                        const jobStart = booking?.time_range ? booking.time_range.split(',')[0].replace(/[\[\(]/, '') : req.preferred_start;
                        const jobEnd = booking?.time_range ? booking.time_range.split(',')[1].replace(/[\]\)]/, '') : new Date(new Date(req.preferred_start).getTime() + (req.estimated_duration_hours || 2) * 3600000).toISOString();

                        return (
                          <div
                            key={req.id}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '2px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                <span className={`flat-badge ${req.type === 'emergency' ? 'badge-emergency' : 'badge-neutral'}`} style={{ marginBottom: '4px' }}>
                                  {req.type === 'emergency' ? 'EMERGENCY' : 'ORDINARY'}
                                </span>
                                <h4 style={{ margin: '4px 0 0', fontSize: '1rem', fontWeight: 800 }}>{req.title}</h4>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                                  Customer: {req.customer?.name || 'Customer'} | Locality: {req.area?.name || 'Area'}
                                </p>
                              </div>
                              <Button size="sm" variant="secondary" onClick={() => setChatRequest(req)}>
                                <MessageSquare size={14} /> Open Chat
                              </Button>
                            </div>

                            {/* Job Status Stepper */}
                            <JobStatusStepper currentStatus={req.status} type={req.type} />

                            {/* Completion Action Card */}
                            <CompletionCard
                              bookingId={bookingId}
                              role="provider"
                              jobTitle={req.title}
                              jobStart={jobStart}
                              jobEnd={jobEnd}
                              onReviewOpen={() => loadData()}
                              onNoshowClaimed={() => loadData()}
                              onReopened={() => loadData()}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Tab 3: Emergency Bidding Arena - Live with Realtime */}
            {activeTab === 'bidding' && (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={22} color="var(--color-terracotta)" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>
                      Live Emergency Bidding Arena
                    </h2>
                  </div>
                  <span className={`flat-badge ${isEligibleForBidding ? 'badge-verified' : 'badge-emergency'}`}>
                    {isEligibleForBidding ? 'ELIGIBLE TO BID' : 'INELIGIBLE'}
                  </span>
                </div>

                {/* In-app notification toast */}
                {toast && (
                  <div style={{
                    backgroundColor: toast.type === 'warn' ? '#fffbeb' : '#dcfce7',
                    border: `2px solid ${toast.type === 'warn' ? '#b45309' : '#16a34a'}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '14px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: toast.type === 'warn' ? '#92400e' : '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {toast.type === 'warn' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                    {toast.text}
                  </div>
                )}

                {emergencyRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--color-muted)' }}>
                    No active emergency broadcasts right now within 13 km. Eligibility is rechecked each broadcast.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {emergencyRequests.map(req => {
                      const arena = liveArena[req.id];
                      const biddingIsOpen = arena?.status === 'bidding_open';
                      const biddingIsClosed = arena?.status === 'closed' || arena?.status === 'awarded';
                      const topBid = arena?.topBid ?? req.top_bid_coins ?? 0;
                      const secs = arena?.secsRemaining ?? null;
                      const recentBids = liveBids[req.id] ?? [];

                      return (
                        <div
                          key={req.id}
                          style={{
                            border: `2px solid ${biddingIsOpen ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                            borderRadius: '10px',
                            padding: '16px',
                            backgroundColor: biddingIsOpen ? 'var(--color-coral-light)' : '#f0faf9'
                          }}
                        >
                          {/* Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className="flat-badge badge-emergency">EMERGENCY</span>
                                <span className="flat-badge badge-coins">Rs {req.offered_price}</span>
                                <span className={`flat-badge ${biddingIsOpen ? 'badge-emergency' : biddingIsClosed ? '' : 'badge-warning'}`}>
                                  {arena?.status?.replace(/_/g, ' ').toUpperCase() ?? req.status.toUpperCase()}
                                </span>
                              </div>
                              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '6px' }}>{req.title}</h3>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-teal-dark)', fontWeight: 700, marginTop: '4px' }}>
                                Locality: {req.area?.name} | Start: {new Date(req.preferred_start).toLocaleString()}
                              </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => setChatRequest(req)}>
                              <MessageSquare size={14} /> Chat
                            </Button>
                          </div>

                          {/* Live Arena Stats Row */}
                          <div style={{
                            marginTop: '14px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '10px'
                          }}>
                            {/* Live Top Bid */}
                            <div style={{ border: '2px solid var(--color-terracotta)', borderRadius: '8px', padding: '10px', backgroundColor: '#ffffff', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                                <TrendingUp size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Top Bid
                              </div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-terracotta)', fontVariantNumeric: 'tabular-nums' }}>
                                {topBid > 0 ? `${topBid}` : '--'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>coins</div>
                            </div>

                            {/* Countdown */}
                            <div style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '8px', padding: '10px', backgroundColor: '#ffffff', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                                <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Closes In
                              </div>
                              <div style={{
                                fontSize: '1.4rem',
                                fontWeight: 900,
                                color: secs !== null && secs < 60 ? 'var(--color-terracotta)' : 'var(--color-teal-dark)',
                                fontVariantNumeric: 'tabular-nums'
                              }}>
                                {biddingIsOpen ? formatCountdown(secs) : arena?.status === 'interest_window' ? 'Gathering Interest' : 'N/A'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{biddingIsOpen ? 'mm:ss' : 'waiting'}</div>
                            </div>

                            {/* Min next bid */}
                            {biddingIsOpen && (
                              <div style={{ border: '1.5px solid var(--color-border)', borderRadius: '8px', padding: '10px', backgroundColor: '#ffffff', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Min Bid</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-dark)' }}>
                                  {topBid + 1}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>coins</div>
                              </div>
                            )}
                          </div>

                          {/* Recent live bids feed */}
                          {recentBids.length > 0 && (
                            <div style={{ marginTop: '12px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '8px 12px' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Live Bid Feed
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {recentBids.slice(0, 5).map(bid => (
                                  <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--color-muted)' }}>{new Date(bid.created_at).toLocaleTimeString()}</span>
                                    <span style={{ fontWeight: 800, color: bid.status === 'active' ? 'var(--color-terracotta)' : 'var(--color-muted)' }}>
                                      {bid.coins} coins {bid.status === 'active' ? '(top)' : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Interest + Bid controls */}
                          <div style={{ marginTop: '14px', borderTop: '1px dashed var(--color-terracotta)', paddingTop: '12px' }}>
                            {!biddingIsOpen && !biddingIsClosed && (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                <Button size="sm" variant="primary" onClick={() => handleInterest(req.id, true)}>
                                  I am Interested
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => handleInterest(req.id, false)}>
                                  Not Interested
                                </Button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', alignSelf: 'center' }}>
                                  First 10 interested opens bidding. Timer: 45 min.
                                </span>
                              </div>
                            )}

                            {biddingIsOpen && isEligibleForBidding && !biddingIsClosed && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                  type="number"
                                  className="flat-input"
                                  style={{ width: '100px' }}
                                  placeholder={`Min ${topBid + 1}`}
                                  min={topBid + 1}
                                  value={bidCoinsInput[req.id] || ''}
                                  onChange={e => setBidCoinsInput(prev => ({ ...prev, [req.id]: parseInt(e.target.value) || 0 }))}
                                />
                                <input
                                  type="text"
                                  className="flat-input"
                                  style={{ flex: 1, minWidth: '120px' }}
                                  placeholder="Optional note to customer"
                                  value={bidNoteInput[req.id] || ''}
                                  onChange={e => setBidNoteInput(prev => ({ ...prev, [req.id]: e.target.value }))}
                                />
                                <Button size="sm" variant="red" onClick={() => handlePlaceBid(req.id)}>
                                  Place Bid
                                </Button>
                              </div>
                            )}

                            {biddingIsOpen && !isEligibleForBidding && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-terracotta)', fontWeight: 700 }}>
                                Arena is live but you are not yet eligible to bid. Complete standard jobs to earn coins and reviews.
                              </div>
                            )}

                            {biddingIsClosed && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                                Bidding has ended for this request.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* Tab 4: Earnings & Coin Ledger */}
            {activeTab === 'coins' && (
              <Card>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '16px' }}>
                  Platform Coin Ledger (Append-Only)
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '8px', padding: '14px', backgroundColor: '#ffffff' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)' }}>Computed Ledger Balance</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-teal-dark)', marginTop: '4px' }}>
                      {currentCoins} Coins
                    </div>
                  </div>
                  <div style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '8px', padding: '14px', backgroundColor: '#ffffff' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)' }}>Completion Base Reward</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-teal-dark)', marginTop: '4px' }}>
                      20 Coins / Job
                    </div>
                  </div>
                </div>

                {coinLedger.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-muted)' }}>
                    No ledger transactions recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {coinLedger.map(entry => (
                      <div
                        key={entry.id}
                        style={{
                          border: '1.5px solid var(--color-border)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{entry.reason}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                            {new Date(entry.created_at).toLocaleString()}
                          </div>
                        </div>
                        <span
                          style={{
                            fontWeight: 900,
                            color: entry.amount >= 0 ? '#16a34a' : '#dc2626',
                            fontSize: '0.95rem'
                          }}
                        >
                          {entry.amount >= 0 ? `+${entry.amount}` : entry.amount} Coins
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Tab 5: Technician Dashboard (Organization Owners Only) */}
            {activeTab === 'technicians' && providerProfile?.provider_type === 'organization_owner' && (
              <OrgDashboard
                technicians={technicians}
                orgRating={orgRating}
                organizationId={providerProfile.organization_id || ''}
                organizationName={providerProfile.organization?.name}
                loading={_loading}
                onAddTechnician={handleOrgAddTechnician}
                onApproveTechnician={handleOrgApproveTechnician}
                onRemoveTechnician={handleOrgRemoveTechnician}
                onReassign={handleOrgReassign}
                onRefresh={loadData}
                emergencyRequestId={
                  activeTab === 'technicians' && emergencyRequests.length > 0
                    ? emergencyRequests[0].id
                    : undefined
                }
                onPickForEmergency={handleOrgPickForEmergency}
              />
            )}

            {/* Tab 6: History & Completed Reviews */}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-primary)' }}>
                      Completed Service History & Reviews
                    </h2>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                      Track completed assignments, customer ratings, blind review submissions, and coin rewards.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="flat-badge badge-muted">{historyEntries.length} assignments</span>
                    <Button id="refresh-prov-history-btn" size="sm" variant="secondary" onClick={loadHistory} disabled={historyLoading}>
                      {historyLoading ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>
                </div>

                {historyLoading && historyEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-muted)', fontWeight: 600 }}>
                    Loading history...
                  </div>
                ) : historyEntries.length === 0 ? (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>&#128196;</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-muted)' }}>No completed assignments yet.</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '4px' }}>
                        When jobs are marked complete and reviewed, they will appear here.
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {historyEntries.map(entry => (
                      <HistoryCard
                        key={entry.booking_id}
                        entry={entry}
                        role="provider"
                        onReview={(bId) => setReviewBookingId(bId)}
                      />
                    ))}
                  </div>
                )}

                {/* Inline ReviewModal triggered from HistoryCard */}
                {reviewBookingId && (
                  <ReviewModal
                    bookingId={reviewBookingId}
                    role="provider"
                    jobTitle={historyEntries.find(e => e.booking_id === reviewBookingId)?.title ?? 'Service Order'}
                    onClose={() => setReviewBookingId(null)}
                    onSuccess={(_res) => {
                      setReviewBookingId(null);
                      alert('Review submitted! Thank you for reviewing your customer.');
                      loadHistory();
                      loadData();
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />

      {/* Chat Modal with Propose Time Card Support */}
      {chatRequest && (
        <ChatModal
          request={chatRequest}
          onClose={() => setChatRequest(null)}
          onBookingConfirmed={loadData}
        />
      )}

      {/* Compulsory Review Modal */}
      {reviewRequest && (
        <CompulsoryReviewModal
          request={reviewRequest}
          onClose={() => setReviewRequest(null)}
          onSuccess={() => {
            alert('Review submitted successfully!');
            loadData();
          }}
        />
      )}

      {/* Notification Inbox Modal */}
      {inboxOpen && (
        <NotificationInboxModal
          isOpen={inboxOpen}
          onClose={() => {
            setInboxOpen(false);
            loadUnreadNotifs();
          }}
          userId={authUser?.id || ''}
          onNavigate={handleNotificationNavigate}
        />
      )}
      <AppFooter onPrivacy={() => setLegalPage('privacy')} onTerms={() => setLegalPage('terms')} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider appRole="provider">
      <ProviderAppContent />
    </AuthProvider>
  );
}