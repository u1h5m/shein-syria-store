import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vmbjrfyiruqgtyvcqkxs.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_w4zK6NF8Z8CYgN-wBBSZiw_wPaiDuUG';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'ameertrad82@gmail.com';
