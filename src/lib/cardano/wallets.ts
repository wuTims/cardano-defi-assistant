/**
 * Cardano Wallet API utilities
 * 
 * Provides type-safe access to browser-based Cardano wallet extensions
 * following the CIP-30 standard. Only includes methods currently used by the application.
 */

/**
 * CIP-30 wallet handle interface
 * Represents the methods available after connecting to a wallet
 */
export interface CardanoWalletHandle {
  getUsedAddresses(): Promise<string[]>;
  signData(address: string, payload: string): Promise<{ signature: string; key: string }>;
}

/**
 * CIP-30 wallet API interface
 * Represents the methods available on a Cardano wallet before connection
 */
export interface CardanoWalletApi {
  enable(): Promise<CardanoWalletHandle>;
}

/**
 * Get Cardano wallet API from window object
 * 
 * Safely accesses the browser's window.cardano object and returns
 * the requested wallet API if available.
 * 
 * @param walletName - Name of the wallet to access (e.g., 'nami', 'eternl')
 * @returns Wallet API if available, undefined otherwise
 */
export function getCardanoWallet(walletName: string): CardanoWalletApi | undefined {
  // Check if running in browser
  if (typeof window === 'undefined') {
    return undefined;
  }
  
  // Access cardano object from window
  const cardano = (window as { cardano?: Record<string, CardanoWalletApi> }).cardano;
  if (!cardano || typeof cardano !== 'object') {
    return undefined;
  }
  
  // Return specific wallet API
  return cardano[walletName];
}