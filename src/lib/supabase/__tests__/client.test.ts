/**
 * Supabase Client Tests
 * 
 * Tests for client-side Supabase client creation with JWT token support
 */

// Mock Supabase before importing
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

import { createSupabaseClient } from '../client';
import { createClient } from '@supabase/supabase-js';

// Get the mocked function
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Supabase Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSupabaseClient', () => {
    test('should create client without access token', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);
      
      const result = createSupabaseClient();
      
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String), // URL from environment
        expect.any(String), // Key from environment
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );
      expect(result).toBe(mockClient);
    });

    test('should create client with access token', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);
      const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      
      const result = createSupabaseClient(accessToken);
      
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String), // URL from environment
        expect.any(String), // Key from environment
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          },
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      );
      expect(result).toBe(mockClient);
    });

    test('should create client with empty string access token', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);
      
      const result = createSupabaseClient('');
      
      // Empty string is falsy, so should not include global headers
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );
      expect(result).toBe(mockClient);
    });

    test('should create client with undefined access token explicitly', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);
      
      const result = createSupabaseClient(undefined);
      
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );
      expect(result).toBe(mockClient);
    });

    test('should handle multiple client creations with different tokens', () => {
      const mockClient1 = { from: jest.fn(), id: 'client1' } as any;
      const mockClient2 = { from: jest.fn(), id: 'client2' } as any;
      
      mockCreateClient
        .mockReturnValueOnce(mockClient1)
        .mockReturnValueOnce(mockClient2);
      
      const token1 = 'token123';
      const token2 = 'token456';
      
      const result1 = createSupabaseClient(token1);
      const result2 = createSupabaseClient(token2);
      
      expect(result1).toBe(mockClient1);
      expect(result2).toBe(mockClient2);
      expect(mockCreateClient).toHaveBeenCalledTimes(2);
      
      // Verify tokens are included correctly
      const firstCallArgs = mockCreateClient.mock.calls[0];
      const secondCallArgs = mockCreateClient.mock.calls[1];
      
      expect(firstCallArgs[2]).toMatchObject({
        global: {
          headers: {
            Authorization: `Bearer ${token1}`
          }
        }
      });
      
      expect(secondCallArgs[2]).toMatchObject({
        global: {
          headers: {
            Authorization: `Bearer ${token2}`
          }
        }
      });
    });

    test('should preserve auth configuration options', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);
      
      createSupabaseClient();
      
      const calledOptions = mockCreateClient.mock.calls[0]?.[2];
      
      expect(calledOptions).toMatchObject({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    });

    test('should handle special characters in access token', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);
      const accessToken = 'token.with-special_chars+/=';
      
      const result = createSupabaseClient(accessToken);
      
      const calledOptions = mockCreateClient.mock.calls[0]?.[2];
      expect(calledOptions).toMatchObject({
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      });
      expect(result).toBe(mockClient);
    });

    test('should return the client returned by createClient', () => {
      const mockClientMethods = {
        from: jest.fn(),
        auth: jest.fn(),
        storage: jest.fn(),
        functions: jest.fn()
      } as any;
      mockCreateClient.mockReturnValue(mockClientMethods);
      
      const result = createSupabaseClient();
      
      expect(result).toBe(mockClientMethods);
      expect(result.from).toBe(mockClientMethods.from);
      expect(result.auth).toBe(mockClientMethods.auth);
    });

    test('should handle null access token', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);
      
      const result = createSupabaseClient(null as any);
      
      // null is falsy, so should not include global headers
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );
      expect(result).toBe(mockClient);
    });

    test('should include authorization header only when token is truthy', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);

      // Test truthy token
      createSupabaseClient('valid-token');
      let calledOptions = mockCreateClient.mock.calls[0]?.[2];
      expect(calledOptions).toHaveProperty('global');
      
      mockCreateClient.mockClear();

      // Test falsy token
      createSupabaseClient('');
      calledOptions = mockCreateClient.mock.calls[0]?.[2];
      expect(calledOptions).not.toHaveProperty('global');
    });

    test('should always include auth configuration', () => {
      const mockClient = { from: jest.fn() } as any;
      mockCreateClient.mockReturnValue(mockClient);

      // Test with token
      createSupabaseClient('token123');
      let calledOptions = mockCreateClient.mock.calls[0]?.[2];
      expect(calledOptions?.auth).toEqual({
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      });

      mockCreateClient.mockClear();

      // Test without token
      createSupabaseClient();
      calledOptions = mockCreateClient.mock.calls[0]?.[2];
      expect(calledOptions?.auth).toEqual({
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      });
    });
  });
});