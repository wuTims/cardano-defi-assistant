/**
 * POST /api/auth/verify
 * 
 * Verifies wallet signature and returns Supabase-compatible JWT
 * Replaces verifySignatureAction server action
 */

import { NextRequest, NextResponse } from 'next/server';
import { cardanoAuthService } from '@/services/cardano-auth-service';
import { logger } from '@/lib/logger';
import { validateAndConvertHexToBech32 } from '@/lib/cardano/addresses';
import { WalletType } from '@/types/auth';
import type { VerifyRequest, VerifyResponse } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: VerifyRequest = await request.json();
    const { walletAddress: hexAddress, walletType, nonce, signatureData } = body;

    // Validate required fields
    if (!hexAddress || !walletType || !nonce || !signatureData) {
      return NextResponse.json(
        { error: 'walletAddress, walletType, nonce, and signatureData are required' },
        { status: 400 }
      );
    }

    // Validate signature structure
    if (!signatureData.coseSignature || !signatureData.publicKey) {
      return NextResponse.json(
        { error: 'signatureData must contain coseSignature and publicKey fields' },
        { status: 400 }
      );
    }

    // Validate and convert hex address to Bech32
    const conversionResult = validateAndConvertHexToBech32(hexAddress);
    if (!conversionResult.success || !conversionResult.bech32Address) {
      return NextResponse.json(
        { error: conversionResult.error || 'Address conversion failed' },
        { status: 400 }
      );
    }
    
    const bech32Address = conversionResult.bech32Address;

    // Validate wallet type is a valid enum value
    const validWalletTypes = Object.values(WalletType);
    if (!validWalletTypes.includes(walletType)) {
      return NextResponse.json(
        { error: `Invalid wallet type. Must be one of: ${validWalletTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Prepare signature data for verification using new structure
    const walletSignatureArgs = {
      hexAddress: hexAddress,
      coseSignature: signatureData.coseSignature,
      publicKey: signatureData.publicKey,
      nonce: nonce
    };

    // Verify signature and generate JWT using Supabase auth service
    const result = await cardanoAuthService.verifySignatureAndGenerateToken(
      walletSignatureArgs,
      walletType,
      bech32Address // pass Bech32 address for database operations
    );

    if (!result.success || !result.data) {
      logger.warn(`Authentication failed for wallet ${bech32Address.slice(0, 12)}... with nonce ${nonce.slice(0, 8)}...: ${result.error}`);

      // Return appropriate error based on failure type
      const statusCode = result.error?.includes('expired') ? 410 : // Gone
                         result.error?.includes('invalid') || result.error?.includes('verification') ? 401 : // Unauthorized
                         500; // Internal Server Error

      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: statusCode }
      );
    }

    // Return successful authentication response
    const response: VerifyResponse = {
      accessToken: result.data.token,
      expiresAt: result.data.expiresAt.toISOString(),
      user: {
        id: result.data.userId,
        walletAddress: result.data.walletAddress,
        walletType: result.data.walletType
      }
    };

    logger.info(`Authentication successful for user ${result.data.userId}, wallet ${result.data.walletAddress.slice(0, 12)}... (${result.data.walletType}), expires: ${result.data.expiresAt}`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logger.error({ err: error }, 'Verify endpoint error');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
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