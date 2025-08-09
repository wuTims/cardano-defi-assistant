/**
 * Dashboard Auth Bypass Tests - Demonstrate safe auth bypass functionality
 */

import { test, expect } from '@playwright/test';
import { testContextHelper, TestContext } from '../../fixtures/helpers/test-context-helper';

test.describe('Dashboard Auth Bypass - TEST ONLY', () => {
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

  test('should allow direct navigation to dashboard with auth bypass', async () => {
    // Use the new navigateToAuthenticatedDashboard helper
    await testContextHelper.navigateToAuthenticatedDashboard(testContext);
    
    // Verify we're on the dashboard URL (main success criteria)
    await expect(testContext.page).toHaveURL('/dashboard');
    
    // Verify page loaded (basic check)
    await expect(testContext.page.locator('body')).toBeVisible();
  });

  test('should have auth bypass mode marked in localStorage for debugging', async () => {
    // Setup authenticated state with bypass
    await testContextHelper.setupAuthenticatedState(testContext, undefined, {
      bypassWalletConnection: true,
      mockApiEndpoints: true
    });
    
    await testContext.page.goto('/dashboard');
    
    // Check that bypass mode is marked in localStorage for debugging
    const bypassMode = await testContext.page.evaluate(() => {
      return localStorage.getItem('auth-bypass-mode');
    });
    
    expect(bypassMode).toBe('true');
  });

  test('should handle wallet data with auth bypass API mocks', async () => {
    // Setup authenticated state with bypass
    await testContextHelper.setupAuthenticatedState(testContext, undefined, {
      bypassWalletConnection: true,
      mockApiEndpoints: true
    });
    
    await testContext.page.goto('/dashboard');
    
    // Verify auth data is in localStorage (proving bypass worked)
    const authToken = await testContext.page.evaluate(() => {
      return localStorage.getItem('auth-token');
    });
    
    const walletAddress = await testContext.page.evaluate(() => {
      return localStorage.getItem('wallet-address');
    });
    
    expect(authToken).toBeTruthy();
    expect(walletAddress).toBe(testContext.walletData.address);
  });
});