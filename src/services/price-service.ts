/**
 * Price Service
 * 
 * Handles cryptocurrency price data fetching from external APIs
 * Integrates with CoinGecko API for real-time price information
 */

import { config } from '@/lib/config';
import { ExternalAPIError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export type PriceData = {
  usd: number;
  usd_24h_change: number;
  last_updated_at: number;
};

export type PriceResponse = {
  cardano: PriceData;
};

export class PriceService {
  private static instance: PriceService;
  private logger = logger;
  private apiUrl: string;
  private apiKey?: string;
  private cache: Map<string, { data: PriceData; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache

  private constructor() {
    const apiConfig = config.get('api');
    this.apiUrl = apiConfig.priceApiUrl;
    this.apiKey = apiConfig.priceApiKey;
  }

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  /**
   * Get current ADA price in USD
   */
  public getADAPrice = async (): Promise<PriceData> => {
    try {
      // Check cache first
      const cacheKey = 'cardano';
      const cachedData = this.cache.get(cacheKey);
      
      if (cachedData && Date.now() - cachedData.timestamp < this.cacheTimeout) {
        this.logger.info('Returning cached ADA price data');
        return cachedData.data;
      }

      // Fetch from API
      const url = `${this.apiUrl}/simple/price?ids=cardano&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'WalletSyncService/1.0'
      };

      if (this.apiKey) {
        headers['X-CG-Pro-API-Key'] = this.apiKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new ExternalAPIError(
          `Price API request failed: ${response.status} ${response.statusText}`,
          { status: response.status, url }
        );
      }

      const data: PriceResponse = await response.json();

      if (!data.cardano) {
        throw new ExternalAPIError('Invalid price API response: missing cardano data');
      }

      const priceData: PriceData = {
        usd: data.cardano.usd,
        usd_24h_change: data.cardano.usd_24h_change,
        last_updated_at: data.cardano.last_updated_at
      };

      // Update cache
      this.cache.set(cacheKey, {
        data: priceData,
        timestamp: Date.now()
      });

      this.logger.info(`ADA price updated: $${priceData.usd}`);
      return priceData;
    } catch (error) {
      this.logger.error('Failed to fetch ADA price', error);
      
      // Return fallback data if API fails
      const fallbackPrice: PriceData = {
        usd: 0.45, // Fallback price
        usd_24h_change: 0,
        last_updated_at: Date.now()
      };
      
      this.logger.info('Using fallback ADA price data');
      return fallbackPrice;
    }
  };

  /**
   * Convert Lovelace to ADA
   */
  public lovelaceToADA = (lovelace: string): number => {
    const walletConfig = config.get('wallet');
    return parseFloat(lovelace) / walletConfig.adaToLovelaceRatio;
  };

  /**
   * Convert ADA amount to USD
   */
  public adaToUSD = async (adaAmount: number): Promise<number> => {
    const priceData = await this.getADAPrice();
    return adaAmount * priceData.usd;
  };

  /**
   * Format USD amount to string
   */
  public formatUSD = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  /**
   * Get price change percentage for display
   */
  public getPriceChangeDisplay = async (): Promise<{ change: number; isPositive: boolean }> => {
    const priceData = await this.getADAPrice();
    return {
      change: Math.abs(priceData.usd_24h_change),
      isPositive: priceData.usd_24h_change >= 0
    };
  };

  /**
   * Clear price cache (for testing or manual refresh)
   */
  public clearCache = (): void => {
    this.cache.clear();
    this.logger.info('Price cache cleared');
  };
}

// Export singleton instance
export const priceService = PriceService.getInstance();