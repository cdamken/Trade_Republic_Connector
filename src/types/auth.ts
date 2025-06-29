/**
 * Authentication Types
 *
 * TypeScript definitions for Trade Republic authentication
 */

export interface LoginCredentials {
  username: string;
  password: string;
  pin?: string;
  preferredMfaMethod?: 'SMS' | 'APP'; // User's preferred 2FA method
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

export interface AuthSession {
  token: AuthToken;
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
}

export interface LoginResult {
  success: boolean;
  session?: AuthSession;
  requiresMFA?: boolean;
  challenge?: MFAChallenge;
}

export interface MFAChallenge {
  challengeId: string;
  type: 'SMS' | 'APP';
  message: string;
  expiresAt: number;
  length: 4; // Trade Republic always uses 4-digit codes
}

export interface MFAResponse {
  challengeId: string;
  code: string;
}

export interface DeviceKeys {
  privateKey: string;
  publicKey: string;
  deviceId?: string;
}

export class AuthenticationError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string = 'AUTHENTICATION_ERROR', details?: any) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.details = details;
  }
}

export class TwoFactorRequiredError extends AuthenticationError {
  public readonly challenge?: MFAChallenge;

  constructor(message: string, challenge?: MFAChallenge) {
    super(message, 'TWO_FACTOR_REQUIRED');
    this.name = 'TwoFactorRequiredError';
    this.challenge = challenge;
  }
}

export class RateLimitError extends AuthenticationError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMITED');
    this.name = 'RateLimitError';
  }
}

export class SessionExpiredError extends AuthenticationError {
  constructor(message: string = 'Session has expired') {
    super(message, 'SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}
