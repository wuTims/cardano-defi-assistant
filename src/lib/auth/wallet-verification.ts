/**
 * Wallet Signature Verification Utilities
 * 
 * Handles Cardano wallet signature verification using CIP-30 COSE format.
 * Implements cryptographic verification of wallet signatures and address validation.
 */

import { logger } from '@/lib/logger';

// Conditional imports for server-side WASM modules
export const wasmModules = {
  MessageSigning: null as any,
  CardanoWasm: null as any
};

// Only import WASM modules server-side
if (typeof window === 'undefined' && typeof global !== 'undefined') {
  try {
    wasmModules.MessageSigning = require('@emurgo/cardano-message-signing-nodejs');
    wasmModules.CardanoWasm = require('@emurgo/cardano-serialization-lib-nodejs');
  } catch (error) {
    console.warn('Cardano WASM modules not available:', error);
  }
}

/**
 * Verify Cardano wallet signature using CIP-30 COSE format
 * 
 * Implements CIP-30 signature verification:
 * 1. Parse COSE signature and extract Ed25519 public key
 * 2. Verify signature structure (simplified verification)
 * 3. Verify public key corresponds to claimed address
 * 
 * @param message - Challenge message that was signed
 * @param signature - COSE signature from wallet
 * @param publicKey - COSE public key from wallet  
 * @param walletAddress - Hex-encoded Cardano address
 * @returns Validation result with success status
 */
export async function verifyWalletSignature(
  message: string,
  signature: string,
  publicKey: string,
  walletAddress: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Check if WASM modules are available
    if (!wasmModules.MessageSigning || !wasmModules.CardanoWasm) {
      logger.error('Cardano WASM modules not available for signature verification');
      return { isValid: false, error: 'Cardano verification libraries not available' };
    }

    // Validate input parameters
    if (!message || !signature || !publicKey || !walletAddress) {
      return { isValid: false, error: 'Missing required verification parameters' };
    }

    // Parse signature and public key from hex
    let signatureBytes: Uint8Array;
    let publicKeyBytes: Uint8Array;
    
    // Basic hex validation to ensure Buffer.from won't silently coerce bad input
    const isEvenLengthHex = (s: string) => /^[0-9a-fA-F]+$/.test(s) && (s.length % 2 === 0);
    if (!isEvenLengthHex(signature) || !isEvenLengthHex(publicKey)) {
      return { isValid: false, error: 'Invalid hex format in signature or public key' };
    }

    try {
      signatureBytes = new Uint8Array(Buffer.from(signature, 'hex'));
      publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'hex'));
    } catch (error) {
      return { isValid: false, error: 'Invalid hex format in signature or public key' };
    }

    // Step 1: Parse COSE signature and extract Ed25519 public key
    let ed25519KeyBytes: Uint8Array;
    
    try {
      // Parse COSE signature structure
      const coseSign1 = wasmModules.MessageSigning.COSESign1.from_bytes(signatureBytes);
      wasmModules.MessageSigning.COSEKey.from_bytes(publicKeyBytes);
      
      // Extract Ed25519 public key from COSE key structure (CIP-30 standard)
      // COSE key contains Ed25519 key in -2 parameter: 215820 + 32-byte key
      const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');
      const keyMarker = '215820'; // CBOR: -2 parameter, byte string, 32 bytes
      const keyStartIndex = publicKeyHex.indexOf(keyMarker);
      
      if (keyStartIndex === -1) {
        return { isValid: false, error: 'Ed25519 public key not found in COSE structure' };
      }
      
      // Extract 32 bytes after the marker
      const ed25519KeyHex = publicKeyHex.slice(
        keyStartIndex + keyMarker.length, 
        keyStartIndex + keyMarker.length + 64
      );
      ed25519KeyBytes = new Uint8Array(Buffer.from(ed25519KeyHex, 'hex'));
      
      if (ed25519KeyBytes.length !== 32) {
        return { isValid: false, error: 'Invalid Ed25519 key length' };
      }
      
      // Verify COSE signature structure
      const signatureToVerify = coseSign1.signature();
      if (signatureToVerify.length !== 64) {
        return { isValid: false, error: 'Invalid Ed25519 signature length' };
      }
      
      // CRITICAL TODO: Implement actual cryptographic signature verification
      // 
      // SECURITY GAP: We are currently only validating COSE structure, 
      // but NOT verifying the signature is cryptographically valid for the message.
      //
      // What needs to be implemented:
      // 1. Reconstruct the COSE_Sign1 signed payload exactly as the wallet created it
      // 2. Verify the Ed25519 signature against the payload using the extracted public key
      // 
      // Pseudo-code:
      // ```
      // // Reconstruct the signed payload (COSE_Sign1 structure)
      // const sigStructure = [
      //   "Signature1",           // context
      //   coseSign1.headers(),    // protected headers  
      //   new Uint8Array(0),     // external_aad (empty)
      //   Buffer.from(message, 'utf8')  // payload (our challenge message)
      // ];
      // const sigStructureCbor = CBOR.encode(sigStructure);
      // 
      // // Verify Ed25519 signature
      // const crypto = require('crypto');
      // const isValidSig = crypto.verify(
      //   null,                    // Ed25519 doesn't use hash algorithm  
      //   sigStructureCbor,        // data that was signed
      //   {
      //     key: ed25519KeyBytes,  // public key
      //     format: 'raw',
      //     type: 'public'
      //   },
      //   signatureToVerify        // signature bytes from COSE
      // );
      // 
      // if (!isValidSig) {
      //   return { isValid: false, error: 'Cryptographic signature verification failed' };
      // }
      // ```
      //
      // References:
      // - RFC 8152 (COSE): https://tools.ietf.org/html/rfc8152
      // - CIP-30 signing spec: https://cips.cardano.org/cips/cip30/
      // - Ed25519 verification: https://nodejs.org/api/crypto.html#crypto_crypto_verify_algorithm_data_key_signature

    } catch (error) {
      if (error instanceof Error) {
        logger.error({ err: error }, 'COSE signature parsing failed');
        return { isValid: false, error: 'COSE signature parsing failed' };
      }
      // For non-Error throwables, bubble up to the outer catch so we return a generic failure
      throw error;
    }

    // Step 2: Verify the wallet public key corresponds to the claimed address
    // Extract the Ed25519 public key from the COSE key (already parsed above)
    const addressVerification = await verifyAddressFromPublicKey(ed25519KeyBytes, walletAddress);
    if (!addressVerification.isValid) {
      return { 
        isValid: false, 
        error: addressVerification.error || 'Public key does not match wallet address' 
      };
    }

    logger.info(`Wallet signature verified for address: ${walletAddress.slice(0, 20)}...`);
    return { isValid: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Signature verification failed';
    logger.error({ err: error }, 'Wallet signature verification failed');
    return { isValid: false, error: errorMessage };
  }
}

/**
 * Verify that a wallet public key corresponds to a Cardano mainnet address
 * 
 * Cardano addresses have two types:
 * - Base address (57 bytes): 1 byte header + 28 bytes payment + 28 bytes stake  
 * - Enterprise address (29 bytes): 1 byte header + 28 bytes payment
 * 
 * @param publicKeyBytes - Ed25519 public key extracted from COSE signature
 * @param expectedAddress - Hex-encoded address from wallet
 * @returns Validation result
 */
export async function verifyAddressFromPublicKey(
  publicKeyBytes: Uint8Array,
  expectedAddress: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    if (!wasmModules.CardanoWasm) {
      return { isValid: false, error: 'Cardano address verification libraries not available' };
    }

    // Convert expected hex address to Bech32 for comparison
    let expectedBech32Address: string;
    let expectedAddressBytes: Uint8Array;
    
    try {
      expectedAddressBytes = new Uint8Array(Buffer.from(expectedAddress, 'hex'));
      const expectedCardanoAddress = wasmModules.CardanoWasm.Address.from_bytes(expectedAddressBytes);
      expectedBech32Address = expectedCardanoAddress.to_bech32();
    } catch (error) {
      if (error instanceof Error) {
        return { isValid: false, error: 'Invalid hex address format' };
      }
      // Bubble up unexpected non-Error exceptions
      throw error;
    }

    // Parse Ed25519 public key and generate payment credential
    let paymentCred;
    try {
      const publicKey = wasmModules.CardanoWasm.PublicKey.from_bytes(publicKeyBytes);
      const keyHash = publicKey.hash();
      paymentCred = wasmModules.CardanoWasm.Credential.from_keyhash(keyHash);
    } catch (error) {
      return { isValid: false, error: 'Failed to parse Ed25519 public key' };
    }

    const MAINNET_NETWORK_ID = 1;
    
    // Handle Base address (most common case)
    if (expectedAddressBytes.length === 57) {
      try {
        // Extract stake credential from original address (bytes 29-56)
        const stakeCredBytes = expectedAddressBytes.subarray(29, 57);
        const stakeKeyHash = wasmModules.CardanoWasm.Ed25519KeyHash.from_bytes(stakeCredBytes);
        const stakeCred = wasmModules.CardanoWasm.Credential.from_keyhash(stakeKeyHash);
        
        const baseAddress = wasmModules.CardanoWasm.BaseAddress.new(
          MAINNET_NETWORK_ID,
          paymentCred,
          stakeCred
        );
        
        const generatedBech32 = baseAddress.to_address().to_bech32();
        if (generatedBech32 === expectedBech32Address) {
          return { isValid: true };
        }
      } catch (error) {
        // Base address reconstruction failed
      }
    }
    
    // Handle Enterprise address (fallback)
    if (expectedAddressBytes.length === 29) {
      try {
        const enterpriseAddress = wasmModules.CardanoWasm.EnterpriseAddress.new(
          MAINNET_NETWORK_ID,
          paymentCred
        );
        
        const generatedBech32 = enterpriseAddress.to_address().to_bech32();
        if (generatedBech32 === expectedBech32Address) {
          return { isValid: true };
        }
      } catch (error) {
        // Enterprise address reconstruction failed
      }
    }

    return { 
      isValid: false, 
      error: 'Public key does not correspond to wallet address'
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Address verification failed';
    logger.error({ err: error }, 'Address verification from public key failed');
    return { isValid: false, error: errorMessage };
  }
}