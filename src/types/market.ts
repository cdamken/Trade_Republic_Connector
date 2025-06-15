/**
 * Market Data Types
 *
 * TypeScript definitions for Trade Republic market data
 */

export interface MarketData {
  isin: string;
  price: number;
  currency: string;
  timestamp: number;
  bid?: number;
  ask?: number;
  volume?: number;
  dayChange?: number;
  dayChangePercentage?: number;
  dayHigh?: number;
  dayLow?: number;
  dayOpen?: number;
  previousClose?: number;
}

export interface HistoricalData {
  isin: string;
  prices: PricePoint[];
  interval: TimeInterval;
  currency: string;
}

export interface PricePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface MarketStatus {
  isOpen: boolean;
  nextOpenTime?: number;
  nextCloseTime?: number;
  timezone: string;
}

export interface SearchResult {
  isin: string;
  name: string;
  symbol: string;
  type: AssetType;
  currency: string;
  exchange: string;
  score: number;
}

import type { AssetType } from './portfolio';
