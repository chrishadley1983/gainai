/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Tracks request timestamps and enforces a maximum number of requests
 * within a rolling time window. Designed for server-side use with
 * Google Business Profile API rate limits.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  /**
   * Create a new RateLimiter.
   * @param maxRequests - Maximum number of requests allowed in the window (default: 60)
   * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   */
  constructor(maxRequests: number = 60, windowMs: number = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Remove timestamps that have fallen outside the current window.
   */
  private pruneExpired(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }

  /**
   * Check whether a request can proceed without exceeding the rate limit.
   * If allowed, records the request timestamp and returns true.
   * If the limit has been reached, returns false without recording.
   */
  canProceed(): boolean {
    this.pruneExpired();

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now());
      return true;
    }

    return false;
  }

  /**
   * Wait until a slot is available, then record the request and resolve.
   * Uses exponential back-off polling to avoid busy-waiting.
   * @param maxWaitMs - Maximum time to wait before rejecting (default: 120000 = 2 minutes)
   */
  async waitForSlot(maxWaitMs: number = 120_000): Promise<void> {
    const startTime = Date.now();
    let delay = 100; // Start with 100ms polling interval

    while (true) {
      if (this.canProceed()) {
        return;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        throw new Error(
          `Rate limiter timeout: no slot available after ${maxWaitMs}ms`
        );
      }

      // Wait before retrying, with exponential back-off capped at 2s
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 2000);
    }
  }

  /**
   * Get the number of remaining requests available in the current window.
   */
  get remaining(): number {
    this.pruneExpired();
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  /**
   * Get the time in milliseconds until the next slot opens up.
   * Returns 0 if a slot is already available.
   */
  get msUntilNextSlot(): number {
    this.pruneExpired();

    if (this.timestamps.length < this.maxRequests) {
      return 0;
    }

    const oldestInWindow = this.timestamps[0];
    return Math.max(0, oldestInWindow + this.windowMs - Date.now());
  }

  /**
   * Reset the rate limiter, clearing all tracked timestamps.
   */
  reset(): void {
    this.timestamps = [];
  }
}

/**
 * Pre-configured rate limiter for Google Business Profile API.
 * Default: 60 requests per minute.
 */
export const googleApiLimiter = new RateLimiter(60, 60_000);
