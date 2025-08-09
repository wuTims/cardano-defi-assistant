/**
 * Cardano Wallet Utilities Tests
 * 
 * Tests for browser wallet detection and CIP-30 interface functions
 */

import { getCardanoWallet, CardanoWalletApi } from '../wallets';

// Mock window object for testing
const mockWindow = (cardanoObject?: any) => {
  const originalWindow = global.window;
  
  if (cardanoObject === undefined) {
    // No window (server-side)
    delete (global as any).window;
  } else {
    // Browser environment with mocked cardano object
    (global as any).window = {
      cardano: cardanoObject
    };
  }
  
  return () => {
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      delete (global as any).window;
    }
  };
};

describe('Cardano Wallet Utilities', () => {
  describe('getCardanoWallet', () => {
    test('should return undefined on server-side (no window)', () => {
      const restore = mockWindow(); // No window object
      
      const result = getCardanoWallet('nami');
      expect(result).toBeUndefined();
      
      restore();
    });

    test('should return undefined when cardano object is missing', () => {
      const restore = mockWindow(undefined);
      
      const result = getCardanoWallet('nami');
      expect(result).toBeUndefined();
      
      restore();
    });

    test('should return undefined when cardano is not an object', () => {
      const restore = mockWindow('not-an-object');
      
      const result = getCardanoWallet('nami');
      expect(result).toBeUndefined();
      
      restore();
    });

    test('should return undefined when cardano is null', () => {
      const restore = mockWindow(null);
      
      const result = getCardanoWallet('nami');
      expect(result).toBeUndefined();
      
      restore();
    });

    test('should return undefined when requested wallet is not available', () => {
      const mockCardano = {
        eternl: { enable: jest.fn() },
        lace: { enable: jest.fn() }
      };
      const restore = mockWindow(mockCardano);
      
      const result = getCardanoWallet('nami');
      expect(result).toBeUndefined();
      
      restore();
    });

    test('should return wallet API when wallet is available', () => {
      const mockNami = { enable: jest.fn() };
      const mockCardano = {
        nami: mockNami,
        eternl: { enable: jest.fn() }
      };
      const restore = mockWindow(mockCardano);
      
      const result = getCardanoWallet('nami');
      expect(result).toBe(mockNami);
      
      restore();
    });

    test('should return correct wallet API for different wallets', () => {
      const mockNami = { enable: jest.fn() };
      const mockEternl = { enable: jest.fn() };
      const mockLace = { enable: jest.fn() };
      
      const mockCardano = {
        nami: mockNami,
        eternl: mockEternl,
        lace: mockLace
      };
      const restore = mockWindow(mockCardano);
      
      expect(getCardanoWallet('nami')).toBe(mockNami);
      expect(getCardanoWallet('eternl')).toBe(mockEternl);
      expect(getCardanoWallet('lace')).toBe(mockLace);
      
      restore();
    });

    test('should handle wallet names with special characters', () => {
      const mockWallet = { enable: jest.fn() };
      const mockCardano = {
        'wallet-with-dashes': mockWallet,
        'wallet_with_underscores': mockWallet,
        'walletWithCamelCase': mockWallet
      };
      const restore = mockWindow(mockCardano);
      
      expect(getCardanoWallet('wallet-with-dashes')).toBe(mockWallet);
      expect(getCardanoWallet('wallet_with_underscores')).toBe(mockWallet);
      expect(getCardanoWallet('walletWithCamelCase')).toBe(mockWallet);
      
      restore();
    });

    test('should handle empty wallet name', () => {
      const mockCardano = {
        nami: { enable: jest.fn() }
      };
      const restore = mockWindow(mockCardano);
      
      const result = getCardanoWallet('');
      expect(result).toBeUndefined();
      
      restore();
    });

    test('should handle cardano object with non-function properties', () => {
      const mockCardano = {
        nami: { enable: jest.fn() },
        someProperty: 'not-a-wallet',
        anotherProperty: 123,
        objectProperty: { notAWallet: true }
      };
      const restore = mockWindow(mockCardano);
      
      expect(getCardanoWallet('nami')).toBe(mockCardano.nami);
      expect(getCardanoWallet('someProperty')).toBe('not-a-wallet');
      expect(getCardanoWallet('anotherProperty')).toBe(123);
      expect(getCardanoWallet('objectProperty')).toBe(mockCardano.objectProperty);
      
      restore();
    });

    test('should maintain type safety with CardanoWalletApi interface', () => {
      const mockWallet: CardanoWalletApi = {
        enable: jest.fn().mockResolvedValue({
          getUsedAddresses: jest.fn(),
          signData: jest.fn()
        })
      };
      
      const mockCardano = { nami: mockWallet };
      const restore = mockWindow(mockCardano);
      
      const result = getCardanoWallet('nami');
      expect(result).toBe(mockWallet);
      expect(result?.enable).toBeDefined();
      expect(typeof result?.enable).toBe('function');
      
      restore();
    });

    test('should handle multiple simultaneous wallet checks', () => {
      const mockNami = { enable: jest.fn() };
      const mockEternl = { enable: jest.fn() };
      
      const mockCardano = {
        nami: mockNami,
        eternl: mockEternl
      };
      const restore = mockWindow(mockCardano);
      
      // Check multiple wallets simultaneously
      const results = [
        getCardanoWallet('nami'),
        getCardanoWallet('eternl'),
        getCardanoWallet('nonexistent'),
        getCardanoWallet('nami') // Check same wallet again
      ];
      
      expect(results[0]).toBe(mockNami);
      expect(results[1]).toBe(mockEternl);
      expect(results[2]).toBeUndefined();
      expect(results[3]).toBe(mockNami);
      
      restore();
    });
  });
});