/**
 * POST /api/auth/refresh
 * 
 * Refreshes JWT token before expiration
 * Optional endpoint for token refresh without re-authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { cardanoAuthService } from '@/services/cardano-auth-service';
import { logger } from '@/lib/logger';
import { extractBearerToken } from '@/lib/auth/http-utils';

interface RefreshRequest {
  refreshToken?: string; // Optional: could implement refresh tokens
  walletAddress: string; // Required: wallet address for re-validation
}

interface RefreshResponse {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    walletAddress: string;
    walletType?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: RefreshRequest = await request.json();
    const { walletAddress } = body;

    // Validate input
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!walletAddress.match(/^addr1[a-z0-9]{50,}$/)) {
      return NextResponse.json(
        { error: 'Invalid Cardano wallet address format' },
        { status: 400 }
      );
    }

    // Require current token from Authorization header for security
    const authHeader = request.headers.get('authorization');
    const currentToken = extractBearerToken(authHeader);
    
    if (!currentToken) {
      return NextResponse.json(
        { error: 'Authorization header with valid Bearer token required' },
        { status: 401 }
      );
    }

    // Use proper refresh method with current token validation
    const refreshResult = await cardanoAuthService.refreshToken(
      currentToken,
      walletAddress
    );

    if (!refreshResult.success || !refreshResult.data) {
      // Return appropriate error based on failure type
      const statusCode = refreshResult.error?.includes('expired') || refreshResult.error?.includes('invalid') ? 401 : // Unauthorized
                         refreshResult.error?.includes('not found') ? 404 : // Not Found
                         refreshResult.error?.includes('mismatch') ? 403 : // Forbidden
                         500; // Internal Server Error

      return NextResponse.json(
        { error: refreshResult.error || 'Token refresh failed' },
        { status: statusCode }
      );
    }

    const response: RefreshResponse = {
      accessToken: refreshResult.data.token,
      expiresAt: refreshResult.data.expiresAt.toISOString(),
      user: {
        id: refreshResult.data.userId,
        walletAddress: refreshResult.data.walletAddress,
        walletType: refreshResult.data.walletType
      }
    };

    logger.info(`Token refreshed successfully for user ${refreshResult.data.userId}, wallet ${refreshResult.data.walletAddress.slice(0, 12)}..., expires: ${refreshResult.data.expiresAt}`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logger.error('Refresh endpoint error', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed - use POST with walletAddress' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}