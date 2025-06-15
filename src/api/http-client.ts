/**
 * HTTP API Client
 *
 * Secure HTTP client for Trade Republic API with retry logic and rate limiting
 */

import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { TradeRepublicConfig } from '../config/config';
import { logger } from '../utils/logger';

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    // If we're at the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest) + 1;

      if (waitTime > 0) {
        logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.waitForSlot(); // Recursive retry
      }
    }

    // Add current request
    this.requests.push(now);
  }
}

export class HttpClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private config: TradeRepublicConfig;

  constructor(config: TradeRepublicConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimitRequests, config.rateLimitWindow);

    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers: {
        'User-Agent': config.userAgent,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // Security settings
      maxRedirects: 0, // Prevent redirect attacks
      validateStatus: status => status < 500, // Don't throw on 4xx errors
    });

    // Request interceptor for rate limiting and auth
    this.client.interceptors.request.use(
      async config => {
        await this.rateLimiter.waitForSlot();

        // Add request ID for tracing
        config.headers['X-Request-ID'] = this.generateRequestId();

        logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          requestId: config.headers['X-Request-ID'],
        });

        return config;
      },
      error => {
        logger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      response => {
        logger.debug('HTTP Response', {
          status: response.status,
          requestId: response.config.headers['X-Request-ID'],
          responseTime: this.calculateResponseTime(response),
        });
        return response;
      },
      error => {
        if (error.response) {
          logger.warn('HTTP Error Response', {
            status: error.response.status,
            statusText: error.response.statusText,
            requestId: error.config?.headers['X-Request-ID'],
            url: error.config?.url,
          });
        } else if (error.request) {
          logger.error('HTTP Request Failed', {
            message: 'No response received',
            requestId: error.config?.headers['X-Request-ID'],
            url: error.config?.url,
          });
        } else {
          logger.error('HTTP Client Error', { error: error.message });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authorization header
   */
  public setAuthHeader(authHeader: string | null): void {
    if (authHeader) {
      this.client.defaults.headers.Authorization = authHeader;
    } else {
      delete this.client.defaults.headers.Authorization;
    }
  }

  /**
   * GET request with retry logic
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>('GET', url, undefined, config);
  }

  /**
   * POST request with retry logic
   */
  public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>('POST', url, data, config);
  }

  /**
   * PUT request with retry logic
   */
  public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>('PUT', url, data, config);
  }

  /**
   * DELETE request with retry logic
   */
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>('DELETE', url, undefined, config);
  }

  /**
   * Generic request with retry logic
   */
  private async requestWithRetry<T>(
    method: string,
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
    retryCount = 0
  ): Promise<T> {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    try {
      let response: AxiosResponse;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await this.client.get(url, config);
          break;
        case 'POST':
          response = await this.client.post(url, data, config);
          break;
        case 'PUT':
          response = await this.client.put(url, data, config);
          break;
        case 'DELETE':
          response = await this.client.delete(url, config);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      // Check for successful response
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      // Handle non-successful responses
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      // Determine if we should retry
      const shouldRetry = this.shouldRetryRequest(error, retryCount, maxRetries);

      if (shouldRetry) {
        logger.warn(`Request failed, retrying in ${retryDelay}ms`, {
          method,
          url,
          attempt: retryCount + 1,
          maxRetries,
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.requestWithRetry<T>(method, url, data, config, retryCount + 1);
      }

      // Re-throw error if no retry
      throw error;
    }
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetryRequest(error: unknown, retryCount: number, maxRetries: number): boolean {
    if (retryCount >= maxRetries) {
      return false;
    }

    // Retry on network errors
    if (axios.isAxiosError(error)) {
      // Network error or timeout
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || !error.response) {
        return true;
      }

      // Retry on server errors (5xx)
      if (error.response && error.response.status >= 500) {
        return true;
      }

      // Retry on rate limiting (429)
      if (error.response && error.response.status === 429) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate response time from axios response
   */
  private calculateResponseTime(response: AxiosResponse): number | undefined {
    const requestStart = response.config.metadata?.startTime;
    if (requestStart) {
      return Date.now() - requestStart;
    }
    return undefined;
  }
}

// Extend axios config interface to include metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime?: number;
    };
  }
}
