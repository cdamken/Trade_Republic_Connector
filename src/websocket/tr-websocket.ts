/**
 * Trade Republic WebSocket Implementation
 * Based on pytr protocol for real Trade Republic WebSocket communication
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { AuthManager } from '../auth/manager.js';

export interface TRWebSocketConfig {
  url: string;
  locale?: string;
  connectionTimeout?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface TRSubscription {
  id: string;
  type: string;
  payload: any;
  callback: (data: any) => void;
}

export class TradeRepublicWebSocket extends EventEmitter {
  private ws?: WebSocket;
  private config: Required<TRWebSocketConfig>;
  private authManager: AuthManager;
  private subscriptions = new Map<string, TRSubscription>();
  private subscriptionCounter = 1;
  private isConnecting = false;
  private isConnected = false;
  private isAuthenticated = false;
  private reconnectAttempts = 0;

  constructor(config: TRWebSocketConfig, authManager: AuthManager) {
    super();
    
    this.config = {
      url: config.url,
      locale: config.locale || 'en',
      connectionTimeout: config.connectionTimeout || 30000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      reconnectDelay: config.reconnectDelay || 5000,
    };
    
    this.authManager = authManager;
  }

  /**
   * Connect to Trade Republic WebSocket using their protocol
   */
  public async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    if (!this.authManager.isAuthenticated()) {
      throw new Error('Not authenticated. Please login first.');
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        logger.info('🔌 Connecting to Trade Republic WebSocket...', {
          url: this.config.url,
        });

        // Add headers that pytr uses for WebSocket connection
        const headers = {
          'User-Agent': 'Trade Republic/5127 CFNetwork/1492.0.1 Darwin/23.3.0',
          'Origin': 'https://app.traderepublic.com',
          'Sec-WebSocket-Protocol': 'echo-protocol',
        };

        this.ws = new WebSocket(this.config.url, { headers });

        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, this.config.connectionTimeout);

        this.ws.onopen = async () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.isConnected = true;
          this.reconnectAttempts = 0;

          logger.info('✅ WebSocket connected, sending connect message...');
          
          try {
            await this.sendConnectMessage();
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          const message = event.data.toString();
          this.handleMessage(message);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.isConnected = false;
          this.isAuthenticated = false;

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
   * Send the initial connect message using TR protocol
   * Based on pytr: await ws.send(f"connect {connect_id} {json.dumps(connection_message)}")
   */
  private async sendConnectMessage(): Promise<void> {
    // Try different connection approaches based on pytr research
    const connectId = 31; // Try web-style connection instead of app (21)
    const connectionMessage = {
      locale: this.config.locale,
      platformId: "WEB",
      clientId: "app.traderepublic.com",
      clientVersion: "6127"
    };

    const connectCommand = `connect ${connectId} ${JSON.stringify(connectionMessage)}`;
    
    logger.debug('📤 Sending connect message', { command: connectCommand });
    
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(connectCommand);

    // Wait for "connected" response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connect timeout - no "connected" response received'));
      }, 10000);

      const originalHandler = this.ws!.onmessage;
      this.ws!.onmessage = (event) => {
        clearTimeout(timeout);
        
        if (event.data === 'connected') {
          logger.info('✅ Received "connected" confirmation from Trade Republic');
          this.isAuthenticated = true;
          this.emit('connected');
          this.ws!.onmessage = originalHandler; // Restore normal message handler
          resolve();
        } else {
          logger.error('❌ Unexpected response to connect message', { response: event.data });
          this.ws!.onmessage = originalHandler;
          reject(new Error(`Unexpected connect response: ${event.data}`));
        }
      };
    });
  }

  /**
   * Subscribe to data using TR protocol
   * Based on pytr: await ws.send(f"sub {subscription_id} {json.dumps(payload_with_token)}")
   */
  public async subscribe(type: string, payload: any, callback: (data: any) => void): Promise<string> {
    const subscriptionId = this.getNextSubscriptionId();
    
    const subscription: TRSubscription = {
      id: subscriptionId,
      type,
      payload,
      callback,
    };

    this.subscriptions.set(subscriptionId, subscription);

    if (this.isConnected && this.isAuthenticated) {
      await this.sendSubscription(subscription);
    }

    logger.debug('📊 Added subscription', { type, subscriptionId });
    return subscriptionId;
  }

  /**
   * Send subscription message to TR WebSocket
   */
  private async sendSubscription(subscription: TRSubscription): Promise<void> {
    if (!this.ws || !this.isAuthenticated) {
      throw new Error('WebSocket not connected or authenticated');
    }

    // Add session token to payload (as per pytr implementation)
    const session = this.authManager.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const payloadWithToken = {
      ...subscription.payload,
      token: session.token.accessToken
    };

    const subCommand = `sub ${subscription.id} ${JSON.stringify(payloadWithToken)}`;
    
    logger.debug('📤 Sending subscription', { 
      type: subscription.type, 
      id: subscription.id,
      command: subCommand.substring(0, 100) + '...' // Log first 100 chars for debugging
    });

    this.ws.send(subCommand);
  }

  /**
   * Unsubscribe from data
   */
  public async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      logger.warn('Subscription not found', { subscriptionId });
      return;
    }

    if (this.isConnected && this.isAuthenticated) {
      const unsubCommand = `unsub ${subscriptionId}`;
      logger.debug('📤 Sending unsubscription', { id: subscriptionId });
      this.ws!.send(unsubCommand);
    }

    this.subscriptions.delete(subscriptionId);
    logger.debug('🗑️ Removed subscription', { subscriptionId });
  }

  /**
   * Handle incoming WebSocket messages
   * TR protocol: "{subscription_id} {code} {payload}"
   * Codes: A (initial), D (delta), C (complete), E (error)
   */
  private handleMessage(data: string): void {
    try {
      logger.debug('📥 Received WebSocket message', { data: data.substring(0, 200) + '...' });

      // Parse TR message format: "subscriptionId code payload"
      const firstSpace = data.indexOf(' ');
      if (firstSpace === -1) {
        logger.warn('Invalid message format - no space found', { data });
        return;
      }

      const subscriptionId = data.substring(0, firstSpace);
      const secondSpace = data.indexOf(' ', firstSpace + 1);
      
      if (secondSpace === -1) {
        logger.warn('Invalid message format - no second space found', { data });
        return;
      }

      const code = data.substring(firstSpace + 1, secondSpace);
      const payloadStr = data.substring(secondSpace + 1);

      logger.debug('📋 Parsed message', { subscriptionId, code, payloadLength: payloadStr.length });

      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        if (code !== 'C') { // Don't warn for complete messages of unknown subscriptions
          logger.debug('No active subscription for message', { subscriptionId, code });
        }
        return;
      }

      switch (code) {
        case 'A': // Initial data
          this.handleInitialData(subscription, payloadStr);
          break;
        case 'D': // Delta update (not implemented for now)
          logger.debug('Delta update received (not implemented)', { subscriptionId });
          break;
        case 'C': // Complete - subscription finished
          logger.debug('Subscription completed', { subscriptionId });
          this.subscriptions.delete(subscriptionId);
          break;
        case 'E': // Error
          this.handleSubscriptionError(subscription, payloadStr);
          break;
        default:
          logger.warn('Unknown message code', { code, subscriptionId });
      }

    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        error: error instanceof Error ? error.message : error,
        data: data.substring(0, 200) + '...',
      });
    }
  }

  /**
   * Handle initial data response (code 'A')
   */
  private handleInitialData(subscription: TRSubscription, payloadStr: string): void {
    try {
      const payload = payloadStr ? JSON.parse(payloadStr) : {};
      
      logger.debug('📊 Received initial data', { 
        type: subscription.type, 
        id: subscription.id,
        dataSize: payloadStr.length 
      });

      // Call the subscription callback
      subscription.callback(payload);

      this.emit('data', {
        subscriptionId: subscription.id,
        type: subscription.type,
        data: payload
      });

    } catch (error) {
      logger.error('Failed to parse subscription payload', {
        error: error instanceof Error ? error.message : error,
        subscriptionId: subscription.id,
      });
    }
  }

  /**
   * Handle subscription error (code 'E')
   */
  private handleSubscriptionError(subscription: TRSubscription, payloadStr: string): void {
    try {
      const errorPayload = payloadStr ? JSON.parse(payloadStr) : {};
      
      logger.error('❌ Subscription error', { 
        subscriptionId: subscription.id,
        type: subscription.type,
        error: errorPayload 
      });

      this.emit('subscriptionError', {
        subscriptionId: subscription.id,
        type: subscription.type,
        error: errorPayload
      });

      // Remove the failed subscription
      this.subscriptions.delete(subscription.id);

    } catch (error) {
      logger.error('Failed to parse error payload', {
        error: error instanceof Error ? error.message : error,
        subscriptionId: subscription.id,
      });
    }
  }

  /**
   * Handle reconnection
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('❌ Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.info('⏳ Attempting to reconnect...', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay,
    });

    setTimeout(async () => {
      try {
        await this.connect();
        // Re-subscribe to all subscriptions after reconnect
        await this.resubscribeAll();
      } catch (error) {
        logger.error('Reconnection failed', { error });
      }
    }, delay);
  }

  /**
   * Re-subscribe to all active subscriptions after reconnect
   */
  private async resubscribeAll(): Promise<void> {
    logger.info('🔄 Re-subscribing to all active subscriptions...', {
      count: this.subscriptions.size,
    });

    for (const subscription of this.subscriptions.values()) {
      try {
        await this.sendSubscription(subscription);
      } catch (error) {
        logger.error('Failed to re-subscribe', {
          subscriptionId: subscription.id,
          type: subscription.type,
          error,
        });
      }
    }
  }

  /**
   * Generate next subscription ID
   */
  private getNextSubscriptionId(): string {
    return (this.subscriptionCounter++).toString();
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    logger.info('📡 Disconnecting from WebSocket...');
    
    if (this.ws) {
      this.ws.close(1000); // Normal closure
      this.ws = undefined;
    }

    this.isConnected = false;
    this.isAuthenticated = false;
    this.subscriptions.clear();
    
    this.emit('disconnected');
  }

  /**
   * Get connection status
   */
  public getStatus(): any {
    return {
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      subscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Check if connected
   */
  public isWebSocketConnected(): boolean {
    return this.isConnected && this.isAuthenticated;
  }

  // Convenience methods for common subscriptions

  /**
   * Subscribe to portfolio data
   */
  public async subscribeToPortfolio(callback: (data: any) => void): Promise<string> {
    // Try different portfolio subscription types based on pytr research
    // Common types: 'timeline', 'portfolio', 'cash', 'positions'
    return this.subscribe('timeline', { type: 'timeline' }, callback);
  }

  /**
   * Subscribe to price updates for an instrument
   */
  public async subscribeToPrices(isin: string, exchange: string = 'LSX', callback: (data: any) => void): Promise<string> {
    return this.subscribe('ticker', { 
      type: 'ticker', 
      id: `${isin}.${exchange}` 
    }, callback);
  }

  /**
   * Subscribe to instrument details
   */
  public async subscribeToInstrument(isin: string, callback: (data: any) => void): Promise<string> {
    return this.subscribe('instrument', { 
      type: 'instrument', 
      id: isin 
    }, callback);
  }
}
