import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/');
  });

  test('should load the landing page successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Wallet Sync Service/i);
    
    // Verify page loads without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display hero section with proper content', async ({ page }) => {
    // Check for hero section
    const heroSection = page.locator('[data-testid="hero-section"]');
    await expect(heroSection).toBeVisible();
    
    // Verify main heading
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toContainText(/Cardano/i);
    await expect(mainHeading).toBeVisible();
    
    // Verify description text
    const description = page.locator('p').first();
    await expect(description).toBeVisible();
    await expect(description).toContainText(/sync/i);
  });

  test('should display connect wallet button', async ({ page }) => {
    // Look for the connect wallet button
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });

  test('should have responsive navigation', async ({ page }) => {
    // Check if navigation elements are present
    const navigation = page.locator('[data-testid="navigation"]');
    await expect(navigation).toBeVisible();
    
    // Test mobile responsiveness by resizing viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(navigation).toBeVisible();
    
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(navigation).toBeVisible();
  });

  test('should display Cardano branding elements', async ({ page }) => {
    // Check for Cardano-specific elements
    const cardanoElements = page.locator('text=/cardano/i');
    await expect(cardanoElements.first()).toBeVisible();
    
    // Check for wallet-related text
    const walletText = page.locator('text=/wallet/i');
    await expect(walletText.first()).toBeVisible();
  });

  test('should have proper meta tags for SEO', async ({ page }) => {
    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
    
    // Check viewport meta tag
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', /width=device-width/);
  });

  test('should not show any console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Reload the page to trigger any errors
    await page.reload();
    
    // Wait for any async operations
    await page.waitForTimeout(2000);
    
    // Should have no console errors
    expect(errors).toEqual([]);
  });

  test('should handle page interactions smoothly', async ({ page }) => {
    // Test hover effects on interactive elements
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.hover();
    
    // Button should still be visible and enabled after hover
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
    
    // Test focus states
    await connectButton.focus();
    await expect(connectButton).toBeFocused();
  });

  test('should load all required assets', async ({ page }) => {
    // Check that images load properly (if any)
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      await expect(img).toBeVisible();
      
      // Check that image has loaded (no broken image)
      const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test('should have proper link behavior', async ({ page }) => {
    // Check for any external links
    const externalLinks = page.locator('a[href^="http"]');
    const externalLinkCount = await externalLinks.count();
    
    for (let i = 0; i < externalLinkCount; i++) {
      const link = externalLinks.nth(i);
      
      // External links should open in new tab/window
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener|noreferrer/);
    }
  });
});