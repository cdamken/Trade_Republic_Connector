// 🚀 Modern Trade Republic API Client
// Built with security, performance, and developer experience in mind

export { TradeRepublicClient } from './client/TradeRepublicClient.js';
export { TRAuth } from './auth/TRAuth.js';
export { TRWebSocket } from './websocket/TRWebSocket.js';

// Type exports
export type * from './types/index.js';

// Error exports
export * from './errors/index.js';

// Utility exports
export * from './utils/index.js';

// Configuration
export { TRConfig } from './config/TRConfig.js';

// Default client instance for simple usage
import { TradeRepublicClient } from './client/TradeRepublicClient.js';

/**
 * Create a new Trade Republic client instance
 * 
 * @example
 * ```typescript
 * import { createTRClient } from '@carlos/trade-republic-api';
 * 
 * const tr = createTRClient({
 *   phoneNumber: '+4917681033982',
 *   pin: '1704'
 * });
 * 
 * await tr.auth.initialize();
 * const portfolio = await tr.portfolio.get();
 * ```
 */
export function createTRClient(config: {
  phoneNumber: string;
  pin: string;
  locale?: string;
  environment?: 'production' | 'sandbox';
}) {
  return new TradeRepublicClient(config);
}

// Version
export const VERSION = '1.0.0';
