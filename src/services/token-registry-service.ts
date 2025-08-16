/**
 * TokenRegistryService Implementation
 * 
 * Purpose: Manage token metadata with caching and API integration
 * Implements: ITokenRegistry
 * 
 * Based on official Cardano Token Registry OpenAPI spec:
 * https://input-output-hk.github.io/offchain-metadata-tools/api/latest/openapi.yaml
 * 
 * Strategy per plan:
 * 1. Check cache first
 * 2. Check database if not cached  
 * 3. Fetch from official API if not in DB
 * 4. Store and cache results
 */

import type { TokenInfo } from '@/types/transaction';
import { TokenCategory } from '@/types/transaction';
import type { ITokenRegistry, ITokenCache, ITokenRepository } from '@/services/interfaces';
import { LRUTokenCache } from './token-cache';
import { isADA, getPolicyId, getAssetName } from '@/types/blockchain';

/**
 * Cardano Token Registry API response format (per OpenAPI spec)
 */
interface TokenProperty {
  signatures: Array<{
    signature: string;
    publicKey: string;
  }>;
  sequenceNumber: number;
  value: string | number;
}

interface CardanoTokenAPIResponse {
  subject: string;
  policy: string;
  name?: TokenProperty;
  description?: TokenProperty;
  ticker?: TokenProperty;
  decimals?: TokenProperty;
  logo?: TokenProperty; // base64 encoded image
  url?: TokenProperty;
}

export class TokenRegistryService implements ITokenRegistry {
  private cache: ITokenCache;
  private readonly CARDANO_API_BASE = 'https://tokens.cardano.org';
  
  constructor(
    private repository: ITokenRepository,
    cache?: ITokenCache
  ) {
    // Dependency injection with default LRU cache
    this.cache = cache || new LRUTokenCache(1000);
  }

  /**
   * Get token information with 3-layer lookup strategy
   */
  public async getTokenInfo(unit: string): Promise<TokenInfo | null> {
    try {
      // Handle ADA specially with caching
      if (isADA(unit)) {
        const cached = this.cache.get(unit);
        if (cached) {
          return cached;
        }
        
        const adaToken: TokenInfo = {
          unit: 'lovelace',
          policyId: '',
          assetName: '',
          name: 'Cardano',
          ticker: 'ADA',
          decimals: 6,
          category: TokenCategory.NATIVE,
          logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
          metadata: {
            native: true,
            official: true
          }
        };
        
        this.cache.set(unit, adaToken);
        return adaToken;
      }

      // 1. Check cache first
      const cached = this.cache.get(unit);
      if (cached) {
        return cached;
      }
      
      // 2. Check database
      const dbToken = await this.repository.findByUnit(unit);
      if (dbToken) {
        this.cache.set(unit, dbToken);
        return dbToken;
      }
      
      // 3. Fetch from Cardano Token Registry API
      const apiToken = await this.fetchFromCardanoAPI(unit);
      if (apiToken) {
        // Save to database and cache
        await this.repository.save(apiToken);
        this.cache.set(unit, apiToken);
        return apiToken;
      }
      
      // 4. Return basic token info as fallback
      const basicToken = this.createBasicTokenInfo(unit);
      // Save unknown token to database to avoid foreign key constraints
      await this.repository.save(basicToken);
      this.cache.set(unit, basicToken);
      return basicToken;
      
    } catch (error) {
      console.error(`Error getting token info for ${unit}:`, error);
      // Even in error case, save basic token to avoid foreign key constraints
      const basicToken = this.createBasicTokenInfo(unit);
      try {
        await this.repository.save(basicToken);
        this.cache.set(unit, basicToken);
      } catch (saveError) {
        console.error(`Failed to save basic token for ${unit}:`, saveError);
      }
      return basicToken;
    }
  }

  /**
   * Batch get token information for multiple units
   * Optimizes with parallel processing and reduces API calls
   */
  public async batchGetTokenInfo(
    units: readonly string[]
  ): Promise<Map<string, TokenInfo>> {
    const tokenMap = new Map<string, TokenInfo>();
    const uncachedUnits: string[] = [];
    
    // First pass: check cache
    for (const unit of units) {
      const cached = this.cache.get(unit);
      if (cached) {
        tokenMap.set(unit, cached);
      } else {
        uncachedUnits.push(unit);
      }
    }
    
    if (uncachedUnits.length === 0) {
      return tokenMap;
    }
    
    // Second pass: try batch API request if supported, otherwise parallel individual requests
    try {
      // Try batch endpoint first (more efficient)
      const batchTokens = await this.fetchBatchFromCardanoAPI(uncachedUnits);
      if (batchTokens.size > 0) {
        // Save successful batch results
        for (const [unit, token] of batchTokens) {
          await this.repository.save(token);
          this.cache.set(unit, token);
          tokenMap.set(unit, token);
        }
        
        // Handle any remaining units not returned by batch
        const remainingUnits = uncachedUnits.filter(unit => !batchTokens.has(unit));
        if (remainingUnits.length > 0) {
          const individualResults = await this.fetchIndividualTokens(remainingUnits);
          for (const [unit, token] of individualResults) {
            tokenMap.set(unit, token);
          }
        }
      } else {
        // Fallback to individual requests
        const individualResults = await this.fetchIndividualTokens(uncachedUnits);
        for (const [unit, token] of individualResults) {
          tokenMap.set(unit, token);
        }
      }
    } catch (error) {
      console.error('Batch token fetch failed, using individual requests:', error);
      const individualResults = await this.fetchIndividualTokens(uncachedUnits);
      for (const [unit, token] of individualResults) {
        tokenMap.set(unit, token);
      }
    }
    
    return tokenMap;
  }

  /**
   * Fetch individual tokens in parallel
   */
  private async fetchIndividualTokens(units: string[]): Promise<Map<string, TokenInfo>> {
    const tokenMap = new Map<string, TokenInfo>();
    
    const tokenPromises = units.map(unit => 
      this.getTokenInfo(unit).then(token => ({ unit, token }))
    );
    
    const results = await Promise.allSettled(tokenPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.token) {
        tokenMap.set(result.value.unit, result.value.token);
      }
    }
    
    return tokenMap;
  }

  /**
   * Fetch multiple tokens using batch API endpoint (per OpenAPI spec)
   */
  private async fetchBatchFromCardanoAPI(units: string[]): Promise<Map<string, TokenInfo>> {
    const tokenMap = new Map<string, TokenInfo>();
    
    try {
      const response = await fetch(
        `${this.CARDANO_API_BASE}/metadata/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Cardano-DeFi-Assistant/1.0'
          },
          body: JSON.stringify({
            subjects: units,
            properties: ['name', 'description', 'ticker', 'decimals', 'logo', 'url']
          }),
          // Timeout after 10 seconds for batch request
          signal: AbortSignal.timeout(10000)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Batch API error: ${response.status} ${response.statusText}`);
      }
      
      const data: CardanoTokenAPIResponse[] = await response.json();
      
      for (const tokenData of data) {
        const token = this.transformAPIResponseToTokenInfo(tokenData);
        if (token) {
          tokenMap.set(token.unit, token);
        }
      }
      
    } catch (error) {
      console.warn('Batch API request failed:', error);
    }
    
    return tokenMap;
  }

  /**
   * Fetch token metadata from official Cardano Token Registry API (per OpenAPI spec)
   */
  private async fetchFromCardanoAPI(unit: string): Promise<TokenInfo | null> {
    try {
      const response = await fetch(
        `${this.CARDANO_API_BASE}/metadata/${unit}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Cardano-DeFi-Assistant/1.0'
          },
          // Timeout after 5 seconds
          signal: AbortSignal.timeout(5000)
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          // Token not found in registry
          return null;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data: CardanoTokenAPIResponse = await response.json();
      return this.transformAPIResponseToTokenInfo(data);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`Token API request timed out for ${unit}`);
      } else {
        console.error(`Failed to fetch token ${unit} from API:`, error);
      }
      return null;
    }
  }

  /**
   * Transform API response to our TokenInfo format (per OpenAPI spec)
   */
  private transformAPIResponseToTokenInfo(data: CardanoTokenAPIResponse): TokenInfo | null {
    if (!data.subject) return null;
    
    const unit = data.subject;
    
    const token: TokenInfo = {
      unit,
      policyId: getPolicyId(unit),
      assetName: getAssetName(unit),
      name: data.name?.value as string || this.generateDefaultName(unit),
      ticker: data.ticker?.value as string || this.generateDefaultTicker(unit),
      decimals: data.decimals?.value as number || 0,
      category: this.detectTokenCategory(data),
      logo: this.processLogoData(data.logo?.value as string),
      metadata: {
        description: data.description?.value as string,
        url: data.url?.value as string,
        apiSource: 'cardano_registry',
        fetchedAt: new Date().toISOString(),
        sequenceNumbers: {
          name: data.name?.sequenceNumber,
          ticker: data.ticker?.sequenceNumber,
          decimals: data.decimals?.sequenceNumber,
          logo: data.logo?.sequenceNumber
        }
      }
    };
    
    return token;
  }

  /**
   * Process logo data from API (base64 encoded per spec)
   */
  private processLogoData(logoData?: string): string | undefined {
    if (!logoData) return undefined;
    
    try {
      // Per OpenAPI spec, logo is base64 encoded
      // Convert to data URL for browser use
      if (logoData.startsWith('data:')) {
        return logoData; // Already a data URL
      }
      
      // Assume PNG format if not specified (most common)
      return `data:image/png;base64,${logoData}`;
    } catch (error) {
      console.warn('Failed to process logo data:', error);
      return undefined;
    }
  }

  /**
   * Detect token category from API metadata
   */
  private detectTokenCategory(data: CardanoTokenAPIResponse): TokenCategory {
    const name = (data.name?.value as string || '').toLowerCase();
    const ticker = (data.ticker?.value as string || '').toLowerCase();
    const description = (data.description?.value as string || '').toLowerCase();
    
    // LP Token detection
    if (
      ticker.includes('lp') || 
      name.includes('liquidity') || 
      name.includes('lp') ||
      description.includes('liquidity pool')
    ) {
      return TokenCategory.LP_TOKEN;
    }
    
    // Q Token detection (Liqwid)
    if (ticker.startsWith('q') && ticker.length <= 6) {
      return TokenCategory.Q_TOKEN;
    }
    
    // Governance token detection
    if (
      name.includes('governance') ||
      description.includes('governance') ||
      name.includes('dao') ||
      ticker.includes('gov')
    ) {
      return TokenCategory.GOVERNANCE;
    }
    
    // Stablecoin detection
    const stablecoinPatterns = ['usd', 'eur', 'djed', 'stable'];
    if (stablecoinPatterns.some(pattern => 
      ticker.includes(pattern) || name.includes(pattern) || description.includes(pattern)
    )) {
      return TokenCategory.STABLECOIN;
    }
    
    // Default to fungible token
    return TokenCategory.FUNGIBLE;
  }

  /**
   * Create basic token info for unknown tokens
   */
  private createBasicTokenInfo(unit: string): TokenInfo {
    const policyId = getPolicyId(unit);
    const assetName = getAssetName(unit);
    
    return {
      unit,
      policyId,
      assetName,
      name: this.generateDefaultName(unit),
      ticker: this.generateDefaultTicker(unit),
      decimals: 0,
      category: TokenCategory.FUNGIBLE,
      metadata: {
        fallback: true,
        createdAt: new Date().toISOString()
      }
    };
  }

  /**
   * Generate default name for unknown token
   */
  private generateDefaultName(unit: string): string {
    const assetName = getAssetName(unit);
    if (assetName) {
      // Try to decode hex asset name
      try {
        const decoded = Buffer.from(assetName, 'hex').toString('utf8');
        // Only use if it's printable ASCII
        if (/^[\x20-\x7E]+$/.test(decoded)) {
          return decoded;
        }
      } catch {
        // Ignore decode errors
      }
    }
    return `Token ${unit.slice(0, 8)}...`;
  }

  /**
   * Generate default ticker for unknown token
   */
  private generateDefaultTicker(unit: string): string {
    const assetName = getAssetName(unit);
    if (assetName && assetName.length <= 16) {
      try {
        const decoded = Buffer.from(assetName, 'hex').toString('utf8');
        if (/^[A-Za-z0-9]+$/.test(decoded)) {
          return decoded.toUpperCase().slice(0, 8);
        }
      } catch {
        // Ignore decode errors
      }
    }
    return unit.slice(-8).toUpperCase();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): any {
    if (this.cache instanceof LRUTokenCache) {
      return this.cache.getStats();
    }
    return { size: 0, maxSize: 0, utilization: 0 };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}