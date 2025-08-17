/**
 * Server-side address conversion utilities
 * Handles conversion between hex (CIP-30) and Bech32 (database) formats
 */

import { logger } from '@/lib/logger';
import type { HexAddress, Bech32Address } from '@/types/auth';

// Server-side WASM imports for address conversion
let CardanoWasm: any = null;
if (typeof window === 'undefined') {
  try {
    CardanoWasm = require('@emurgo/cardano-serialization-lib-nodejs');
  } catch (error) {
    console.warn('Cardano WASM module not available:', error);
  }
}

/**
 * Validate hex address format and convert to Bech32
 */
export function validateAndConvertHexToBech32(hexAddress: string): {
  success: boolean;
  bech32Address?: Bech32Address;
  error?: string;
} {
  // Validate hex address format (CIP-30 returns hex-encoded CBOR)
  if (!hexAddress.match(/^[0-9a-fA-F]+$/)) {
    return {
      success: false,
      error: 'Invalid hex address format'
    };
  }

  // Convert hex to Bech32 for database operations
  const bech32Address = convertHexToBech32(hexAddress as HexAddress);
  if (!bech32Address) {
    return {
      success: false,
      error: 'Failed to convert hex address to Bech32 format'
    };
  }

  return {
    success: true,
    bech32Address
  };
}

/**
 * Convert hex-encoded CBOR address to Bech32 format
 */
function convertHexToBech32(hexAddress: HexAddress): Bech32Address | null {
  if (!CardanoWasm) {
    logger.error('CardanoWasm not available for address conversion');
    return null;
  }
  
  try {
    const addressBytes = Buffer.from(hexAddress, 'hex');
    const address = CardanoWasm.Address.from_bytes(addressBytes);
    return address.to_bech32() as Bech32Address;
  } catch (error) {
    logger.error({ err: error }, 'Failed to convert hex to Bech32');
    return null;
  }
}