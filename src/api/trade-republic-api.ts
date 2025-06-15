/**
 * Real Trade Republic API Implementation
 * Based on working implementations from pytr and unofficial APIs
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import crypto from 'crypto';
import { AuthenticationError, TwoFactorRequiredError, RateLimitError } from '../types/auth.js';
import type { LoginCredentials, DeviceKeys } from '../types/auth.js';
import { logger } from '../utils/logger.js';

export interface TRApiConfig {
  baseUrl?: string;
  timeout?: number;
  userAgent?: string;
}

export interface TRApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  processId?: string;
}

/**
 * Real Trade Republic API Client
 * Implements actual TR authentication and device pairing
 */
export class TradeRepublicAPI {
  private baseUrl: string;
  private timeout: number;
  private userAgent: string;
  private processId?: string;
  private deviceKeys?: DeviceKeys;

  constructor(config: TRApiConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://api.traderepublic.com';
    this.timeout = config.timeout || 30000;
    this.userAgent = config.userAgent || 'TradeRepublic/Android 30/App Version 1.1.5534';
  }

  /**
   * Get default headers for API requests
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
    };
  }

  /**
   * Generate ECDSA P-256 key pair for device authentication
   */
  private generateDeviceKeys(): DeviceKeys {
    const keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1', // P-256
      publicKeyEncoding: {
        type: 'spki',
        format: 'der',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der',
      },
    });

    // Extract uncompressed public key (65 bytes starting with 0x04)
    const publicKeyDer = keyPair.publicKey as Buffer;
    const uncompressedStart = publicKeyDer.length - 65;
    
    if (publicKeyDer[uncompressedStart] !== 0x04) {
      throw new Error('Expected uncompressed point starting with 0x04');
    }

    const uncompressedPublicKey = publicKeyDer.subarray(uncompressedStart);
    const publicKeyB64 = uncompressedPublicKey.toString('base64');

    return {
      privateKey: keyPair.privateKey.toString('base64'),
      publicKey: publicKeyB64,
      deviceId: crypto.randomUUID(),
    };
  }

  /**
   * Step 1: Initiate device reset/pairing
   * This triggers a 4-digit code in the Trade Republic app
   */
  async initiateDeviceReset(credentials: LoginCredentials): Promise<string> {
    logger.info('🔑 Initiating device reset with Trade Republic...');

    // Generate new device keys
    this.deviceKeys = this.generateDeviceKeys();
    
    const url = `${this.baseUrl}/api/v1/auth/account/reset/device`;
    const payload = {
      phoneNumber: credentials.username,
      pin: credentials.password,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('TR API Response', { 
        status: response.status, 
        statusText: response.statusText,
        data: data 
      });

      if (response.status === 429) {
        throw new RateLimitError('Too many reset attempts, try again later');
      }

      if (!response.ok) {
        throw new AuthenticationError(
          data.message || `HTTP ${response.status}: ${response.statusText}`,
          `HTTP_${response.status}`
        );
      }

      if (!data.processId) {
        throw new AuthenticationError('No process ID received', 'INVALID_RESPONSE');
      }

      this.processId = data.processId;
      logger.info('✅ Device reset initiated successfully');
      logger.info('📱 Check your Trade Republic app for a 4-digit authentication code');

      return data.processId;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Step 2: Complete device reset with 4-digit code from TR app
   */
  async completeDeviceReset(code: string): Promise<DeviceKeys> {
    if (!this.processId || !this.deviceKeys) {
      throw new AuthenticationError('Device reset not initiated', 'INVALID_STATE');
    }

    logger.info('🔓 Completing device reset with authentication code...');

    const url = `${this.baseUrl}/api/v1/auth/account/reset/device/${this.processId}/key`;
    const payload = {
      code: code.trim(),
      deviceKey: this.deviceKeys.publicKey,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.status === 400) {
        const data = await response.json() as any;
        throw new TwoFactorRequiredError('Invalid authentication code', {
          challengeId: this.processId,
          type: 'APP',
          message: 'Please check the 4-digit code in your Trade Republic app',
          expiresAt: Date.now() + 5 * 60 * 1000,
          length: 4,
        });
      }

      if (!response.ok) {
        const data = await response.json() as any;
        throw new AuthenticationError(
          data.message || `HTTP ${response.status}: ${response.statusText}`,
          `HTTP_${response.status}`
        );
      }

      logger.info('✅ Device successfully paired with Trade Republic!');
      logger.info('💾 Device keys generated and ready for use');

      return this.deviceKeys;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Sign a payload using device private key
   */
  private signPayload(payload: string, privateKey: string): string {
    const key = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });

    const signature = crypto.sign('sha512', Buffer.from(payload, 'utf8'), key);
    return signature.toString('base64');
  }

  /**
   * Login with device keys (after pairing)
   */
  async loginWithDeviceKeys(credentials: LoginCredentials, deviceKeys: DeviceKeys): Promise<TRApiResponse> {
    logger.info('🔓 Logging in with device keys...');

    const url = `${this.baseUrl}/api/v1/auth/login`;
    const payload = {
      phoneNumber: credentials.username,
      pin: credentials.password,
    };

    // Sign the request
    const timestamp = Date.now();
    const signedPayload = this.signPayload(`${timestamp}.${JSON.stringify(payload)}`, deviceKeys.privateKey);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'X-Zeta-Timestamp': timestamp.toString(),
          'X-Zeta-Signature': signedPayload,
          'X-Device-Id': deviceKeys.deviceId || '',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Login API Response', { 
        status: response.status, 
        statusText: response.statusText,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Successfully logged in with device keys');
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get portfolio positions
   */
  async getPortfolioPositions(sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/account/positions`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Portfolio Positions API Response', { 
        status: response.status, 
        statusText: response.statusText,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Portfolio positions retrieved successfully');
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Get portfolio summary/overview
   */
  async getPortfolioSummary(sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/account/overview`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Portfolio Summary API Response', { 
        status: response.status, 
        statusText: response.statusText,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Portfolio summary retrieved successfully');
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Get instrument/stock information by ISIN
   */
  async getInstrumentInfo(isin: string, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/instrument/${isin}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Instrument Info API Response', { 
        status: response.status, 
        statusText: response.statusText,
        isin,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Instrument info retrieved successfully', { isin });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Search for instruments/stocks
   */
  async searchInstruments(query: string, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/search?q=${encodeURIComponent(query)}&limit=20`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Search Instruments API Response', { 
        status: response.status, 
        statusText: response.statusText,
        query,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Instrument search completed successfully', { query });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  // ===== TRADING OPERATIONS =====

  /**
   * Place a buy order
   */
  async placeBuyOrder(orderData: {
    isin: string;
    quantity?: number;
    amount?: number; // Either quantity or amount must be specified
    orderType: 'market' | 'limit';
    limitPrice?: number; // Required for limit orders
    venue: string; // Trading venue (e.g., 'XETRA', 'LSE')
  }, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/orders/buy`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Buy Order API Response', { 
        status: response.status, 
        statusText: response.statusText,
        orderData,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Buy order placed successfully', { 
          isin: orderData.isin,
          orderId: data.orderId 
        });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Place a sell order
   */
  async placeSellOrder(orderData: {
    isin: string;
    quantity: number;
    orderType: 'market' | 'limit';
    limitPrice?: number; // Required for limit orders
    venue: string; // Trading venue
  }, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/orders/sell`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Sell Order API Response', { 
        status: response.status, 
        statusText: response.statusText,
        orderData,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Sell order placed successfully', { 
          isin: orderData.isin,
          orderId: data.orderId 
        });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(sessionToken: string, filters?: {
    startDate?: string; // ISO date string
    endDate?: string;
    status?: 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial';
    side?: 'buy' | 'sell';
    isin?: string;
    limit?: number;
    offset?: number;
  }): Promise<TRApiResponse> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.side) params.set('side', filters.side);
    if (filters?.isin) params.set('isin', filters.isin);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    if (filters?.offset) params.set('offset', filters.offset.toString());

    const url = `${this.baseUrl}/api/v1/orders/history?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Order History API Response', { 
        status: response.status, 
        statusText: response.statusText,
        filters,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Order history retrieved successfully');
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/orders/${orderId}/cancel`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Cancel Order API Response', { 
        status: response.status, 
        statusText: response.statusText,
        orderId,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Order cancelled successfully', { orderId });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  // ===== LIVE MARKET DATA =====

  /**
   * Get real-time price for instrument
   */
  async getRealTimePrice(isin: string, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/instrument/${isin}/price/realtime`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Real-time Price API Response', { 
        status: response.status, 
        statusText: response.statusText,
        isin,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Real-time price retrieved successfully', { isin });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(isin: string, period: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y', sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/instrument/${isin}/price/history?period=${period}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Historical Prices API Response', { 
        status: response.status, 
        statusText: response.statusText,
        isin,
        period,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Historical prices retrieved successfully', { isin, period });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Get market news for instrument or general market
   */
  async getMarketNews(sessionToken: string, isin?: string, limit: number = 20): Promise<TRApiResponse> {
    const params = new URLSearchParams();
    if (isin) params.set('isin', isin);
    params.set('limit', limit.toString());

    const url = `${this.baseUrl}/api/v1/news?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Market News API Response', { 
        status: response.status, 
        statusText: response.statusText,
        isin,
        limit,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Market news retrieved successfully', { 
          isin: isin || 'general',
          count: data.articles?.length || 0 
        });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Get watchlist
   */
  async getWatchlist(sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/watchlist`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Watchlist API Response', { 
        status: response.status, 
        statusText: response.statusText,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Watchlist retrieved successfully');
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Add instrument to watchlist
   */
  async addToWatchlist(isin: string, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/watchlist/add`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ isin }),
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Add to Watchlist API Response', { 
        status: response.status, 
        statusText: response.statusText,
        isin,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Added to watchlist successfully', { isin });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }

  /**
   * Remove instrument from watchlist
   */
  async removeFromWatchlist(isin: string, sessionToken: string): Promise<TRApiResponse> {
    const url = `${this.baseUrl}/api/v1/watchlist/remove`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ isin }),
        signal: AbortSignal.timeout(this.timeout),
      });

      const data = await response.json() as any;

      logger.debug('Remove from Watchlist API Response', { 
        status: response.status, 
        statusText: response.statusText,
        isin,
        data: data 
      });

      if (response.ok) {
        logger.info('✅ Removed from watchlist successfully', { isin });
        return { data };
      } else {
        return {
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            details: data,
          },
        };
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthenticationError('Network error - check your internet connection', 'NETWORK_ERROR');
      }
      throw error;
    }
  }
}
