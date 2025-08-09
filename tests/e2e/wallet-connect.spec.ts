import { test, expect } from '@playwright/test';
import { mockCIP30Wallet, mockWalletAddresses, mockJWTToken, testConfig } from '../fixtures/playwrightMocks';
import { SELECTORS, getWalletPopoverSelector, getWalletSelector } from '../fixtures/selectors';

test.describe('Wallet Connection Flow - Eternl Only', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the cardano object with only Eternl wallet
    await page.addInitScript(() => {
      (window as any).cardano = {
        eternl: {
          name: 'Eternl',
          icon: 'data:image/svg+xml;base64,eternl-icon',
          version: '1.9.0',
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
        }
      };
    });

    await page.goto('/');
  });

  test('should display connect wallet button on landing page', async ({ page }) => {
    const connectButton = page.locator(SELECTORS.auth.walletConnectButton);
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });

  test('should open wallet selection popover when connect button is clicked', async ({ page }) => {
    const connectButton = page.locator(SELECTORS.auth.walletConnectButton);
    await connectButton.click();

    const walletPopover = page.locator(getWalletPopoverSelector());
    await expect(walletPopover).toBeVisible({ timeout: testConfig.walletConnectionTimeout });
  });

  test('should successfully connect to Eternl wallet', async ({ page }) => {
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
            walletType: 'eternl'
          }
        })
      });
    });

    // Start connection flow
    const connectButton = page.locator(SELECTORS.auth.walletConnectButton);
    await connectButton.click();

    // Select Eternl wallet
    const eternlWallet = page.locator(getWalletSelector('eternl')).first();
    await eternlWallet.click();

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
    const connectButton = page.locator(SELECTORS.auth.walletConnectButton);
    await connectButton.click();

    // Select Eternl wallet
    const eternlWallet = page.locator(getWalletSelector('eternl')).first();
    await eternlWallet.click();

    // Should show error message
    const errorMessage = page.locator(SELECTORS.common.errorMessage);
    await expect(errorMessage).toBeVisible({ timeout: testConfig.walletConnectionTimeout });

    // Should remain on landing page
    await expect(page).toHaveURL('/');
  });
});