/**
 * Cardano formatting utilities following CIP standards
 */

// Format lovelace to ADA with proper decimals
export const formatADA = (lovelace: bigint): string => {
  const ada = Number(lovelace) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(ada);
};

// Format token amounts with decimals
export const formatTokenAmount = (
  amount: bigint, 
  decimals: number = 0
): string => {
  if (decimals === 0) return amount.toString();
  
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === 0n) return whole.toString();
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmed = fractionStr.replace(/0+$/, ''); // Remove trailing zeros
  
  return `${whole}.${trimmed}`;
};

// Abbreviate addresses for display
export const abbreviateAddress = (
  address: string, 
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

// Format transaction date with relative time
export const formatTransactionDate = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

// Check if amount is dust
export const isDust = (
  amount: bigint, 
  decimals: number = 6,
  threshold: number = 1 // 1 ADA equivalent
): boolean => {
  const value = Number(amount) / (10 ** decimals);
  return Math.abs(value) < threshold;
};