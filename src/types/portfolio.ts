/**
 * Portfolio Types
 *
 * TypeScript definitions for Trade Republic portfolio data
 * @author Carlos Damken <carlos@damken.com>
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
  instrumentId: string; // ISIN - primary identifier
  isin?: string; // Alias for instrumentId
  name?: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  marketValue: number; // Current market value
  totalValue?: number; // Alias for marketValue
  totalCost?: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage?: number;
  unrealizedPnLPercent?: number; // Alias for unrealizedPnLPercentage
  exchange?: string;
  exchangeIds?: string[];
  currency: string;
  lastUpdated?: Date;
  asset?: Asset;
}

export interface CashPosition {
  currency: string;
  amount: number;
  availableForPayout?: number;
  availableForInvestment?: number;
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
  totalInvested: number;
  totalPnL: number;
  totalPnLPercent: number;
  availableCash: number;
  currency: string;
  positionCount: number;
  lastUpdated: Date;
  dayChange?: number;
  dayChangePercentage?: number;
  totalReturn?: number;
  totalReturnPercentage?: number;
}

export interface PortfolioPerformance {
  timeframe: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
  absoluteChange: number;
  percentChange: number;
  data: Array<{
    timestamp: Date;
    value: number;
  }>;
}
