/**
 * ConfigManager - Centralized configuration management
 * 
 * Provides a single source of truth for all application configuration.
 * No hardcoded values - everything is configurable via environment variables
 * with sensible defaults for development.
 */

import { ConfigurationError } from './errors';

export interface AppConfig {
  app: {
    name: string;
    environment: 'development' | 'staging' | 'production';
    debug: boolean;
  };
  auth: {
    jwtSecret: string; // Private key for ECDSA signing (base64-encoded JWK)
    jwtPublicKey?: string; // Public key for ECDSA verification (optional for same-service verification)
    jwtAlgorithm: string;
    jwtKid: string; // Key ID for Supabase JWT header
    supabaseIssuer: string; // Supabase Auth issuer URL
    tokenExpiresIn: number; // seconds
    challengeTTL: number; // seconds
  };
  wallet: {
    syncInterval: number; // seconds
    maxRetries: number;
    retryDelay: number; // milliseconds
    adaToLovelaceRatio: number; // ADA to Lovelace conversion
  };
  api: {
    blockfrostUrl: string;
    blockfrostKey: string;
    maxConcurrentRequests: number;
    priceApiUrl: string;
    priceApiKey?: string;
  };
  database: {
    supabaseUrl: string;
    supabasePublishableKey: string;
    supabaseServiceKey: string;
  };
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Get singleton instance of ConfigManager
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): AppConfig {
    return {
      app: {
        name: process.env.NEXT_PUBLIC_APP_NAME || 'Wallet Sync Service',
        environment: (process.env.NODE_ENV as AppConfig['app']['environment']) || 'development',
        debug: process.env.NODE_ENV !== 'production',
      },
      auth: {
        jwtSecret: process.env.SUPABASE_SIGNING_PRIVATE_JWK_B64 || '',
        jwtPublicKey: process.env.JWT_PUBLIC_KEY,
        jwtAlgorithm: process.env.JWT_ALGORITHM || 'ES256', // Default to ECDSA
        jwtKid: process.env.SUPABASE_SIGNING_KEY_KID || '',
        supabaseIssuer: process.env.JWT_ISSUER || '',
        tokenExpiresIn: parseInt(process.env.JWT_EXPIRES_IN || '1800', 10), // 30 minutes (production default)
        challengeTTL: parseInt(process.env.CHALLENGE_TTL || '300', 10), // 5 minutes
      },
      wallet: {
        syncInterval: parseInt(process.env.WALLET_SYNC_INTERVAL || '3600', 10), // 1 hour
        maxRetries: parseInt(process.env.WALLET_MAX_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.WALLET_RETRY_DELAY || '1000', 10),
        adaToLovelaceRatio: 1_000_000, // 1 ADA = 1,000,000 Lovelace
      },
      api: {
        blockfrostUrl: process.env.BLOCKFROST_URL || '',
        blockfrostKey: process.env.BLOCKFROST_KEY || '',
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10),
        priceApiUrl: process.env.PRICE_API_URL || 'https://api.coingecko.com/api/v3',
        priceApiKey: process.env.PRICE_API_KEY,
      },
      database: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      },
    };
  }

  /**
   * Validate that required configuration values are present
   */
  private validateConfiguration(): void {
    const isServer = typeof window === 'undefined';
    
    // Server-side and client-side have different required fields
    const requiredFields = [
      { path: 'database.supabaseUrl', value: this.config.database.supabaseUrl },
      { path: 'database.supabasePublishableKey', value: this.config.database.supabasePublishableKey },
    ];

    // Add server-side only required fields
    if (isServer) {
      requiredFields.push(
        { path: 'auth.jwtSecret', value: this.config.auth.jwtSecret },
        { path: 'auth.jwtKid', value: this.config.auth.jwtKid },
        { path: 'auth.supabaseIssuer', value: this.config.auth.supabaseIssuer },
        { path: 'api.blockfrostUrl', value: this.config.api.blockfrostUrl },
        { path: 'api.blockfrostKey', value: this.config.api.blockfrostKey }
      );
    }

    const missingFields = requiredFields
      .filter(field => !field.value)
      .map(field => field.path);

    if (missingFields.length > 0 && this.config.app.environment === 'production') {
      throw new ConfigurationError(
        `Missing required configuration: ${missingFields.join(', ')}`,
        { 
          missingFields,
          environment: this.config.app.environment,
          isServer
        }
      );
    }

    // Validate JWT algorithm is compatible with ECDSA
    const validECDSAAlgorithms = ['ES256', 'ES384', 'ES512'];
    if (!validECDSAAlgorithms.includes(this.config.auth.jwtAlgorithm)) {
      throw new ConfigurationError(
        `Invalid JWT algorithm: ${this.config.auth.jwtAlgorithm}. Expected one of: ${validECDSAAlgorithms.join(', ')}`,
        { 
          algorithm: this.config.auth.jwtAlgorithm,
          validAlgorithms: validECDSAAlgorithms
        }
      );
    }

    // Validate JWT secret format for Supabase integration
    // Only validate on server-side where JWT_SECRET should be available
    if (typeof window === 'undefined' && isServer) {
      // Check if JWT_SECRET is base64-encoded (expected format)
      if (this.config.auth.jwtSecret && !this.config.auth.jwtSecret.match(/^[A-Za-z0-9+/=]+$/)) {
        throw new ConfigurationError(
          'JWT_SECRET should be base64-encoded JWK for Supabase compatibility.',
          { 
            secretLength: this.config.auth.jwtSecret.length
          }
        );
      }
      
      // Validate KID format (should be a short identifier)
      if (this.config.auth.jwtKid && this.config.auth.jwtKid.length > 50) {
        throw new ConfigurationError(
          'JWT_KID should be a short key identifier from Supabase.',
          { 
            kidLength: this.config.auth.jwtKid.length
          }
        );
      }
      
      // Validate Supabase issuer URL format
      if (this.config.auth.supabaseIssuer && !this.config.auth.supabaseIssuer.includes('supabase.co/auth/v1')) {
        throw new ConfigurationError(
          'SUPABASE_AUTH_ISSUER_URL should be in format: https://project.supabase.co/auth/v1',
          { 
            issuer: this.config.auth.supabaseIssuer
          }
        );
      }
    }
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.config[section];
  }

  /**
   * Get the entire configuration object
   */
  public getAll(): AppConfig {
    return this.config;
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return this.config.app.environment === 'production';
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();