/**
 * Server-side Supabase client configuration
 * Uses service role key for administrative operations
 */

import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from '../logger';

// Server-side client with service role (bypasses RLS)
let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!serverClient) {
    const dbConfig = config.get('database');
    
    serverClient = createClient(
      dbConfig.supabaseUrl,
      dbConfig.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    logger.info('Initialized server-side Supabase client with service role');
  }

  return serverClient;
}

// Database operations for auth system
export const authDatabase = {
  /**
   * Store challenge in database
   */
  async storeChallenge(
    walletAddr: string, 
    nonce: string, 
    challenge: string, 
    expiresAt: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = getSupabaseServerClient();
      
      // Upsert challenge (replace if exists for same wallet)
      const { error } = await client
        .from('wallet_challenges')
        .upsert({
          wallet_addr: walletAddr,
          nonce,
          challenge,
          expires_at: expiresAt.toISOString(),
          issued_at: new Date().toISOString(),
          used: false,
          used_at: null
        }, {
          onConflict: 'wallet_addr'
        });

      if (error) {
        logger.error('Failed to store challenge', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Database error storing challenge', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database error'
      };
    }
  },

  /**
   * Retrieve and validate challenge
   */
  async getChallenge(
    walletAddr: string, 
    nonce: string
  ): Promise<{ success: boolean; data?: { challenge: string; expiresAt: Date }; error?: string }> {
    try {
      const client = getSupabaseServerClient();
      
      const { data, error } = await client
        .from('wallet_challenges')
        .select('challenge, expires_at, used')
        .eq('wallet_addr', walletAddr)
        .eq('nonce', nonce)
        .eq('used', false)
        .single();

      if (error) {
        logger.warn(`Challenge not found: ${walletAddr}:${nonce} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { success: false, error: 'Challenge not found or expired' };
      }

      if (!data) {
        return { success: false, error: 'Challenge not found' };
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        return { success: false, error: 'Challenge expired' };
      }

      return {
        success: true,
        data: {
          challenge: data.challenge,
          expiresAt
        }
      };
    } catch (error) {
      logger.error('Database error retrieving challenge', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database error'
      };
    }
  },

  /**
   * Mark challenge as used
   */
  async markChallengeUsed(
    walletAddr: string, 
    nonce: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = getSupabaseServerClient();
      
      const { error } = await client
        .from('wallet_challenges')
        .update({
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('wallet_addr', walletAddr)
        .eq('nonce', nonce)
        .eq('used', false);

      if (error) {
        logger.error('Failed to mark challenge as used', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Database error marking challenge as used', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database error'
      };
    }
  },

  /**
   * Upsert app user and return UUID
   */
  async upsertUser(
    walletAddr: string, 
    walletType?: string
  ): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
    try {
      const client = getSupabaseServerClient();
      
      const result = await client
        .rpc('upsert_app_user', {
          p_wallet_addr: walletAddr,
          p_wallet_type: walletType || null
        });
      
      const { data, error } = result as { data: string | null; error: PostgrestError | null };

      if (error) {
        logger.error('Failed to upsert user', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: { id: data || '' }
      };
    } catch (error) {
      logger.error('Database error upserting user', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database error'
      };
    }
  },

  /**
   * Get user by wallet address
   */
  async getUserByWallet(
    walletAddr: string
  ): Promise<{ success: boolean; data?: { id: string; walletType?: string; lastLoginAt: Date }; error?: string }> {
    try {
      const client = getSupabaseServerClient();
      
      const { data, error } = await client
        .from('app_users')
        .select('id, wallet_type, last_login_at')
        .eq('wallet_addr', walletAddr)
        .single();

      if (error) {
        logger.warn(`User not found: ${walletAddr} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { success: false, error: 'User not found' };
      }

      return {
        success: true,
        data: {
          id: data.id,
          walletType: data.wallet_type,
          lastLoginAt: new Date(data.last_login_at)
        }
      };
    } catch (error) {
      logger.error('Database error getting user', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Database error'
      };
    }
  }
};

export default getSupabaseServerClient;