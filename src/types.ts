export type UserRole = 'customer' | 'provider' | 'both' | 'admin';
export type ServiceType = 'ordinary' | 'emergency';
export type ProviderPreference = 'freelancer' | 'organization' | 'either';
export type RequestStatus = 'pending_bidding' | 'bidding_active' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type BidStatus = 'notified' | 'interested' | 'not_interested' | 'bid_submitted';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  area: string;
  distance_km: number;
  rating_avg: number;
  total_reviews: number;
  coins: number;
  provider_type?: 'freelancer' | 'organization' | 'either';
  avatar?: string;
  mobile_number?: string;
  exact_address?: string;
  aadhar_number?: string;
  org_name?: string;
  gst_number?: string;
}

export interface Category {
  id: string;
  name: string;
  base_price: number;
  emergency_price: number;
  icon: string;
  default_image: string;
  description: string;
}

export interface Bid {
  id: string;
  request_id: string;
  provider_id: string;
  provider_name: string;
  provider_rating: number;
  provider_type: 'freelancer' | 'organization';
  status: BidStatus;
  bid_amount?: number | null;
  bid_note?: string | null;
  submitted_at: string;
}

export interface Review {
  id: string;
  request_id: string;
  customer_id: string;
  customer_name: string;
  provider_id: string;
  stars: number; // 1 to 5 compulsory
  feedback?: string; // optional
  coins_earned: number; // 25 base + star bonus
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  category_id: string;
  category_name: string;
  title: string;
  description: string;
  service_type: ServiceType;
  base_price: number;
  final_price: number;
  provider_preference: ProviderPreference;
  area: string;
  image_url: string;
  scheduled_date: string;
  status: RequestStatus;
  assigned_provider_id?: string | null;
  assigned_provider_name?: string | null;
  bidding_starts_at?: string;
  bidding_ends_at?: string;
  created_at: string;
  bids?: Bid[];
  review?: Review | null;
  chatCount?: number;
}

export interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  message: string;
  attachment_url?: string | null;
  created_at: string;
}
