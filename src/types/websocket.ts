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

export type ChannelType = 'price' | 'portfolio' | 'orders' | 'trades';

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

export interface WebSocketConfig {
  url: string;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  subscriptionTimeout: number;
}
