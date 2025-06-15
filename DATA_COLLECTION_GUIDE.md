# Comprehensive Trade Republic Data Collection

This document explains how to download and store all your Trade Republic data locally using the comprehensive data collection system.

## 🎯 What This System Does

The comprehensive data collection system downloads **ALL** available data from your Trade Republic account, including:

- **Portfolio Data**: All your current positions, values, and performance
- **Trading History**: Complete order history and transaction records
- **Watchlist**: All instruments you're tracking
- **Market Data**: Real-time prices, instrument information, and news
- **Account Information**: Portfolio summary, cash positions, and performance metrics

All data is stored locally in:
- 📄 **SQLite Database**: Structured data in `comprehensive-trade-republic-data.db`
- 📊 **JSON Reports**: Human-readable reports and raw data
- 📈 **CSV Exports**: Spreadsheet-compatible data files

## 🚀 Quick Start

### 1. Setup Your Credentials

Create a `.env` file with your Trade Republic credentials:

```bash
# Trade Republic Authentication
TR_USERNAME=your_username
TR_PASSWORD=your_password
TR_PIN=your_4_digit_pin
```

⚠️ **Important**: Your `.env` file is ignored by git and stays private.

### 2. Test Your Setup

Before running the full collection, test your setup:

```bash
npm run test-setup
```

This will verify:
- ✅ Environment variables are set
- ✅ Database can be initialized
- ✅ Client can connect to Trade Republic
- ✅ Authentication works
- ✅ Basic API calls succeed

### 3. Run the Full Collection

```bash
npm run collect-data
```

Or directly:
```bash
node examples/comprehensive-data-collection.js
```

## 📊 What Gets Collected

### Account Data
- Portfolio summary with total value
- Cash position and available funds
- Historical performance data (all timeframes)
- Current positions with quantities and values

### Trading Data
- Complete order history
- Transaction records
- Position details for each holding
- Buy/sell history with dates and prices

### Market Data
- Real-time prices for all your holdings
- Instrument information (names, symbols, types)
- Market news for your holdings
- General market news

### Watchlist Data
- All instruments on your watchlist
- Current prices and daily changes
- Instrument details and market data

## 🗄️ Output Files

After collection, you'll find these files in the `data/` directory:

### Database
- **`comprehensive-trade-republic-data.db`**: SQLite database with all structured data

### Reports
- **`comprehensive-trade-republic-report.json`**: Complete data dump with all collected information
- **`collection-summary.json`**: High-level summary of what was collected
- **`comprehensive-assets.json`**: All discovered assets and instruments
- **`comprehensive-assets.csv`**: Spreadsheet-friendly asset list

### Database Schema

The SQLite database contains these tables:

#### `assets`
- Asset information (ISIN, name, symbol, type, market)
- Discovery method and verification status
- Last updated timestamps

#### `price_data`  
- Historical and real-time price data
- Bid/ask spreads, daily ranges
- Volume and currency information

#### Database Statistics
The system tracks:
- Total number of assets discovered
- Verified vs unverified assets
- Price data points collected
- Assets by type (stocks, ETFs, bonds, crypto)
- Assets by market/exchange

## 🔧 Advanced Usage

### Custom Configuration

You can modify the collection behavior by editing `examples/comprehensive-data-collection.ts`:

```typescript
// Rate limiting (delay between API calls)
await this.sleep(200); // 200ms delay

// Collection scope
const performance = await this.client.getPortfolioPerformance('ALL'); // or '1Y', '6M', etc.

// News article limits
const marketNews = await this.client.getMarketNews(undefined, 50); // 50 articles
```

### Running Specific Collections

You can modify the main collection method to run only specific parts:

```typescript
// In collectAllData(), comment out sections you don't need:
// await this.collectAccountInfo();
// await this.collectPortfolioData();
// await this.collectTradingHistory();
// await this.collectWatchlist();
// await this.collectMarketData();
```

### Database Operations

Access the database programmatically:

```typescript
import { AssetDatabaseManager } from './src/database/asset-database.js';

const db = new AssetDatabaseManager('./data/comprehensive-trade-republic-data.db');

// Get all assets
const assets = db.getAllAssets();

// Get verified assets only
const verified = db.getVerifiedAssets();

// Get assets by type
const stocks = db.getAssetsByType('stock');
const etfs = db.getAssetsByType('etf');

// Get price data
const latestPrice = db.getLatestPrice('US0378331005'); // Apple
const priceHistory = db.getPriceHistory('US0378331005', 100);

// Get statistics
const stats = db.getStatistics();
```

## 🛡️ Security & Privacy

### What's Private
- Your `.env` file with credentials (never committed to git)
- All collected data files (ignored by git)
- Database files with your personal information
- Generated reports and exports

### What's Public
- The code and scripts themselves
- Documentation and setup instructions
- Author attribution and contact information

### Data Storage
- Everything is stored **locally** on your machine
- No data is sent to external services
- You have complete control over your data
- You can delete or export data at any time

## 🔍 Troubleshooting

### Authentication Issues
If authentication fails:
1. Double-check your credentials in `.env`
2. Ensure your Trade Republic account is active
3. Handle 2FA if enabled (may require manual intervention)
4. Check for API changes or maintenance

### Rate Limiting
If you encounter rate limiting:
1. Increase sleep delays in the script
2. Run collection during off-peak hours
3. Consider running smaller chunks of data

### Missing Data
If some data is missing:
1. Check the error count in final statistics
2. Review console output for specific errors
3. Some data may not be available for all account types
4. API responses may vary based on account status

### Database Issues
If database operations fail:
1. Ensure the `data/` directory exists
2. Check file permissions
3. Close any open database connections
4. Delete the database file to start fresh

## 📈 Analyzing Your Data

### Using the Database
Connect to your SQLite database with any SQLite client:

```bash
# Command line
sqlite3 data/comprehensive-trade-republic-data.db

# GUI tools
# - DB Browser for SQLite
# - SQLiteStudio  
# - DBeaver
```

### Sample Queries
```sql
-- Your portfolio overview
SELECT name, symbol, type, market, currency 
FROM assets 
WHERE discovery_method = 'portfolio';

-- Price performance
SELECT isin, price, timestamp, currency
FROM price_data
ORDER BY timestamp DESC;

-- Asset distribution
SELECT type, COUNT(*) as count
FROM assets
WHERE verified = 1
GROUP BY type;
```

### Using JSON Reports
The JSON reports can be imported into:
- Excel/Google Sheets (via JSON import)
- Python/Pandas for analysis
- JavaScript for web visualization
- R for statistical analysis

## 🤝 Support

If you encounter issues:

1. **Check the documentation** first
2. **Run the test script** to verify setup
3. **Review console output** for specific errors
4. **Check Trade Republic API status** for outages
5. **Contact the maintainer**: carlos.damken@gmail.com

## 📄 Legal Notice

This tool is for personal use only. Ensure compliance with:
- Trade Republic's Terms of Service
- Local financial regulations
- Data protection laws

Use responsibly and at your own risk.
