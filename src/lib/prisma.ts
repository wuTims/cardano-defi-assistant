/**
 * Prisma Client Instance
 * 
 * Singleton instance of Prisma Client for database operations.
 * Prevents multiple instances in development with hot reloading.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Type transformer for serialized Prisma results
 * Shows the output type after BigInt→string and Date→string conversions
 */
export type Serialized<T> = T extends bigint
  ? string
  : T extends Date
  ? string
  : T extends Array<infer U>
  ? Array<Serialized<U>>
  : T extends object
  ? { [K in keyof T]: Serialized<T[K]> }
  : T;

/**
 * Prepares Prisma query results for JSON serialization
 * 
 * Recursively walks the entire object tree and converts:
 * - BigInt → string (preserves precision for large numbers like Lovelace amounts)
 * - Date → ISO string
 * - All other types pass through unchanged
 * 
 * @param value - Complete Prisma query result
 * @returns JSON-safe version of the entire object
 * 
 * @example
 * const transaction = await prisma.transaction.findUnique({ ... });
 * const jsonSafe = serialize(transaction); // Entire object processed
 * return Response.json(jsonSafe);          // No JSON.stringify errors
 */
export function serialize<T>(value: T): Serialized<T> {
  if (value === null || value === undefined) {
    return value as Serialized<T>;
  }
  
  // Convert BigInt to string (leaf node - no further recursion needed)
  if (typeof value === 'bigint') {
    return value.toString() as Serialized<T>;
  }
  
  // Convert Date to ISO string (leaf node - no further recursion needed)
  if (value instanceof Date) {
    return value.toISOString() as Serialized<T>;
  }
  
  // Recursively process each array element
  if (Array.isArray(value)) {
    return value.map(item => serialize(item)) as Serialized<T>;
  }
  
  // Recursively process each object property
  if (typeof value === 'object' && value !== null) {
    const serialized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      serialized[key] = serialize(val);
    }
    return serialized as Serialized<T>;
  }
  
  // Primitive values (string, number, boolean) pass through unchanged
  return value as Serialized<T>;
}

/**
 * Helper function to convert domain metadata to Prisma JSON type
 * Encapsulates infrastructure-specific type conversion
 */
export function toJsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}