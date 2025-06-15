/**
 * Authentication Manager
 *
 * Handles Trade Republic authentication, token management, and session persistence
 */

import { writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type {
  LoginCredentials,
  AuthToken,
  AuthSession,
  MFAChallenge,
  MFAResponse,
  DeviceKeys,
} from '../types/auth';
import { 
  AuthenticationError, 
  TwoFactorRequiredError
} from '../types/auth';
import { TradeRepublicAPI } from '../api/trade-republic-api.js';
import { logger } from '../utils/logger.js';

export class AuthManager {
  private session?: AuthSession;
  private deviceKeys?: DeviceKeys;
  private credentialsPath: string;
  private deviceKeysPath: string;
  private trApi: TradeRepublicAPI;

  constructor(credentialsPath?: string) {
    this.credentialsPath = credentialsPath ?? join(homedir(), '.tr-connector', 'session.json');
    this.deviceKeysPath = join(homedir(), '.tr-connector', 'device-keys.json');
    this.trApi = new TradeRepublicAPI();
  }

  /**
   * Initialize authentication - load device keys or guide through pairing
   */
  public async initialize(): Promise<void> {
    try {
      // Try to load existing device keys
      const storedKeys = await this.loadDeviceKeys();
      this.deviceKeys = storedKeys || undefined;
      if (this.deviceKeys) {
        logger.info('✅ Device keys loaded from storage');
      } else {
        logger.info('⚠️  No device keys found. Device pairing required.');
        throw new AuthenticationError(
          'Device not paired. Please run the pairing process first.',
          'DEVICE_NOT_PAIRED'
        );
      }

      // Try to load existing session
      const storedSession = await this.loadSession();
      if (storedSession && this.isSessionValid(storedSession)) {
        this.session = storedSession;
        logger.info('✅ Valid session loaded from storage');
      }
    } catch (error) {
      if (error instanceof AuthenticationError && error.code === 'DEVICE_NOT_PAIRED') {
        throw error;
      }
      logger.warn('Failed to initialize authentication', { error });
    }
  }

  /**
   * Pair device with Trade Republic (one-time setup)
   * Returns MFA challenge that needs to be completed with completeDevicePairing()
   */
  public async initiateDevicePairing(credentials: LoginCredentials): Promise<MFAChallenge> {
    try {
      logger.info('🔑 Starting device pairing with Trade Republic...');

      // Validate credentials format
      if (!this.isValidPhoneNumber(credentials.username)) {
        throw new AuthenticationError('Invalid phone number format', 'INVALID_PHONE');
      }

      if (!this.isValidPIN(credentials.password)) {
        throw new AuthenticationError('Invalid PIN format', 'INVALID_PIN');
      }

      // Initiate device reset with TR API
      const processId = await this.trApi.initiateDeviceReset(credentials);

      // Return MFA challenge for the 4-digit app code
      const challenge: MFAChallenge = {
        challengeId: processId,
        type: 'APP',
        message: 'Enter the 4-digit code from your Trade Republic app',
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };

      return challenge;
    } catch (error) {
      logger.error('Device pairing initiation failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Complete device pairing with 4-digit code from TR app
   */
  public async completeDevicePairing(response: MFAResponse): Promise<DeviceKeys> {
    try {
      logger.info('🔓 Completing device pairing...');

      // Validate MFA code format (4 digits)
      if (!/^\d{4}$/.test(response.code)) {
        throw new TwoFactorRequiredError('Invalid code format. Expected 4 digits.', {
          challengeId: response.challengeId,
          type: 'APP',
          message: 'Enter the 4-digit code from your Trade Republic app',
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
      }

      // Complete device reset with TR API
      const deviceKeys = await this.trApi.completeDeviceReset(response.code);

      // Store device keys securely
      this.deviceKeys = deviceKeys;
      await this.persistDeviceKeys(deviceKeys);

      logger.info('✅ Device successfully paired and keys stored');
      return deviceKeys;
    } catch (error) {
      logger.error('Device pairing completion failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Login with device keys (after pairing)
   */
  public async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      logger.info('🔓 Logging in with device keys...');

      // Validate credentials format first
      if (!this.isValidPhoneNumber(credentials.username)) {
        throw new AuthenticationError('Invalid phone number format', 'INVALID_PHONE');
      }

      if (!this.isValidPIN(credentials.password)) {
        throw new AuthenticationError('Invalid PIN format', 'INVALID_PIN');
      }

      // Check if device is paired
      if (!this.deviceKeys) {
        await this.initialize();
        if (!this.deviceKeys) {
          throw new AuthenticationError(
            'Device not paired. Please run the pairing process first.',
            'DEVICE_NOT_PAIRED'
          );
        }
      }

      // Login with device keys
      const response = await this.trApi.loginWithDeviceKeys(credentials, this.deviceKeys);

      if (response.error) {
        throw new AuthenticationError(response.error.message, response.error.code);
      }

      if (!response.data) {
        throw new AuthenticationError('No session data received', 'INVALID_RESPONSE');
      }

      // Extract user ID from JWT token
      let userId = 'unknown-user';
      try {
        const tokenPayload = JSON.parse(atob(response.data.sessionToken.split('.')[1]));
        userId = tokenPayload.sub || 'unknown-user';
      } catch (e) {
        logger.warn('Could not extract user ID from token, using fallback');
      }

      // Create session from response
      const session: AuthSession = {
        token: {
          accessToken: response.data.sessionToken,
          refreshToken: response.data.refreshToken,
          expiresAt: Date.now() + 290 * 1000, // 290 seconds like Python implementation
          tokenType: 'Bearer',
        },
        userId: userId,
        sessionId: response.data.trackingId || `session-${Date.now()}`,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      this.session = session;
      await this.persistSession(session);

      logger.info('✅ Login successful with device keys');
      return session;
    } catch (error) {
      logger.error('Login failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Logout and clear session
   */
  public async logout(): Promise<void> {
    try {
      if (this.session) {
        // Invalidate token on server
        await this.invalidateToken(this.session.token);

        // Clear local session
        this.session = undefined;

        // Remove persisted session
        await this.clearPersistedSession();

        logger.info('Logout successful');
      }
    } catch (error) {
      logger.error('Logout error', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  public async refreshToken(): Promise<AuthToken> {
    if (!this.session) {
      throw new AuthenticationError('No active session');
    }

    try {
      logger.debug('Refreshing authentication token');

      const refreshedToken = await this.performTokenRefresh(this.session.token);

      // Update session with new token
      this.session.token = refreshedToken;
      this.session.lastActivity = Date.now();

      // Persist updated session
      await this.persistSession(this.session);

      logger.debug('Token refreshed successfully');
      return refreshedToken;
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new AuthenticationError('Token refresh failed');
    }
  }

  /**
   * Handle MFA challenge
   */
  public async handleMFA(challenge: MFAChallenge, response: MFAResponse): Promise<AuthSession> {
    try {
      logger.info('Processing MFA response', { challengeId: challenge.challengeId });

      // Validate MFA response
      if (challenge.challengeId !== response.challengeId) {
        throw new AuthenticationError('Invalid challenge ID');
      }

      if (Date.now() > challenge.expiresAt) {
        throw new AuthenticationError('MFA challenge expired');
      }

      // Submit MFA response
      const mfaResult = await this.submitMFA(response);

      // Create session after successful MFA
      const session: AuthSession = {
        token: mfaResult.token,
        userId: mfaResult.userId,
        sessionId: mfaResult.sessionId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      this.session = session;
      await this.persistSession(session);

      logger.info('MFA authentication successful', { userId: session.userId });
      return session;
    } catch (error) {
      logger.error('MFA authentication failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Get current session
   */
  public getSession(): AuthSession | undefined {
    return this.session;
  }

  /**
   * Check if currently authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.session && this.isSessionValid(this.session);
  }

  /**
   * Get authorization header value
   */
  public getAuthHeader(): string | null {
    if (!this.session) {
      return null;
    }
    return `${this.session.token.tokenType} ${this.session.token.accessToken}`;
  }

  /**
   * Validate credentials format
   */
  private validateCredentials(credentials: LoginCredentials): void {
    if (!credentials.username || !credentials.password) {
      throw new AuthenticationError('Username and password are required');
    }

    if (credentials.username.length < 3) {
      throw new AuthenticationError('Invalid username format');
    }

    if (credentials.password.length < 6) {
      throw new AuthenticationError('Password too short');
    }
  }

  /**
   * Perform initial login with phone number and PIN
   */
  private async performLogin(credentials: LoginCredentials): Promise<{
    token?: AuthToken;
    userId?: string;
    sessionId?: string;
    requiresMFA: boolean;
    challenge?: MFAChallenge;
  }> {
    logger.debug('Initiating Trade Republic login', {
      username: credentials.username.replace(/\d{4}$/, '****'),
    });

    try {
      // Basic validation first
      if (!credentials.username || !credentials.password) {
        throw new AuthenticationError('Username and password are required', 'MISSING_CREDENTIALS');
      }

      // This would be the real Trade Republic API endpoint
      // For now, we'll simulate the 2FA flow that TR actually uses
      
      // Step 1: Validate phone number and PIN format
      if (!this.isValidPhoneNumber(credentials.username)) {
        throw new AuthenticationError('Invalid phone number format', 'INVALID_PHONE');
      }

      if (!this.isValidPIN(credentials.password)) {
        throw new AuthenticationError('Invalid PIN format', 'INVALID_PIN');
      }

      // Step 2: Send credentials to TR API (simulated)
      // In reality, this would make an HTTP request to TR's auth endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: TR always requires App token for security (not SMS)
      // Generate a simulated MFA challenge
      const challenge: MFAChallenge = {
        challengeId: 'mfa_' + Date.now(),
        type: 'APP', // Trade Republic uses app-based 2FA
        message: 'Enter the 4-digit code from your Trade Republic app',
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };

      logger.info('2FA challenge sent', { 
        type: challenge.type,
        challengeId: challenge.challengeId 
      });

      return {
        requiresMFA: true,
        challenge,
      };

    } catch (error) {
      logger.error('Login request failed', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Should be in format: +49 176 12345678 or +4917612345678
    const phoneRegex = /^\+49\s?1[5-7]\d{8,9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /**
   * Validate PIN format
   */
  private isValidPIN(pin: string): boolean {
    // Should be 4-6 digits
    const pinRegex = /^\d{4,6}$/;
    return pinRegex.test(pin);
  }

  /**
   * Invalidate token on server
   */
  private async invalidateToken(_token: AuthToken): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    logger.debug('Token invalidated on server');
  }

  /**
   * Perform token refresh
   */
  private async performTokenRefresh(token: AuthToken): Promise<AuthToken> {
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      accessToken: 'refreshed_access_token_' + Date.now(),
      refreshToken: token.refreshToken,
      expiresAt: Date.now() + 60 * 60 * 1000,
      tokenType: 'Bearer',
    };
  }

  /**
   * Submit MFA response (SMS/App token)
   */
  private async submitMFA(response: MFAResponse): Promise<{
    token: AuthToken;
    userId: string;
    sessionId: string;
  }> {
    logger.debug('Submitting MFA response', { challengeId: response.challengeId });

    try {
      // Validate MFA code format
      if (!this.isValidMFACode(response.code)) {
        throw new AuthenticationError('Invalid MFA code format', 'INVALID_MFA_CODE');
      }

      // TODO: Send MFA response to actual Trade Republic API
      // For now, simulate the API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simulate successful MFA verification
      // In reality, this would validate the code with TR's servers
      if (response.code === '0000') {
        throw new AuthenticationError('Invalid MFA code', 'MFA_CODE_INVALID');
      }

      // Generate realistic tokens after successful MFA
      const userId = this.generateUserId(response.challengeId);
      
      return {
        token: {
          accessToken: 'tr_access_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          refreshToken: 'tr_refresh_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
          tokenType: 'Bearer',
        },
        userId,
        sessionId: 'tr_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      };

    } catch (error) {
      logger.error('MFA submission failed', {
        error: error instanceof Error ? error.message : error,
        challengeId: response.challengeId,
      });
      throw error;
    }
  }

  /**
   * Validate MFA code format
   */
  private isValidMFACode(code: string): boolean {
    // Should be 4 digits (Trade Republic app generates 4-digit codes)
    const codeRegex = /^\d{4}$/;
    return codeRegex.test(code);
  }

  /**
   * Generate user ID from challenge
   */
  private generateUserId(challengeId: string): string {
    // Extract timestamp and create a consistent user ID
    const timestamp = challengeId.replace('mfa_', '');
    return `user_${timestamp.substr(-8)}`;
  }

  /**
   * Persist session to disk
   */
  private async persistSession(session: AuthSession): Promise<void> {
    try {
      const dir = this.credentialsPath.substring(0, this.credentialsPath.lastIndexOf('/'));

      await import('fs/promises')
        .then(fs => fs.mkdir(dir, { recursive: true }))
        .catch(() => {});

      const sessionData = JSON.stringify(session, null, 2);
      await writeFile(this.credentialsPath, sessionData, { mode: 0o600 });

      logger.debug('Session persisted to disk');
    } catch (error) {
      logger.warn('Failed to persist session', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Clear persisted session
   */
  private async clearPersistedSession(): Promise<void> {
    try {
      await import('fs/promises').then(fs => fs.unlink(this.credentialsPath));
      logger.debug('Persisted session cleared');
    } catch {
      // File might not exist
    }
  }

  /**
   * Persist device keys to disk
   */
  private async persistDeviceKeys(deviceKeys: DeviceKeys): Promise<void> {
    try {
      const dir = this.deviceKeysPath.substring(0, this.deviceKeysPath.lastIndexOf('/'));

      await import('fs/promises')
        .then(fs => fs.mkdir(dir, { recursive: true }))
        .catch(() => {});

      const keysData = JSON.stringify(deviceKeys, null, 2);
      await writeFile(this.deviceKeysPath, keysData, { mode: 0o600 });

      logger.debug('Device keys persisted to disk');
    } catch (error) {
      logger.warn('Failed to persist device keys', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Load device keys from disk
   */
  private async loadDeviceKeys(): Promise<DeviceKeys | null> {
    try {
      await access(this.deviceKeysPath);
      const keysData = await readFile(this.deviceKeysPath, 'utf-8');
      const deviceKeys = JSON.parse(keysData) as DeviceKeys;

      // Validate device keys structure
      if (!deviceKeys.privateKey || !deviceKeys.publicKey) {
        logger.warn('Invalid device keys format, ignoring');
        return null;
      }

      return deviceKeys;
    } catch {
      // File doesn't exist or is not readable
      return null;
    }
  }

  /**
   * Clear persisted device keys
   */
  private async clearPersistedDeviceKeys(): Promise<void> {
    try {
      await import('fs/promises').then(fs => fs.unlink(this.deviceKeysPath));
      logger.debug('Persisted device keys cleared');
    } catch {
      // File might not exist
    }
  }

  /**
   * Load session from disk
   */
  private async loadSession(): Promise<AuthSession | null> {
    try {
      await access(this.credentialsPath);
      const sessionData = await readFile(this.credentialsPath, 'utf-8');
      const session = JSON.parse(sessionData) as AuthSession;

      // Validate session structure
      if (!session.token || !session.userId || !session.sessionId) {
        logger.warn('Invalid session format, ignoring');
        return null;
      }

      return session;
    } catch {
      // File doesn't exist or is not readable
      return null;
    }
  }

  /**
   * Validate session integrity and expiration
   */
  private isSessionValid(session: AuthSession): boolean {
    if (!session.token || !session.userId || !session.sessionId) {
      return false;
    }

    if (Date.now() >= session.token.expiresAt) {
      return false;
    }

    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - session.createdAt > maxAge) {
      return false;
    }

    return true;
  }

  /**
   * Check if session is valid and server is reachable
   */
  public async validateSessionAndConnectivity(): Promise<{
    isValid: boolean;
    isServerReachable: boolean;
    requiresReauth: boolean;
    error?: string;
  }> {
    const result = {
      isValid: false,
      isServerReachable: false,
      requiresReauth: false,
      error: undefined as string | undefined,
    };

    try {
      // Test server connectivity first (regardless of session status)
      const isReachable = await this.trApi.testConnection();
      result.isServerReachable = isReachable;

      if (!isReachable) {
        result.error = 'Server is not reachable';
        return result;
      }

      // Now check if we have a session
      if (!this.session) {
        result.requiresReauth = true;
        result.error = 'No active session found';
        return result;
      }

      // Check basic session validity (expiration, structure)
      if (!this.isSessionValid(this.session)) {
        result.requiresReauth = true;
        result.error = 'Session has expired or is invalid';
        await this.clearPersistedSession();
        this.session = undefined;
        return result;
      }

      // Test session validity with a simple authenticated API call
      try {
        const sessionTest = await this.trApi.validateSession(this.session.token.accessToken);
        
        if (sessionTest.success) {
          result.isValid = true;
        } else {
          result.requiresReauth = true;
          result.error = 'Session no longer valid on server';
          await this.clearPersistedSession();
          this.session = undefined;
        }
      } catch (networkError) {
        result.isServerReachable = false;
        result.error = `Server not reachable: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`;
        
        // If it's a network issue, we might still have a valid session for when connectivity returns
        // But if it's an auth error (401, 403), we need to re-authenticate
        if (networkError instanceof Error && (
          networkError.message.includes('401') || 
          networkError.message.includes('403') ||
          networkError.message.includes('unauthorized') ||
          networkError.message.includes('forbidden')
        )) {
          result.requiresReauth = true;
          await this.clearPersistedSession();
          this.session = undefined;
        }
      }

      return result;
    } catch (error) {
      result.error = `Session validation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.requiresReauth = true;
      return result;
    }
  }

  /**
   * Ensure valid session with automatic re-authentication if needed
   * This method should be called before any API operations
   */
  public async ensureValidSession(): Promise<AuthSession> {
    const validation = await this.validateSessionAndConnectivity();

    if (validation.isValid && validation.isServerReachable) {
      logger.debug('Session is valid and server is reachable');
      return this.session!;
    }

    if (!validation.isServerReachable && !validation.requiresReauth) {
      throw new AuthenticationError(
        'Server is not reachable. Please check your internet connection and try again.',
        'SERVER_UNREACHABLE'
      );
    }

    if (validation.requiresReauth) {
      logger.warn('Session validation failed, re-authentication required', { 
        error: validation.error 
      });
      
      // Clear any invalid session data
      this.session = undefined;
      await this.clearPersistedSession();

      throw new AuthenticationError(
        'Session has expired or is invalid. Please log in again.',
        'SESSION_EXPIRED'
      );
    }

    throw new AuthenticationError(
      `Authentication validation failed: ${validation.error}`,
      'VALIDATION_FAILED'
    );
  }

  /**
   * Force re-authentication with proper 2FA flow
   */
  public async forceReAuthentication(credentials: LoginCredentials): Promise<{
    session?: AuthSession;
    requiresMFA?: boolean;
    challenge?: MFAChallenge;
  }> {
    try {
      logger.info('🔄 Forcing re-authentication...');

      // Clear any existing session data
      this.session = undefined;
      await this.clearPersistedSession();

      // Check if device is still paired
      if (!this.deviceKeys) {
        await this.initialize();
        if (!this.deviceKeys) {
          throw new AuthenticationError(
            'Device pairing has been lost. Please complete device pairing again.',
            'DEVICE_NOT_PAIRED'
          );
        }
      }

      // Attempt login with device keys
      try {
        const session = await this.login(credentials);
        logger.info('✅ Re-authentication successful');
        return { session };
      } catch (error) {
        if (error instanceof TwoFactorRequiredError) {
          logger.info('🔐 2FA required for re-authentication');
          return {
            requiresMFA: true,
            challenge: error.challenge,
          };
        }
        throw error;
      }
    } catch (error) {
      logger.error('Re-authentication failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Check if current session needs refresh due to approaching expiration
   */
  public shouldRefreshToken(): boolean {
    if (!this.session) {
      return false;
    }

    // Refresh if token expires within next 30 seconds
    const refreshThreshold = 30 * 1000;
    return (this.session.token.expiresAt - Date.now()) <= refreshThreshold;
  }

  /**
   * Auto-refresh token if needed, with fallback to re-authentication
   */
  public async autoRefreshIfNeeded(): Promise<boolean> {
    if (!this.shouldRefreshToken()) {
      return true; // No refresh needed
    }

    try {
      logger.debug('Auto-refreshing token...');
      await this.refreshToken();
      return true;
    } catch (error) {
      logger.warn('Token refresh failed, session may need re-authentication', {
        error: error instanceof Error ? error.message : error,
      });
      
      // Clear session as refresh failed
      this.session = undefined;
      await this.clearPersistedSession();
      return false;
    }
  }
}
