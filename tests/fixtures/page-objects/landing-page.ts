/**
 * Landing Page Object - Handles hero section and wallet connection interactions
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { getTimeout } from '../config/test-config';

export class LandingPage extends BasePage {
  // Page elements
  private readonly heroSection: Locator;
  private readonly mainHeading: Locator;
  private readonly descriptionText: Locator;
  private readonly connectWalletButton: Locator;
  private readonly navigation: Locator;
  private readonly cardanoElements: Locator;
  private readonly walletText: Locator;
  
  constructor(page: Page) {
    super(page);
    
    // Initialize locators with fallback strategies
    this.heroSection = page.locator('[data-testid="hero-section"], .hero-section, main section:first-child');
    this.mainHeading = page.locator('[data-testid="main-heading"], h1, .hero-title');
    this.descriptionText = page.locator('[data-testid="hero-description"], .hero-description, p');
    this.connectWalletButton = page.locator(
      '[data-testid="connect-wallet-button"], button:has-text("Connect Wallet"), button:has-text("connect wallet")'
    );
    this.navigation = page.locator('[data-testid="navigation"], nav, .navbar');
    this.cardanoElements = page.locator('text=/cardano/i');
    this.walletText = page.locator('text=/wallet/i');
  }
  
  /**
   * Navigate to the landing page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/');
    await this.waitForPageSpecificElements();
  }
  
  /**
   * Check if landing page is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.heroSection.waitFor({ state: 'visible', timeout: 2000 });
      await this.mainHeading.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Verify hero section content
   */
  async verifyHeroSection(): Promise<void> {
    await expect(this.heroSection).toBeVisible();
    await expect(this.mainHeading).toBeVisible();
    await expect(this.mainHeading).toContainText(/Cardano/i);
    
    await expect(this.descriptionText).toBeVisible();
    await expect(this.descriptionText).toContainText(/sync/i);
  }
  
  /**
   * Verify connect wallet button is present and functional
   */
  async verifyConnectWalletButton(): Promise<void> {
    await expect(this.connectWalletButton).toBeVisible();
    await expect(this.connectWalletButton).toBeEnabled();
    
    // Test hover state
    await this.connectWalletButton.hover();
    await expect(this.connectWalletButton).toBeVisible();
    await expect(this.connectWalletButton).toBeEnabled();
    
    // Test focus state
    await this.connectWalletButton.focus();
    await expect(this.connectWalletButton).toBeFocused();
  }
  
  /**
   * Click the connect wallet button
   */
  async clickConnectWallet(): Promise<void> {
    await this.safeClick(this.connectWalletButton, {
      timeout: getTimeout('walletConnection'),
      waitForNavigation: true
    });
  }
  
  /**
   * Test responsive navigation
   */
  async verifyResponsiveNavigation(): Promise<void> {
    // Check navigation visibility in desktop view
    await this.setViewport('desktop');
    await expect(this.navigation).toBeVisible();
    
    // Check navigation visibility in tablet view
    await this.setViewport('tablet');
    await expect(this.navigation).toBeVisible();
    
    // Check navigation visibility in mobile view
    await this.setViewport('mobile');
    await expect(this.navigation).toBeVisible();
    
    // Reset to desktop
    await this.setViewport('desktop');
  }
  
  /**
   * Verify Cardano branding elements
   */
  async verifyCardanoBranding(): Promise<void> {
    await expect(this.cardanoElements.first()).toBeVisible();
    await expect(this.walletText.first()).toBeVisible();
  }
  
  /**
   * Verify SEO meta tags
   */
  async verifySEOMetaTags(): Promise<void> {
    // Check page title
    await expect(this.page).toHaveTitle(/Wallet Sync Service/i);
    
    // Check meta description
    const hasMetaDescription = await this.hasMetaTag('description');
    expect(hasMetaDescription).toBe(true);
    
    // Check viewport meta tag
    const hasViewportMeta = await this.hasMetaTag('viewport', 'width=device-width');
    expect(hasViewportMeta).toBe(true);
  }
  
  /**
   * Check for console errors
   */
  async verifyNoConsoleErrors(): Promise<void> {
    const consoleLogs = await this.mockConsole();
    
    // Reload page to trigger any errors
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.page.waitForTimeout(2000);
    
    // Filter out acceptable warnings/logs
    const errors = consoleLogs.filter(log => 
      log.startsWith('error:') && 
      !log.includes('favicon') && // Ignore favicon 404s
      !log.includes('chrome-extension') // Ignore extension warnings
    );
    
    expect(errors).toEqual([]);
  }
  
  /**
   * Verify all images load properly
   */
  async verifyImageLoading(): Promise<void> {
    const images = this.page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      await expect(img).toBeVisible();
      
      // Check that image has loaded (no broken image)
      const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  }
  
  /**
   * Verify external link behavior
   */
  async verifyExternalLinks(): Promise<void> {
    const externalLinks = this.page.locator('a[href^="http"]');
    const externalLinkCount = await externalLinks.count();
    
    for (let i = 0; i < externalLinkCount; i++) {
      const link = externalLinks.nth(i);
      
      // External links should open in new tab/window
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener|noreferrer/);
    }
  }
  
  /**
   * Test page interaction smoothness
   */
  async verifyPageInteractions(): Promise<void> {
    // Test button hover effects
    await this.connectWalletButton.hover();
    await this.waitForElementStable(this.connectWalletButton);
    await expect(this.connectWalletButton).toBeVisible();
    await expect(this.connectWalletButton).toBeEnabled();
    
    // Test focus states
    await this.connectWalletButton.focus();
    await expect(this.connectWalletButton).toBeFocused();
    
    // Test keyboard navigation
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Shift+Tab'); // Navigate back
    await expect(this.connectWalletButton).toBeFocused();
  }
  
  /**
   * Verify responsive layout at different screen sizes
   */
  async verifyResponsiveLayout(): Promise<void> {
    const viewports = ['mobile', 'tablet', 'desktop', 'ultrawide'] as const;
    
    for (const viewport of viewports) {
      await this.setViewport(viewport);
      
      // Ensure hero section is visible at all screen sizes
      await expect(this.heroSection).toBeVisible();
      await expect(this.mainHeading).toBeVisible();
      await expect(this.connectWalletButton).toBeVisible();
      
      // Take screenshot for visual regression testing
      await this.takeScreenshot(`landing-page-${viewport}`);
    }
  }
  
  /**
   * Comprehensive landing page verification
   */
  async verifyLandingPageComplete(): Promise<void> {
    await this.verifyHeroSection();
    await this.verifyConnectWalletButton();
    await this.verifyCardanoBranding();
    await this.verifySEOMetaTags();
    await this.verifyImageLoading();
    await this.verifyExternalLinks();
    await this.verifyPageInteractions();
  }
}
