/**
 * Test Fixtures Index - Centralized exports for current test utilities
 */

// Page Objects
export { BasePage } from './page-objects/base-page';
export { LandingPage } from './page-objects/landing-page';
export { DashboardPage } from './page-objects/dashboard-page';
export { WalletConnectionModal } from './page-objects/wallet-connection-modal';

// Test Data Factory
export {
  walletDataFactory,
  testScenarios,
  type TestWalletData,
  type TestAsset,
  type TestUtxo,
  WalletType
} from './test-data/wallet-data-factory';

// Type definitions
export {
  ErrorType,
  WalletType as WalletTypeEnum,
  ApiEndpoint,
  TestEnvironment,
  TimeoutType,
  ResponseStatus,
  WalletConnectionState,
  AuthState
} from './types';

// Configuration
export {
  testConfig,
  getEnvironmentConfig,
  getTimeout,
  isCIEnvironment,
  type TestEnvironment as TestEnvType,
  type TimeoutType as TimeoutTypeAlias,
  type ViewportType
} from './config/test-config';

// Core Helpers
export {
  ApiMockHelper,
  type MockApiOptions
} from './helpers/api-mock-helper';

export {
  testContextHelper,
  testFixtures,
  type TestContext
} from './helpers/test-context-helper';

// Error Scenario Helper (Simple, focused)
export {
  ErrorScenarioHelper,
  type ErrorScenario
} from './helpers/error-scenario-helper';

// Legacy exports for backward compatibility
export * from './mockWalletData';
