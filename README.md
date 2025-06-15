# Trade Republic API Connector

A comprehensive, production-ready TypeScript connector for the Trade Republic API that provides real-time asset price collection, WebSocket integration, and database storage capabilities.

## 🎯 Features

- ✅ **Real Authentication** - Device pairing, PIN, and 2FA support
- ✅ **WebSocket Integration** - Real-time price data collection
- ✅ **Asset Discovery** - Automated discovery of stocks and ETFs
- ✅ **Database Storage** - SQLite database with asset and price data
- ✅ **Multiple Export Formats** - JSON, CSV export capabilities
- ✅ **Production Ready** - Robust data collection capabilities
- ✅ **Clean App Interface** - Simple API for application integration
- ✅ **Comprehensive Documentation** - Full API reference included

## 📊 Current Status

- **Asset Discovery**: Dynamic discovery system for stocks and ETFs
- **Markets Supported**: US, DE, EU, FR, GB, NL, CH and others
- **Asset Types**: Stocks, ETFs, Bonds (via ISIN)
- **Data Quality**: Real-time bid/ask/last prices with timestamps

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/cdamken/Trade_Republic_Connector.git
cd Trade_Republic_Connector
npm install
```

### Configuration

Create a `.env` file with your Trade Republic credentials:

```env
TR_USERNAME=your_phone_number
TR_PASSWORD=your_password
TR_PIN=your_pin
TR_API_URL=https://api.traderepublic.com
```

### Authentication

```bash
# Authenticate with Trade Republic (first time setup)
npm run examples:auth
```

### Data Collection

```bash
# Collect asset data (production-ready script)
npm run collect:assets

# Test WebSocket connection
npm run test:websocket

# Demo app interface
npm run demo:data
```

## 📱 App Integration

Use the simple app interface for easy integration:

```typescript
import { TradeRepublicAppInterface } from './src/app-interface';

const tr = new TradeRepublicAppInterface();

// Get all assets
const assets = await tr.getAllAssets();

// Get assets by market
const usStocks = await tr.getAssetsByMarket('US');
const germanStocks = await tr.getAssetsByMarket('DE');

// Get real-time price
const price = await tr.getRealTimePrice('US0378331005'); // Apple

// Search assets
const results = await tr.searchAssets('AAPL');

// Export data
const jsonFile = await tr.exportData('json');
const csvFile = await tr.exportData('csv');

// Get collection statistics
const status = await tr.getCollectionStatus();
console.log(`Assets collected: ${status.totalAssets}`);
```

## 📂 Project Structure

```
Trade_Republic_Connector/
├── src/
│   ├── app-interface.ts              # 🔥 Simple app API
│   ├── api/
│   │   ├── client.ts                 # Main API client
│   │   └── http-client.ts            # HTTP utilities
│   ├── auth/
│   │   └── manager.ts                # Authentication
│   ├── config/
│   │   ├── config.ts                 # Configuration
│   │   └── environment.ts            # Environment setup
│   ├── websocket/
│   │   └── tr-websocket.ts           # WebSocket manager
│   ├── database/
│   │   └── asset-database.ts         # Database management
│   ├── types/                        # TypeScript definitions
│   └── utils/
│       └── logger.ts                 # Logging utilities
├── examples/
│   ├── production-asset-discovery.ts # Main collection script
│   ├── tr-websocket-test.ts         # WebSocket testing
│   ├── websocket-asset-collector.ts  # Asset collection
│   └── simple-data-demo.ts          # App interface demo
├── data/
│   ├── assets.db                     # Asset database
│   ├── results.json                  # Collection results
│   └── exports/                      # Exported data
└── API_REFERENCE.md                  # 📖 Complete API docs
```

## 🔌 API Endpoints

### What Works ✅

1. **Authentication**:
   - Device pairing via REST API
   - PIN and 2FA verification
   - Session management

2. **Real-time Data** (WebSocket):
   - Asset price subscriptions
   - Bid/ask spreads
   - Market data with timestamps

### What Doesn't Work ❌

1. **Portfolio Data**: Portfolio subscriptions return `BAD_SUBSCRIPTION_TYPE`
2. **REST Data Endpoints**: Return HTML instead of JSON
3. **User Timeline**: Timeline/orders subscriptions don't respond

## 📊 Data Access

### Database Schema

```sql
-- Assets with metadata
assets (isin, name, symbol, type, market, sector, currency, ...)

-- Real-time price data
price_data (isin, timestamp, price, bid, ask, open, high, low, ...)
```

### Available Formats

- **SQLite Database**: `data/assets.db`
- **JSON Export**: `data/exports/assets-*.json`
- **CSV Export**: `data/exports/assets-*.csv`

## 🔍 Asset Discovery

### Current Assets

- **US Stocks**: Apple, Microsoft, Google, Amazon, Tesla, NVIDIA, Meta, Netflix, etc.
- **German Stocks**: SAP, Siemens, Adidas, BMW, Deutsche Bank, etc.
- **ETFs**: S&P 500, MSCI World, DAX, FTSE 100, sector ETFs
- **International**: ASML, Nestlé, LVMH, etc.

### Scaling Strategy

To discover more assets:
- Expand component coverage for major indices
- Add international market coverage
- Include more sector-specific ETFs
- Implement pattern-based discovery algorithms

## 🛠️ Development

### Available Scripts

```bash
# Data collection
npm run collect:assets        # Collect asset data
npm run test:websocket       # Test WebSocket connection

# Development
npm run build               # Build TypeScript
npm run dev                # Development mode

# Examples
npm run demo:data               # Demo app interface
npm run examples:auth       # Authentication demo
```

### Adding New Assets

Add ISINs to the asset lists in `examples/production-asset-discovery.ts`:

```typescript
const ADDITIONAL_ASSETS = [
  'US0378331005', // Apple Inc
  'DE0007164600', // SAP SE
  // ... more ISINs
];
```

## 📈 Performance

- **Collection Speed**: Configurable rate limiting
- **Memory Usage**: Optimized for large datasets
- **Database Size**: Scales with collected data
- **Reliability**: Robust error handling and retry logic

## 🔐 Security

- Environment variables for credentials
- Secure WebSocket connections (WSS)
- No hardcoded secrets
- Session management

## 🚨 Error Handling

Common issues and solutions:

1. **Authentication Failed**: Check credentials in `.env`
2. **WebSocket Connection Failed**: Verify network and authentication
3. **BAD_SUBSCRIPTION_TYPE**: Portfolio data not available via WebSocket
4. **Empty Responses**: REST endpoints return HTML, use WebSocket instead

## 📝 API Documentation

See [API_REFERENCE.md](./API_REFERENCE.md) for comprehensive API reference including:
- WebSocket protocol details
- Subscription message formats
- Error handling patterns
- Production deployment considerations

## 🔮 Future Enhancements

1. **Portfolio Integration**: Research correct subscription types
2. **Real-time Streaming**: Implement continuous monitoring
3. **Market Data**: Add order book, volume, technical indicators
4. **Multi-market Support**: Expand to Asian markets
5. **API Rate Management**: Implement intelligent throttling

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

This is a personal project focused on Trade Republic API integration. For issues or questions, please use the GitHub issues tracker.

## ⚠️ Disclaimer

This project is for educational and research purposes. Use at your own risk. Not affiliated with Trade Republic Bank GmbH. Ensure compliance with Trade Republic's Terms of Service.

---

**Status**: ✅ Production Ready | **Last Updated**: December 2024
