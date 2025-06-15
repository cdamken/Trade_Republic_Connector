/**
 * Trade Republic API Client
 *
 * Main client class for Trade Republic API interactions
 */

import { DEFAULT_CONFIG } from '../config/config';
import { AuthManager } from '../auth/manager';
import { AuthenticationError } from '../types/auth';
import { HttpClient } from './http-client';
import { PortfolioManager } from '../portfolio/manager';
import { TradingManager } from '../trading/manager';
import { logger } from '../utils/logger';
import type { TradeRepublicConfig } from '../config/config';
import type { LoginCredentials, AuthSession, AuthToken, MFAChallenge, MFAResponse } from '../types/auth';
import type { Portfolio } from '../types/portfolio';
import type {
  BuyOrderData,
  SellOrderData,
  OrderResponse,
  OrderHistory,
  OrderHistoryFilters,
  RealTimePrice,
  HistoricalPricesResponse,
  MarketNewsResponse,
  WatchlistResponse,
} from '../types/trading';
import { WebSocketManager } from '../websocket/manager';
import type { WebSocketConfig } from '../websocket/manager';
import type {
  PriceUpdateMessage,
  PortfolioUpdateMessage,
  OrderUpdateMessage,
  ExecutionMessage,
  MarketStatusMessage,
  NewsMessage,
  WatchlistUpdateMessage,
} from '../types/websocket';

export class TradeRepublicClient {
  private config: TradeRepublicConfig;
  private authManager: AuthManager;
  private httpClient: HttpClient;
  private portfolioManager: PortfolioManager;
  private tradingManager: TradingManager;
  private websocketManager?: WebSocketManager;
  private initialized = false;

  constructor(config?: Partial<TradeRepublicConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.authManager = new AuthManager(this.config.credentialsPath);
    this.httpClient = new HttpClient(this.config);
    this.portfolioManager = new PortfolioManager(this.authManager);
    this.tradingManager = new TradingManager(this.authManager);
    this.websocketManager = new WebSocketManager(this.config.websocket, this.authManager);

    // Set up logging level
    logger.setLevel(this.config.logLevel);

    // Add file logging if configured
    if (this.config.logFile) {
      logger.addFileTransport(this.config.logFile);
    }
  }

  /**
   * Get the authentication manager
   */
  public get auth(): AuthManager {
    return this.authManager;
  }

  /**
   * Get the portfolio manager
   */
  public get portfolio(): PortfolioManager {
    return this.portfolioManager;
  }

  /**
   * Get the trading manager
   */
  public get trading(): TradingManager {
    return this.tradingManager;
  }

  /**
   * Get the WebSocket manager
   */
  public get websocket(): WebSocketManager | undefined {
    return this.websocketManager;
  }

  /**
   * Initialize the client connection
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Trade Republic client');

      // Validate configuration
      if (!this.validateConfig()) {
        throw new Error('Invalid configuration');
      }

      // Try to load existing session
      if (this.config.sessionPersistence) {
        await this.authManager.initialize();
        const session = this.authManager.getSession();
        if (session) {
          logger.info('Loaded existing session', { userId: session.userId });
          this.httpClient.setAuthHeader(this.authManager.getAuthHeader());
        }
      }

      this.initialized = true;
      logger.info('Trade Republic client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize client', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Login to Trade Republic
   */
  public async login(credentials: LoginCredentials): Promise<AuthSession> {
    this.ensureInitialized();

    try {
      const session = await this.authManager.login(credentials);

      // Set authentication header for HTTP client
      this.httpClient.setAuthHeader(this.authManager.getAuthHeader());

      logger.info('Login successful', { userId: session.userId });
      return session;
    } catch (error) {
      if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
        logger.info('MFA authentication required');
        throw error;
      }

      logger.error('Login failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Handle MFA challenge
   */
  public async submitMFA(challenge: MFAChallenge, response: MFAResponse): Promise<AuthSession> {
    this.ensureInitialized();

    try {
      const session = await this.authManager.handleMFA(challenge, response);

      // Set authentication header for HTTP client
      this.httpClient.setAuthHeader(this.authManager.getAuthHeader());

      logger.info('MFA authentication successful', { userId: session.userId });
      return session;
    } catch (error) {
      logger.error('MFA authentication failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Logout and cleanup
   */
  public async logout(): Promise<void> {
    this.ensureInitialized();

    try {
      await this.authManager.logout();

      // Clear authentication header
      this.httpClient.setAuthHeader(null);

      logger.info('Logout successful');
    } catch (error) {
      logger.error('Logout failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  public async refreshToken(): Promise<AuthToken> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      const newToken = await this.authManager.refreshToken();

      // Update authentication header
      this.httpClient.setAuthHeader(this.authManager.getAuthHeader());

      logger.debug('Token refreshed successfully');
      return newToken;
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Get portfolio data
   */
  public async getPortfolio(): Promise<Portfolio> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      logger.debug('Fetching portfolio data');

      // TODO: Replace with actual API endpoint
      const portfolioData = await this.httpClient.get<Portfolio>('/api/v1/portfolio');

      logger.info('Portfolio data retrieved successfully');
      return portfolioData;
    } catch (error) {
      logger.error('Failed to fetch portfolio', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  // =================
  // Configuration Methods
  // =================

  /**
   * Get current configuration
   */
  public getConfig(): TradeRepublicConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<TradeRepublicConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update logger level if changed
    if (newConfig.logLevel) {
      logger.setLevel(newConfig.logLevel);
    }

    // Update HTTP client configuration
    this.httpClient = new HttpClient(this.config);

    // Re-initialize auth manager if credentials path changed
    if (newConfig.credentialsPath) {
      this.authManager = new AuthManager(this.config.credentialsPath);
    }
  }

  // =================
  // Authentication Methods
  // =================

  /**
   * Initialize authentication and device pairing
   */
  public async initializeAuth(): Promise<void> {
    this.ensureInitialized();
    return this.authManager.initialize();
  }

  /**
   * Get current authentication session
   */
  public getSession(): AuthSession | undefined {
    return this.authManager.getSession();
  }

  // =================
  // Portfolio Methods
  // =================

  /**
   * Get all portfolio positions
   */
  public async getPortfolioPositions(): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getPositions();
  }

  /**
   * Get portfolio summary and overview
   */
  public async getPortfolioSummary(): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getSummary();
  }

  /**
   * Get specific position by ISIN
   */
  public async getPosition(isin: string): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getPosition(isin);
  }

  /**
   * Get cash position and available funds
   */
  public async getCashPosition(): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getCash();
  }

  /**
   * Get portfolio performance for a given timeframe
   */
  public async getPortfolioPerformance(timeframe?: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getPerformance(timeframe);
  }

  /**
   * Get instrument information by ISIN
   */
  public async getInstrumentInfo(isin: string): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getInstrumentInfo(isin);
  }

  /**
   * Search for instruments by name or symbol
   */
  public async searchInstruments(query: string): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.searchInstruments(query);
  }

  /**
   * Get positions filtered by minimum value
   */
  public async getPositionsByValue(minValue: number = 0): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getPositionsByValue(minValue);
  }

  /**
   * Get positions with positive performance
   */
  public async getWinningPositions(): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getWinningPositions();
  }

  /**
   * Get positions with negative performance
   */
  public async getLosingPositions(): Promise<any> {
    this.ensureInitialized();
    this.ensureAuthenticated();
    return this.portfolioManager.getLosingPositions();
  }

  // =================
  // Trading Methods
  // =================

  /**
   * Place a buy order
   */
  public async placeBuyOrder(orderData: BuyOrderData): Promise<OrderResponse> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.placeBuyOrder(orderData);
    } catch (error) {
      logger.error('Failed to place buy order', {
        error: error instanceof Error ? error.message : error,
        isin: orderData.isin,
      });
      throw error;
    }
  }

  /**
   * Place a sell order
   */
  public async placeSellOrder(orderData: SellOrderData): Promise<OrderResponse> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.placeSellOrder(orderData);
    } catch (error) {
      logger.error('Failed to place sell order', {
        error: error instanceof Error ? error.message : error,
        isin: orderData.isin,
      });
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  public async cancelOrder(orderId: string): Promise<boolean> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.cancelOrder(orderId);
    } catch (error) {
      logger.error('Failed to cancel order', {
        error: error instanceof Error ? error.message : error,
        orderId,
      });
      throw error;
    }
  }

  /**
   * Get order history
   */
  public async getOrderHistory(filters?: OrderHistoryFilters): Promise<OrderHistory[]> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.getOrderHistory(filters);
    } catch (error) {
      logger.error('Failed to get order history', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Get real-time price for instrument
   */
  public async getRealTimePrice(isin: string): Promise<RealTimePrice> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.getRealTimePrice(isin);
    } catch (error) {
      logger.error('Failed to get real-time price', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  /**
   * Get historical price data
   */
  public async getHistoricalPrices(
    isin: string,
    period: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y'
  ): Promise<HistoricalPricesResponse> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.getHistoricalPrices(isin, period);
    } catch (error) {
      logger.error('Failed to get historical prices', {
        error: error instanceof Error ? error.message : error,
        isin,
        period,
      });
      throw error;
    }
  }

  /**
   * Get market news
   */
  public async getMarketNews(isin?: string, limit: number = 20): Promise<MarketNewsResponse> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.getMarketNews(isin, limit);
    } catch (error) {
      logger.error('Failed to get market news', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  /**
   * Get watchlist
   */
  public async getWatchlist(): Promise<WatchlistResponse> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.getWatchlist();
    } catch (error) {
      logger.error('Failed to get watchlist', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Add instrument to watchlist
   */
  public async addToWatchlist(isin: string): Promise<boolean> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.addToWatchlist(isin);
    } catch (error) {
      logger.error('Failed to add to watchlist', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  /**
   * Remove instrument from watchlist
   */
  public async removeFromWatchlist(isin: string): Promise<boolean> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    try {
      // Auto-refresh token if needed
      if (this.config.autoRefreshTokens) {
        await this.ensureValidToken();
      }

      return await this.tradingManager.removeFromWatchlist(isin);
    } catch (error) {
      logger.error('Failed to remove from watchlist', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  // =================
  // WebSocket Methods
  // =================

  /**
   * Initialize WebSocket connection for real-time data
   */
  public async initializeWebSocket(): Promise<void> {
    this.ensureInitialized();
    this.ensureAuthenticated();

    if (!this.websocketManager) {
      logger.error('WebSocket manager not available');
      return;
    }

    if (this.websocketManager.isConnected()) {
      logger.warn('WebSocket already connected');
      return;
    }

    // Set up event listeners
    this.websocketManager.on('connected', () => {
      logger.info('WebSocket connected successfully');
    });

    this.websocketManager.on('disconnected', () => {
      logger.warn('WebSocket disconnected');
    });

    this.websocketManager.on('error', (error) => {
      logger.error('WebSocket error', { error });
    });

    await this.websocketManager.connect();
  }

  /**
   * Subscribe to real-time price updates
   */
  public subscribeToPrices(isin: string, callback: (data: any) => void): string | undefined {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return this.websocketManager.subscribePrices(isin, callback);
  }

  /**
   * Subscribe to portfolio updates
   */
  public subscribeToPortfolio(callback: (data: any) => void): string | undefined {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return this.websocketManager.subscribePortfolio(callback);
  }

  /**
   * Unsubscribe from a WebSocket subscription
   */
  public unsubscribe(subscriptionId: string): void {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized');
      return;
    }

    this.websocketManager.unsubscribe(subscriptionId);
  }

  /**
   * Get WebSocket connection status
   */
  public getWebSocketStatus(): any {
    if (!this.websocketManager) {
      return { connected: false, initialized: false };
    }

    return {
      ...this.websocketManager.getStatus(),
      initialized: true,
    };
  }

  /**
   * Disconnect WebSocket
   */
  public disconnectWebSocket(): void {
    if (this.websocketManager) {
      this.websocketManager.disconnect();
    }
  }

  /**
   * Check if WebSocket is connected
   */
  public isWebSocketConnected(): boolean {
    return this.websocketManager ? this.websocketManager.isConnected() : false;
  }

  // =================
  // Enhanced WebSocket Methods
  // =================

  /**
   * Subscribe to order updates
   */
  public subscribeToOrders(callback: (message: OrderUpdateMessage) => void): string | undefined {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return this.websocketManager.subscribeOrders(callback);
  }

  /**
   * Subscribe to trade executions
   */
  public subscribeToExecutions(callback: (message: ExecutionMessage) => void): string | undefined {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return this.websocketManager.subscribeExecutions(callback);
  }

  /**
   * Subscribe to market status updates
   */
  public subscribeToMarketStatus(venue: string, callback: (message: MarketStatusMessage) => void): string | undefined {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return this.websocketManager.subscribeMarketStatus(venue, callback);
  }

  /**
   * Subscribe to news updates
   */
  public subscribeToNews(callback: (message: NewsMessage) => void, isin?: string): string | undefined {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return this.websocketManager.subscribeNews(callback, isin);
  }

  /**
   * Subscribe to watchlist updates
   */
  public subscribeToWatchlistUpdates(callback: (message: WatchlistUpdateMessage) => void): string | undefined {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return this.websocketManager.subscribeWatchlist(callback);
  }

  /**
   * Bulk subscribe to price updates for multiple instruments
   */
  public subscribeToPricesBulk(isins: string[], callback: (message: PriceUpdateMessage) => void): string[] {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return [];
    }

    return this.websocketManager.subscribePricesBulk(isins, callback);
  }

  /**
   * Unsubscribe from multiple subscriptions
   */
  public unsubscribeMultiple(subscriptionIds: string[]): void {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized');
      return;
    }

    this.websocketManager.unsubscribeMultiple(subscriptionIds);
  }

  /**
   * Get all active WebSocket subscriptions
   */
  public getActiveSubscriptions(): { id: string; channel: string; isin?: string }[] {
    if (!this.websocketManager) {
      return [];
    }

    return this.websocketManager.getActiveSubscriptions();
  }

  // =================
  // Private Methods
  // =================

  /**
   * Validate configuration
   */
  private validateConfig(): boolean {
    if (!this.config.apiUrl || !this.config.websocketUrl) {
      logger.error('Invalid configuration: Missing API URLs');
      return false;
    }

    if (this.config.timeout <= 0) {
      logger.error('Invalid configuration: Invalid timeout value');
      return false;
    }

    if (this.config.rateLimitRequests <= 0 || this.config.rateLimitWindow <= 0) {
      logger.error('Invalid configuration: Invalid rate limiting values');
      return false;
    }

    return true;
  }

  /**
   * Check if currently authenticated
   */
  public isAuthenticated(): boolean {
    const session = this.authManager.getSession();
    return session !== undefined && session !== null && session.token.expiresAt > Date.now();
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Client not initialized. Call initialize() first.');
    }
  }

  /**
   * Ensure client is authenticated
   */
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated()) {
      throw new AuthenticationError('Not authenticated. Please login first.');
    }
  }

  /**
   * Ensure token is valid and refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    const session = this.authManager.getSession();
    if (!session) {
      throw new AuthenticationError('No active session');
    }

    // Check if token expires within 5 minutes
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes
    const willExpireSoon = Date.now() + expirationBuffer >= session.token.expiresAt;

    if (willExpireSoon) {
      logger.debug('Token expires soon, refreshing');
      await this.refreshToken();
    }
  }
}
