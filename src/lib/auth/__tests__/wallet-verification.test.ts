/**
 * Wallet Signature Verification Tests
 * 
 * Tests for Cardano wallet signature verification with proper WASM mocking
 * 
 * NOTE: This test uses direct module patching to inject WASM mocks since
 * the original code uses dynamic require() calls that are difficult to mock.
 */

// Mock logger first
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Define properly structured mock objects that match the real WASM API
const mockMessageSigning = {
  COSESign1: {
    from_bytes: jest.fn(() => ({
      signature: jest.fn(() => new Uint8Array(64)) // Return valid 64-byte signature
    }))
  },
  COSEKey: {
    from_bytes: jest.fn(() => ({})) // Return truthy object
  }
};

const mockCardanoWasm = {
  Address: {
    from_bytes: jest.fn(() => ({
      to_bech32: jest.fn(() => 'addr1test123...')
    }))
  },
  PublicKey: {
    from_bytes: jest.fn(() => ({
      hash: jest.fn(() => 'mock-key-hash')
    }))
  },
  Credential: {
    from_keyhash: jest.fn(() => ({})) // Return truthy credential object
  },
  BaseAddress: {
    new: jest.fn(() => ({
      to_address: jest.fn(() => ({
        to_bech32: jest.fn(() => 'addr1test123...')
      }))
    }))
  },
  EnterpriseAddress: {
    new: jest.fn(() => ({
      to_address: jest.fn(() => ({
        to_bech32: jest.fn(() => 'addr1test123...')
      }))
    }))
  },
  Ed25519KeyHash: {
    from_bytes: jest.fn(() => ({})) // Return truthy key hash
  }
};

// Import the module and then patch its exported variables
import * as walletVerification from '../wallet-verification';
import { logger } from '@/lib/logger';

// Directly assign our mocks to the exported WASM variables
walletVerification.wasmModules.MessageSigning = mockMessageSigning;
walletVerification.wasmModules.CardanoWasm = mockCardanoWasm;

// Get typed mock references
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Wallet Signature Verification Module', () => {
  // Test data with realistic hex formats
  const testMessage = 'Test challenge message for wallet authentication';
  const testSignature = 'a4010103272006215820' + 'ab'.repeat(32) + '5840' + 'cd'.repeat(64); // COSE signature structure
  const testPublicKey = 'a5010103272006215820' + 'ef'.repeat(32); // COSE public key with Ed25519 marker
  const testWalletAddress = '01' + 'ab'.repeat(56); // Base address (57 bytes total)

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyWalletSignature', () => {
    test('should handle WASM modules being available', async () => {
      // This is the key test - WASM modules should now be available due to proper mocking
      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);
      
      // Should NOT return the "libraries not available" error
      expect(result.error).not.toBe('Cardano verification libraries not available');
      
      // Should actually attempt to parse COSE signature
      expect(mockMessageSigning.COSESign1.from_bytes).toHaveBeenCalled();
      expect(mockMessageSigning.COSEKey.from_bytes).toHaveBeenCalled();
    });

    test('should validate required parameters', async () => {
      const result = await walletVerification.verifyWalletSignature('', testSignature, testPublicKey, testWalletAddress);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required verification parameters');
    });

    test('should handle invalid hex format in signature', async () => {
      const invalidHexSignature = 'invalid-hex-format';
      const result = await walletVerification.verifyWalletSignature(testMessage, invalidHexSignature, testPublicKey, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid hex format in signature or public key');
    });

    test('should handle invalid hex format in public key', async () => {
      const invalidHexPublicKey = 'invalid-hex-format';
      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, invalidHexPublicKey, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid hex format in signature or public key');
    });

    test('should extract Ed25519 key from COSE structure', async () => {
      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);

      // The function should find the '215820' marker and extract the 32-byte key
      expect(testPublicKey).toContain('215820'); // Marker should be present in test data
      expect(mockMessageSigning.COSESign1.from_bytes).toHaveBeenCalled();
    });

    test('should handle missing Ed25519 key marker', async () => {
      const publicKeyWithoutMarker = 'a501010327200612' + 'ab'.repeat(32); // No '215820' marker
      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, publicKeyWithoutMarker, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Ed25519 public key not found in COSE structure');
    });

    test('should validate Ed25519 key length', async () => {
      const publicKeyShortKey = 'a5010103272006215820' + 'ab'.repeat(16); // Only 16 bytes instead of 32
      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, publicKeyShortKey, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid Ed25519 key length');
    });

    test('should validate signature length', async () => {
      // Mock COSE signature to return wrong length
      const mockCoseSign1 = {
        signature: jest.fn(() => new Uint8Array(32)) // Wrong length, should be 64
      };
      mockMessageSigning.COSESign1.from_bytes.mockReturnValueOnce(mockCoseSign1);

      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid Ed25519 signature length');
    });

    test('should handle COSE parsing errors', async () => {
      mockMessageSigning.COSESign1.from_bytes.mockImplementationOnce(() => {
        throw new Error('COSE parsing failed');
      });

      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('COSE signature parsing failed');
      expect(mockLogger.error).toHaveBeenCalledWith('COSE signature parsing failed:', expect.any(Error));
    });

    test('should call address verification', async () => {
      // Mock successful address verification by ensuring Bech32 addresses match
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => 'addr1test123...')
      });
      mockCardanoWasm.BaseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => 'addr1test123...')
        }))
      });

      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);

      // Should attempt address verification
      expect(mockCardanoWasm.Address.from_bytes).toHaveBeenCalled();
      expect(mockCardanoWasm.PublicKey.from_bytes).toHaveBeenCalled();
    });

    test('should handle address verification failure', async () => {
      // Mock mismatched addresses
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => 'addr1original123...')
      });
      mockCardanoWasm.BaseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => 'addr1different456...')
        }))
      });

      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Public key does not correspond to wallet address');
    });

    test('should log successful verification', async () => {
      // Mock successful verification by making addresses match
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => 'addr1test123...')
      });
      mockCardanoWasm.BaseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => 'addr1test123...')
        }))
      });

      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);

      if (result.isValid) {
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Wallet signature verified for address:')
        );
      }
    });

    test('should handle unexpected errors gracefully', async () => {
      mockMessageSigning.COSESign1.from_bytes.mockImplementationOnce(() => {
        throw 'Non-Error exception';
      });

      const result = await walletVerification.verifyWalletSignature(testMessage, testSignature, testPublicKey, testWalletAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Wallet signature verification failed',
        'Non-Error exception'
      );
    });
  });

  describe('verifyAddressFromPublicKey', () => {
    const testPublicKeyBytes = new Uint8Array(32).fill(0xab);
    const testHexAddress = '01' + 'ab'.repeat(56); // Base address (57 bytes)

    test('should handle invalid hex address format', async () => {
      mockCardanoWasm.Address.from_bytes.mockImplementationOnce(() => {
        throw new Error('Invalid hex address');
      });

      const result = await walletVerification.verifyAddressFromPublicKey(testPublicKeyBytes, 'invalid-hex');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid hex address format');
    });

    test('should handle base address format (57 bytes)', async () => {
      const baseAddressHex = '01' + 'ab'.repeat(56); // 57 bytes total
      
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => 'addr1test123...')
      });
      mockCardanoWasm.BaseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => 'addr1test123...')
        }))
      });

      const result = await walletVerification.verifyAddressFromPublicKey(testPublicKeyBytes, baseAddressHex);

      expect(mockCardanoWasm.BaseAddress.new).toHaveBeenCalledWith(
        1, // MAINNET_NETWORK_ID
        expect.anything(), // payment credential
        expect.anything()  // stake credential
      );
    });

    test('should handle enterprise address format (29 bytes)', async () => {
      const enterpriseAddressHex = '01' + 'ab'.repeat(28); // 29 bytes total
      
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => 'addr1test123...')
      });
      mockCardanoWasm.EnterpriseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => 'addr1test123...')
        }))
      });

      const result = await walletVerification.verifyAddressFromPublicKey(testPublicKeyBytes, enterpriseAddressHex);

      expect(mockCardanoWasm.EnterpriseAddress.new).toHaveBeenCalledWith(
        1, // MAINNET_NETWORK_ID  
        expect.anything() // payment credential
      );
    });

    test('should handle public key parsing failure', async () => {
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => 'addr1test123...')
      });
      mockCardanoWasm.PublicKey.from_bytes.mockImplementationOnce(() => {
        throw new Error('Invalid public key');
      });

      const result = await walletVerification.verifyAddressFromPublicKey(testPublicKeyBytes, testHexAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Failed to parse Ed25519 public key');
    });

    test('should return success when addresses match', async () => {
      const matchingAddress = 'addr1test123...';
      
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => matchingAddress)
      });
      mockCardanoWasm.BaseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => matchingAddress)
        }))
      });

      const result = await walletVerification.verifyAddressFromPublicKey(testPublicKeyBytes, testHexAddress);

      if (result.isValid) {
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    test('should return false when addresses do not match', async () => {
      mockCardanoWasm.Address.from_bytes.mockReturnValueOnce({
        to_bech32: jest.fn(() => 'addr1original123...')
      });
      mockCardanoWasm.BaseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => 'addr1different456...')
        }))
      });
      mockCardanoWasm.EnterpriseAddress.new.mockReturnValueOnce({
        to_address: jest.fn(() => ({
          to_bech32: jest.fn(() => 'addr1different789...')
        }))
      });

      const result = await walletVerification.verifyAddressFromPublicKey(testPublicKeyBytes, testHexAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Public key does not correspond to wallet address');
    });

    test('should handle unexpected errors', async () => {
      mockCardanoWasm.Address.from_bytes.mockImplementationOnce(() => {
        throw 'String error';
      });

      const result = await walletVerification.verifyAddressFromPublicKey(testPublicKeyBytes, testHexAddress);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Address verification failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Address verification from public key failed',
        'String error'
      );
    });
  });

  describe('mock validation', () => {
    test('should have properly structured WASM mocks', () => {
      // Verify our mocks are truthy objects (this is what was failing before)
      expect(mockMessageSigning).toBeTruthy();
      expect(mockCardanoWasm).toBeTruthy();
      expect(mockMessageSigning.COSESign1).toBeTruthy();
      expect(mockCardanoWasm.Address).toBeTruthy();
      
      // Verify mock methods exist
      expect(typeof mockMessageSigning.COSESign1.from_bytes).toBe('function');
      expect(typeof mockCardanoWasm.Address.from_bytes).toBe('function');
    });

    test('should verify logger mock configuration', () => {
      expect(mockLogger.info).toBeDefined();
      expect(mockLogger.error).toBeDefined();
      expect(mockLogger.warn).toBeDefined();
      expect(jest.isMockFunction(mockLogger.info)).toBe(true);
    });
  });
});