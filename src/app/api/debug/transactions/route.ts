/**
 * GET /api/debug/transactions
 * 
 * Debug endpoint to analyze transaction data flow and transformations.
 * This endpoint is for development diagnostics only.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DiagnosticLogger } from '@/utils/diagnostic-logger';
import { withAuth } from '@/utils/auth-wrapper';

export const GET = withAuth(async (request, { walletAddress, userId }) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Debug endpoint only available in development' },
        { status: 403 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch raw data directly from database
    const { data: rawTransactions, error: txError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // 2. Fetch with asset flows
    const { data: withFlows, error: flowError } = await supabase
      .from('wallet_transactions')
      .select(`
        *,
        asset_flows (
          *,
          tokens (*)
        )
      `)
      .eq('user_id', userId)
      .limit(1);

    if (flowError) {
      return NextResponse.json({ error: flowError.message }, { status: 500 });
    }

    // 3. Get field information from database schema
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'wallet_transactions' });

    // 4. Analyze the data
    const analysis = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DIAGNOSTIC_LOGGING: process.env.DIAGNOSTIC_LOGGING
      },
      rawTransaction: rawTransactions?.[0] || null,
      transactionWithFlows: withFlows?.[0] || null,
      fieldAnalysis: rawTransactions?.[0] ? {
        fields: Object.keys(rawTransactions[0]),
        types: Object.entries(rawTransactions[0]).reduce((acc, [key, value]) => {
          acc[key] = {
            type: typeof value,
            isNull: value === null,
            value: typeof value === 'bigint' ? value.toString() : value
          };
          return acc;
        }, {} as any),
        missingExpectedFields: {
          txHash: !rawTransactions[0].hasOwnProperty('tx_hash'),
          tx_timestamp: !rawTransactions[0].hasOwnProperty('tx_timestamp'),
          blockHeight: !rawTransactions[0].hasOwnProperty('block_height')
        }
      } : null,
      assetFlowAnalysis: withFlows?.[0]?.asset_flows?.[0] ? {
        fields: Object.keys(withFlows[0].asset_flows[0]),
        tokenFields: withFlows[0].asset_flows[0].tokens 
          ? Object.keys(withFlows[0].asset_flows[0].tokens)
          : []
      } : null,
      databaseSchema: columns || null
    };

    // Log to diagnostic file
    DiagnosticLogger.logClientData('DEBUG ENDPOINT - Complete Analysis', analysis);

    // Write summary
    const issues: string[] = [];
    
    if (rawTransactions?.[0]) {
      if (!rawTransactions[0].tx_hash) {
        issues.push('Missing tx_hash field in database');
      }
      if (!rawTransactions[0].tx_timestamp) {
        issues.push('Missing tx_timestamp field in database');
      }
    } else {
      issues.push('No transactions found for user');
    }

    DiagnosticLogger.writeSummary(issues);

    // Return analysis as JSON
    return NextResponse.json(analysis, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze transactions', details: error },
      { status: 500 }
    );
  }
});