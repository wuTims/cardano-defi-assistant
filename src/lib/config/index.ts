/**
 * ConfigManager - Centralized configuration management
 * 
 * Provides a single source of truth for all application configuration.
 * No hardcoded values - everything is configurable via environment variables
 * with sensible defaults for development.
 */

export interface AppConfig {
  app: {
    name: string;
    environment: 'development' | 'staging' | 'production';
    debug: boolean;
  };
  auth: {
    jwtSecret: string;
    jwtAlgorithm: string;
    tokenExpiresIn: number; // seconds
    challengeTTL: number; // seconds
  };
  wallet: {
    syncInterval: number; // seconds
    maxRetries: number;
    retryDelay: number; // milliseconds
  };
  api: {
    blockfrostUrl: string;
    blockfrostKey: string;
    maxConcurrentRequests: number;
  };
  database: {
    supabaseUrl: string;
    supabasePublicKey: string;
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
        jwtSecret: process.env.JWT_SECRET || '',
        jwtAlgorithm: process.env.JWT_ALGORITHM || 'HS256',
        tokenExpiresIn: parseInt(process.env.JWT_EXPIRES_IN || '604800', 10), // 7 days
        challengeTTL: parseInt(process.env.CHALLENGE_TTL || '300', 10), // 5 minutes
      },
      wallet: {
        syncInterval: parseInt(process.env.WALLET_SYNC_INTERVAL || '3600', 10), // 1 hour
        maxRetries: parseInt(process.env.WALLET_MAX_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.WALLET_RETRY_DELAY || '1000', 10),
      },
      api: {
        blockfrostUrl: process.env.BLOCKFROST_URL || '',
        blockfrostKey: process.env.BLOCKFROST_KEY || '',
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10),
      },
      database: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabasePublicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      },
    };
  }

  /**
   * Validate that required configuration values are present
   */
  private validateConfiguration(): void {
    const requiredFields = [
      { path: 'auth.jwtSecret', value: this.config.auth.jwtSecret },
      { path: 'database.supabaseUrl', value: this.config.database.supabaseUrl },
      { path: 'database.supabasePublicKey', value: this.config.database.supabasePublicKey },
    ];

    const missingFields = requiredFields
      .filter(field => !field.value)
      .map(field => field.path);

    if (missingFields.length > 0 && this.config.app.environment === 'production') {
      throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
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