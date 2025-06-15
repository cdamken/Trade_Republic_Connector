# Trade Republic API Reference

A comprehensive guide to the Trade Republic API connector, providing detailed documentation for authentication, data access, and integration patterns.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [WebSocket API](#websocket-api)
- [Data Models](#data-models)
- [Client Libraries](#client-libraries)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)
- [Code Examples](#code-examples)

---

## Getting Started

### Prerequisites

- Node.js 18+ or TypeScript 4.5+
- Valid Trade Republic account credentials
- Network access to `api.traderepublic.com`

### Installation

```bash
npm install
```

### Quick Start

```typescript
import { TradeRepublicClient } from './src/api/client';

const client = new TradeRepublicClient();

// Authenticate
await client.authenticate();

// Get real-time price data
const priceData = await client.getAssetPrice('US0378331005'); // Apple
console.log(priceData);
```

---

## Authentication

The Trade Republic API uses a multi-step authentication process involving device pairing and 2FA verification.

### Overview

1. **Device Pairing**: Initial login with phone number and PIN
2. **2FA Verification**: Complete authentication with SMS/app code
3. **Session Management**: Use tokens for subsequent requests

### Device Pairing Flow

**Endpoint**: `POST /api/v1/auth/web/login`

**Request**:
```http
POST /api/v1/auth/web/login
Content-Type: application/json

{
  "phoneNumber": "+4912345678901",
  "pin": "1234"
}
```

**Response**:
```json
{
  "processId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "MFA_REQUIRED"
}
```

### 2FA Completion

**Endpoint**: `POST /api/v1/auth/web/login/{processId}/tan`

**Request**:
```http
POST /api/v1/auth/web/login/550e8400-e29b-41d4-a716-446655440000/tan
Content-Type: application/json

{
  "tan": "123456"
}
```

**Response**:
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "def50200...",
  "sessionId": "session_123",
  "userId": "16f1ff6b-b686-4caf-bec3-ceed7ba1e556",
  "deviceId": "device_456"
}
```

### Authentication Headers

For authenticated requests, include these headers:

```http
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
User-Agent: Mozilla/5.0 (compatible; TR-Connector/1.0)
```

---

## WebSocket API

Real-time data is available through WebSocket connections. The WebSocket API provides live price feeds, market data, and subscription management.

### Connection

**Endpoint**: `wss://api.traderepublic.com/`

**Connection Headers**:
```http
Sec-WebSocket-Protocol: echo-protocol
Cookie: sessionId={sessionId}; deviceId={deviceId}
User-Agent: Mozilla/5.0 (compatible; TR-Connector/1.0)
```

### Message Format

All WebSocket messages follow this structure:

```typescript
interface WebSocketMessage {
  id: number;           // Request ID for correlation
  type: string;         // Message type
  payload?: any;        // Message payload (optional)
}
```

### Price Subscription

Subscribe to real-time price updates for an asset:

**Request**:
```json
{
  "id": 1,
  "type": "sub",
  "payload": {
    "type": "ticker",
    "id": "US0378331005.LSX"
  }
}
```

**Response**:
```json
{
  "type": "ticker",
  "bid": 150.25,
  "ask": 150.27,
  "last": 150.26,
  "timestamp": "2024-12-18T10:30:00.000Z",
  "isin": "US0378331005"
}
```

### Unsubscription

**Request**:
```json
{
  "id": 2,
  "type": "unsub",
  "payload": {
    "type": "ticker",
    "id": "US0378331005.LSX"
  }
}
```

---

## Data Models

### Asset

```typescript
interface Asset {
  isin: string;                    // International Securities Identification Number
  name: string;                    // Asset name
  symbol?: string;                 // Trading symbol
  type: 'stock' | 'etf' | 'bond';  // Asset type
  market: string;                  // Market identifier (US, DE, etc.)
  sector?: string;                 // Business sector
  currency: string;                // Trading currency
  exchange?: string;               // Exchange name
}
```

### Price Data

```typescript
interface PriceData {
  isin: string;           // Asset identifier
  timestamp: string;      // ISO 8601 timestamp
  price?: number;         // Last traded price
  bid?: number;          // Best bid price
  ask?: number;          // Best ask price
  open?: number;         // Opening price
  high?: number;         // Day high
  low?: number;          // Day low
  volume?: number;       // Trading volume
}
```

### Authentication Response

```typescript
interface AuthResponse {
  accessToken: string;    // JWT access token
  refreshToken: string;   // Refresh token
  sessionId: string;      // Session identifier
  userId: string;         // User identifier
  deviceId: string;       // Device identifier
  expiresIn?: number;     // Token expiry (seconds)
}
```

---

## Client Libraries

### TradeRepublicClient

Main client class for API interactions:

```typescript
class TradeRepublicClient {
  // Authentication
  authenticate(): Promise<void>
  logout(): Promise<void>
  
  // Asset data
  getAssetPrice(isin: string): Promise<PriceData>
  searchAssets(query: string): Promise<Asset[]>
  
  // Real-time subscriptions
  subscribeToPrices(isin: string, callback: (data: PriceData) => void): void
  unsubscribeFromPrices(isin: string): void
  
  // Connection management
  connect(): Promise<void>
  disconnect(): void
  isConnected(): boolean
}
```

### TradeRepublicAppInterface

Simplified interface for app integration:

```typescript
class TradeRepublicAppInterface {
  // Data access
  getAllAssets(): Promise<Asset[]>
  getAssetsByMarket(market: string): Promise<Asset[]>
  getRealTimePrice(isin: string): Promise<PriceData>
  searchAssets(query: string): Promise<Asset[]>
  
  // Data export
  exportData(format: 'json' | 'csv'): Promise<string>
  getCollectionStatus(): Promise<CollectionStatus>
}
```

---

## Error Handling

### Error Types

```typescript
interface APIError {
  code: string;           // Error code
  message: string;        // Human-readable message
  details?: any;          // Additional error details
  timestamp: string;      // Error timestamp
}
```

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTH_FAILED` | Authentication failed | Check credentials and retry |
| `INVALID_TOKEN` | Access token invalid/expired | Refresh token or re-authenticate |
| `RATE_LIMITED` | Too many requests | Implement backoff strategy |
| `BAD_SUBSCRIPTION_TYPE` | Invalid subscription type | Check subscription parameters |
| `NETWORK_ERROR` | Connection failure | Check network connectivity |
| `INVALID_ISIN` | Invalid asset identifier | Verify ISIN format |

### Error Handling Example

```typescript
try {
  const price = await client.getAssetPrice('US0378331005');
  console.log(price);
} catch (error) {
  if (error.code === 'AUTH_FAILED') {
    await client.authenticate();
    // Retry request
  } else if (error.code === 'RATE_LIMITED') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Retry with backoff
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

---

## Rate Limiting

### Limits

- **Authentication**: 5 requests per minute
- **Price subscriptions**: 50 concurrent subscriptions
- **Data requests**: Configurable rate limiting

### Best Practices

1. **Implement exponential backoff** for failed requests
2. **Batch requests** when possible
3. **Cache responses** to reduce API calls
4. **Monitor rate limit headers** in responses

### Rate Limiting Example

```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  
  async addRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      await request();
      await new Promise(resolve => setTimeout(resolve, 250)); // 4 req/sec
    }
    
    this.isProcessing = false;
  }
}
```

---

## Best Practices

### Security

1. **Store credentials securely** using environment variables
2. **Use HTTPS/WSS** for all connections
3. **Implement token refresh** logic
4. **Log security events** appropriately

### Performance

1. **Connection pooling** for WebSocket connections
2. **Efficient data structures** for large datasets
3. **Memory management** for long-running processes
4. **Graceful degradation** for network issues

### Reliability

1. **Retry logic** with exponential backoff
2. **Circuit breaker** pattern for failing services
3. **Health checks** for connection status
4. **Graceful shutdown** handling

---

## Code Examples

### Basic Price Monitoring

```typescript
import { TradeRepublicClient } from './src/api/client';

const client = new TradeRepublicClient();

async function monitorPrice(isin: string) {
  await client.authenticate();
  
  client.subscribeToPrices(isin, (data) => {
    console.log(`${data.isin}: ${data.price} at ${data.timestamp}`);
  });
  
  // Keep connection alive
  process.on('SIGINT', () => {
    client.disconnect();
    process.exit(0);
  });
}

monitorPrice('US0378331005'); // Apple
```

### Multi-Asset Data Collection

```typescript
import { TradeRepublicAppInterface } from './src/app-interface';

async function collectMarketData() {
  const tr = new TradeRepublicAppInterface();
  
  // Get all US stocks
  const usStocks = await tr.getAssetsByMarket('US');
  console.log(`Found ${usStocks.length} US stocks`);
  
  // Collect prices for top 10
  const top10 = usStocks.slice(0, 10);
  const prices = await Promise.all(
    top10.map(asset => tr.getRealTimePrice(asset.isin))
  );
  
  // Export results
  const csvFile = await tr.exportData('csv');
  console.log(`Data exported to: ${csvFile}`);
}

collectMarketData();
```

### Database Integration

```typescript
import { AssetDatabase } from './src/database/asset-database';
import { TradeRepublicClient } from './src/api/client';

async function updateDatabase() {
  const db = new AssetDatabase();
  const client = new TradeRepublicClient();
  
  await client.authenticate();
  
  // Get assets to update
  const assets = await db.getAllAssets();
  
  for (const asset of assets) {
    try {
      const price = await client.getAssetPrice(asset.isin);
      await db.savePriceData(price);
      console.log(`Updated ${asset.symbol}: ${price.price}`);
    } catch (error) {
      console.error(`Failed to update ${asset.symbol}:`, error.message);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  await db.close();
  client.disconnect();
}

updateDatabase();
```

### React Integration

```typescript
import { useEffect, useState } from 'react';
import { TradeRepublicClient } from './api/client';

function useAssetPrice(isin: string) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const client = new TradeRepublicClient();
    
    client.authenticate().then(() => {
      client.subscribeToPrices(isin, (data) => {
        setPrice(data);
        setLoading(false);
      });
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
    
    return () => {
      client.unsubscribeFromPrices(isin);
      client.disconnect();
    };
  }, [isin]);
  
  return { price, loading, error };
}

function PriceDisplay({ isin }: { isin: string }) {
  const { price, loading, error } = useAssetPrice(isin);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h3>{price.isin}</h3>
      <p>Price: {price.price}</p>
      <p>Bid: {price.bid}</p>
      <p>Ask: {price.ask}</p>
      <small>Updated: {new Date(price.timestamp).toLocaleString()}</small>
    </div>
  );
}
```

### Express.js API Server

```typescript
import express from 'express';
import { TradeRepublicAppInterface } from './src/app-interface';

const app = express();
const tr = new TradeRepublicAppInterface();

app.use(express.json());

// Get asset price
app.get('/api/price/:isin', async (req, res) => {
  try {
    const { isin } = req.params;
    const price = await tr.getRealTimePrice(isin);
    res.json({ success: true, data: price });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Search assets
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    const assets = await tr.searchAssets(q as string);
    res.json({ success: true, data: assets });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get assets by market
app.get('/api/market/:market', async (req, res) => {
  try {
    const { market } = req.params;
    const assets = await tr.getAssetsByMarket(market);
    res.json({ success: true, data: assets });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Export data
app.get('/api/export/:format', async (req, res) => {
  try {
    const { format } = req.params;
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid format. Use json or csv.' 
      });
    }
    
    const filePath = await tr.exportData(format as 'json' | 'csv');
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(3000, () => {
  console.log('Trade Republic API server running on port 3000');
});
```

---

## Additional Resources

- [GitHub Repository](https://github.com/your-username/Trade_Republic_Connector)
- [Example Scripts](./examples/)
- [TypeScript Definitions](./src/types/)

---

**Note**: This API reference covers the available functionality of the Trade Republic API connector. Some features like portfolio data and trading operations are not available through the current protocol implementation.
```json
{
  "processId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "MFA_REQUIRED"
}
```

**Step 2: Complete 2FA**
```http
POST /api/v1/auth/web/login/{processId}/tan
Content-Type: application/json

{
  "tan": "123456"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "def50200...",
  "sessionId": "session_123",
  "userId": "16f1ff6b-b686-4caf-bec3-ceed7ba1e556",
  "deviceId": "device_456"
}
```

### Headers for Authenticated Requests
```http
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
User-Agent: Mozilla/5.0 (compatible; TR-Connector/1.0)
```

---

## WebSocket API

### Connection

**Endpoint**: `wss://api.traderepublic.com/`

**Headers:**
```
Sec-WebSocket-Protocol: echo-protocol
Cookie: sessionId={sessionId}; deviceId={deviceId}
User-Agent: Mozilla/5.0 (compatible; TR-Connector/1.0)
```

### Message Format

All WebSocket messages follow this structure:

```typescript
interface WebSocketMessage {
  type: "sub" | "unsub" | "response";
  id: string;
  payload?: any;
}
```

### Price Data Subscription

**Subscribe to Real-time Prices**

*Request:*
```json
{
  "type": "sub",
  "id": "price-US0378331005",
  "payload": {
    "type": "ticker",
    "id": "US0378331005"
  }
}
```

*Response:*
```json
{
  "type": "ticker",
  "subscription": "price-US0378331005",
  "payload": {
    "isin": "US0378331005",
    "bid": {
      "price": 150.25,
      "time": 1645123456789
    },
    "ask": {
      "price": 150.30,
      "time": 1645123456789
    },
    "last": {
      "price": 150.27,
      "time": 1645123456789
    },
    "pre": {
      "price": 150.20,
      "time": 1645123456789
    },
    "open": {
      "price": 150.10,
      "time": 1645123456789
    },
    "qualityId": "realtime"
  }
}
```

**Unsubscribe**

*Request:*
```json
{
  "type": "unsub",
  "id": "price-US0378331005"
}
```

### Asset Information

**Subscribe to Asset Details**

*Request:*
```json
{
  "type": "sub",
  "id": "instrument-US0378331005",
  "payload": {
    "type": "instrument",
    "id": "US0378331005"
  }
}
```

*Response:*
```json
{
  "type": "instrument",
  "subscription": "instrument-US0378331005",
  "payload": {
    "isin": "US0378331005",
    "name": "Apple Inc.",
    "shortName": "AAPL",
    "currency": "USD",
    "type": "stock",
    "exchange": "XNAS",
    "country": "US",
    "sector": "Technology"
  }
}
```

---

## Data Models

### Price Data
```typescript
interface PriceData {
  isin: string;
  bid?: {
    price: number;
    time: number;
  };
  ask?: {
    price: number;
    time: number;
  };
  last?: {
    price: number;
    time: number;
  };
  pre?: {
    price: number;
    time: number;
  };
  open?: {
    price: number;
    time: number;
  };
  qualityId: "realtime" | "delayed" | "eod";
}
```

### Asset Information
```typescript
interface Asset {
  isin: string;
  name: string;
  shortName?: string;
  currency: string;
  type: "stock" | "etf" | "bond" | "crypto";
  exchange: string;
  country: string;
  sector?: string;
}
```

### Authentication Session
```typescript
interface AuthSession {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  userId: string;
  deviceId: string;
  expiresAt: number;
}
```

---

## Error Handling

### WebSocket Errors

**Bad Subscription Type**
```json
{
  "type": "error",
  "id": "subscription-id",
  "error": {
    "code": "BAD_SUBSCRIPTION_TYPE",
    "message": "Subscription type not supported"
  }
}
```

**Authentication Error**
```json
{
  "type": "error",
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid or expired session"
  }
}
```

### HTTP Errors

**401 Unauthorized**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid credentials or session expired",
  "code": 401
}
```

**429 Rate Limited**
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests. Please retry after 60 seconds",
  "retryAfter": 60,
  "code": 429
}
```

---

## Rate Limiting

### WebSocket Connections
- **Max Connections**: 1 per session
- **Max Subscriptions**: 100 concurrent
- **Reconnection**: Exponential backoff (1s, 2s, 4s, 8s, max 30s)

### HTTP Requests
- **Authentication**: 5 requests per minute
- **General API**: 100 requests per minute

### Best Practices
- Implement connection pooling for multiple assets
- Use batch subscriptions when possible
- Handle rate limit responses gracefully
- Implement exponential backoff for retries

---

## Code Examples

### Basic Setup

```typescript
import { TradeRepublicClient } from './src/api/client';

const client = new TradeRepublicClient();

// Authentication
await client.login({
  username: process.env.TR_USERNAME!,
  password: process.env.TR_PASSWORD!,
  pin: process.env.TR_PIN!
});
```

### Real-time Price Monitoring

```typescript
// Initialize WebSocket connection
await client.initializeWebSocket();

// Subscribe to Apple stock prices
client.subscribeToPrices('US0378331005', (priceData) => {
  console.log(`AAPL: $${priceData.last?.price}`);
  console.log(`Bid: $${priceData.bid?.price}, Ask: $${priceData.ask?.price}`);
});

// Subscribe to multiple assets
const assets = ['US0378331005', 'US5949181045', 'US02079K3059'];
assets.forEach(isin => {
  client.subscribeToPrices(isin, (data) => {
    console.log(`${isin}: $${data.last?.price}`);
  });
});
```

### Bulk Asset Discovery

```typescript
const assets = [
  'US0378331005', // Apple
  'US5949181045', // Microsoft
  'DE0007164600', // SAP
  'IE00B4L5Y983'  // iShares MSCI World
];

const priceData = new Map();

for (const isin of assets) {
  const data = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 3000);
    
    client.subscribeToPrices(isin, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
  
  if (data) {
    priceData.set(isin, data);
    console.log(`✅ ${isin}: $${data.last?.price}`);
  } else {
    console.log(`❌ ${isin}: No data received`);
  }
}
```

### Database Storage

```typescript
import { AssetDatabaseManager } from './src/database/asset-database';

const db = new AssetDatabaseManager();

// Store asset data
await db.insertAsset({
  isin: 'US0378331005',
  name: 'Apple Inc.',
  symbol: 'AAPL',
  type: 'stock',
  market: 'US',
  currency: 'USD',
  discoveryMethod: 'manual',
  discoveredAt: new Date().toISOString(),
  verified: true,
  lastUpdated: new Date().toISOString()
});

// Store price data
await db.insertPriceData({
  isin: 'US0378331005',
  timestamp: Date.now(),
  price: 150.27,
  bid: 150.25,
  ask: 150.30,
  open: 150.10,
  currency: 'USD',
  source: 'websocket'
});
```

### Error Handling Example

```typescript
class RobustTradeRepublicClient {
  private client: TradeRepublicClient;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connectWithRetry() {
    try {
      await this.client.initializeWebSocket();
      this.reconnectAttempts = 0;
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        console.log(`Reconnecting in ${delay}ms...`);
        
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connectWithRetry();
        }, delay);
      } else {
        throw new Error('Max reconnection attempts reached');
      }
    }
  }

  async subscribeSafely(isin: string, callback: Function) {
    try {
      this.client.subscribeToPrices(isin, callback);
    } catch (error) {
      if (error.code === 'BAD_SUBSCRIPTION_TYPE') {
        console.warn(`Subscription type not supported for ${isin}`);
      } else {
        console.error(`Subscription failed for ${isin}:`, error);
        // Implement retry logic here
      }
    }
  }
}
```

---

## Best Practices

### Performance Optimization

1. **Batch Operations**
```typescript
// Good: Batch multiple subscriptions
const subscriptions = assets.map(isin => ({
  type: "sub",
  id: `price-${isin}`,
  payload: { type: "ticker", id: isin }
}));

// Send all at once
subscriptions.forEach(sub => websocket.send(JSON.stringify(sub)));
```

2. **Connection Management**
```typescript
// Implement connection pooling for high-volume applications
class ConnectionPool {
  private connections: WebSocket[] = [];
  private currentIndex = 0;

  getConnection(): WebSocket {
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return connection;
  }
}
```

### Security Best Practices

1. **Environment Variables**
```bash
# .env file
TR_USERNAME=your_phone_number
TR_PASSWORD=your_password
TR_PIN=your_pin
```

2. **Token Management**
```typescript
class SecureTokenManager {
  private encryptToken(token: string): string {
    // Implement encryption for stored tokens
    return encrypt(token);
  }

  private isTokenExpired(token: string): boolean {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  }
}
```

### Monitoring and Logging

```typescript
import { logger } from './src/utils/logger';

// Log all WebSocket events
websocket.on('message', (data) => {
  logger.info('WebSocket message received', { 
    type: data.type,
    subscription: data.subscription,
    timestamp: Date.now()
  });
});

// Monitor connection health
setInterval(() => {
  if (!websocket.readyState === WebSocket.OPEN) {
    logger.warn('WebSocket connection lost, attempting reconnection');
    this.reconnect();
  }
}, 30000);
```

### Data Validation

```typescript
function validatePriceData(data: any): data is PriceData {
  return (
    typeof data.isin === 'string' &&
    data.isin.length === 12 &&
    (data.last?.price === undefined || typeof data.last.price === 'number') &&
    (data.bid?.price === undefined || typeof data.bid.price === 'number') &&
    (data.ask?.price === undefined || typeof data.ask.price === 'number')
  );
}

// Usage
client.subscribeToPrices(isin, (data) => {
  if (validatePriceData(data)) {
    // Process valid data
    processPrice(data);
  } else {
    logger.warn('Invalid price data received', { isin, data });
  }
});
```

---

## Integration Examples

### React Hook for Real-time Prices

```typescript
import { useState, useEffect } from 'react';

export function useTradeRepublicPrice(isin: string) {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = new TradeRepublicClient();
    
    client.subscribeToPrices(isin, (data) => {
      setPrice(data);
      setLoading(false);
    });

    return () => {
      client.unsubscribeFromPrices(isin);
    };
  }, [isin]);

  return { price, loading, error };
}
```

### Express.js API Wrapper

```typescript
import express from 'express';

const app = express();
const client = new TradeRepublicClient();

app.get('/api/price/:isin', async (req, res) => {
  try {
    const { isin } = req.params;
    
    const price = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
      
      client.subscribeToPrices(isin, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    res.json({ success: true, data: price });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

This API reference provides comprehensive guidance for integrating with the Trade Republic API. For additional examples and advanced usage patterns, refer to the example scripts in the `examples/` directory.
