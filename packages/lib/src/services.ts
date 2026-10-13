import { supabase } from './supabase';
import type {
  ServiceCategory,
  Area,
  ServiceRequest,
  Bid,
  ChatMessage,
  CoinLedgerEntry,
  PendingReviewInfo,
  CreateRequestResult
} from './types';

// 1. Fetch Categories
export async function fetchCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .eq('active', true)
    .order('base_price', { ascending: true });

  if (error) {
    console.warn('Error loading categories from Supabase:', error);
    return [];
  }
  return data || [];
}

// 2. Fetch Coimbatore Areas
export async function fetchAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('id, name, pincode, latitude, longitude')
    .order('name', { ascending: true });

  if (error) {
    console.warn('Error loading areas from Supabase:', error);
    return [];
  }
  return data || [];
}

// 3. Fetch Service Requests
export async function fetchServiceRequests(filters?: {
  customerId?: string;
  providerProfileId?: string;
  status?: string;
  type?: 'ordinary' | 'emergency';
}): Promise<ServiceRequest[]> {
  let query = supabase
    .from('service_requests')
    .select(`
      *,
      category:service_categories(*),
      area:areas(*),
      customer:profiles!service_requests_customer_id_fkey(*),
      assigned_provider:provider_profiles_with_coins!service_requests_assigned_provider_profile_id_fkey(*),
      bids:bids(*),
      bookings:bookings(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Error fetching service requests:', error);
    return [];
  }
  return data || [];
}

// 4. Create Service Request
export async function createServiceRequest(params: {
  customerId: string;
  type: 'ordinary' | 'emergency';
  categoryId: string;
  areaId: string;
  title: string;
  description: string;
  offeredPrice: number;
  minPrice: number;
  preferredStart: string;
  providerPreference?: 'freelancer' | 'organization' | 'either';
  images?: string[];
  addressConfidential?: string;
}): Promise<ServiceRequest> {
  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      customer_id: params.customerId,
      type: params.type,
      category_id: params.categoryId,
      area_id: params.areaId,
      title: params.title,
      description: params.description,
      offered_price: params.offeredPrice,
      min_price: params.minPrice,
      preferred_start: params.preferredStart,
      estimated_duration_hours: 2.0,
      status: params.type === 'emergency' ? 'bidding_active' : 'pending',
      provider_preference: params.providerPreference || 'either',
      images: params.images || [],
      address_confidential: params.addressConfidential || null
    })
    .select('*, category:service_categories(*), area:areas(*)')
    .single();

  if (error) throw error;
  return data;
}

// 5. Submit Emergency Bid
export async function submitEmergencyBid(params: {
  requestId: string;
  providerProfileId: string;
  coins: number;
  note?: string;
}): Promise<Bid> {
  const { data, error } = await supabase
    .from('bids')
    .insert({
      request_id: params.requestId,
      provider_profile_id: params.providerProfileId,
      coins: params.coins,
      status: 'active',
      note: params.note || null
    })
    .select('*, provider:provider_profiles_with_coins(*)')
    .single();

  if (error) throw error;
  return data;
}

// 6. Record Emergency Interest
export async function recordEmergencyInterest(
  requestId: string,
  providerProfileId: string,
  status: 'interested' | 'not_interested'
) {
  const { error } = await supabase
    .from('bid_interests')
    .upsert({
      request_id: requestId,
      provider_profile_id: providerProfileId,
      status
    }, { onConflict: 'request_id,provider_profile_id' });

  if (error) throw error;
}

// 7. Accept Bid / Work Order
export async function acceptBid(
  requestId: string,
  providerProfileId: string,
  startTime: string,
  endTime: string
) {
  // Update request status
  const { error: reqError } = await supabase
    .from('service_requests')
    .update({
      status: 'assigned',
      assigned_provider_profile_id: providerProfileId,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (reqError) throw reqError;

  // Create booking with tstzrange
  const timeRange = `[${startTime},${endTime})`;
  const { error: bookError } = await supabase
    .from('bookings')
    .insert({
      request_id: requestId,
      provider_profile_id: providerProfileId,
      time_range: timeRange,
      status: 'confirmed'
    });

  if (bookError) throw bookError;
}

// 8. Complete Work Order
export async function completeWorkOrder(requestId: string, providerProfileId?: string) {
  const { error } = await supabase
    .from('service_requests')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (error) throw error;

  // Reward provider with completion coins if providerProfileId provided
  if (providerProfileId) {
    await supabase.from('coin_ledger').insert({
      provider_profile_id: providerProfileId,
      amount: 20,
      reason: 'Standard job completion reward',
      request_id: requestId
    });
  }
}

// 9. Legacy Submit Review (for legacy request-based reviews)
export async function legacySubmitReview(params: {
  requestId: string;
  reviewerId: string;
  revieweeId?: string;
  direction: 'customer_to_provider' | 'provider_to_customer';
  rating: number;
  feedback?: string;
}) {
  let targetReviewee = params.revieweeId;
  if (!targetReviewee) {
    const { data: req } = await supabase
      .from('service_requests')
      .select('customer_id, assigned_provider:provider_profiles(user_id)')
      .eq('id', params.requestId)
      .single();

    if (req) {
      if (params.direction === 'customer_to_provider') {
        targetReviewee = (req.assigned_provider as any)?.user_id || req.customer_id;
      } else {
        targetReviewee = req.customer_id;
      }
    }
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      request_id: params.requestId,
      reviewer_id: params.reviewerId,
      reviewee_id: targetReviewee,
      direction: params.direction,
      rating: params.rating,
      feedback: params.feedback || null,
      revealed: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 10. Chat Messages
export async function fetchMessages(requestId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Error fetching messages:', error);
    return [];
  }
  return data || [];
}

export async function sendMessage(params: {
  requestId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'system' | 'time_proposal' | 'address_share';
  payload?: any;
}): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      request_id: params.requestId,
      sender_id: params.senderId,
      content: params.content,
      message_type: params.messageType || 'text',
      payload: params.payload || {}
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 11. Coin Ledger and Balance
export async function fetchCoinLedger(providerProfileId: string): Promise<CoinLedgerEntry[]> {
  const { data, error } = await supabase
    .from('coin_ledger')
    .select('*')
    .eq('provider_profile_id', providerProfileId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching coin ledger:', error);
    return [];
  }
  return data || [];
}

// 12. Technicians for Organization (enriched dashboard view)
export async function fetchTechnicians(organizationId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('org_technician_dashboard')
    .select('*')
    .eq('organization_id', organizationId)
    .order('provider_status', { ascending: true });

  if (error) {
    // Fallback to plain provider_profiles if view unavailable
    console.warn('org_technician_dashboard view error, falling back:', error.message);
    const { data: fallback } = await supabase
      .from('provider_profiles')
      .select('*, profile:profiles(*)')
      .eq('organization_id', organizationId)
      .eq('provider_type', 'technician');
    return fallback || [];
  }
  return data || [];
}

// 12a. Fetch Organization Rating
export async function fetchOrganizationRating(organizationId: string): Promise<{
  active_technician_count: number;
  rating_avg: number;
  total_reviews: number;
  total_active_coins: number;
} | null> {
  const { data, error } = await supabase
    .from('organization_rating')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) { console.warn('fetchOrganizationRating:', error.message); return null; }
  return data;
}

// ============================================================================
// ORGANIZATION MANAGEMENT RPCs
// ============================================================================

// 12b. Add a technician to an organization
export async function orgAddTechnician(params: {
  organizationId: string;
  name: string;
  phone: string;
  skills?: string[];
  categories?: string[];
  experience?: number;
  workingHours?: { start: string; end: string };
  photoUrl?: string;
  idProofUrl?: string;
}): Promise<{
  success: boolean;
  provider_profile_id?: string;
  profile_id?: string;
  verified_id_hash?: string;
  had_prior_record?: boolean;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('org_add_technician', {
    p_organization_id: params.organizationId,
    p_name: params.name,
    p_phone: params.phone,
    p_skills: params.skills ?? [],
    p_categories: params.categories ?? [],
    p_experience: params.experience ?? 0,
    p_working_hours: params.workingHours
      ? JSON.stringify(params.workingHours)
      : '{"start":"08:00:00","end":"19:00:00"}',
    p_photo_url: params.photoUrl ?? null,
    p_id_proof_url: params.idProofUrl ?? null,
  });
  if (error) return { success: false, error: error.message };
  return data as any;
}

// 12c. Approve a technician (set admin_approved = true, status = active)
export async function orgApproveTechnician(
  providerProfileId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('org_approve_technician', {
    p_provider_profile_id: providerProfileId,
  });
  if (error) return { success: false, error: error.message };
  return data as any;
}

// 12d. Remove (archive) a technician
export async function orgRemoveTechnician(
  providerProfileId: string
): Promise<{
  success: boolean;
  warning?: string;
  upcoming_job_count?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('org_remove_technician', {
    p_provider_profile_id: providerProfileId,
  });
  if (error) return { success: false, error: error.message };
  return data as any;
}

// 12e. Reassign a booking to a different technician (pre-start only)
export async function orgReassignTechnician(params: {
  bookingId: string;
  newProviderProfileId: string;
}): Promise<{
  success: boolean;
  old_provider_profile_id?: string;
  new_provider_profile_id?: string;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('org_reassign_technician', {
    p_booking_id: params.bookingId,
    p_new_provider_profile_id: params.newProviderProfileId,
  });
  if (error) return { success: false, error: error.message };
  return data as any;
}

// 12f. Check bid eligibility of a specific technician (with optional clash check)
export async function orgCheckTechnicianEligibility(
  providerProfileId: string,
  requestId?: string
): Promise<{
  eligible: boolean;
  available_coins: number;
  rating_avg: number;
  review_count: number;
  banned_until?: string;
  status: string;
  admin_approved: boolean;
  calendar_clash: boolean;
  reasons: string[];
  error?: string;
}> {
  const { data, error } = await supabase.rpc('org_check_technician_eligibility', {
    p_provider_profile_id: providerProfileId,
    p_request_id: requestId ?? null,
  });
  if (error) return {
    eligible: false,
    available_coins: 0,
    rating_avg: 0,
    review_count: 0,
    status: 'unknown',
    admin_approved: false,
    calendar_clash: false,
    reasons: [error.message],
  };
  return data as any;
}

// 12g. Owner picks a technician for emergency bidding (coins locked, bid placed as that technician)
export async function orgPickTechnicianForEmergency(params: {
  requestId: string;
  technicianProfileId: string;
  coins: number;
}): Promise<{
  success: boolean;
  bid_id?: string;
  coins?: number;
  error?: string;
  reasons?: string[];
}> {
  const { data, error } = await supabase.rpc('org_owner_pick_technician_for_emergency', {
    p_request_id: params.requestId,
    p_technician_profile_id: params.technicianProfileId,
    p_coins: params.coins,
  });
  if (error) return { success: false, error: error.message };
  return data as any;
}

// 13. Fetch Platform Settings
export async function fetchSettings(): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value');

  const map: Record<string, any> = {
    emergency_multiplier: 1.3,
    emergency_fee: 50.0,
    emergency_min_lead_hours: 2.0
  };

  if (error) {
    console.warn('Error loading settings from Supabase, using defaults:', error);
    return map;
  }

  for (const row of data || []) {
    if (row.value && typeof row.value === 'object' && 'value' in row.value) {
      map[row.key] = row.value.value;
    } else {
      map[row.key] = row.value;
    }
  }
  return map;
}

// 14. Check Customer Pending Review (Review Gate)
export async function fetchPendingReview(customerId: string): Promise<PendingReviewInfo | null> {
  const { data, error } = await supabase.rpc('get_customer_pending_review', {
    p_customer_id: customerId
  });

  if (error) {
    console.warn('Error fetching pending review:', error);
    return null;
  }

  if (data && Array.isArray(data) && data.length > 0) {
    return data[0] as PendingReviewInfo;
  }
  return null;
}

// 15. Record Emergency Fee Payment (Paid or Waived)
export async function recordEmergencyFeePayment(params: {
  customerId: string;
  amount: number;
  status: 'paid' | 'waived';
  paymentMethod?: string;
  transactionRef?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('record_emergency_fee_payment', {
    p_customer_id: params.customerId,
    p_amount: params.amount,
    p_status: params.status,
    p_payment_method: params.paymentMethod || 'UPI',
    p_transaction_ref: params.transactionRef || null
  });

  if (error) {
    throw new Error(error.message || 'Failed to record emergency fee payment');
  }

  return data as string;
}

// 16. Atomic Create Request Function with Full Postgres Validation
export async function createRequestAtomic(params: {
  customerId: string;
  type: 'ordinary' | 'emergency';
  categoryId: string;
  areaId: string;
  title: string;
  description: string;
  offeredPrice: number;
  preferredStart: string;
  images?: string[];
  providerPreference?: 'freelancer' | 'organization' | 'either';
  addressConfidential?: string;
  feePaymentId?: string | null;
}): Promise<CreateRequestResult> {
  const { data, error } = await supabase.rpc('create_request', {
    p_customer_id: params.customerId,
    p_type: params.type,
    p_category_id: params.categoryId,
    p_area_id: params.areaId,
    p_title: params.title,
    p_description: params.description,
    p_offered_price: params.offeredPrice,
    p_preferred_start: params.preferredStart,
    p_images: params.images || [],
    p_provider_preference: params.providerPreference || 'either',
    p_address_confidential: params.addressConfidential || null,
    p_fee_payment_id: params.feePaymentId || null
  });

  if (error) {
    throw new Error(error.message || 'Failed to create request');
  }

  return data as CreateRequestResult;
}

// 17. Client Image Compression and EXIF Stripping via Canvas
export async function compressAndStripExif(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<{ blob: Blob; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({ blob: file, previewUrl: '' });
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          maxHeight = height;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      // Drawing into HTML5 canvas drops all EXIF camera/location tags
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create compressed image blob'));
            return;
          }
          const previewUrl = URL.createObjectURL(blob);
          resolve({ blob, previewUrl });
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to parse image file'));
    };

    img.src = objectUrl;
  });
}

// 18. Upload Service Image to Supabase Storage
export async function uploadServiceImage(blob: Blob, filename?: string): Promise<string> {
  const ext = 'webp';
  const name = filename || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
  const filePath = `requests/${name}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('service-images')
      .upload(filePath, blob, {
        contentType: 'image/webp',
        upsert: true
      });

    if (uploadError) {
      console.warn('Storage upload error, falling back to data URL:', uploadError.message);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from('service-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('Storage upload exception, falling back to data URL:', err);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
}

// 19. Fetch Provider Ordinary Job Feed (13km radius, preference match, 8h gap fit)
export async function fetchProviderOrdinaryFeed(providerUserId: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_provider_ordinary_feed', {
    p_provider_user_id: providerUserId
  });

  if (error) {
    console.warn('Error fetching provider ordinary feed via RPC, falling back:', error.message);
    // Fallback query if RPC unavailable
    const { data: fallbackData } = await supabase
      .from('service_requests')
      .select(`
        *,
        category:service_categories(*),
        area:areas(*),
        customer:profiles!service_requests_customer_id_fkey(*)
      `)
      .eq('type', 'ordinary')
      .in('status', ['open', 'pending'])
      .is('assigned_provider_profile_id', null)
      .order('preferred_start', { ascending: true });

    return fallbackData || [];
  }

  return data || [];
}

// 20. Atomic Accept Ordinary Job (Handles race conditions with "already taken" response)
export async function acceptOrdinaryJob(
  requestId: string,
  providerUserId?: string
): Promise<{ success: boolean; error?: string; request_id?: string; hold_hours?: number }> {
  const { data, error } = await supabase.rpc('accept_ordinary', {
    p_request_id: requestId,
    p_provider_user_id: providerUserId
  });

  if (error) {
    throw new Error(error.message || 'Failed to accept job');
  }

  return data as { success: boolean; error?: string; request_id?: string; hold_hours?: number };
}

// 21. Confirm Booking Time (Writes confirmed tstzrange booking row)
export async function confirmBookingTime(params: {
  requestId: string;
  confirmedStart: string;
  durationHours?: number;
  confirmedBy?: string;
}): Promise<{ success: boolean; request_id: string; time_range: string }> {
  const { data, error } = await supabase.rpc('confirm_booking_time', {
    p_request_id: params.requestId,
    p_confirmed_start: params.confirmedStart,
    p_duration_hours: params.durationHours || 2.0,
    p_confirmed_by: params.confirmedBy
  });

  if (error) {
    throw new Error(error.message || 'Failed to confirm booking time');
  }

  return data as { success: boolean; request_id: string; time_range: string };
}

// 22. Fetch Provider Calendar Bookings
export async function fetchProviderBookings(providerProfileId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      request:service_requests(
        *,
        category:service_categories(*),
        area:areas(*),
        customer:profiles!service_requests_customer_id_fkey(*)
      )
    `)
    .eq('provider_profile_id', providerProfileId)
    .in('status', ['confirmed', 'in_progress', 'hold'])
    .order('time_range', { ascending: true });

  if (error) {
    console.warn('Error fetching provider bookings:', error);
    return [];
  }

  return data || [];
}

import type {
  RespondInterestResult,
  PlaceBidResult,
  CloseBiddingResult,
  PenaltyResult,
  EligibleProvider,
  BidArenaInfo
} from './types';

// ============================================================================
// EMERGENCY BIDDING ARENA - RPC SERVICE FUNCTIONS (23-34)
// ============================================================================

// 23. Respond to emergency interest (yes/no). The 10th YES triggers early bidding open.
export async function respondEmergencyInterest(
  requestId: string,
  providerUserId: string,
  interested: boolean
): Promise<RespondInterestResult> {
  const { data, error } = await supabase.rpc('respond_interest', {
    p_request_id: requestId,
    p_provider_user_id: providerUserId,
    p_interested: interested,
  });

  if (error) {
    throw new Error(error.message || 'Failed to record interest');
  }

  return data as RespondInterestResult;
}

// 24. Place coin bid atomically (server-side: balance check, min=last+1, soft-lock)
export async function placeEmergencyBid(params: {
  requestId: string;
  providerUserId: string;
  coins: number;
  note?: string;
}): Promise<PlaceBidResult> {
  const { data, error } = await supabase.rpc('place_bid', {
    p_request_id: params.requestId,
    p_provider_user_id: params.providerUserId,
    p_coins: params.coins,
    p_note: params.note ?? null,
  });

  if (error) {
    throw new Error(error.message || 'Failed to place bid');
  }

  return data as PlaceBidResult;
}

// 25. Close bidding (winner selection, coin deduction, booking write)
export async function closeBidding(requestId: string): Promise<CloseBiddingResult> {
  const { data, error } = await supabase.rpc('close_bidding', {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to close bidding');
  }

  return data as CloseBiddingResult;
}

// 26. Apply withdrawal / no-show penalty (50% coins, -0.1 rating, 3-day ban keyed by verified_id_hash)
export async function penalizeWithdrawalOrNoshow(params: {
  requestId: string;
  providerUserId: string;
  reason?: 'withdrawal' | 'no_show';
}): Promise<PenaltyResult> {
  const { data, error } = await supabase.rpc('penalize_withdrawal_or_noshow', {
    p_request_id: params.requestId,
    p_provider_user_id: params.providerUserId,
    p_reason: params.reason ?? 'withdrawal',
  });

  if (error) {
    throw new Error(error.message || 'Failed to apply penalty');
  }

  return data as PenaltyResult;
}

// 27. Get eligible emergency providers for a request at a given radius
export async function getEligibleEmergencyProviders(
  requestId: string,
  radiusKm: number = 13.0
): Promise<EligibleProvider[]> {
  const { data, error } = await supabase.rpc('get_eligible_emergency_providers', {
    p_request_id: requestId,
    p_radius_km: radiusKm,
  });

  if (error) {
    console.warn('Error fetching eligible providers:', error.message);
    return [];
  }

  return (data ?? []) as EligibleProvider[];
}

// 28. Admin RPC: Manually start bidding on a request
export async function adminStartBidding(
  requestId: string
): Promise<{ success: boolean; status?: string; closes_at?: string }> {
  const { data, error } = await supabase.rpc('admin_start_bidding', {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to start bidding');
  }

  return data as { success: boolean; status?: string; closes_at?: string };
}

// 29. Admin RPC: Cancel an active emergency bidding and cancel all bids
export async function adminCancelBidding(
  requestId: string,
  reason?: string
): Promise<{ success: boolean; status?: string; reason?: string }> {
  const { data, error } = await supabase.rpc('admin_cancel_bidding', {
    p_request_id: requestId,
    p_reason: reason ?? 'Admin cancellation',
  });

  if (error) {
    throw new Error(error.message || 'Failed to cancel bidding');
  }

  return data as { success: boolean; status?: string; reason?: string };
}

// 30. Fetch live bid arena info for a request (top bid, countdown times, radius, fallback stage)
export async function fetchBidArenaInfo(requestId: string): Promise<BidArenaInfo | null> {
  const { data, error } = await supabase
    .from('service_requests')
    .select(
      'id, title, status, top_bid_coins, top_bid_provider_profile_id, bidding_closes_at, interest_expires_at, notified_at, current_radius_km, fallback_stage, preferred_start, offered_price'
    )
    .eq('id', requestId)
    .single();

  if (error || !data) return null;

  return data as unknown as BidArenaInfo;
}

// 31. Fetch all bids for a request sorted by coins DESC
export async function fetchBidsForRequest(requestId: string) {
  const { data, error } = await supabase
    .from('bids')
    .select(`
      *,
      provider:provider_profiles!bids_provider_profile_id_fkey(
        id,
        provider_type,
        rating_avg,
        review_count,
        profile:profiles!provider_profiles_user_id_fkey(name, phone)
      )
    `)
    .eq('request_id', requestId)
    .in('status', ['active', 'outbid', 'won'])
    .order('coins', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Error fetching bids for request:', error.message);
    return [];
  }

  return data ?? [];
}

// ============================================================================
// REALTIME SUBSCRIPTION HELPERS (32-34)
// Each returns an unsubscribe function - call it on component unmount.
// ============================================================================

// 32. Subscribe to live top-bid and status changes for a specific request
export function subscribeToArenaUpdates(
  requestId: string,
  onUpdate: (payload: {
    top_bid_coins: number;
    bidding_closes_at: string | null;
    status: string;
    top_bid_provider_profile_id: string | null;
  }) => void
) {
  const channel = supabase
    .channel(`arena-updates:${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'service_requests',
        filter: `id=eq.${requestId}`,
      },
      (payload) => {
        const rec = payload.new as Record<string, unknown>;
        onUpdate({
          top_bid_coins: (rec.top_bid_coins as number) ?? 0,
          bidding_closes_at: (rec.bidding_closes_at as string | null) ?? null,
          status: rec.status as string,
          top_bid_provider_profile_id: (rec.top_bid_provider_profile_id as string | null) ?? null,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// 33. Subscribe to new bids being placed on a request (INSERT on bids)
export function subscribeToNewBids(
  requestId: string,
  onNewBid: (bid: {
    id: string;
    provider_profile_id: string;
    coins: number;
    status: string;
    note: string | null;
    created_at: string;
  }) => void
) {
  const channel = supabase
    .channel(`new-bids:${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bids',
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => {
        const rec = payload.new as Record<string, unknown>;
        onNewBid({
          id: rec.id as string,
          provider_profile_id: rec.provider_profile_id as string,
          coins: rec.coins as number,
          status: rec.status as string,
          note: (rec.note as string | null) ?? null,
          created_at: rec.created_at as string,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// 34. Subscribe to in-app notifications for emergency events
// (emergency_broadcast, bidding_open, outbid, bid_won, offered_conversion, etc.)
export function subscribeToUserNotifications(
  userId: string,
  onNotification: (n: {
    id: string;
    title: string;
    body: string;
    type: string;
    data?: Record<string, unknown>;
  }) => void
) {
  const channel = supabase
    .channel(`user-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const rec = payload.new as Record<string, unknown>;
        onNotification({
          id: rec.id as string,
          title: rec.title as string,
          body: rec.body as string,
          type: rec.type as string,
          data: rec.data as Record<string, unknown> | undefined,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// ADMIN SERVICE FUNCTIONS (35-42)
// All functions are admin-only enforced server-side inside the RPCs.
// ============================================================================

// 35. Approve a pending provider application (grants 35 onboarding coins)
export async function adminApproveProvider(
  providerProfileId: string,
  notes?: string
): Promise<{ success: boolean; status?: string; coins_granted?: number; error?: string }> {
  const { data, error } = await supabase.rpc('admin_approve_provider', {
    p_provider_profile_id: providerProfileId,
    p_notes: notes ?? null,
  });
  if (error) throw new Error(error.message || 'Failed to approve provider');
  return data as { success: boolean; status?: string; coins_granted?: number };
}

// 36. Reject a pending provider application
export async function adminRejectProvider(
  providerProfileId: string,
  reason?: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const { data, error } = await supabase.rpc('admin_reject_provider', {
    p_provider_profile_id: providerProfileId,
    p_reason: reason ?? 'Application did not meet requirements',
  });
  if (error) throw new Error(error.message || 'Failed to reject provider');
  return data as { success: boolean; status?: string };
}

// 37. Lift a bid ban for all profiles sharing the same verified_id_hash
export async function adminLiftBidBan(
  verifiedIdHash: string,
  reason?: string
): Promise<{ success: boolean; profiles_unbanned?: number; error?: string }> {
  const { data, error } = await supabase.rpc('admin_lift_bid_ban', {
    p_verified_id_hash: verifiedIdHash,
    p_reason: reason ?? 'Admin review',
  });
  if (error) throw new Error(error.message || 'Failed to lift bid ban');
  return data as { success: boolean; profiles_unbanned?: number };
}

// 38. Resolve a platform dispute with a verdict
export async function adminResolveDispute(params: {
  disputeId: string;
  resolution: string;
  favor?: 'customer' | 'provider' | 'neutral';
}): Promise<{ success: boolean; status?: string; error?: string }> {
  const { data, error } = await supabase.rpc('admin_resolve_dispute', {
    p_dispute_id: params.disputeId,
    p_resolution: params.resolution,
    p_favor: params.favor ?? 'neutral',
  });
  if (error) throw new Error(error.message || 'Failed to resolve dispute');
  return data as { success: boolean; status?: string };
}

// 39. Fetch all aggregate platform metrics for admin dashboard
export async function adminGetMetrics(): Promise<Record<string, number | null>> {
  const { data, error } = await supabase.rpc('admin_get_metrics');
  if (error) { console.warn('admin_get_metrics error:', error.message); return {}; }
  return (data ?? {}) as Record<string, number | null>;
}

// 40. Fetch pending provider applications
export async function fetchPendingProviders() {
  const { data, error } = await supabase
    .from('provider_profiles')
    .select('*, profile:profiles!provider_profiles_user_id_fkey(id, name, phone, area_id), organization:organizations!provider_profiles_organization_id_fkey(id, name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) { console.warn('fetchPendingProviders:', error.message); return []; }
  return data ?? [];
}

// 41. Fetch disputes for admin view
export async function fetchDisputes(status?: string) {
  let query = supabase
    .from('disputes')
    .select('*, request:service_requests(id, title, type, status), reporter:profiles!disputes_raised_by_fkey(id, name, role)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) { console.warn('fetchDisputes:', error.message); return []; }
  return data ?? [];
}

// 42. Fetch all provider profiles with enriched data
export async function fetchAllProviders(statusFilter?: string) {
  let query = supabase
    .from('provider_profiles')
    .select('*, profile:profiles!provider_profiles_user_id_fkey(id, name, phone, area_id, language, avatar), organization:organizations!provider_profiles_organization_id_fkey(id, name)')
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) { console.warn('fetchAllProviders:', error.message); return []; }
  return data ?? [];
}

// ============================================================================
// COMPLETION PIPELINE SERVICE FUNCTIONS (43-52)
// ============================================================================

// 43. mark_complete - provider or customer marks job done
export async function markComplete(
  bookingId: string,
  role: 'provider' | 'customer'
): Promise<{ success: boolean; both_complete?: boolean; review_opens_at?: string; error?: string }> {
  const { data, error } = await supabase.rpc('mark_complete', {
    p_booking_id: bookingId,
    p_role: role,
  });
  if (error) throw new Error(error.message || 'Failed to mark complete');
  return data as { success: boolean; both_complete?: boolean; review_opens_at?: string };
}

// 44. submit_review - blind review (stars required, feedback optional)
export async function submitReview(params: {
  bookingId: string;
  stars: number;
  feedback?: string;
  tags?: string[];
  paidAgreedAmount?: boolean;
}): Promise<{
  success: boolean;
  reviewer_role?: string;
  both_reviewed?: boolean;
  revealed?: boolean;
  completion_coins?: number;
  bonus_coins?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_booking_id:  params.bookingId,
    p_stars:       params.stars,
    p_feedback:    params.feedback ?? null,
    p_tags:        params.tags ?? null,
    p_paid_agreed: params.paidAgreedAmount ?? null,
  });
  if (error) throw new Error(error.message || 'Failed to submit review');
  return data as { success: boolean; reviewer_role?: string; both_reviewed?: boolean; revealed?: boolean; completion_coins?: number; bonus_coins?: number };
}

// 45. claim_noshow - "Provider didn't show up"
export async function claimNoshow(bookingId: string, reason: string): Promise<{
  success: boolean;
  dispute_id?: string;
  penalty?: Record<string, unknown>;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('claim_noshow', {
    p_booking_id: bookingId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message || 'Failed to claim no-show');
  return data as { success: boolean; dispute_id?: string; penalty?: Record<string, unknown> };
}

// 46. reopen_after_noshow - copy post, carry fee, block provider
export async function reopenAfterNoshow(bookingId: string): Promise<{
  success: boolean;
  new_request_id?: string;
  blocked_provider_profile_id?: string;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('reopen_after_noshow', {
    p_booking_id: bookingId,
  });
  if (error) throw new Error(error.message || 'Failed to reopen after no-show');
  return data as { success: boolean; new_request_id?: string; blocked_provider_profile_id?: string };
}

// 47. get_completion_status - enriched booking state for UI
export async function getCompletionStatus(bookingId: string): Promise<{
  booking_id: string;
  status: string;
  provider_marked_complete_at: string | null;
  customer_marked_complete_at: string | null;
  review_opens_at: string | null;
  review_window_open: boolean;
  my_review_submitted: boolean;
  other_reviewed: boolean;
  reviews_revealed: boolean;
  can_claim_noshow: boolean;
  noshow_claimed: boolean;
  noshow_claimed_at: string | null;
  completion_source: string | null;
  job_start: string;
  noshow_eligible_at: string;
} | null> {
  const { data, error } = await supabase.rpc('get_completion_status', {
    p_booking_id: bookingId,
  });
  if (error) { console.warn('getCompletionStatus error:', error.message); return null; }
  return data;
}

// 48. get_history - past jobs with reviews for customer or provider
export interface HistoryEntry {
  booking_id: string;
  request_id: string;
  title: string;
  request_type: 'ordinary' | 'emergency';
  status: string;
  job_start: string;
  job_end: string;
  offered_price: number;
  completion_source: string | null;
  provider_name: string;
  provider_rating_avg: number;
  provider_review_count: number;
  customer_name: string;
  my_review_stars: number | null;
  my_review_feedback: string | null;
  my_review_revealed: boolean;
  other_review_stars: number | null;
  other_review_feedback: string | null;
  other_review_revealed: boolean;
  review_opens_at: string | null;
  noshow_claimed_at: string | null;
  created_at: string;
}

export async function getHistory(role: 'customer' | 'provider'): Promise<HistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_history', { p_role: role });
  if (error) { console.warn('getHistory error:', error.message); return []; }
  return (data ?? []) as HistoryEntry[];
}

// 49. subscribeToBookingCompletion - realtime listener for completion/review updates
export function subscribeToBookingCompletion(
  bookingId: string,
  onUpdate: (payload: { review_opens_at?: string; status?: string; provider_marked_complete_at?: string; customer_marked_complete_at?: string }) => void
): () => void {
  const channel = supabase
    .channel(`booking-completion:${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      (payload) => {
        const rec = payload.new as Record<string, unknown>;
        onUpdate({
          review_opens_at: rec.review_opens_at as string | undefined,
          status: rec.status as string | undefined,
          provider_marked_complete_at: rec.provider_marked_complete_at as string | undefined,
          customer_marked_complete_at: rec.customer_marked_complete_at as string | undefined,
        });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─── ADMIN SERVICE FUNCTIONS ────────────────────────────────────────────────

// 50. admin_fetch_users – all users + provider info
export interface AdminUserRow {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  created_at: string;
  provider_profile_id?: string;
  provider_type?: string;
  provider_status?: string;
  coins?: number;
  rating_avg?: number;
  review_count?: number;
  bid_banned_until?: string | null;
  verified_id_hash?: string;
}

export async function adminFetchUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_fetch_users');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserRow[];
}

// 51. admin_fetch_coin_ledger
export interface AdminCoinLedgerEntry {
  id: string;
  amount: number;
  reason: string;
  reference_id?: string;
  created_at: string;
}

export async function adminFetchCoinLedger(providerProfileId: string): Promise<AdminCoinLedgerEntry[]> {
  const { data, error } = await supabase.rpc('admin_fetch_coin_ledger', {
    p_provider_profile_id: providerProfileId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminCoinLedgerEntry[];
}

// 52. fetchAllCategories (admin – includes inactive)
export async function fetchAllCategories(): Promise<any[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// 53. adminUpdateCategory
export async function adminUpdateCategory(params: {
  categoryId: string;
  name?: string;
  basePrice?: number;
  imageUrl?: string;
  active?: boolean;
}): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('admin_update_category', {
    p_category_id: params.categoryId,
    p_name:        params.name        ?? null,
    p_base_price:  params.basePrice   ?? null,
    p_image_url:   params.imageUrl    ?? null,
    p_active:      params.active      ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { success: boolean };
}

// 54. fetchRevenue – from revenue_by_period view
export interface RevenueRow {
  period: 'day' | 'week' | 'month';
  period_start: string;
  period_end: string;
  job_count: number;
  total_fee: number;
}

export async function fetchRevenue(period: 'day' | 'week' | 'month'): Promise<RevenueRow[]> {
  const { data, error } = await supabase
    .from('revenue_by_period')
    .select('*')
    .eq('period', period)
    .order('period_start', { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as RevenueRow[];
}

// 55. setEmergencyFee – applies only to future emergency posts
export async function setEmergencyFee(fee: number): Promise<{ success: boolean; fee: number }> {
  const { data, error } = await supabase.rpc('set_emergency_fee', { p_fee: fee });
  if (error) throw new Error(error.message);
  return data as { success: boolean; fee: number };
}

// 56. fetchVerificationQueue
export interface VerificationRequest {
  id: string;
  provider_profile_id: string;
  doc_type: 'id_proof' | 'selfie';
  document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id?: string;
  reviewer_note?: string;
  submitted_at: string;
  reviewed_at?: string;
  provider?: { id: string; user_id: string; profile?: { name: string; phone: string } };
}

export async function fetchVerificationQueue(): Promise<VerificationRequest[]> {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*, provider:provider_profiles(id, user_id, profile:profiles(name, phone))')
    .order('submitted_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VerificationRequest[];
}

// 57. adminApproveVerification
export async function adminApproveVerification(requestId: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('admin_approve_verification', {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return data as { success: boolean };
}

// 58. adminRejectVerification
export async function adminRejectVerification(requestId: string, reason?: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('admin_reject_verification', {
    p_request_id: requestId,
    p_reason:     reason ?? 'Document could not be verified',
  });
  if (error) throw new Error(error.message);
  return data as { success: boolean };
}

// 59. fetchDisputeMessages
export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  sender?: { name: string; role: string };
}

export async function fetchDisputeMessages(disputeId: string): Promise<DisputeMessage[]> {
  const { data, error } = await supabase
    .from('dispute_messages')
    .select('*, sender:profiles(name, role)')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DisputeMessage[];
}

// 60. sendDisputeMessage
export async function sendDisputeMessage(params: {
  disputeId: string;
  senderId: string;
  content: string;
  imageUrl?: string;
}): Promise<void> {
  const { error } = await supabase.from('dispute_messages').insert({
    dispute_id: params.disputeId,
    sender_id:  params.senderId,
    content:    params.content,
    image_url:  params.imageUrl ?? null,
  });
  if (error) throw new Error(error.message);
}

// 61. subscribeToDisputeMessages – realtime
export function subscribeToDisputeMessages(
  disputeId: string,
  onMessage: (msg: DisputeMessage) => void
): () => void {
  const channel = supabase
    .channel(`dispute-chat:${disputeId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `dispute_id=eq.${disputeId}` },
      (payload) => onMessage(payload.new as DisputeMessage)
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

