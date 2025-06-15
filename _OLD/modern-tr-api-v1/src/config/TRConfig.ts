// ⚙️ Configuration Management for Trade Republic API
// Secure, validated configuration with environment support

import { TRConfigError } from '../errors/index.js';
import type { TRClientConfig, TRStorageAdapter } from '../types/index.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export class TRConfig {
  public readonly phoneNumber: string;
  public readonly pin: string;
  public readonly locale: string;
  public readonly environment: 'production' | 'sandbox';
  public readonly timeout: number;
  public readonly retryAttempts: number;
  public readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  public readonly storage: TRStorageAdapter;

  // API endpoints
  public readonly baseUrl: string;
  public readonly wsUrl: string;
  public readonly userAgent: string;

  constructor(config: TRClientConfig) {
    // Validate required fields
    this.validateConfig(config);

    this.phoneNumber = this.normalizePhoneNumber(config.phoneNumber);
    this.pin = config.pin;
    this.locale = config.locale || 'en';
    this.environment = config.environment || 'production';
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retryAttempts = config.retryAttempts || 3;
    this.logLevel = config.logLevel || 'info';
    this.storage = config.storage || new DefaultStorageAdapter();

    // Set URLs based on environment
    if (this.environment === 'production') {
      this.baseUrl = 'https://api.traderepublic.com';
      this.wsUrl = 'wss://api.traderepublic.com';
    } else {
      // Sandbox environment (if available)
      this.baseUrl = 'https://api-sandbox.traderepublic.com';
      this.wsUrl = 'wss://api-sandbox.traderepublic.com';
    }

    this.userAgent = `TradeRepublicAPI/1.0.0 (${process.platform}; Node.js/${process.version})`;
  }

  private validateConfig(config: TRClientConfig): void {
    if (!config.phoneNumber) {
      throw new TRConfigError('Phone number is required', 'phoneNumber');
    }

    if (!config.pin) {
      throw new TRConfigError('PIN is required', 'pin');
    }

    // Validate phone number format
    if (!this.isValidPhoneNumber(config.phoneNumber)) {
      throw new TRConfigError(
        'Phone number must start with + and contain only digits',
        'phoneNumber'
      );
    }

    // Validate PIN format
    if (!this.isValidPin(config.pin)) {
      throw new TRConfigError(
        'PIN must be 4 digits',
        'pin'
      );
    }

    // Validate optional fields
    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      throw new TRConfigError(
        'Timeout must be between 1000ms and 300000ms',
        'timeout'
      );
    }

    if (config.retryAttempts && (config.retryAttempts < 0 || config.retryAttempts > 10)) {
      throw new TRConfigError(
        'Retry attempts must be between 0 and 10',
        'retryAttempts'
      );
    }
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    const normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      throw new TRConfigError(
        'Phone number must start with country code (e.g., +49)',
        'phoneNumber'
      );
    }

    return normalized;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Must start with + and contain 7-15 digits
    const normalized = phoneNumber.replace(/[^\d+]/g, '');
    return /^\+\d{7,15}$/.test(normalized);
  }

  private isValidPin(pin: string): boolean {
    // Must be exactly 4 digits
    return /^\d{4}$/.test(pin);
  }

  // Get API endpoints
  public getAuthUrl(): string {
    return `${this.baseUrl}/api/v1/auth`;
  }

  public getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  public getHeaders(): Record<string, string> {
    return {
      'User-Agent': this.userAgent,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.locale,
    };
  }

  // Environment helpers
  public isProduction(): boolean {
    return this.environment === 'production';
  }

  public isSandbox(): boolean {
    return this.environment === 'sandbox';
  }

  // Create from environment variables
  public static fromEnv(): TRConfig {
    const phoneNumber = process.env.TR_PHONE_NUMBER;
    const pin = process.env.TR_PIN;
    const locale = process.env.TR_LOCALE || undefined;
    const environment = (process.env.TR_ENVIRONMENT as 'production' | 'sandbox') || undefined;
    const logLevel = (process.env.TR_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || undefined;

    if (!phoneNumber || !pin) {
      throw new TRConfigError(
        'TR_PHONE_NUMBER and TR_PIN environment variables are required'
      );
    }

    const config: TRClientConfig = {
      phoneNumber,
      pin,
    };

    if (locale) config.locale = locale;
    if (environment) config.environment = environment;
    if (logLevel) config.logLevel = logLevel;
    
    const timeoutStr = process.env.TR_TIMEOUT;
    if (timeoutStr) config.timeout = parseInt(timeoutStr);
    
    const retryStr = process.env.TR_RETRY_ATTEMPTS;
    if (retryStr) config.retryAttempts = parseInt(retryStr);

    return new TRConfig(config);
  }

  // Create config for testing
  public static forTesting(overrides: Partial<TRClientConfig> = {}): TRConfig {
    return new TRConfig({
      phoneNumber: '+4917681033982',
      pin: '1704',
      locale: 'en',
      environment: 'sandbox',
      logLevel: 'debug',
      timeout: 5000,
      retryAttempts: 1,
      ...overrides,
    });
  }
}

// ========================
// DEFAULT STORAGE ADAPTER
// ========================

class DefaultStorageAdapter implements TRStorageAdapter {
  private storage = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }
}

// ========================
// FILE STORAGE ADAPTER
// ========================

export class FileStorageAdapter implements TRStorageAdapter {
  private readonly storageDir: string;

  constructor(directory?: string) {
    this.storageDir = directory || join(homedir(), '.trade-republic-api');
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for filesystem
    const safeKey = key.replace(/[^a-zA-Z0-9.-]/g, '_');
    return join(this.storageDir, `${safeKey}.json`);
  }

  async get(key: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.value || null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.ensureDirectory();
    const filePath = this.getFilePath(key);
    const data = {
      value,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
    } catch {
      // File might not exist
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
