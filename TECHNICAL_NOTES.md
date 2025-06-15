# Trade Republic API Documentation

## Overview
This document provides comprehensive documentation of the Trade Republic API endpoints, WebSocket protocol, and data collection capabilities.

## API Architecture

### Base Configuration
- **Base URL**: `https://api.traderepublic.com`
- **Protocol**: REST API for authentication, WebSocket for real-time data
- **Authentication**: Device pairing + PIN + 2FA

### REST Endpoints

#### Authentication Flow
1. **Device Pairing**: `POST /api/v1/auth/web/login`
2. **PIN Verification**: `POST /api/v1/auth/web/login/{processId}/pin`
3. **2FA Verification**: `POST /api/v1/auth/web/login/{processId}/tan`

#### Data Endpoints (LIMITED - Return HTML/Empty)
- `GET /api/v1/instrument/{isin}` - Asset metadata (HTML response)
- `GET /api/v1/instrument/{isin}/price` - Price data (Empty response)
- `GET /api/v1/portfolio` - Portfolio data (Empty response)
- `GET /api/v1/timeline` - Transaction history (Empty response)

**⚠️ IMPORTANT**: REST endpoints do NOT return JSON data. All real data must be accessed via WebSocket.

### WebSocket Protocol

#### Connection Details
- **URL**: `wss://api.traderepublic.com/`
- **Headers Required**:
  - `User-Agent`: Browser-like user agent
  - `Cookie`: Session cookies from authentication
  - `Sec-WebSocket-Protocol`: `echo-protocol`

#### Message Format
All WebSocket messages use this format:
```json
{
  "type": "sub" | "unsub",
  "id": "unique-subscription-id",
  "payload": {
    // Subscription-specific data
  }
}
```

#### Subscription Types

##### 1. Price Data (✅ WORKING)
```typescript
// Subscribe to real-time price
{
  "type": "sub",
  "id": "price-{isin}",
  "payload": {
    "type": "ticker",
    "id": "{isin}"
  }
}

// Response format
{
  "type": "ticker",
  "payload": {
    "isin": "US0378331005",
    "bid": { "price": 150.25, "time": 1645123456 },
    "ask": { "price": 150.30, "time": 1645123456 },
    "last": { "price": 150.27, "time": 1645123456 },
    "pre": { "price": 150.20, "time": 1645123456 },
    "open": { "price": 150.10, "time": 1645123456 },
    "qualityId": "realtime"
  }
}
```

##### 2. Portfolio Data (❌ NOT WORKING)
```typescript
// Attempted subscription types (all return BAD_SUBSCRIPTION_TYPE)
{
  "type": "sub",
  "id": "portfolio-overview",
  "payload": {
    "type": "portfolio" | "positions" | "overview" | "holdings"
  }
}
```

##### 3. Timeline/Orders (❌ NOT WORKING)
```typescript
// Attempted subscription types (no response)
{
  "type": "sub",
  "id": "timeline",
  "payload": {
    "type": "timeline" | "orders" | "transactions"
  }
}
```

## Asset Discovery

### Current Implementation
- **Assets Collected**: 119/130 attempted (91.5% success rate)
- **Markets**: US, DE, NL, FR, CH, GB, EU
- **Asset Types**: Stocks, ETFs
- **Data Points**: Real-time prices, bid/ask spreads, market data

### Known Asset ISINs
The system currently uses curated lists of popular assets:

#### US Stocks (FAANG + Major Tech)
- Apple (AAPL): `US0378331005`
- Microsoft (MSFT): `US5949181045`
- Alphabet (GOOGL): `US02079K3059`
- Amazon (AMZN): `US0231351067`
- Meta (META): `US30303M1027`
- Tesla (TSLA): `US88160R1014`
- Netflix (NFLX): `US64110L1061`
- NVIDIA (NVDA): `US67066G1040`

#### German Stocks (DAX)
- SAP: `DE0007164600`
- Siemens: `DE0007236101`
- ASML: `NL0010273215`
- Adidas: `DE000A1EWWW0`

#### ETFs
- SPDR S&P 500: `US78462F1030`
- iShares Core S&P 500: `IE00B5BMR087`
- Vanguard FTSE All-World: `IE00B3RBWM25`

### Scaling to 400+ Assets

To reach the target of 400+ assets, implement these discovery strategies:

1. **Sector-based Discovery**: Systematically discover assets by sector
2. **Market Index Components**: Collect all components of major indices
3. **Pattern-based Discovery**: Use ISIN patterns for different markets
4. **API-driven Discovery**: If TR provides asset search endpoints

## Data Storage

### Database Schema
SQLite database with the following structure:

```sql
CREATE TABLE assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isin TEXT UNIQUE NOT NULL,
  name TEXT,
  ticker TEXT,
  market TEXT,
  asset_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE price_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER,
  bid_price REAL,
  ask_price REAL,
  last_price REAL,
  pre_price REAL,
  open_price REAL,
  quality_id TEXT,
  timestamp DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets (id)
);
```

### Export Formats
- **JSON**: Structured data for applications
- **CSV**: Spreadsheet-compatible format
- **SQLite**: Direct database access

## Usage Examples

### Basic Asset Collection
```typescript
import { TradeRepublicClient } from './src/api/client';
import { AssetDatabaseManager } from './src/database/asset-database';

const client = new TradeRepublicClient();
const db = new AssetDatabaseManager();

// Authenticate
await client.authenticate(phone, pin);

// Collect price data
const priceData = await client.getAssetPrice('US0378331005');

// Store in database
await db.storeAssetData(assetData, priceData);
```

### Bulk Data Collection
```typescript
// Use the production-ready script
await import('./examples/production-asset-discovery.ts');
```

## Error Handling

### Common Issues
1. **BAD_SUBSCRIPTION_TYPE**: Subscription type not supported
2. **Authentication timeout**: Re-authenticate required
3. **Rate limiting**: Implement delays between requests
4. **Empty responses**: REST endpoints return HTML/empty data

### Best Practices
1. Always use WebSocket for data collection
2. Implement retry logic for failed subscriptions
3. Store authentication tokens securely
4. Handle connection drops gracefully
5. Validate ISIN formats before subscription

## Production Considerations

### Performance
- **Collection Rate**: ~4 assets/second
- **Success Rate**: 91%+ for known assets
- **Memory Usage**: ~50MB for 100+ assets
- **Database Size**: ~1MB per 1000 price points

### Scaling
- Implement connection pooling for high-volume collection
- Use batch processing for large asset lists
- Consider rate limiting to avoid API restrictions
- Monitor WebSocket connection health

### Security
- Store credentials in environment variables
- Use secure WebSocket connections (WSS)
- Implement session rotation
- Log security events

## Future Enhancements

1. **Portfolio Integration**: Research correct subscription types
2. **Real-time Streaming**: Implement continuous price updates
3. **Market Data**: Add order book, volume, technical indicators
4. **Multi-market Support**: Expand to Asian markets
5. **API Rate Management**: Implement intelligent throttling
