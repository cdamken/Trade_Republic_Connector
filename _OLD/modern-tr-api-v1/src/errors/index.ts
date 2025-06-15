// 🚨 Comprehensive Error System for Trade Republic API
// Typed errors with actionable messages and recovery suggestions

export class TRError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    retryable = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TRError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    
    // Maintain proper stack trace in V8
    if ('captureStackTrace' in Error) {
      (Error as any).captureStackTrace(this, TRError);
    }
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      details: this.details,
      stack: this.stack,
    };
  }
}

// ========================
// AUTHENTICATION ERRORS
// ========================

export class TRAuthError extends TRError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, false, details);
    this.name = 'TRAuthError';
  }
}

export class TRCredentialsError extends TRAuthError {
  constructor(message = 'Invalid credentials provided') {
    super(message, 'INVALID_CREDENTIALS', {
      solution: 'Check your phone number and PIN'
    });
    this.name = 'TRCredentialsError';
  }
}

export class TRDeviceNotPairedError extends TRAuthError {
  constructor(message = 'Device not paired with Trade Republic') {
    super(message, 'DEVICE_NOT_PAIRED', {
      solution: 'Run the pairing process first: tr.auth.pair()'
    });
    this.name = 'TRDeviceNotPairedError';
  }
}

export class TRSessionExpiredError extends TRAuthError {
  constructor(message = 'Session token expired') {
    super(message, 'SESSION_EXPIRED', {
      solution: 'The client will automatically refresh the session'
    });
    this.name = 'TRSessionExpiredError';
  }
}

export class TRTwoFactorRequiredError extends TRAuthError {
  constructor(message = 'Two-factor authentication required') {
    super(message, 'TWO_FACTOR_REQUIRED', {
      solution: 'Complete 2FA verification'
    });
    this.name = 'TRTwoFactorRequiredError';
  }
}

// ========================
// CONNECTION ERRORS
// ========================

export class TRConnectionError extends TRError {
  constructor(message: string, code: string, retryable = true) {
    super(message, code, retryable, {
      solution: retryable ? 'Will retry automatically' : 'Check your internet connection'
    });
    this.name = 'TRConnectionError';
  }
}

export class TRNetworkError extends TRConnectionError {
  constructor(message = 'Network connection failed') {
    super(message, 'NETWORK_ERROR', true);
    this.name = 'TRNetworkError';
  }
}

export class TRTimeoutError extends TRConnectionError {
  constructor(message = 'Request timed out') {
    super(message, 'TIMEOUT', true);
    this.name = 'TRTimeoutError';
  }
}

export class TRWebSocketError extends TRConnectionError {
  constructor(message = 'WebSocket connection error') {
    super(message, 'WEBSOCKET_ERROR', true);
    this.name = 'TRWebSocketError';
  }
}

export class TRApiVersionError extends TRConnectionError {
  constructor(current: number, required: number) {
    const details = {
      current,
      required,
      solution: 'Update the API client to the latest version'
    };
    super(
      `API version mismatch: using ${current}, required ${required}`,
      'API_VERSION_MISMATCH',
      false
    );
    this.name = 'TRApiVersionError';
    (this as any).details = details;
  }
}

// ========================
// TRADING ERRORS
// ========================

export class TRTradingError extends TRError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, false, details);
    this.name = 'TRTradingError';
  }
}

export class TRInsufficientFundsError extends TRTradingError {
  constructor(required: number, available: number, currency: string) {
    super(
      `Insufficient funds: need ${required} ${currency}, have ${available} ${currency}`,
      'INSUFFICIENT_FUNDS',
      { required, available, currency }
    );
    this.name = 'TRInsufficientFundsError';
  }
}

export class TRInvalidOrderError extends TRTradingError {
  constructor(message: string, field?: string) {
    super(message, 'INVALID_ORDER', { field });
    this.name = 'TRInvalidOrderError';
  }
}

export class TRMarketClosedError extends TRTradingError {
  constructor(market: string) {
    super(
      `Market ${market} is currently closed`,
      'MARKET_CLOSED',
      { market, solution: 'Try again during market hours' }
    );
    this.name = 'TRMarketClosedError';
  }
}

export class TRInstrumentNotFoundError extends TRTradingError {
  constructor(isin: string) {
    super(
      `Instrument not found: ${isin}`,
      'INSTRUMENT_NOT_FOUND',
      { isin, solution: 'Check the ISIN code' }
    );
    this.name = 'TRInstrumentNotFoundError';
  }
}

// ========================
// API ERRORS
// ========================

export class TRApiError extends TRError {
  public readonly status: number | undefined;

  constructor(
    message: string,
    code: string,
    status?: number,
    retryable = false,
    details?: Record<string, unknown>
  ) {
    super(message, code, retryable, details);
    this.name = 'TRApiError';
    this.status = status;
  }
}

export class TRRateLimitError extends TRApiError {
  constructor(retryAfter?: number) {
    super(
      `Rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      429,
      true,
      { retryAfter }
    );
    this.name = 'TRRateLimitError';
  }
}

export class TRServerError extends TRApiError {
  constructor(message = 'Internal server error') {
    super(message, 'SERVER_ERROR', 500, true);
    this.name = 'TRServerError';
  }
}

export class TRMaintenanceError extends TRApiError {
  constructor(message = 'Service temporarily unavailable for maintenance') {
    super(message, 'MAINTENANCE', 503, true, {
      solution: 'Wait for maintenance to complete'
    });
    this.name = 'TRMaintenanceError';
  }
}

// ========================
// VALIDATION ERRORS
// ========================

export class TRValidationError extends TRError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', false, { field });
    this.name = 'TRValidationError';
  }
}

export class TRConfigError extends TRValidationError {
  constructor(message: string, setting?: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'TRConfigError';
    (this as any).details = { setting, solution: 'Check your configuration' };
  }
}

// ========================
// ERROR FACTORY
// ========================

export class TRErrorFactory {
  static fromApiResponse(response: {
    status: number;
    statusText: string;
    data?: { error?: string; message?: string; code?: string };
  }): TRError {
    const { status, statusText, data } = response;
    const message = data?.message || data?.error || statusText;
    const code = data?.code || `HTTP_${status}`;

    // Map HTTP status codes to specific errors
    switch (status) {
      case 400:
        return new TRValidationError(message);
      case 401:
        return new TRCredentialsError(message);
      case 403:
        return new TRAuthError(message, 'FORBIDDEN');
      case 404:
        return new TRApiError(message, 'NOT_FOUND', status);
      case 408:
        return new TRTimeoutError(message);
      case 429:
        return new TRRateLimitError();
      case 500:
        return new TRServerError(message);
      case 502:
      case 503:
        return new TRMaintenanceError(message);
      case 504:
        return new TRTimeoutError('Gateway timeout');
      default:
        return new TRApiError(message, code, status, status >= 500);
    }
  }

  static fromWebSocketError(error: unknown): TRError {
    if (error instanceof Error) {
      return new TRWebSocketError(error.message);
    }
    return new TRWebSocketError('WebSocket connection failed');
  }

  static fromNetworkError(error: Error): TRError {
    if (error.message.includes('timeout')) {
      return new TRTimeoutError(error.message);
    }
    if (error.message.includes('network')) {
      return new TRNetworkError(error.message);
    }
    return new TRConnectionError(error.message, 'CONNECTION_ERROR');
  }
}

// ========================
// ERROR UTILITIES
// ========================

export function isRetryableError(error: Error): boolean {
  return error instanceof TRError && error.retryable;
}

export function isAuthError(error: Error): boolean {
  return error instanceof TRAuthError;
}

export function isTradingError(error: Error): boolean {
  return error instanceof TRTradingError;
}

export function isConnectionError(error: Error): boolean {
  return error instanceof TRConnectionError;
}

export function getErrorSolution(error: Error): string | undefined {
  if (error instanceof TRError && error.details?.solution) {
    return error.details.solution as string;
  }
  return undefined;
}
