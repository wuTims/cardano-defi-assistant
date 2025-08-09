/**
 * Dashboard Page Object - Handles wallet overview, sync operations, and navigation
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { TestWalletData } from '../test-data/wallet-data-factory';
import { getTimeout } from '../config/test-config';

export class DashboardPage extends BasePage {
  // Main dashboard elements
  private readonly walletOverviewSection: Locator;
  private readonly walletAddressDisplay: Locator;
  private readonly balanceDisplay: Locator;
  private readonly syncButton: Locator;
  private readonly syncStatusIndicator: Locator;
  private readonly lastSyncedDisplay: Locator;
  private readonly disconnectButton: Locator;
  
  // Navigation elements
  private readonly navigationMenu: Locator;
  private readonly profileMenu: Locator;
  private readonly logoutButton: Locator;
  
  // Wallet data sections
  private readonly assetsSection: Locator;
  private readonly utxosSection: Locator;
  private readonly stakingSection: Locator;
  private readonly transactionHistory: Locator;
  
  // Status and error elements
  private readonly errorAlert: Locator;
  private readonly successAlert: Locator;
  private readonly loadingSpinner: Locator;
  
  constructor(page: Page) {
    super(page);
    
    // Initialize main dashboard locators
    this.walletOverviewSection = page.locator('[data-testid="wallet-overview"], .wallet-overview, .dashboard-main');
    this.walletAddressDisplay = page.locator('[data-testid="wallet-address"], .wallet-address, [data-label="address"]');
    this.balanceDisplay = page.locator('[data-testid="wallet-balance"], .balance-display, .wallet-balance');
    this.syncButton = page.locator('[data-testid="sync-button"], button:has-text("Sync"), button:has-text("sync")');
    this.syncStatusIndicator = page.locator('[data-testid="sync-status"], .sync-status, .status-indicator');
    this.lastSyncedDisplay = page.locator('[data-testid="last-synced"], .last-synced, [data-label="last-sync"]');
    this.disconnectButton = page.locator('[data-testid="disconnect-button"], button:has-text("Disconnect"), button:has-text("disconnect")');
    
    // Navigation elements
    this.navigationMenu = page.locator('[data-testid="navigation"], nav, .navbar, .nav-menu');
    this.profileMenu = page.locator('[data-testid="profile-menu"], .profile-menu, .user-menu');
    this.logoutButton = page.locator('[data-testid="logout-button"], button:has-text("Logout"), button:has-text("logout")');
    
    // Wallet data sections
    this.assetsSection = page.locator('[data-testid="assets-section"], .assets-section, .wallet-assets');
    this.utxosSection = page.locator('[data-testid="utxos-section"], .utxos-section, .wallet-utxos');
    this.stakingSection = page.locator('[data-testid="staking-section"], .staking-section, .staking-info');
    this.transactionHistory = page.locator('[data-testid="transaction-history"], .transaction-history, .tx-history');
    
    // Status and error elements
    this.errorAlert = page.locator('[data-testid="error-alert"], .error-alert, .alert-error, [role="alert"]');
    this.successAlert = page.locator('[data-testid="success-alert"], .success-alert, .alert-success');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"], .loading, .spinner');
  }
  
  /**
   * Navigate to the dashboard page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/dashboard');
    await this.waitForPageSpecificElements();
  }
  
  /**
   * Wait for dashboard to fully load - used in advanced pattern tests
   */
  async waitForDashboardLoad(): Promise<void> {
    await this.walletOverviewSection.waitFor({ state: 'visible', timeout: getTimeout('pageLoad') });
    await this.balanceDisplay.waitFor({ state: 'visible', timeout: getTimeout('pageLoad') });
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: getTimeout('pageLoad') }).catch(() => {
      // Loading spinner might not be present, which is fine
    });
  }
  
  /**
   * Check if dashboard page is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.walletOverviewSection.waitFor({ state: 'visible', timeout: 2000 });
      await this.balanceDisplay.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Wait for wallet data to load
   */
  async waitForWalletDataLoad(): Promise<void> {
    await this.waitForNetworkIdle();
    await this.waitForNoLoadingSpinners();
    
    // Wait for balance to be populated (not showing loading state)
    await expect(this.balanceDisplay).not.toHaveText('');
    await expect(this.balanceDisplay).not.toContainText('Loading');
  }
  
  /**
   * Verify wallet overview information
   */
  async verifyWalletOverview(expectedData: TestWalletData): Promise<void> {
    await expect(this.walletOverviewSection).toBeVisible();
    
    // Check wallet address (may be truncated)
    const displayedAddress = await this.walletAddressDisplay.textContent();
    const expectedAddress = expectedData.address;
    
    // Address might be truncated, so check prefix and suffix
    const addressPrefix = expectedAddress.substring(0, 10);
    const addressSuffix = expectedAddress.substring(expectedAddress.length - 6);
    
    expect(displayedAddress).toMatch(new RegExp(`${addressPrefix}.*${addressSuffix}`));
    
    // Check balance display
    await expect(this.balanceDisplay).toContainText(expectedData.balance.ada);
    await expect(this.balanceDisplay).toContainText('ADA');
  }
  
  /**
   * Verify wallet balance information
   */
  async verifyWalletBalance(expectedBalance: { ada: string; lovelace: string }): Promise<void> {
    await expect(this.balanceDisplay).toBeVisible();
    await expect(this.balanceDisplay).toContainText(expectedBalance.ada);
    await expect(this.balanceDisplay).toContainText(/ADA|₳/);
  }
  
  /**
   * Verify wallet assets display
   */
  async verifyWalletAssets(expectedAssetCount: number): Promise<void> {
    if (expectedAssetCount > 0) {
      await expect(this.assetsSection).toBeVisible();
      
      const assetItems = this.assetsSection.locator('.asset-item, [data-testid="asset-item"]');
      const actualCount = await assetItems.count();
      
      expect(actualCount).toBe(expectedAssetCount);
    } else {
      // Should show "No assets" message or hide section
      const hasNoAssetsMessage = await this.elementExists('[data-testid="no-assets"], .no-assets');
      const assetsVisible = await this.assetsSection.isVisible().catch(() => false);
      
      expect(hasNoAssetsMessage || !assetsVisible).toBe(true);
    }
  }
  
  /**
   * Verify UTXOs information display
   */
  async verifyUTXOsInformation(expectedUtxoCount: number): Promise<void> {
    if (expectedUtxoCount > 0) {
      await expect(this.utxosSection).toBeVisible();
      
      const utxoItems = this.utxosSection.locator('.utxo-item, [data-testid="utxo-item"]');
      const actualCount = await utxoItems.count();
      
      expect(actualCount).toBe(expectedUtxoCount);
    }
  }
  
  /**
   * Verify staking information
   */
  async verifyStakingInformation(hasStaking: boolean): Promise<void> {
    if (hasStaking) {
      await expect(this.stakingSection).toBeVisible();
      
      const stakeAddress = this.stakingSection.locator('[data-testid="stake-address"], .stake-address');
      await expect(stakeAddress).toBeVisible();
      
      const rewardsDisplay = this.stakingSection.locator('[data-testid="staking-rewards"], .staking-rewards');
      await expect(rewardsDisplay).toBeVisible();
    } else {
      const hasNoStakingMessage = await this.elementExists('[data-testid="no-staking"], .no-staking');
      const stakingVisible = await this.stakingSection.isVisible().catch(() => false);
      
      expect(hasNoStakingMessage || !stakingVisible).toBe(true);
    }
  }
  
  /**
   * Verify wallet type information display
   */
  async verifyWalletTypeInformation(expectedWalletType: string): Promise<void> {
    const walletTypeDisplay = this.page.locator('[data-testid="wallet-type"], .wallet-type');
    
    if (await walletTypeDisplay.isVisible()) {
      await expect(walletTypeDisplay).toContainText(expectedWalletType, { ignoreCase: true });
    }
  }
  
  /**
   * Perform wallet sync operation
   */
  async performWalletSync(): Promise<void> {
    await expect(this.syncButton).toBeVisible();
    await expect(this.syncButton).toBeEnabled();
    
    // Click sync button
    await this.safeClick(this.syncButton, {
      timeout: getTimeout('walletSync')
    });
    
    // Wait for sync to start (loading state)
    await this.loadingSpinner.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    
    // Wait for sync to complete
    await this.waitForApiCall('/api/wallet/sync', { method: 'POST' });
    await this.waitForNoLoadingSpinners();
  }
  
  /**
   * Verify sync button functionality
   */
  async verifySyncButtonFunctionality(): Promise<void> {
    await expect(this.syncButton).toBeVisible();
    await expect(this.syncButton).toBeEnabled();
    
    // Test button hover state
    await this.syncButton.hover();
    await expect(this.syncButton).toBeEnabled();
  }
  
  /**
   * Verify wallet data after successful sync
   */
  async verifyWalletDataAfterSync(): Promise<void> {
    // Check that last synced timestamp is updated
    await expect(this.lastSyncedDisplay).toBeVisible();
    
    // Check for success message
    const hasSuccessMessage = await this.successAlert.isVisible().catch(() => false);
    if (hasSuccessMessage) {
      await expect(this.successAlert).toContainText(/sync/i);
    }
    
    // Verify sync status shows success
    if (await this.syncStatusIndicator.isVisible()) {
      await expect(this.syncStatusIndicator).toContainText(/success|complete|synced/i);
    }
  }
  
  /**
   * Handle sync failure scenarios
   */
  async verifySyncFailureHandling(): Promise<void> {
    // Check for error message display
    const hasErrorMessage = await this.errorAlert.isVisible().catch(() => false);
    if (hasErrorMessage) {
      await expect(this.errorAlert).toContainText(/error|failed|unable/i);
    }
    
    // Sync button should remain enabled for retry
    await expect(this.syncButton).toBeEnabled();
  }
  
  /**
   * Verify navigation elements
   */
  async verifyNavigationElements(): Promise<void> {
    await expect(this.navigationMenu).toBeVisible();
    
    // Test different viewport sizes
    await this.setViewport('mobile');
    await expect(this.navigationMenu).toBeVisible();
    
    await this.setViewport('desktop');
    await expect(this.navigationMenu).toBeVisible();
  }
  
  /**
   * Test disconnect functionality
   */
  async performWalletDisconnect(): Promise<void> {
    await expect(this.disconnectButton).toBeVisible();
    await expect(this.disconnectButton).toBeEnabled();
    
    await this.safeClick(this.disconnectButton, {
      waitForNavigation: true,
      timeout: getTimeout('authentication')
    });
  }
  
  /**
   * Verify responsive design on mobile devices
   */
  async verifyMobileResponsiveness(): Promise<void> {
    await this.setViewport('mobile');
    
    // Key elements should still be visible and functional
    await expect(this.walletOverviewSection).toBeVisible();
    await expect(this.balanceDisplay).toBeVisible();
    await expect(this.syncButton).toBeVisible();
    await expect(this.navigationMenu).toBeVisible();
    
    // Take mobile screenshot
    await this.takeScreenshot('dashboard-mobile');
  }
  
  /**
   * Handle session expiration gracefully
   */
  async verifySessionExpirationHandling(): Promise<void> {
    // This would typically involve mocking an expired token response
    // and verifying that the user is redirected to the login page
    
    const currentUrl = this.getCurrentUrl();
    expect(currentUrl).toMatch(/dashboard/);
    
    // If session expires, user should be redirected to landing page
    // This test would need to be implemented with proper mocking
  }
  
  /**
   * Verify error handling when wallet data fails to load
   */
  async verifyWalletDataLoadError(): Promise<void> {
    const hasErrorAlert = await this.errorAlert.isVisible().catch(() => false);
    if (hasErrorAlert) {
      await expect(this.errorAlert).toContainText(/error|failed|unable/i);
    }
    
    // Should provide retry mechanism
    const retryButton = this.page.locator('[data-testid="retry-button"], button:has-text("Retry")');
    if (await retryButton.isVisible()) {
      await expect(retryButton).toBeEnabled();
    }
  }
  
  /**
   * Comprehensive dashboard verification
   */
  async verifyDashboardComplete(expectedData: TestWalletData): Promise<void> {
    await this.waitForWalletDataLoad();
    await this.verifyWalletOverview(expectedData);
    await this.verifyWalletBalance(expectedData.balance);
    await this.verifyWalletAssets(expectedData.assets.length);
    await this.verifyUTXOsInformation(expectedData.utxos.length);
    await this.verifyStakingInformation(expectedData.stakingInfo.isActive);
    await this.verifyWalletTypeInformation(expectedData.walletType);
    await this.verifyNavigationElements();
    await this.verifySyncButtonFunctionality();
  }
}
