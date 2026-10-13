import { supabase } from './supabase';

export type ChatMessageType =
  | 'text'
  | 'image'
  | 'card_propose_time'
  | 'card_confirm_time'
  | 'card_share_address'
  | 'card_on_the_way';

export interface ChatMessageItem {
  id: string;
  conversation_id: string;
  booking_id: string;
  sender_id: string;
  sender_name?: string;
  sender_role: 'customer' | 'provider' | 'technician' | 'organization_owner' | 'system';
  message_type: ChatMessageType;
  content: string | null;
  media_url?: string | null;
  metadata?: any;
  is_reported?: boolean;
  created_at: string;
}

export interface ConversationInfo {
  id: string;
  booking_id: string;
  request_id: string;
  request_title: string;
  booking_status: string;
  job_start: string;
  job_end: string;
  is_readonly: boolean;
  can_call: boolean;
  created_at: string;
}

/**
 * 1. Fetch or initialize conversation for a confirmed booking
 */
export async function getOrCreateBookingConversation(
  bookingId: string
): Promise<ConversationInfo> {
  const { data, error } = await supabase.rpc('get_or_create_booking_conversation', {
    p_booking_id: bookingId
  });

  if (error) {
    throw new Error(error.message || 'Failed to initialize booking chat');
  }

  return data as ConversationInfo;
}

/**
 * 2. Fetch messages for booking (with address masking if completed)
 */
export async function fetchChatMessages(
  bookingId: string
): Promise<ChatMessageItem[]> {
  const { data, error } = await supabase.rpc('get_chat_messages', {
    p_booking_id: bookingId
  });

  if (error) {
    console.warn('fetchChatMessages error:', error.message);
    return [];
  }

  return (data || []) as ChatMessageItem[];
}

/**
 * 3. Send message through server-side validation RPC
 */
export async function sendChatMessage(params: {
  bookingId: string;
  messageType: ChatMessageType;
  content?: string;
  mediaUrl?: string;
  metadata?: any;
}): Promise<ChatMessageItem> {
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_booking_id: params.bookingId,
    p_message_type: params.messageType,
    p_content: params.content || null,
    p_media_url: params.mediaUrl || null,
    p_metadata: params.metadata || {}
  });

  if (error) {
    throw new Error(error.message || 'Failed to send message');
  }

  return data as ChatMessageItem;
}

/**
 * 4. Report abusive message to disputes
 */
export async function reportChatMessage(
  messageId: string,
  reason: string
): Promise<{ success: boolean; dispute_id: string }> {
  const { data, error } = await supabase.rpc('report_chat_message', {
    p_message_id: messageId,
    p_reason: reason
  });

  if (error) {
    throw new Error(error.message || 'Failed to report message');
  }

  return data;
}

/**
 * 5. Subscribe to Supabase Realtime channel for booking chat
 */
export function subscribeToBookingChat(
  bookingId: string,
  onNewMessage: (msg: ChatMessageItem) => void
) {
  const channel = supabase
    .channel(`booking_chat_${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `booking_id=eq.${bookingId}`
      },
      payload => {
        onNewMessage(payload.new as ChatMessageItem);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
