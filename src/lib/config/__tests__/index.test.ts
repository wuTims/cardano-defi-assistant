/**
 * Configuration Manager Tests
 */

import { config, AppConfig } from '../index';

describe('Configuration Manager', () => {
  describe('Configuration Structure', () => {
    test('should return valid app configuration', () => {
      const appConfig = config.get('app');

      expect(appConfig).toHaveProperty('name');
      expect(appConfig).toHaveProperty('environment');
      expect(appConfig).toHaveProperty('debug');
      
      expect(typeof appConfig.name).toBe('string');
      expect(['development', 'staging', 'production', 'test']).toContain(appConfig.environment);
      expect(typeof appConfig.debug).toBe('boolean');
    });

    test('should return valid database configuration', () => {
      const dbConfig = config.get('database');

      expect(dbConfig).toHaveProperty('supabaseUrl');
      expect(dbConfig).toHaveProperty('supabasePublicKey');
      expect(dbConfig).toHaveProperty('supabaseServiceKey');
      
      expect(typeof dbConfig.supabaseUrl).toBe('string');
      expect(typeof dbConfig.supabasePublicKey).toBe('string');
      expect(typeof dbConfig.supabaseServiceKey).toBe('string');
    });

    test('should return valid authentication configuration', () => {
      const authConfig = config.get('auth');

      expect(authConfig).toHaveProperty('jwtSecret');
      expect(authConfig).toHaveProperty('jwtAlgorithm');
      expect(authConfig).toHaveProperty('tokenExpiresIn');
      expect(authConfig).toHaveProperty('challengeTTL');
      
      expect(typeof authConfig.jwtSecret).toBe('string');
      expect(typeof authConfig.jwtAlgorithm).toBe('string');
      expect(typeof authConfig.tokenExpiresIn).toBe('number');
      expect(typeof authConfig.challengeTTL).toBe('number');
      
      // Validate reasonable values
      expect(authConfig.tokenExpiresIn).toBeGreaterThan(0);
      expect(authConfig.challengeTTL).toBeGreaterThan(0);
    });

    test('should return valid API configuration', () => {
      const apiConfig = config.get('api');

      expect(apiConfig).toHaveProperty('blockfrostUrl');
      expect(apiConfig).toHaveProperty('blockfrostKey');
      expect(apiConfig).toHaveProperty('maxConcurrentRequests');
      
      expect(typeof apiConfig.blockfrostUrl).toBe('string');
      expect(typeof apiConfig.blockfrostKey).toBe('string');
      expect(typeof apiConfig.maxConcurrentRequests).toBe('number');
      
      expect(apiConfig.maxConcurrentRequests).toBeGreaterThan(0);
    });

    test('should return valid wallet configuration', () => {
      const walletConfig = config.get('wallet');

      expect(walletConfig).toHaveProperty('syncInterval');
      expect(walletConfig).toHaveProperty('maxRetries');
      expect(walletConfig).toHaveProperty('retryDelay');
      
      expect(typeof walletConfig.syncInterval).toBe('number');
      expect(typeof walletConfig.maxRetries).toBe('number');
      expect(typeof walletConfig.retryDelay).toBe('number');
      
      // Validate reasonable values
      expect(walletConfig.syncInterval).toBeGreaterThan(0);
      expect(walletConfig.maxRetries).toBeGreaterThan(0);
      expect(walletConfig.retryDelay).toBeGreaterThan(0);
    });
  });

  describe('Configuration Methods', () => {
    test('should identify environment correctly', () => {
      const isDev = config.isDevelopment();
      const isProd = config.isProduction();

      expect(typeof isDev).toBe('boolean');
      expect(typeof isProd).toBe('boolean');
      
      // In test environment, should not be both true
      expect(!(isDev && isProd)).toBe(true);
    });

    test('should return entire configuration object', () => {
      const allConfig = config.getAll();

      expect(allConfig).toHaveProperty('app');
      expect(allConfig).toHaveProperty('auth');
      expect(allConfig).toHaveProperty('wallet');
      expect(allConfig).toHaveProperty('api');
      expect(allConfig).toHaveProperty('database');
      
      expect(typeof allConfig.app).toBe('object');
      expect(typeof allConfig.auth).toBe('object');
      expect(typeof allConfig.wallet).toBe('object');
      expect(typeof allConfig.api).toBe('object');
      expect(typeof allConfig.database).toBe('object');
    });
  });

  describe('Type Safety', () => {
    test('should return correctly typed configuration sections', () => {
      const appConfig: AppConfig['app'] = config.get('app');
      const authConfig: AppConfig['auth'] = config.get('auth');
      const walletConfig: AppConfig['wallet'] = config.get('wallet');
      const apiConfig: AppConfig['api'] = config.get('api');
      const databaseConfig: AppConfig['database'] = config.get('database');

      // This test passes if TypeScript compilation succeeds
      expect(typeof appConfig.name).toBe('string');
      expect(typeof authConfig.jwtSecret).toBe('string');
      expect(typeof walletConfig.syncInterval).toBe('number');
      expect(typeof apiConfig.blockfrostKey).toBe('string');
      expect(typeof databaseConfig.supabaseUrl).toBe('string');
    });
  });

  describe('Configuration Loading', () => {
    test('should load configuration without errors', () => {
      expect(() => {
        config.get('app');
        config.get('auth');
        config.get('wallet');
        config.get('api');
        config.get('database');
      }).not.toThrow();
    });

    test('should maintain configuration consistency across calls', () => {
      const config1 = config.get('app');
      const config2 = config.get('app');

      expect(config1).toEqual(config2);
      expect(config1).toBe(config2); // Should be same object reference due to singleton
    });
  });

  describe('Configuration Validation', () => {
    test('should have all required configuration keys', () => {
      const appConfig = config.get('app');
      const expectedAppKeys = ['name', 'environment', 'debug'];
      expectedAppKeys.forEach(key => {
        expect(appConfig).toHaveProperty(key);
      });

      const authConfig = config.get('auth');
      const expectedAuthKeys = ['jwtSecret', 'jwtAlgorithm', 'tokenExpiresIn', 'challengeTTL'];
      expectedAuthKeys.forEach(key => {
        expect(authConfig).toHaveProperty(key);
      });

      const walletConfig = config.get('wallet');
      const expectedWalletKeys = ['syncInterval', 'maxRetries', 'retryDelay'];
      expectedWalletKeys.forEach(key => {
        expect(walletConfig).toHaveProperty(key);
      });

      const apiConfig = config.get('api');
      const expectedApiKeys = ['blockfrostUrl', 'blockfrostKey', 'maxConcurrentRequests'];
      expectedApiKeys.forEach(key => {
        expect(apiConfig).toHaveProperty(key);
      });

      const databaseConfig = config.get('database');
      const expectedDbKeys = ['supabaseUrl', 'supabasePublicKey', 'supabaseServiceKey'];
      expectedDbKeys.forEach(key => {
        expect(databaseConfig).toHaveProperty(key);
      });
    });

    test('should have valid environment settings', () => {
      const appConfig = config.get('app');
      
      // Environment should be one of the valid values
      expect(['development', 'staging', 'production', 'test']).toContain(appConfig.environment);
      
      // Debug should correlate with environment (non-production = debug)
      if (appConfig.environment === 'production') {
        expect(appConfig.debug).toBe(false);
      } else {
        expect(appConfig.debug).toBe(true);
      }
    });

    test('should have reasonable default values', () => {
      const walletConfig = config.get('wallet');
      
      // Sync interval should be at least 1 minute (60 seconds)
      expect(walletConfig.syncInterval).toBeGreaterThanOrEqual(60);
      
      // Max retries should be reasonable (1-10)
      expect(walletConfig.maxRetries).toBeGreaterThanOrEqual(1);
      expect(walletConfig.maxRetries).toBeLessThanOrEqual(10);
      
      // Retry delay should be reasonable (100ms - 10 seconds)
      expect(walletConfig.retryDelay).toBeGreaterThanOrEqual(100);
      expect(walletConfig.retryDelay).toBeLessThanOrEqual(10000);
      
      const apiConfig = config.get('api');
      
      // Max concurrent requests should be reasonable (1-100)
      expect(apiConfig.maxConcurrentRequests).toBeGreaterThanOrEqual(1);
      expect(apiConfig.maxConcurrentRequests).toBeLessThanOrEqual(100);
    });
  });
});