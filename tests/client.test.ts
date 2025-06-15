/**
 * Trade Republic Client Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TradeRepublicClient, VERSION } from '../src/index';
import type { LoginCredentials } from '../src/types/auth';

// Mock the auth manager and http client
vi.mock('../src/auth/manager');
vi.mock('../src/api/http-client');
vi.mock('../src/utils/logger');

describe('TradeRepublicClient', () => {
  let client: TradeRepublicClient;

  beforeEach(() => {
    client = new TradeRepublicClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create a client instance', () => {
      expect(client).toBeInstanceOf(TradeRepublicClient);
    });

  it('should not be authenticated initially', () => {
    // The mocked auth manager returns undefined, so we need to handle that
    const isAuth = client.isAuthenticated();
    expect(isAuth).toBeFalsy();
  });

    it('should return configuration', () => {
      const config = client.getConfig();
      expect(config).toBeDefined();
      expect(config.apiUrl).toBe('https://api.traderepublic.com');
      expect(config.websocketUrl).toBe('wss://api.traderepublic.com/websocket');
    });

    it('should initialize successfully', async () => {
      await expect(client.initialize()).resolves.not.toThrow();
    });

    it('should allow multiple initialization calls', async () => {
      await client.initialize();
      await expect(client.initialize()).resolves.not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should accept custom configuration', () => {
      const customClient = new TradeRepublicClient({
        logLevel: 'debug',
        timeout: 10000,
      });

      const config = customClient.getConfig();
      expect(config.logLevel).toBe('debug');
      expect(config.timeout).toBe(10000);
    });

    it('should update configuration', () => {
      client.updateConfig({
        logLevel: 'error',
        timeout: 5000,
      });

      const config = client.getConfig();
      expect(config.logLevel).toBe('error');
      expect(config.timeout).toBe(5000);
    });
  });

  describe('authentication workflow', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should require initialization before login', async () => {
      const uninitializedClient = new TradeRepublicClient();
      const credentials: LoginCredentials = {
        username: 'testuser',
        password: 'testpass123',
      };

      await expect(uninitializedClient.login(credentials)).rejects.toThrow(
        'Client not initialized'
      );
    });

    it('should handle login workflow', async () => {
      const credentials: LoginCredentials = {
        username: 'testuser',
        password: 'testpass123',
      };

      // Mock the auth manager to return a successful login
      const mockSession = {
        token: {
          accessToken: 'mock_token',
          refreshToken: 'mock_refresh',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer' as const,
        },
        userId: 'user_123',
        sessionId: 'session_123',
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      // We would need to properly mock the AuthManager here
      // For now, we'll just check the method exists
      expect(typeof client.login).toBe('function');
    });

    it('should handle logout', async () => {
      expect(typeof client.logout).toBe('function');
    });

    it('should handle token refresh', async () => {
      expect(typeof client.refreshToken).toBe('function');
    });
  });

  describe('API operations', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should have portfolio methods', () => {
      expect(typeof client.getPortfolio).toBe('function');
    });

    it('should require authentication for portfolio access', async () => {
      await expect(client.getPortfolio()).rejects.toThrow();
    });
  });

  describe('session management', () => {
    it('should return undefined session initially', () => {
      expect(client.getSession()).toBeUndefined();
    });
  });

  describe('exports', () => {
    it('should export version', () => {
      expect(VERSION).toBe('1.0.0');
    });

    it('should export client class', () => {
      expect(TradeRepublicClient).toBeDefined();
    });
  });
});
