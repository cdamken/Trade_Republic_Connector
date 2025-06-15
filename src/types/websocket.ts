/**
 * WebSocket Types
 *
 * TypeScript definitions for Trade Republic WebSocket communication
 */

export interface WebSocketMessage {
  type: MessageType;
  id?: string;
  payload: unknown;
  timestamp: number;
}

export type MessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'price_update'
  | 'portfolio_update'
  | 'order_update'
  | 'execution'
  | 'market_status'
  | 'news'
  | 'watchlist_update'
  | 'error'
  | 'heartbeat'
  | 'auth';

export interface SubscriptionRequest {
  type: 'subscribe';
  channel: ChannelType;
  isin?: string;
  id: string;
}

export interface UnsubscriptionRequest {
  type: 'unsubscribe';
  channel: ChannelType;
  isin?: string;
  id: string;
}

export type ChannelType = 'price' | 'portfolio' | 'orders' | 'executions' | 'market_status' | 'news' | 'watchlist';

export interface PriceUpdateMessage extends WebSocketMessage {
  type: 'price_update';
  payload: {
    isin: string;
    price: number;
    currency: string;
    bid?: number;
    ask?: number;
  };
}

export interface PortfolioUpdateMessage extends WebSocketMessage {
  type: 'portfolio_update';
  payload: {
    totalValue: number;
    dayChange: number;
    dayChangePercentage: number;
    positions?: Array<{
      isin: string;
      quantity: number;
      value: number;
    }>;
  };
}

export interface OrderUpdateMessage extends WebSocketMessage {
  type: 'order_update';
  payload: {
    orderId: string;
    status: 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial';
    isin: string;
    side: 'buy' | 'sell';
    quantity?: number;
    executedQuantity?: number;
    price?: number;
    executedPrice?: number;
    timestamp: string;
  };
}

export interface ExecutionMessage extends WebSocketMessage {
  type: 'execution';
  payload: {
    orderId: string;
    tradeId: string;
    isin: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    executedAt: string;
    fees?: {
      commission: number;
      currency: string;
    };
  };
}

export interface MarketStatusMessage extends WebSocketMessage {
  type: 'market_status';
  payload: {
    venue: string;
    status: 'open' | 'closed' | 'pre_market' | 'after_hours';
    nextOpen?: string;
    nextClose?: string;
    timezone: string;
  };
}

export interface NewsMessage extends WebSocketMessage {
  type: 'news';
  payload: {
    id: string;
    title: string;
    summary: string;
    publishedAt: string;
    source: string;
    instruments?: string[];
    tags?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
    url?: string;
  };
}

export interface WatchlistUpdateMessage extends WebSocketMessage {
  type: 'watchlist_update';
  payload: {
    action: 'added' | 'removed' | 'price_update';
    isin: string;
    instrumentName?: string;
    currentPrice?: number;
    change?: number;
    changePercent?: number;
  };
}

export interface WebSocketConfig {
  url: string;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  subscriptionTimeout: number;
}
