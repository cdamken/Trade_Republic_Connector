/**
 * Working Trade Republic API Client
 * 
 * Based on discovered working endpoints from API testing
 */

import { HttpClient } from './http-client.js';
import { DEFAULT_CONFIG } from '../config/config.js';
import type { TradeRepublicConfig } from '../config/config.js';
import type { LoginCredentials, AuthSession, MFAChallenge, MFAResponse } from '../types/auth.js';
import { logger } from '../utils/logger.js';

export interface TRAuthResponse {
  processId?: string;
  countdownInSeconds?: number;
  '2fa'?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  errors?: Array<{
    errorCode: string;
    errorMessage?: string;
    meta?: any;
  }>;
}

export class WorkingTradeRepublicAPI {
  private httpClient: HttpClient;
  private config: TradeRepublicConfig;
  private baseUrl: string;

  constructor(config?: Partial<TradeRepublicConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.httpClient = new HttpClient(this.config);
    this.baseUrl = this.config.apiUrl;
  }

  /**
   * Initiate authentication - triggers 2FA (SMS or APP)
   */
  async initiateAuth(credentials: LoginCredentials): Promise<{ processId: string; method: string; countdown: number }> {
    try {
      logger.info('Initiating Trade Republic authentication...');

      const response = await fetch(`${this.baseUrl}/api/v1/auth/web/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Trade-Republic-Connector/1.0.0',
          'Accept': 'application/json',
          'Origin': 'https://app.traderepublic.com',
          'Referer': 'https://app.traderepublic.com/'
        },
        body: JSON.stringify({
          phoneNumber: credentials.username,
          pin: credentials.password
        })
      });

      const data: TRAuthResponse = await response.json();
      
      if (!response.ok) {
        if (data.errors && data.errors[0]?.errorCode === 'TOO_MANY_REQUESTS') {
          const retryAfter = data.errors[0].meta?.nextAttemptInSeconds || 60;
          throw new Error(`Rate limited. Try again in ${retryAfter} seconds.`);
        }
        throw new Error(`Authentication failed: ${data.errors?.[0]?.errorCode || response.statusText}`);
      }

      if (!data.processId) {
        throw new Error('No process ID received from Trade Republic');
      }

      logger.info('Authentication initiated successfully', {
        processId: data.processId,
        method: data['2fa'],
        countdown: data.countdownInSeconds
      });

      return {
        processId: data.processId,
        method: data['2fa'] || 'Unknown',
        countdown: data.countdownInSeconds || 120
      };

    } catch (error) {
      logger.error('Authentication initiation failed', { error });
      throw error;
    }
  }

  /**
   * Complete authentication with 4-digit code
   */
  async completeAuth(processId: string, code: string): Promise<AuthSession> {
    try {
      logger.info('Completing Trade Republic authentication...');

      if (!/^\d{4}$/.test(code)) {
        throw new Error('Invalid code format. Trade Republic uses 4-digit codes.');
      }

      const response = await fetch(`${this.baseUrl}/api/v1/auth/web/login/${processId}/tan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Trade-Republic-Connector/1.0.0',
          'Accept': 'application/json',
          'Origin': 'https://app.traderepublic.com',
          'Referer': 'https://app.traderepublic.com/'
        },
        body: JSON.stringify({
          tan: code
        })
      });

      const data: TRAuthResponse = await response.json();
      
      if (!response.ok || !data.accessToken) {
        throw new Error(`2FA completion failed: ${data.errors?.[0]?.errorCode || response.statusText}`);
      }

      // Extract user ID from JWT token
      let userId = 'unknown-user';
      try {
        const tokenPayload = JSON.parse(atob(data.accessToken.split('.')[1]));
        userId = tokenPayload.sub || tokenPayload.userId || 'unknown-user';
      } catch (e) {
        logger.warn('Could not extract user ID from token');
      }

      const session: AuthSession = {
        token: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || '',
          expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
          tokenType: 'Bearer' as const,
        },
        userId: userId,
        sessionId: processId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      logger.info('Authentication completed successfully', { userId: session.userId });
      return session;

    } catch (error) {
      logger.error('Authentication completion failed', { error });
      throw error;
    }
  }

  /**
   * Full authentication flow (convenience method)
   */
  async authenticate(credentials: LoginCredentials, codeCallback: (challenge: MFAChallenge) => Promise<string>): Promise<AuthSession> {
    // Step 1: Initiate authentication
    const authResult = await this.initiateAuth(credentials);
    
    // Step 2: Create MFA challenge for callback
    const challenge: MFAChallenge = {
      challengeId: authResult.processId,
      type: authResult.method === 'SMS' ? 'SMS' : 'APP',
      message: `Enter the 4-digit code from Trade Republic ${authResult.method === 'SMS' ? 'SMS' : 'app'}`,
      expiresAt: Date.now() + authResult.countdown * 1000,
      length: 4, // Trade Republic always uses 4-digit codes
    };
    
    // Step 3: Get code from callback
    const code = await codeCallback(challenge);
    
    // Step 4: Complete authentication
    return this.completeAuth(authResult.processId, code);
  }
}
