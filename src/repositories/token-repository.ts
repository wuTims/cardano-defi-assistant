/**
 * Token Repository
 * 
 * Purpose: Handle token metadata persistence
 * Single Responsibility: Token CRUD operations only
 * 
 * SOLID Compliance:
 * - SRP: Only handles token data access
 * - DIP: Depends on abstractions (ITokenRepository, SupabaseClient)
 * - OCP: Extensible through inheritance
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import type { ITokenRepository } from '@/services/interfaces';
import type { TokenInfo, TokenCategory } from '@/types/transaction';
import type { DatabaseToken } from '@/types/database';

export class TokenRepository extends BaseRepository implements ITokenRepository {
  constructor(supabase: SupabaseClient, logger = console) {
    super(supabase, logger);
  }

  async findByUnit(unit: string): Promise<TokenInfo | null> {
    const data = await this.executeReadOperation<DatabaseToken>(
      'findTokenByUnit',
      () => this.supabase
        .from('tokens')
        .select('*')
        .eq('unit', unit)
        .single()
    );

    return data ? this.mapToTokenInfo(data) : null;
  }

  async save(token: TokenInfo): Promise<void> {
    const dbToken: DatabaseToken = {
      unit: token.unit,
      policy_id: token.policyId,
      asset_name: token.assetName,
      name: token.name,
      ticker: token.ticker,
      decimals: token.decimals,
      category: token.category,
      logo: token.logo,
      metadata: token.metadata
    };

    await this.executeWriteOperation(
      'saveToken',
      () => this.supabase
        .from('tokens')
        .upsert(dbToken, {
          onConflict: 'unit'
        })
    );
  }

  async saveBatch(tokens: readonly TokenInfo[]): Promise<void> {
    if (tokens.length === 0) return;

    const dbTokens: DatabaseToken[] = tokens.map(token => ({
      unit: token.unit,
      policy_id: token.policyId,
      asset_name: token.assetName,
      name: token.name,
      ticker: token.ticker,
      decimals: token.decimals,
      category: token.category,
      logo: token.logo,
      metadata: token.metadata
    }));

    await this.executeWriteOperation(
      'saveTokensBatch',
      () => this.supabase
        .from('tokens')
        .upsert(dbTokens, {
          onConflict: 'unit'
        })
    );
  }

  async findByCategory(category: TokenCategory): Promise<TokenInfo[]> {
    const data = await this.executeReadOperation<DatabaseToken[]>(
      'findTokensByCategory',
      () => this.supabase
        .from('tokens')
        .select('*')
        .eq('category', category)
    );

    return (data || []).map(row => this.mapToTokenInfo(row));
  }

  async findByPolicy(policyId: string): Promise<TokenInfo[]> {
    const data = await this.executeReadOperation<DatabaseToken[]>(
      'findTokensByPolicy',
      () => this.supabase
        .from('tokens')
        .select('*')
        .eq('policy_id', policyId)
    );

    return (data || []).map(row => this.mapToTokenInfo(row));
  }

  async delete(unit: string): Promise<void> {
    await this.executeWriteOperation(
      'deleteToken',
      () => this.supabase
        .from('tokens')
        .delete()
        .eq('unit', unit)
    );
  }

  async cleanup(olderThan: Date): Promise<void> {
    // Tokens don't expire, so this is a no-op
    this.logger.log('Token cleanup not implemented - tokens are permanent');
  }

  private mapToTokenInfo(row: DatabaseToken): TokenInfo {
    return {
      unit: row.unit,
      policyId: row.policy_id,
      assetName: row.asset_name,
      name: row.name || '',
      ticker: row.ticker || '',
      decimals: row.decimals,
      category: row.category as TokenCategory,
      logo: row.logo,
      metadata: row.metadata
    };
  }
}