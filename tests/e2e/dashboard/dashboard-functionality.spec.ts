/**
 * Dashboard Functionality Tests - Comprehensive dashboard feature testing
 */

import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../fixtures/page-objects/dashboard-page';
import { testContextHelper, TestContext } from '../../fixtures/helpers/test-context-helper';
import { testScenarios } from '../../fixtures/test-data/wallet-data-factory';

test.describe('Dashboard Core Functionality', () => {
  let testContext: TestContext;
  let dashboardPage: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true,
      trackConsole: true,
      trackNetwork: true
    });
    
    // Use auth bypass to skip wallet connection flow and focus on dashboard testing
    await testContextHelper.setupAuthenticatedState(testContext, undefined, {
      bypassWalletConnection: true,
      mockApiEndpoints: true
    });
    dashboardPage = new DashboardPage(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should display comprehensive wallet overview information', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifyDashboardComplete(testContext.walletData);
  });
  
  test('should display wallet balance correctly', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifyWalletBalance(testContext.walletData.balance);
  });
  
  test('should display wallet assets if any exist', async () => {
    const richWalletData = testScenarios.richWallet();
    // Use auth bypass for rich wallet scenario testing
    await testContextHelper.setupAuthenticatedState(testContext, richWalletData, {
      bypassWalletConnection: true,
      mockApiEndpoints: true
    });
    
    await dashboardPage.goto();
    await dashboardPage.verifyWalletAssets(richWalletData.assets.length);
  });
  
  test('should display wallet UTXOs information', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifyUTXOsInformation(testContext.walletData.utxos.length);
  });
  
  test('should display staking information when available', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifyStakingInformation(testContext.walletData.stakingInfo.isActive);
  });
  
  test('should display wallet type information', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifyWalletTypeInformation(testContext.walletData.walletType);
  });
  
  test('should have functional sync wallet button', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifySyncButtonFunctionality();
  });
  
  test('should update wallet data after successful sync', async () => {
    await dashboardPage.goto();
    await dashboardPage.performWalletSync();
    await dashboardPage.verifyWalletDataAfterSync();
  });
  
  test('should handle sync failure gracefully', async () => {
    // Mock sync failure
    await testContext.apiMockHelper.mockEndpoint(
      '/api/wallet/sync',
      { success: false, error: 'Sync failed' },
      { status: 500, method: 'POST', failureRate: 1.0 }
    );
    
    await dashboardPage.goto();
    
    try {
      await dashboardPage.performWalletSync();
    } catch {
      // Expected to fail
    }
    
    await dashboardPage.verifySyncFailureHandling();
  });
  
  test('should have proper navigation elements', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifyNavigationElements();
  });
  
  test('should provide wallet disconnect functionality', async () => {
    await dashboardPage.goto();
    await dashboardPage.performWalletDisconnect();
    
    // Should redirect away from dashboard
    const currentUrl = testContext.page.url();
    expect(currentUrl).not.toMatch(/dashboard/);
  });
  
  test('should be responsive on mobile devices', async () => {
    await dashboardPage.goto();
    await dashboardPage.verifyMobileResponsiveness();
  });
  
  test('should redirect unauthenticated users to landing page', async () => {
    await testContextHelper.clearAuthenticatedState(testContext);
    await dashboardPage.goto();
    
    // Should redirect to landing page
    await testContext.page.waitForURL('/');
    expect(testContext.page.url()).toMatch(/\/$/);
  });
});

test.describe('Dashboard Data Scenarios', () => {
  let testContext: TestContext;
  let dashboardPage: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      mockApis: true
    });
    dashboardPage = new DashboardPage(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should handle empty wallet scenario', async () => {
    const emptyWalletData = testScenarios.emptyWallet();
    await testContextHelper.setupAuthenticatedState(testContext, emptyWalletData);
    await testContext.apiMockHelper.setupCompleteMocking(emptyWalletData);
    
    await dashboardPage.goto();
    await dashboardPage.verifyWalletBalance(emptyWalletData.balance);
    await dashboardPage.verifyWalletAssets(0);
  });
  
  test('should handle rich wallet scenario', async () => {
    const richWalletData = testScenarios.richWallet();
    await testContextHelper.setupAuthenticatedState(testContext, richWalletData);
    await testContext.apiMockHelper.setupCompleteMocking(richWalletData);
    
    await dashboardPage.goto();
    await dashboardPage.verifyWalletBalance(richWalletData.balance);
    await dashboardPage.verifyWalletAssets(richWalletData.assets.length);
    await dashboardPage.verifyUTXOsInformation(richWalletData.utxos.length);
  });
  
  test('should handle NFT collector scenario', async () => {
    const nftCollectorData = testScenarios.nftCollector();
    await testContextHelper.setupAuthenticatedState(testContext, nftCollectorData);
    await testContext.apiMockHelper.setupCompleteMocking(nftCollectorData);
    
    await dashboardPage.goto();
    await dashboardPage.verifyWalletAssets(nftCollectorData.assets.length);
  });
});

test.describe('Dashboard Error Handling', () => {
  let testContext: TestContext;
  let dashboardPage: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true
    });
    
    await testContextHelper.setupAuthenticatedState(testContext);
    dashboardPage = new DashboardPage(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should handle gracefully when wallet data fails to load', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'server');
    
    await dashboardPage.goto();
    await dashboardPage.verifyWalletDataLoadError();
  });
  
  test('should handle session expiration gracefully', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'auth');
    
    await dashboardPage.goto();
    await dashboardPage.verifySessionExpirationHandling();
  });
  
  test('should handle network connectivity issues', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'network');
    
    await dashboardPage.goto();
    
    // Should show appropriate error messaging
    const errorElements = await testContext.page.locator('[role="alert"], .error-alert').count();
    expect(errorElements).toBeGreaterThan(0);
  });
  
  test('should recover from temporary API failures', async () => {
    // Start with failing API
    await testContextHelper.setupErrorScenario(testContext, 'server');
    
    await dashboardPage.goto();
    
    // Fix the API and retry
    await testContext.apiMockHelper.setupCompleteMocking(testContext.walletData);
    
    // Reload page to retry
    await testContext.page.reload();
    await dashboardPage.verifyWalletOverview(testContext.walletData);
  });
});

test.describe('Dashboard Performance', () => {
  test('should load wallet data within acceptable time limits', async ({ page }) => {
    const testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true
    });
    
    await testContextHelper.setupAuthenticatedState(testContext);
    
    const startTime = Date.now();
    
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.waitForWalletDataLoad();
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    await testContextHelper.cleanupTestContext(testContext);
  });
  
  test('should handle large datasets efficiently', async ({ page }) => {
    const richWalletData = testScenarios.richWallet();
    
    const testContext = await testContextHelper.setupTestContext(page, {
      walletData: richWalletData,
      mockApis: true
    });
    
    await testContextHelper.setupAuthenticatedState(testContext, richWalletData);
    
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // Should still load efficiently with large datasets
    const startTime = Date.now();
    await dashboardPage.waitForWalletDataLoad();
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(8000); // Slightly more lenient for large data
    
    await testContextHelper.cleanupTestContext(testContext);
  });
});
