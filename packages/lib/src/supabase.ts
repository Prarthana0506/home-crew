import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://demo-project.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'demo-anon-key-placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
