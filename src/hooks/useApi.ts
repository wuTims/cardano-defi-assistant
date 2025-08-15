/**
 * useApi Hook
 * 
 * Provides a consistent API client that automatically includes authentication.
 * Authentication is implicit - any API call through this hook is authenticated.
 * 
 * Benefits:
 * - No need to manually pass tokens
 * - Consistent error handling
 * - Type-safe responses
 * - Follows React patterns
 */

import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
}

/**
 * Custom hook for making authenticated API requests
 * 
 * Usage:
 * ```typescript
 * const { apiRequest, isAuthenticated } = useApi();
 * if (isAuthenticated) {
 *   const data = await apiRequest('/api/transactions');
 * }
 * ```
 */
export function useApi() {
  const { token: authData } = useAuth();
  const token = authData?.token;

  /**
   * Make an authenticated API request
   */
  const apiRequest = useCallback(async <T = any>(
    url: string,
    options?: RequestInit
  ): Promise<T> => {
    // Auth is required for all API calls through this hook
    if (!token) {
      throw new Error('Not authenticated - please connect your wallet');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options?.headers,
        }
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If response isn't JSON, use default error message
        }

        const error = new Error(errorMessage) as ApiError;
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      // Handle empty responses (204 No Content, etc.)
      if (response.status === 204) {
        return null as T;
      }

      return response.json();
    } catch (error) {
      // Re-throw API errors as-is
      if (error instanceof Error) {
        throw error;
      }
      
      // Wrap unknown errors
      throw new Error('An unexpected error occurred');
    }
  }, [token]);

  /**
   * Convenience methods for common HTTP verbs
   */
  const get = useCallback(<T = any>(url: string): Promise<T> => {
    return apiRequest<T>(url, { method: 'GET' });
  }, [apiRequest]);

  const post = useCallback(<T = any>(url: string, body?: any): Promise<T> => {
    return apiRequest<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }, [apiRequest]);

  const put = useCallback(<T = any>(url: string, body?: any): Promise<T> => {
    return apiRequest<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }, [apiRequest]);

  const del = useCallback(<T = any>(url: string): Promise<T> => {
    return apiRequest<T>(url, { method: 'DELETE' });
  }, [apiRequest]);

  return {
    apiRequest,
    get,
    post,
    put,
    delete: del,
    isAuthenticated: !!token,
  };
}

export default useApi;