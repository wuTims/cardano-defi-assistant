/**
 * Authentication Types
 * 
 * Type definitions for authentication flows and JWT handling
 */

export type WalletType = 'nami' | 'eternl' | 'flint' | 'gerowallet' | 'yoroi' | 'ccvault';

export type AuthChallenge = {
  nonce: string;
  challenge: string;
  expiresAt: Date;
  walletAddress: string;
};

export type WalletSignatureArgs = {
  address: string;
  signature: string;
  key: string;
  nonce: string;
};

export type AuthTokenArgs = {
  walletAddress: string;
  walletType: WalletType;
  userId?: string;
};

export type AuthToken = {
  token: string;
  expiresAt: Date;
  walletAddress: string;
  walletType: WalletType;
  userId?: string;
};

export type AuthVerificationResult = {
  isValid: boolean;
  walletAddress?: string;
  error?: string;
};

export type AuthServiceResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};