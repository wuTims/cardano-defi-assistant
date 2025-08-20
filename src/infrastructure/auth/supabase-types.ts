/**
 * Supabase-Specific Authentication Types
 * 
 * Implementation-specific types that extend the generic auth interfaces.
 * These types are tightly coupled to Supabase and should only be used
 * in Supabase-specific implementations.
 */

import type { JWTPayload, AuthTokenResponse, AuthUser, WalletType } from '@/core/types/auth';

/**
 * Supabase JWT payload structure
 * Extends generic JWTPayload with Supabase-specific fields
 */
export interface SupabaseJWTPayload extends JWTPayload {
  iss: string;           // Supabase Auth issuer URL
  aud: string;           // Always "authenticated"
  role: string;          // Always "authenticated"
  addr: string;          // Wallet address for RLS policies (custom claim)
  wallet_type?: string;  // Optional wallet type (custom claim)
}

/**
 * Supabase-specific auth token with required userId
 * Used for Supabase RLS policies that require UUID
 */
export interface SupabaseAuthToken extends AuthTokenResponse {
  userId: string;        // Required UUID from app_users table for Supabase
}

/**
 * Type guard to check if a JWT payload is Supabase-specific
 */
export function isSupabaseJWTPayload(payload: JWTPayload): payload is SupabaseJWTPayload {
  return (
    'iss' in payload &&
    'aud' in payload &&
    'role' in payload &&
    'addr' in payload
  );
}

/**
 * Type guard to check if an auth token is Supabase-specific
 */
export function isSupabaseAuthToken(token: AuthTokenResponse): token is SupabaseAuthToken {
  return 'userId' in token && typeof token.userId === 'string';
}