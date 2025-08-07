import { test, expect } from '@playwright/test';
import { mockCIP30Wallet, mockWalletAddresses, mockJWTToken, testConfig } from '../fixtures/mockWalletData';

test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the cardano object in browser context
    await page.addInitScript(() => {
      // Mock cardano global object with CIP-30 compliant wallet
      (window as any).cardano = {
        nami: {
          name: 'Nami',
          icon: 'data:image/svg+xml;base64,nami-icon',
          version: '3.3.0',
          isEnabled: () => Promise.resolve(true),
          enable: () => Promise.resolve({
            getNetworkId: () => Promise.resolve(0),
            getUtxos: () => Promise.resolve([]),
            getBalance: () => Promise.resolve('0x3d0900'),
            getUsedAddresses: () => Promise.resolve(['addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzz2zl9c2dhpxy5v9kv4z6snyh6f8g3npz69rtr5cj6vhkrrgqt7vp0t']),
            getUnusedAddresses: () => Promise.resolve([]),
            getChangeAddress: () => Promise.resolve('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzz2zl9c2dhpxy5v9kv4z6snyh6f8g3npz69rtr5cj6vhkrrgqt7vp0t'),
            getRewardAddresses: () => Promise.resolve(['stake1test123']),
            signData: () => Promise.resolve({
              signature: 'a4ed2f42b4f98c1f84f5b3c8d9e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
              key: 'e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7'
            }),
            signTx: () => Promise.resolve('signed_tx'),
            submitTx: () => Promise.resolve('tx_hash')
          })
        },
        eternl: {
          name: 'Eternl',
          icon: 'data:image/svg+xml;base64,eternl-icon',
          version: '1.9.0',
          isEnabled: () => Promise.resolve(false),
          enable: () => Promise.resolve(null)
        },
        lace: {
          name: 'Lace',
          icon: 'data:image/svg+xml;base64,lace-icon',
          version: '1.0.0',
          isEnabled: () => Promise.resolve(false),
          enable: () => Promise.resolve(null)
        }
      };
    });

    // Navigate to the landing page
    await page.goto('/');
  });

  test('should display connect wallet button on landing page', async ({ page }) => {
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });

  test('should open wallet selection popover when connect button is clicked', async ({ page }) => {
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Check if popover/modal appears
    const walletPopover = page.locator('[data-testid="wallet-popover"], [role="dialog"], .wallet-selection');
    await expect(walletPopover).toBeVisible({ timeout: testConfig.walletConnectionTimeout });
  });

  test('should display available wallets in selection popover', async ({ page }) => {
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Wait for popover to appear
    await page.waitForSelector('[data-testid="wallet-popover"], [role="dialog"], .wallet-selection', { 
      timeout: testConfig.walletConnectionTimeout 
    });

    // Check for Nami wallet option (which should be available in our mock)
    const namiWallet = page.locator('text=/nami/i');
    await expect(namiWallet).toBeVisible();

    // Check for Eternl wallet option
    const eternlWallet = page.locator('text=/eternl/i');
    await expect(eternlWallet).toBeVisible();

    // Check for Lace wallet option
    const laceWallet = page.locator('text=/lace/i');
    await expect(laceWallet).toBeVisible();
  });

  test('should successfully connect to Nami wallet', async ({ page }) => {
    // Mock API endpoints for successful authentication
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: mockWalletAddresses.valid,
            nonce: 'challenge-nonce-123',
            challenge: 'Please sign this message to authenticate',
            expiresAt: new Date(Date.now() + 300000).toISOString()
          }
        })
      });
    });

    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: mockJWTToken,
            walletAddress: mockWalletAddresses.valid,
            walletType: 'nami'
          }
        })
      });
    });

    // Start connection flow
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Select Nami wallet
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Wait for connection to complete and redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: testConfig.walletConnectionTimeout });
  });

  test('should handle wallet connection error gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Challenge generation failed'
        })
      });
    });

    // Start connection flow
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Select Nami wallet
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should show error message
    const errorMessage = page.locator('text=/error|failed|unable/i');
    await expect(errorMessage).toBeVisible({ timeout: testConfig.walletConnectionTimeout });

    // Should remain on landing page
    await expect(page).toHaveURL('/');
  });

  test('should handle wallet not installed scenario', async ({ page }) => {
    // Override cardano object to simulate no wallet installed
    await page.addInitScript(() => {
      (window as any).cardano = {};
    });

    await page.goto('/');

    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Should show message about no wallets installed
    const noWalletMessage = page.locator('text=/no wallet|install/i');
    await expect(noWalletMessage).toBeVisible({ timeout: testConfig.walletConnectionTimeout });
  });

  test('should handle user rejection of wallet connection', async ({ page }) => {
    // Mock wallet to reject connection
    await page.addInitScript(() => {
      (window as any).cardano.nami.enable = () => Promise.reject(new Error('User rejected'));
    });

    // Start connection flow
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Select Nami wallet
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should show user rejection message
    const rejectionMessage = page.locator('text=/rejected|cancelled|denied/i');
    await expect(rejectionMessage).toBeVisible({ timeout: testConfig.walletConnectionTimeout });

    // Should remain on landing page
    await expect(page).toHaveURL('/');
  });

  test('should handle signature verification failure', async ({ page }) => {
    // Mock challenge to succeed but verification to fail
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: mockWalletAddresses.valid,
            nonce: 'challenge-nonce-123',
            challenge: 'Please sign this message to authenticate',
            expiresAt: new Date(Date.now() + 300000).toISOString()
          }
        })
      });
    });

    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid signature'
        })
      });
    });

    // Start connection flow
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Select Nami wallet
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should show signature error
    const errorMessage = page.locator('text=/invalid signature|authentication failed/i');
    await expect(errorMessage).toBeVisible({ timeout: testConfig.walletConnectionTimeout });

    // Should remain on landing page
    await expect(page).toHaveURL('/');
  });

  test('should close wallet popover when clicking outside', async ({ page }) => {
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Verify popover is open
    const walletPopover = page.locator('[data-testid="wallet-popover"], [role="dialog"], .wallet-selection');
    await expect(walletPopover).toBeVisible();

    // Click outside the popover
    await page.click('body', { position: { x: 50, y: 50 } });

    // Popover should close
    await expect(walletPopover).not.toBeVisible();
  });

  test('should handle network timeout during connection', async ({ page }) => {
    // Mock API with delay to simulate timeout
    await page.route('/api/auth/challenge', async (route) => {
      await new Promise(resolve => setTimeout(resolve, testConfig.apiTimeout + 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} })
      });
    });

    // Start connection flow
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();

    // Select Nami wallet
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should show timeout/network error
    const timeoutMessage = page.locator('text=/timeout|network|failed/i');
    await expect(timeoutMessage).toBeVisible({ timeout: testConfig.walletConnectionTimeout });
  });

  test('should maintain wallet connection state after successful auth', async ({ page }) => {
    // Mock successful auth flow
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: mockWalletAddresses.valid,
            nonce: 'challenge-nonce-123',
            challenge: 'Please sign this message to authenticate',
            expiresAt: new Date(Date.now() + 300000).toISOString()
          }
        })
      });
    });

    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: mockJWTToken,
            walletAddress: mockWalletAddresses.valid,
            walletType: 'nami'
          }
        })
      });
    });

    // Connect wallet
    const connectButton = page.locator('button', { hasText: /connect wallet/i });
    await connectButton.click();
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: testConfig.walletConnectionTimeout });

    // Navigate back to landing page
    await page.goto('/');

    // Should show connected state (no connect button, or different button text)
    const disconnectButton = page.locator('button', { hasText: /disconnect|connected/i });
    await expect(disconnectButton).toBeVisible();
  });
});