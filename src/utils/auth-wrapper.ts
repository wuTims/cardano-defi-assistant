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
 */
export interface AuthContext {
  walletAddress: string;
  userId?: string;
  walletType?: string;
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
      
      // Build auth context
      const context: AuthContext = {
        walletAddress: authResponse.data.walletAddress,
        userId: authResponse.data.userId,
        walletType: authResponse.data.walletType
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