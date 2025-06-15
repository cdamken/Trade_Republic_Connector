// 🚀 Main Trade Republic API Client
// The primary interface for all Trade Republic operations

import { TRConfig } from '../config/TRConfig.js';
import { TRAuth } from '../auth/TRAuth.js';
import { TRWebSocket } from '../websocket/TRWebSocket.js';
import { TRPortfolioAPI } from './TRPortfolioAPI.js';
import { TRTradingAPI } from './TRTradingAPI.js';
import { TRMarketDataAPI } from './TRMarketDataAPI.js';
import { TRTimelineAPI } from './TRTimelineAPI.js';
import type { TRClientConfig, TREventEmitter } from '../types/index.js';
import { EventEmitter } from 'node:events';

export class TradeRepublicClient extends EventEmitter implements TREventEmitter {
  public readonly config: TRConfig;
  public readonly auth: TRAuth;
  public readonly ws: TRWebSocket;
  
  // API modules
  public readonly portfolio: TRPortfolioAPI;
  public readonly trading: TRTradingAPI;
  public readonly marketData: TRMarketDataAPI;
  public readonly timeline: TRTimelineAPI;

  private isInitialized = false;

  constructor(config: TRClientConfig) {
    super();
    
    this.config = new TRConfig(config);
    this.auth = new TRAuth(this.config);
    this.ws = new TRWebSocket(this.config, this.auth);
    
    // Initialize API modules
    this.portfolio = new TRPortfolioAPI(this.config, this.auth, this.ws);
    this.trading = new TRTradingAPI(this.config, this.auth, this.ws);
    this.marketData = new TRMarketDataAPI(this.config, this.auth, this.ws);
    this.timeline = new TRTimelineAPI(this.config, this.auth, this.ws);

    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Initialize the client - call this before using any API methods
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🚀 Initializing Trade Republic API client...');

    try {
      // Initialize authentication
      await this.auth.initialize();
      
      // Initialize WebSocket connection
      await this.ws.connect();
      
      this.isInitialized = true;
      this.emit('ready');
      
      console.log('✅ Trade Republic API client ready!');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Pair device with Trade Republic (one-time setup)
   */
  async pair(): Promise<void> {
    await this.auth.pair();
  }

  /**
   * Check if client is ready to use
   */
  isReady(): boolean {
    return this.isInitialized && this.auth.isAuthenticated() && this.ws.isConnected();
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting Trade Republic API client...');
    
    await this.ws.disconnect();
    await this.auth.logout();
    
    this.isInitialized = false;
    this.emit('disconnected', 'Manual disconnect');
    
    console.log('✅ Disconnected successfully');
  }

  /**
   * Get client status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      authenticated: this.auth.isAuthenticated(),
      connected: this.ws.isConnected(),
      ready: this.isReady(),
      config: {
        environment: this.config.environment,
        locale: this.config.locale,
        phoneNumber: this.config.phoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
      },
    };
  }

  /**
   * Refresh authentication if needed
   */
  async refreshAuth(): Promise<void> {
    await this.auth.refreshIfNeeded();
  }

  private setupEventForwarding(): void {
    // Forward WebSocket events
    this.ws.on('connected', () => {
      this.emit('connected');
    });

    this.ws.on('disconnected', (reason: string) => {
      this.emit('disconnected', reason);
    });

    this.ws.on('error', (error: Error) => {
      this.emit('error', error);
    });

    // Forward data events
    this.ws.on('quote', (quote) => {
      this.emit('quote', quote);
    });

    this.ws.on('portfolio', (portfolio) => {
      this.emit('portfolio', portfolio);
    });

    this.ws.on('order', (order) => {
      this.emit('order', order);
    });
  }
}

// ========================
// CONVENIENCE EXPORTS
// ========================

/**
 * Create a Trade Republic client with automatic initialization
 */
export async function createTRClient(config: TRClientConfig): Promise<TradeRepublicClient> {
  const client = new TradeRepublicClient(config);
  await client.initialize();
  return client;
}

/**
 * Create a client from environment variables
 */
export async function createTRClientFromEnv(): Promise<TradeRepublicClient> {
  const config = TRConfig.fromEnv();
  return createTRClient(config);
}
