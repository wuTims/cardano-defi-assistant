/**
 * Authentication Wrapper for API Routes
 * 
 * Provides a clean, type-safe way to protect API routes with JWT authentication.
 * Uses the custom CardanoAuthService to verify tokens and extract wallet information.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CardanoAuthService } from '@/services/cardano-auth-service';

/**
 * Authentication context passed to protected routes
 * All fields are guaranteed to be present after successful authentication
 */
export interface AuthContext {
  walletAddress: string;
  userId: string;  // Always present after successful auth
  walletType: string;  // Always present after successful auth
}

/**
 * Handler type for authenticated routes
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse>;

/**
 * Main authentication wrapper
 * 
 * Usage:
 * ```typescript
 * export const GET = withAuth(async (request, { walletAddress }) => {
 *   // Your authenticated route logic here
 * });
 * ```
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Extract Authorization header (lowercase per HTTP spec)
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Missing authorization header' },
          { status: 401 }
        );
      }
      
      // Parse Bearer token using destructuring
      const [scheme, token] = authHeader.split(' ');
      
      if (scheme !== 'Bearer' || !token) {
        return NextResponse.json(
          { error: 'Invalid authorization format. Expected: Bearer <token>' },
          { status: 401 }
        );
      }
      
      // Verify token using CardanoAuthService
      const authService = CardanoAuthService.getInstance();
      const authResponse = await authService.verifyToken(token);
      
      if (!authResponse.success || !authResponse.data) {
        return NextResponse.json(
          { error: authResponse.error || 'Invalid or expired token' },
          { status: 401 }
        );
      }
      
      // Build auth context - ensure all required fields are present
      const { walletAddress, userId, walletType } = authResponse.data;
      
      if (!walletAddress || !userId) {
        return NextResponse.json(
          { error: 'Invalid token data: missing required fields' },
          { status: 401 }
        );
      }
      
      const context: AuthContext = {
        walletAddress,
        userId,
        walletType: walletType || 'unknown'  // Default if not provided
      };
      
      // Call the actual route handler with auth context
      return await handler(request, context);
      
    } catch (error) {
      console.error('Authentication error:', error);
      
      // Check for specific JWT errors
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          return NextResponse.json(
            { error: 'Token expired' },
            { status: 401 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}