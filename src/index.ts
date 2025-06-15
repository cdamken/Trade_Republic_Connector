/**
 * Trade Republic Connector - Modern TypeScript API
 *
 * A secure, scalable TypeScript-based connector for Trade Republic
 * supporting 400+ assets with real-time data and portfolio management.
 */

// Main exports
export { TradeRepublicClient } from './api/client';
export type { TradeRepublicConfig } from './config/config';

// Configuration exports
export { getCredentialsFromEnv, validateCredentials, loadEnvironmentConfig } from './config/environment';
export type { EnvironmentConfig } from './config/environment';

// Authentication exports
export { AuthManager } from './auth/manager';
export { 
  AuthenticationError, 
  TwoFactorRequiredError, 
  RateLimitError, 
  SessionExpiredError 
} from './types/auth';

// HTTP client exports
export { HttpClient, RateLimiter } from './api/http-client';

// Utility exports
export { logger } from './utils/logger';
export type { LogLevel } from './utils/logger';

// Type exports
export type * from './types/auth';
export type * from './types/portfolio';
export type * from './types/market';
export type * from './types/websocket';

// Version info
export const VERSION = '1.0.0';

// Create default export for convenience
export { TradeRepublicClient as default } from './api/client';
