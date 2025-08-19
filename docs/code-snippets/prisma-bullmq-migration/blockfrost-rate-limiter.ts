// Blockfrost Rate Limiter
// Implements token bucket algorithm for Blockfrost's rate limits:
// - 10 requests per second sustained
// - 500 request burst capacity
// - Refills at 10 tokens per second

export class BlockfrostRateLimiter {
  private readonly maxBurst = 500;        // Maximum burst capacity
  private readonly refillRate = 10;       // Tokens per second
  private tokens = 500;                   // Current available tokens
  private lastRefillTime = Date.now();    // Last time tokens were refilled
  
  /**
   * Acquire tokens for making API requests
   * Will wait if not enough tokens are available
   */
  async acquire(count: number = 1): Promise<void> {
    // Refill tokens based on elapsed time
    this.refillTokens();
    
    // If we have enough tokens, consume them immediately
    if (this.tokens >= count) {
      this.tokens -= count;
      return;
    }
    
    // Calculate how long to wait for enough tokens
    const tokensNeeded = count - this.tokens;
    const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;
    
    console.log(`Rate limit: Waiting ${waitTimeMs}ms for ${tokensNeeded} tokens`);
    
    // Wait for tokens to refill
    await this.sleep(waitTimeMs);
    
    // Refill and consume tokens
    this.refillTokens();
    this.tokens -= count;
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;
    
    // Calculate new tokens based on elapsed time
    const newTokens = elapsedSeconds * this.refillRate;
    
    // Add new tokens, but don't exceed burst capacity
    this.tokens = Math.min(this.maxBurst, this.tokens + newTokens);
    
    // Update last refill time
    this.lastRefillTime = now;
  }
  
  /**
   * Check current token count (for debugging)
   */
  getAvailableTokens(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }
  
  /**
   * Reset rate limiter (for testing)
   */
  reset(): void {
    this.tokens = this.maxBurst;
    this.lastRefillTime = Date.now();
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage example:
// const rateLimiter = new BlockfrostRateLimiter();
// 
// // Process 80 transactions in batches of 10
// for (const batch of batches) {
//   await rateLimiter.acquire(10); // Wait if necessary
//   await Promise.all(batch.map(tx => fetchTransaction(tx)));
// }
//
// Result: 80 transactions processed in ~8 seconds (8 batches × 10 parallel)