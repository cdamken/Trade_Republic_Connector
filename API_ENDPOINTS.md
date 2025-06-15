# Trade Republic API Endpoints Documentation

This document provides a comprehensive reference for all available endpoints in the Trade Republic Connector, including REST APIs, WebSocket channels, and database operations.

## Table of Contents

- [Authentication API](#authentication-api)
- [Portfolio API](#portfolio-api)
- [Market Data API](#market-data-api)
- [Asset Information API](#asset-information-api)
- [WebSocket Channels](#websocket-channels)
- [Database Operations](#database-operations)
- [Trading Operations](#trading-operations)
- [Response Formats](#response-formats)
- [Error Codes](#error-codes)

---

## Authentication API

### Device Pairing & Authentication

#### Initiate Device Reset
**Endpoint:** `POST /api/v1/auth/account/reset/device`
```typescript
// Request
{
  "phoneNumber": "+49123456789",
  "pin": "1234",
  "publicKey": "base64-encoded-ecdsa-p256-public-key",
  "deviceId": "uuid-device-identifier"
}

// Response
{
  "processId": "uuid-process-id"
}
```

#### Complete Device Pairing
**Endpoint:** `POST /api/v1/auth/account/reset/device/{processId}`
```typescript
// Request
{
  "token": "4-digit-code-from-app"
}

// Response
{
  "deviceId": "uuid-device-identifier",
  "sessionToken": "jwt-session-token",
  "refreshToken": "jwt-refresh-token",
  "expiresAt": 1640995200000
}
```

#### Login with Device
**Endpoint:** `POST /api/v1/auth/web/login`
```typescript
// Request
{
  "phoneNumber": "+49123456789",
  "pin": "1234",
  "deviceId": "uuid-device-identifier"
}

// Response
{
  "sessionToken": "jwt-session-token",
  "refreshToken": "jwt-refresh-token",
  "expiresAt": 1640995200000
}
```

#### Refresh Session Token
**Endpoint:** `POST /api/v1/auth/web/refresh`
```typescript
// Request
{
  "refreshToken": "jwt-refresh-token"
}

// Response
{
  "sessionToken": "new-jwt-session-token",
  "refreshToken": "new-jwt-refresh-token",
  "expiresAt": 1640995200000
}
```

#### Logout
**Endpoint:** `POST /api/v1/auth/web/logout`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "success": true
}
```

---

## Portfolio API

### Portfolio Overview

#### Get Portfolio Summary
**Endpoint:** `GET /api/v1/portfolio/overview`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "totalValue": 15000.50,
  "totalInvested": 12000.00,
  "totalPnL": 3000.50,
  "totalPnLPercent": 25.0,
  "availableCash": 500.00,
  "currency": "EUR",
  "positionCount": 8,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### Get All Positions
**Endpoint:** `GET /api/v1/portfolio/positions`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "positions": [
    {
      "instrumentId": "US0378331005",
      "name": "Apple Inc.",
      "quantity": 10,
      "averagePrice": 150.00,
      "currentPrice": 175.50,
      "marketValue": 1755.00,
      "unrealizedPnL": 255.00,
      "unrealizedPnLPercent": 17.0,
      "currency": "USD",
      "exchange": "NASDAQ",
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Get Specific Position
**Endpoint:** `GET /api/v1/portfolio/positions/{isin}`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "instrumentId": "US0378331005",
  "name": "Apple Inc.",
  "quantity": 10,
  "averagePrice": 150.00,
  "currentPrice": 175.50,
  "marketValue": 1755.00,
  "unrealizedPnL": 255.00,
  "unrealizedPnLPercent": 17.0,
  "currency": "USD",
  "exchange": "NASDAQ",
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### Get Cash Position
**Endpoint:** `GET /api/v1/portfolio/cash`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "amount": 500.00,
  "currency": "EUR",
  "availableForPayout": 500.00,
  "availableForInvestment": 500.00
}
```

#### Get Portfolio Performance
**Endpoint:** `GET /api/v1/portfolio/performance`
```typescript
// Query Parameters
?period=1M|3M|6M|1Y|2Y|5Y|MAX&granularity=1D|1W|1M

// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "period": "1Y",
  "startValue": 10000.00,
  "endValue": 15000.50,
  "totalReturn": 5000.50,
  "totalReturnPercent": 50.0,
  "dailyReturns": [
    {
      "date": "2024-01-01",
      "value": 10000.00,
      "return": 0,
      "returnPercent": 0
    }
  ],
  "benchmark": {
    "name": "S&P 500",
    "symbol": "SPX",
    "totalReturn": 3000.00,
    "totalReturnPercent": 30.0
  }
}
```

---

## Market Data API

### Real-time Market Data

#### Get Instrument Quote
**Endpoint:** `GET /api/v1/instruments/{isin}/quote`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "isin": "US0378331005",
  "price": 175.50,
  "bid": 175.40,
  "ask": 175.60,
  "spread": 0.20,
  "volume": 1000000,
  "change": 2.50,
  "changePercent": 1.45,
  "currency": "USD",
  "exchange": "NASDAQ",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Get Historical Prices
**Endpoint:** `GET /api/v1/instruments/{isin}/prices`
```typescript
// Query Parameters
?period=1D|1W|1M|3M|6M|1Y|2Y|5Y|MAX&granularity=1m|5m|15m|1h|1D|1W|1M

// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "isin": "US0378331005",
  "period": "1M",
  "granularity": "1D",
  "prices": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "open": 170.00,
      "high": 175.00,
      "low": 169.50,
      "close": 174.50,
      "volume": 950000,
      "adjustedClose": 174.50
    }
  ]
}
```

#### Search Instruments
**Endpoint:** `GET /api/v1/instruments/search`
```typescript
// Query Parameters
?query=apple&type=stock|etf|fund|crypto&limit=20&offset=0

// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "results": [
    {
      "isin": "US0378331005",
      "name": "Apple Inc.",
      "type": "stock",
      "currency": "USD",
      "tags": ["technology", "smartphone", "computer"]
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

## Asset Information API

### Comprehensive Asset Data

#### Get Basic Asset Information
**Endpoint:** `GET /api/v1/instruments/{isin}`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "isin": "US0378331005",
  "wkn": "865985",
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "shortName": "Apple",
  "longName": "Apple Inc. - Common Stock",
  "type": "stock",
  "subType": "common_stock",
  "category": "Technology",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "country": "United States",
  "countryCode": "US",
  "region": "North America",
  "homeExchange": "NASDAQ",
  "exchanges": [
    {
      "mic": "XNAS",
      "name": "NASDAQ",
      "country": "US",
      "timezone": "America/New_York",
      "tradingHours": {
        "open": "09:30",
        "close": "16:00"
      }
    }
  ],
  "currency": "USD",
  "tickSize": 0.01,
  "lotSize": 1,
  "minTradeAmount": 1.00,
  "maxTradeAmount": 1000000.00
}
```

#### Get Financial Fundamentals
**Endpoint:** `GET /api/v1/instruments/{isin}/fundamentals`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "isin": "US0378331005",
  "marketCap": 3000000000000,
  "sharesOutstanding": 15000000000,
  "freefloat": 85.5,
  "revenue": 394328000000,
  "netIncome": 99803000000,
  "totalAssets": 352755000000,
  "totalDebt": 119691000000,
  "cashAndEquivalents": 29965000000,
  "operatingCashFlow": 118224000000,
  "freeCashFlow": 99584000000,
  "returnOnEquity": 175.6,
  "returnOnAssets": 28.3,
  "currentRatio": 1.04,
  "debtToEquity": 1.95,
  "priceToEarnings": 30.1,
  "priceToBook": 52.8,
  "priceToSales": 7.6,
  "enterpriseValue": 3089000000000,
  "evToRevenue": 7.8,
  "evToEbitda": 24.1,
  "dividendYield": 0.43,
  "payoutRatio": 14.9,
  "beta": 1.29,
  "fiscalYearEnd": "2024-09-30",
  "lastReportDate": "2024-11-01",
  "currency": "USD"
}
```

#### Get Technical Indicators
**Endpoint:** `GET /api/v1/instruments/{isin}/technical`
```typescript
// Query Parameters
?period=1M|3M|6M|1Y&indicators=sma,ema,rsi,macd,bollinger

// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "isin": "US0378331005",
  "timestamp": "2024-01-15T10:30:00Z",
  "indicators": {
    "sma": {
      "20": 172.5,
      "50": 170.2,
      "200": 165.8
    },
    "ema": {
      "12": 174.1,
      "26": 171.3
    },
    "rsi": {
      "14": 65.2
    },
    "macd": {
      "macd": 1.8,
      "signal": 1.2,
      "histogram": 0.6
    },
    "bollinger": {
      "upper": 178.5,
      "middle": 175.0,
      "lower": 171.5,
      "bandwidth": 4.0
    },
    "support": [170.0, 165.5, 160.0],
    "resistance": [180.0, 185.5, 190.0]
  }
}
```

#### Get News & Events
**Endpoint:** `GET /api/v1/instruments/{isin}/news`
```typescript
// Query Parameters
?limit=20&offset=0&category=earnings|analyst|general

// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "news": [
    {
      "id": "news-123",
      "title": "Apple Reports Strong Q4 Earnings",
      "summary": "Apple Inc. reported better-than-expected earnings...",
      "content": "Full article content...",
      "category": "earnings",
      "sentiment": "positive",
      "relevanceScore": 0.95,
      "publishedAt": "2024-01-15T08:00:00Z",
      "source": "Reuters",
      "url": "https://example.com/news/apple-earnings"
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

#### Get Corporate Actions
**Endpoint:** `GET /api/v1/instruments/{isin}/corporate-actions`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "corporateActions": [
    {
      "type": "dividend",
      "amount": 0.24,
      "currency": "USD",
      "exDate": "2024-02-09",
      "payDate": "2024-02-16",
      "recordDate": "2024-02-12",
      "frequency": "quarterly",
      "status": "announced"
    },
    {
      "type": "stock_split",
      "ratio": "4:1",
      "exDate": "2024-08-30",
      "status": "completed"
    }
  ]
}
```

---

## WebSocket Channels

### Real-time Data Streams

#### Connection
```typescript
// WebSocket URL
wss://api.traderepublic.com/websocket

// Headers
Authorization: Bearer {sessionToken}
```

#### Portfolio Updates
```typescript
// Subscribe
{
  "type": "subscribe",
  "channel": "portfolio",
  "params": {
    "includePositions": true,
    "includeCash": true
  }
}

// Real-time Updates
{
  "channel": "portfolio",
  "type": "position_update",
  "data": {
    "instrumentId": "US0378331005",
    "currentPrice": 175.50,
    "marketValue": 1755.00,
    "unrealizedPnL": 255.00,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Market Data
```typescript
// Subscribe to specific instrument
{
  "type": "subscribe",
  "channel": "quotes",
  "params": {
    "isin": "US0378331005"
  }
}

// Real-time Quote Updates
{
  "channel": "quotes",
  "type": "price_update",
  "data": {
    "isin": "US0378331005",
    "price": 175.50,
    "bid": 175.40,
    "ask": 175.60,
    "volume": 1000000,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Trade Execution
```typescript
// Subscribe to trade updates
{
  "type": "subscribe",
  "channel": "trades"
}

// Trade Status Updates
{
  "channel": "trades",
  "type": "trade_status",
  "data": {
    "orderId": "order-123",
    "status": "filled",
    "executedQuantity": 10,
    "executedPrice": 175.50,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## Database Operations

### Test Database (Development/Testing Only)

#### Initialize Database
```typescript
const database = new AssetTestDatabase({
  dbPath: './data/test-assets.db',
  enableWAL: true,
  cacheSize: 10000
});

await database.initialize();
```

#### Store Asset Information
```typescript
const assetInfo: ComprehensiveAssetInfo = {
  isin: "US0378331005",
  name: "Apple Inc.",
  // ... other asset data
};

const recordId = await database.upsertAsset(assetInfo);
```

#### Query Assets
```typescript
// Get single asset
const asset = await database.getAsset("US0378331005");

// Search assets
const results = await database.searchAssets({
  query: "apple",
  type: "stock",
  limit: 10
});

// Get assets by criteria
const techStocks = await database.getAssetsByCriteria({
  sector: "Technology",
  minMarketCap: 1000000000
});
```

#### Historical Data Storage
```typescript
// Store price history
await database.storeHistoricalData("US0378331005", {
  period: "1Y",
  granularity: "1D",
  prices: [/* price data */]
});

// Query historical data
const history = await database.getHistoricalData("US0378331005", {
  startDate: "2023-01-01",
  endDate: "2024-01-01",
  granularity: "1D"
});
```

---

## Trading Operations

### Order Management

#### Place Order
**Endpoint:** `POST /api/v1/orders`
```typescript
// Request
{
  "instrumentId": "US0378331005",
  "side": "buy" | "sell",
  "type": "market" | "limit" | "stop" | "stop_limit",
  "quantity": 10,
  "price": 175.50,  // Required for limit orders
  "stopPrice": 170.00,  // Required for stop orders
  "timeInForce": "day" | "gtc" | "ioc" | "fok",
  "venue": "XNAS"
}

// Response
{
  "orderId": "order-123",
  "status": "pending",
  "instrumentId": "US0378331005",
  "side": "buy",
  "type": "limit",
  "quantity": 10,
  "price": 175.50,
  "estimatedFees": 1.00,
  "estimatedTotal": 1756.00,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Get Order Status
**Endpoint:** `GET /api/v1/orders/{orderId}`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "orderId": "order-123",
  "status": "filled",
  "instrumentId": "US0378331005",
  "side": "buy",
  "type": "limit",
  "quantity": 10,
  "executedQuantity": 10,
  "price": 175.50,
  "averageExecutionPrice": 175.45,
  "fees": 0.95,
  "total": 1755.45,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### Cancel Order
**Endpoint:** `DELETE /api/v1/orders/{orderId}`
```typescript
// Headers
Authorization: Bearer {sessionToken}

// Response
{
  "orderId": "order-123",
  "status": "cancelled",
  "cancelledAt": "2024-01-15T10:32:00Z"
}
```

---

## Response Formats

### Success Response
```typescript
{
  "data": {
    // Response data
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-123"
}
```

### Error Response
```typescript
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid session token",
    "details": {
      "field": "authorization",
      "reason": "token_expired"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-123"
}
```

---

## Error Codes

### Authentication Errors
- `AUTHENTICATION_ERROR`: Invalid credentials or session
- `TWO_FACTOR_REQUIRED`: 2FA verification needed
- `DEVICE_NOT_PAIRED`: Device not paired with account
- `SESSION_EXPIRED`: Session token expired
- `RATE_LIMIT_EXCEEDED`: Too many authentication attempts

### Portfolio Errors
- `PORTFOLIO_NOT_FOUND`: Portfolio data not available
- `POSITION_NOT_FOUND`: Specific position not found
- `INSUFFICIENT_FUNDS`: Not enough cash for operation

### Market Data Errors
- `INSTRUMENT_NOT_FOUND`: ISIN not found or not supported
- `MARKET_CLOSED`: Market is currently closed
- `DATA_NOT_AVAILABLE`: Requested data not available

### Trading Errors
- `ORDER_REJECTED`: Order rejected by exchange
- `INSUFFICIENT_BALANCE`: Not enough funds or shares
- `MARKET_CLOSED`: Cannot place order when market is closed
- `INVALID_PRICE`: Price outside valid range

### System Errors
- `INTERNAL_SERVER_ERROR`: Unexpected server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `TIMEOUT`: Request timed out

---

## Rate Limits

- **Authentication**: 5 requests per minute
- **Portfolio Data**: 60 requests per minute
- **Market Data**: 100 requests per minute
- **Trading**: 30 requests per minute
- **WebSocket**: 1 connection per session

## Notes

1. All timestamps are in ISO 8601 format (UTC)
2. All monetary amounts are in the specified currency
3. WebSocket connections require active session tokens
4. Test database is for development only - do not use in production
5. Some endpoints may require premium subscription or higher account tiers
6. Market data availability depends on exchange and subscription level

---

**Last Updated:** January 2024  
**Version:** 1.0.0  
**Author:** Carlos Damken <carlos@damken.com>
