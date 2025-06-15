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
import { logger } from '../utils/logger';
import type { TradeRepublicConfig } from '../config/config';
import type { LoginCredentials, AuthSession, AuthToken, MFAChallenge, MFAResponse } from '../types/auth';
import type { Portfolio } from '../types/portfolio';

export class TradeRepublicClient {
  private config: TradeRepublicConfig;
  private authManager: AuthManager;
  private httpClient: HttpClient;
  private portfolioManager: PortfolioManager;
  private initialized = false;

  constructor(config?: Partial<TradeRepublicConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.authManager = new AuthManager(this.config.credentialsPath);
    this.httpClient = new HttpClient(this.config);
    this.portfolioManager = new PortfolioManager(this.authManager);

    // Set up logging level
    logger.setLevel(this.config.logLevel);

    // Add file logging if configured
    if (this.config.logFile) {
      logger.addFileTransport(this.config.logFile);
    }
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
