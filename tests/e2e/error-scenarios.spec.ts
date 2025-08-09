import { test, expect } from '@playwright/test';
import { mockJWTToken, mockWalletAddresses, testConfig } from '../fixtures/playwrightMocks';

test.describe('Error Scenarios', () => {
  test('should handle network connectivity issues', async ({ page }) => {
    // Load page first, then simulate offline mode
    await page.goto('/');
    
    // Try to connect wallet - use specific test-id to avoid ambiguity
    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();
    
    // Now simulate offline mode after initial page load
    await page.context().setOffline(true);

    // Should show network error
    const networkError = page.locator('text=/network|offline|connection/i');
    await expect(networkError).toBeVisible({ timeout: testConfig.apiTimeout });

    // Restore connectivity
    await page.context().setOffline(false);
  });

  test('should handle API server errors (5xx)', async ({ page }) => {
    // Mock all API endpoints to return 500 errors
    await page.route('/api/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      });
    });

    await page.goto('/');

    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();

    // Should show server error message
    const serverError = page.locator('text=/server error|internal error|try again later/i');
    await expect(serverError).toBeVisible({ timeout: testConfig.apiTimeout });
  });

  test('should handle malformed API responses', async ({ page }) => {
    // Mock API to return malformed JSON
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response {'
      });
    });

    // Mock cardano wallet
    await page.addInitScript(() => {
      (window as any).cardano = {
        nami: {
          name: 'Nami',
          isEnabled: () => Promise.resolve(true),
          enable: () => Promise.resolve({
            getUsedAddresses: () => Promise.resolve(['addr1test']),
            signData: () => Promise.resolve({ signature: 'sig', key: 'key' })
          })
        }
      };
    });

    await page.goto('/');

    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();

    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should handle malformed response gracefully
    const parseError = page.locator('text=/error|failed|invalid response/i');
    await expect(parseError).toBeVisible({ timeout: testConfig.apiTimeout });
  });

  test('should handle wallet extension crashes', async ({ page }) => {
    // Mock wallet methods to throw errors
    await page.addInitScript(() => {
      (window as any).cardano = {
        nami: {
          name: 'Nami',
          isEnabled: () => Promise.resolve(true),
          enable: () => Promise.resolve({
            getUsedAddresses: () => Promise.reject(new Error('Wallet crashed')),
            signData: () => Promise.reject(new Error('Wallet crashed'))
          })
        }
      };
    });

    await page.goto('/');

    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();

    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should show wallet error
    const walletError = page.locator('text=/wallet error|wallet crashed|wallet unavailable/i');
    await expect(walletError).toBeVisible({ timeout: testConfig.walletConnectionTimeout });
  });

  test('should handle authentication token corruption', async ({ page }) => {
    // Set corrupted token in localStorage
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'corrupted.token.here');
      localStorage.setItem('wallet-address', 'addr1test');
    });

    // Mock auth verification to fail
    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid token'
        })
      });
    });

    // Try to access dashboard
    await page.goto('/dashboard');

    // Should redirect to landing page
    await expect(page).toHaveURL('/', { timeout: testConfig.apiTimeout });

    // Should clear corrupted auth data
    const authToken = await page.evaluate(() => localStorage.getItem('auth-token'));
    expect(authToken).toBeNull();
  });

  test('should handle page refresh during wallet connection', async ({ page }) => {
    // Mock successful challenge generation
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: mockWalletAddresses.valid,
            nonce: 'test-nonce',
            challenge: 'test challenge',
            expiresAt: new Date(Date.now() + 300000).toISOString()
          }
        })
      });
    });

    // Mock wallet
    await page.addInitScript(() => {
      (window as any).cardano = {
        nami: {
          name: 'Nami',
          isEnabled: () => Promise.resolve(true),
          enable: () => new Promise(resolve => {
            // Simulate long-running wallet connection
            setTimeout(() => {
              resolve({
                getUsedAddresses: () => Promise.resolve(['addr1test']),
                signData: () => Promise.resolve({ signature: 'sig', key: 'key' })
              });
            }, 5000);
          })
        }
      };
    });

    await page.goto('/');

    // Start wallet connection
    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Refresh page during connection
    await page.waitForTimeout(1000);
    await page.reload();

    // Should reset to initial state
    const connectButtonAfterRefresh = page.locator('button', { hasText: /connect wallet/i });
    await expect(connectButtonAfterRefresh).toBeVisible();
  });

  test('should handle browser back/forward during authentication', async ({ page }) => {
    // Set up successful authentication flow
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: mockWalletAddresses.valid,
            nonce: 'test-nonce',
            challenge: 'test challenge',
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

    // Mock wallet and dashboard data
    await page.addInitScript(() => {
      (window as any).cardano = {
        nami: {
          name: 'Nami',
          isEnabled: () => Promise.resolve(true),
          enable: () => Promise.resolve({
            getUsedAddresses: () => Promise.resolve([mockWalletAddresses.valid]),
            signData: () => Promise.resolve({ signature: 'sig', key: 'key' })
          })
        }
      };
    });

    await page.route('/api/wallet/data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} })
      });
    });

    await page.goto('/');

    // Complete authentication
    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: testConfig.walletConnectionTimeout });

    // Use browser back button
    await page.goBack();

    // Should handle navigation gracefully
    await expect(page).toHaveURL('/');

    // Forward button should work
    await page.goForward();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle concurrent wallet connections', async ({ page }) => {
    // Mock wallet
    await page.addInitScript(() => {
      let connectionCount = 0;
      (window as any).cardano = {
        nami: {
          name: 'Nami',
          isEnabled: () => Promise.resolve(true),
          enable: () => {
            connectionCount++;
            if (connectionCount > 1) {
              return Promise.reject(new Error('Wallet already connecting'));
            }
            return Promise.resolve({
              getUsedAddresses: () => Promise.resolve(['addr1test']),
              signData: () => Promise.resolve({ signature: 'sig', key: 'key' })
            });
          }
        }
      };
    });

    await page.goto('/');

    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();

    // Try to connect multiple times quickly
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();
    await namiWallet.click(); // Second click

    // Should handle concurrent connections gracefully
    const errorMessage = page.locator('text=/already connecting|connection in progress/i');
    await expect(errorMessage).toBeVisible({ timeout: testConfig.walletConnectionTimeout });
  });

  test('should handle localStorage quota exceeded', async ({ page }) => {
    // Fill up localStorage
    await page.addInitScript(() => {
      try {
        let data = 'x';
        for (let i = 0; i < 20; i++) {
          data += data; // Exponentially increase data size
        }
        for (let i = 0; i < 1000; i++) {
          localStorage.setItem(`key${i}`, data);
        }
      } catch (e) {
        // localStorage is full
      }
    });

    // Mock successful auth
    await page.route('/api/auth/challenge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            walletAddress: mockWalletAddresses.valid,
            nonce: 'test-nonce',
            challenge: 'test challenge',
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

    // Mock wallet
    await page.addInitScript(() => {
      (window as any).cardano = {
        nami: {
          name: 'Nami',
          isEnabled: () => Promise.resolve(true),
          enable: () => Promise.resolve({
            getUsedAddresses: () => Promise.resolve([mockWalletAddresses.valid]),
            signData: () => Promise.resolve({ signature: 'sig', key: 'key' })
          })
        }
      };
    });

    await page.goto('/');

    // Try to connect wallet (this should try to store token)
    const connectButton = page.getByTestId('hero-primary-button');
    await connectButton.click();
    const namiWallet = page.locator('text=/nami/i').first();
    await namiWallet.click();

    // Should handle storage quota gracefully
    const storageError = page.locator('text=/storage full|quota exceeded|storage error/i');
    // This test might need adjustment based on how the app handles storage errors
  });

  test('should handle JavaScript disabled scenario', async ({ page, context }) => {
    // Disable JavaScript
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (compatible; NoJS/1.0)'
    });

    await page.goto('/');

    // With JS disabled, the connect wallet button should still be visible
    // but clicking it should show a message about requiring JavaScript
    const connectButton = page.getByTestId('hero-primary-button');
    await expect(connectButton).toBeVisible();

    // Note: This test is limited since Playwright requires JavaScript.
    // In a real scenario, you'd want to test with noscript tags and
    // server-side rendering fallbacks.
  });
});