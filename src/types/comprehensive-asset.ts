/**
 * Comprehensive Asset Information Types
 * 
 * Complete data structures for all possible asset information
 * @author Carlos Damken <carlos@damken.com>
 */

export interface ComprehensiveAssetInfo {
  // Basic Identification
  isin: string;
  wkn?: string;                    // German security identifier
  symbol: string;
  name: string;
  shortName?: string;
  longName?: string;
  
  // Classification
  type: ExtendedAssetType;
  subType?: string;
  category?: string;
  sector?: string;
  industry?: string;
  
  // Geographic Information
  country: string;
  countryCode?: string;
  region?: string;
  homeExchange: string;
  exchanges: ExchangeInfo[];
  
  // Trading Information
  currency: string;
  tradingCurrency?: string;
  quoteCurrency?: string;
  tickSize?: number;
  lotSize?: number;
  minTradeAmount?: number;
  maxTradeAmount?: number;
  
  // Current Market Data
  currentPrice: number;
  bid?: number;
  ask?: number;
  spread?: number;
  volume?: number;
  volumeWeightedAveragePrice?: number;
  
  // Daily Statistics
  dayOpen?: number;
  dayHigh?: number;
  dayLow?: number;
  dayClose?: number;
  previousClose?: number;
  dayChange?: number;
  dayChangePercentage?: number;
  dayVolume?: number;
  dayTurnover?: number;
  
  // Extended Price Data
  week52High?: number;
  week52Low?: number;
  marketCap?: number;
  sharesOutstanding?: number;
  floatShares?: number;
  averageVolume?: number;
  averageVolume10Day?: number;
  averageVolume30Day?: number;
  
  // Financial Metrics (for stocks)
  peRatio?: number;
  pegRatio?: number;
  priceToBook?: number;
  priceToSales?: number;
  enterpriseValue?: number;
  evToRevenue?: number;
  evToEbitda?: number;
  profitMargin?: number;
  grossMargin?: number;
  operatingMargin?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  
  // Dividend Information
  dividendYield?: number;
  dividendPerShare?: number;
  dividendDate?: Date;
  exDividendDate?: Date;
  paymentDate?: Date;
  dividendFrequency?: 'annual' | 'semi-annual' | 'quarterly' | 'monthly';
  
  // ETF Specific Data
  netAssetValue?: number;
  premiumDiscount?: number;
  aum?: number;                    // Assets Under Management
  expenseRatio?: number;
  distributionYield?: number;
  replicationMethod?: 'physical' | 'synthetic';
  trackingError?: number;
  numberOfHoldings?: number;
  topHoldings?: Holding[];
  
  // Bond Specific Data
  maturityDate?: Date;
  couponRate?: number;
  yieldToMaturity?: number;
  currentYield?: number;
  duration?: number;
  modifiedDuration?: number;
  convexity?: number;
  creditRating?: string;
  creditRatingAgency?: string;
  
  // Crypto Specific Data
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  
  // Risk Metrics
  beta?: number;
  volatility?: number;
  volatility30Day?: number;
  volatility90Day?: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  maxDrawdown?: number;
  var95?: number;                  // Value at Risk
  
  // Trading Status
  tradingStatus: TradingStatus;
  isHalted?: boolean;
  haltReason?: string;
  isDelisted?: boolean;
  delistingDate?: Date;
  
  // Corporate Actions
  lastSplit?: StockSplit;
  upcomingSplits?: StockSplit[];
  lastSpinoff?: Spinoff;
  upcomingSpinoffs?: Spinoff[];
  
  // Analyst Information
  analystRating?: AnalystRating;
  priceTarget?: number;
  priceTargetHigh?: number;
  priceTargetLow?: number;
  priceTargetMean?: number;
  recommendationTrend?: RecommendationTrend;
  
  // News and Events
  latestNews?: NewsItem[];
  upcomingEvents?: CorporateEvent[];
  earningsDate?: Date;
  nextEarningsDate?: Date;
  
  // Technical Indicators
  sma20?: number;                  // Simple Moving Average 20 days
  sma50?: number;
  sma200?: number;
  ema12?: number;                  // Exponential Moving Average
  ema26?: number;
  rsi?: number;                    // Relative Strength Index
  macd?: MacdData;
  bollingerBands?: BollingerBands;
  
  // Options Data (if available)
  hasOptions?: boolean;
  impliedVolatility?: number;
  openInterest?: number;
  
  // ESG Data
  esgScore?: number;
  environmentScore?: number;
  socialScore?: number;
  governanceScore?: number;
  controversyLevel?: number;
  
  // Trade Republic Specific
  tradeRepublicTradable?: boolean;
  tradeRepublicFractional?: boolean;
  tradeRepublicSavingsPlan?: boolean;
  tradeRepublicTags?: string[];
  
  // Metadata
  lastUpdated: Date;
  dataProviders: string[];
  updateFrequency?: string;
  reliability?: number;            // Data reliability score 0-1
}

export type ExtendedAssetType = 
  | 'stock' 
  | 'etf' 
  | 'crypto' 
  | 'bond' 
  | 'government_bond'
  | 'corporate_bond'
  | 'commodity'
  | 'derivative'
  | 'warrant'
  | 'certificate'
  | 'fund'
  | 'reit'
  | 'adr'        // American Depositary Receipt
  | 'gdr'        // Global Depositary Receipt
  | 'preferred_stock'
  | 'rights'
  | 'units';

export interface ExchangeInfo {
  exchangeCode: string;
  exchangeName: string;
  country: string;
  timezone: string;
  tradingHours: TradingHours;
  currency: string;
  isPrimary: boolean;
}

export interface TradingHours {
  openTime: string;    // "09:00"
  closeTime: string;   // "17:30"
  timezone: string;
  breaks?: Array<{
    startTime: string;
    endTime: string;
  }>;
}

export type TradingStatus = 
  | 'trading'
  | 'closed'
  | 'pre_market'
  | 'after_hours'
  | 'halted'
  | 'suspended'
  | 'delisted';

export interface Holding {
  name: string;
  symbol?: string;
  isin?: string;
  weight: number;      // Percentage
  shares?: number;
  value?: number;
}

export interface StockSplit {
  date: Date;
  ratio: string;       // "2:1", "3:2", etc.
  fromFactor: number;
  toFactor: number;
}

export interface Spinoff {
  date: Date;
  spunOffCompany: string;
  spunOffSymbol: string;
  ratio: string;
}

export interface AnalystRating {
  rating: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  numberOfAnalysts: number;
  lastUpdated: Date;
}

export interface RecommendationTrend {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  period: '1m' | '2m' | '3m';
}

export interface NewsItem {
  headline: string;
  summary?: string;
  url?: string;
  source: string;
  publishedAt: Date;
  sentiment?: 'positive' | 'neutral' | 'negative';
  relevanceScore?: number;
}

export interface CorporateEvent {
  type: 'earnings' | 'dividend' | 'split' | 'spinoff' | 'merger' | 'acquisition';
  date: Date;
  description: string;
  expectedImpact?: 'high' | 'medium' | 'low';
}

export interface MacdData {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;    // SMA
  lower: number;
  bandwidth: number;
  percentB: number;
}

// Historical data with all possible fields
export interface ComprehensiveHistoricalData {
  isin: string;
  interval: TimeInterval;
  data: ComprehensiveOHLCData[];
  splits?: StockSplit[];
  dividends?: DividendEvent[];
  currency: string;
  timezone: string;
  lastUpdated: Date;
}

export interface ComprehensiveOHLCData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  adjustedClose?: number;
  vwap?: number;           // Volume Weighted Average Price
  turnover?: number;
  trades?: number;         // Number of trades
  
  // Technical indicators for the period
  sma?: Record<number, number>;  // SMA for different periods
  ema?: Record<number, number>;  // EMA for different periods
  rsi?: number;
  macd?: MacdData;
  bollingerBands?: BollingerBands;
}

export interface DividendEvent {
  date: Date;
  amount: number;
  currency: string;
  type: 'regular' | 'special' | 'interim';
}

export type TimeInterval = 
  | '1min' | '5min' | '15min' | '30min' 
  | '1hour' | '4hour' 
  | '1day' | '1week' | '1month'
  | 'quarterly' | 'yearly';

// Database schema for asset storage
export interface AssetDatabaseRecord extends ComprehensiveAssetInfo {
  id: string;                    // UUID
  createdAt: Date;
  updatedAt: Date;
  version: number;
  checksum?: string;             // For data integrity
  source: string;                // Data source identifier
  historicalData?: ComprehensiveHistoricalData[];
}

// Search and filtering interfaces
export interface AssetSearchQuery {
  query?: string;
  type?: ExtendedAssetType[];
  country?: string[];
  exchange?: string[];
  currency?: string[];
  sector?: string[];
  marketCapMin?: number;
  marketCapMax?: number;
  priceMin?: number;
  priceMax?: number;
  volumeMin?: number;
  tradableOnTR?: boolean;
  hasOptions?: boolean;
  hasDividends?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: AssetSortField;
  sortOrder?: 'asc' | 'desc';
}

export type AssetSortField = 
  | 'name' | 'symbol' | 'price' | 'marketCap' | 'volume' 
  | 'dayChange' | 'dayChangePercentage' | 'peRatio' | 'dividendYield'
  | 'lastUpdated';

export interface AssetSearchResult {
  assets: ComprehensiveAssetInfo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchTime: number;  // milliseconds
}
