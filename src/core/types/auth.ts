/**
 * Authentication Types
 * 
 * Type definitions for authentication flows and JWT handling
 */

// Wallet connection state enum
export enum WalletConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

// Wallet type enum (replacing union string)
export enum WalletType {
  NAMI = 'nami',
  ETERNL = 'eternl',
  FLINT = 'flint',
  LACE = 'lace',
  GEROWALLET = 'gerowallet',
  YOROI = 'yoroi',
  CCVAULT = 'ccvault',
  VESPR = 'vespr',
  NUFI = 'nufi',
  TYPHON = 'typhon'
}

export type AuthChallenge = {
  nonce: string;
  challenge: string;
  expiresAt: Date;
  walletAddress: string;
};

export type WalletSignatureArgs = {
  hexAddress: string;          // Hex string for cryptographic verification
  coseSignature: string;       // The actual signature bytes  
  publicKey: string;           // Public key from signature
  nonce: string;
};

export type AuthTokenArgs = {
  walletAddress: string;
  walletType: WalletType;
  userId?: string;
};

// User type for auth context
export type AuthUser = {
  id: string;
  walletAddress: string;
  walletType: WalletType;
};

// Generic JWT payload structure (tech-agnostic)
export interface JWTPayload {
  sub: string;  // Subject (user ID)
  iat: number;  // Issued at timestamp
  exp: number;  // Expiration timestamp
}

// Generic auth token response (tech-agnostic)
export interface AuthTokenResponse {
  token: string;
  expiresAt: Date;
  user: AuthUser;
}

// Address type markers for type safety and clarity
export type HexAddress = string & { readonly __brand: 'hex' };
export type Bech32Address = string & { readonly __brand: 'bech32' };

// Auth API request/response types with explicit address formats
export type NonceRequest = {
  walletAddress: string; // Hex string from CIP-30 wallet
};

export type NonceResponse = {
  nonce: string;
  challenge: string;
  expiresAt: string; // ISO string
};

export type VerifyRequest = {
  walletAddress: string; // Hex string from CIP-30 wallet
  walletType: WalletType;
  nonce: string;
  signatureData: {
    coseSignature: string; // The actual COSE signature bytes
    publicKey: string;     // Public key from the signature
  };
};

// CIP-30 signature result type
export type CIP30SignatureResult = {
  signature: string;
  key: string;
};

export type VerifyResponse = {
  accessToken: string;
  expiresAt: string; // ISO string
  user: {
    id: string;
    walletAddress: string;
    walletType: WalletType;
  };
};

// Token refresh request/response types
export type RefreshRequest = {
  walletAddress: string;
};

export type RefreshResponse = VerifyResponse; // Same structure as verify

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