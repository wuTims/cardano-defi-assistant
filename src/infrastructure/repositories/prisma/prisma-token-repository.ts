/**
 * Prisma Token Repository
 * 
 * Handles token metadata persistence using Prisma.
 * Implements ITokenRepository interface for domain operations.
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles token data persistence
 * - Open/Closed: Extends through interface, not modification
 * - Interface Segregation: Implements domain-specific token operations
 * - Dependency Inversion: Depends on Prisma abstraction
 */

import type { PrismaClient, Token } from '@prisma/client';
import type { ITokenRepository } from '@/core/interfaces/repositories';
import { logger as rootLogger } from '@/lib/logger';

const logger = rootLogger.child({ repository: 'PrismaTokenRepository' });

export class PrismaTokenRepository implements ITokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find token by unit (policyId + assetName)
   */
  async findByUnit(unit: string): Promise<Token | null> {
    try {
      return await this.prisma.token.findUnique({
        where: { unit }
      });
    } catch (error) {
      logger.error({ error, unit }, 'Failed to find token by unit');
      return null;
    }
  }

  /**
   * Find all tokens by policy ID
   */
  async findByPolicyId(policyId: string): Promise<Token[]> {
    try {
      return await this.prisma.token.findMany({
        where: { policyId },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      logger.error({ error, policyId }, 'Failed to find tokens by policy ID');
      return [];
    }
  }

  /**
   * Find tokens by category
   */
  async findByCategory(category: string, limit = 100): Promise<Token[]> {
    try {
      return await this.prisma.token.findMany({
        where: { category },
        take: limit,
        orderBy: { updatedAt: 'desc' }
      });
    } catch (error) {
      logger.error({ error, category }, 'Failed to find tokens by category');
      return [];
    }
  }

  /**
   * Search tokens by name or ticker
   */
  async search(query: string, limit = 50): Promise<Token[]> {
    try {
      // Case-insensitive search on name and ticker
      return await this.prisma.token.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { ticker: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: limit,
        orderBy: { updatedAt: 'desc' }
      });
    } catch (error) {
      logger.error({ error, query }, 'Failed to search tokens');
      return [];
    }
  }

  /**
   * Upsert token (create or update)
   */
  async upsert(token: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>): Promise<Token> {
    try {
      return await this.prisma.token.upsert({
        where: { unit: token.unit },
        update: {
          policyId: token.policyId,
          assetName: token.assetName,
          name: token.name,
          ticker: token.ticker,
          decimals: token.decimals,
          category: token.category,
          logo: token.logo,
          metadata: token.metadata
        },
        create: token
      });
    } catch (error) {
      logger.error({ error, unit: token.unit }, 'Failed to upsert token');
      throw error;
    }
  }

  /**
   * Bulk upsert tokens
   */
  async bulkUpsert(tokens: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number> {
    if (tokens.length === 0) return 0;

    try {
      // Use transaction for bulk operations
      const results = await this.prisma.$transaction(
        tokens.map(token => 
          this.prisma.token.upsert({
            where: { unit: token.unit },
            update: {
              policyId: token.policyId,
              assetName: token.assetName,
              name: token.name,
              ticker: token.ticker,
              decimals: token.decimals,
              category: token.category,
              logo: token.logo,
              metadata: token.metadata
            },
            create: token
          })
        )
      );

      logger.info({ count: results.length }, 'Bulk upserted tokens');
      return results.length;
    } catch (error) {
      logger.error({ error, count: tokens.length }, 'Failed to bulk upsert tokens');
      throw error;
    }
  }

  /**
   * Check if token exists
   */
  async exists(unit: string): Promise<boolean> {
    try {
      const count = await this.prisma.token.count({
        where: { unit }
      });
      return count > 0;
    } catch (error) {
      logger.error({ error, unit }, 'Failed to check token existence');
      return false;
    }
  }
}