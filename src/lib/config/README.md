# Configuration Management System

## Overview

The centralized configuration system provides a single source of truth for all application configuration values. It ensures type safety, proper validation, and consistent access patterns across the entire application.

## Key Features

- **Type-safe configuration** with comprehensive TypeScript interfaces
- **Environment-specific validation** (strict validation in production)
- **Singleton pattern** ensuring consistent configuration across the app
- **Integration with error handling system** using `ConfigurationError`
- **Support for both client-side and server-side** environment variables
- **Sensible defaults** for development environments

## Usage Examples

### Basic Configuration Access

```typescript
import { config } from '@/lib/config';

// Get database configuration
const dbConfig = config.get('database');
console.log(dbConfig.supabaseUrl); // Type-safe access

// Get authentication settings
const authConfig = config.get('auth');
const jwtSecret = authConfig.jwtSecret;
const tokenExpiry = authConfig.tokenExpiresIn;

// Get API configuration
const apiConfig = config.get('api');
const blockfrostKey = apiConfig.blockfrostKey;
```

### Environment Detection

```typescript
import { config } from '@/lib/config';

// Check environment
if (config.isDevelopment()) {
  console.log('Running in development mode');
}

if (config.isProduction()) {
  // Enable production-only features
}

// Get environment directly
const env = config.get('app').environment;
```

### Service Integration Examples

#### Authentication Service

```typescript
import { config } from '@/lib/config';
import jwt from 'jsonwebtoken';

export class AuthService {
  private authConfig = config.get('auth');

  generateToken(payload: any): string {
    return jwt.sign(payload, this.authConfig.jwtSecret, {
      algorithm: this.authConfig.jwtAlgorithm as jwt.Algorithm,
      expiresIn: `${this.authConfig.tokenExpiresIn}s`
    });
  }
}
```

#### Database Service

```typescript
import { config } from '@/lib/config';
import { createClient } from '@supabase/supabase-js';

export class DatabaseService {
  private dbConfig = config.get('database');
  
  getClient() {
    return createClient(
      this.dbConfig.supabaseUrl,
      this.dbConfig.supabasePublicKey
    );
  }
  
  getServiceClient() {
    return createClient(
      this.dbConfig.supabaseUrl,
      this.dbConfig.supabaseServiceKey
    );
  }
}
```

#### Blockfrost API Service

```typescript
import { config } from '@/lib/config';

export class BlockfrostService {
  private apiConfig = config.get('api');
  
  async fetchData(endpoint: string) {
    const response = await fetch(`${this.apiConfig.blockfrostUrl}${endpoint}`, {
      headers: {
        'project_id': this.apiConfig.blockfrostKey
      }
    });
    return response.json();
  }
}
```

#### Wallet Sync Service

```typescript
import { config } from '@/lib/config';

export class WalletSyncService {
  private walletConfig = config.get('wallet');
  
  async startSync() {
    // Use configuration for sync intervals and retry logic
    const interval = this.walletConfig.syncInterval * 1000; // Convert to ms
    const maxRetries = this.walletConfig.maxRetries;
    const retryDelay = this.walletConfig.retryDelay;
    
    setInterval(() => {
      this.performSync(maxRetries, retryDelay);
    }, interval);
  }
}
```

### Component Integration

#### React Component with Configuration

```typescript
import { config } from '@/lib/config';
import { useEffect, useState } from 'react';

export const DashboardComponent = () => {
  const [appName, setAppName] = useState('');
  
  useEffect(() => {
    // Access app configuration in component
    const appConfig = config.get('app');
    setAppName(appConfig.name);
  }, []);
  
  return (
    <div>
      <h1>Welcome to {appName}</h1>
      {config.isDevelopment() && (
        <div className="debug-info">
          Running in development mode
        </div>
      )}
    </div>
  );
};
```

## Configuration Structure

The configuration is organized into logical sections:

```typescript
interface AppConfig {
  app: {
    name: string;
    environment: 'development' | 'staging' | 'production';
    debug: boolean;
  };
  auth: {
    jwtSecret: string;
    jwtAlgorithm: string;
    tokenExpiresIn: number; // seconds
    challengeTTL: number; // seconds
  };
  wallet: {
    syncInterval: number; // seconds
    maxRetries: number;
    retryDelay: number; // milliseconds
  };
  api: {
    blockfrostUrl: string;
    blockfrostKey: string;
    maxConcurrentRequests: number;
  };
  database: {
    supabaseUrl: string;
    supabasePublicKey: string;
    supabaseServiceKey: string;
  };
}
```

## Environment Variables

### Required in Production
- `JWT_SECRET` - Secret for JWT token signing
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key

### Optional (with defaults)
- `NEXT_PUBLIC_APP_NAME` - Application name (default: "Wallet Sync Service")
- `JWT_ALGORITHM` - JWT algorithm (default: "HS256")
- `JWT_EXPIRES_IN` - Token expiry in seconds (default: 604800 = 7 days)
- `CHALLENGE_TTL` - Challenge TTL in seconds (default: 300 = 5 minutes)
- `WALLET_SYNC_INTERVAL` - Sync interval in seconds (default: 3600 = 1 hour)
- `WALLET_MAX_RETRIES` - Max retry attempts (default: 3)
- `WALLET_RETRY_DELAY` - Retry delay in ms (default: 1000)
- `BLOCKFROST_URL` - Blockfrost API URL
- `BLOCKFROST_KEY` - Blockfrost API key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server operations
- `MAX_CONCURRENT_REQUESTS` - API concurrency limit (default: 5)

## Error Handling

The configuration system integrates with the centralized error handling:

```typescript
import { config } from '@/lib/config';
import { errorHandler } from '@/lib/errors';

try {
  const authConfig = config.get('auth');
  // Use configuration...
} catch (error) {
  // Automatically handles ConfigurationError with proper context
  const response = errorHandler.handle(error);
  console.error('Configuration error:', response);
}
```

## Best Practices

1. **Always use the config singleton** instead of accessing `process.env` directly
2. **Access configuration at service initialization** rather than in request handlers
3. **Use type-safe getters** - `config.get('section')` provides full typing
4. **Cache configuration values** in service constructors for better performance
5. **Validate configuration early** - the system validates on startup
6. **Use environment detection helpers** - `config.isDevelopment()`, `config.isProduction()`

## Testing

For testing, you can access the full configuration:

```typescript
import { config } from '@/lib/config';

describe('Service', () => {
  it('should use correct configuration', () => {
    const allConfig = config.getAll();
    expect(allConfig.app.environment).toBeDefined();
  });
});
```