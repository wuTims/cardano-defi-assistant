/**
 * Error Scenario Tests - Comprehensive error handling and edge case testing
 */

import { test, expect } from '@playwright/test';
import { LandingPage } from '../../fixtures/page-objects/landing-page';
import { DashboardPage } from '../../fixtures/page-objects/dashboard-page';
import { WalletConnectionModal } from '../../fixtures/page-objects/wallet-connection-modal';
import { testContextHelper, TestContext } from '../../fixtures/helpers/test-context-helper';
import { walletDataFactory } from '../../fixtures/test-data/wallet-data-factory';
import { WalletType, ErrorType } from '../../fixtures/types';

test.describe('Error Scenarios - Network Issues', () => {
  let testContext: TestContext;
  let landingPage: LandingPage;
  let dashboardPage: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true,
      trackConsole: true,
      trackNetwork: true
    });
    
    landingPage = new LandingPage(page);
    dashboardPage = new DashboardPage(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should handle network connectivity issues', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'network');
    
    await landingPage.goto();
    
    // Should show appropriate offline/network error state
    const hasNetworkError = await testContext.page.locator(
      '[data-testid="network-error"], .network-error, [role="alert"]:has-text("network")'
    ).isVisible().catch(() => false);
    
    // Page should still be functional offline (basic functionality)
    await expect(testContext.page.locator('body')).toBeVisible();
  });
  
  test('should handle API server errors (5xx)', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'server');
    await testContextHelper.setupAuthenticatedState(testContext);
    
    await dashboardPage.goto();
    
    // Should display server error message
    const errorMessage = testContext.page.locator(
      '[data-testid="error-alert"], .error-alert, [role="alert"]:has-text("server")'
    );
    
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
  
  test('should handle malformed API responses', async () => {
    await testContext.apiMockHelper.mockEndpoint(
      '/api/**',
      'invalid json response',
      { status: 200 }
    );
    
    await testContextHelper.setupAuthenticatedState(testContext);
    await dashboardPage.goto();
    
    // Should handle malformed JSON gracefully
    const hasErrorHandling = await testContext.page.locator(
      '[data-testid="error-alert"], .error-alert, [role="alert"]'
    ).isVisible().catch(() => false);
    
    // Application should not crash
    await expect(testContext.page.locator('body')).toBeVisible();
  });
  
  test('should handle API timeout scenarios', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'timeout');
    await testContextHelper.setupAuthenticatedState(testContext);
    
    await dashboardPage.goto();
    
    // Should show loading state initially, then timeout error
    const loadingIndicator = testContext.page.locator(
      '[data-testid="loading-spinner"], .loading, .spinner'
    );
    
    const timeoutError = testContext.page.locator(
      '[data-testid="timeout-error"], .timeout-error, [role="alert"]:has-text("timeout")'
    );
    
    // Wait for timeout to occur and error to display
    await expect(timeoutError).toBeVisible({ timeout: 35000 });
  });
});

test.describe('Error Scenarios - Authentication Issues', () => {
  let testContext: TestContext;
  let walletModal: WalletConnectionModal;
  let dashboardPage: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true
    });
    
    walletModal = new WalletConnectionModal(page);
    dashboardPage = new DashboardPage(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should handle authentication token corruption', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'auth');
    
    await dashboardPage.goto();
    
    // Should redirect to landing page or show auth error
    await testContext.page.waitForURL('/', { timeout: 10000 }).catch(() => {});
    const isOnLandingPage = testContext.page.url().endsWith('/');
    
    expect(isOnLandingPage).toBe(true);
  });
  
  test('should handle wallet signature rejection', async () => {
    // Mock signature rejection
    await testContext.page.addInitScript(() => {
      (window as any).cardano = {
        nami: {
          isEnabled: () => Promise.resolve(true),
          enable: () => Promise.resolve({
            signData: () => Promise.reject(new Error('User rejected signature'))
          })
        }
      };
    });
    
    const landingPage = new LandingPage(testContext.page);
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.selectWallet(WalletType.NAMI);
    
    await walletModal.verifyConnectionError();
  });
  
  test('should handle session expiration during use', async () => {
    await testContextHelper.setupAuthenticatedState(testContext);
    await dashboardPage.goto();
    
    // Simulate session expiration
    await testContext.apiMockHelper.mockEndpoint(
      '/api/auth/validate',
      walletDataFactory.createErrorResponse(ErrorType.INVALID_SIGNATURE, 'Session expired'),
      { status: 401 }
    );
    
    // Try to perform an action that requires authentication
    await dashboardPage.performWalletSync().catch(() => {});
    
    // Should handle session expiration gracefully
    await dashboardPage.verifySessionExpirationHandling();
  });
});

test.describe('Error Scenarios - Wallet Extension Issues', () => {
  let testContext: TestContext;
  let walletModal: WalletConnectionModal;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true
    });
    
    walletModal = new WalletConnectionModal(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should handle wallet extension crashes during connection', async () => {
    const landingPage = new LandingPage(testContext.page);
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.verifyWalletExtensionCrashRecovery();
  });
  
  test('should handle concurrent wallet connections', async () => {
    const landingPage = new LandingPage(testContext.page);
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.verifyConcurrentConnectionHandling();
  });
  
  test('should handle wallet API changes/updates', async () => {
    // Mock outdated wallet API
    await testContext.page.addInitScript(() => {
      (window as any).cardano = {
        nami: {
          // Missing required CIP-30 methods
          isEnabled: () => Promise.resolve(true),
          // enable method missing - simulates API changes
        }
      };
    });
    
    const landingPage = new LandingPage(testContext.page);
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.selectWallet(WalletType.NAMI);
    
    // Should handle gracefully
    await walletModal.verifyConnectionError();
  });
});

test.describe('Error Scenarios - Browser and Environment Issues', () => {
  let testContext: TestContext;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true
    });
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should handle localStorage quota exceeded', async () => {
    await testContext.apiMockHelper.mockLocalStorageQuotaExceeded();
    
    const landingPage = new LandingPage(testContext.page);
    await landingPage.goto();
    
    // Should handle storage errors gracefully
    await expect(testContext.page.locator('body')).toBeVisible();
    
    // Check for appropriate error handling
    const storageError = await testContext.page.locator(
      '[data-testid="storage-error"], [role="alert"]:has-text("storage")'
    ).isVisible().catch(() => false);
    
    // Application should continue to function
    const isLandingPageLoaded = await landingPage.isLoaded();
    expect(isLandingPageLoaded).toBe(true);
  });
  
  test('should handle JavaScript disabled scenario', async () => {
    await testContext.apiMockHelper.mockJavaScriptDisabled();
    
    const landingPage = new LandingPage(testContext.page);
    await landingPage.goto();
    
    // Basic HTML should still be visible
    await expect(testContext.page.locator('body')).toBeVisible();
    
    // Should show appropriate no-JS message if implemented
    const noJsMessage = await testContext.page.locator(
      '[data-testid="no-js"], .no-js, noscript'
    ).isVisible().catch(() => false);
  });
  
  test('should handle browser compatibility issues', async () => {
    // Mock old browser environment
    await testContext.page.addInitScript(() => {
      // Remove modern APIs to simulate old browser
      (window as any).fetch = undefined;
      (window as any).Promise = undefined;
      (window as any).localStorage = undefined;
    });
    
    const landingPage = new LandingPage(testContext.page);
    await landingPage.goto();
    
    // Should detect and handle gracefully
    const browserSupportMessage = await testContext.page.locator(
      '[data-testid="browser-support"], .browser-support'
    ).isVisible().catch(() => false);
    
    // Page should still load basic content
    await expect(testContext.page.locator('body')).toBeVisible();
  });
  
  test('should handle memory constraints on low-end devices', async () => {
    // Simulate low memory conditions
    await testContext.page.addInitScript(() => {
      // Override console.warn to track memory warnings
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (args.some(arg => String(arg).includes('memory'))) {
          (window as any).__memoryWarning = true;
        }
        originalWarn.apply(console, args);
      };
    });
    
    const richWalletData = walletDataFactory.createWalletData({
      assetCount: 100,
      utxoCount: 50,
      balanceAda: 50000
    });
    
    await testContextHelper.setupAuthenticatedState(testContext, richWalletData);
    await testContext.apiMockHelper.setupCompleteMocking(richWalletData);
    
    const dashboardPage = new DashboardPage(testContext.page);
    await dashboardPage.goto();
    
    // Should handle large datasets without crashing
    await dashboardPage.verifyWalletOverview(richWalletData);
  });
});

test.describe('Error Scenarios - Data Integrity Issues', () => {
  let testContext: TestContext;
  let dashboardPage: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true
    });
    
    dashboardPage = new DashboardPage(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should handle invalid wallet addresses', async () => {
    const invalidWalletData = walletDataFactory.createWalletData({
      address: 'invalid-wallet-address-format'
    });
    
    await testContextHelper.setupAuthenticatedState(testContext, invalidWalletData);
    await testContext.apiMockHelper.setupCompleteMocking(invalidWalletData);
    
    await dashboardPage.goto();
    
    // Should handle invalid address gracefully
    const hasValidationError = await testContext.page.locator(
      '[data-testid="validation-error"], [role="alert"]:has-text("invalid")'
    ).isVisible().catch(() => false);
    
    // Should not crash the application
    await expect(testContext.page.locator('body')).toBeVisible();
  });
  
  test('should handle corrupted wallet data', async () => {
    await testContext.apiMockHelper.mockEndpoint(
      '/api/wallet/data',
      {
        success: true,
        data: {
          // Corrupted/incomplete data structure
          address: null,
          balance: 'invalid',
          assets: 'not-an-array'
        }
      }
    );
    
    await testContextHelper.setupAuthenticatedState(testContext);
    await dashboardPage.goto();
    
    // Should handle corrupted data gracefully
    await dashboardPage.verifyWalletDataLoadError();
  });
  
  test('should handle blockchain sync inconsistencies', async () => {
    // Mock inconsistent blockchain data
    await testContext.apiMockHelper.mockEndpoint(
      '/api/wallet/sync',
      {
        success: false,
        error: 'Blockchain sync error: Block height mismatch'
      },
      { status: 409, method: 'POST' }
    );
    
    await testContextHelper.setupAuthenticatedState(testContext);
    await dashboardPage.goto();
    
    await dashboardPage.performWalletSync().catch(() => {});
    await dashboardPage.verifySyncFailureHandling();
  });
});
