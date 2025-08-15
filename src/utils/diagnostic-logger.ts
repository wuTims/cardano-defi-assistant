/**
 * Diagnostic Logger for Transaction Data Flow Analysis
 * 
 * Purpose: Capture and analyze data at each transformation point
 * to identify where field mapping issues occur
 */

import fs from 'fs';
import path from 'path';

export class DiagnosticLogger {
  private static logFile = path.join(process.cwd(), 'logs', 'transaction-diagnostic.log');
  private static isEnabled = process.env.DIAGNOSTIC_LOGGING === 'true';

  /**
   * Initialize the logger and create log directory
   */
  static init() {
    if (!this.isEnabled) return;
    
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Clear existing log file for fresh analysis
    if (fs.existsSync(this.logFile)) {
      fs.unlinkSync(this.logFile);
    }

    this.writeLog('='.repeat(80));
    this.writeLog('TRANSACTION DATA FLOW DIAGNOSTIC LOG');
    this.writeLog(`Started: ${new Date().toISOString()}`);
    this.writeLog('='.repeat(80));
  }

  /**
   * Log raw database query results
   */
  static logDatabaseQuery(location: string, query: string, data: any) {
    if (!this.isEnabled) return;

    this.writeLog('\n' + '='.repeat(60));
    this.writeLog(`[DATABASE QUERY] ${location}`);
    this.writeLog(`Time: ${new Date().toISOString()}`);
    this.writeLog(`Query: ${query}`);
    this.writeLog('-'.repeat(40));
    
    if (data) {
      // Log first record in detail
      if (Array.isArray(data) && data.length > 0) {
        this.writeLog(`Total Records: ${data.length}`);
        this.writeLog('\nFirst Record (RAW):');
        this.writeLog(JSON.stringify(data[0], this.bigIntReplacer, 2));
        
        // Log field names
        this.writeLog('\nField Names:');
        this.writeLog(Object.keys(data[0]).join(', '));
        
        // Check for specific fields
        this.writeLog('\nField Check:');
        this.writeLog(`- Has 'tx_hash': ${data[0].hasOwnProperty('tx_hash')}`);
        this.writeLog(`- Has 'txHash': ${data[0].hasOwnProperty('txHash')}`);
        this.writeLog(`- Has 'transaction_id': ${data[0].hasOwnProperty('transaction_id')}`);
        this.writeLog(`- Has 'id': ${data[0].hasOwnProperty('id')}`);
      } else if (!Array.isArray(data)) {
        this.writeLog('Single Record:');
        this.writeLog(JSON.stringify(data, this.bigIntReplacer, 2));
      }
    } else {
      this.writeLog('No data returned');
    }
  }

  /**
   * Log transformed data after repository mapping
   */
  static logTransformation(location: string, before: any, after: any) {
    if (!this.isEnabled) return;

    this.writeLog('\n' + '='.repeat(60));
    this.writeLog(`[TRANSFORMATION] ${location}`);
    this.writeLog(`Time: ${new Date().toISOString()}`);
    this.writeLog('-'.repeat(40));
    
    this.writeLog('BEFORE:');
    this.writeLog(JSON.stringify(before, this.bigIntReplacer, 2));
    
    this.writeLog('\nAFTER:');
    this.writeLog(JSON.stringify(after, this.bigIntReplacer, 2));
    
    // Log field mapping
    if (before && after) {
      this.writeLog('\nField Mapping:');
      const beforeKeys = Object.keys(before);
      const afterKeys = Object.keys(after);
      
      beforeKeys.forEach(key => {
        const mappedKey = this.findMappedKey(key, before[key], afterKeys, after);
        if (mappedKey) {
          this.writeLog(`  ${key} → ${mappedKey}`);
        } else {
          this.writeLog(`  ${key} → [NOT MAPPED]`);
        }
      });
      
      // Check for new fields
      afterKeys.forEach(key => {
        if (!this.findSourceKey(key, after[key], beforeKeys, before)) {
          this.writeLog(`  [NEW] → ${key}`);
        }
      });
    }
  }

  /**
   * Log API response data
   */
  static logApiResponse(endpoint: string, response: any) {
    if (!this.isEnabled) return;

    this.writeLog('\n' + '='.repeat(60));
    this.writeLog(`[API RESPONSE] ${endpoint}`);
    this.writeLog(`Time: ${new Date().toISOString()}`);
    this.writeLog('-'.repeat(40));
    
    if (response.transactions && Array.isArray(response.transactions)) {
      this.writeLog(`Total Transactions: ${response.transactions.length}`);
      if (response.transactions.length > 0) {
        this.writeLog('\nFirst Transaction:');
        this.writeLog(JSON.stringify(response.transactions[0], this.bigIntReplacer, 2));
        
        // Check field presence
        const firstTx = response.transactions[0];
        this.writeLog('\nField Validation:');
        this.writeLog(`- txHash: ${firstTx.txHash ? '✓' : '✗ MISSING'}`);
        this.writeLog(`- timestamp: ${firstTx.timestamp ? '✓' : '✗ MISSING'}`);
        this.writeLog(`- blockHeight: ${firstTx.blockHeight ? '✓' : '✗ MISSING'}`);
        this.writeLog(`- walletAddress: ${firstTx.walletAddress ? '✓' : '✗ MISSING'}`);
      }
    } else {
      this.writeLog('Response:');
      this.writeLog(JSON.stringify(response, this.bigIntReplacer, 2));
    }
  }

  /**
   * Log client-side received data
   */
  static logClientData(location: string, data: any, error?: any) {
    if (!this.isEnabled) return;

    this.writeLog('\n' + '='.repeat(60));
    this.writeLog(`[CLIENT] ${location}`);
    this.writeLog(`Time: ${new Date().toISOString()}`);
    this.writeLog('-'.repeat(40));
    
    if (error) {
      this.writeLog('ERROR:');
      this.writeLog(error.toString());
      if (error.stack) {
        this.writeLog('\nStack Trace:');
        this.writeLog(error.stack);
      }
    }
    
    if (data) {
      this.writeLog('Data:');
      this.writeLog(JSON.stringify(data, this.bigIntReplacer, 2));
      
      // Type checking
      if (data && typeof data === 'object') {
        this.writeLog('\nType Analysis:');
        Object.entries(data).forEach(([key, value]) => {
          this.writeLog(`  ${key}: ${typeof value} ${value === null ? '(null)' : ''}`);
        });
      }
    }
  }

  /**
   * Write summary analysis
   */
  static writeSummary(issues: string[]) {
    if (!this.isEnabled) return;

    this.writeLog('\n' + '='.repeat(80));
    this.writeLog('DIAGNOSTIC SUMMARY');
    this.writeLog('='.repeat(80));
    
    if (issues.length > 0) {
      this.writeLog('\nIssues Found:');
      issues.forEach((issue, i) => {
        this.writeLog(`${i + 1}. ${issue}`);
      });
    } else {
      this.writeLog('No issues detected in data flow');
    }
    
    this.writeLog('\n' + '='.repeat(80));
    this.writeLog(`Completed: ${new Date().toISOString()}`);
  }

  /**
   * Helper to write to log file
   */
  private static writeLog(message: string) {
    if (!this.isEnabled) return;
    
    const logMessage = `${message}\n`;
    fs.appendFileSync(this.logFile, logMessage);
    
    // Also log to console in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DIAGNOSTIC] ${message}`);
    }
  }

  /**
   * Helper to handle BigInt serialization
   */
  private static bigIntReplacer(key: string, value: any): any {
    if (typeof value === 'bigint') {
      return `BigInt(${value.toString()})`;
    }
    return value;
  }

  /**
   * Helper to find mapped field name
   */
  private static findMappedKey(sourceKey: string, sourceValue: any, targetKeys: string[], target: any): string | null {
    // Direct match
    if (targetKeys.includes(sourceKey)) {
      return sourceKey;
    }
    
    // Common transformations
    const camelCase = this.snakeToCamel(sourceKey);
    if (targetKeys.includes(camelCase)) {
      return camelCase;
    }
    
    // Check value equality for renamed fields
    for (const targetKey of targetKeys) {
      if (JSON.stringify(target[targetKey]) === JSON.stringify(sourceValue)) {
        return targetKey;
      }
    }
    
    return null;
  }

  /**
   * Helper to find source field name
   */
  private static findSourceKey(targetKey: string, targetValue: any, sourceKeys: string[], source: any): string | null {
    // Direct match
    if (sourceKeys.includes(targetKey)) {
      return targetKey;
    }
    
    // Common transformations
    const snakeCase = this.camelToSnake(targetKey);
    if (sourceKeys.includes(snakeCase)) {
      return snakeCase;
    }
    
    // Check value equality
    for (const sourceKey of sourceKeys) {
      if (JSON.stringify(source[sourceKey]) === JSON.stringify(targetValue)) {
        return sourceKey;
      }
    }
    
    return null;
  }

  /**
   * Convert snake_case to camelCase
   */
  private static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

// Initialize on import
DiagnosticLogger.init();