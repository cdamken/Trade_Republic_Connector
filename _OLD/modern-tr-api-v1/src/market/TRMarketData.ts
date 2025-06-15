import { EventEmitter } from 'events';
import { TRWebSocketManager } from '../websocket/TRWebSocketManager.js';
import { TRError } from '../errors/index.js';

// Type definitions for market data
export interface InstrumentInfo {
  isin: string;
  name: string;
  shortName: string;
  symbol?: string;
  type: 'stock' | 'etf' | 'crypto' | 'derivative' | 'bond';
  currency: string;
  exchange: string;
  exchangeIds: string[];
  country?: string;
  sector?: string;
  tags?: string[];
  lastUpdated: Date;
}

export interface PriceData {
  isin: string;
  price: number;
  currency: string;
  exchange: string;
  timestamp: Date;
  change?: number;
  changePercent?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  spread?: number;
}

export interface HistoricalData {
  isin: string;
  timeframe: string;
  resolution: number;
  data: Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
}

export interface NewsItem {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  source: string;
  timestamp: Date;
  relatedISINs: string[];
  url?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface SearchResult {
  isin: string;
  name: string;
  symbol?: string;
  type: string;
  exchange: string;
  currency: string;
  relevanceScore: number;
}

export class TRMarketData extends EventEmitter {
  private wsManager: TRWebSocketManager;
  private instruments: Map<string, InstrumentInfo> = new Map();
  private prices: Map<string, PriceData> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // isin -> subscription IDs
  private priceSubscriptions: Set<string> = new Set();

  constructor(wsManager: TRWebSocketManager) {
    super();
    this.wsManager = wsManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.wsManager.on('instrument', (data: any) => {
      this.handleInstrumentData(data);
    });

    this.wsManager.on('ticker', (data: any) => {
      this.handleTickerData(data);
    });

    this.wsManager.on('neonNews', (data: any) => {
      this.handleNewsData(data);
    });

    this.wsManager.on('aggregateHistoryLight', (data: any) => {
      this.handleHistoricalData(data);
    });
  }

  // Get instrument information
  async getInstrument(isin: string, forceRefresh = false): Promise<InstrumentInfo | null> {
    // Check cache first
    if (!forceRefresh && this.instruments.has(isin)) {
      return this.instruments.get(isin)!;
    }

    try {
      // Subscribe to instrument data
      const subscriptionId = await this.wsManager.subscribeInstrument(isin);
      
      // Add to subscriptions tracking
      if (!this.subscriptions.has(isin)) {
        this.subscriptions.set(isin, new Set());
      }
      this.subscriptions.get(isin)!.add(subscriptionId);

      // Wait for data or timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TRError(`Timeout getting instrument data for ${isin}`, 'INSTRUMENT_TIMEOUT'));
        }, 5000);

        const handler = (data: InstrumentInfo) => {
          if (data.isin === isin) {
            clearTimeout(timeout);
            this.off('instrumentUpdated', handler);
            resolve(data);
          }
        };

        this.on('instrumentUpdated', handler);
      });

    } catch (error) {
      throw new TRError(
        `Failed to get instrument ${isin}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INSTRUMENT_ERROR'
      );
    }
  }

  // Get multiple instruments efficiently (batch)
  async getInstruments(isins: string[]): Promise<Map<string, InstrumentInfo>> {
    const results = new Map<string, InstrumentInfo>();
    const toFetch: string[] = [];

    // Check cache first
    for (const isin of isins) {
      const cached = this.instruments.get(isin);
      if (cached) {
        results.set(isin, cached);
      } else {
        toFetch.push(isin);
      }
    }

    if (toFetch.length === 0) {
      return results;
    }

    try {
      // Batch subscribe to missing instruments
      const subscriptionPromises = toFetch.map(isin => 
        this.wsManager.subscribeInstrument(isin)
      );

      const subscriptionIds = await Promise.all(subscriptionPromises);

      // Track subscriptions
      toFetch.forEach((isin, index) => {
        const subscriptionId = subscriptionIds[index];
        if (subscriptionId) {
          if (!this.subscriptions.has(isin)) {
            this.subscriptions.set(isin, new Set());
          }
          this.subscriptions.get(isin)!.add(subscriptionId);
        }
      });

      // Wait for all data with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TRError(`Timeout getting instruments data`, 'INSTRUMENTS_TIMEOUT'));
        }, 10000);

        let received = 0;
        const target = toFetch.length;

        const handler = (data: InstrumentInfo) => {
          if (toFetch.includes(data.isin)) {
            results.set(data.isin, data);
            received++;

            if (received === target) {
              clearTimeout(timeout);
              this.off('instrumentUpdated', handler);
              resolve(results);
            }
          }
        };

        this.on('instrumentUpdated', handler);
      });

    } catch (error) {
      throw new TRError(
        `Failed to get instruments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INSTRUMENTS_ERROR'
      );
    }
  }

  // Get real-time price data
  async getPrice(isin: string, exchange = 'LSX'): Promise<PriceData | null> {
    const priceKey = `${isin}.${exchange}`;
    
    // Check cache first
    if (this.prices.has(priceKey)) {
      return this.prices.get(priceKey)!;
    }

    try {
      // Subscribe to ticker
      const subscriptionId = await this.wsManager.subscribeTicker(isin, exchange);
      this.priceSubscriptions.add(subscriptionId);

      // Wait for data
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TRError(`Timeout getting price for ${isin}`, 'PRICE_TIMEOUT'));
        }, 5000);

        const handler = (data: PriceData) => {
          if (data.isin === isin && data.exchange === exchange) {
            clearTimeout(timeout);
            this.off('priceUpdated', handler);
            resolve(data);
          }
        };

        this.on('priceUpdated', handler);
      });

    } catch (error) {
      throw new TRError(
        `Failed to get price for ${isin}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PRICE_ERROR'
      );
    }
  }

  // Get prices for multiple instruments (efficient for 400+ assets)
  async getPrices(isins: string[], exchange = 'LSX'): Promise<Map<string, PriceData>> {
    const results = new Map<string, PriceData>();
    const toFetch: string[] = [];

    // Check cache first
    for (const isin of isins) {
      const priceKey = `${isin}.${exchange}`;
      const cached = this.prices.get(priceKey);
      if (cached) {
        results.set(isin, cached);
      } else {
        toFetch.push(isin);
      }
    }

    if (toFetch.length === 0) {
      return results;
    }

    try {
      // Batch subscribe to tickers
      const subscriptionPromises = toFetch.map(isin => 
        this.wsManager.subscribeTicker(isin, exchange)
      );

      const subscriptionIds = await Promise.all(subscriptionPromises);
      subscriptionIds.forEach(id => this.priceSubscriptions.add(id));

      // Wait for all prices with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Return partial results on timeout
          resolve(results);
        }, 10000);

        let received = 0;
        const target = toFetch.length;

        const handler = (data: PriceData) => {
          if (toFetch.includes(data.isin) && data.exchange === exchange) {
            results.set(data.isin, data);
            received++;

            if (received === target) {
              clearTimeout(timeout);
              this.off('priceUpdated', handler);
              resolve(results);
            }
          }
        };

        this.on('priceUpdated', handler);
      });

    } catch (error) {
      throw new TRError(
        `Failed to get prices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PRICES_ERROR'
      );
    }
  }

  // Subscribe to real-time price updates
  async subscribeToPriceUpdates(isins: string[], exchange = 'LSX'): Promise<void> {
    try {
      for (const isin of isins) {
        const subscriptionId = await this.wsManager.subscribeTicker(isin, exchange);
        this.priceSubscriptions.add(subscriptionId);
      }
      
      this.emit('priceSubscriptionsUpdated', isins.length);
    } catch (error) {
      throw new TRError(
        `Failed to subscribe to price updates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PRICE_SUBSCRIPTION_ERROR'
      );
    }
  }

  // Get historical data
  async getHistoricalData(
    isin: string, 
    timeframe = 'max', 
    resolution = 604800000, // 1 week in ms
    exchange = 'LSX'
  ): Promise<HistoricalData> {
    try {
      // Subscribe to historical data
      const subscriptionId = await this.wsManager.subscribe('aggregateHistoryLight', {
        id: `${isin}.${exchange}`,
        range: timeframe,
        resolution
      });

      // Wait for data
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TRError(`Timeout getting historical data for ${isin}`, 'HISTORICAL_TIMEOUT'));
        }, 10000);

        const handler = (data: any) => {
          if (data.id?.startsWith(isin)) {
            clearTimeout(timeout);
            this.off('aggregateHistoryLight', handler);
            
            const historicalData: HistoricalData = {
              isin,
              timeframe,
              resolution,
              data: data.aggregates?.map((point: any) => ({
                timestamp: new Date(point.time),
                open: point.open,
                high: point.high,
                low: point.low,
                close: point.close,
                volume: point.volume
              })) || []
            };

            resolve(historicalData);
          }
        };

        this.wsManager.on('aggregateHistoryLight', handler);
      });

    } catch (error) {
      throw new TRError(
        `Failed to get historical data for ${isin}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HISTORICAL_ERROR'
      );
    }
  }

  // Search for instruments
  async search(
    query: string,
    assetType = 'stock',
    page = 1,
    pageSize = 20
  ): Promise<SearchResult[]> {
    try {
      // Subscribe to search
      const subscriptionId = await this.wsManager.subscribe('neonSearch', {
        data: {
          q: query,
          assetType,
          page,
          pageSize,
          filter: [{ key: 'type', value: assetType }]
        }
      });

      // Wait for results
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TRError(`Search timeout for query: ${query}`, 'SEARCH_TIMEOUT'));
        }, 5000);

        const handler = (data: any) => {
          clearTimeout(timeout);
          this.wsManager.off('neonSearch', handler);
          
          const results: SearchResult[] = data.results?.map((item: any) => ({
            isin: item.isin,
            name: item.name,
            symbol: item.symbol,
            type: item.type,
            exchange: item.exchangeId,
            currency: item.currency,
            relevanceScore: item.score || 0
          })) || [];

          resolve(results);
        };

        this.wsManager.on('neonSearch', handler);
      });

    } catch (error) {
      throw new TRError(
        `Search failed for query ${query}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_ERROR'
      );
    }
  }

  // Get news for an instrument
  async getNews(isin: string, limit = 20): Promise<NewsItem[]> {
    try {
      const subscriptionId = await this.wsManager.subscribeNews(isin);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TRError(`News timeout for ${isin}`, 'NEWS_TIMEOUT'));
        }, 5000);

        const handler = (data: any) => {
          if (data.isin === isin) {
            clearTimeout(timeout);
            this.off('newsUpdated', handler);
            
            const news: NewsItem[] = data.news?.slice(0, limit).map((item: any) => ({
              id: item.id,
              title: item.title,
              content: item.content,
              summary: item.summary,
              source: item.source,
              timestamp: new Date(item.timestamp),
              relatedISINs: [isin],
              url: item.url,
              sentiment: item.sentiment
            })) || [];

            resolve(news);
          }
        };

        this.on('newsUpdated', handler);
      });

    } catch (error) {
      throw new TRError(
        `Failed to get news for ${isin}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NEWS_ERROR'
      );
    }
  }

  // Event handlers
  private handleInstrumentData(data: any): void {
    try {
      if (!data.isin) return;

      const instrument: InstrumentInfo = {
        isin: data.isin,
        name: data.name || data.shortName,
        shortName: data.shortName,
        symbol: data.homeSymbol,
        type: this.mapInstrumentType(data.typeId),
        currency: data.currency,
        exchange: data.exchangeIds?.[0] || 'LSX',
        exchangeIds: data.exchangeIds || [],
        country: data.country,
        sector: data.sector,
        tags: data.tags,
        lastUpdated: new Date()
      };

      this.instruments.set(data.isin, instrument);
      this.emit('instrumentUpdated', instrument);

    } catch (error) {
      this.emit('error', new TRError(
        `Failed to process instrument data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INSTRUMENT_PROCESS_ERROR'
      ));
    }
  }

  private handleTickerData(data: any): void {
    try {
      if (!data.id || !data.last) return;

      const [isin, exchange] = data.id.split('.');
      if (!isin) return;

      const spreadValue = data.bid && data.ask ? data.ask.price - data.bid.price : undefined;
      
      const price: PriceData = {
        isin,
        price: data.last.price,
        currency: data.last.currency || 'EUR',
        exchange: exchange || 'LSX',
        timestamp: new Date(data.last.time),
        change: data.last.change,
        changePercent: data.last.changePercent,
        volume: data.last.volume,
        bid: data.bid?.price,
        ask: data.ask?.price,
        ...(spreadValue !== undefined && { spread: spreadValue })
      };

      const priceKey = `${isin}.${exchange}`;
      this.prices.set(priceKey, price);
      this.emit('priceUpdated', price);

    } catch (error) {
      this.emit('error', new TRError(
        `Failed to process ticker data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TICKER_PROCESS_ERROR'
      ));
    }
  }

  private handleNewsData(data: any): void {
    try {
      if (data.news && Array.isArray(data.news)) {
        const news: NewsItem[] = data.news.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          summary: item.summary,
          source: item.source,
          timestamp: new Date(item.timestamp),
          relatedISINs: data.isin ? [data.isin] : [],
          url: item.url,
          sentiment: item.sentiment
        }));

        this.emit('newsUpdated', { isin: data.isin, news });
      }
    } catch (error) {
      this.emit('error', new TRError(
        `Failed to process news data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NEWS_PROCESS_ERROR'
      ));
    }
  }

  private handleHistoricalData(data: any): void {
    this.emit('historicalData', data);
  }

  private mapInstrumentType(typeId: string): InstrumentInfo['type'] {
    const typeMap: Record<string, InstrumentInfo['type']> = {
      'stock': 'stock',
      'etf': 'etf',
      'crypto': 'crypto',
      'derivative': 'derivative',
      'bond': 'bond'
    };
    return typeMap[typeId] || 'stock';
  }

  // Cleanup methods
  async unsubscribeFromInstrument(isin: string): Promise<void> {
    const subscriptions = this.subscriptions.get(isin);
    if (subscriptions) {
      for (const subscriptionId of subscriptions) {
        await this.wsManager.unsubscribe(subscriptionId);
      }
      this.subscriptions.delete(isin);
    }
  }

  async dispose(): Promise<void> {
    // Unsubscribe from all instruments
    for (const [isin] of this.subscriptions) {
      await this.unsubscribeFromInstrument(isin);
    }

    // Unsubscribe from all price subscriptions
    for (const subscriptionId of this.priceSubscriptions) {
      await this.wsManager.unsubscribe(subscriptionId);
    }

    this.instruments.clear();
    this.prices.clear();
    this.subscriptions.clear();
    this.priceSubscriptions.clear();
    this.removeAllListeners();
  }

  // Utility methods
  get instrumentCount(): number {
    return this.instruments.size;
  }

  get activePriceSubscriptions(): number {
    return this.priceSubscriptions.size;
  }

  getCachedInstruments(): InstrumentInfo[] {
    return Array.from(this.instruments.values());
  }

  getCachedPrices(): PriceData[] {
    return Array.from(this.prices.values());
  }
}
