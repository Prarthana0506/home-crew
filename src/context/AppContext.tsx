import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Category, ServiceRequest } from '../types';

interface AppContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  users: User[];
  categories: Category[];
  requests: ServiceRequest[];
  loading: boolean;
  activeRole: 'customer' | 'provider' | 'admin';
  activeChatRequestId: string | null;
  compulsoryReviewRequestId: string | null;
  loginUser: (email: string, password?: string) => Promise<any>;
  signupUser: (userData: any) => Promise<any>;
  logout: () => void;
  switchRole: (role: 'customer' | 'provider' | 'admin', userId?: string) => void;
  fetchRequests: () => Promise<void>;
  createServiceRequest: (data: any) => Promise<any>;
  respondBid: (requestId: string, response: string, bid_amount?: number, bid_note?: string) => Promise<any>;
  acceptBid: (requestId: string, provider_id: string, accepted_price: number) => Promise<any>;
  bookOrdinaryWorkOrder: (requestId: string) => Promise<any>;
  completeWorkOrder: (requestId: string) => Promise<any>;
  submitReview: (requestId: string, stars: number, feedback: string) => Promise<any>;
  openChat: (requestId: string) => void;
  closeChat: () => void;
  sendChatMessage: (requestId: string, message: string, attachment_url?: string) => Promise<any>;
  triggerAdminBidding: (requestId: string) => Promise<any>;
  currentView: 'main' | 'privacy' | 'terms';
  navigateToView: (view: 'main' | 'privacy' | 'terms') => void;
  openCompulsoryReview: (requestId: string) => void;
  closeCompulsoryReview: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const API_BASE = 'http://localhost:3001/api';

const safeFetchJson = async (url: string, options?: RequestInit) => {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new Error('Network error: Could not connect to backend server.');
  }

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msg = data?.error || (contentType.includes('html') ? `Server error (${res.status}). Please try again.` : `Request failed (${res.status})`);
    throw new Error(msg);
  }

  return data;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<'customer' | 'provider' | 'admin'>('customer');
  const [loading, setLoading] = useState(true);

  const [activeChatRequestId, setActiveChatRequestId] = useState<string | null>(null);
  const [compulsoryReviewRequestId, setCompulsoryReviewRequestId] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'main' | 'privacy' | 'terms'>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '';
    if (hash.includes('privacy')) return 'privacy';
    if (hash.includes('terms')) return 'terms';
    return 'main';
  });

  const navigateToView = (view: 'main' | 'privacy' | 'terms') => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      if (view === 'privacy') window.location.hash = '/privacy';
      else if (view === 'terms') window.location.hash = '/terms';
      else if (window.location.hash.includes('privacy') || window.location.hash.includes('terms')) {
        window.location.hash = '';
      }
    }
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('privacy')) setCurrentView('privacy');
      else if (hash.includes('terms')) setCurrentView('terms');
      else setCurrentView('main');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Fetch initial data
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [catData, userData] = await Promise.all([
        safeFetchJson(`${API_BASE}/categories`),
        safeFetchJson(`${API_BASE}/users`)
      ]);

      if (catData) setCategories(catData);
      if (userData) setUsers(userData);

      // Auto login saved session
      const savedUser = localStorage.getItem('urbanclap_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          const freshUser = userData?.find((u: any) => u.id === parsed.id) || parsed;
          setCurrentUser(freshUser);
          const initialRole = freshUser.role === 'provider' ? 'provider' : (freshUser.role === 'admin' ? 'admin' : 'customer');
          setActiveRole(initialRole);
          setIsAuthenticated(true);
        } catch {
          localStorage.removeItem('urbanclap_user');
        }
      }
    } catch (err) {
      console.warn('Backend server connecting...', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const data = await safeFetchJson(`${API_BASE}/requests`);
      if (data) setRequests(data);
    } catch (err) {
      console.warn('Failed to fetch requests', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    fetchRequests();
    const interval = setInterval(fetchRequests, 3000); // Poll for live bidding/chats updates
    return () => clearInterval(interval);
  }, []);

  const loginUser = async (email: string, password?: string) => {
    const data = await safeFetchJson(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    setCurrentUser(data.user);
    const initialRole = data.user.role === 'provider' ? 'provider' : (data.user.role === 'admin' ? 'admin' : 'customer');
    setActiveRole(initialRole);
    setIsAuthenticated(true);
    localStorage.setItem('urbanclap_user', JSON.stringify(data.user));
    return data.user;
  };

  const signupUser = async (userData: any) => {
    const data = await safeFetchJson(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    setCurrentUser(data.user);
    const initialRole = data.user.role === 'provider' ? 'provider' : (data.user.role === 'admin' ? 'admin' : 'customer');
    setActiveRole(initialRole);
    setIsAuthenticated(true);
    localStorage.setItem('urbanclap_user', JSON.stringify(data.user));

    // Refresh users list
    try {
      const updatedUsers = await safeFetchJson(`${API_BASE}/users`);
      if (updatedUsers) setUsers(updatedUsers);
    } catch {}

    return data.user;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('urbanclap_user');
  };

  const switchRole = (role: 'customer' | 'provider' | 'admin', _userId?: string) => {
    // Single-role accounts ('customer' or 'provider') can never switch roles
    if (currentUser?.role !== 'both' && currentUser?.role !== 'admin') {
      console.warn('Role switching is disabled for single-role accounts.');
      return;
    }
    setActiveRole(role);
  };


  const createServiceRequest = async (formData: any) => {
    const payload = {
      ...formData,
      customer_id: currentUser?.id || 'cust_1',
      customer_name: currentUser?.name || 'Aarav Sharma'
    };

    const data = await safeFetchJson(`${API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    await fetchRequests();
    return data;
  };

  const respondBid = async (requestId: string, response: string, bid_amount?: number, bid_note?: string) => {
    if (!currentUser) return;
    const data = await safeFetchJson(`${API_BASE}/requests/${requestId}/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_id: currentUser.id,
        response,
        bid_amount,
        bid_note
      })
    });

    await fetchRequests();
    return data;
  };

  const acceptBid = async (requestId: string, provider_id: string, accepted_price: number) => {
    const data = await safeFetchJson(`${API_BASE}/requests/${requestId}/accept-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id, accepted_price })
    });

    await fetchRequests();
    return data;
  };

  const bookOrdinaryWorkOrder = async (requestId: string) => {
    if (!currentUser) return;
    const data = await safeFetchJson(`${API_BASE}/requests/${requestId}/book-ordinary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id: currentUser.id })
    });

    await fetchRequests();
    return data;
  };

  const completeWorkOrder = async (requestId: string) => {
    const data = await safeFetchJson(`${API_BASE}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    await fetchRequests();
    setCompulsoryReviewRequestId(requestId);
    return data;
  };

  const submitReview = async (requestId: string, stars: number, feedback: string) => {
    const data = await safeFetchJson(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, stars, feedback })
    });

    await loadInitialData();
    await fetchRequests();
    setCompulsoryReviewRequestId(null);
    return data;
  };

  const openChat = (requestId: string) => {
    setActiveChatRequestId(requestId);
  };

  const closeChat = () => {
    setActiveChatRequestId(null);
  };

  const sendChatMessage = async (requestId: string, message: string, attachment_url?: string) => {
    if (!currentUser) return;
    const data = await safeFetchJson(`${API_BASE}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        sender_role: currentUser.role,
        message,
        attachment_url
      })
    });

    return data;
  };

  const triggerAdminBidding = async (requestId: string) => {
    const data = await safeFetchJson(`${API_BASE}/admin/trigger-bidding/${requestId}`, {
      method: 'POST'
    });

    await fetchRequests();
    return data;
  };

  const openCompulsoryReview = (requestId: string) => {
    setCompulsoryReviewRequestId(requestId);
  };

  const closeCompulsoryReview = () => {
    setCompulsoryReviewRequestId(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        users,
        categories,
        requests,
        loading,
        activeRole,
        activeChatRequestId,
        compulsoryReviewRequestId,
        loginUser,
        signupUser,
        logout,
        switchRole,
        fetchRequests,
        createServiceRequest,
        respondBid,
        acceptBid,
        bookOrdinaryWorkOrder,
        completeWorkOrder,
        submitReview,
        openChat,
        closeChat,
        sendChatMessage,
        triggerAdminBidding,
        currentView,
        navigateToView,
        openCompulsoryReview,
        closeCompulsoryReview
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
