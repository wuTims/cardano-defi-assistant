/**
 * Wallet Connection & Authentication Tests - CIP-30 compliant wallet connection flow
 */

import { test, expect } from '@playwright/test';
import { LandingPage } from '../../fixtures/page-objects/landing-page';
import { WalletConnectionModal } from '../../fixtures/page-objects/wallet-connection-modal';
import { DashboardPage } from '../../fixtures/page-objects/dashboard-page';
import { testContextHelper, TestContext } from '../../fixtures/helpers/test-context-helper';
import { walletDataFactory } from '../../fixtures/test-data/wallet-data-factory';
import { WalletType, ErrorType } from '../../fixtures/types';

test.describe('Wallet Connection Flow', () => {
  let testContext: TestContext;
  let landingPage: LandingPage;
  let walletModal: WalletConnectionModal;
  let dashboardPage: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true,
      trackConsole: true,
      trackNetwork: true
    });
    
    landingPage = new LandingPage(page);
    walletModal = new WalletConnectionModal(page);
    dashboardPage = new DashboardPage(page);
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should open wallet connection modal from landing page', async () => {
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.verifyModalAppearance();
    await walletModal.verifyAvailableWalletOptions();
  });
  
  // Focused only on Eternl wallet for now
  
  test('should successfully connect Eternl wallet', async () => {
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.performWalletConnection(WalletType.ETERNL);
    
    await dashboardPage.waitForPageSpecificElements();
    await dashboardPage.verifyWalletOverview(testContext.walletData);
  });
  
  test('should handle wallet not detected scenario', async () => {
    // Clear wallet mocks to simulate no wallet installed
    await testContext.page.addInitScript(() => {
      (window as any).cardano = {};
    });
    
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.selectWallet(WalletType.ETERNL);
    
    await walletModal.verifyWalletNotDetected();
  });
  
  test('should handle wallet connection errors gracefully', async () => {
    // Mock wallet connection failure
    await testContext.apiMockHelper.mockEndpoint(
      '/api/auth/**',
      walletDataFactory.createErrorResponse(ErrorType.NETWORK_ERROR),
      { status: 500, failureRate: 1.0 }
    );
    
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.selectWallet(WalletType.ETERNL);
    
    await walletModal.verifyConnectionError();
    await walletModal.retryConnection();
  });
  
  test('should allow canceling wallet connection', async () => {
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.cancelConnection();
    
    // Should return to landing page
    await expect(landingPage.isLoaded()).resolves.toBe(true);
  });
  
  test('should handle concurrent wallet connections properly', async () => {
    await testContext.apiMockHelper.mockConcurrentConnections();
    
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.verifyConcurrentConnectionHandling();
  });
  
  test('should be responsive on mobile devices', async () => {
    await testContext.page.setViewportSize({ width: 375, height: 667 });
    
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.verifyModalResponsiveness();
  });
  
  test('should support keyboard navigation', async () => {
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.verifyKeyboardNavigation();
  });
  
  test('should handle wallet extension crashes', async () => {
    await landingPage.goto();
    await landingPage.clickConnectWallet();
    
    await walletModal.waitForModal();
    await walletModal.verifyWalletExtensionCrashRecovery();
  });
});

test.describe('Authentication Flow', () => {
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
  
  test('should maintain authentication state after page refresh', async () => {
    await testContextHelper.setupAuthenticatedState(testContext);
    await dashboardPage.goto();
    
    // Verify dashboard loads
    await dashboardPage.verifyWalletOverview(testContext.walletData);
    
    // Refresh page
    await testContext.page.reload();
    
    // Should still be authenticated
    await dashboardPage.verifyWalletOverview(testContext.walletData);
  });
  
  test('should handle expired authentication tokens', async () => {
    // Setup expired token
    await testContext.page.addInitScript(() => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';
      localStorage.setItem('auth-token', expiredToken);
    });
    
    await testContextHelper.setupErrorScenario(testContext, 'auth');
    
    // Try to access dashboard
    await dashboardPage.goto();
    
    // Should redirect to landing page
    const currentUrl = testContext.page.url();
    expect(currentUrl).not.toMatch(/dashboard/);
  });
  
  test('should handle corrupted authentication tokens', async () => {
    await testContextHelper.setupErrorScenario(testContext, 'auth');
    await dashboardPage.goto();
    
    // Should handle corrupted token gracefully
    const currentUrl = testContext.page.url();
    expect(currentUrl).not.toMatch(/dashboard/);
  });
  
  test('should successfully disconnect wallet', async () => {
    await testContextHelper.setupAuthenticatedState(testContext);
    await dashboardPage.goto();
    
    await dashboardPage.performWalletDisconnect();
    
    // Should redirect to landing page
    const currentUrl = testContext.page.url();
    expect(currentUrl).toMatch(/\/$/);
  });
});

// Multi-wallet support tests removed - focusing only on Eternl wallet for now
