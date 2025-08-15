/**
 * Repository Module
 * 
 * Simple factory function for creating repository instances
 * with dependency injection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { WalletTransactionRepository } from './wallet-transaction-repository';
import { TokenRepository } from './token-repository';
import type { ITransactionRepository, ITokenRepository } from '@/services/interfaces';

/**
 * Create repository instances with a specific Supabase client
 * 
 * Usage:
 * - API Routes: Pass service role client for write operations
 * - Client: Pass anon client for read operations (if needed)
 * - Tests: Pass mock client for testing
 * 
 * @param supabase - The Supabase client to use for database operations
 */
export function createRepositories(supabase: SupabaseClient) {
  return {
    transaction: new WalletTransactionRepository(supabase),
    token: new TokenRepository(supabase)
  };
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
  ITokenRepository 
} from '@/services/interfaces';