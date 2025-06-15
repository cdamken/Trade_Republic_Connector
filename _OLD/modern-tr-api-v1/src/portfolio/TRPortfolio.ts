import { EventEmitter } from 'events';
import { TRWebSocketManager } from '../websocket/TRWebSocketManager.js';
import { TRError } from '../errors/index.js';

// Type definitions for portfolio data
export interface Position {
  instrumentId: string; // ISIN
  name?: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  exchange?: string;
  exchangeIds?: string[];
  currency: string;
  lastUpdated?: Date;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPercent: number;
  availableCash: number;
  currency: string;
  positionCount: number;
  lastUpdated: Date;
}

export interface CashPosition {
  amount: number;
  currency: string;
  availableForPayout: number;
  availableForInvestment: number;
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

export class TRPortfolio extends EventEmitter {
  private wsManager: TRWebSocketManager;
  private positions: Map<string, Position> = new Map();
  private cash: CashPosition | null = null;
  private summary: PortfolioSummary | null = null;
  private subscriptions: Set<string> = new Set();
  private isInitialized = false;

  constructor(wsManager: TRWebSocketManager) {
    super();
    this.wsManager = wsManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for portfolio updates
    this.wsManager.on('compactPortfolio', (data: any) => {
      this.handlePortfolioUpdate(data);
    });

    this.wsManager.on('portfolio', (data: any) => {
      this.handlePortfolioUpdate(data);
    });

    this.wsManager.on('cash', (data: any) => {
      this.handleCashUpdate(data);
    });

    this.wsManager.on('ticker', (data: any) => {
      this.handleTickerUpdate(data);
    });

    this.wsManager.on('instrument', (data: any) => {
      this.handleInstrumentUpdate(data);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Subscribe to portfolio and cash data
      const portfolioSub = await this.wsManager.subscribePortfolio();
      const cashSub = await this.wsManager.subscribeCash();

      this.subscriptions.add(portfolioSub);
      this.subscriptions.add(cashSub);

      // Wait for initial data
      await this.waitForInitialData();

      this.isInitialized = true;
      this.emit('initialized');

    } catch (error) {
      throw new TRError(
        `Failed to initialize portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PORTFOLIO_INIT_ERROR'
      );
    }
  }

  private async waitForInitialData(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TRError('Portfolio initialization timeout', 'INIT_TIMEOUT'));
      }, 10000);

      const checkData = () => {
        if (this.positions.size > 0 && this.cash) {
          clearTimeout(timeout);
          resolve();
        }
      };

      this.once('portfolioUpdated', checkData);
      this.once('cashUpdated', checkData);
    });
  }

  private handlePortfolioUpdate(data: any): void {
    try {
      if (data.positions && Array.isArray(data.positions)) {
        // Clear existing positions
        this.positions.clear();

        // Process each position
        for (const pos of data.positions) {
          const position: Position = {
            instrumentId: pos.instrumentId,
            quantity: pos.netSize || pos.quantity || 0,
            averagePrice: pos.averagePrice || 0,
            marketValue: pos.netValue || pos.marketValue || 0,
            unrealizedPnL: pos.unrealizedPnL || 0,
            unrealizedPnLPercent: pos.unrealizedPnLPercent || 0,
            currency: pos.currency || 'EUR',
            lastUpdated: new Date(),
            name: pos.name,
            exchange: pos.exchange,
            exchangeIds: pos.exchangeIds
          };

          this.positions.set(position.instrumentId, position);
        }

        this.updateSummary();
        this.emit('portfolioUpdated', this.getPositions());
        this.subscribeToPositionUpdates();
      }
    } catch (error) {
      this.emit('error', new TRError(
        `Failed to process portfolio update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PORTFOLIO_UPDATE_ERROR'
      ));
    }
  }

  private handleCashUpdate(data: any): void {
    try {
      this.cash = {
        amount: data.amount || 0,
        currency: data.currency || 'EUR',
        availableForPayout: data.availableForPayout || 0,
        availableForInvestment: data.availableForInvestment || data.amount || 0
      };

      this.updateSummary();
      this.emit('cashUpdated', this.cash);
    } catch (error) {
      this.emit('error', new TRError(
        `Failed to process cash update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CASH_UPDATE_ERROR'
      ));
    }
  }

  private handleTickerUpdate(data: any): void {
    try {
      // Extract ISIN from ticker ID (format: ISIN.EXCHANGE)
      const tickerId = data.id || '';
      const isin = tickerId.split('.')[0];
      
      if (!isin) return;

      const position = this.positions.get(isin);
      if (position && data.last) {
        position.currentPrice = data.last.price;
        position.marketValue = position.quantity * data.last.price;
        position.unrealizedPnL = position.marketValue - (position.quantity * position.averagePrice);
        position.unrealizedPnLPercent = position.averagePrice > 0 
          ? (position.unrealizedPnL / (position.quantity * position.averagePrice)) * 100 
          : 0;
        position.lastUpdated = new Date();

        this.positions.set(isin, position);
        this.updateSummary();
        this.emit('positionUpdated', position);
      }
    } catch (error) {
      this.emit('error', new TRError(
        `Failed to process ticker update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TICKER_UPDATE_ERROR'
      ));
    }
  }

  private handleInstrumentUpdate(data: any): void {
    try {
      if (data.isin && data.shortName) {
        const position = this.positions.get(data.isin);
        if (position) {
          position.name = data.shortName;
          position.exchangeIds = data.exchangeIds;
          this.positions.set(data.isin, position);
          this.emit('positionUpdated', position);
        }
      }
    } catch (error) {
      this.emit('error', new TRError(
        `Failed to process instrument update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INSTRUMENT_UPDATE_ERROR'
      ));
    }
  }

  private async subscribeToPositionUpdates(): Promise<void> {
    // Subscribe to real-time price updates for all positions
    // Batch subscriptions for efficiency
    const tickerSubscriptions: Promise<string>[] = [];
    const instrumentSubscriptions: Promise<string>[] = [];

    for (const position of this.positions.values()) {
      // Subscribe to ticker for real-time price
      const exchange = position.exchange || 'LSX';
      tickerSubscriptions.push(
        this.wsManager.subscribeTicker(position.instrumentId, exchange)
      );

      // Subscribe to instrument details if name is missing
      if (!position.name) {
        instrumentSubscriptions.push(
          this.wsManager.subscribeInstrument(position.instrumentId)
        );
      }
    }

    try {
      // Wait for all subscriptions to complete
      const tickerSubs = await Promise.all(tickerSubscriptions);
      const instrumentSubs = await Promise.all(instrumentSubscriptions);

      // Track subscriptions for cleanup
      tickerSubs.forEach(sub => this.subscriptions.add(sub));
      instrumentSubs.forEach(sub => this.subscriptions.add(sub));

    } catch (error) {
      this.emit('error', new TRError(
        `Failed to subscribe to position updates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SUBSCRIPTION_ERROR'
      ));
    }
  }

  private updateSummary(): void {
    if (!this.cash) return;

    let totalValue = this.cash.amount;
    let totalInvested = 0;
    let totalPnL = 0;

    for (const position of this.positions.values()) {
      totalValue += position.marketValue;
      totalInvested += position.quantity * position.averagePrice;
      totalPnL += position.unrealizedPnL;
    }

    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    this.summary = {
      totalValue,
      totalInvested,
      totalPnL,
      totalPnLPercent,
      availableCash: this.cash.amount,
      currency: this.cash.currency,
      positionCount: this.positions.size,
      lastUpdated: new Date()
    };

    this.emit('summaryUpdated', this.summary);
  }

  // Public API methods

  async getPositions(): Promise<Position[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return Array.from(this.positions.values());
  }

  async getPosition(isin: string): Promise<Position | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.positions.get(isin) || null;
  }

  async getSummary(): Promise<PortfolioSummary | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.summary;
  }

  async getCash(): Promise<CashPosition | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.cash;
  }

  async getPerformance(timeframe: PortfolioPerformance['timeframe'] = '1M'): Promise<PortfolioPerformance> {
    // This would require a separate subscription to performance data
    // For now, return a basic structure
    return {
      timeframe,
      absoluteChange: this.summary?.totalPnL || 0,
      percentChange: this.summary?.totalPnLPercent || 0,
      data: []
    };
  }

  // Filter and search methods
  async getPositionsByValue(minValue: number = 0): Promise<Position[]> {
    const positions = await this.getPositions();
    return positions.filter(pos => pos.marketValue >= minValue);
  }

  async getWinningPositions(): Promise<Position[]> {
    const positions = await this.getPositions();
    return positions.filter(pos => pos.unrealizedPnL > 0);
  }

  async getLosingPositions(): Promise<Position[]> {
    const positions = await this.getPositions();
    return positions.filter(pos => pos.unrealizedPnL < 0);
  }

  async searchPositions(query: string): Promise<Position[]> {
    const positions = await this.getPositions();
    const lowerQuery = query.toLowerCase();
    
    return positions.filter(pos => 
      pos.instrumentId.toLowerCase().includes(lowerQuery) ||
      (pos.name && pos.name.toLowerCase().includes(lowerQuery))
    );
  }

  // Cleanup
  async dispose(): Promise<void> {
    // Unsubscribe from all WebSocket subscriptions
    for (const subscriptionId of this.subscriptions) {
      await this.wsManager.unsubscribe(subscriptionId);
    }

    this.subscriptions.clear();
    this.positions.clear();
    this.cash = null;
    this.summary = null;
    this.isInitialized = false;
    this.removeAllListeners();
  }

  // Utility methods
  get isReady(): boolean {
    return this.isInitialized;
  }

  get positionCount(): number {
    return this.positions.size;
  }

  getTotalValue(): number {
    return this.summary?.totalValue || 0;
  }

  getTotalPnL(): number {
    return this.summary?.totalPnL || 0;
  }
}
