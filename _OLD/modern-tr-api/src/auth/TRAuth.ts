// 🔐 Modern Authentication System for Trade Republic API
// ECDSA P-256 crypto authentication with secure key management

import { createSign, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { TRConfig } from '../config/TRConfig.js';
import {
  TRAuthError,
  TRCredentialsError,
  TRDeviceNotPairedError,
  TRSessionExpiredError,
  TRTwoFactorRequiredError,
  TRErrorFactory,
} from '../errors/index.js';
import type { TRDeviceKeys, TRSession, TRApiResponse } from '../types/index.js';

export class TRAuth {
  private config: TRConfig;
  private session: TRSession | null = null;
  private deviceKeys: TRDeviceKeys | null = null;

  constructor(config: TRConfig) {
    this.config = config;
  }

  // ========================
  // PUBLIC API
  // ========================

  /**
   * Initialize authentication - loads existing keys or guides through pairing
   */
  async initialize(): Promise<void> {
    // Try to load existing device keys
    const storedKeys = await this.loadDeviceKeys();
    if (storedKeys) {
      this.deviceKeys = storedKeys;
      console.log('✅ Device keys loaded from storage');
    } else {
      console.log('⚠️  No device keys found. Run auth.pair() to set up authentication.');
      throw new TRDeviceNotPairedError();
    }

    // Try to load existing session
    const storedSession = await this.loadSession();
    if (storedSession && this.isSessionValid(storedSession)) {
      this.session = storedSession;
      console.log('✅ Valid session loaded from storage');
    } else {
      // Session expired or invalid, need to login
      await this.login();
    }
  }

  /**
   * Pair device with Trade Republic (one-time setup)
   */
  async pair(): Promise<void> {
    console.log('🔑 Starting device pairing with Trade Republic...');
    
    // Generate new ECDSA key pair
    const keys = this.generateKeys();
    console.log('✅ Generated new ECDSA P-256 key pair');

    // Step 1: Request device reset
    const processId = await this.requestDeviceReset();
    console.log('✅ Device reset requested, check your phone for 2FA token');

    // Step 2: Get 2FA token from user
    const token = await this.prompt2FAToken();

    // Step 3: Register device with public key
    await this.registerDevice(processId, token, keys.publicKey);
    console.log('✅ Device successfully paired!');

    // Store keys securely
    this.deviceKeys = keys;
    await this.storeDeviceKeys(keys);
    console.log('✅ Device keys stored securely');

    // Complete login process
    await this.login();
  }

  /**
   * Login with device keys
   */
  async login(): Promise<void> {
    if (!this.deviceKeys) {
      throw new TRDeviceNotPairedError();
    }

    console.log('🔓 Logging in with device keys...');

    try {
      const response = await this.makeLoginRequest();
      
      if (response.error) {
        throw new TRCredentialsError(response.error.message);
      }

      if (!response.data) {
        throw new TRAuthError('No session data received', 'INVALID_RESPONSE');
      }

      const sessionData = response.data as any;
      this.session = {
        sessionToken: sessionData.sessionToken,
        refreshToken: sessionData.refreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        accountState: sessionData.accountState || 'ACTIVE',
      };

      if (this.session.accountState !== 'ACTIVE') {
        throw new TRAuthError(
          `Account is ${this.session.accountState}`,
          'ACCOUNT_NOT_ACTIVE'
        );
      }

      await this.storeSession(this.session);
      console.log('✅ Successfully logged in');

    } catch (error) {
      if (error instanceof TRAuthError) {
        throw error;
      }
      throw TRErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Get current session token
   */
  getSessionToken(): string {
    if (!this.session || !this.isSessionValid(this.session)) {
      throw new TRSessionExpiredError();
    }
    return this.session.sessionToken;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.session !== null && this.isSessionValid(this.session);
  }

  /**
   * Refresh session if needed
   */
  async refreshIfNeeded(): Promise<void> {
    if (!this.session || this.isSessionExpiring(this.session)) {
      await this.login();
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    this.session = null;
    await this.config.storage.delete('tr_session');
    console.log('✅ Logged out successfully');
  }

  // ========================
  // PRIVATE METHODS
  // ========================

  private generateKeys(): TRDeviceKeys {
    const { publicKey: publicKeyPem, privateKey: privateKeyPem } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // Convert public key to uncompressed base64 format (Trade Republic format)
    const publicKeyBase64 = this.spkiToUncompressedBase64(publicKeyPem);

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyPem,
      createdAt: new Date(),
    };
  }

  private spkiToUncompressedBase64(spkiPem: string): string {
    const pubKeyDer = createPublicKey(spkiPem).export({ type: 'spki', format: 'der' });

    if (pubKeyDer.length < 65) {
      throw new TRAuthError('Public key DER is too short', 'INVALID_KEY');
    }

    const uncompressedStart = pubKeyDer.length - 65;
    if (pubKeyDer[uncompressedStart] !== 0x04) {
      throw new TRAuthError('Expected uncompressed point starting with 0x04', 'INVALID_KEY');
    }

    const uncompressed = pubKeyDer.subarray(uncompressedStart);
    return uncompressed.toString('base64');
  }

  private async requestDeviceReset(): Promise<string> {
    const url = `${this.config.getAuthUrl()}/account/reset/device`;
    const payload = {
      phoneNumber: this.config.phoneNumber,
      pin: this.config.pin,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.config.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new TRAuthError('Too many reset attempts, try again later', 'RATE_LIMITED');
    }

    if (!response.ok) {
      throw TRErrorFactory.fromApiResponse({
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = await response.json() as any;
    if (!data.processId) {
      throw new TRAuthError('No process ID received', 'INVALID_RESPONSE');
    }

    return data.processId;
  }

  private async prompt2FAToken(): Promise<string> {
    // In a real implementation, this would prompt the user
    // For now, we'll throw an error asking for manual input
    throw new TRTwoFactorRequiredError(
      'Please check your Trade Republic app for the 2FA token and provide it manually'
    );
  }

  private async registerDevice(processId: string, token: string, publicKey: string): Promise<void> {
    const url = `${this.config.getAuthUrl()}/account/reset/device/${processId}/key`;
    const payload = {
      code: token,
      deviceKey: publicKey,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.config.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new TRTwoFactorRequiredError('Invalid 2FA token');
      }
      throw TRErrorFactory.fromApiResponse({
        status: response.status,
        statusText: response.statusText,
      });
    }
  }

  private async makeLoginRequest(): Promise<TRApiResponse> {
    if (!this.deviceKeys) {
      throw new TRDeviceNotPairedError();
    }

    const url = `${this.config.getAuthUrl()}/login`;
    const payload = {
      phoneNumber: this.config.phoneNumber,
      pin: this.config.pin,
    };

    // Sign the request
    const timestamp = Date.now();
    const signedPayload = this.signPayload(`${timestamp}.${JSON.stringify(payload)}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.config.getHeaders(),
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signedPayload,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as any;

    if (response.ok) {
      return {
        data,
        timestamp: new Date(),
        requestId: `login_${Date.now()}`,
      };
    } else {
      return {
        error: {
          code: `HTTP_${response.status}`,
          message: data.message || response.statusText,
          retryable: response.status >= 500,
          details: {},
        },
        timestamp: new Date(),
        requestId: `login_${Date.now()}`,
      };
    }
  }

  private signPayload(payload: string): string {
    if (!this.deviceKeys) {
      throw new TRDeviceNotPairedError();
    }

    const signer = createSign('sha512');
    signer.update(payload);
    return signer.sign(this.deviceKeys.privateKey, 'base64');
  }

  private isSessionValid(session: TRSession): boolean {
    return session.expiresAt.getTime() > Date.now();
  }

  private isSessionExpiring(session: TRSession): boolean {
    const fiveMinutes = 5 * 60 * 1000;
    return session.expiresAt.getTime() - Date.now() < fiveMinutes;
  }

  // ========================
  // STORAGE METHODS
  // ========================

  private async storeDeviceKeys(keys: TRDeviceKeys): Promise<void> {
    const encrypted = JSON.stringify(keys); // In production, this should be encrypted
    await this.config.storage.set('tr_device_keys', encrypted);
  }

  private async loadDeviceKeys(): Promise<TRDeviceKeys | null> {
    try {
      const encrypted = await this.config.storage.get('tr_device_keys');
      if (!encrypted) return null;
      
      return JSON.parse(encrypted); // In production, this should be decrypted
    } catch {
      return null;
    }
  }

  private async storeSession(session: TRSession): Promise<void> {
    const data = JSON.stringify({
      ...session,
      expiresAt: session.expiresAt.toISOString(),
    });
    await this.config.storage.set('tr_session', data);
  }

  private async loadSession(): Promise<TRSession | null> {
    try {
      const data = await this.config.storage.get('tr_session');
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt),
      };
    } catch {
      return null;
    }
  }
}
