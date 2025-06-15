// 🌟 Utils and Helper Functions for Trade Republic API
// Common utilities used across the API

import type { TRMoney, TRInstrument } from '../types/index.js';

// ========================
// MONEY UTILITIES
// ========================

export class MoneyUtils {
  /**
   * Format money for display
   */
  static format(money: TRMoney, locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  }

  /**
   * Create money object
   */
  static create(amount: number, currency: string): TRMoney {
    return {
      amount,
      currency,
      formatted: MoneyUtils.format({ amount, currency }),
    };
  }

  /**
   * Add two money amounts (must be same currency)
   */
  static add(a: TRMoney, b: TRMoney): TRMoney {
    if (a.currency !== b.currency) {
      throw new Error(`Cannot add different currencies: ${a.currency} and ${b.currency}`);
    }
    return MoneyUtils.create(a.amount + b.amount, a.currency);
  }

  /**
   * Subtract two money amounts (must be same currency)
   */
  static subtract(a: TRMoney, b: TRMoney): TRMoney {
    if (a.currency !== b.currency) {
      throw new Error(`Cannot subtract different currencies: ${a.currency} and ${b.currency}`);
    }
    return MoneyUtils.create(a.amount - b.amount, a.currency);
  }

  /**
   * Calculate percentage change
   */
  static percentageChange(from: TRMoney, to: TRMoney): number {
    if (from.currency !== to.currency) {
      throw new Error(`Cannot calculate percentage for different currencies`);
    }
    if (from.amount === 0) return 0;
    return ((to.amount - from.amount) / from.amount) * 100;
  }
}

// ========================
// VALIDATION UTILITIES
// ========================

export class ValidationUtils {
  /**
   * Validate ISIN code
   */
  static isValidISIN(isin: string): boolean {
    // ISIN format: 2 letter country code + 9 alphanumeric + 1 check digit
    const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
    return isinRegex.test(isin);
  }

  /**
   * Validate phone number
   */
  static isValidPhoneNumber(phone: string): boolean {
    // Must start with + and contain 7-15 digits
    const phoneRegex = /^\+\d{7,15}$/;
    return phoneRegex.test(phone.replace(/[^\d+]/g, ''));
  }

  /**
   * Validate PIN
   */
  static isValidPIN(pin: string): boolean {
    return /^\d{4}$/.test(pin);
  }

  /**
   * Validate order quantity
   */
  static isValidQuantity(quantity: number): boolean {
    return quantity > 0 && Number.isInteger(quantity);
  }

  /**
   * Validate price
   */
  static isValidPrice(price: number): boolean {
    return price > 0 && Number.isFinite(price);
  }
}

// ========================
// RETRY UTILITIES
// ========================

export class RetryUtils {
  /**
   * Retry an async operation with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      initialDelay?: number;
      maxDelay?: number;
      backoffFactor?: number;
      shouldRetry?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      shouldRetry = () => true,
    } = options;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts || !shouldRetry(lastError)) {
          throw lastError;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }

    throw lastError!;
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================
// DATE UTILITIES
// ========================

export class DateUtils {
  /**
   * Format date for Trade Republic API
   */
  static toTRFormat(date: Date): string {
    return date.toISOString().split('T')[0]!; // YYYY-MM-DD
  }

  /**
   * Parse Trade Republic date string
   */
  static fromTRFormat(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  /**
   * Get start of day
   */
  static startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Get end of day
   */
  static endOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Check if date is weekend
   */
  static isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Get next business day
   */
  static nextBusinessDay(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    
    while (DateUtils.isWeekend(next)) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }
}

// ========================
// LOGGING UTILITIES
// ========================

export class Logger {
  private prefix: string;
  private level: 'debug' | 'info' | 'warn' | 'error';

  constructor(prefix: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.prefix = prefix;
    this.level = level;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    return `${timestamp} [${levelUpper}] ${this.prefix}: ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), error, ...args);
    }
  }
}

// ========================
// RATE LIMITING UTILITIES
// ========================

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed and add to window
   */
  async tryRequest(): Promise<boolean> {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }

  /**
   * Wait until next request is allowed
   */
  async waitForSlot(): Promise<void> {
    while (!(await this.tryRequest())) {
      await RetryUtils.sleep(100);
    }
  }

  /**
   * Get time until next slot is available
   */
  timeUntilNextSlot(): number {
    if (this.requests.length < this.maxRequests) {
      return 0;
    }
    
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }
}

// ========================
// INSTRUMENT UTILITIES
// ========================

export class InstrumentUtils {
  /**
   * Format instrument name for display
   */
  static formatName(instrument: TRInstrument): string {
    return instrument.shortName || instrument.name;
  }

  /**
   * Get instrument display symbol
   */
  static getSymbol(instrument: TRInstrument): string {
    // Extract symbol from name or use ISIN as fallback
    const symbolMatch = instrument.name.match(/\(([^)]+)\)$/);
    return symbolMatch?.[1] || instrument.isin;
  }

  /**
   * Check if instrument is tradeable during current hours
   */
  static isTradeable(instrument: TRInstrument, now = new Date()): boolean {
    // Basic check - can be enhanced with actual market hours
    if (DateUtils.isWeekend(now)) {
      return false;
    }
    
    const hour = now.getHours();
    return hour >= 8 && hour < 22; // Rough European trading hours
  }

  /**
   * Get instrument risk level
   */
  static getRiskLevel(instrument: TRInstrument): 'low' | 'medium' | 'high' {
    switch (instrument.type) {
      case 'bond':
        return 'low';
      case 'etf':
      case 'stock':
        return 'medium';
      case 'derivative':
      case 'crypto':
        return 'high';
      default:
        return 'medium';
    }
  }
}

// Default export with all utilities
export default {
  MoneyUtils,
  ValidationUtils,
  RetryUtils,
  DateUtils,
  Logger,
  RateLimiter,
  InstrumentUtils,
};
