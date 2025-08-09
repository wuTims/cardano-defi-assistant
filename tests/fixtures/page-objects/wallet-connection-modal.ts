/**
 * Wallet Connection Modal Page Object - Handles multi-wallet connection flow
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { WalletType, walletDataFactory } from '../test-data/wallet-data-factory';
import { getTimeout } from '../config/test-config';

export class WalletConnectionModal extends BasePage {
  // Modal elements
  private readonly modal: Locator;
  private readonly modalTitle: Locator;
  private readonly modalCloseButton: Locator;
  private readonly modalOverlay: Locator;
  
  // Wallet selection elements
  private readonly walletSelectionGrid: Locator;
  private readonly walletOptions: Locator;
  private readonly namiOption: Locator;
  private readonly eternlOption: Locator;
  private readonly flintOption: Locator;
  private readonly vesprOption: Locator;
  private readonly gerowallet: Locator;
  private readonly nufiOption: Locator;
  
  // Connection status elements
  private readonly connectionStatus: Locator;
  private readonly loadingIndicator: Locator;
  private readonly errorMessage: Locator;
  private readonly successMessage: Locator;
  
  // Connection flow elements
  private readonly connectingMessage: Locator;
  private readonly signaturePrompt: Locator;
  private readonly retryButton: Locator;
  private readonly cancelButton: Locator;
  
  // Wallet detection elements
  private readonly walletNotDetectedMessage: Locator;
  private readonly installWalletLinks: Locator;
  
  constructor(page: Page) {
    super(page);
    
    // Initialize modal locators
    this.modal = page.locator('[data-testid="wallet-connection-modal"], .wallet-modal, [role="dialog"]');
    this.modalTitle = page.locator('[data-testid="modal-title"], .modal-title, h2, h3').first();
    this.modalCloseButton = page.locator('[data-testid="modal-close"], .modal-close, button:has-text("×"), button:has-text("Close")');
    this.modalOverlay = page.locator('[data-testid="modal-overlay"], .modal-overlay, .backdrop');
    
    // Wallet selection elements
    this.walletSelectionGrid = page.locator('[data-testid="wallet-selection"], .wallet-selection, .wallet-grid');
    this.walletOptions = page.locator('[data-testid*="wallet-option"], .wallet-option, .wallet-card');
    
    // Individual wallet options
    this.namiOption = page.locator('[data-testid="wallet-option-nami"], button:has-text("Nami"), [data-wallet="nami"]');
    this.eternlOption = page.locator('[data-testid="wallet-option-eternl"], button:has-text("Eternl"), [data-wallet="eternl"]');
    this.flintOption = page.locator('[data-testid="wallet-option-flint"], button:has-text("Flint"), [data-wallet="flint"]');
    this.vesprOption = page.locator('[data-testid="wallet-option-vespr"], button:has-text("Vespr"), [data-wallet="vespr"]');
    this.gerowallet = page.locator('[data-testid="wallet-option-gerowallet"], button:has-text("GeroWallet"), [data-wallet="gerowallet"]');
    this.nufiOption = page.locator('[data-testid="wallet-option-nufi"], button:has-text("NuFi"), [data-wallet="nufi"]');
    
    // Connection status elements
    this.connectionStatus = page.locator('[data-testid="connection-status"], .connection-status, .status-text');
    this.loadingIndicator = page.locator('[data-testid="connection-loading"], .loading, .spinner');
    this.errorMessage = page.locator('[data-testid="connection-error"], .error-message, [role="alert"]');
    this.successMessage = page.locator('[data-testid="connection-success"], .success-message');
    
    // Connection flow elements
    this.connectingMessage = page.locator('[data-testid="connecting-message"], .connecting-message');
    this.signaturePrompt = page.locator('[data-testid="signature-prompt"], .signature-prompt');
    this.retryButton = page.locator('[data-testid="retry-button"], button:has-text("Retry")');
    this.cancelButton = page.locator('[data-testid="cancel-button"], button:has-text("Cancel")');
    
    // Wallet detection elements
    this.walletNotDetectedMessage = page.locator('[data-testid="wallet-not-detected"], .wallet-not-detected');
    this.installWalletLinks = page.locator('[data-testid="install-wallet-link"], .install-link');
  }
  
  /**
   * Wait for modal to be visible
   */
  async waitForModal(): Promise<void> {
    await this.modal.waitFor({ state: 'visible', timeout: getTimeout('walletConnection') });
    await this.modalTitle.waitFor({ state: 'visible' });
  }

  /**
   * Alias for waitForModal - used in advanced pattern tests
   */
  async waitForModalOpen(): Promise<void> {
    return this.waitForModal();
  }
  
  /**
   * Check if modal is loaded and visible
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.modal.waitFor({ state: 'visible', timeout: 2000 });
      await this.walletSelectionGrid.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Verify modal appearance and content
   */
  async verifyModalAppearance(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.modalTitle).toBeVisible();
    await expect(this.modalTitle).toContainText(/connect|wallet/i);
    await expect(this.modalCloseButton).toBeVisible();
    await expect(this.walletSelectionGrid).toBeVisible();
  }
  
  /**
   * Verify available wallet options
   */
  async verifyAvailableWalletOptions(): Promise<void> {
    const walletCount = await this.walletOptions.count();
    expect(walletCount).toBeGreaterThan(0);
    
    // Check that major wallets are available
    await expect(this.namiOption).toBeVisible();
    await expect(this.eternlOption).toBeVisible();
    await expect(this.flintOption).toBeVisible();
    
    // Verify each wallet option is clickable
    const wallets = [this.namiOption, this.eternlOption, this.flintOption, this.vesprOption];
    for (const wallet of wallets) {
      if (await wallet.isVisible()) {
        await expect(wallet).toBeEnabled();
      }
    }
  }
  
  /**
   * Select a specific wallet type
   */
  async selectWallet(walletType: WalletType): Promise<void> {
    const walletLocators: Record<WalletType, Locator> = {
      [WalletType.NAMI]: this.namiOption,
      [WalletType.ETERNL]: this.eternlOption,
      [WalletType.LACE]: this.flintOption, // Using flint locator for lace
      [WalletType.VESPR]: this.vesprOption,
      [WalletType.GEROWALLET]: this.gerowallet,
      [WalletType.NUFI]: this.nufiOption,
      [WalletType.TYPHON]: this.nufiOption // Fallback to nufi for now
    };
    
    const walletOption = walletLocators[walletType];
    await expect(walletOption).toBeVisible();
    await expect(walletOption).toBeEnabled();
    
    await this.safeClick(walletOption, {
      timeout: getTimeout('walletConnection')
    });
  }
  
  /**
   * Handle wallet connection process
   */
  async performWalletConnection(walletType: WalletType): Promise<void> {
    // Mock the wallet connection in the browser context
    await this.mockWalletConnection(walletType);
    
    // Select wallet
    await this.selectWallet(walletType);
    
    // Wait for connection process to start
    await this.connectingMessage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    // Wait for connection to complete or show signature prompt
    try {
      await this.signaturePrompt.waitFor({ state: 'visible', timeout: 5000 });
      
      // In real scenario, user would sign in their wallet
      // For testing, we'll mock the signature approval
      await this.mockSignatureApproval();
    } catch {
      // No signature prompt appeared, connection might be direct
    }
    
    // Wait for success state
    await this.waitForConnectionSuccess();
  }
  
  /**
   * Wait for connection success
   */
  async waitForConnectionSuccess(): Promise<void> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: getTimeout('walletConnection') });
    } catch {
      // Check if modal closed (indicating success)
      await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }
  
  /**
   * Handle connection errors
   */
  async verifyConnectionError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(/error|failed|unable/i);
    
    // Retry button should be available
    await expect(this.retryButton).toBeVisible();
    await expect(this.retryButton).toBeEnabled();
  }
  
  /**
   * Retry connection after error
   */
  async retryConnection(): Promise<void> {
    await expect(this.retryButton).toBeVisible();
    await this.safeClick(this.retryButton);
  }
  
  /**
   * Close the modal
   */
  async closeModal(): Promise<void> {
    await this.safeClick(this.modalCloseButton);
    await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
  }
  
  /**
   * Cancel connection process
   */
  async cancelConnection(): Promise<void> {
    if (await this.cancelButton.isVisible()) {
      await this.safeClick(this.cancelButton);
    } else {
      await this.closeModal();
    }
  }
  
  /**
   * Verify wallet not detected scenario
   */
  async verifyWalletNotDetected(): Promise<void> {
    await expect(this.walletNotDetectedMessage).toBeVisible();
    await expect(this.walletNotDetectedMessage).toContainText(/not detected|not installed/i);
    
    // Should provide install links
    const installLinkCount = await this.installWalletLinks.count();
    expect(installLinkCount).toBeGreaterThan(0);
    
    // Install links should open in new tabs
    for (let i = 0; i < installLinkCount; i++) {
      const link = this.installWalletLinks.nth(i);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  }
  
  /**
   * Test modal responsiveness
   */
  async verifyModalResponsiveness(): Promise<void> {
    const viewports = ['mobile', 'tablet', 'desktop'] as const;
    
    for (const viewport of viewports) {
      await this.setViewport(viewport);
      
      await expect(this.modal).toBeVisible();
      await expect(this.walletSelectionGrid).toBeVisible();
      await expect(this.modalCloseButton).toBeVisible();
      
      // Take screenshot for visual regression
      await this.takeScreenshot(`wallet-modal-${viewport}`);
    }
  }
  
  /**
   * Test keyboard navigation in modal
   */
  async verifyKeyboardNavigation(): Promise<void> {
    // Tab through wallet options
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Tab');
    
    // Enter should activate focused wallet option
    await this.page.keyboard.press('Enter');
    
    // Escape should close modal
    await this.page.keyboard.press('Escape');
    await this.modal.waitFor({ state: 'hidden', timeout: 3000 });
  }
  
  /**
   * Mock wallet connection for testing
   */
  private async mockWalletConnection(walletType: WalletType): Promise<void> {
    const walletData = walletDataFactory.createWalletData({ walletType });
    const cip30Mock = walletDataFactory.generateCIP30WalletMock(walletType, walletData);
    
    await this.page.addInitScript((mockData) => {
      const { walletType, cip30Mock } = mockData;
      
      // Mock cardano object
      (window as any).cardano = {
        ...((window as any).cardano || {}),
        [walletType]: cip30Mock
      };
    }, { walletType, cip30Mock });
  }
  
  /**
   * Mock signature approval for testing
   */
  private async mockSignatureApproval(): Promise<void> {
    // In a real test environment, this would simulate user approving
    // the signature request in their wallet extension
    await this.page.waitForTimeout(1000); // Simulate user decision time
  }
  
  /**
   * Verify concurrent wallet connections are handled properly
   */
  async verifyConcurrentConnectionHandling(): Promise<void> {
    // This test would verify that attempting to connect multiple wallets
    // simultaneously is handled gracefully
    
    // Mock multiple wallet objects
    await this.mockWalletConnection(WalletType.NAMI);
    await this.mockWalletConnection(WalletType.ETERNL);
    
    // Try to connect to both rapidly
    await this.selectWallet(WalletType.NAMI);
    await this.selectWallet(WalletType.ETERNL);
    
    // Should handle gracefully without breaking
    const hasError = await this.errorMessage.isVisible().catch(() => false);
    if (hasError) {
      await expect(this.errorMessage).toContainText(/already connecting|connection in progress/i);
    }
  }
  
  /**
   * Test wallet extension crash recovery
   */
  async verifyWalletExtensionCrashRecovery(): Promise<void> {
    // Mock wallet extension crash scenario
    await this.page.addInitScript(() => {
      // Simulate wallet API becoming unavailable
      (window as any).cardano = undefined;
    });
    
    await this.selectWallet(WalletType.NAMI);
    
    // Should show appropriate error message
    await this.verifyConnectionError();
    
    // Should provide recovery options
    await expect(this.retryButton).toBeVisible();
  }
  
  /**
   * Comprehensive wallet connection modal test
   */
  async verifyWalletConnectionComplete(): Promise<void> {
    await this.verifyModalAppearance();
    await this.verifyAvailableWalletOptions();
    await this.verifyModalResponsiveness();
    await this.verifyKeyboardNavigation();
  }
}
