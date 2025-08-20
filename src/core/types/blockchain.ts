/**
 * Cardano Blockchain Constants and Utilities
 * 
 * Contains only essential Cardano constants and utility functions
 * NO hardcoded tokens or protocol patterns - those come from dynamic API fetching
 */

// Essential Cardano constants
export const CARDANO_CONSTANTS = {
  ADA_UNIT: 'lovelace',
  LOVELACE_PER_ADA: 1_000_000n,
  MIN_UTXO_VALUE: 1_000_000n, // 1 ADA minimum
  POLICY_ID_LENGTH: 56,
  ASSET_NAME_MAX_LENGTH: 64,
  EPOCH_0_START: 1506203091, // Unix timestamp for Cardano epoch 0
} as const;

// Common metadata labels (CIP standards)
export const METADATA_LABELS = {
  GENERAL: 674,
  CIP_25: 721, // NFT metadata
  CIP_68: 222, // FT/NFT metadata
  TRANSACTION_MESSAGE: 674
} as const;

// Address and type definitions
export type CardanoAddress = string;
export type StakeAddress = `stake1${string}`;
export type PaymentAddress = `addr1${string}`;
export type TokenFingerprint = `asset1${string}`;

// UTxO reference type
export type UTxORef = {
  readonly txHash: string;
  readonly outputIndex: number;
};

// Script types
export type ScriptType = 'native' | 'plutus_v1' | 'plutus_v2';

export type Script = {
  readonly type: ScriptType;
  readonly hash: string;
  readonly size: number;
};

/**
 * Check if a unit string represents ADA
 */
export function isADA(unit: string): boolean {
  return unit === CARDANO_CONSTANTS.ADA_UNIT;
}

/**
 * Extract policy ID from asset unit
 */
export function getPolicyId(unit: string): string {
  if (isADA(unit)) return '';
  return unit.slice(0, CARDANO_CONSTANTS.POLICY_ID_LENGTH);
}

/**
 * Extract asset name from asset unit
 */
export function getAssetName(unit: string): string {
  if (isADA(unit)) return '';
  return unit.slice(CARDANO_CONSTANTS.POLICY_ID_LENGTH);
}

/**
 * Validate Cardano address format (basic validation)
 */
export function isValidCardanoAddress(address: string): boolean {
  return /^(addr1|stake1)[a-z0-9]{50,}$/.test(address);
}

/**
 * Get address type from Cardano address
 */
export function getAddressType(address: string): 'payment' | 'stake' | 'unknown' {
  if (address.startsWith('addr1')) return 'payment';
  if (address.startsWith('stake1')) return 'stake';
  return 'unknown';
}

/**
 * Convert lovelace to ADA
 */
export function lovelaceToADA(lovelace: bigint): number {
  return Number(lovelace) / Number(CARDANO_CONSTANTS.LOVELACE_PER_ADA);
}

/**
 * Convert ADA to lovelace
 */
export function adaToLovelace(ada: number): bigint {
  return BigInt(Math.floor(ada * Number(CARDANO_CONSTANTS.LOVELACE_PER_ADA)));
}

/**
 * Format asset amount with proper decimals
 */
export function formatAssetAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) {
    return amount.toString();
  }
  
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === 0n) {
    return whole.toString();
  }
  
  const fractional = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractional}`;
}

/**
 * Validate asset unit format
 */
export function isValidAssetUnit(unit: string): boolean {
  if (unit === CARDANO_CONSTANTS.ADA_UNIT) return true;
  
  // Policy ID (56 hex chars) + Asset Name (0-64 hex chars)
  return /^[a-f0-9]{56}[a-f0-9]{0,64}$/.test(unit);
}

