/**
 * Client-side Supabase configuration
 * Creates Supabase client with JWT token for RLS-protected queries
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Create client-side Supabase client with JWT token
 */
export function createSupabaseClient(accessToken?: string): SupabaseClient {
  const clientOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    ...(accessToken && {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    })
  };

  return createClient(supabaseUrl, supabasePublishableKey, clientOptions);
}


export const supabase = createSupabaseClient();