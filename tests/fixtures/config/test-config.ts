/**
 * Centralized test configuration for Playwright tests
 */

export const testConfig = {
  // Base URLs and endpoints
  baseURL: 'http://localhost:3000',
  apiBaseURL: 'http://localhost:3000/api',
  
  // Timeouts (in milliseconds)
  timeouts: {
    default: 30000,
    navigation: 10000,
    api: 15000,
    walletConnection: 10000,
    walletSync: 20000,
    authentication: 8000,
    pageLoad: 15000
  },
  
  // Retry settings
  retries: {
    max: 3,
    minTimeout: 1000,
    factor: 2
  },
  
  // Browser configurations
  browser: {
    headless: process.env.CI === 'true',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    devtools: process.env.DEVTOOLS === 'true'
  },
  
  // Viewport configurations
  viewports: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 },
    ultrawide: { width: 2560, height: 1440 }
  },
  
  // Test data settings
  testData: {
    cleanupAfterTest: true,
    generateDynamicData: true,
    seedDatabase: false
  },
  
  // Environment-specific settings
  environments: {
    development: {
      baseURL: 'http://localhost:3000',
      debug: true,
      screenshots: 'on-failure',
      video: 'retain-on-failure'
    },
    staging: {
      baseURL: 'https://staging.wallet-sync.example.com',
      debug: false,
      screenshots: 'only-on-failure',
      video: 'off'
    },
    production: {
      baseURL: 'https://wallet-sync.example.com',
      debug: false,
      screenshots: 'off',
      video: 'off'
    }
  },
  
  // Selector strategies
  selectors: {
    strategy: 'data-testid', // 'data-testid' | 'css' | 'xpath'
    fallbackStrategy: 'css',
    timeout: 10000
  },
  
  // API mock settings
  mocks: {
    enabled: true,
    responseDelay: 100,
    failureRate: 0.05 // 5% random failure rate for resilience testing
  },

  // AUTH BYPASS SETTINGS - TEST ONLY
  authBypass: {
    enabled: isTestEnvironmentSafe(),
    requireExplicitEnable: true,
    safetyChecks: true
  }
} as const;

/**
 * SAFETY GUARD: Ensures auth bypass only works in test environment
 * This is the primary safety mechanism to prevent bypass in production
 */
function isTestEnvironmentSafe(): boolean {
  return (
    process.env.NODE_ENV === 'test' && 
    (process.env.PLAYWRIGHT_TEST === 'true' || process.env.JEST_WORKER_ID !== undefined)
  );
}

// Get current environment configuration
export function getEnvironmentConfig() {
  const env = process.env.TEST_ENV || 'development';
  return testConfig.environments[env as keyof typeof testConfig.environments] || testConfig.environments.development;
}

// Generate test-specific timeout based on operation type
export function getTimeout(operation: keyof typeof testConfig.timeouts): number {
  return testConfig.timeouts[operation];
}

// Check if running in CI environment
export function isCIEnvironment(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

/**
 * SAFETY GUARD: Validates that auth bypass can be safely used
 * Throws error if not in test environment - prevents accidental production usage
 */
export function validateAuthBypassSafety(operationName: string): void {
  if (!testConfig.authBypass.enabled) {
    throw new Error(
      `AUTH BYPASS BLOCKED: ${operationName} attempted outside test environment. ` +
      `This is a security feature. Auth bypass only available when NODE_ENV=test and PLAYWRIGHT_TEST=true.`
    );
  }
}

/**
 * Check if auth bypass is safely enabled
 */
export function isAuthBypassSafelyEnabled(): boolean {
  return testConfig.authBypass.enabled && testConfig.authBypass.safetyChecks;
}

export type TestEnvironment = keyof typeof testConfig.environments;
export type TimeoutType = keyof typeof testConfig.timeouts;
export type ViewportType = keyof typeof testConfig.viewports;
