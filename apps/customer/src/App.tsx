import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AuthProvider,
  useAuth,
  t,
  fetchCategories,
  fetchAreas,
  fetchServiceRequests,
  fetchSettings,
  fetchPendingReview,
  createRequestAtomic,
  compressAndStripExif,
  uploadServiceImage,
  acceptBid,
  subscribeToArenaUpdates,
  subscribeToNewBids,
  subscribeToUserNotifications,
  getHistory,
  type ServiceCategory,
  type Area,
  type ServiceRequest,
  type ServiceType,
  type ProviderPreference,
  type PendingReviewInfo,
  type HistoryEntry,
  fetchInAppNotifications,
  subscribeToInAppNotifications,
  requestPushPermissionAndRegister,
  getPushPermissionState
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
  EmergencyFeeModal,
  ScheduleCalendar,
  CompletionCard,
  HistoryCard,
  ReviewModal,
  JobStatusStepper,
  CategoryGrid,
  NotificationInboxModal,
  PrivacyPolicyPage,
  TermsPage,
  AppFooter
} from '@urbanclap/ui';
import {
  PlusCircle,
  Zap,
  Calendar,
  Clock,
  MessageSquare,
  CheckCircle,
  Star,
  AlertCircle,
  Upload,
  X,
  Building2,
  User,
  Users,
  FileText
} from 'lucide-react';

const CustomerAppContent: React.FC = () => {
  const { authUser, profile, language } = useAuth();

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({
    emergency_multiplier: 1.3,
    emergency_fee: 50.0,
    emergency_min_lead_hours: 2.0
  });
  const [pendingReview, setPendingReview] = useState<PendingReviewInfo | null>(null);

  const [_loading, setLoading] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Sub navigation tab
  const [activeTab, setActiveTab] = useState<'create' | 'bidding' | 'calendar' | 'history'>('create');

  // Category browse tabs (Ordinary vs Emergency)
  const [catalogTab, setCatalogTab] = useState<'ordinary' | 'emergency'>('ordinary');

  // Request Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('ordinary');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [providerPreference, setProviderPreference] = useState<ProviderPreference>('either');
  const [addressConfidential, setAddressConfidential] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('10:00');
  const [offeredPrice, setOfferedPrice] = useState<number>(500);

  // Image Uploads (0 to 4)
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission State & Modals
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [emergencyFeeModalOpen, setEmergencyFeeModalOpen] = useState(false);
  const [pendingEmergencyPayload, setPendingEmergencyPayload] = useState<any>(null);

  // Chat & Review Modals
  const [chatRequest, setChatRequest] = useState<ServiceRequest | null>(null);
  const [reviewRequest, setReviewRequest] = useState<ServiceRequest | PendingReviewInfo | null>(null);

  // History
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!authUser?.id) return;
    setHistoryLoading(true);
    try {
      const entries = await getHistory('customer');
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

  // Live bidding arena realtime state (per request id)
  const [liveArena, setLiveArena] = useState<{
    [reqId: string]: {
      topBid: number;
      closesAt: string | null;
      status: string;
      secsRemaining: number | null;
    };
  }>({});
  const [liveBids, setLiveBids] = useState<{ [reqId: string]: Array<{ id: string; coins: number; status: string; created_at: string }> }>({});

  // Arena toast notifications
  const [arenaToast, setArenaToast] = useState<string | null>(null);
  const showArenaToast = useCallback((msg: string) => {
    setArenaToast(msg);
    setTimeout(() => setArenaToast(null), 6000);
  }, []);

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

  const handleNotificationNavigate = (url: string) => {
    if (url.includes('tab=bidding')) setActiveTab('bidding');
    else if (url.includes('tab=calendar')) setActiveTab('calendar');
    else if (url.includes('tab=history')) setActiveTab('history');
    else if (url.includes('tab=post') || url.includes('tab=create')) setActiveTab('create');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, ars, stt] = await Promise.all([
        fetchCategories(),
        fetchAreas(),
        fetchSettings()
      ]);
      setCategories(cats);
      setAreas(ars);
      setSettings(stt);

      if (cats.length > 0 && !selectedCategory) {
        setSelectedCategory(cats[0].id);
        const mult = stt.emergency_multiplier || 1.3;
        setOfferedPrice(serviceType === 'emergency' ? Math.round(cats[0].base_price * mult) : cats[0].base_price);
      }
      if (ars.length > 0 && !selectedAreaId) {
        setSelectedAreaId(profile?.area_id || ars[0].id);
      }

      if (authUser?.id) {
        const [reqs, pending] = await Promise.all([
          fetchServiceRequests({ customerId: authUser.id }),
          fetchPendingReview(authUser.id)
        ]);
        setRequests(reqs);
        setPendingReview(pending);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authUser?.id, profile?.area_id]);

  // Realtime: subscribe to live bidding updates for each of the customer's active emergency requests
  useEffect(() => {
    const activeBidding = requests.filter(r =>
      ['interest_window', 'bidding_open', 'notified', 'widen_radius', 'extended'].includes(r.status)
    );
    if (!activeBidding.length) return;

    const unsubs: Array<() => void> = [];

    for (const req of activeBidding) {
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

      unsubs.push(
        subscribeToNewBids(req.id, (bid) => {
          setLiveBids(prev => ({
            ...prev,
            [req.id]: [bid, ...(prev[req.id] ?? [])].slice(0, 20),
          }));
        })
      );
    }

    // Tick countdown every second
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
  }, [requests]);

  // Notification subscription: bidding events for this customer
  useEffect(() => {
    if (!authUser?.id) return;
    const unsub = subscribeToUserNotifications(authUser.id, (n) => {
      if (n.type === 'customer_bidding_active') {
        showArenaToast('Providers are entering the bidding arena. Watch incoming bids live!');
        loadData();
      } else if (n.type === 'customer_technician_assigned') {
        showArenaToast('A technician has been assigned to your emergency request!');
        loadData();
      } else if (n.type === 'offered_conversion') {
        showArenaToast('No providers found nearby. You can convert this to a standard scheduled booking.');
        loadData();
      }
    });
    return unsub;
  }, [authUser?.id]);

  // Date offsets
  const getOffsetDateStr = (offsetDays: number) => {
    const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };

  const minOrdinaryDate = getOffsetDateStr(2);
  const maxOrdinaryDate = getOffsetDateStr(3);
  const todayDate = getOffsetDateStr(0);

  const emergencyMultiplier = Number(settings.emergency_multiplier) || 1.3;
  const emergencyFee = Number(settings.emergency_fee ?? 50.0);
  const emergencyMinLeadHours = Number(settings.emergency_min_lead_hours) || 2.0;

  const categoryObj = categories.find(c => c.id === selectedCategory) || categories[0];
  const basePrice = categoryObj?.base_price || 500;
  const minAllowedPrice = serviceType === 'emergency'
    ? Math.round(basePrice * emergencyMultiplier)
    : basePrice;

  // Handle category selection
  const handleSelectCategory = (cat: ServiceCategory, type: ServiceType) => {
    setSelectedCategory(cat.id);
    setServiceType(type);
    setCatalogTab(type);
    const minP = type === 'emergency' ? Math.round(cat.base_price * emergencyMultiplier) : cat.base_price;
    setOfferedPrice(minP);
    if (type === 'ordinary' && (!customDate || customDate < minOrdinaryDate)) {
      setCustomDate(minOrdinaryDate);
    } else if (type === 'emergency' && !customDate) {
      setCustomDate(todayDate);
    }
    // Scroll to form if needed
    const formEl = document.getElementById('post-request-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Image Upload handler (0 to 4, browser compression + EXIF strip via canvas)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 4 - images.length;
    if (remainingSlots <= 0) {
      setFormMsg({ type: 'error', text: 'Maximum 4 images allowed per request.' });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingImage(true);
    setFormMsg(null);

    try {
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) {
        // Strip EXIF and compress
        const { blob } = await compressAndStripExif(file, 1200, 1200, 0.82);
        // Upload to Supabase Storage bucket service-images
        const publicUrl = await uploadServiceImage(blob);
        uploadedUrls.push(publicUrl);
      }
      setImages(prev => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message || 'Image upload failed' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Pre-validate and submit request
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (!authUser?.id) {
      setAuthMode('signin');
      setAuthModalOpen(true);
      return;
    }

    // 1. Review Gate UI Check
    if (pendingReview) {
      setFormMsg({
        type: 'error',
        text: `Review required: You must submit a review for completed job "${pendingReview.title}" before posting a new request.`
      });
      setReviewRequest(pendingReview);
      return;
    }

    if (!title.trim() || !description.trim()) {
      setFormMsg({ type: 'error', text: 'Please provide a title and detailed issue description.' });
      return;
    }

    // Image Count check (0 to 4)
    if (images.length > 4) {
      setFormMsg({ type: 'error', text: 'Maximum 4 images allowed.' });
      return;
    }

    // Price input cannot go below minimum
    const finalPrice = Math.max(offeredPrice, minAllowedPrice);

    // Schedule validation
    const scheduledDate = customDate || (serviceType === 'ordinary' ? minOrdinaryDate : todayDate);
    const scheduledTime = customTime || '10:00';
    const preferredStart = new Date(`${scheduledDate}T${scheduledTime}:00Z`).toISOString();

    if (serviceType === 'ordinary') {
      if (scheduledDate < minOrdinaryDate || scheduledDate > maxOrdinaryDate) {
        setFormMsg({
          type: 'error',
          text: `Ordinary home services must be booked 2 to 3 days in advance (${minOrdinaryDate} to ${maxOrdinaryDate}).`
        });
        return;
      }
      if (scheduledTime < '08:00' || scheduledTime > '19:00') {
        setFormMsg({
          type: 'error',
          text: 'Ordinary home services can only be scheduled between 8:00 AM and 7:00 PM.'
        });
        return;
      }
    } else {
      // Emergency lead time check
      const startTimeMs = new Date(`${scheduledDate}T${scheduledTime}:00Z`).getTime();
      const minStartMs = Date.now() + emergencyMinLeadHours * 60 * 60 * 1000;
      if (startTimeMs < minStartMs) {
        setFormMsg({
          type: 'error',
          text: `Emergency service requires at least ${emergencyMinLeadHours} hours advance lead time.`
        });
        return;
      }
    }

    const payload = {
      customerId: authUser.id,
      type: serviceType,
      categoryId: selectedCategory || categoryObj.id,
      areaId: selectedAreaId || areas[0]?.id,
      title: title.trim(),
      description: description.trim(),
      offeredPrice: finalPrice,
      preferredStart,
      images,
      providerPreference,
      addressConfidential: addressConfidential.trim() || undefined
    };

    if (serviceType === 'emergency') {
      // Emergency: Show "Pay emergency fee" modal
      setPendingEmergencyPayload(payload);
      setEmergencyFeeModalOpen(true);
      return;
    }

    // Ordinary request: Direct atomic creation
    setSubmitting(true);
    try {
      await createRequestAtomic({
        ...payload,
        feePaymentId: null
      });

      setFormMsg({
        type: 'success',
        text: `Ordinary service request confirmed at Rs ${finalPrice}! Scheduled for ${scheduledDate} at ${scheduledTime}.`
      });

      // Reset form
      setTitle('');
      setDescription('');
      setAddressConfidential('');
      setImages([]);
      // Sensible moment: request push alerts on job confirmation
      if (authUser?.id && getPushPermissionState() === 'default') {
        requestPushPermissionAndRegister(authUser.id);
      }

      await loadData();
      setActiveTab('calendar');
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message || 'Failed to submit service request.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Called after Emergency Fee payment succeeds (paid or waived)
  const handleEmergencyFeeSuccess = async (feePaymentId: string) => {
    setEmergencyFeeModalOpen(false);
    if (!pendingEmergencyPayload) return;

    setSubmitting(true);
    try {
      await createRequestAtomic({
        ...pendingEmergencyPayload,
        feePaymentId
      });

      setFormMsg({
        type: 'success',
        text: `Emergency service listing posted at Rs ${pendingEmergencyPayload.offeredPrice}! 45-minute live bidding arena broadcasted to verified local providers.`
      });

      setTitle('');
      setDescription('');
      setAddressConfidential('');
      setImages([]);
      setPendingEmergencyPayload(null);

      // Sensible moment: request push alerts on emergency broadcast
      if (authUser?.id && getPushPermissionState() === 'default') {
        requestPushPermissionAndRegister(authUser.id);
      }

      await loadData();
      setActiveTab('bidding');
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message || 'Failed to create emergency request.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptBid = async (req: ServiceRequest, bid: any) => {
    try {
      const startTime = req.preferred_start;
      const endTime = new Date(new Date(req.preferred_start).getTime() + 2 * 60 * 60 * 1000).toISOString();
      await acceptBid(req.id, bid.provider_profile_id, startTime, endTime);
      alert('Bid accepted! The technician has been assigned and scheduled. Open chat to coordinate arrival.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to accept bid');
    }
  };

  const activeBiddingList = requests.filter(r => r.type === 'emergency' && r.status === 'bidding_active');
  const upcomingBookings = requests.filter(r => r.status === 'assigned' || r.status === 'in_progress');
  const pastHistory = requests.filter(r => r.status === 'completed' || r.status === 'cancelled');

  // Legal page overlay – renders instead of main content
  if (legalPage) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar
          onOpenAuth={() => setAuthModalOpen(true)}
          brandSubtitle="Customer Portal"
          onOpenNotifications={() => setInboxOpen(true)}
          unreadNotificationsCount={unreadNotifsCount}
        />
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', padding: '0 16px' }}>
          <button
            onClick={() => setLegalPage(null)}
            style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '2px solid var(--color-teal-dark)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, color: 'var(--color-teal-dark)', fontSize: '0.85rem' }}
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
        brandSubtitle="Customer Portal"
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
            <FlatIllustrationStore />

            {/* Sub Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                backgroundColor: '#ffffff',
                padding: '8px',
                borderRadius: '12px',
                border: '2px solid var(--color-teal-dark)',
                boxShadow: 'var(--shadow-flat)'
              }}
            >
              {[
                { id: 'create', icon: <PlusCircle size={15} />, label: 'Post Service' },
                { id: 'bidding', icon: <Zap size={15} />, label: `Live Bidding (${activeBiddingList.length})` },
                { id: 'calendar', icon: <Calendar size={15} />, label: `Bookings (${upcomingBookings.length})` },
                { id: 'history', icon: <Clock size={15} />, label: `History (${pastHistory.length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`btn-flat btn-flat-sm ${activeTab === tab.id ? '' : 'btn-flat-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab 1: Post Service */}
            {activeTab === 'create' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Review Gate Alert Banner */}
                {pendingReview && (
                  <div
                    style={{
                      backgroundColor: '#fffbeb',
                      border: '2px solid #b45309',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      boxShadow: '2px 2px 0px #b45309'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <AlertCircle size={22} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#92400e' }}>
                          Review Gate Active: Pending Review Required Before Posting
                        </div>
                        <div style={{ fontSize: '0.84rem', color: '#78350f', marginTop: '2px' }}>
                          You completed <strong>"{pendingReview.title}"</strong> ({pendingReview.category_name}) with {pendingReview.provider_name}. To protect community trust, please submit your blind review.
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="gold"
                      onClick={() => setReviewRequest(pendingReview)}
                    >
                      <Star size={14} /> Submit Pending Review Now
                    </Button>
                  </div>
                )}

                {/* 2. Home Category Grid with Ordinary & Emergency Tabs */}
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                        Select Service Category
                      </h2>
                      <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                        Choose standard scheduled service or live urgent dispatch. Prices reflect platform minimums.
                      </p>
                    </div>

                    {/* Mode Tabs */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogTab('ordinary');
                          setServiceType('ordinary');
                          setOfferedPrice(categoryObj ? categoryObj.base_price : 500);
                        }}
                        className={`btn-flat btn-flat-sm ${catalogTab === 'ordinary' ? '' : 'btn-flat-secondary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Clock size={14} />
                        <span>Ordinary Services</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCatalogTab('emergency');
                          setServiceType('emergency');
                          setOfferedPrice(categoryObj ? Math.round(categoryObj.base_price * emergencyMultiplier) : 650);
                        }}
                        className={`btn-flat btn-flat-sm ${catalogTab === 'emergency' ? 'btn-flat-red' : 'btn-flat-secondary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Zap size={14} />
                        <span>Emergency (+30%)</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Grid (Icon Tiles Reference Component) */}
                  <div style={{ marginBottom: '16px' }}>
                    <CategoryGrid
                      categories={categories.map(c => ({
                        id: c.id,
                        name: c.name,
                        base_price_inr: catalogTab === 'emergency' ? Math.round(c.base_price * emergencyMultiplier) : c.base_price,
                        is_emergency_capable: true
                      }))}
                      selectedCategoryId={selectedCategory}
                      onSelectCategory={cat => {
                        const full = categories.find(c => c.id === cat.id);
                        if (full) handleSelectCategory(full, catalogTab);
                      }}
                    />
                  </div>

                  {/* Category Cards Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '14px'
                    }}
                  >
                    {categories.map(c => {
                      const isSelected = selectedCategory === c.id && serviceType === catalogTab;
                      const catMinPrice = catalogTab === 'emergency'
                        ? Math.round(c.base_price * emergencyMultiplier)
                        : c.base_price;

                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCategory(c, catalogTab)}
                          style={{
                            border: `2px solid ${isSelected
                                ? catalogTab === 'emergency'
                                  ? 'var(--color-terracotta)'
                                  : 'var(--color-teal-dark)'
                                : 'var(--color-border)'
                              }`,
                            borderRadius: '10px',
                            backgroundColor: isSelected
                              ? catalogTab === 'emergency'
                                ? 'var(--color-coral-light)'
                                : 'var(--color-teal-light)'
                              : '#ffffff',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isSelected
                              ? `3px 3px 0px ${catalogTab === 'emergency' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`
                              : 'var(--shadow-flat)',
                            transition: 'transform 0.1s ease'
                          }}
                        >
                          {/* Image Box with "Sample image" Label */}
                          <div style={{ position: 'relative', width: '100%', height: '110px', backgroundColor: '#fbf5e9', overflow: 'hidden' }}>
                            <img
                              src={c.default_image}
                              alt={c.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {/* Sample image label requirement */}
                            <span
                              className="flat-badge"
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                fontSize: '0.66rem',
                                backgroundColor: '#ffffff',
                                color: 'var(--color-teal-dark)',
                                border: '1.5px solid var(--color-teal-dark)',
                                fontWeight: 800,
                                padding: '2px 6px'
                              }}
                            >
                              Sample image
                            </span>
                          </div>

                          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                                  {c.name}
                                </div>
                              </div>
                              {c.description && (
                                <p style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                                  {c.description}
                                </p>
                              )}
                            </div>

                            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', display: 'block' }}>
                                  {catalogTab === 'emergency' ? 'Emergency Min' : 'Base Price'}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.92rem',
                                    fontWeight: 900,
                                    color: catalogTab === 'emergency' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'
                                  }}
                                >
                                  Rs {catMinPrice}
                                </span>
                              </div>

                              <span
                                className={`flat-badge ${isSelected ? (catalogTab === 'emergency' ? 'badge-emergency' : 'badge-verified') : ''}`}
                                style={{ fontSize: '0.7rem' }}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* 3. Post Request Form */}
                <Card id="post-request-form">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                      Post Service Request Details
                    </h2>
                    <span className={`flat-badge ${serviceType === 'emergency' ? 'badge-emergency' : 'badge-ordinary'}`}>
                      {serviceType.toUpperCase()} MODE
                    </span>
                  </div>

                  {formMsg && (
                    <div
                      style={{
                        backgroundColor: formMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                        border: `2px solid ${formMsg.type === 'error' ? '#ef4444' : '#16a34a'}`,
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: formMsg.type === 'error' ? '#991b1b' : '#166534',
                        fontWeight: 700
                      }}
                    >
                      {formMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                      <span>{formMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Urgency Switcher */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '6px' }}>
                        Dispatch Urgency
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div
                          onClick={() => {
                            setServiceType('ordinary');
                            setCatalogTab('ordinary');
                            setOfferedPrice(basePrice);
                            if (!customDate || customDate < minOrdinaryDate) setCustomDate(minOrdinaryDate);
                          }}
                          style={{
                            border: `2px solid ${serviceType === 'ordinary' ? 'var(--color-teal-dark)' : 'var(--color-border)'}`,
                            backgroundColor: serviceType === 'ordinary' ? 'var(--color-teal-light)' : '#ffffff',
                            padding: '12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: serviceType === 'ordinary' ? '2px 2px 0px var(--color-teal-dark)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                            <Clock size={16} />
                            {t('service_type_ordinary', language)}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                            Standard scheduled visit (2 to 3 days advance, 8 AM to 7 PM). Floor: Rs {basePrice}
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            setServiceType('emergency');
                            setCatalogTab('emergency');
                            const emergMin = Math.round(basePrice * emergencyMultiplier);
                            setOfferedPrice(emergMin);
                            if (!customDate) setCustomDate(todayDate);
                          }}
                          style={{
                            border: `2px solid ${serviceType === 'emergency' ? 'var(--color-terracotta)' : 'var(--color-border)'}`,
                            backgroundColor: serviceType === 'emergency' ? 'var(--color-coral-light)' : '#ffffff',
                            padding: '12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: serviceType === 'emergency' ? '2px 2px 0px var(--color-terracotta)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: 'var(--color-terracotta)' }}>
                            <Zap size={16} />
                            {t('service_type_emergency', language)}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                            Live 45-min bidding arena for urgent dispatch within 13 km. Floor (+30%): Rs {Math.round(basePrice * emergencyMultiplier)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Selected Category Readout / Quick Selector */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                        Selected Category
                      </label>
                      <select
                        className="flat-select"
                        value={selectedCategory}
                        onChange={e => {
                          const catId = e.target.value;
                          setSelectedCategory(catId);
                          const targetCat = categories.find(c => c.id === catId);
                          if (targetCat) {
                            const minP = serviceType === 'emergency'
                              ? Math.round(targetCat.base_price * emergencyMultiplier)
                              : targetCat.base_price;
                            setOfferedPrice(minP);
                          }
                        }}
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Base: Rs {c.base_price})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Coimbatore Area Selection */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                        Service Locality (Coimbatore)
                      </label>
                      <select
                        className="flat-select"
                        value={selectedAreaId}
                        onChange={e => setSelectedAreaId(e.target.value)}
                      >
                        {areas.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} (Pincode: {a.pincode})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Provider Preference */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '6px' }}>
                        Provider Preference
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[
                          { id: 'either', label: 'Either / Any', icon: <Users size={15} />, desc: 'Best available match' },
                          { id: 'freelancer', label: 'Freelancer Only', icon: <User size={15} />, desc: 'Independent technician' },
                          { id: 'organization', label: 'Agency / Org', icon: <Building2 size={15} />, desc: 'Registered company' }
                        ].map(opt => (
                          <div
                            key={opt.id}
                            onClick={() => setProviderPreference(opt.id as ProviderPreference)}
                            style={{
                              border: `2px solid ${providerPreference === opt.id ? 'var(--color-teal-dark)' : 'var(--color-border)'}`,
                              backgroundColor: providerPreference === opt.id ? 'var(--color-teal-light)' : '#ffffff',
                              padding: '10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              boxShadow: providerPreference === opt.id ? '2px 2px 0px var(--color-teal-dark)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.84rem' }}>
                              {opt.icon}
                              <span>{opt.label}</span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{opt.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Title & Detailed Description */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                        Problem Summary / Title
                      </label>
                      <input
                        type="text"
                        className="flat-input"
                        placeholder="e.g. Major pipe burst under kitchen sink"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                        Detailed Issue Description
                      </label>
                      <textarea
                        className="flat-textarea"
                        rows={3}
                        placeholder="Describe the problem, symptoms, equipment brand, and access instructions..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        required
                      />
                    </div>

                    {/* Confidential Address (Encrypted/Hidden until booking) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                        Confidential Address & Access Notes (Shared only after confirmation)
                      </label>
                      <input
                        type="text"
                        className="flat-input"
                        placeholder="Flat No, Apartment name, Street, Landmark..."
                        value={addressConfidential}
                        onChange={e => setAddressConfidential(e.target.value)}
                      />
                    </div>

                    {/* Schedule: Ordinary (2 to 3 days ahead, 8am-7pm) vs Emergency (min lead time) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                          Preferred Date {serviceType === 'ordinary' ? `(${minOrdinaryDate} to ${maxOrdinaryDate})` : `(Min: Today)`}
                        </label>
                        <input
                          type="date"
                          className="flat-input"
                          min={serviceType === 'ordinary' ? minOrdinaryDate : todayDate}
                          max={serviceType === 'ordinary' ? maxOrdinaryDate : undefined}
                          value={customDate || (serviceType === 'ordinary' ? minOrdinaryDate : todayDate)}
                          onChange={e => setCustomDate(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                          Preferred Start Time {serviceType === 'ordinary' ? '(08:00 to 19:00 IST)' : `(Min ${emergencyMinLeadHours}h lead time)`}
                        </label>
                        <input
                          type="time"
                          className="flat-input"
                          min={serviceType === 'ordinary' ? '08:00' : undefined}
                          max={serviceType === 'ordinary' ? '19:00' : undefined}
                          value={customTime}
                          onChange={e => setCustomTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Price Input with strict Minimum Price Floor */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                          Budget / Offered Price (Floor: Rs {minAllowedPrice})
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                          {serviceType === 'emergency'
                            ? `Emergency floor (+30% multiplier): Rs ${minAllowedPrice}`
                            : `Ordinary base price floor: Rs ${minAllowedPrice}`}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={minAllowedPrice}
                        step={50}
                        className="flat-input"
                        value={offeredPrice}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setOfferedPrice(Math.max(minAllowedPrice, val));
                        }}
                        required
                      />
                    </div>

                    {/* Image Upload Component (0 to 4 images, browser compression, EXIF strip via canvas, Supabase Storage) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                          Attach Problem Photos (0 to 4 images)
                        </label>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-teal-dark)' }}>
                          {images.length} / 4 attached
                        </span>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                      />

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                        {images.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              width: '80px',
                              height: '80px',
                              borderRadius: '8px',
                              border: '2px solid var(--color-teal-dark)',
                              overflow: 'hidden',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            <img
                              src={imgUrl}
                              alt={`Upload ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #ef4444',
                                borderRadius: '4px',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#ef4444'
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}

                        {images.length < 4 && (
                          <button
                            type="button"
                            disabled={uploadingImage}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              width: '80px',
                              height: '80px',
                              border: '2px dashed var(--color-teal-dark)',
                              borderRadius: '8px',
                              backgroundColor: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'var(--color-teal-dark)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              gap: '4px'
                            }}
                          >
                            <Upload size={18} />
                            <span>{uploadingImage ? 'Compressing...' : 'Add Photo'}</span>
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '6px' }}>
                        Photos are automatically compressed and stripped of EXIF metadata before uploading to Supabase Storage.
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      variant={serviceType === 'emergency' ? 'red' : 'primary'}
                      disabled={submitting || Boolean(pendingReview)}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      {submitting
                        ? 'Validating & Submitting...'
                        : pendingReview
                          ? 'Review Required Before Posting'
                          : serviceType === 'emergency'
                            ? `Continue to Emergency Fee Verification (Rs ${offeredPrice})`
                            : `Confirm & Schedule Ordinary Service (Rs ${offeredPrice})`}
                    </Button>
                  </form>
                </Card>
              </div>
            )}

            {/* Tab 2: Live Emergency Bidding Arena */}
            {activeTab === 'bidding' && (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Zap size={22} color="var(--color-terracotta)" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>
                    Live Emergency Bidding Arena
                  </h2>
                </div>

                {/* Notification toast */}
                {arenaToast && (
                  <div style={{
                    backgroundColor: '#dcfce7',
                    border: '2px solid #16a34a',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '14px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle size={16} />
                    {arenaToast}
                  </div>
                )}

                {activeBiddingList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-muted)' }}>
                    You currently have no active emergency service requests in the bidding arena.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {activeBiddingList.map(req => {
                      const arena = liveArena[req.id];
                      const biddingIsOpen = arena?.status === 'bidding_open';
                      const awarded = arena?.status === 'awarded' || arena?.status === 'closed';
                      const topBid = arena?.topBid ?? req.top_bid_coins ?? 0;
                      const secs = arena?.secsRemaining ?? null;
                      const recentBids = liveBids[req.id] ?? [];

                      const formatSecs = (s: number | null) => {
                        if (s === null) return '--:--';
                        if (s <= 0) return 'CLOSED';
                        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
                      };

                      return (
                        <div
                          key={req.id}
                          style={{
                            border: `2px solid ${biddingIsOpen ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                            borderRadius: '12px',
                            padding: '16px',
                            backgroundColor: biddingIsOpen ? 'var(--color-coral-light)' : '#f0faf9'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className="flat-badge badge-emergency">EMERGENCY ACTIVE</span>
                                <span className={`flat-badge ${biddingIsOpen ? 'badge-emergency' : ''}`}>
                                  {(arena?.status ?? req.status).replace(/_/g, ' ').toUpperCase()}
                                </span>
                              </div>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px' }}>{req.title}</h3>
                              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{req.description}</p>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-teal-dark)', marginTop: '4px' }}>
                                Locality: {req.area?.name} | Budget: Rs {req.offered_price}
                              </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => setChatRequest(req)}>
                              <MessageSquare size={14} /> Open Chat
                            </Button>
                          </div>

                          {/* Live Stats Row */}
                          <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                            <div style={{ border: '2px solid var(--color-terracotta)', borderRadius: '8px', padding: '10px', backgroundColor: '#ffffff', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Current Top Bid</div>
                              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: topBid > 0 ? 'var(--color-terracotta)' : 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                {topBid > 0 ? topBid : '--'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>coins</div>
                            </div>

                            <div style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '8px', padding: '10px', backgroundColor: '#ffffff', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                                <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Arena Closes
                              </div>
                              <div style={{
                                fontSize: '1.4rem',
                                fontWeight: 900,
                                color: secs !== null && secs < 60 ? 'var(--color-terracotta)' : 'var(--color-teal-dark)',
                                fontVariantNumeric: 'tabular-nums'
                              }}>
                                {biddingIsOpen ? formatSecs(secs) : awarded ? 'AWARDED' : 'Gathering'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{biddingIsOpen ? 'mm:ss' : 'status'}</div>
                            </div>

                            <div style={{ border: '1.5px solid var(--color-border)', borderRadius: '8px', padding: '10px', backgroundColor: '#ffffff', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Live Bids Placed</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-dark)' }}>
                                {(req.bids?.length ?? 0) + recentBids.length}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>total</div>
                            </div>
                          </div>

                          {/* Live bid feed from Realtime */}
                          {recentBids.length > 0 && (
                            <div style={{ marginTop: '12px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '8px 12px' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Live Incoming Bids</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {recentBids.slice(0, 5).map(bid => (
                                  <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--color-muted)' }}>{new Date(bid.created_at).toLocaleTimeString()}</span>
                                    <span style={{ fontWeight: 800, color: bid.status === 'active' ? 'var(--color-terracotta)' : 'var(--color-muted)' }}>
                                      {bid.coins} coins {bid.status === 'active' ? '(current top)' : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Legacy static bids from DB snapshot */}
                          {!recentBids.length && req.bids && req.bids.length > 0 && (
                            <div style={{ marginTop: '16px', borderTop: '1px dashed var(--color-terracotta)', paddingTop: '12px' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-terracotta)', marginBottom: '8px' }}>
                                Incoming Provider Bids ({req.bids.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {req.bids.map(bid => (
                                  <div
                                    key={bid.id}
                                    style={{
                                      backgroundColor: '#ffffff',
                                      border: '2px solid var(--color-teal-dark)',
                                      borderRadius: '8px',
                                      padding: '10px 14px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: '8px'
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Bid: {bid.coins} Coins</div>
                                      {bid.note && (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>"{bid.note}"</div>
                                      )}
                                    </div>
                                    <Button size="sm" variant="red" onClick={() => handleAcceptBid(req, bid)}>
                                      Accept Bid & Dispatch
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {awarded && (
                            <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#dcfce7', border: '2px solid #16a34a', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#166534' }}>
                              <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                              Bidding concluded. A technician has been assigned to your job.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* Tab 3: Calendar & Bookings (Reused ScheduleCalendar from packages/ui) */}
            {activeTab === 'calendar' && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                      Confirmed Bookings & Upcoming Visits
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                      Track confirmed technician schedules and arrival windows. Click any booking to chat.
                    </p>
                  </div>

                  <span className="flat-badge badge-verified">
                    {upcomingBookings.length} Upcoming Bookings
                  </span>
                </div>

                <ScheduleCalendar
                  bookings={upcomingBookings.map(req => ({
                    id: req.id,
                    time_range: `[${req.preferred_start},${new Date(new Date(req.preferred_start).getTime() + (req.estimated_duration_hours || 2) * 60 * 60 * 1000).toISOString()})`,
                    status: req.status === 'pending' ? 'hold' : 'confirmed',
                    request: req
                  }))}
                  role="customer"
                  minGapHours={8.0}
                  onSelectBooking={b => {
                    if (b.request) setChatRequest(b.request as any);
                  }}
                />

                {/* Active Bookings and Completion Pipeline */}
                {upcomingBookings.length > 0 && (
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-dark)', margin: 0 }}>
                        Active Bookings ({upcomingBookings.length})
                      </h3>
                      <span className="flat-badge badge-neutral">Completion Pipeline</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {upcomingBookings.map(req => {
                        const booking = (req.bookings && req.bookings.length > 0) ? req.bookings[0] : null;
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
                                  Provider: {req.assigned_provider?.organization?.name || req.assigned_provider?.profile?.name || 'Assigned Technician'} | Locality: {req.area?.name || 'Area'}
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
                              role="customer"
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

            {/* Tab 4: History & Reviews */}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-primary)' }}>
                    Service History
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="flat-badge badge-muted">{historyEntries.length} jobs</span>
                    <Button id="refresh-history-btn" size="sm" variant="secondary" onClick={loadHistory} disabled={historyLoading}>
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
                      <FileText size={32} color="var(--color-muted)" style={{ margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontWeight: 700, color: 'var(--color-muted)' }}>No completed jobs yet.</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Completed jobs with reviews will appear here.
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {historyEntries.map(entry => (
                      <HistoryCard
                        key={entry.booking_id}
                        entry={entry}
                        role="customer"
                        onReview={(bId) => setReviewBookingId(bId)}
                        onReopen={async (bId) => {
                          const { reopenAfterNoshow } = await import('@urbanclap/lib');
                          try {
                            const res = await reopenAfterNoshow(bId);
                            alert(`New request created (ID: ${res.new_request_id?.slice(0, 8)}...). No-show provider is blocked.`);
                            await loadData();
                            loadHistory();
                          } catch (err: any) {
                            alert(err.message || 'Failed to reopen');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Inline ReviewModal triggered from HistoryCard */}
                {reviewBookingId && (
                  <ReviewModal
                    bookingId={reviewBookingId}
                    role="customer"
                    jobTitle={historyEntries.find(e => e.booking_id === reviewBookingId)?.title ?? 'Service'}
                    onClose={() => setReviewBookingId(null)}
                    onSuccess={(res) => {
                      setReviewBookingId(null);
                      alert(`Review submitted! You earned ${(res.completion_coins ?? 0) + (res.bonus_coins ?? 0)} coins for your technician.`);
                      loadHistory();
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

      {/* Emergency Fee Payment Modal */}
      {authUser && (
        <EmergencyFeeModal
          isOpen={emergencyFeeModalOpen}
          feeAmount={emergencyFee}
          customerId={authUser.id}
          onClose={() => {
            setEmergencyFeeModalOpen(false);
            setPendingEmergencyPayload(null);
          }}
          onSuccess={handleEmergencyFeeSuccess}
        />
      )}

      {/* Chat Modal */}
      {chatRequest && (
        <ChatModal
          request={chatRequest}
          onClose={() => setChatRequest(null)}
        />
      )}

      {/* Compulsory Review Modal */}
      {reviewRequest && (
        <CompulsoryReviewModal
          request={reviewRequest}
          onClose={() => setReviewRequest(null)}
          onSuccess={() => {
            alert('Thank you! Your blind review has been submitted and will be revealed once both parties submit.');
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
    <AuthProvider appRole="customer">
      <CustomerAppContent />
    </AuthProvider>
  );
}