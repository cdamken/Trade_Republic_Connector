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

// Portfolio exports
// export { PortfolioManager } from './portfolio/manager'; // TODO: Create this

// Utility exports
export { logger } from './utils/logger';
export type { LogLevel } from './utils/logger';

// WebSocket exports
// export { WebSocketManager } from './websocket/manager'; // TODO: Check implementation
// export type { WebSocketConfig, Subscription } from './websocket/manager';

// Trading exports
// export { TradingManager } from './trading/manager'; // TODO: Create this
export type {
  BuyOrderData,
  SellOrderData,
  OrderResponse,
  OrderHistory,
  OrderHistoryFilters,
  RealTimePrice,
  HistoricalPricesResponse,
  MarketNewsResponse,
  WatchlistResponse,
  TradingLimits,
  MarketStatus,
  OrderType,
  OrderStatus,
  OrderSide,
  TradingVenue,
} from './types/trading';
export {
  TradingError,
  InsufficientFundsError,
  MarketClosedError,
  InvalidOrderError,
} from './types/trading';

// Asset data collection exports  
// export { ComprehensiveAssetDataCollector } from './data/asset-collector'; // TODO: Check this
// export { AssetTestDatabase } from './database/test-database'; // TODO: Create this
export type {
  ComprehensiveAssetInfo,
  ComprehensiveHistoricalData,
  AssetSearchQuery,
  AssetSearchResult,
  ExtendedAssetType,
  AssetDatabaseRecord
} from './types/comprehensive-asset';

// Type exports
export type * from './types/auth';
export type * from './types/portfolio';
export type * from './types/market';
export type * from './types/websocket';
export type * from './types/trading';

// Version info
export const VERSION = '1.0.0';

// Create default export for convenience
export { TradeRepublicClient as default } from './api/client';
