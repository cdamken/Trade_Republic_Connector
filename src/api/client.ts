/**
 * Trade Republic API Client
 *
 * Main client class for Trade Republic API interactions
 */

import { DEFAULT_CONFIG } from '../config/config';
import { AuthManager } from '../auth/manager';
import { AuthenticationError } from '../types/auth';
import { HttpClient } from './http-client';
import { logger } from '../utils/logger';
import type { TradeRepublicConfig } from '../config/config';
import type { LoginCredentials, AuthSession, AuthToken, MFAChallenge, MFAResponse } from '../types/auth';
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
import { TradeRepublicWebSocket } from '../websocket/tr-websocket';
import type { TRWebSocketConfig } from '../websocket/tr-websocket';
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
  private websocketManager?: TradeRepublicWebSocket;
  private initialized = false;

  constructor(config?: Partial<TradeRepublicConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.authManager = new AuthManager(this.config.credentialsPath);
    this.httpClient = new HttpClient(this.config);
    // TODO: Implement these managers
    // this.portfolioManager = new PortfolioManager(this.authManager);
    // this.tradingManager = new TradingManager(this.authManager);
    this.websocketManager = new TradeRepublicWebSocket(this.config.websocket, this.authManager);

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
  public get websocket(): TradeRepublicWebSocket | undefined {
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

  /**
   * Ensure valid session with automatic re-authentication prompts
   */
  public async ensureValidSession(): Promise<AuthSession> {
    this.ensureInitialized();

    try {
      // Use the auth manager's session validation
      return await this.authManager.ensureValidSession();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.warn('Session validation failed', { 
          code: error.code, 
          message: error.message 
        });

        // For specific error codes, provide clear guidance to user
        switch (error.code) {
          case 'SESSION_EXPIRED':
            throw new AuthenticationError(
              'Your session has expired. Please log in again using the CLI or your application.',
              'SESSION_EXPIRED'
            );

          case 'SERVER_UNREACHABLE':
            throw new AuthenticationError(
              'Cannot reach Trade Republic servers. Please check your internet connection and try again.',
              'SERVER_UNREACHABLE'
            );

          case 'DEVICE_NOT_PAIRED':
            throw new AuthenticationError(
              'Device pairing has been lost. Please complete device pairing again using the CLI.',
              'DEVICE_NOT_PAIRED'
            );

          default:
            throw error;
        }
      }
      throw error;
    }
  }

  /**
   * Force re-authentication with 2FA handling
   */
  public async forceReAuthentication(credentials: LoginCredentials): Promise<{
    session?: AuthSession;
    requiresMFA?: boolean;
    challenge?: MFAChallenge;
  }> {
    this.ensureInitialized();

    try {
      const result = await this.authManager.forceReAuthentication(credentials);

      if (result.session) {
        // Update HTTP client auth header
        this.httpClient.setAuthHeader(this.authManager.getAuthHeader());
        logger.info('Re-authentication successful');
      }

      return result;
    } catch (error) {
      logger.error('Force re-authentication failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Validate current session and connectivity
   */
  public async validateSessionAndConnectivity(): Promise<{
    isValid: boolean;
    isServerReachable: boolean;
    requiresReauth: boolean;
    error?: string;
  }> {
    this.ensureInitialized();
    return this.authManager.validateSessionAndConnectivity();
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

    if (this.websocketManager.isWebSocketConnected()) {
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
  public async subscribeToPrices(isin: string, callback: (data: any) => void): Promise<string | undefined> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return await this.websocketManager.subscribeToPrices(isin, 'LSX', callback);
  }

  /**
   * Subscribe to portfolio updates
   */
  public async subscribeToPortfolio(callback: (data: any) => void): Promise<string | undefined> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return await this.websocketManager.subscribeToPortfolio(callback);
  }

  /**
   * Unsubscribe from a WebSocket subscription
   */
  public async unsubscribe(subscriptionId: string): Promise<void> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized');
      return;
    }

    await this.websocketManager.unsubscribe(subscriptionId);
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
    return this.websocketManager ? this.websocketManager.isWebSocketConnected() : false;
  }

  // =================
  // Enhanced WebSocket Methods
  // =================

  /**
   * Subscribe to order updates (simplified)
   */
  public async subscribeToOrders(callback: (message: OrderUpdateMessage) => void): Promise<string | undefined> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    // For now, use a basic subscription type that might work with TR
    return await this.websocketManager.subscribe('orders', { type: 'orders' }, callback);
  }

  /**
   * Subscribe to trade executions (simplified)
   */
  public async subscribeToExecutions(callback: (message: ExecutionMessage) => void): Promise<string | undefined> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return await this.websocketManager.subscribe('executions', { type: 'executions' }, callback);
  }

  /**
   * Subscribe to market status updates (simplified)
   */
  public async subscribeToMarketStatus(venue: string, callback: (message: MarketStatusMessage) => void): Promise<string | undefined> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return await this.websocketManager.subscribe('marketStatus', { type: 'marketStatus', venue }, callback);
  }

  /**
   * Subscribe to news updates (simplified)
   */
  public async subscribeToNews(callback: (message: NewsMessage) => void, isin?: string): Promise<string | undefined> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    const payload = isin ? { type: 'neonNews', id: isin } : { type: 'neonNews' };
    return await this.websocketManager.subscribe('news', payload, callback);
  }

  /**
   * Subscribe to watchlist updates (simplified)
   */
  public async subscribeToWatchlistUpdates(callback: (message: WatchlistUpdateMessage) => void): Promise<string | undefined> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return undefined;
    }

    return await this.websocketManager.subscribe('watchlist', { type: 'watchlist' }, callback);
  }

  /**
   * Bulk subscribe to price updates for multiple instruments
   */
  public async subscribeToPricesBulk(isins: string[], callback: (message: PriceUpdateMessage) => void): Promise<string[]> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized. Call initializeWebSocket() first.');
      return [];
    }

    const subscriptions: string[] = [];
    for (const isin of isins) {
      try {
        const subId = await this.websocketManager.subscribeToPrices(isin, 'LSX', callback);
        if (subId) {
          subscriptions.push(subId);
        }
      } catch (error) {
        logger.error('Failed to subscribe to price for ISIN', { isin, error });
      }
    }
    return subscriptions;
  }

  /**
   * Unsubscribe from multiple subscriptions
   */
  public async unsubscribeMultiple(subscriptionIds: string[]): Promise<void> {
    if (!this.websocketManager) {
      logger.error('WebSocket not initialized');
      return;
    }

    for (const subId of subscriptionIds) {
      try {
        await this.websocketManager.unsubscribe(subId);
      } catch (error) {
        logger.error('Failed to unsubscribe', { subscriptionId: subId, error });
      }
    }
  }

  /**
   * Get all active WebSocket subscriptions (simplified)
   */
  public getActiveSubscriptions(): { id: string; channel: string; isin?: string }[] {
    if (!this.websocketManager) {
      return [];
    }

    // For now, return empty array - the new implementation doesn't expose this method
    logger.debug('getActiveSubscriptions called - returning empty array (not implemented in new WS manager)');
    return [];
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
   * Ensure token is valid and refresh if needed, with comprehensive validation
   */
  private async ensureValidToken(): Promise<void> {
    try {
      // Use the comprehensive session validation
      await this.ensureValidSession();

      // Check if token should be auto-refreshed
      if (this.authManager.shouldRefreshToken()) {
        logger.debug('Token expires soon, attempting refresh');
        const refreshed = await this.authManager.autoRefreshIfNeeded();
        
        if (refreshed) {
          // Update auth header after successful refresh
          this.httpClient.setAuthHeader(this.authManager.getAuthHeader());
        } else {
          throw new AuthenticationError(
            'Token refresh failed. Session may need re-authentication.',
            'TOKEN_REFRESH_FAILED'
          );
        }
      }
    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
}
