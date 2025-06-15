/**
 * HTTP Client Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../src/api/http-client';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(5, 1000); // 5 requests per second
  });

  it('should allow requests within limit', async () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await rateLimiter.waitForSlot();
    }
    
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(100); // Should be fast
  });

  it('should throttle requests when limit exceeded', async () => {
    // Fill up the rate limit
    for (let i = 0; i < 5; i++) {
      await rateLimiter.waitForSlot();
    }
    
    const startTime = Date.now();
    await rateLimiter.waitForSlot(); // This should wait
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeGreaterThan(900); // Should wait ~1 second
  });

  it('should reset after time window', async () => {
    // Fill up the rate limit
    for (let i = 0; i < 5; i++) {
      await rateLimiter.waitForSlot();
    }
    
    // Wait for the window to reset
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const startTime = Date.now();
    await rateLimiter.waitForSlot(); // Should not wait
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(100);
  });
});
