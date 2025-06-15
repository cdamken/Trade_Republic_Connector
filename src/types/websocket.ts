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

export interface PriceUpdateMessage {
  type: 'price_update';
  isin: string;
  price: number;
  currency: string;
  timestamp: number;
  bid?: number;
  ask?: number;
}

export interface PortfolioUpdateMessage {
  type: 'portfolio_update';
  totalValue: number;
  dayChange: number;
  dayChangePercentage: number;
  timestamp: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  subscriptionTimeout: number;
}
