/**
 * API Mock Helper - Centralized API mocking utilities for Playwright tests
 */

import { Page, Route } from '@playwright/test';
import { walletDataFactory, TestWalletData, WalletType } from '../test-data/wallet-data-factory';
import { testConfig } from '../config/test-config';
import { ErrorType } from '../types';

export interface MockApiOptions {
  delay?: number;
  failureRate?: number;
  statusCode?: number;
  customResponse?: any;
}

export class ApiMockHelper {
  private page: Page;
  private routes: Map<string, Route> = new Map();
  
  constructor(page: Page) {
    this.page = page;
  }
  
  /**
   * Mock authentication endpoints
   */
  async mockAuthEndpoints(walletData: TestWalletData, options: MockApiOptions = {}): Promise<void> {
    const { delay = testConfig.mocks.responseDelay, statusCode = 200 } = options;
    
    // Mock auth challenge generation
    await this.page.route('/api/auth/challenge', async (route) => {
      await this.simulateNetworkDelay(delay);
      
      if (this.shouldSimulateFailure(options.failureRate)) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(walletDataFactory.createErrorResponse(ErrorType.SERVER_ERROR))
        });
        return;
      }
      
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            challenge: 'test-challenge-' + Date.now(),
            expiresAt: new Date(Date.now() + 300000).toISOString() // 5 minutes
          }
        })
      });
    });
    
    // Mock signature verification
    await this.page.route('/api/auth/verify', async (route) => {
      await this.simulateNetworkDelay(delay);
      
      if (this.shouldSimulateFailure(options.failureRate)) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify(walletDataFactory.createErrorResponse(ErrorType.INVALID_SIGNATURE))
        });
        return;
      }
      
      const jwtToken = walletDataFactory.generateJWTToken(walletData.address, walletData.walletType);
      
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: jwtToken,
            walletAddress: walletData.address,
            walletType: walletData.walletType,
            expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
          }
        })
      });
    });
    
    // Mock token validation
    await this.page.route('/api/auth/validate', async (route) => {
      await this.simulateNetworkDelay(delay);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            valid: true,
            walletAddress: walletData.address,
            walletType: walletData.walletType
          }
        })
      });
    });
  }
  
  /**
   * Mock wallet data endpoints
   */
  async mockWalletDataEndpoints(walletData: TestWalletData, options: MockApiOptions = {}): Promise<void> {
    const { delay = testConfig.mocks.responseDelay, statusCode = 200 } = options;
    
    // Mock wallet data retrieval
    await this.page.route('/api/wallet/data', async (route) => {
      await this.simulateNetworkDelay(delay);
      
      if (this.shouldSimulateFailure(options.failureRate)) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(walletDataFactory.createErrorResponse(ErrorType.SERVER_ERROR))
        });
        return;
      }
      
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify(walletDataFactory.createSuccessResponse(walletData))
      });
    });
    
    // Mock wallet sync operation
    await this.page.route('/api/wallet/sync', async (route) => {
      await this.simulateNetworkDelay(delay * 2); // Sync takes longer
      
      if (this.shouldSimulateFailure(options.failureRate)) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify(walletDataFactory.createErrorResponse(ErrorType.NETWORK_ERROR))
        });
        return;
      }
      
      // Update sync data
      const updatedData = {
        ...walletData,
        syncedBlockHeight: walletData.syncedBlockHeight + 100,
        lastSynced: new Date()
      };
      
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            message: 'Wallet synced successfully',
            syncedAt: updatedData.lastSynced.toISOString(),
            blockHeight: updatedData.syncedBlockHeight,
            walletData: updatedData
          }
        })
      });
    });
    
    // Mock wallet balance endpoint
    await this.page.route('/api/wallet/balance', async (route) => {
      await this.simulateNetworkDelay(delay);
      
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: walletData.balance
        })
      });
    });
  }
  
  /**
   * Mock Blockfrost API endpoints
   */
  async mockBlockfrostEndpoints(walletData: TestWalletData, options: MockApiOptions = {}): Promise<void> {
    const { delay = testConfig.mocks.responseDelay } = options;
    
    // Mock address information
    await this.page.route(`**/addresses/${walletData.address}`, async (route) => {
      await this.simulateNetworkDelay(delay);
      
      if (this.shouldSimulateFailure(options.failureRate)) {
        await route.fulfill({ status: 404 });
        return;
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          address: walletData.address,
          amount: [{
            unit: 'lovelace',
            quantity: walletData.balance.lovelace
          }],
          stake_address: walletData.stakingInfo.stakeAddress,
          type: 'shelley'
        })
      });
    });
    
    // Mock UTXOs
    await this.page.route(`**/addresses/${walletData.address}/utxos`, async (route) => {
      await this.simulateNetworkDelay(delay);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(walletData.utxos.map(utxo => ({
          tx_hash: utxo.txHash,
          output_index: utxo.outputIndex,
          amount: utxo.amount,
          block: 'block_hash_example',
          data_hash: null
        })))
      });
    });
  }
  
  /**
   * Mock error scenarios
   */
  async mockErrorScenarios(): Promise<void> {
    // Mock network connectivity issues
    await this.page.route('/api/**', async (route, request) => {
      if (request.url().includes('network-error')) {
        await route.abort('failed');
        return;
      }
      route.continue();
    });
    
    // Mock server errors (5xx)
    await this.page.route('/api/server-error/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify(walletDataFactory.createErrorResponse(ErrorType.SERVER_ERROR))
      });
    });
    
    // Mock malformed responses
    await this.page.route('/api/malformed/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response'
      });
    });
    
    // Mock timeout scenarios
    await this.page.route('/api/timeout/**', async (route) => {
      // Never respond to simulate timeout
      await this.page.waitForTimeout(30000);
      await route.abort('timedout');
    });
  }
  
  /**
   * Mock authentication token corruption
   */
  async mockTokenCorruption(): Promise<void> {
    await this.page.addInitScript(() => {
      // Corrupt the stored JWT token
      localStorage.setItem('auth-token', 'corrupted.jwt.token');
    });
    
    await this.page.route('/api/auth/validate', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify(walletDataFactory.createErrorResponse(ErrorType.INVALID_SIGNATURE, 'Token is corrupted or invalid'))
      });
    });
  }
  
  /**
   * Mock localStorage quota exceeded
   */
  async mockLocalStorageQuotaExceeded(): Promise<void> {
    await this.page.addInitScript(() => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key: string, value: string) {
        throw new Error('QuotaExceededError: Failed to execute setItem on Storage');
      };
    });
  }
  
  /**
   * Mock JavaScript disabled scenario
   */
  async mockJavaScriptDisabled(): Promise<void> {
    await this.page.context().addInitScript(() => {
      // Simulate JavaScript being disabled by overriding key functions
      (window as any).fetch = undefined;
      (window as any).XMLHttpRequest = undefined;
    });
  }
  
  /**
   * Mock concurrent wallet connections
   */
  async mockConcurrentConnections(): Promise<void> {
    let connectionCount = 0;
    
    await this.page.route('/api/auth/**', async (route) => {
      connectionCount++;
      
      if (connectionCount > 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify(walletDataFactory.createErrorResponse(
            ErrorType.VALIDATION_ERROR, 
            'Connection already in progress'
          ))
        });
        return;
      }
      
      route.continue();
    });
  }
  
  /**
   * Setup comprehensive API mocking for a test
   */
  async setupCompleteMocking(walletData?: TestWalletData, options: MockApiOptions = {}): Promise<TestWalletData> {
    const testWalletData = walletData || walletDataFactory.createWalletData();
    
    await this.mockAuthEndpoints(testWalletData, options);
    await this.mockWalletDataEndpoints(testWalletData, options);
    await this.mockBlockfrostEndpoints(testWalletData, options);
    
    // Setup authentication state in localStorage
    await this.page.addInitScript((data) => {
      const { walletData } = data;
      localStorage.setItem('auth-token', walletDataFactory.generateJWTToken(walletData.address, walletData.walletType));
      localStorage.setItem('wallet-address', walletData.address);
      localStorage.setItem('wallet-type', walletData.walletType);
    }, { walletData: testWalletData });
    
    return testWalletData;
  }
  
  /**
   * Clear all API mocks
   */
  async clearAllMocks(): Promise<void> {
    await this.page.unroute('**');
    this.routes.clear();
  }
  
  /**
   * Simulate network delay
   */
  private async simulateNetworkDelay(delay: number): Promise<void> {
    if (delay > 0) {
      await this.page.waitForTimeout(delay);
    }
  }
  
  /**
   * Determine if failure should be simulated based on failure rate
   */
  private shouldSimulateFailure(failureRate?: number): boolean {
    if (!failureRate || failureRate <= 0) return false;
    return Math.random() < failureRate;
  }
  
  /**
   * Create a mock response with consistent structure
   */
  private createMockResponse(data: any, success = true, message?: string) {
    return {
      success,
      data: success ? data : undefined,
      error: success ? undefined : data,
      message
    };
  }
  
  /**
   * Mock a specific API endpoint with custom behavior
   */
  async mockEndpoint(
    url: string | RegExp, 
    response: any, 
    options: {
      method?: string;
      status?: number;
      delay?: number;
      failureRate?: number;
    } = {}
  ): Promise<void> {
    const { 
      method = 'GET', 
      status = 200, 
      delay = testConfig.mocks.responseDelay,
      failureRate = 0
    } = options;
    
    await this.page.route(url, async (route, request) => {
      if (request.method() !== method) {
        route.continue();
        return;
      }
      
      await this.simulateNetworkDelay(delay);
      
      if (this.shouldSimulateFailure(failureRate)) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(walletDataFactory.createErrorResponse(ErrorType.SERVER_ERROR))
        });
        return;
      }
      
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: typeof response === 'string' ? response : JSON.stringify(response)
      });
    });
  }
}
