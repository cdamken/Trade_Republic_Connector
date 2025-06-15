/**
 * Trading Types and Interfaces
 * 
 * Type definitions for Trade Republic trading operations,
 * orders, and market data.
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

export type OrderType = 'market' | 'limit';
export type OrderStatus = 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial';
export type OrderSide = 'buy' | 'sell';
export type TradingVenue = 'XETRA' | 'LSE' | 'NYSE' | 'NASDAQ' | 'GETTEX' | 'TRADEGATE' | 'LANG_SCHWARZ';

/**
 * Order placement data for buy orders
 */
export interface BuyOrderData {
  isin: string;
  quantity?: number;
  amount?: number; // Either quantity or amount must be specified
  orderType: OrderType;
  limitPrice?: number; // Required for limit orders
  venue: TradingVenue;
  expiryDate?: string; // ISO date string for limit orders
  stopLoss?: number; // Stop loss price
  takeProfit?: number; // Take profit price
}

/**
 * Order placement data for sell orders
 */
export interface SellOrderData {
  isin: string;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number; // Required for limit orders
  venue: TradingVenue;
  expiryDate?: string; // ISO date string for limit orders
  stopLoss?: number; // Stop loss price
  takeProfit?: number; // Take profit price
}

/**
 * Order response from API
 */
export interface OrderResponse {
  orderId: string;
  status: OrderStatus;
  isin: string;
  side: OrderSide;
  orderType: OrderType;
  quantity?: number;
  amount?: number;
  limitPrice?: number;
  venue: TradingVenue;
  createdAt: string; // ISO date string
  estimatedFees?: {
    commission: number;
    currency: string;
  };
  estimatedTotal?: {
    amount: number;
    currency: string;
  };
}

/**
 * Historical order information
 */
export interface OrderHistory {
  orderId: string;
  status: OrderStatus;
  isin: string;
  instrumentName: string;
  side: OrderSide;
  orderType: OrderType;
  quantity?: number;
  amount?: number;
  limitPrice?: number;
  executedPrice?: number;
  executedQuantity?: number;
  venue: TradingVenue;
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
  fees?: {
    commission: number;
    currency: string;
  };
  total?: {
    amount: number;
    currency: string;
  };
}

/**
 * Order history filters
 */
export interface OrderHistoryFilters {
  startDate?: string; // ISO date string
  endDate?: string;
  status?: OrderStatus;
  side?: OrderSide;
  isin?: string;
  limit?: number;
  offset?: number;
}

/**
 * Real-time price data
 */
export interface RealTimePrice {
  isin: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string; // ISO date string
  venue: TradingVenue;
  bid?: number;
  ask?: number;
  spread?: number;
  marketStatus: 'open' | 'closed' | 'pre_market' | 'after_hours';
}

/**
 * Historical price data point
 */
export interface HistoricalPricePoint {
  timestamp: string; // ISO date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Historical price data response
 */
export interface HistoricalPricesResponse {
  isin: string;
  period: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y';
  currency: string;
  data: HistoricalPricePoint[];
  count: number;
}

/**
 * Market news article
 */
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content?: string;
  author: string;
  publishedAt: string; // ISO date string
  source: string;
  url?: string;
  imageUrl?: string;
  instruments?: string[]; // Related ISINs
  tags?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

/**
 * Market news response
 */
export interface MarketNewsResponse {
  articles: NewsArticle[];
  count: number;
  hasMore: boolean;
  nextPage?: string;
}

/**
 * Watchlist item
 */
export interface WatchlistItem {
  isin: string;
  instrumentName: string;
  symbol: string;
  currentPrice: number;
  currency: string;
  change: number;
  changePercent: number;
  addedAt: string; // ISO date string
  alerts?: {
    priceAbove?: number;
    priceBelow?: number;
    volumeThreshold?: number;
  };
}

/**
 * Watchlist response
 */
export interface WatchlistResponse {
  items: WatchlistItem[];
  count: number;
  lastUpdated: string; // ISO date string
}

/**
 * Trading limits and restrictions
 */
export interface TradingLimits {
  dailyOrderLimit: number;
  maxOrderValue: number;
  minOrderValue: number;
  availableCash: number;
  currency: string;
  marginLevel?: number;
  restrictions?: {
    dayTrading: boolean;
    shortSelling: boolean;
    optionsTrading: boolean;
  };
}

/**
 * Market status information
 */
export interface MarketStatus {
  venue: TradingVenue;
  status: 'open' | 'closed' | 'pre_market' | 'after_hours';
  nextOpen?: string; // ISO date string
  nextClose?: string; // ISO date string
  timezone: string;
}

/**
 * Trading errors
 */
export class TradingError extends Error {
  constructor(
    message: string,
    public code: string,
    public orderId?: string
  ) {
    super(message);
    this.name = 'TradingError';
  }
}

export class InsufficientFundsError extends TradingError {
  constructor(required: number, available: number, currency: string) {
    super(
      `Insufficient funds: required ${required} ${currency}, available ${available} ${currency}`,
      'INSUFFICIENT_FUNDS'
    );
  }
}

export class MarketClosedError extends TradingError {
  constructor(venue: TradingVenue) {
    super(`Market is closed: ${venue}`, 'MARKET_CLOSED');
  }
}

export class InvalidOrderError extends TradingError {
  constructor(message: string) {
    super(message, 'INVALID_ORDER');
  }
}
