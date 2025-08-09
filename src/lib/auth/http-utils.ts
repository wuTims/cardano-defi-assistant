/**
 * Authentication utility functions for handling HTTP headers and tokens
 * 
 * Provides safe, reusable methods for parsing Authorization headers and
 * extracting Bearer tokens with proper validation.
 */

/**
 * Extract Bearer token from Authorization header
 * 
 * Safely parses Authorization header and extracts JWT token with validation.
 * Handles malformed headers, missing tokens, and whitespace issues.
 * 
 * @param authHeader - Authorization header value from HTTP request
 * @returns Extracted token string or null if invalid/missing
 * 
 * @example
 * ```typescript
 * const token = extractBearerToken('Bearer eyJhbGciOiJIUzI1NiIs...');
 * if (token) {
 *   // Use token for authentication
 * }
 * ```
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Remove any leading/trailing whitespace
  const trimmedHeader = authHeader.trim();
  
  // Check if it starts with 'Bearer ' (case-insensitive)
  const bearerPrefix = 'Bearer ';
  if (!trimmedHeader.toLowerCase().startsWith(bearerPrefix.toLowerCase())) {
    return null;
  }

  // Extract token portion after 'Bearer '
  const token = trimmedHeader.slice(bearerPrefix.length).trim();
  
  // Validate token is not empty
  if (!token || token.length === 0) {
    return null;
  }

  return token;
}

/**
 * Validate Authorization header format
 * 
 * Checks if Authorization header follows proper Bearer token format
 * without extracting the actual token value.
 * 
 * @param authHeader - Authorization header value to validate
 * @returns True if header has valid Bearer format
 */
export function isValidBearerHeader(authHeader: string | null): boolean {
  return extractBearerToken(authHeader) !== null;
}