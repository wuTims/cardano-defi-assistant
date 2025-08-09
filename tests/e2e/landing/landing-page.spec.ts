/**
 * Landing Page Feature Tests - Comprehensive landing page functionality testing
 */

import { test, expect } from '@playwright/test';
import { LandingPage } from '../../fixtures/page-objects/landing-page';
import { testContextHelper, TestContext } from '../../fixtures/helpers/test-context-helper';
import { testConfig } from '../../fixtures/config/test-config';

test.describe('Landing Page Features', () => {
  let testContext: TestContext;
  let landingPage: LandingPage;
  
  test.beforeEach(async ({ page }) => {
    testContext = await testContextHelper.setupTestContext(page, {
      scenario: 'basic',
      mockApis: true,
      trackConsole: true,
      trackNetwork: true
    });
    
    landingPage = new LandingPage(page);
    await landingPage.goto();
  });
  
  test.afterEach(async () => {
    if (testContext) {
      await testContextHelper.cleanupTestContext(testContext);
    }
  });
  
  test('should load the landing page successfully', async () => {
    await expect(testContext.page).toHaveTitle(/Wallet Sync Service/i);
    await expect(testContext.page.locator('body')).toBeVisible();
    await landingPage.waitForPageSpecificElements();
  });
  
  test('should display hero section with proper content', async () => {
    await landingPage.verifyHeroSection();
  });
  
  test('should display and interact with connect wallet button', async () => {
    await landingPage.verifyConnectWalletButton();
  });
  
  test('should have responsive navigation across all viewports', async () => {
    await landingPage.verifyResponsiveNavigation();
  });
  
  test('should display Cardano branding elements', async () => {
    await landingPage.verifyCardanoBranding();
  });
  
  test('should have proper SEO meta tags', async () => {
    await landingPage.verifySEOMetaTags();
  });
  
  test('should not show console errors on load', async () => {
    await landingPage.verifyNoConsoleErrors();
    
    // Also check our tracked console logs
    const errorLogs = testContext.consoleLogs.filter(log => 
      log.startsWith('error:') && 
      !log.includes('favicon') && 
      !log.includes('chrome-extension')
    );
    expect(errorLogs).toEqual([]);
  });
  
  test('should handle page interactions smoothly', async () => {
    await landingPage.verifyPageInteractions();
  });
  
  test('should load all required assets properly', async () => {
    await landingPage.verifyImageLoading();
  });
  
  test('should have proper external link behavior', async () => {
    await landingPage.verifyExternalLinks();
  });
  
  test('should maintain responsive layout across all screen sizes', async () => {
    await landingPage.verifyResponsiveLayout();
  });
  
  test('should pass comprehensive landing page verification', async () => {
    await landingPage.verifyLandingPageComplete();
    
    // Verify no network errors occurred
    const networkErrors = testContext.networkLogs.filter(log => log.status >= 400);
    expect(networkErrors).toEqual([]);
  });
  
  test('should handle slow network conditions gracefully', async () => {
    // Simulate slow network
    await testContext.apiMockHelper.mockEndpoint(
      '**',
      { success: true },
      { delay: 2000 }
    );
    
    await landingPage.goto();
    await landingPage.verifyHeroSection();
  });
  
  test('should maintain accessibility standards', async () => {
    // Basic accessibility checks
    await expect(testContext.page.locator('[data-testid="hero-section"]')).toBeVisible();
    await expect(testContext.page.locator('h1')).toBeVisible();
    
    // Check for proper ARIA attributes (if implemented)
    const buttons = testContext.page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    }
  });
});

test.describe('Landing Page Performance', () => {
  test('should load within acceptable time limits', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
  
  test('should have efficient resource loading', async ({ page }) => {
    const requests: string[] = [];
    
    page.on('request', (request) => {
      requests.push(request.url());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should not make excessive requests
    const resourceRequests = requests.filter(url => 
      url.includes('.js') || url.includes('.css') || url.includes('.png') || url.includes('.jpg')
    );
    
    expect(resourceRequests.length).toBeLessThan(20); // Reasonable limit
  });
});
