/**
 * Portfolio Types
 *
 * TypeScript definitions for Trade Republic portfolio data
 */

export interface Portfolio {
  id: string;
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercentage: number;
  positions: Position[];
  cash: CashPosition;
  lastUpdated: number;
}

export interface Position {
  isin: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  asset: Asset;
}

export interface CashPosition {
  currency: string;
  amount: number;
}

export interface Asset {
  isin: string;
  name: string;
  symbol: string;
  type: AssetType;
  currency: string;
  exchange: string;
  sector?: string;
  country?: string;
}

export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond' | 'derivative';

export interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercentage: number;
  totalReturn: number;
  totalReturnPercentage: number;
  positionCount: number;
  lastUpdated: number;
}
