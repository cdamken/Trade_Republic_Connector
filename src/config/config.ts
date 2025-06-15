/**
 * Trade Republic Configuration
 *
 * Configuration management for the Trade Republic connector
 */

import type { TRWebSocketConfig } from '../websocket/tr-websocket';

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
  websocket: TRWebSocketConfig;

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
  websocketUrl: 'wss://api.traderepublic.com',
  userAgent: 'TradeRepublic/Android 30/App Version 1.1.5534',
  timeout: 30000,

  credentialsPath: undefined,
  sessionPersistence: true,
  autoRefreshTokens: true,

  websocket: {
    url: 'wss://api.traderepublic.com',
    locale: 'en',
    connectionTimeout: 30000,
    maxReconnectAttempts: 10,
    reconnectDelay: 5000,
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
