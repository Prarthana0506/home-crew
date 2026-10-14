export type UserRole = 'customer' | 'provider' | 'admin';
export type ProviderType = 'freelancer' | 'organization_owner' | 'technician';
export type Language = 'en' | 'ta';

export interface Area {
  id: string;
  name: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  name_ta?: string | null;
  icon: string;
  default_image: string;
  base_price: number;
  active: boolean;
  description?: string | null;
}

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  phone?: string | null;
  phone_demo_verified: boolean;
  language: Language;
  area_id?: string | null;
  avatar?: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  area?: Area | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProviderProfile {
  id: string;
  user_id: string;
  organization_id?: string | null;
  provider_type: ProviderType;
  skills: string[];
  categories: string[];
  experience: number;
  working_hours: { start: string; end: string };
  working_days: number[];
  travel_radius_km: number;
  rating_avg: number;
  review_count: number;
  status: 'active' | 'left' | 'pending' | 'rejected';
  coins: number;
  bid_banned_until?: string | null;
  profile?: Profile | null;
  organization?: Organization | null;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  business_type: string;
  gst_number?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  area_id?: string | null;
}

export type ServiceType = 'ordinary' | 'emergency';
export type ProviderPreference = 'freelancer' | 'organization' | 'either';
export type RequestStatus =
  | 'pending'
  | 'open'
  | 'bidding_active'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  // Emergency state machine
  | 'draft_fee'
  | 'notified'
  | 'interest_window'
  | 'bidding_open'
  | 'closed'
  | 'awarded'
  | 'widen_radius'
  | 'extended'
  | 'offered_conversion'
  | 'admin_assist'
  | 'expired';

// -----------------------------------------------------------------------
// Emergency Bidding Arena types
// -----------------------------------------------------------------------

export type EmergencyBiddingStatus =
  | 'interest_window'
  | 'bidding_open'
  | 'closed'
  | 'awarded'
  | 'widen_radius'
  | 'extended'
  | 'offered_conversion'
  | 'admin_assist'
  | 'expired';

export type BidInterestStatus = 'interested' | 'not_interested';

export interface RespondInterestResult {
  success: boolean;
  status: BidInterestStatus;
  current_interested_count?: number;
  max_interested?: number;
  bidding_auto_opened?: boolean;
  error?: string;
}

export interface PlaceBidResult {
  success: boolean;
  bid_id?: string;
  coins?: number;
  request_id?: string;
  top_bid?: number;
  error?: string;
}

export interface CloseBiddingResult {
  success: boolean;
  status?: string;
  winner_provider_profile_id?: string;
  winning_coins?: number;
  booking_id?: string;
  error?: string;
}

export interface BidArenaInfo {
  request_id: string;
  title: string;
  status: EmergencyBiddingStatus;
  top_bid_coins: number;
  top_bid_provider_profile_id: string | null;
  bidding_closes_at: string | null;
  interest_expires_at: string | null;
  notified_at: string | null;
  current_radius_km: number;
  fallback_stage: number;
  preferred_start: string;
  offered_price: number;
}

export interface EligibleProvider {
  provider_profile_id: string;
  user_id: string;
  name: string;
  phone: string;
  distance_km: number;
  provider_type: string;
  coins: number;
  rating_avg: number;
  review_count: number;
}

export interface PenaltyResult {
  success: boolean;
  penalty_coins?: number;
  rating_deduction?: number;
  banned_until?: string;
  verified_id_hash?: string;
  error?: string;
}

export interface ServiceRequest {
  id: string;
  customer_id: string;
  type: ServiceType;
  category_id: string;
  area_id: string;
  title: string;
  description: string;
  offered_price: number;
  min_price: number;
  preferred_start: string;
  estimated_duration_hours: number;
  status: RequestStatus;
  images: string[];
  provider_preference: ProviderPreference;
  fee_payment_id?: string | null;
  assigned_provider_profile_id?: string | null;
  // Emergency state machine metadata
  notified_at?: string | null;
  interest_expires_at?: string | null;
  bidding_opened_at?: string | null;
  bidding_closes_at?: string | null;
  top_bid_coins?: number;
  top_bid_provider_profile_id?: string | null;
  current_radius_km?: number;
  customer_marked_finished?: boolean;
  provider_marked_finished?: boolean;
  customer?: Profile | null;
  category?: ServiceCategory | null;
  area?: Area | null;
  assigned_provider?: ProviderProfile | null;
  bids?: Bid[];
  bookings?: any[];
  created_at: string;
  updated_at: string;
}


export type BidStatus = 'active' | 'withdrawn' | 'won' | 'outbid' | 'cancelled';

export interface Bid {
  id: string;
  request_id: string;
  provider_profile_id: string;
  coins: number;
  status: BidStatus;
  note?: string | null;
  provider?: ProviderProfile | null;
  created_at: string;
}

export interface BidInterest {
  id: string;
  request_id: string;
  provider_profile_id: string;
  status: 'interested' | 'not_interested';
  created_at: string;
}

export interface Booking {
  id: string;
  request_id: string;
  provider_profile_id: string;
  time_range: string;
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  request?: ServiceRequest | null;
  created_at: string;
}

export interface Review {
  id: string;
  request_id: string;
  reviewer_id: string;
  reviewee_id: string;
  direction: 'customer_to_provider' | 'provider_to_customer';
  rating: number;
  feedback?: string | null;
  revealed: boolean;
  created_at: string;
}

export interface CoinLedgerEntry {
  id: string;
  provider_profile_id: string;
  amount: number;
  reason: string;
  request_id?: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'system' | 'time_proposal' | 'address_share';
  payload?: any;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  read: boolean;
  created_at: string;
}

export interface Dispute {
  id: string;
  request_id: string;
  raised_by: string;
  category: 'no_show' | 'payment_dispute' | 'damage_claim' | 'quality_issue' | 'other';
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  resolution_notes?: string | null;
  resolved_by?: string | null;
  created_at: string;
}

export interface PendingReviewInfo {
  request_id: string;
  title: string;
  completed_at: string;
  category_name: string;
  provider_name: string;
  provider_user_id?: string | null;
}

export interface EmergencyFeePayment {
  id: string;
  customer_id: string;
  amount: number;
  status: 'paid' | 'waived' | 'pending';
  fee_version: number;
  payment_method: string;
  transaction_ref: string;
  created_at: string;
}

export interface CreateRequestResult {
  success: boolean;
  request_id: string;
  status: RequestStatus;
  min_price: number;
  offered_price: number;
  type: ServiceType;
}

export interface SentEmail {
  id: string;
  recipient_email: string;
  recipient_name?: string | null;
  recipient_role: 'customer' | 'provider' | 'admin';
  email_type: 'request_confirmation' | 'booking_confirmation';
  subject: string;
  body_text: string;
  body_html: string;
  status: 'sent' | 'pending' | 'invalid_email';
  user_id?: string | null;
  request_id?: string | null;
  booking_id?: string | null;
  created_at: string;
}

export interface BookingEmailDetails {
  success: boolean;
  request_id?: string;
  booking_id?: string;
  title: string;
  category_name: string;
  area_name: string;
  address: string;
  preferred_start: string;
  scheduled_time: string;
  price: number;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  provider: {
    id: string;
    user_id: string;
    name: string;
    email: string;
    phone: string;
  };
}
