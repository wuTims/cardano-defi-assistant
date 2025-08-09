/**
 * Base Page Object with common functionality and waiting strategies
 */

import { Page, Locator, expect } from '@playwright/test';
import { testConfig, getTimeout } from '../config/test-config';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly baseURL: string;
  
  constructor(page: Page) {
    this.page = page;
    this.baseURL = testConfig.baseURL;
  }
  
  /**
   * Navigate to a specific path
   */
  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path, { 
      waitUntil: 'networkidle',
      timeout: getTimeout('navigation')
    });
  }
  
  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: getTimeout('navigation') });
    await this.waitForNoLoadingSpinners();
  }
  
  /**
   * Wait for loading spinners to disappear
   */
  async waitForNoLoadingSpinners(): Promise<void> {
    const loadingSpinners = [
      '[data-testid="loading-spinner"]',
      '.loading',
      '.spinner',
      '[data-loading="true"]'
    ];
    
    for (const selector of loadingSpinners) {
      try {
        await this.page.waitForSelector(selector, { state: 'hidden', timeout: 2000 });
      } catch {
        // Ignore if selector doesn't exist
      }
    }
  }
  
  /**
   * Get element by test ID with robust waiting
   */
  async getByTestId(testId: string): Promise<Locator> {
    const selector = `[data-testid="${testId}"]`;
    return this.page.locator(selector);
  }
  
  /**
   * Get element with multiple selector strategies as fallback
   */
  async getElement(primarySelector: string, fallbackSelectors: string[] = []): Promise<Locator> {
    try {
      const element = this.page.locator(primarySelector);
      await element.waitFor({ state: 'visible', timeout: 1000 });
      return element;
    } catch {
      for (const fallback of fallbackSelectors) {
        try {
          const element = this.page.locator(fallback);
          await element.waitFor({ state: 'visible', timeout: 1000 });
          return element;
        } catch {
          continue;
        }
      }
      // Return the primary selector if all fallbacks fail
      return this.page.locator(primarySelector);
    }
  }
  
  /**
   * Safe click with multiple retry strategies
   */
  async safeClick(locator: Locator, options: {
    timeout?: number;
    retries?: number;
    waitForNavigation?: boolean;
  } = {}): Promise<void> {
    const { 
      timeout = getTimeout('default'), 
      retries = 3, 
      waitForNavigation = false 
    } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await locator.waitFor({ state: 'visible', timeout: timeout / retries });
        await locator.scrollIntoViewIfNeeded();
        
        if (waitForNavigation) {
          await Promise.all([
            this.page.waitForLoadState('networkidle'),
            locator.click({ timeout })
          ]);
        } else {
          await locator.click({ timeout });
        }
        
        return; // Success, exit retry loop
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await this.page.waitForTimeout(1000); // Wait before retry
      }
    }
  }
  
  /**
   * Safe type with input clearing and validation
   */
  async safeType(locator: Locator, text: string, options: {
    timeout?: number;
    clear?: boolean;
    pressEnter?: boolean;
  } = {}): Promise<void> {
    const { timeout = getTimeout('default'), clear = true, pressEnter = false } = options;
    
    await locator.waitFor({ state: 'visible', timeout });
    await locator.scrollIntoViewIfNeeded();
    
    if (clear) {
      await locator.fill(''); // Clear existing text
    }
    
    await locator.type(text, { timeout });
    
    if (pressEnter) {
      await locator.press('Enter');
    }
    
    // Validate the text was entered correctly
    await expect(locator).toHaveValue(text);
  }
  
  /**
   * Wait for element to be visible and stable
   */
  async waitForElementStable(locator: Locator, timeout = getTimeout('default')): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
    
    // Wait for element position to stabilize (no movement for 500ms)
    let previousBox = await locator.boundingBox();
    let stableCount = 0;
    const maxChecks = 10;
    
    for (let i = 0; i < maxChecks; i++) {
      await this.page.waitForTimeout(100);
      const currentBox = await locator.boundingBox();
      
      if (previousBox && currentBox && 
          previousBox.x === currentBox.x && 
          previousBox.y === currentBox.y) {
        stableCount++;
        if (stableCount >= 5) break; // Stable for 500ms
      } else {
        stableCount = 0;
      }
      
      previousBox = currentBox;
    }
  }
  
  /**
   * Check if element exists without throwing
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'attached', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Wait for API call to complete
   */
  async waitForApiCall(urlPattern: string | RegExp, options: {
    method?: string;
    timeout?: number;
  } = {}): Promise<void> {
    const { method = 'GET', timeout = getTimeout('api') } = options;
    
    await this.page.waitForResponse(response => {
      const url = response.url();
      const matchesUrl = typeof urlPattern === 'string' 
        ? url.includes(urlPattern)
        : urlPattern.test(url);
      const matchesMethod = response.request().method() === method;
      
      return matchesUrl && matchesMethod;
    }, { timeout });
  }
  
  /**
   * Take screenshot with standardized naming
   */
  async takeScreenshot(name: string, fullPage = false): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    
    await this.page.screenshot({ 
      path: `test-results/screenshots/${filename}`,
      fullPage 
    });
  }
  
  /**
   * Mock browser console methods for testing
   */
  async mockConsole(): Promise<string[]> {
    const consoleLogs: string[] = [];
    
    this.page.on('console', msg => {
      if (['error', 'warn'].includes(msg.type())) {
        consoleLogs.push(`${msg.type()}: ${msg.text()}`);
      }
    });
    
    return consoleLogs;
  }
  
  /**
   * Set viewport size with predefined options
   */
  async setViewport(size: 'mobile' | 'tablet' | 'desktop' | 'ultrawide'): Promise<void> {
    const viewport = testConfig.viewports[size];
    await this.page.setViewportSize(viewport);
  }
  
  /**
   * Wait for network idle state
   */
  async waitForNetworkIdle(timeout = getTimeout('api')): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }
  
  /**
   * Get current page URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }
  
  /**
   * Get page title
   */
  async getPageTitle(): Promise<string> {
    return await this.page.title();
  }
  
  /**
   * Check if page has specific meta tag
   */
  async hasMetaTag(name: string, content?: string): Promise<boolean> {
    const selector = content 
      ? `meta[name="${name}"][content*="${content}"]`
      : `meta[name="${name}"]`;
    
    return await this.elementExists(selector);
  }
  
  /**
   * Abstract method that child classes must implement
   */
  abstract isLoaded(): Promise<boolean>;
  
  /**
   * Wait for page-specific elements to ensure page is loaded
   */
  async waitForPageSpecificElements(): Promise<void> {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts && !(await this.isLoaded())) {
      await this.page.waitForTimeout(500);
      attempts++;
    }
    
    if (!(await this.isLoaded())) {
      throw new Error(`Page did not load properly after ${maxAttempts} attempts`);
    }
  }
}
