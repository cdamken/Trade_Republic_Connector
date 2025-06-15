/**
 * Real Trade Republic API Implementation
 * Based on working implementations from pytr and unofficial APIs
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import crypto from 'crypto';
import { AuthenticationError, TwoFactorRequiredError, RateLimitError } from '../types/auth.js';
import type { LoginCredentials, MFAChallenge, DeviceKeys } from '../types/auth.js';
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
}
