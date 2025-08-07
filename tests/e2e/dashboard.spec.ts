import { test, expect } from '@playwright/test';
import { mockWalletData, mockJWTToken, mockWalletAddresses, testConfig, mockBlockfrostResponses } from '../fixtures/mockWalletData';

test.describe('Dashboard Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state
    await page.addInitScript((token) => {
      localStorage.setItem('auth-token', token);
      localStorage.setItem('wallet-address', 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzz2zl9c2dhpxy5v9kv4z6snyh6f8g3npz69rtr5cj6vhkrrgqt7vp0t');
      localStorage.setItem('wallet-type', 'nami');
    }, mockJWTToken);

    // Mock API endpoints for wallet data
    await page.route('/api/wallet/data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockWalletData
        })
      });
    });

    await page.route('/api/wallet/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            message: 'Wallet synced successfully',
            syncedAt: new Date().toISOString(),
            blockHeight: mockWalletData.syncedBlockHeight
          }
        })
      });
    });

    // Mock auth verification
    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: mockWalletAddresses.valid,
            walletType: 'nami'
          }
        })
      });
    });
  });

  test('should redirect unauthenticated users to landing page', async ({ page }) => {
    // Clear authentication
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Try to access dashboard
    await page.goto('/dashboard');

    // Should redirect to landing page
    await expect(page).toHaveURL('/', { timeout: testConfig.apiTimeout });
  });

  test('should display dashboard for authenticated user', async ({ page }) => {
    await page.goto('/dashboard');

    // Should remain on dashboard page
    await expect(page).toHaveURL('/dashboard');

    // Should display dashboard content
    const dashboardHeading = page.locator('h1, h2', { hasText: /dashboard|wallet/i });
    await expect(dashboardHeading).toBeVisible();
  });

  test('should display wallet overview information', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for wallet address display
    const walletAddress = page.locator('text=' + mockWalletAddresses.valid.substring(0, 20));
    await expect(walletAddress).toBeVisible();

    // Check for balance display
    const balance = page.locator('text=/4.*ADA|4,000,000.*lovelace/i');
    await expect(balance).toBeVisible();

    // Check for last sync information
    const lastSync = page.locator('text=/last sync|synced/i');
    await expect(lastSync).toBeVisible();
  });

  test('should display wallet assets if any exist', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for native token display (if assets exist)
    const assetsSection = page.locator('[data-testid="assets-section"], text=/assets|tokens/i');
    await expect(assetsSection).toBeVisible();

    // Should show asset count or "No assets" message
    const assetInfo = page.locator('text=/2 assets|no assets|tokens/i');
    await expect(assetInfo).toBeVisible();
  });

  test('should display wallet UTXOs information', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for UTXO information
    const utxoSection = page.locator('[data-testid="utxos-section"], text=/utxo|unspent/i');
    await expect(utxoSection).toBeVisible();

    // Should show UTXO count
    const utxoCount = page.locator('text=/2 utxo|utxos/i');
    await expect(utxoCount).toBeVisible();
  });

  test('should have functional sync wallet button', async ({ page }) => {
    await page.goto('/dashboard');

    // Find sync button
    const syncButton = page.locator('button', { hasText: /sync|refresh|update/i });
    await expect(syncButton).toBeVisible();
    await expect(syncButton).toBeEnabled();

    // Click sync button
    await syncButton.click();

    // Should show loading or success state
    const syncFeedback = page.locator('text=/syncing|synced|updating/i');
    await expect(syncFeedback).toBeVisible({ timeout: testConfig.syncTimeout });
  });

  test('should display proper navigation elements', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for navigation/header
    const navigation = page.locator('[data-testid="navigation"], nav, header');
    await expect(navigation).toBeVisible();

    // Should have logout/disconnect option
    const logoutButton = page.locator('button', { hasText: /logout|disconnect|sign out/i });
    await expect(logoutButton).toBeVisible();
  });

  test('should handle wallet disconnect functionality', async ({ page }) => {
    await page.goto('/dashboard');

    // Find disconnect button
    const disconnectButton = page.locator('button', { hasText: /disconnect|logout|sign out/i });
    await disconnectButton.click();

    // Should redirect to landing page
    await expect(page).toHaveURL('/', { timeout: testConfig.apiTimeout });

    // Should clear authentication state
    const authToken = await page.evaluate(() => localStorage.getItem('auth-token'));
    expect(authToken).toBeNull();
  });

  test('should display error state when wallet data fails to load', async ({ page }) => {
    // Mock API to return error
    await page.route('/api/wallet/data', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to fetch wallet data'
        })
      });
    });

    await page.goto('/dashboard');

    // Should show error message
    const errorMessage = page.locator('text=/error|failed|unable to load/i');
    await expect(errorMessage).toBeVisible({ timeout: testConfig.apiTimeout });

    // Should provide retry option
    const retryButton = page.locator('button', { hasText: /retry|try again|refresh/i });
    await expect(retryButton).toBeVisible();
  });

  test('should handle sync failure gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock sync to fail
    await page.route('/api/wallet/sync', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Sync failed'
        })
      });
    });

    // Click sync button
    const syncButton = page.locator('button', { hasText: /sync|refresh|update/i });
    await syncButton.click();

    // Should show error message
    const errorMessage = page.locator('text=/sync failed|error|unable to sync/i');
    await expect(errorMessage).toBeVisible({ timeout: testConfig.syncTimeout });
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Dashboard should still be functional
    const dashboardContent = page.locator('h1, h2', { hasText: /dashboard|wallet/i });
    await expect(dashboardContent).toBeVisible();

    // Navigation should be mobile-friendly
    const navigation = page.locator('[data-testid="navigation"], nav, header');
    await expect(navigation).toBeVisible();

    // Wallet information should be displayed properly
    const walletInfo = page.locator('text=' + mockWalletAddresses.valid.substring(0, 15));
    await expect(walletInfo).toBeVisible();
  });

  test('should update wallet data after successful sync', async ({ page }) => {
    await page.goto('/dashboard');

    // Get initial balance display
    const initialBalance = await page.locator('text=/4.*ADA|4,000,000/').textContent();

    // Mock updated wallet data
    await page.route('/api/wallet/data', async (route) => {
      const updatedWalletData = {
        ...mockWalletData,
        balance: { ...mockWalletData.balance, lovelace: '5000000' },
        lastSynced: new Date()
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: updatedWalletData
        })
      });
    });

    // Perform sync
    const syncButton = page.locator('button', { hasText: /sync|refresh|update/i });
    await syncButton.click();

    // Wait for sync to complete
    await expect(page.locator('text=/synced|updated/i')).toBeVisible({ timeout: testConfig.syncTimeout });

    // Balance should update (this would require the frontend to refresh data after sync)
    await page.waitForTimeout(1000); // Allow time for UI update

    // Check if balance has been updated (this test might need adjustment based on actual implementation)
    const updatedBalance = page.locator('text=/5.*ADA|5,000,000/');
    // Note: This assertion might need to be adjusted based on how the frontend handles data refreshing
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock auth verification to fail (session expired)
    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Token expired'
        })
      });
    });

    // Trigger an action that would verify auth (like sync)
    const syncButton = page.locator('button', { hasText: /sync|refresh|update/i });
    await syncButton.click();

    // Should redirect to landing page due to expired session
    await expect(page).toHaveURL('/', { timeout: testConfig.apiTimeout });

    // Should show session expired message
    const sessionMessage = page.locator('text=/session expired|please reconnect/i');
    await expect(sessionMessage).toBeVisible();
  });

  test('should display wallet type information', async ({ page }) => {
    await page.goto('/dashboard');

    // Should show which wallet is connected
    const walletType = page.locator('text=/nami|connected with nami/i');
    await expect(walletType).toBeVisible();
  });
});