/**
 * Test Context Helper - Manages test setup, teardown, and context sharing
 */

import { Page, BrowserContext, test } from '@playwright/test';
import { ApiMockHelper } from './api-mock-helper';
import { walletDataFactory, TestWalletData } from '../test-data/wallet-data-factory';
import { testConfig, validateAuthBypassSafety, isAuthBypassSafelyEnabled } from '../config/test-config';
import { ErrorType } from '../types';

export interface TestContext {
  page: Page;
  context: BrowserContext;
  apiMockHelper: ApiMockHelper;
  walletData: TestWalletData;
  consoleLogs: string[];
  networkLogs: Array<{
    url: string;
    method: string;
    status: number;
    response?: any;
  }>;
}

export class TestContextHelper {
  private static instance: TestContextHelper;
  private contexts: Map<string, TestContext> = new Map();
  
  public static getInstance(): TestContextHelper {
    if (!TestContextHelper.instance) {
      TestContextHelper.instance = new TestContextHelper();
    }
    return TestContextHelper.instance;
  }
  
  /**
   * Setup comprehensive test context
   */
  async setupTestContext(
    page: Page, 
    options: {
      walletData?: TestWalletData;
      mockApis?: boolean;
      trackConsole?: boolean;
      trackNetwork?: boolean;
      scenario?: 'basic' | 'rich-wallet' | 'empty-wallet' | 'nft-collector';
    } = {}
  ): Promise<TestContext> {
    const {
      walletData,
      mockApis = true,
      trackConsole = true,
      trackNetwork = true,
      scenario = 'basic'
    } = options;
    
    const context = page.context();
    const apiMockHelper = new ApiMockHelper(page);
    
    // Generate or use provided wallet data
    let testWalletData: TestWalletData;
    if (walletData) {
      testWalletData = walletData;
    } else {
      const scenarios = {
        'basic': () => walletDataFactory.createWalletData(),
        'rich-wallet': () => walletDataFactory.createWalletData({ 
          balanceAda: 10000, 
          assetCount: 10, 
          utxoCount: 20 
        }),
        'empty-wallet': () => walletDataFactory.createWalletData({ 
          balanceAda: 0, 
          assetCount: 0, 
          utxoCount: 1 
        }),
        'nft-collector': () => walletDataFactory.createWalletData({ 
          balanceAda: 500, 
          assetCount: 50, 
          utxoCount: 15 
        })
      };
      testWalletData = scenarios[scenario]();
    }
    
    // Setup API mocking if enabled
    if (mockApis) {
      await apiMockHelper.setupCompleteMocking(testWalletData);
    }
    
    const testContext: TestContext = {
      page,
      context,
      apiMockHelper,
      walletData: testWalletData,
      consoleLogs: [],
      networkLogs: []
    };
    
    // Setup console logging if enabled
    if (trackConsole) {
      await this.setupConsoleTracking(testContext);
    }
    
    // Setup network logging if enabled
    if (trackNetwork) {
      await this.setupNetworkTracking(testContext);
    }
    
    // Setup browser permissions
    await this.setupBrowserPermissions(context);
    
    // Setup global test configuration
    await this.setupGlobalTestConfig(page);
    
    const contextId = this.generateContextId();
    this.contexts.set(contextId, testContext);
    
    return testContext;
  }
  
  /**
   * Setup console tracking
   */
  private async setupConsoleTracking(testContext: TestContext): Promise<void> {
    testContext.page.on('console', (msg) => {
      const logEntry = `${msg.type()}: ${msg.text()}`;
      testContext.consoleLogs.push(logEntry);
      
      // Log to test output in CI environments
      if (testConfig.browser.devtools) {
        console.log(`[BROWSER CONSOLE] ${logEntry}`);
      }
    });
    
    // Track page errors
    testContext.page.on('pageerror', (error) => {
      const errorEntry = `error: ${error.message}`;
      testContext.consoleLogs.push(errorEntry);
      
      if (testConfig.browser.devtools) {
        console.error(`[PAGE ERROR] ${error.message}`, error.stack);
      }
    });
  }
  
  /**
   * Setup network request tracking
   */
  private async setupNetworkTracking(testContext: TestContext): Promise<void> {
    testContext.page.on('request', (request) => {
      if (testConfig.browser.devtools) {
        console.log(`[REQUEST] ${request.method()} ${request.url()}`);
      }
    });
    
    testContext.page.on('response', async (response) => {
      const networkLog = {
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        response: undefined as any
      };
      
      // Capture response body for API calls
      if (response.url().includes('/api/')) {
        try {
          networkLog.response = await response.json();
        } catch {
          // Response might not be JSON
        }
      }
      
      testContext.networkLogs.push(networkLog);
      
      if (testConfig.browser.devtools) {
        console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
      }
    });
  }
  
  /**
   * Setup browser permissions and context
   */
  private async setupBrowserPermissions(context: BrowserContext): Promise<void> {
    // Grant necessary permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Setup user agent if needed
    if (process.env.TEST_USER_AGENT) {
      await context.setExtraHTTPHeaders({
        'User-Agent': process.env.TEST_USER_AGENT
      });
    }
    
    // Setup geolocation if needed for regional testing
    if (process.env.TEST_GEOLOCATION) {
      const [latitude, longitude] = process.env.TEST_GEOLOCATION.split(',').map(Number);
      await context.setGeolocation({ latitude, longitude });
    }
  }
  
  /**
   * Setup global test configuration
   */
  private async setupGlobalTestConfig(page: Page): Promise<void> {
    // Inject test configuration into the page
    await page.addInitScript((config) => {
      (window as any).__TEST_CONFIG__ = config;
      (window as any).__TEST_MODE__ = true;
    }, testConfig);
    
    // Setup viewport
    const viewport = testConfig.viewports.desktop;
    await page.setViewportSize(viewport);
    
    // Setup default timeouts
    page.setDefaultTimeout(testConfig.timeouts.default);
    page.setDefaultNavigationTimeout(testConfig.timeouts.navigation);
  }
  
  /**
   * Setup authentication state for authenticated tests
   */
  async setupAuthenticatedState(
    testContext: TestContext, 
    customWalletData?: TestWalletData,
    options: {
      bypassWalletConnection?: boolean;
      mockApiEndpoints?: boolean;
    } = {}
  ): Promise<void> {
    const { bypassWalletConnection = false, mockApiEndpoints = true } = options;
    
    // SAFETY GUARD: Validate bypass is safe to use
    if (bypassWalletConnection) {
      validateAuthBypassSafety('setupAuthenticatedState with bypassWalletConnection');
    }

    const walletData = customWalletData || testContext.walletData;
    const jwtToken = walletDataFactory.generateJWTToken(walletData.address, walletData.walletType);
    
    // Set up authentication state in localStorage
    await testContext.page.addInitScript((authData) => {
      const { token, walletAddress, walletType, bypassEnabled } = authData;
      localStorage.setItem('auth-token', token);
      localStorage.setItem('wallet-address', walletAddress);
      localStorage.setItem('wallet-type', walletType);
      localStorage.setItem('auth-timestamp', Date.now().toString());
      
      // Mark as bypassed for debugging purposes
      if (bypassEnabled) {
        localStorage.setItem('auth-bypass-mode', 'true');
        console.log('[TEST-ONLY] Auth bypass mode enabled for testing');
      }
    }, {
      token: jwtToken,
      walletAddress: walletData.address,
      walletType: walletData.walletType,
      bypassEnabled: bypassWalletConnection
    });

    // Set up API endpoint mocking if bypass is enabled
    if (bypassWalletConnection && mockApiEndpoints) {
      await this.setupAuthBypassApiMocks(testContext, walletData, jwtToken);
    }
  }

  /**
   * TEST-ONLY: Setup API mocks for auth bypass
   * SAFETY: Only works when environment safety checks pass
   */
  private async setupAuthBypassApiMocks(
    testContext: TestContext,
    walletData: TestWalletData,
    jwtToken: string
  ): Promise<void> {
    // SAFETY GUARD: Double-check environment safety
    if (!isAuthBypassSafelyEnabled()) {
      throw new Error('AUTH BYPASS API MOCKS: Safety check failed - not in test environment');
    }

    const { page } = testContext;

    // Mock auth challenge endpoint
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: walletData.address,
            nonce: 'test-bypass-nonce',
            challenge: 'test-bypass-challenge',
            expiresAt: new Date(Date.now() + 300000).toISOString()
          }
        })
      });
    });

    // Mock auth verify endpoint
    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: jwtToken,
            walletAddress: walletData.address,
            walletType: walletData.walletType
          }
        })
      });
    });

    // Mock auth refresh endpoint
    await page.route('/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: jwtToken,
            walletAddress: walletData.address,
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        })
      });
    });

    // Mock wallet data endpoint for dashboard
    await page.route('/api/wallet/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            address: walletData.address,
            balance: walletData.balance,
            utxos: walletData.utxos,
            lastSyncedAt: new Date().toISOString(),
            syncedBlockHeight: 12345678
          }
        })
      });
    });

    console.log('[TEST-ONLY] Auth bypass API mocks configured');
  }
  
  /**
   * Clear authentication state
   */
  async clearAuthenticatedState(testContext: TestContext): Promise<void> {
    await testContext.page.addInitScript(() => {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('wallet-address');
      localStorage.removeItem('wallet-type');
      localStorage.removeItem('auth-timestamp');
      localStorage.removeItem('auth-bypass-mode'); // Clean up bypass marker
    });
  }

  /**
   * TEST-ONLY: Navigate directly to dashboard with authenticated bypass state
   * SAFETY: Only works in test environment with safety guards
   */
  async navigateToAuthenticatedDashboard(
    testContext: TestContext,
    customWalletData?: TestWalletData
  ): Promise<void> {
    // SAFETY GUARD: Validate environment
    validateAuthBypassSafety('navigateToAuthenticatedDashboard');
    
    // Setup authenticated state with bypass
    await this.setupAuthenticatedState(testContext, customWalletData, {
      bypassWalletConnection: true,
      mockApiEndpoints: true
    });
    
    // Navigate directly to dashboard
    await testContext.page.goto('/dashboard');
    
    console.log('[TEST-ONLY] Navigated to dashboard with auth bypass');
  }
  
  /**
   * Setup error scenario context
   */
  async setupErrorScenario(
    testContext: TestContext,
    errorType: 'network' | 'server' | 'auth' | 'validation' | 'timeout'
  ): Promise<void> {
    switch (errorType) {
      case 'network':
        await testContext.apiMockHelper.mockErrorScenarios();
        break;
      case 'server':
        await testContext.apiMockHelper.mockEndpoint('/api/**', 
          walletDataFactory.createErrorResponse(ErrorType.SERVER_ERROR),
          { status: 500, failureRate: 1.0 }
        );
        break;
      case 'auth':
        await testContext.apiMockHelper.mockTokenCorruption();
        break;
      case 'validation':
        await testContext.apiMockHelper.mockEndpoint('/api/**',
          walletDataFactory.createErrorResponse(ErrorType.VALIDATION_ERROR),
          { status: 400, failureRate: 1.0 }
        );
        break;
      case 'timeout':
        await testContext.apiMockHelper.mockEndpoint('/api/**',
          { message: 'Timeout' },
          { delay: 30000, failureRate: 1.0 }
        );
        break;
    }
  }
  
  /**
   * Take comprehensive screenshot for debugging
   */
  async takeDebugScreenshot(
    testContext: TestContext, 
    name: string, 
    fullPage = true
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug-${name}-${timestamp}.png`;
    const path = `test-results/debug-screenshots/${filename}`;
    
    await testContext.page.screenshot({ 
      path,
      fullPage,
      animations: 'disabled'
    });
    
    return path;
  }
  
  /**
   * Generate test report data
   */
  generateTestReport(testContext: TestContext): {
    consoleLogs: string[];
    networkLogs: any[];
    walletData: TestWalletData;
    errorLogs: string[];
    networkErrors: any[];
  } {
    const errorLogs = testContext.consoleLogs.filter(log => 
      log.startsWith('error:') || log.startsWith('pageerror:')
    );
    
    const networkErrors = testContext.networkLogs.filter(log => 
      log.status >= 400
    );
    
    return {
      consoleLogs: testContext.consoleLogs,
      networkLogs: testContext.networkLogs,
      walletData: testContext.walletData,
      errorLogs,
      networkErrors
    };
  }
  
  /**
   * Cleanup test context
   */
  async cleanupTestContext(testContext: TestContext): Promise<void> {
    try {
      // Clear API mocks
      await testContext.apiMockHelper.clearAllMocks();
      
      // Clear localStorage and sessionStorage
      await testContext.page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      // Remove event listeners
      testContext.page.removeAllListeners();
      
      // Generate test report if in debug mode
      if (testConfig.browser.devtools) {
        const report = this.generateTestReport(testContext);
        console.log('[TEST REPORT]', JSON.stringify(report, null, 2));
      }
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  }
  
  /**
   * Generate unique context ID
   */
  private generateContextId(): string {
    return `test-context-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Wait for application to be ready
   */
  async waitForApplicationReady(testContext: TestContext): Promise<void> {
    await testContext.page.waitForLoadState('networkidle');
    
    // Wait for React to hydrate
    await testContext.page.waitForFunction(() => {
      return (window as any).__NEXT_HYDRATED || document.readyState === 'complete';
    }, { timeout: 10000 }).catch(() => {
      // If Next.js hydration marker doesn't exist, continue
    });
    
    // Wait for any loading spinners to disappear
    const loadingElements = [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      '[data-loading="true"]'
    ];
    
    for (const selector of loadingElements) {
      await testContext.page.locator(selector).waitFor({ 
        state: 'hidden', 
        timeout: 5000 
      }).catch(() => {
        // Ignore if element doesn't exist
      });
    }
  }
  
  /**
   * Create a test fixture for Playwright test.use()
   */
  static createTestFixture() {
    return {
      testContext: async ({ page }: { page: Page }, use: any) => {
        const helper = TestContextHelper.getInstance();
        const testContext = await helper.setupTestContext(page);
        
        await use(testContext);
        
        await helper.cleanupTestContext(testContext);
      }
    };
  }
}

// Export singleton instance
export const testContextHelper = TestContextHelper.getInstance();

// Export Playwright fixture
export const testFixtures = TestContextHelper.createTestFixture();
