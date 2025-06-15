import { EventEmitter } from 'events';
import { TRConfig } from '../config/TRConfig.js';
import { TRAuth } from '../auth/TRAuth.js';
import { TRWebSocketManager } from '../websocket/TRWebSocketManager.js';
import { TRPortfolio } from '../portfolio/TRPortfolio.js';
import { TRMarketData } from '../market/TRMarketData.js';
import { TRError, TRConnectionError } from '../errors/index.js';

export interface TRClientOptions {
  phoneNumber: string;
  pin: string;
  locale?: string;
  environment?: 'production' | 'sandbox';
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

/**
 * 🚀 Modern Trade Republic API Client
 * 
 * Simple, secure, and scalable client for Trade Republic API
 * Capable of handling 400+ assets efficiently
 */
export class TradeRepublicClient extends EventEmitter {
  private config: TRConfig;
  private auth: TRAuth;
  private wsManager: TRWebSocketManager;
  
  // Public modules
  public readonly portfolio: TRPortfolio;
  public readonly market: TRMarketData;
  
  private isInitialized = false;
  private isConnected = false;

  constructor(options: TRClientOptions) {
    super();
    
    // Initialize configuration
    this.config = new TRConfig({
      phoneNumber: options.phoneNumber,
      pin: options.pin,
      locale: options.locale || 'de',
      environment: options.environment || 'production',
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts || 5
    });

    // Initialize core modules
    this.auth = new TRAuth(this.config);
    this.wsManager = new TRWebSocketManager(this.config);
    
    // Initialize feature modules
    this.portfolio = new TRPortfolio(this.wsManager);
    this.market = new TRMarketData(this.wsManager);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Auth events
    this.auth.on('authenticated', () => {
      this.emit('authenticated');
    });

    this.auth.on('authError', (error: TRError) => {
      this.emit('authError', error);
    });

    // WebSocket events
    this.wsManager.on('connected', () => {
      this.isConnected = true;
      this.emit('connected');
    });

    this.wsManager.on('disconnected', (info: { code: number; reason: string }) => {
      this.isConnected = false;
      this.emit('disconnected', info);
    });

    this.wsManager.on('error', (error: TRError) => {
      this.emit('error', error);
    });

    // Portfolio events
    this.portfolio.on('initialized', () => {
      this.emit('portfolioReady');
    });

    this.portfolio.on('error', (error: TRError) => {
      this.emit('error', error);
    });

    // Market data events
    this.market.on('error', (error: TRError) => {
      this.emit('error', error);
    });
  }

  /**
   * Initialize the client - handles authentication and connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.emit('initializing');

      // Step 1: Authenticate
      await this.auth.authenticate();
      const sessionToken = await this.auth.getSessionToken();

      // Step 2: Connect WebSocket
      await this.wsManager.connect(sessionToken);

      // Step 3: Initialize portfolio
      await this.portfolio.initialize();

      this.isInitialized = true;
      this.emit('ready');

    } catch (error) {
      const trError = error instanceof TRError 
        ? error 
        : new TRError(
            `Failed to initialize client: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'CLIENT_INIT_ERROR'
          );
      
      this.emit('error', trError);
      throw trError;
    }
  }

  /**
   * Quick setup for new users - handles device pairing
   */
  async pair(): Promise<void> {
    try {
      await this.auth.pair();
      this.emit('paired');
    } catch (error) {
      const trError = error instanceof TRError 
        ? error 
        : new TRError(
            `Failed to pair device: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'PAIR_ERROR'
          );
      
      this.emit('error', trError);
      throw trError;
    }
  }

  /**
   * Check if client is ready to use
   */
  get isReady(): boolean {
    return this.isInitialized && this.isConnected && this.portfolio.isReady;
  }

  /**
   * Get client status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      connected: this.isConnected,
      authenticated: this.auth.isAuthenticated,
      portfolioReady: this.portfolio.isReady,
      subscriptions: this.wsManager.subscriptionCount,
      instrumentCache: this.market.instrumentCount,
      priceSubscriptions: this.market.activePriceSubscriptions
    };
  }

  /**
   * Subscribe to real-time updates for multiple assets (efficient for 400+ assets)
   */
  async subscribeToAssets(isins: string[], exchange = 'LSX'): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    try {
      // Subscribe to price updates for all assets
      await this.market.subscribeToPriceUpdates(isins, exchange);
      
      // Subscribe to instrument data for missing info
      const cachedInstruments = this.market.getCachedInstruments().map(i => i.isin);
      const missingInstruments = isins.filter(isin => !cachedInstruments.includes(isin));
      
      if (missingInstruments.length > 0) {
        await this.market.getInstruments(missingInstruments);
      }

      this.emit('assetsSubscribed', { count: isins.length, exchange });

    } catch (error) {
      throw new TRError(
        `Failed to subscribe to assets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ASSET_SUBSCRIPTION_ERROR'
      );
    }
  }

  /**
   * Get comprehensive data for multiple assets
   */
  async getAssetData(isins: string[], exchange = 'LSX'): Promise<{
    instruments: Map<string, any>;
    prices: Map<string, any>;
  }> {
    if (!this.isReady) {
      await this.initialize();
    }

    try {
      // Get instrument data and prices in parallel
      const [instruments, prices] = await Promise.all([
        this.market.getInstruments(isins),
        this.market.getPrices(isins, exchange)
      ]);

      return { instruments, prices };

    } catch (error) {
      throw new TRError(
        `Failed to get asset data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ASSET_DATA_ERROR'
      );
    }
  }

  /**
   * Search for instruments
   */
  async search(query: string, assetType = 'stock', limit = 20): Promise<any[]> {
    if (!this.isReady) {
      await this.initialize();
    }

    return this.market.search(query, assetType, 1, limit);
  }

  /**
   * Graceful shutdown
   */
  async dispose(): Promise<void> {
    try {
      // Dispose of modules in reverse order
      await this.market.dispose();
      await this.portfolio.dispose();
      await this.wsManager.close();
      
      this.isInitialized = false;
      this.isConnected = false;
      
      this.removeAllListeners();
      this.emit('disposed');

    } catch (error) {
      this.emit('error', new TRError(
        `Error during disposal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DISPOSAL_ERROR'
      ));
    }
  }

  /**
   * Reconnect if disconnected
   */
  async reconnect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const sessionToken = await this.auth.getSessionToken();
      await this.wsManager.connect(sessionToken);
    } catch (error) {
      throw new TRConnectionError(
        `Failed to reconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RECONNECT_ERROR'
      );
    }
  }
}

/**
 * Factory function for creating a new Trade Republic client
 */
export function createTRClient(options: TRClientOptions): TradeRepublicClient {
  return new TradeRepublicClient(options);
}
