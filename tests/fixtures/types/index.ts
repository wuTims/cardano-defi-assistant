/**
 * Type definitions and enums for testing
 * Use these instead of hardcoded strings for type safety
 */

/**
 * Error types that can occur in the application
 */
export enum ErrorType {
  WALLET_NOT_FOUND = 'wallet-not-found',
  INVALID_SIGNATURE = 'invalid-signature',
  NETWORK_ERROR = 'network-error',
  SERVER_ERROR = 'server-error',
  VALIDATION_ERROR = 'validation-error'
}

/**
 * Supported wallet types
 */
export enum WalletType {
  NAMI = 'nami',
  ETERNL = 'eternl',
  LACE = 'lace',
  VESPR = 'vespr',
  NUFI = 'nufi',
  TYPHON = 'typhon',
  GEROWALLET = 'gerowallet'
}

/**
 * API endpoints used in the application
 */
export enum ApiEndpoint {
  AUTH_CHALLENGE = '/api/auth/challenge',
  AUTH_VERIFY = '/api/auth/verify',
  WALLET_DATA = '/api/wallet/data',
  WALLET_SYNC = '/api/wallet/sync',
  WALLET_BALANCE = '/api/wallet/balance'
}

/**
 * Test environment types
 */
export enum TestEnvironment {
  LOCAL = 'local',
  CI = 'ci',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

/**
 * Timeout types for different operations
 */
export enum TimeoutType {
  DEFAULT = 'default',
  NAVIGATION = 'navigation',
  API = 'api',
  WALLET_CONNECTION = 'walletConnection',
  WALLET_SYNC = 'walletSync',
  AUTHENTICATION = 'authentication',
  PAGE_LOAD = 'pageLoad'
}

/**
 * Response status for API calls
 */
export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  PENDING = 'pending'
}

/**
 * Wallet connection states
 */
export enum WalletConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

/**
 * Authentication states
 */
export enum AuthState {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  EXPIRED = 'expired',
  ERROR = 'error'
}