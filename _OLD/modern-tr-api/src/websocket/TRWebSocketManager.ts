import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { TRError, TRConnectionError } from '../errors/index.js';
import { TRConfig } from '../config/TRConfig.js';

export interface Subscription {
  id: string;
  type: string;
  callback?: ((data: any) => void) | undefined;
  params: Record<string, any>;
}

export interface WebSocketMessage {
  subscriptionId: string;
  type: string;
  payload: any;
}

export class TRWebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionCounter = 1;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private previousResponses: Map<string, string> = new Map();

  constructor(private config: TRConfig) {
    super();
    this.setMaxListeners(1000); // Allow many subscriptions for 400+ assets
  }

  async connect(sessionToken: string): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = 'wss://api.traderepublic.com';
      const headers = {
        'User-Agent': 'TradeRepublic/Android 30/App Version 1.1.5534'
      };

      this.ws = new WebSocket(wsUrl, { headers });

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new TRConnectionError('WebSocket not initialized', 'WS_NOT_INITIALIZED'));

        this.ws.on('open', () => {
          const connectionMessage = {
            locale: this.config.locale,
            platformId: 'app',
            platformVersion: 'android',
            clientId: 'trade-republic-client',
            clientVersion: '1.1.5534'
          };

          this.ws!.send(`connect 21 ${JSON.stringify(connectionMessage)}`);
        });

        this.ws.on('message', (data: Buffer) => {
          const message = data.toString();
          
          if (message === 'connected') {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startPing();
            this.emit('connected');
            resolve();
          } else {
            this.handleMessage(message);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.isConnected = false;
          this.stopPing();
          this.emit('disconnected', { code, reason: reason.toString() });
          
          if (code !== 1000) { // Not a normal closure
            this.attemptReconnect(sessionToken);
          }
        });

        this.ws.on('error', (error: Error) => {
          this.emit('error', new TRConnectionError(`WebSocket error: ${error.message}`, 'WS_ERROR'));
          reject(error);
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new TRConnectionError('WebSocket connection timeout', 'WS_TIMEOUT'));
          }
        }, 10000);
      });

    } catch (error) {
      throw new TRConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONNECT_FAILED');
    }
  }

  private async attemptReconnect(sessionToken: string): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new TRConnectionError('Max reconnection attempts reached', 'MAX_RECONNECT_EXCEEDED'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    setTimeout(async () => {
      try {
        await this.connect(sessionToken);
        this.resubscribeAll();
      } catch (error) {
        this.emit('error', new TRConnectionError(`Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'RECONNECT_FAILED'));
      }
    }, delay);
  }

  private resubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      this.sendSubscription(subscription);
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  async subscribe(type: string, params: Record<string, any> = {}, callback?: (data: any) => void): Promise<string> {
    const subscriptionId = `sub_${this.subscriptionCounter++}`;
    
    const subscription: Subscription = {
      id: subscriptionId,
      type,
      params,
      callback: callback || undefined
    };

    this.subscriptions.set(subscriptionId, subscription);

    if (this.isConnected) {
      this.sendSubscription(subscription);
    }

    return subscriptionId;
  }

  private sendSubscription(subscription: Subscription): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = `sub ${subscription.id} ${JSON.stringify({
      type: subscription.type,
      ...subscription.params
    })}`;

    this.ws.send(message);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    this.subscriptions.delete(subscriptionId);
    this.previousResponses.delete(subscriptionId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(`unsub ${subscriptionId}`);
    }
  }

  private handleMessage(message: string): void {
    try {
      const parts = message.split(' ');
      if (parts.length < 2) return;

      const action = parts[0];
      const subscriptionId = parts[1];
      const payloadStr = parts.slice(2).join(' ');

      if (!subscriptionId) return;

      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) return;

      let payload: any;

      switch (action) {
        case 'A': // Full response
          this.previousResponses.set(subscriptionId, payloadStr);
          payload = payloadStr ? JSON.parse(payloadStr) : {};
          break;

        case 'D': // Delta response
          const fullResponse = this.calculateDelta(subscriptionId, payloadStr);
          this.previousResponses.set(subscriptionId, fullResponse);
          payload = JSON.parse(fullResponse);
          break;

        case 'E': // Error
          payload = payloadStr ? JSON.parse(payloadStr) : {};
          this.emit('subscriptionError', {
            subscriptionId,
            subscription,
            error: payload
          });
          return;

        case 'C': // Complete/Unsubscribed
          this.subscriptions.delete(subscriptionId);
          this.previousResponses.delete(subscriptionId);
          return;

        default:
          return;
      }

      // Call subscription callback if provided
      if (subscription.callback) {
        subscription.callback(payload);
      }

      // Emit general event
      this.emit('data', {
        subscriptionId,
        type: subscription.type,
        payload
      });

      // Emit type-specific event
      this.emit(subscription.type, payload);

    } catch (error) {
      this.emit('error', new TRError(`Failed to handle message: ${error instanceof Error ? error.message : 'Unknown error'}`, 'MESSAGE_PARSE_ERROR'));
    }
  }

  private calculateDelta(subscriptionId: string, delta: string): string {
    const previous = this.previousResponses.get(subscriptionId) || '';
    let position = 0;
    const result: string[] = [];

    for (const instruction of delta.split('\t')) {
      const operation = instruction[0];
      const value = instruction.slice(1);

      switch (operation) {
        case '+': // Insert
          result.push(decodeURIComponent(value));
          break;

        case '=': // Copy from previous
          const length = parseInt(value, 10);
          result.push(previous.slice(position, position + length));
          position += length;
          break;

        case '-': // Skip
          position += parseInt(value, 10);
          break;
      }
    }

    return result.join('');
  }

  async close(): Promise<void> {
    this.isConnected = false;
    this.stopPing();
    
    if (this.ws) {
      this.ws.close(1000, 'Client closing');
      this.ws = null;
    }

    this.subscriptions.clear();
    this.previousResponses.clear();
  }

  // Utility methods for common subscription types

  async subscribePortfolio(callback?: (data: any) => void): Promise<string> {
    return this.subscribe('compactPortfolio', {}, callback);
  }

  async subscribeCash(callback?: (data: any) => void): Promise<string> {
    return this.subscribe('cash', {}, callback);
  }

  async subscribeInstrument(isin: string, callback?: (data: any) => void): Promise<string> {
    return this.subscribe('instrument', { id: isin }, callback);
  }

  async subscribeTicker(isin: string, exchange = 'LSX', callback?: (data: any) => void): Promise<string> {
    return this.subscribe('ticker', { 
      id: `${isin}.${exchange}`
    }, callback);
  }

  async subscribeTimeline(after?: string, callback?: (data: any) => void): Promise<string> {
    return this.subscribe('timeline', after ? { after } : {}, callback);
  }

  async subscribeNews(isin: string, callback?: (data: any) => void): Promise<string> {
    return this.subscribe('neonNews', { isin }, callback);
  }

  // Batch subscription for multiple assets (efficient for 400+ assets)
  async batchSubscribe(subscriptions: Array<{
    type: string;
    params?: Record<string, any>;
    callback?: (data: any) => void;
  }>): Promise<string[]> {
    const subscriptionIds: string[] = [];

    for (const sub of subscriptions) {
      const id = await this.subscribe(sub.type, sub.params || {}, sub.callback);
      subscriptionIds.push(id);
    }

    return subscriptionIds;
  }

  // Get connection status
  get connected(): boolean {
    return this.isConnected;
  }

  // Get active subscription count
  get subscriptionCount(): number {
    return this.subscriptions.size;
  }
}
