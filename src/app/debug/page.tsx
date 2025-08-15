'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Bug, CheckCircle, XCircle } from 'lucide-react';

interface DebugAnalysis {
  timestamp: string;
  user: string | undefined;
  normalApiResponse: any;
  debugAnalysis: any;
  issues: string[];
  fieldMapping: Record<string, string>;
}

export default function DebugPage() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [debugData, setDebugData] = useState<DebugAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const runDiagnostics = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setDebugData(null);

    try {
      // First, try to fetch transactions normally
      console.log('[DEBUG] Fetching transactions via normal API...');
      const txResponse = await fetch('/api/transactions?page=0&pageSize=1', {
        headers: {
          'Authorization': `Bearer ${token.token}`,
        },
      });

      const txData = await txResponse.json();
      console.log('[DEBUG] Transaction API response:', txData);

      // Then fetch debug data
      console.log('[DEBUG] Fetching debug analysis...');
      const debugResponse = await fetch('/api/debug/transactions', {
        headers: {
          'Authorization': `Bearer ${token.token}`,
        },
      });

      if (!debugResponse.ok) {
        throw new Error(`Debug endpoint failed: ${debugResponse.status}`);
      }

      const debug = await debugResponse.json();
      console.log('[DEBUG] Debug analysis:', debug);

      // Analyze the data
      const analysis: DebugAnalysis = {
        timestamp: new Date().toISOString(),
        user: user?.walletAddress,
        normalApiResponse: txData,
        debugAnalysis: debug,
        issues: [],
        fieldMapping: {}
      };

      // Check for issues
      if (debug.rawTransaction) {
        const raw = debug.rawTransaction;
        
        // Check required fields
        if (!raw.tx_hash) {
          analysis.issues.push('Missing tx_hash in database');
        }
        if (!raw.timestamp) {
          analysis.issues.push('Missing timestamp in database');
        }
        
        // Analyze field mapping
        analysis.fieldMapping = {
          'tx_hash': raw.tx_hash ? '✓ Present' : '✗ Missing',
          'timestamp': raw.timestamp ? '✓ Present' : '✗ Missing',
          'block_height': raw.block_height ? '✓ Present' : '✗ Missing',
          'wallet_address': raw.wallet_address ? '✓ Present' : '✗ Missing',
        };
      }

      setDebugData(analysis);

      // Also check the diagnostic log
      console.log('[DEBUG] Check logs/transaction-diagnostic.log for detailed analysis');

    } catch (err) {
      console.error('[DEBUG] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testWalletSync = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setSyncLoading(true);
    setError(null);
    setSyncResult(null);

    try {
      console.log('[DEBUG] Testing wallet fetch...');
      
      // First test wallet fetch
      const walletResponse = await fetch('/api/wallet', {
        headers: {
          'Authorization': `Bearer ${token.token}`,
        },
      });

      const walletData = await walletResponse.json();
      console.log('[DEBUG] Wallet fetch response:', {
        status: walletResponse.status,
        data: walletData
      });

      if (!walletResponse.ok) {
        throw new Error(`Wallet fetch failed: ${walletResponse.status} - ${JSON.stringify(walletData)}`);
      }

      // Then test wallet sync
      console.log('[DEBUG] Testing wallet sync...');
      const syncResponse = await fetch('/api/wallet/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
      });

      const syncData = await syncResponse.json();
      console.log('[DEBUG] Wallet sync response:', {
        status: syncResponse.status,
        data: syncData
      });

      setSyncResult({
        walletFetch: {
          status: walletResponse.status,
          data: walletData
        },
        walletSync: {
          status: syncResponse.status,
          data: syncData
        },
        timestamp: new Date().toISOString()
      });

      // Check the diagnostic log
      console.log('[DEBUG] Check logs/transaction-diagnostic.log for detailed server-side logs');

    } catch (err) {
      console.error('[DEBUG] Wallet test error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSyncLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Debug - Transaction Data Flow</h1>
          <p className="text-muted-foreground">Please connect your wallet first.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bug className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Debug - Transaction Data Flow</h1>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm">
              This page helps diagnose transaction data flow issues. 
              Click the button below to analyze how data transforms from database to client.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Diagnostic logging is enabled
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button 
              onClick={runDiagnostics} 
              disabled={loading || syncLoading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <Bug className="w-4 h-4 mr-2" />
                  Test Transactions
                </>
              )}
            </Button>

            <Button 
              onClick={testWalletSync} 
              disabled={loading || syncLoading}
              className="w-full"
              variant="outline"
            >
              {syncLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Wallet...
                </>
              ) : (
                <>
                  <Bug className="w-4 h-4 mr-2" />
                  Test Wallet Sync
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Error</span>
              </div>
              <p className="text-sm mt-2">{error}</p>
            </div>
          )}

          {debugData && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Analysis Complete</span>
                </div>
              </div>

              {/* Field Mapping */}
              {debugData.fieldMapping && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Database Field Check</h3>
                  <div className="space-y-2">
                    {Object.entries(debugData.fieldMapping).map(([field, status]) => (
                      <div key={field} className="flex justify-between text-sm">
                        <code className="bg-muted px-2 py-1 rounded">{field}</code>
                        <span className={status.includes('✓') ? 'text-green-600' : 'text-red-600'}>
                          {status as string}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Issues */}
              {debugData.issues && debugData.issues.length > 0 && (
                <Card className="p-4 border-red-200 dark:border-red-800">
                  <h3 className="font-semibold mb-3 text-red-600">Issues Found</h3>
                  <ul className="space-y-1">
                    {debugData.issues.map((issue: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-red-500">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Raw Data */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Raw Analysis Data</h3>
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Click to expand JSON data
                  </summary>
                  <pre className="mt-3 p-3 bg-muted rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(debugData, null, 2)}
                  </pre>
                </details>
              </Card>

              <div className="text-sm text-muted-foreground">
                <p>✓ Check browser console for detailed logs</p>
                <p>✓ Check <code className="bg-muted px-1">logs/transaction-diagnostic.log</code> for full analysis</p>
              </div>
            </div>
          )}

          {/* Wallet Sync Results */}
          {syncResult && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Wallet Test Complete</span>
                </div>
              </div>

              <Card className="p-4">
                <h3 className="font-semibold mb-3">Wallet Fetch Result</h3>
                <p className="text-sm">Status: {syncResult.walletFetch.status}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">View Data</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(syncResult.walletFetch.data, null, 2)}
                  </pre>
                </details>
              </Card>

              {syncResult.walletSync && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Wallet Sync Result</h3>
                  <p className="text-sm">Status: {syncResult.walletSync.status}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">View Data</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                      {JSON.stringify(syncResult.walletSync.data, null, 2)}
                    </pre>
                  </details>
                </Card>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}