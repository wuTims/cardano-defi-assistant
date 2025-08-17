/**
 * POST /api/auth/nonce
 * 
 * Generates authentication challenge for wallet signing
 * Replaces generateChallengeAction server action
 */

import { NextRequest, NextResponse } from 'next/server';
import { cardanoAuthService } from '@/services/cardano-auth-service';
import { logger } from '@/lib/logger';
import { validateAndConvertHexToBech32 } from '@/lib/cardano/addresses';
import type { NonceRequest, NonceResponse } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: NonceRequest = await request.json();
    const { walletAddress: hexAddress } = body;

    // Validate input
    if (!hexAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
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

    // Generate challenge using Supabase auth service with Bech32 address
    const result = await cardanoAuthService.generateChallenge(bech32Address);
    
    if (!result.success || !result.data) {
      logger.error(`Challenge generation failed for wallet ${bech32Address.slice(0, 12)}...: ${result.error}`);
      return NextResponse.json(
        { error: result.error || 'Failed to generate challenge' },
        { status: 500 }
      );
    }

    // Return challenge data to client
    const response: NonceResponse = {
      nonce: result.data.nonce,
      challenge: result.data.challenge,
      expiresAt: result.data.expiresAt.toISOString()
    };

    logger.info(`Challenge generated successfully for wallet ${bech32Address.slice(0, 12)}..., nonce: ${result.data.nonce.slice(0, 8)}..., expires: ${result.data.expiresAt}`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logger.error({ err: error }, 'Nonce endpoint error');
    
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