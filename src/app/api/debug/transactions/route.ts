/**
 * GET /api/debug/transactions
 * 
 * Debug endpoint to analyze transaction data flow and transformations.
 * This endpoint is for development diagnostics only.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withAuth } from '@/utils/auth-wrapper';

export const GET = withAuth(async (request, { walletAddress, userId }) => {
  // Create child logger for debug endpoint with enhanced categorization logging
  const debugLogger = logger.child({ 
    module: 'api', 
    route: '/api/debug/transactions', 
    method: 'GET',
    walletAddress,
    userId,
    debugMode: true
  });

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

    // Enhanced categorization analysis for debugging
    const categorizationAnalysis = {
      transactionCategorization: rawTransactions?.map(tx => ({
        txHash: tx.tx_hash,
        currentCategory: tx.category || 'UNCATEGORIZED',
        currentAction: tx.tx_action || 'UNKNOWN',
        currentProtocol: tx.protocol || 'UNKNOWN',
        // Asset flow patterns for categorization debugging
        assetFlowPattern: {
          inputAssetTypes: tx.inputs_json?.map((i: any) => i.unit === 'lovelace' ? 'ADA' : 'NATIVE') || [],
          outputAssetTypes: tx.outputs_json?.map((o: any) => o.unit === 'lovelace' ? 'ADA' : 'NATIVE') || [],
          netADAChange: (tx.outputs_json?.find((o: any) => o.unit === 'lovelace')?.quantity || 0) - 
                       (tx.inputs_json?.find((i: any) => i.unit === 'lovelace')?.quantity || 0),
          uniqueAssetUnits: new Set([
            ...(tx.inputs_json?.map((i: any) => i.unit) || []),
            ...(tx.outputs_json?.map((o: any) => o.unit) || [])
          ]).size
        },
        // Categorization indicators
        categorizationIndicators: {
          hasMetadata: !!tx.metadata,
          hasCertificates: !!tx.certificates_json?.length,
          hasWithdrawals: !!tx.withdrawals_json?.length,
          hasMultipleAssets: (tx.inputs_json?.length || 0) + (tx.outputs_json?.length || 0) > 2,
          feeToValueRatio: tx.fees && tx.value ? (Number(tx.fees) / Number(tx.value)) : null
        },
        // Potential categorization gaps
        potentialIssues: [
          ...(tx.category === 'UNKNOWN' ? ['Transaction not categorized'] : []),
          ...(tx.tx_action === 'UNKNOWN' ? ['Action not identified'] : []),
          ...(tx.protocol === 'UNKNOWN' ? ['Protocol not identified'] : []),
          ...(!tx.inputs_json?.length ? ['Missing input data'] : []),
          ...(!tx.outputs_json?.length ? ['Missing output data'] : [])
        ]
      })) || [],
      
      // Summary statistics for categorization health
      categorizationSummary: {
        totalTransactions: rawTransactions?.length || 0,
        uncategorizedCount: rawTransactions?.filter(tx => !tx.category || tx.category === 'UNKNOWN').length || 0,
        unknownActionCount: rawTransactions?.filter(tx => !tx.tx_action || tx.tx_action === 'UNKNOWN').length || 0,
        unknownProtocolCount: rawTransactions?.filter(tx => !tx.protocol || tx.protocol === 'UNKNOWN').length || 0,
        categoriesSeen: new Set(rawTransactions?.map(tx => tx.category).filter(Boolean)),
        actionsSeen: new Set(rawTransactions?.map(tx => tx.tx_action).filter(Boolean)),
        protocolsSeen: new Set(rawTransactions?.map(tx => tx.protocol).filter(Boolean))
      }
    };

    // Comprehensive debug logging for categorization analysis
    debugLogger.info({
      analysis,
      categorizationAnalysis,
      debugMode: 'TRANSACTION_CATEGORIZATION_ANALYSIS'
    }, 'Complete transaction categorization debug analysis');

    // Enhanced analysis with categorization focus
    const enhancedAnalysis = {
      ...analysis,
      categorizationAnalysis
    };

    // Return enhanced analysis as JSON
    return NextResponse.json(enhancedAnalysis, {
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