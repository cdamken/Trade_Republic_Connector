/**
 * WebSocket Manager
 *
 * Handles Trade Republic WebSocket connections for real-time data
 * @author Carlos Damken <carlos@damken.com>
 */

import { EventEmitter } from 'events';
import type {
  WebSocketMessage,
  SubscriptionRequest,
  UnsubscriptionRequest,
  PriceUpdateMessage,
  PortfolioUpdateMessage,
  ChannelType,
} from '../types/websocket';
import { AuthManager } from '../auth/manager';
import { logger } from '../utils/logger';

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export interface Subscription {
  id: string;
  channel: ChannelType;
  isin?: string;
  callback: (message: WebSocketMessage) => void;
}

export class WebSocketManager extends EventEmitter {
  private ws?: WebSocket;
  private config: Required<WebSocketConfig>;
  private authManager: AuthManager;
  private subscriptions = new Map<string, Subscription>();
  private reconnectAttempts = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private isConnecting = false;
  private isAuthenticated = false;

  constructor(config: WebSocketConfig, authManager: AuthManager) {
    super();
    
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      connectionTimeout: config.connectionTimeout ?? 10000,
    };
    
    this.authManager = authManager;
  }

  /**
   * Connect to Trade Republic WebSocket
   */
  public async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;

    try {
      // Ensure we're authenticated first
      if (!this.authManager.isAuthenticated()) {
        throw new Error('Not authenticated. Please login first.');
      }

      logger.info('🔌 Connecting to Trade Republic WebSocket...', {
        url: this.config.url,
      });

      await this.createWebSocketConnection();
      
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to connect to WebSocket', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    logger.info('📡 Disconnecting from WebSocket...');
    
    this.clearHeartbeat();
    this.isAuthenticated = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.emit('disconnected');
  }

  /**
   * Subscribe to a channel
   */
  public subscribe(channel: ChannelType, callback: (message: WebSocketMessage) => void, isin?: string): string {
    const id = this.generateSubscriptionId(channel, isin);
    
    const subscription: Subscription = {
      id,
      channel,
      isin,
      callback,
    };

    this.subscriptions.set(id, subscription);

    // Send subscription if connected
    if (this.isConnected() && this.isAuthenticated) {
      this.sendSubscription(subscription);
    }

    logger.debug('📊 Added subscription', { channel, isin, id });
    return id;
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      logger.warn('Subscription not found', { subscriptionId });
      return;
    }

    // Send unsubscription if connected
    if (this.isConnected() && this.isAuthenticated) {
      this.sendUnsubscription(subscription);
    }

    this.subscriptions.delete(subscriptionId);
    logger.debug('📴 Removed subscription', { subscriptionId });
  }

  /**
   * Subscribe to price updates for an instrument
   */
  public subscribePrices(isin: string, callback: (message: PriceUpdateMessage) => void): string {
    return this.subscribe('price', (message) => {
      if (message.type === 'price_update') {
        callback(message as unknown as PriceUpdateMessage);
      }
    }, isin);
  }

  /**
   * Subscribe to portfolio updates
   */
  public subscribePortfolio(callback: (message: PortfolioUpdateMessage) => void): string {
    return this.subscribe('portfolio', (message) => {
      if (message.type === 'portfolio_update') {
        callback(message as unknown as PortfolioUpdateMessage);
      }
    });
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    connected: boolean;
    authenticated: boolean;
    subscriptions: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      authenticated: this.isAuthenticated,
      subscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // =================
  // Private Methods
  // =================

  /**
   * Create WebSocket connection
   */
  private async createWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, this.config.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          logger.info('✅ WebSocket connected successfully');
          this.authenticate();
          this.startHeartbeat();
          
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.isAuthenticated = false;
          this.clearHeartbeat();
          
          logger.warn('🔌 WebSocket connection closed', {
            code: event.code,
            reason: event.reason,
          });
          
          this.emit('disconnected');
          
          // Auto-reconnect if not intentionally closed
          if (event.code !== 1000) {
            this.handleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          
          logger.error('❌ WebSocket error', { error });
          this.emit('error', error);
          
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Authenticate WebSocket connection
   */
  private authenticate(): void {
    const authHeader = this.authManager.getAuthHeader();
    if (!authHeader) {
      logger.error('No authentication header available');
      return;
    }

    const authMessage: WebSocketMessage = {
      type: 'auth',
      payload: {
        token: authHeader.replace('Bearer ', ''),
      },
      timestamp: Date.now(),
    };

    this.sendMessage(authMessage);
    logger.debug('🔐 Sent authentication message');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      logger.debug('📨 Received message', { type: message.type });

      switch (message.type) {
        case 'auth':
          this.handleAuthMessage(message);
          break;
        case 'price_update':
          this.handlePriceUpdate(message as unknown as PriceUpdateMessage);
          break;
        case 'portfolio_update':
          this.handlePortfolioUpdate(message as unknown as PortfolioUpdateMessage);
          break;
        case 'heartbeat':
          this.handleHeartbeat(message);
          break;
        case 'error':
          this.handleError(message);
          break;
        default:
          logger.debug('Unhandled message type', { type: message.type });
      }

      this.emit('message', message);
    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        error: error instanceof Error ? error.message : error,
        data,
      });
    }
  }

  /**
   * Handle authentication response
   */
  private handleAuthMessage(message: WebSocketMessage): void {
    // Assume successful auth for now
    this.isAuthenticated = true;
    logger.info('🔓 WebSocket authenticated successfully');

    // Re-subscribe to all channels
    this.resubscribeAll();
    this.emit('authenticated');
  }

  /**
   * Handle price updates
   */
  private handlePriceUpdate(message: PriceUpdateMessage): void {
    // Find relevant subscriptions
    const subscriptionId = this.generateSubscriptionId('price', message.payload.isin);
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (subscription) {
      subscription.callback(message);
    }

    this.emit('priceUpdate', message);
  }

  /**
   * Handle portfolio updates
   */
  private handlePortfolioUpdate(message: PortfolioUpdateMessage): void {
    // Find relevant subscriptions
    this.subscriptions.forEach((subscription) => {
      if (subscription.channel === 'portfolio') {
        subscription.callback(message);
      }
    });

    this.emit('portfolioUpdate', message);
  }

  /**
   * Handle heartbeat messages
   */
  private handleHeartbeat(_message: WebSocketMessage): void {
    // Respond to heartbeat if needed
    const response: WebSocketMessage = {
      type: 'heartbeat',
      payload: { timestamp: Date.now() },
      timestamp: Date.now(),
    };
    
    this.sendMessage(response);
  }

  /**
   * Handle error messages
   */
  private handleError(message: WebSocketMessage): void {
    logger.error('WebSocket error message received', { payload: message.payload });
    this.emit('error', message.payload);
  }

  /**
   * Send subscription request
   */
  private sendSubscription(subscription: Subscription): void {
    const request: SubscriptionRequest = {
      type: 'subscribe',
      channel: subscription.channel,
      isin: subscription.isin,
      id: subscription.id,
    };

    this.sendMessage(request);
    logger.debug('📡 Sent subscription request', { channel: subscription.channel, isin: subscription.isin });
  }

  /**
   * Send unsubscription request
   */
  private sendUnsubscription(subscription: Subscription): void {
    const request: UnsubscriptionRequest = {
      type: 'unsubscribe',
      channel: subscription.channel,
      isin: subscription.isin,
      id: subscription.id,
    };

    this.sendMessage(request);
    logger.debug('📡 Sent unsubscription request', { channel: subscription.channel, isin: subscription.isin });
  }

  /**
   * Send WebSocket message
   */
  private sendMessage(message: object): void {
    if (!this.isConnected()) {
      logger.warn('Cannot send message: WebSocket not connected');
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Re-subscribe to all channels after reconnection
   */
  private resubscribeAll(): void {
    logger.info('🔄 Re-subscribing to all channels', {
      count: this.subscriptions.size,
    });

    this.subscriptions.forEach((subscription) => {
      this.sendSubscription(subscription);
    });
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Maximum reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    logger.info('⏳ Attempting to reconnect...', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay,
    });

    setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnection failed', { error });
      });
    }, delay);
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        const heartbeat: WebSocketMessage = {
          type: 'heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
        };
        this.sendMessage(heartbeat);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(channel: ChannelType, isin?: string): string {
    return `${channel}${isin ? `:${isin}` : ''}`;
  }
}
