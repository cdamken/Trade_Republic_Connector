// 🔒 Core Types for Trade Republic API
// Comprehensive type definitions for all TR data structures

// ========================
// AUTHENTICATION TYPES
// ========================

export interface TRCredentials {
  phoneNumber: string;
  pin: string;
  locale?: string;
}

export interface TRDeviceKeys {
  publicKey: string;
  privateKey: string;
  createdAt: Date;
  deviceId?: string;
}

export interface TRSession {
  sessionToken: string;
  refreshToken: string;
  expiresAt: Date;
  accountState: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

// ========================
// API RESPONSE TYPES
// ========================

export interface TRApiResponse<T = unknown> {
  data?: T;
  error?: TRApiError;
  timestamp: Date;
  requestId: string;
}

export interface TRApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

// ========================
// PORTFOLIO TYPES
// ========================

export interface TRPortfolio {
  totalValue: TRMoney;
  cash: TRMoney;
  positions: TRPosition[];
  performance: TRPerformance;
  lastUpdated: Date;
}

export interface TRPosition {
  instrument: TRInstrument;
  quantity: number;
  averagePrice: TRMoney;
  currentPrice: TRMoney;
  marketValue: TRMoney;
  unrealizedPnl: TRMoney;
  unrealizedPnlPercent: number;
  lastUpdated: Date;
}

export interface TRInstrument {
  isin: string;
  name: string;
  shortName: string;
  type: 'stock' | 'etf' | 'bond' | 'derivative' | 'crypto';
  currency: string;
  exchange: string;
  sector?: string;
  country?: string;
}

export interface TRMoney {
  amount: number;
  currency: string;
  formatted?: string;
}

export interface TRPerformance {
  totalReturn: TRMoney;
  totalReturnPercent: number;
  todayReturn: TRMoney;
  todayReturnPercent: number;
  period: {
    from: Date;
    to: Date;
  };
}

// ========================
// TRADING TYPES
// ========================

export interface TROrder {
  id: string;
  instrument: TRInstrument;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stopLimit';
  quantity: number;
  price?: TRMoney;
  stopPrice?: TRMoney;
  status: TROrderStatus;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  createdAt: Date;
  updatedAt: Date;
  executedQuantity?: number;
  averageExecutionPrice?: TRMoney;
  fees?: TRMoney;
}

export type TROrderStatus = 
  | 'pending'
  | 'open'
  | 'partiallyFilled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface TROrderRequest {
  instrument: string; // ISIN
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  timeInForce?: 'day' | 'gtc';
  expiry?: Date;
}

// ========================
// TIMELINE/HISTORY TYPES
// ========================

export interface TRTimelineEvent {
  id: string;
  type: TREventType;
  timestamp: Date;
  instrument?: TRInstrument;
  amount?: TRMoney;
  quantity?: number;
  price?: TRMoney;
  fees?: TRMoney;
  description: string;
  details?: Record<string, unknown>;
}

export type TREventType =
  | 'trade'
  | 'dividend'
  | 'deposit'
  | 'withdrawal'
  | 'fee'
  | 'tax'
  | 'split'
  | 'spinoff'
  | 'merger'
  | 'interest';

export interface TRTimelineFilter {
  from?: Date;
  to?: Date;
  types?: TREventType[];
  instruments?: string[]; // ISINs
  limit?: number;
  offset?: number;
}

// ========================
// MARKET DATA TYPES
// ========================

export interface TRQuote {
  instrument: TRInstrument;
  bid?: TRMoney;
  ask?: TRMoney;
  last: TRMoney;
  change: TRMoney;
  changePercent: number;
  volume?: number;
  timestamp: Date;
  marketStatus: 'open' | 'closed' | 'premarket' | 'aftermarket';
}

export interface TRCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TRChartData {
  instrument: TRInstrument;
  timeframe: '1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1M';
  candles: TRCandle[];
  period: {
    from: Date;
    to: Date;
  };
}

// ========================
// WEBSOCKET TYPES
// ========================

export interface TRWebSocketMessage {
  type: 'subscription' | 'update' | 'error' | 'heartbeat';
  channel?: string;
  data?: unknown;
  error?: TRApiError;
  timestamp: Date;
}

export interface TRSubscription {
  channel: string;
  instruments?: string[];
  callback: (data: unknown) => void;
  id: string;
}

// ========================
// CONFIGURATION TYPES
// ========================

export interface TRClientConfig {
  phoneNumber: string;
  pin: string;
  locale?: string;
  environment?: 'production' | 'sandbox';
  timeout?: number;
  retryAttempts?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  storage?: TRStorageAdapter;
}

export interface TRStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// ========================
// EVENT TYPES
// ========================

export interface TREventEmitter {
  on(event: 'connected', listener: () => void): void;
  on(event: 'disconnected', listener: (reason: string) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'quote', listener: (quote: TRQuote) => void): void;
  on(event: 'portfolio', listener: (portfolio: TRPortfolio) => void): void;
  on(event: 'order', listener: (order: TROrder) => void): void;
  emit(event: string, ...args: unknown[]): boolean;
  off(event: string, listener: Function): void;
}

// ========================
// UTILITY TYPES
// ========================

export type TRPromise<T> = Promise<TRApiResponse<T>>;

export interface TRPagination {
  page: number;
  limit: number;
  total?: number;
  hasMore?: boolean;
}

export interface TRPaginatedResponse<T> {
  data: T[];
  pagination: TRPagination;
}

// Type guards
export function isTRApiError(obj: unknown): obj is TRApiError {
  return typeof obj === 'object' && obj !== null && 'code' in obj && 'message' in obj;
}

export function isTRPosition(obj: unknown): obj is TRPosition {
  return typeof obj === 'object' && obj !== null && 'instrument' in obj && 'quantity' in obj;
}
