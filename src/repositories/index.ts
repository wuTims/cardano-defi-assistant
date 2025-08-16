/**
 * Repository Module
 * 
 * Simple factory function for creating repository instances
 * with dependency injection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { WalletTransactionRepository } from './wallet-transaction-repository';
import { TokenRepository } from './token-repository';
import { WalletRepository } from './wallet-repository';
import type { ITransactionRepository, ITokenRepository, IWalletRepository } from '@/services/interfaces';

/**
 * Create all repository instances with a specific Supabase client
 * Use this when you need multiple repositories (e.g., in workers)
 * 
 * @param supabase - The Supabase client to use for database operations
 */
export function createRepositories(supabase: SupabaseClient) {
  return {
    transaction: new WalletTransactionRepository(supabase),
    token: new TokenRepository(supabase),
    wallet: new WalletRepository(supabase)
  };
}

/**
 * Create individual repositories as needed
 * Use these in API routes to avoid unnecessary instantiation
 */
export function createWalletRepository(supabase: SupabaseClient) {
  return new WalletRepository(supabase);
}

export function createTransactionRepository(supabase: SupabaseClient) {
  return new WalletTransactionRepository(supabase);
}

export function createTokenRepository(supabase: SupabaseClient) {
  return new TokenRepository(supabase);
}

// Export error types
export { 
  RepositoryError, 
  NotFoundError, 
  isRepositoryError, 
  isNotFoundError 
} from './errors/repository-error';

// Re-export interfaces for convenience
export type { 
  ITransactionRepository, 
  ITokenRepository,
  IWalletRepository 
} from '@/services/interfaces';