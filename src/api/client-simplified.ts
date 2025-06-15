/**
 * Trade Republic API Client - Simplified Production Version
 *
 * Focus on working features: Authentication and WebSocket data collection
 * Removed non-working features: Portfolio management, Trading operations
 */

import { DEFAULT_CONFIG } from '../config/config';
import { AuthManager } from '../auth/manager';
import { AuthenticationError } from '../types/auth';
import { HttpClient } from './http-client';
import { logger } from '../utils/logger';
import type { TradeRepublicConfig } from '../config/config';
import type { LoginCredentials, AuthSession, AuthToken, MFAChallenge, MFAResponse } from '../types/auth';
import { TradeRepublicWebSocket } from '../websocket/tr-websocket';
import type { TRWebSocketConfig } from '../websocket/tr-websocket';
import type {
  PriceUpdateMessage,
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
    this.websocketManager = new TradeRepublicWebSocket(this.config.websocket, this.authManager);

    // Set up logging level
    logger.setLevel(this.config.logLevel);

    // Add file logging if configured
    if (this.config.logFile) {
      logger.addFileTransport(this.config.logFile);
    }
  }

  // ==============================================
  // GETTERS
  // ==============================================

  /**
   * Get authentication manager
   */
  public get auth(): AuthManager {
    return this.authManager;
  }

  /**
   * Get HTTP client
   */
  public get http(): HttpClient {
    return this.httpClient;
  }

  /**
   * Get WebSocket manager
   */
  public get websocket(): TradeRepublicWebSocket | undefined {
    return this.websocketManager;
  }

  /**
   * Check if client is authenticated
   */
  public get isAuthenticated(): boolean {
    return this.authManager.isAuthenticated;
  }

  /**
   * Get current session information
   */
  public get session(): AuthSession | null {
    return this.authManager.currentSession;
  }

  // ==============================================
  // INITIALIZATION
  // ==============================================

  /**
   * Initialize the client
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize auth manager
      await this.authManager.initialize();
      
      // Initialize HTTP client
      if (this.authManager.isAuthenticated) {
        const session = this.authManager.currentSession;
        if (session) {
          this.httpClient.setAuthTokens(session.accessToken, session.refreshToken);
        }
      }

      this.initialized = true;
      logger.info('Trade Republic client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Trade Republic client', { error });
      throw error;
    }
  }

  // ==============================================
  // AUTHENTICATION
  // ==============================================

  /**
   * Login to Trade Republic
   */
  public async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      await this.initialize();
      
      const session = await this.authManager.login(credentials);
      
      // Update HTTP client with new tokens
      this.httpClient.setAuthTokens(session.accessToken, session.refreshToken);
      
      logger.info('Login successful', { userId: session.userId });
      return session;
    } catch (error) {
      logger.error('Login failed', {
        username: credentials.username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle MFA challenge
   */
  public async handleMFA(challengeData: MFAChallenge, code: string): Promise<AuthSession> {
    try {
      const response: MFAResponse = { code, challengeId: challengeData.challengeId };
      const session = await this.authManager.completeMFA(response);
      
      // Update HTTP client with new tokens
      this.httpClient.setAuthTokens(session.accessToken, session.refreshToken);
      
      logger.info('MFA completed successfully');
      return session;
    } catch (error) {
      logger.error('MFA failed', { error });
      throw error;
    }
  }

  /**
   * Logout from Trade Republic
   */
  public async logout(): Promise<void> {
    try {
      if (this.websocketManager) {
        await this.websocketManager.disconnect();
      }
      
      await this.authManager.logout();
      
      logger.info('Logout successful');
    } catch (error) {
      logger.error('Logout failed', { error });
      throw error;
    }
  }

  /**
   * Refresh authentication tokens
   */
  public async refreshAuth(): Promise<AuthSession> {
    try {
      const session = await this.authManager.refreshTokens();
      
      // Update HTTP client with new tokens
      this.httpClient.setAuthTokens(session.accessToken, session.refreshToken);
      
      return session;
    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw error;
    }
  }

  // ==============================================
  // WEBSOCKET OPERATIONS
  // ==============================================

  /**
   * Initialize WebSocket connection
   */
  public async initializeWebSocket(): Promise<void> {
    if (!this.websocketManager) {
      throw new Error('WebSocket manager not available');
    }

    if (!this.isAuthenticated) {
      throw new AuthenticationError('Not authenticated. Please login first.');
    }

    await this.websocketManager.connect();
    logger.info('WebSocket connection established');
  }

  /**
   * Get WebSocket connection status
   */
  public getWebSocketStatus(): { connected: boolean; readyState?: number } {
    if (!this.websocketManager) {
      return { connected: false };
    }

    return {
      connected: this.websocketManager.isConnected(),
      readyState: this.websocketManager.getReadyState()
    };
  }

  /**
   * Subscribe to price updates for an asset
   */
  public subscribeToPrices(isin: string, callback: (data: PriceUpdateMessage) => void): void {
    if (!this.websocketManager) {
      throw new Error('WebSocket manager not available');
    }

    if (!this.websocketManager.isConnected()) {
      throw new Error('WebSocket not connected. Call initializeWebSocket() first.');
    }

    this.websocketManager.subscribeToPrice(isin, callback);
  }

  /**
   * Unsubscribe from price updates for an asset
   */
  public unsubscribeFromPrices(isin: string): void {
    if (!this.websocketManager) {
      throw new Error('WebSocket manager not available');
    }

    this.websocketManager.unsubscribeFromPrice(isin);
  }

  /**
   * Disconnect WebSocket
   */
  public async disconnectWebSocket(): Promise<void> {
    if (this.websocketManager) {
      await this.websocketManager.disconnect();
      logger.info('WebSocket disconnected');
    }
  }

  // ==============================================
  // UTILITY METHODS
  // ==============================================

  /**
   * Check if client needs authentication
   */
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated) {
      throw new AuthenticationError('Not authenticated. Please login first.');
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      await this.disconnectWebSocket();
      // Additional cleanup if needed
      logger.info('Client cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup', { error });
    }
  }
}

export default TradeRepublicClient;
