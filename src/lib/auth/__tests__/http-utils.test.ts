/**
 * HTTP Authentication Utilities Tests
 * 
 * Tests for Bearer token extraction and validation functions
 */

import { extractBearerToken, isValidBearerHeader } from '../http-utils';

describe('HTTP Authentication Utilities', () => {
  describe('extractBearerToken', () => {
    test('should extract token from valid Bearer header', () => {
      const result = extractBearerToken('Bearer eyJhbGciOiJIUzI1NiIs');
      expect(result).toBe('eyJhbGciOiJIUzI1NiIs');
    });

    test('should handle case-insensitive Bearer prefix', () => {
      const result = extractBearerToken('bearer eyJhbGciOiJIUzI1NiIs');
      expect(result).toBe('eyJhbGciOiJIUzI1NiIs');
    });

    test('should handle mixed case Bearer prefix', () => {
      const result = extractBearerToken('BeArEr eyJhbGciOiJIUzI1NiIs');
      expect(result).toBe('eyJhbGciOiJIUzI1NiIs');
    });

    test('should handle whitespace around Bearer header', () => {
      const result = extractBearerToken('  Bearer  eyJhbGciOiJIUzI1NiIs  ');
      expect(result).toBe('eyJhbGciOiJIUzI1NiIs');
    });

    test('should handle whitespace between Bearer and token', () => {
      const result = extractBearerToken('Bearer   eyJhbGciOiJIUzI1NiIs');
      expect(result).toBe('eyJhbGciOiJIUzI1NiIs');
    });

    test('should return null for empty token after Bearer', () => {
      const result = extractBearerToken('Bearer ');
      expect(result).toBeNull();
    });

    test('should return null for Bearer with only whitespace', () => {
      const result = extractBearerToken('Bearer   ');
      expect(result).toBeNull();
    });

    test('should return null for non-Bearer authorization scheme', () => {
      const result = extractBearerToken('Basic dXNlcjpwYXNz');
      expect(result).toBeNull();
    });

    test('should return null for Digest authorization scheme', () => {
      const result = extractBearerToken('Digest username="user", realm="realm"');
      expect(result).toBeNull();
    });

    test('should return null for null header', () => {
      const result = extractBearerToken(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined header', () => {
      const result = extractBearerToken(undefined as any);
      expect(result).toBeNull();
    });

    test('should return null for empty string header', () => {
      const result = extractBearerToken('');
      expect(result).toBeNull();
    });

    test('should return null for whitespace-only header', () => {
      const result = extractBearerToken('   ');
      expect(result).toBeNull();
    });

    test('should return null for header without Bearer prefix', () => {
      const result = extractBearerToken('eyJhbGciOiJIUzI1NiIs');
      expect(result).toBeNull();
    });

    test('should handle real JWT token', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = extractBearerToken(`Bearer ${jwt}`);
      expect(result).toBe(jwt);
    });

    test('should handle token with special characters', () => {
      const token = 'abc123-._~+/=';
      const result = extractBearerToken(`Bearer ${token}`);
      expect(result).toBe(token);
    });
  });

  describe('isValidBearerHeader', () => {
    test('should return true for valid Bearer header', () => {
      const result = isValidBearerHeader('Bearer eyJhbGciOiJIUzI1NiIs');
      expect(result).toBe(true);
    });

    test('should return true for case-insensitive Bearer header', () => {
      const result = isValidBearerHeader('bearer eyJhbGciOiJIUzI1NiIs');
      expect(result).toBe(true);
    });

    test('should return false for empty token', () => {
      const result = isValidBearerHeader('Bearer ');
      expect(result).toBe(false);
    });

    test('should return false for non-Bearer scheme', () => {
      const result = isValidBearerHeader('Basic dXNlcjpwYXNz');
      expect(result).toBe(false);
    });

    test('should return false for null header', () => {
      const result = isValidBearerHeader(null);
      expect(result).toBe(false);
    });

    test('should return false for empty string', () => {
      const result = isValidBearerHeader('');
      expect(result).toBe(false);
    });

    test('should return false for header without Bearer prefix', () => {
      const result = isValidBearerHeader('eyJhbGciOiJIUzI1NiIs');
      expect(result).toBe(false);
    });

    test('should return true for Bearer header with whitespace', () => {
      const result = isValidBearerHeader('  Bearer  token123  ');
      expect(result).toBe(true);
    });
  });
});