/**
 * Authentication Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthManager, AuthenticationError } from '../src/auth/manager';
import type { LoginCredentials, MFAChallenge, MFAResponse } from '../src/types/auth';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

// Mock os
vi.mock('os', () => ({
  homedir: () => '/mock/home',
}));

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should require MFA for valid credentials', async () => {
      const credentials: LoginCredentials = {
        username: '+49 176 12345678',
        password: '1234', // Valid 4-digit PIN
      };

      await expect(authManager.login(credentials)).rejects.toThrow('MFA authentication required');
    });

    it('should reject invalid credentials', async () => {
      const credentials: LoginCredentials = {
        username: '',
        password: 'short',
      };

      await expect(authManager.login(credentials)).rejects.toThrow(AuthenticationError);
    });

    it('should reject credentials with short username', async () => {
      const credentials: LoginCredentials = {
        username: 'ab',
        password: 'validpassword',
      };

      await expect(authManager.login(credentials)).rejects.toThrow('Invalid phone number format');
    });

    it('should reject credentials with short password', async () => {
      const credentials: LoginCredentials = {
        username: '+49 176 12345678',
        password: '12', // Too short for PIN
      };

      await expect(authManager.login(credentials)).rejects.toThrow('Invalid PIN format');
    });

    it('should reject invalid phone number format', async () => {
      const credentials: LoginCredentials = {
        username: 'validuser',
        password: '1234', // Valid PIN but invalid phone
      };

      await expect(authManager.login(credentials)).rejects.toThrow('Invalid phone number format');
    });
  });

  describe('MFA handling', () => {
    it('should handle MFA challenge successfully', async () => {
      const challenge: MFAChallenge = {
        challengeId: 'challenge_123',
        type: 'SMS',
        message: 'Enter SMS code',
        expiresAt: Date.now() + 300000, // 5 minutes
      };

      const response: MFAResponse = {
        challengeId: 'challenge_123',
        code: '1234',
      };

      const session = await authManager.handleMFA(challenge, response);

      expect(session).toBeDefined();
      expect(session.userId).toBe('user_enge_123');
      expect(session.token).toBeDefined();
      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('should reject MFA with invalid challenge ID', async () => {
      const challenge: MFAChallenge = {
        challengeId: 'challenge_123',
        type: 'SMS',
        message: 'Enter SMS code',
        expiresAt: Date.now() + 300000,
      };

      const response: MFAResponse = {
        challengeId: 'different_challenge',
        code: '1234',
      };

      await expect(authManager.handleMFA(challenge, response)).rejects.toThrow('Invalid challenge ID');
    });

    it('should reject expired MFA challenge', async () => {
      const challenge: MFAChallenge = {
        challengeId: 'challenge_123',
        type: 'SMS',
        message: 'Enter SMS code',
        expiresAt: Date.now() - 1000, // Expired
      };

      const response: MFAResponse = {
        challengeId: 'challenge_123',
        code: '1234',
      };

      await expect(authManager.handleMFA(challenge, response)).rejects.toThrow('MFA challenge expired');
    });
  });

  describe('token management', () => {
    beforeEach(async () => {
      // Set up authenticated session using MFA flow
      const challenge: MFAChallenge = {
        challengeId: 'setup_challenge',
        type: 'SMS',
        message: 'Setup code',
        expiresAt: Date.now() + 300000,
      };

      const response: MFAResponse = {
        challengeId: 'setup_challenge',
        code: '1234',
      };

      await authManager.handleMFA(challenge, response);
    });

    it('should refresh token successfully', async () => {
      const originalToken = authManager.getSession()?.token.accessToken;
      
      const newToken = await authManager.refreshToken();
      
      expect(newToken).toBeDefined();
      expect(newToken.accessToken).toContain('refreshed_access_token_');
      expect(newToken.accessToken).not.toBe(originalToken);
    });

    it('should fail to refresh token without session', async () => {
      await authManager.logout();
      
      await expect(authManager.refreshToken()).rejects.toThrow('No active session');
    });

    it('should return authorization header', () => {
      const authHeader = authManager.getAuthHeader();
      
      expect(authHeader).toBeDefined();
      expect(authHeader).toMatch(/^Bearer tr_access_/);
    });

    it('should return null auth header when not authenticated', async () => {
      await authManager.logout();
      
      const authHeader = authManager.getAuthHeader();
      
      expect(authHeader).toBeNull();
    });
  });

  describe('session management', () => {
    it('should not be authenticated initially', () => {
      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should return undefined session when not authenticated', () => {
      expect(authManager.getSession()).toBeUndefined();
    });

    it('should logout successfully', async () => {
      // Set up authenticated session using MFA flow
      const challenge: MFAChallenge = {
        challengeId: 'logout_test_challenge',
        type: 'SMS',
        message: 'Logout test code',
        expiresAt: Date.now() + 300000,
      };

      const response: MFAResponse = {
        challengeId: 'logout_test_challenge',
        code: '1234',
      };

      await authManager.handleMFA(challenge, response);
      
      expect(authManager.isAuthenticated()).toBe(true);
      
      // Logout
      await authManager.logout();
      
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getSession()).toBeUndefined();
    });
  });

  describe('session persistence', () => {
    it('should handle missing session file gracefully', async () => {
      const { access } = await import('fs/promises');
      vi.mocked(access).mockRejectedValue(new Error('File not found'));

      const session = await authManager.loadSession();
      
      expect(session).toBeNull();
    });

    it('should handle corrupted session file gracefully', async () => {
      const { access, readFile } = await import('fs/promises');
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('invalid json');

      const session = await authManager.loadSession();
      
      expect(session).toBeNull();
    });
  });
});
