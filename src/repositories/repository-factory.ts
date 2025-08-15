/**
 * Repository Factory
 * 
 * Purpose: Create and manage repository instances with proper dependency injection
 * Pattern: Factory pattern for creating repositories
 * 
 * SOLID Compliance:
 * - SRP: Only responsible for creating repository instances
 * - DIP: Depends on abstractions (interfaces) not concrete implementations
 * - OCP: Easy to extend with new repository types
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { WalletTransactionRepository } from './wallet-transaction-repository';
import { TokenRepository } from './token-repository';
import type { ITransactionRepository, ITokenRepository } from '@/services/interfaces';

export class RepositoryFactory {
  private static instance: RepositoryFactory;
  private supabaseClient: SupabaseClient;
  private transactionRepo?: ITransactionRepository;
  private tokenRepo?: ITokenRepository;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  /**
   * Get singleton instance of the factory
   */
  static getInstance(supabaseClient?: SupabaseClient): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      if (!supabaseClient) {
        // Create default client for server-side operations
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseServiceKey) {
          throw new Error('Supabase configuration missing');
        }
        
        supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
      }
      RepositoryFactory.instance = new RepositoryFactory(supabaseClient);
    }
    return RepositoryFactory.instance;
  }

  /**
   * Get transaction repository instance (singleton per factory)
   */
  getTransactionRepository(): ITransactionRepository {
    if (!this.transactionRepo) {
      this.transactionRepo = new WalletTransactionRepository(this.supabaseClient);
    }
    return this.transactionRepo;
  }

  /**
   * Get token repository instance (singleton per factory)
   */
  getTokenRepository(): ITokenRepository {
    if (!this.tokenRepo) {
      this.tokenRepo = new TokenRepository(this.supabaseClient);
    }
    return this.tokenRepo;
  }

  /**
   * Create a new factory with a specific Supabase client
   * Useful for testing or using different auth contexts
   */
  static createWithClient(supabaseClient: SupabaseClient): RepositoryFactory {
    return new RepositoryFactory(supabaseClient);
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  static reset(): void {
    RepositoryFactory.instance = undefined as any;
  }
}