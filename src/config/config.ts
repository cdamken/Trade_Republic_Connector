/**
 * Trade Republic Configuration
 *
 * Configuration management for the Trade Republic connector
 */

import type { WebSocketConfig } from '../types/websocket';

export interface TradeRepublicConfig {
  // API Configuration
  apiUrl: string;
  websocketUrl: string;
  userAgent: string;
  timeout: number;

  // Authentication
  credentialsPath?: string;
  sessionPersistence: boolean;
  autoRefreshTokens: boolean;

  // WebSocket
  websocket: WebSocketConfig;

  // Rate Limiting
  rateLimitRequests: number;
  rateLimitWindow: number;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFile?: string;

  // Security
  strictTLS: boolean;
  certificatePinning: boolean;
}

export const DEFAULT_CONFIG: TradeRepublicConfig = {
  apiUrl: 'https://api.traderepublic.com',
  websocketUrl: 'wss://api.traderepublic.com/websocket',
  userAgent: 'trade-republic-connector/1.0.0',
  timeout: 30000,

  credentialsPath: undefined,
  sessionPersistence: true,
  autoRefreshTokens: true,

  websocket: {
    url: 'wss://api.traderepublic.com/websocket',
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    subscriptionTimeout: 10000,
  },

  rateLimitRequests: 100,
  rateLimitWindow: 60000,

  logLevel: 'info',
  logFile: undefined,

  strictTLS: true,
  certificatePinning: false,
};

export class ConfigManager {
  private config: TradeRepublicConfig;

  constructor(config?: Partial<TradeRepublicConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public getConfig(): TradeRepublicConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<TradeRepublicConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public validateConfig(): boolean {
    // Basic validation
    if (!this.config.apiUrl || !this.config.websocketUrl) {
      return false;
    }

    if (this.config.timeout <= 0) {
      return false;
    }

    return true;
  }
}
