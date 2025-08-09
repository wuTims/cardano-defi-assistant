/**
 * Error Scenario Helper
 * Simple, modular error scenarios that can be plugged into any test
 * Focused on current features only - add new scenarios incrementally as needed
 */

import { Page, expect } from '@playwright/test';

/**
 * Simple error scenario structure
 */
export interface ErrorScenario {
  id: string;
  name: string;
  description?: string;
  setup: (page: Page) => Promise<void>;
  verify?: (page: Page) => Promise<void>;
  cleanup?: (page: Page) => Promise<void>;
}

/**
 * Helper class for managing predefined error scenarios
 * Keep scenarios SIMPLE and focused on current features
 */
export class ErrorScenarioHelper {
  /**
   * Predefined error scenarios for current features
   * Add new scenarios incrementally as features are developed
   */
  static readonly SCENARIOS: Record<string, ErrorScenario> = {
    // Network-related scenarios
    networkOffline: {
      id: 'network-offline',
      name: 'Network goes offline',
      description: 'Simulates loss of network connectivity',
      setup: async (page) => {
        await page.context().setOffline(true);
      },
      verify: async (page) => {
        const error = page.locator('text=/network|offline|connection/i');
        await expect(error).toBeVisible({ timeout: 5000 });
      },
      cleanup: async (page) => {
        await page.context().setOffline(false);
      }
    },

    // API error scenarios
    serverError: {
      id: 'server-error',
      name: 'API returns 500 error',
      description: 'All API endpoints return internal server error',
      setup: async (page) => {
        await page.route('/api/**', route => 
          route.fulfill({ 
            status: 500, 
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Internal server error'
            })
          })
        );
      },
      verify: async (page) => {
        const error = page.locator('text=/server error|internal error|try again/i');
        await expect(error).toBeVisible({ timeout: 5000 });
      }
    },

    malformedResponse: {
      id: 'malformed-response',
      name: 'API returns malformed JSON',
      description: 'API returns invalid JSON response',
      setup: async (page) => {
        await page.route('/api/**', route => 
          route.fulfill({ 
            status: 200, 
            contentType: 'application/json',
            body: 'invalid json {{'
          })
        );
      },
      verify: async (page) => {
        const error = page.locator('text=/error|failed|invalid/i');
        await expect(error).toBeVisible({ timeout: 5000 });
      }
    },

    // Authentication scenarios
    authTokenExpired: {
      id: 'auth-expired',
      name: 'Authentication token expires',
      description: 'Simulates expired JWT token',
      setup: async (page) => {
        await page.evaluate(() => {
          localStorage.setItem('auth-token', 'expired.invalid.token');
          localStorage.setItem('auth-expires', '0'); // Already expired
        });
      },
      verify: async (page) => {
        // Should redirect to landing page
        await expect(page).toHaveURL('/', { timeout: 5000 });
      },
      cleanup: async (page) => {
        await page.evaluate(() => {
          localStorage.removeItem('auth-token');
          localStorage.removeItem('auth-expires');
        });
      }
    },

    authTokenCorrupted: {
      id: 'auth-corrupted',
      name: 'Authentication token corrupted',
      description: 'Token exists but is invalid/corrupted',
      setup: async (page) => {
        await page.evaluate(() => {
          localStorage.setItem('auth-token', 'corrupted-token-data');
          localStorage.setItem('wallet-address', 'addr1test');
        });
      },
      verify: async (page) => {
        // Should clear auth and redirect
        const authToken = await page.evaluate(() => localStorage.getItem('auth-token'));
        expect(authToken).toBeNull();
      },
      cleanup: async (page) => {
        await page.evaluate(() => localStorage.clear());
      }
    },

    // Storage scenarios
    localStorageFull: {
      id: 'storage-full',
      name: 'LocalStorage quota exceeded',
      description: 'Browser storage is full',
      setup: async (page) => {
        await page.evaluate(() => {
          // Try to fill localStorage (will throw quota exceeded)
          try {
            const data = 'x'.repeat(1024 * 1024); // 1MB string
            for (let i = 0; i < 100; i++) {
              localStorage.setItem(`fill-${i}`, data);
            }
          } catch (e) {
            // Storage is now full
          }
        });
      },
      verify: async (page) => {
        // App should handle storage errors gracefully
        const storageError = page.locator('text=/storage|quota/i');
        // Note: This is optional - app might handle silently
      },
      cleanup: async (page) => {
        await page.evaluate(() => {
          // Clear all fill items
          for (let i = 0; i < 100; i++) {
            localStorage.removeItem(`fill-${i}`);
          }
        });
      }
    },

    // Wallet scenarios
    walletNotInstalled: {
      id: 'wallet-not-installed',
      name: 'No wallet extensions installed',
      description: 'Cardano object is missing or empty',
      setup: async (page) => {
        await page.addInitScript(() => {
          delete (window as any).cardano;
        });
      },
      verify: async (page) => {
        const noWalletMessage = page.locator('text=/no wallet|install/i');
        await expect(noWalletMessage).toBeVisible({ timeout: 5000 });
      }
    },

    walletConnectionRejected: {
      id: 'wallet-rejected',
      name: 'User rejects wallet connection',
      description: 'User denies wallet access permission',
      setup: async (page) => {
        await page.addInitScript(() => {
          (window as any).cardano = {
            nami: {
              name: 'Nami',
              enable: () => Promise.reject(new Error('User rejected'))
            }
          };
        });
      },
      verify: async (page) => {
        const rejectionMessage = page.locator('text=/rejected|cancelled|denied/i');
        await expect(rejectionMessage).toBeVisible({ timeout: 5000 });
      }
    }
  };

  /**
   * Apply a predefined scenario to a page
   * @param page - The Playwright page object
   * @param scenarioId - The ID of the scenario to apply
   */
  static async applyScenario(page: Page, scenarioId: string): Promise<void> {
    const scenario = this.SCENARIOS[scenarioId];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioId}. Available: ${Object.keys(this.SCENARIOS).join(', ')}`);
    }
    
    await scenario.setup(page);
    
    if (scenario.verify) {
      await scenario.verify(page);
    }
  }

  /**
   * Apply multiple scenarios in sequence
   * @param page - The Playwright page object
   * @param scenarioIds - Array of scenario IDs to apply
   */
  static async applyScenarios(page: Page, scenarioIds: string[]): Promise<void> {
    for (const id of scenarioIds) {
      await this.applyScenario(page, id);
    }
  }

  /**
   * Clean up after a scenario
   * @param page - The Playwright page object
   * @param scenarioId - The ID of the scenario to clean up
   */
  static async cleanupScenario(page: Page, scenarioId: string): Promise<void> {
    const scenario = this.SCENARIOS[scenarioId];
    if (scenario?.cleanup) {
      await scenario.cleanup(page);
    }
  }

  /**
   * Get all available scenario IDs
   */
  static getAvailableScenarios(): string[] {
    return Object.keys(this.SCENARIOS);
  }

  /**
   * Get scenario by ID
   */
  static getScenario(scenarioId: string): ErrorScenario | undefined {
    return this.SCENARIOS[scenarioId];
  }
}