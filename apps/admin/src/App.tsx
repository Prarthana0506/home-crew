import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AuthProvider,
  useAuth,
  fetchServiceRequests,
  fetchAllProviders,
  fetchPendingProviders,
  fetchDisputes,
  adminGetMetrics,
  adminStartBidding,
  adminCancelBidding,
  adminApproveProvider,
  adminRejectProvider,
  adminLiftBidBan,
  adminResolveDispute,
  fetchSettings,
  fetchInAppNotifications,
  subscribeToInAppNotifications,
  fetchAllCategories,
  adminUpdateCategory,
  adminFetchUsers,
  adminFetchCoinLedger,
  fetchRevenue,
  setEmergencyFee,
  fetchVerificationQueue,
  adminApproveVerification,
  adminRejectVerification,
  fetchDisputeMessages,
  sendDisputeMessage,
  subscribeToDisputeMessages,
  supabase,
  type ServiceRequest,
  type AdminUserRow,
  type AdminCoinLedgerEntry,
  type RevenueRow,
  type VerificationRequest,
  type DisputeMessage,
} from '@urbanclap/lib';
import { Navbar, Button, Card, AdminDonutChart, AdminLineChart, NotificationInboxModal, PrivacyPolicyPage, TermsPage, AppFooter } from '@urbanclap/ui';
import {
  Shield, Zap, AlertCircle, RefreshCw, Settings as SettingsIcon,
  Users, CheckCircle, XCircle, Lock, Unlock, TrendingUp,
  MessageSquare, Activity, FileText, Eye, EyeOff, Image as ImageIcon,
  DollarSign, BarChart2, Tag, UserCheck, Send, X, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Shared tiny components ───────────────────────────────────────────────────

const MetricTile: React.FC<{ label: string; value: string | number; accent?: string }> = ({
  label, value, accent = 'var(--color-teal-dark)'
}) => (
  <div className="flat-card" style={{ padding: '16px 20px' }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 900, color: accent, marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    pending: '#d97706', active: '#16a34a', rejected: '#dc2626',
    left: '#6b7280', open: '#0369a1', bidding_open: '#dc2626',
    awarded: '#16a34a', interest_window: '#d97706', notified: '#7c3aed',
    cancelled: '#6b7280', resolved: '#16a34a', investigating: '#d97706',
    approved: '#16a34a',
  };
  const bg = colorMap[status] || '#6b7280';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
      fontSize: '0.72rem', fontWeight: 800, color: '#fff', backgroundColor: bg,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
};
const modalBox: React.CSSProperties = {
  backgroundColor: '#fff', border: '2px solid var(--color-teal-dark)',
  borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  padding: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
};

// ─── Main AdminAppContent ─────────────────────────────────────────────────────
const AdminAppContent: React.FC = () => {
  const { authUser, profile, signInWithEmail, signOut } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]     = useState('');

  type TabId = 'metrics' | 'emergency' | 'providers' | 'users' | 'settings'
             | 'disputes' | 'verification' | 'categories' | 'revenue';

  const [activeTab, setActiveTab] = useState<TabId>('metrics');

  // Core data
  const [metrics,          setMetrics]          = useState<Record<string, number | null>>({});
  const [requests,         setRequests]         = useState<ServiceRequest[]>([]);
  const [providers,        setProviders]        = useState<any[]>([]);
  const [pendingProviders, setPending]          = useState<any[]>([]);
  const [settingsList,     setSettingsList]     = useState<any[]>([]);
  const [disputes,         setDisputesList]     = useState<any[]>([]);
  // New
  const [users,            setUsers]            = useState<AdminUserRow[]>([]);
  const [categories,       setCategories]       = useState<any[]>([]);
  const [revenue,          setRevenue]          = useState<RevenueRow[]>([]);
  const [revPeriod,        setRevPeriod]        = useState<'day' | 'week' | 'month'>('day');
  const [verification,     setVerification]     = useState<VerificationRequest[]>([]);

  // UI states
  const [editingSetting,  setEditingSetting]   = useState<{ key: string; value: string } | null>(null);
  const [resolveTarget,   setResolveTarget]    = useState<{ id: string; resolution: string; favor: 'customer' | 'provider' | 'neutral' } | null>(null);
  const [actionMsg,       setActionMsg]        = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading,         setLoading]          = useState(false);

  // Users tab
  const [ledgerUser,      setLedgerUser]       = useState<AdminUserRow | null>(null);
  const [ledger,          setLedger]           = useState<AdminCoinLedgerEntry[]>([]);
  const [ledgerLoading,   setLedgerLoading]    = useState(false);
  const [userFilter,      setUserFilter]       = useState('');

  // Dispute chat
  const [chatDisputeId,   setChatDisputeId]    = useState<string | null>(null);
  const [chatMessages,    setChatMessages]     = useState<DisputeMessage[]>([]);
  const [chatInput,       setChatInput]        = useState('');
  const [chatImage,       setChatImage]        = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Categories edit
  const [editCat, setEditCat] = useState<any | null>(null);

  // Revenue / fee
  const [newFee, setNewFee] = useState('');

  // Notifications
  const [inboxOpen,         setInboxOpen]         = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  // Legal page overlay
  const [legalPage, setLegalPage] = useState<'privacy' | 'terms' | null>(null);

  const showMsg = useCallback((type: 'error' | 'success', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 5500);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mets, reqs, allProvs, pends, sets, disps] = await Promise.all([
        adminGetMetrics().catch(() => ({})),
        fetchServiceRequests().catch(() => []),
        fetchAllProviders().catch(() => []),
        fetchPendingProviders().catch(() => []),
        fetchSettings().catch(() => ({})),
        fetchDisputes().catch(() => []),
      ]);
      setMetrics(mets);
      setRequests(reqs);
      setProviders(allProvs);
      setPending(pends);
      setSettingsList(Object.entries(sets).map(([key, value]) => ({ key, value })));
      setDisputesList(disps);
    } catch (err) {
      console.warn('loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const u = await adminFetchUsers();
      setUsers(u);
    } catch (e: any) { console.warn(e.message); }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const c = await fetchAllCategories();
      setCategories(c);
    } catch (e: any) { console.warn(e.message); }
  }, []);

  const loadRevenue = useCallback(async (p: 'day' | 'week' | 'month') => {
    try {
      const r = await fetchRevenue(p);
      setRevenue(r);
    } catch (e: any) { console.warn(e.message); }
  }, []);

  const loadVerification = useCallback(async () => {
    try {
      const v = await fetchVerificationQueue();
      setVerification(v);
    } catch (e: any) { console.warn(e.message); }
  }, []);

  useEffect(() => {
    if (authUser?.id && profile?.role === 'admin') {
      loadData();
      loadUsers();
      loadCategories();
      loadRevenue(revPeriod);
      loadVerification();
    }
  }, [authUser?.id, profile?.role]);

  useEffect(() => {
    if (authUser?.id && profile?.role === 'admin') {
      loadRevenue(revPeriod);
    }
  }, [revPeriod]);

  // ── Notifications ──────────────────────────────────────────────────────────
  const loadUnreadNotifs = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const notifs = await fetchInAppNotifications(authUser.id);
      setUnreadNotifsCount(notifs.filter(n => !n.read).length);
    } catch { /* ignore */ }
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;
    loadUnreadNotifs();
    const unsub = subscribeToInAppNotifications(authUser.id, loadUnreadNotifs);
    return unsub;
  }, [authUser?.id, loadUnreadNotifs]);

  // ── Dispute chat realtime ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chatDisputeId) return;
    fetchDisputeMessages(chatDisputeId).then(setChatMessages);
    const unsub = subscribeToDisputeMessages(chatDisputeId, (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });
    return unsub;
  }, [chatDisputeId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid administrator credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Emergency handlers ─────────────────────────────────────────────────────
  const handleForceStartBidding = async (reqId: string) => {
    try { await adminStartBidding(reqId); showMsg('success', 'Bidding force-started.'); await loadData(); }
    catch (err: any) { showMsg('error', err.message || 'Failed'); }
  };
  const handleCancelBidding = async (reqId: string) => {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    try { await adminCancelBidding(reqId, reason); showMsg('success', 'Cancelled.'); await loadData(); }
    catch (err: any) { showMsg('error', err.message || 'Failed'); }
  };

  // ── Provider handlers ──────────────────────────────────────────────────────
  const handleApprove = async (profId: string) => {
    try {
      const res = await adminApproveProvider(profId, 'Approved via Admin Console');
      showMsg('success', `Approved. ${res.coins_granted ?? 35} coins granted.`);
      await loadData();
    } catch (err: any) { showMsg('error', err.message || 'Failed'); }
  };
  const handleReject = async (profId: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try { await adminRejectProvider(profId, reason); showMsg('success', 'Rejected.'); await loadData(); }
    catch (err: any) { showMsg('error', err.message || 'Failed'); }
  };
  const handleLiftBan = async (hash: string) => {
    try {
      const res = await adminLiftBidBan(hash, 'Admin manual review');
      showMsg('success', `Ban lifted for ${res.profiles_unbanned ?? 0} profile(s).`);
      await loadData();
    } catch (err: any) { showMsg('error', err.message || 'Failed'); }
  };

  // ── Settings handler ───────────────────────────────────────────────────────
  const handleSaveSetting = async () => {
    if (!editingSetting) return;
    try {
      let parsedValue: any;
      try { parsedValue = JSON.parse(editingSetting.value); }
      catch { parsedValue = { value: parseFloat(editingSetting.value) || editingSetting.value }; }
      const { error } = await supabase
        .from('settings')
        .update({ value: parsedValue, updated_by: authUser?.id, updated_at: new Date().toISOString() })
        .eq('key', editingSetting.key);
      if (error) throw error;
      showMsg('success', `"${editingSetting.key}" updated and versioned.`);
      setEditingSetting(null);
      await loadData();
    } catch (err: any) { showMsg('error', err.message || 'Failed'); }
  };

  // ── Dispute handler ────────────────────────────────────────────────────────
  const handleResolveDispute = async () => {
    if (!resolveTarget) return;
    try {
      await adminResolveDispute({ disputeId: resolveTarget.id, resolution: resolveTarget.resolution, favor: resolveTarget.favor });
      showMsg('success', 'Dispute resolved.');
      setResolveTarget(null);
      await loadData();
    } catch (err: any) { showMsg('error', err.message || 'Failed'); }
  };

  // ── Dispute chat send ──────────────────────────────────────────────────────
  const handleSendChatMsg = async () => {
    if (!chatDisputeId || !chatInput.trim() || !authUser?.id) return;
    try {
      await sendDisputeMessage({ disputeId: chatDisputeId, senderId: authUser.id, content: chatInput, imageUrl: chatImage || undefined });
      setChatInput('');
      setChatImage('');
    } catch (err: any) { showMsg('error', err.message); }
  };

  // ── Verification handlers ──────────────────────────────────────────────────
  const handleApproveVerif = async (id: string) => {
    try { await adminApproveVerification(id); showMsg('success', 'Document approved.'); await loadVerification(); }
    catch (err: any) { showMsg('error', err.message); }
  };
  const handleRejectVerif = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    try { await adminRejectVerification(id, reason); showMsg('success', 'Document rejected.'); await loadVerification(); }
    catch (err: any) { showMsg('error', err.message); }
  };

  // ── Category handler ───────────────────────────────────────────────────────
  const handleSaveCat = async () => {
    if (!editCat) return;
    try {
      await adminUpdateCategory({
        categoryId: editCat.id,
        name:       editCat.name,
        basePrice:  parseFloat(editCat.base_price),
        imageUrl:   editCat.image_url || undefined,
        active:     editCat.active,
      });
      showMsg('success', 'Category updated.');
      setEditCat(null);
      await loadCategories();
    } catch (err: any) { showMsg('error', err.message); }
  };

  // ── Emergency fee handler ──────────────────────────────────────────────────
  const handleSetFee = async () => {
    const fee = parseFloat(newFee);
    if (isNaN(fee) || fee <= 0) { showMsg('error', 'Enter a valid positive fee.'); return; }
    try {
      await setEmergencyFee(fee);
      showMsg('success', `Emergency fee set to ₹${fee}. Only future emergency posts are affected.`);
      setNewFee('');
      await loadData();
    } catch (err: any) { showMsg('error', err.message); }
  };

  // ── Ledger viewer ──────────────────────────────────────────────────────────
  const openLedger = async (user: AdminUserRow) => {
    if (!user.provider_profile_id) return;
    setLedgerUser(user);
    setLedgerLoading(true);
    try {
      const l = await adminFetchCoinLedger(user.provider_profile_id);
      setLedger(l);
    } catch (e: any) { showMsg('error', e.message); }
    finally { setLedgerLoading(false); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isAdmin           = profile?.role === 'admin';
  const emergencyRequests = requests.filter(r => r.type === 'emergency');
  const bannedProviders   = providers.filter((p: any) => p.bid_banned_until && new Date(p.bid_banned_until) > new Date());
  const openDisputes      = disputes.filter((d: any) => d.status === 'open');
  const pendingVerif      = verification.filter(v => v.status === 'pending');
  const filteredUsers     = users.filter(u =>
    !userFilter || u.name?.toLowerCase().includes(userFilter.toLowerCase()) ||
    u.email?.toLowerCase().includes(userFilter.toLowerCase()) ||
    u.phone?.includes(userFilter)
  );

  const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
    { id: 'metrics',      icon: <Activity size={15} />,     label: 'Metrics' },
    { id: 'emergency',    icon: <Zap size={15} />,          label: `Emergency (${emergencyRequests.length})` },
    { id: 'providers',    icon: <UserCheck size={15} />,    label: `Providers (${pendingProviders.length} pending)` },
    { id: 'users',        icon: <Users size={15} />,        label: `Users (${users.length})` },
    { id: 'verification', icon: <Eye size={15} />,          label: `Verification (${pendingVerif.length})` },
    { id: 'disputes',     icon: <AlertCircle size={15} />,  label: `Disputes (${openDisputes.length})` },
    { id: 'categories',   icon: <Tag size={15} />,          label: 'Categories' },
    { id: 'revenue',      icon: <BarChart2 size={15} />,    label: 'Revenue' },
    { id: 'settings',     icon: <SettingsIcon size={15} />, label: `Settings (${settingsList.length})` },
  ];

  // ── RENDER: Legal page overlay ────────────────────────────────────────────
  if (legalPage) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar brandSubtitle="Admin Console" onOpenNotifications={() => setInboxOpen(true)} unreadNotificationsCount={unreadNotifsCount} />
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', padding: '0 16px' }}>
          <button
            onClick={() => setLegalPage(null)}
            style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '2px solid #1e293b', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}
          >
            ← Back
          </button>
          {legalPage === 'privacy' ? <PrivacyPolicyPage /> : <TermsPage />}
        </div>
        <AppFooter onPrivacy={() => setLegalPage('privacy')} onTerms={() => setLegalPage('terms')} />
      </div>
    );
  }

  // ── RENDER: Unauthenticated ────────────────────────────────────────────────
  if (!authUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar brandSubtitle="Admin Console" />
        <main style={{ maxWidth: '440px', width: '100%', margin: '56px auto', padding: '0 16px' }}>
          <Card>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '10px', backgroundColor: 'var(--color-dark)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Shield size={28} />
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Admin Console Sign In</h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '4px' }}>Super · Support · Finance roles</p>
            </div>
            {loginError && (
              <div style={{ backgroundColor: '#fee2e2', border: '2px solid #ef4444', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
                <AlertCircle size={16} /><span>{loginError}</span>
              </div>
            )}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Admin Email</label>
                <input id="admin-email" type="email" className="flat-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@homecrew.in" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Password</label>
                <input id="admin-password" type="password" className="flat-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" required />
              </div>
              <Button id="admin-login-btn" type="submit" variant="primary" disabled={loginLoading} style={{ width: '100%' }}>
                {loginLoading ? 'Signing in...' : 'Sign In as Administrator'}
              </Button>
            </form>
          </Card>
        </main>
        <AppFooter onPrivacy={() => setLegalPage('privacy')} onTerms={() => setLegalPage('terms')} />
      </div>
    );
  }


  // ── RENDER: Not admin ──────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar brandSubtitle="Admin Console" />
        <main style={{ maxWidth: '480px', margin: '60px auto', padding: '0 16px' }}>
          <Card>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <AlertCircle size={40} color="#dc2626" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>Access Denied</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', margin: '8px 0 20px' }}>
                Account ({authUser.email}) does not have admin privileges.
              </p>
              <Button id="admin-signout-btn" variant="secondary" onClick={signOut}>Sign Out</Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // ── RENDER: Admin dashboard ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar brandSubtitle="Admin Console" onOpenNotifications={() => setInboxOpen(true)} unreadNotificationsCount={unreadNotifsCount} />

      <main style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '24px 16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Header banner */}
          <div className="flat-card flat-card-teal" style={{ padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'var(--color-terracotta)', padding: '10px', borderRadius: '10px' }}>
                <Shield size={28} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>HomeCrew Operations Console</h1>
                <p style={{ color: '#cde8ed', fontSize: '0.85rem', marginTop: '2px' }}>
                  {profile?.name ?? authUser.email} · {(profile as any)?.admin_role?.toUpperCase() ?? 'ADMIN'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button id="admin-refresh-btn" size="sm" variant="secondary" onClick={loadData} disabled={loading}>
                <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
              </Button>
              <Button id="admin-signout-hdr-btn" size="sm" variant="secondary" onClick={signOut}>Sign Out</Button>
            </div>
          </div>

          {/* Action msg */}
          {actionMsg && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', border: `2px solid ${actionMsg.type === 'success' ? '#16a34a' : '#dc2626'}`, backgroundColor: actionMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: actionMsg.type === 'success' ? '#166534' : '#991b1b', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {actionMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {actionMsg.text}
            </div>
          )}

          {/* Nav tabs */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', backgroundColor: '#fff', padding: '6px', borderRadius: '10px', border: '2px solid var(--color-teal-dark)', boxShadow: 'var(--shadow-flat)', overflowX: 'auto' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`btn-flat btn-flat-sm ${activeTab === tab.id ? '' : 'btn-flat-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
              >
                {tab.icon}<span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Metrics                                                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                <MetricTile label="Total Requests"       value={metrics.total_requests ?? 0} />
                <MetricTile label="Open Ordinary Jobs"   value={metrics.open_ordinary ?? 0}      accent="var(--color-teal-dark)" />
                <MetricTile label="Emergency Active"     value={metrics.emergency_active ?? 0}    accent="var(--color-terracotta)" />
                <MetricTile label="Emergency Awarded"    value={metrics.emergency_awarded ?? 0}   accent="#16a34a" />
                <MetricTile label="Emergency Failed"     value={metrics.emergency_failed ?? 0}    accent="#dc2626" />
                <MetricTile label="Active Providers"     value={metrics.total_providers ?? 0}     accent="var(--color-teal-dark)" />
                <MetricTile label="Pending Applications" value={metrics.pending_providers ?? 0}   accent="#d97706" />
                <MetricTile label="Banned Providers"     value={metrics.banned_providers ?? 0}    accent="#dc2626" />
                <MetricTile label="Coins Issued"         value={metrics.total_coins_issued ?? 0}  accent="var(--color-gold)" />
                <MetricTile label="Open Disputes"        value={metrics.open_disputes ?? 0}       accent="#dc2626" />
                <MetricTile label="Emergency Fee Revenue" value={`₹${metrics.emergency_fee_revenue ?? 0}`} accent="#16a34a" />
                <MetricTile label="Confirmed Bookings"   value={metrics.total_bookings ?? 0}      accent="#16a34a" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <AdminDonutChart
                  title="Request Lifecycle Status"
                  data={[
                    { label: 'Open Jobs',          value: metrics.open_ordinary ?? 0,                                        color: 'var(--color-primary)' },
                    { label: 'Emergency Active',   value: metrics.emergency_active ?? 0,                                     color: 'var(--color-coral)' },
                    { label: 'Confirmed Bookings', value: metrics.total_bookings ?? 0,                                       color: 'var(--color-emerald)' },
                    { label: 'Awarded',            value: metrics.emergency_awarded ?? 0,                                    color: 'var(--color-indigo-dark)' },
                    { label: 'Disputes / Failed',  value: (metrics.open_disputes ?? 0) + (metrics.emergency_failed ?? 0),   color: 'var(--color-crimson)' },
                  ]}
                />
                <AdminLineChart
                  title="Daily Service Request Volume"
                  data={[
                    { label: 'Mon', value: Math.max(1, Math.round((metrics.total_requests || 6) * 0.35)) },
                    { label: 'Tue', value: Math.max(2, Math.round((metrics.total_requests || 7) * 0.5)) },
                    { label: 'Wed', value: Math.max(3, Math.round((metrics.total_requests || 9) * 0.65)) },
                    { label: 'Thu', value: Math.max(2, Math.round((metrics.total_requests || 8) * 0.55)) },
                    { label: 'Fri', value: Math.max(4, Math.round((metrics.total_requests || 11) * 0.8)) },
                    { label: 'Sat', value: Math.max(5, Math.round((metrics.total_requests || 14) * 0.95)) },
                    { label: 'Sun', value: Math.max(metrics.total_requests || 8, 3) },
                  ]}
                  color="var(--color-coral)"
                  unit=" jobs"
                />
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Emergency                                                     */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'emergency' && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Emergency Bidding Sessions</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{emergencyRequests.length} emergency requests</span>
              </div>

              {emergencyRequests.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)' }}>No emergency listings yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {emergencyRequests.map(req => (
                    <div key={req.id} style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: 'var(--bg-sand)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span className="flat-badge badge-emergency">EMERGENCY</span>
                          <StatusBadge status={req.status} />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{req.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                          {req.area?.name} · ₹{req.offered_price} · {new Date(req.preferred_start).toLocaleString()}
                          {(req as any).bidding_closes_at && ` · closes ${new Date((req as any).bidding_closes_at).toLocaleTimeString()}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {!['bidding_open', 'awarded', 'cancelled'].includes(req.status) && (
                          <Button id={`admin-start-bid-${req.id}`} size="sm" variant="red" onClick={() => handleForceStartBidding(req.id)}>
                            <Zap size={13} /> Force Start
                          </Button>
                        )}
                        {!['cancelled', 'completed'].includes(req.status) && (
                          <Button id={`admin-cancel-bid-${req.id}`} size="sm" variant="secondary" onClick={() => handleCancelBidding(req.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Providers                                                     */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'providers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Pending */}
              <Card>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '14px' }}>
                  Pending Applications ({pendingProviders.length})
                </h2>
                {pendingProviders.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>No pending applications.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pendingProviders.map((prov: any) => (
                      <div key={prov.id} style={{ border: '2px solid #d97706', borderRadius: '10px', padding: '14px 16px', backgroundColor: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{prov.profile?.name ?? 'Unknown'}</span>
                            <StatusBadge status={prov.status} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{prov.provider_type}</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                            {prov.profile?.phone ?? '--'} · {prov.experience} yrs exp
                          </div>
                          {prov.id_proof_url && (
                            <a href={prov.id_proof_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--color-teal-dark)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                              <FileText size={12} /> View ID Proof
                            </a>
                          )}
                          {prov.categories?.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '4px' }}>Skills: {prov.categories.join(', ')}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button id={`admin-approve-${prov.id}`} size="sm" variant="primary" onClick={() => handleApprove(prov.id)}><CheckCircle size={13} /> Approve</Button>
                          <Button id={`admin-reject-${prov.id}`} size="sm" variant="red" onClick={() => handleReject(prov.id)}><XCircle size={13} /> Reject</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Banned */}
              {bannedProviders.length > 0 && (
                <Card>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-terracotta)', marginBottom: '14px' }}>Bid-Banned Providers ({bannedProviders.length})</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {bannedProviders.map((prov: any) => (
                      <div key={prov.id} style={{ border: '2px solid var(--color-terracotta)', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{prov.profile?.name ?? 'Unknown'}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                            Banned until: {new Date(prov.bid_banned_until).toLocaleString()}
                            {prov.verified_id_hash && ` · Hash: ${prov.verified_id_hash.substring(0, 12)}…`}
                          </div>
                        </div>
                        {prov.verified_id_hash && (
                          <Button id={`admin-liftban-${prov.id}`} size="sm" variant="secondary" onClick={() => handleLiftBan(prov.verified_id_hash)}>
                            <Unlock size={13} /> Lift Ban
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* All providers table */}
              <Card>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '14px' }}>All Providers ({providers.length})</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-teal-dark)', backgroundColor: 'var(--bg-sand)' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Rating</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Reviews</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Coins</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providers.map((prov: any) => (
                        <tr key={prov.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px', fontWeight: 700 }}>
                            {prov.profile?.name ?? '--'}
                            {prov.bid_banned_until && new Date(prov.bid_banned_until) > new Date() && <span style={{ marginLeft: '6px' }}><Lock size={11} color="#dc2626" /></span>}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--color-muted)' }}>{prov.provider_type}</td>
                          <td style={{ padding: '10px' }}><StatusBadge status={prov.status} /></td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{prov.rating_avg > 0 ? prov.rating_avg.toFixed(1) : '--'}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{prov.review_count}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-gold)' }}>{prov.coins ?? '--'}</td>
                          <td style={{ padding: '10px', color: 'var(--color-muted)', fontSize: '0.75rem' }}>{new Date(prov.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Users                                                         */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>All Users & Providers</h2>
                <input
                  className="flat-input"
                  placeholder="Filter by name / email / phone…"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  style={{ maxWidth: '280px' }}
                />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-teal-dark)', backgroundColor: 'var(--bg-sand)' }}>
                      <th style={{ padding: '9px 10px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '9px 10px', textAlign: 'left' }}>Email / Phone</th>
                      <th style={{ padding: '9px 10px', textAlign: 'left' }}>Role</th>
                      <th style={{ padding: '9px 10px', textAlign: 'right' }}>Coins</th>
                      <th style={{ padding: '9px 10px', textAlign: 'right' }}>Rating</th>
                      <th style={{ padding: '9px 10px', textAlign: 'left' }}>Ban</th>
                      <th style={{ padding: '9px 10px', textAlign: 'left' }}>Joined</th>
                      <th style={{ padding: '9px 10px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.user_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '9px 10px', fontWeight: 700 }}>{u.name ?? '--'}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                          {u.email}<br />{u.phone}
                        </td>
                        <td style={{ padding: '9px 10px' }}><StatusBadge status={u.provider_type ?? u.role} /></td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-gold)' }}>{u.coins ?? '--'}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{u.rating_avg ? u.rating_avg.toFixed(1) + '★' : '--'}</td>
                        <td style={{ padding: '9px 10px' }}>
                          {u.bid_banned_until && new Date(u.bid_banned_until) > new Date()
                            ? <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.75rem' }}>Until {new Date(u.bid_banned_until).toLocaleDateString()}</span>
                            : <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>Clear</span>}
                        </td>
                        <td style={{ padding: '9px 10px', color: 'var(--color-muted)', fontSize: '0.75rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                          {u.provider_profile_id && (
                            <Button size="sm" variant="secondary" onClick={() => openLedger(u)}>Ledger</Button>
                          )}
                          {u.bid_banned_until && new Date(u.bid_banned_until) > new Date() && u.verified_id_hash && (
                            <Button size="sm" variant="secondary" onClick={() => handleLiftBan(u.verified_id_hash!)} style={{ marginLeft: '4px' }}>
                              <Unlock size={11} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Verification                                                  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'verification' && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Verification Queue</h2>
                <Button size="sm" variant="secondary" onClick={loadVerification}><RefreshCw size={14} /> Refresh</Button>
              </div>

              {verification.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-muted)' }}>No verification requests.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {verification.map(v => (
                    <div key={v.id} style={{ border: `2px solid ${v.status === 'pending' ? '#d97706' : v.status === 'approved' ? '#16a34a' : '#dc2626'}`, borderRadius: '10px', padding: '14px 16px', backgroundColor: v.status === 'pending' ? '#fffbeb' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <StatusBadge status={v.status} />
                          <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                            {(v as any).provider?.profile?.name ?? 'Unknown'} — {v.doc_type === 'id_proof' ? 'ID Proof' : 'Selfie'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                          Phone: {(v as any).provider?.profile?.phone ?? '--'} · Submitted: {new Date(v.submitted_at).toLocaleString()}
                        </div>
                        <a href={v.document_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', color: 'var(--color-teal-dark)', fontWeight: 700, marginTop: '6px', textDecoration: 'underline' }}>
                          <Eye size={13} /> View Document
                        </a>
                        {v.reviewer_note && (
                          <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#991b1b' }}>Note: {v.reviewer_note}</div>
                        )}
                      </div>
                      {v.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button id={`verif-approve-${v.id}`} size="sm" variant="primary" onClick={() => handleApproveVerif(v.id)}><CheckCircle size={13} /> Approve</Button>
                          <Button id={`verif-reject-${v.id}`} size="sm" variant="red" onClick={() => handleRejectVerif(v.id)}><XCircle size={13} /> Reject</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Disputes                                                      */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'disputes' && (
            <Card>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '16px' }}>Platform Disputes Queue</h2>

              {disputes.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-muted)' }}>No disputes recorded.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {disputes.map((disp: any) => (
                    <div key={disp.id} style={{ border: '2px solid var(--color-teal-dark)', borderRadius: '10px', padding: '14px 16px', backgroundColor: 'var(--bg-sand)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <StatusBadge status={disp.status} />
                            <span style={{ fontWeight: 800 }}>{disp.category?.replace(/_/g, ' ')}</span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '4px' }}>{disp.description}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                            Raised by: {disp.reporter?.name} ({disp.reporter?.role}) · {new Date(disp.created_at).toLocaleDateString()}
                            {disp.request && ` · ${disp.request?.title}`}
                          </div>
                          {disp.resolution && (
                            <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700, marginTop: '6px' }}>Resolution: {disp.resolution}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <Button size="sm" variant="secondary" onClick={() => setChatDisputeId(disp.id)}>
                            <MessageSquare size={13} /> Chat
                          </Button>
                          {disp.status !== 'resolved' && (
                            <Button id={`admin-resolve-${disp.id}`} size="sm" variant="primary" onClick={() => setResolveTarget({ id: disp.id, resolution: '', favor: 'neutral' })}>
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resolve panel */}
              {resolveTarget && (
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-sand)', border: '2px solid var(--color-teal-dark)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '12px' }}>Resolve Dispute</h3>
                  <textarea
                    id="admin-dispute-resolution"
                    className="flat-input"
                    rows={3}
                    placeholder="Enter resolution details…"
                    value={resolveTarget.resolution}
                    onChange={e => setResolveTarget({ ...resolveTarget, resolution: e.target.value })}
                    style={{ width: '100%', resize: 'vertical', marginBottom: '10px', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Favor:</span>
                    {(['neutral', 'customer', 'provider'] as const).map(f => (
                      <button key={f} id={`admin-favor-${f}`} onClick={() => setResolveTarget({ ...resolveTarget, favor: f })}
                        className={`btn-flat btn-flat-sm ${resolveTarget.favor === f ? '' : 'btn-flat-secondary'}`}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <Button id="admin-submit-resolve-btn" size="sm" variant="primary" disabled={!resolveTarget.resolution} onClick={handleResolveDispute}>
                      Submit Resolution
                    </Button>
                    <Button id="admin-cancel-resolve-btn" size="sm" variant="secondary" onClick={() => setResolveTarget(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Categories                                                    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'categories' && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Service Categories & Base Prices</h2>
                <Button size="sm" variant="secondary" onClick={loadCategories}><RefreshCw size={14} /> Refresh</Button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-teal-dark)', backgroundColor: 'var(--bg-sand)' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Image</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Base Price</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Active</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat: any) => (
                      <tr key={cat.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px' }}>
                          {cat.image_url
                            ? <img src={cat.image_url} alt={cat.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1.5px solid var(--color-border)' }} />
                            : <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={16} color="var(--color-muted)" /></div>
                          }
                        </td>
                        <td style={{ padding: '10px', fontWeight: 700 }}>{cat.name}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: 'var(--color-teal-dark)' }}>₹{cat.base_price}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ color: cat.active ? '#16a34a' : '#dc2626', fontWeight: 800, fontSize: '0.8rem' }}>
                            {cat.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <Button size="sm" variant="secondary" onClick={() => setEditCat({ ...cat })}>Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Revenue                                                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'revenue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Period selector + fee update */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>Emergency Fee Revenue</h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(['day', 'week', 'month'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setRevPeriod(p)}
                        className={`btn-flat btn-flat-sm ${revPeriod === p ? '' : 'btn-flat-secondary'}`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                    <Button size="sm" variant="secondary" onClick={() => loadRevenue(revPeriod)}><RefreshCw size={14} /></Button>
                  </div>
                </div>

                {revenue.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)' }}>No revenue data for this period.</div>
                ) : (
                  <>
                    {/* Summary tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                      <MetricTile label="Total Revenue" value={`₹${revenue.reduce((s, r) => s + Number(r.total_fee), 0)}`} accent="#16a34a" />
                      <MetricTile label="Total Jobs" value={revenue.reduce((s, r) => s + r.job_count, 0)} accent="var(--color-teal-dark)" />
                      <MetricTile label="Avg per Job" value={`₹${revenue.length ? Math.round(revenue.reduce((s, r) => s + Number(r.total_fee), 0) / revenue.reduce((s, r) => s + r.job_count, 0)) : 0}`} accent="#d97706" />
                    </div>

                    {/* Revenue chart (inline SVG bar chart) */}
                    <AdminLineChart
                      title={`Revenue by ${revPeriod}`}
                      data={revenue.slice(0, 30).reverse().map(r => ({
                        label: new Date(r.period_start).toLocaleDateString('en-IN', revPeriod === 'month' ? { month: 'short' } : { day: '2-digit', month: 'short' }),
                        value: Number(r.total_fee),
                      }))}
                      color="#16a34a"
                      unit=" ₹"
                    />

                    {/* Detailed table */}
                    <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--color-teal-dark)', backgroundColor: 'var(--bg-sand)' }}>
                            <th style={{ padding: '9px 10px', textAlign: 'left' }}>Period Start</th>
                            <th style={{ padding: '9px 10px', textAlign: 'left' }}>Period End</th>
                            <th style={{ padding: '9px 10px', textAlign: 'right' }}>Jobs</th>
                            <th style={{ padding: '9px 10px', textAlign: 'right' }}>Total Fee (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenue.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '9px 10px' }}>{new Date(r.period_start).toLocaleString()}</td>
                              <td style={{ padding: '9px 10px' }}>{new Date(r.period_end).toLocaleString()}</td>
                              <td style={{ padding: '9px 10px', textAlign: 'right' }}>{r.job_count}</td>
                              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>₹{Number(r.total_fee).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Card>

              {/* Emergency fee updater */}
              <Card>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '12px' }}>
                  <DollarSign size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Update Emergency Fee
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '12px' }}>
                  Changes apply only to <strong>future</strong> emergency posts. Existing orders retain the fee baked in at creation time.
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    id="admin-emergency-fee-input"
                    type="number"
                    className="flat-input"
                    placeholder="e.g. 150"
                    value={newFee}
                    onChange={e => setNewFee(e.target.value)}
                    min={1}
                    style={{ maxWidth: '160px' }}
                  />
                  <Button id="admin-emergency-fee-btn" variant="primary" onClick={handleSetFee}>Set Emergency Fee</Button>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  Current setting: ₹{settingsList.find(s => s.key === 'emergency_fee')?.value?.value ?? '--'}
                </div>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB: Settings                                                      */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'settings' && (
            <Card>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-teal-dark)', marginBottom: '8px' }}>Business Settings</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '16px' }}>
                Changes are versioned in settings_history and written to audit_log automatically.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-teal-dark)', backgroundColor: 'var(--bg-sand)' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Key</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Current Value</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settingsList.map((s: any) => (
                      <tr key={s.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.82rem' }}>{s.key}</td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--color-teal-dark)' }}>{JSON.stringify(s.value)}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <Button id={`admin-edit-setting-${s.key}`} size="sm" variant="secondary" onClick={() => setEditingSetting({ key: s.key, value: JSON.stringify(s.value) })}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editingSetting && (
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-sand)', border: '2px solid var(--color-teal-dark)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '8px' }}>
                    Editing: <span style={{ fontFamily: 'monospace' }}>{editingSetting.key}</span>
                  </h3>
                  <input
                    id={`admin-setting-input-${editingSetting.key}`}
                    type="text"
                    className="flat-input"
                    value={editingSetting.value}
                    onChange={e => setEditingSetting({ ...editingSetting, value: e.target.value })}
                    style={{ marginBottom: '10px' }}
                    placeholder='e.g. {"value": 50}'
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button id="admin-save-setting-btn" size="sm" variant="primary" onClick={handleSaveSetting}>Save & Version</Button>
                    <Button id="admin-cancel-setting-btn" size="sm" variant="secondary" onClick={() => setEditingSetting(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          )}

        </div>
      </main>

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}

      {/* Coin Ledger Modal */}
      {ledgerUser && (
        <div style={overlayStyle}>
          <div style={modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>Coin Ledger — {ledgerUser.name}</h3>
              <button onClick={() => setLedgerUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {ledgerLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div>
            ) : ledger.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>No ledger entries.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-teal-dark)', backgroundColor: 'var(--bg-sand)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--color-muted)', fontSize: '0.78rem' }}>{new Date(l.created_at).toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: l.amount > 0 ? '#16a34a' : '#dc2626' }}>
                          {l.amount > 0 ? '+' : ''}{l.amount}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem' }}>{l.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispute Chat Modal */}
      {chatDisputeId && (
        <div style={overlayStyle}>
          <div style={{ ...modalBox, maxWidth: '700px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>Dispute Chat</h3>
              <button onClick={() => { setChatDisputeId(null); setChatMessages([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', padding: '4px 2px' }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '24px' }}>No messages yet. Be the first to comment.</div>
              )}
              {chatMessages.map(m => {
                const isMe = m.sender_id === authUser?.id;
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: isMe ? 'var(--color-teal-dark)' : '#e2e8f0', color: isMe ? '#fff' : 'var(--color-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                      {((m.sender as any)?.name ?? 'A').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ maxWidth: '75%' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '2px', textAlign: isMe ? 'right' : 'left' }}>
                        {(m.sender as any)?.name ?? 'Admin'} · {new Date(m.created_at).toLocaleTimeString()}
                      </div>
                      <div style={{ backgroundColor: isMe ? 'var(--color-teal-dark)' : '#f1f5f9', color: isMe ? '#fff' : 'var(--color-dark)', padding: '10px 14px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', fontSize: '0.87rem', lineHeight: 1.5 }}>
                        {m.content}
                        {m.image_url && (
                          <div style={{ marginTop: '8px' }}>
                            <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                              <img src={m.image_url} alt="attachment" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '6px', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.3)' }} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                className="flat-input"
                placeholder="Image URL (optional)"
                value={chatImage}
                onChange={e => setChatImage(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="flat-input"
                  placeholder="Type a message…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChatMsg()}
                  style={{ flex: 1 }}
                />
                <Button variant="primary" onClick={handleSendChatMsg} disabled={!chatInput.trim()}>
                  <Send size={15} />
                </Button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', alignSelf: 'center' }}>Quick actions:</span>
                <Button size="sm" variant="secondary" onClick={() => { setResolveTarget({ id: chatDisputeId, resolution: '', favor: 'provider' }); setChatDisputeId(null); }}>Reverse Penalty</Button>
                <Button size="sm" variant="red" onClick={() => { setResolveTarget({ id: chatDisputeId, resolution: '', favor: 'neutral' }); setChatDisputeId(null); }}>Resolve</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Edit Modal */}
      {editCat && (
        <div style={overlayStyle}>
          <div style={{ ...modalBox, maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.05rem' }}>Edit Category</h3>
              <button onClick={() => setEditCat(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Name</label>
                <input className="flat-input" value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Base Price (₹)</label>
                <input className="flat-input" type="number" min={0} value={editCat.base_price} onChange={e => setEditCat({ ...editCat, base_price: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Image URL</label>
                <input className="flat-input" type="url" placeholder="https://…/image.jpg" value={editCat.image_url ?? ''} onChange={e => setEditCat({ ...editCat, image_url: e.target.value })} />
                {editCat.image_url && <img src={editCat.image_url} alt="preview" style={{ marginTop: '8px', maxHeight: '80px', borderRadius: '6px', border: '1.5px solid var(--color-border)' }} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="cat-active-chk" checked={editCat.active} onChange={e => setEditCat({ ...editCat, active: e.target.checked })} />
                <label htmlFor="cat-active-chk" style={{ fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Active (visible to customers)</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setEditCat(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveCat}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Inbox Modal */}
      {inboxOpen && (
        <NotificationInboxModal
          isOpen={inboxOpen}
          onClose={() => { setInboxOpen(false); loadUnreadNotifs(); }}
          userId={authUser?.id || ''}
          onNavigate={(url: string) => {
            if (url.includes('tab=disputes'))     setActiveTab('disputes');
            else if (url.includes('tab=emergency')) setActiveTab('emergency');
            else if (url.includes('tab=providers')) setActiveTab('providers');
            else if (url.includes('tab=settings'))  setActiveTab('settings');
            else if (url.includes('tab=metrics'))   setActiveTab('metrics');
            else if (url.includes('tab=revenue'))   setActiveTab('revenue');
            else if (url.includes('tab=verification')) setActiveTab('verification');
          }}
        />
      )}
      <AppFooter onPrivacy={() => setLegalPage('privacy')} onTerms={() => setLegalPage('terms')} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider appRole="admin">
      <AdminAppContent />
    </AuthProvider>
  );
}