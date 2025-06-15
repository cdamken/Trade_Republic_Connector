// 🚀 Modern Trade Republic API - Main Export
// Simple, secure, and scalable Trade Republic API client

// Export core modules
export { TRWebSocketManager } from './websocket/TRWebSocketManager.js';
export { TRPortfolio } from './portfolio/TRPortfolio.js';
export { TRMarketData } from './market/TRMarketData.js';

// Export types
export type {
  Position,
  PortfolioSummary,
  CashPosition,
  PortfolioPerformance
} from './portfolio/TRPortfolio.js';

export type {
  InstrumentInfo,
  PriceData,
  HistoricalData,
  NewsItem,
  SearchResult
} from './market/TRMarketData.js';

export type {
  Subscription,
  WebSocketMessage
} from './websocket/TRWebSocketManager.js';

// Export config and auth
export { TRConfig } from './config/TRConfig.js';
export { TRAuth } from './auth/TRAuth.js';

// Export errors
export * from './errors/index.js';

// Export utilities
export * from './utils/index.js';

// Simple factory function
import { TRConfig } from './config/TRConfig.js';
import { TRAuth } from './auth/TRAuth.js';
import { TRWebSocketManager } from './websocket/TRWebSocketManager.js';
import { TRPortfolio } from './portfolio/TRPortfolio.js';
import { TRMarketData } from './market/TRMarketData.js';

export function createTRClient(phoneNumber: string, pin: string, locale = 'de') {
  const config = new TRConfig({
    phoneNumber,
    pin,
    locale,
    environment: 'production'
  });
  
  return {
    config,
    auth: new TRAuth(config),
    wsManager: new TRWebSocketManager(config),
    createPortfolio: (wsManager: TRWebSocketManager) => new TRPortfolio(wsManager),
    createMarketData: (wsManager: TRWebSocketManager) => new TRMarketData(wsManager)
  };
}
