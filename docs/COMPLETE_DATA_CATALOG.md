# Complete Trade Republic Data Available for Collection

## 📊 Comprehensive Data Overview

Based on the Trade Republic API analysis, here's **ALL** the information we can extract and store in a production database:

## 🏦 Account & Portfolio Data

### 1. **Portfolio Summary**
- Total portfolio value (current market value)
- Total cost basis (amount invested)
- Total return (profit/loss in absolute terms)
- Total return percentage
- Available cash for trading
- Available cash for withdrawal
- Portfolio performance by timeframe (1D, 1W, 1M, 3M, 6M, 1Y, ALL)
- Last updated timestamp

### 2. **Individual Positions**
- ISIN (International Securities Identification Number)
- Instrument name and symbol
- Quantity held
- Average purchase price
- Current market price
- Current market value
- Total cost basis for position
- Unrealized profit/loss (absolute)
- Unrealized profit/loss (percentage)
- Currency
- Exchange(s) where traded
- Position last updated timestamp

### 3. **Cash Positions**
- Available cash by currency
- Cash available for investment
- Cash available for payout/withdrawal
- Pending settlements

## 📈 Trading & Transaction History

### 4. **Order History**
- Order ID
- Order type (market, limit)
- Order side (buy, sell)
- Order status (pending, executed, cancelled, rejected, partial)
- ISIN of traded instrument
- Quantity ordered
- Executed quantity
- Order price (limit orders)
- Executed price
- Total order value
- Fees and charges
- Trading venue
- Order timestamp
- Execution timestamp
- Expiry date (limit orders)

### 5. **Execution Details**
- Execution ID
- Related order ID
- Execution price
- Executed quantity
- Execution timestamp
- Trading venue
- Fees for this execution

## 🎯 Market Data & Instruments

### 6. **Real-Time Market Data**
- Current bid price
- Current ask price
- Last traded price
- Bid-ask spread
- Trading volume
- Day's high price
- Day's low price
- Day's opening price
- Previous day's closing price
- Day's change (absolute)
- Day's change (percentage)
- Market status (open/closed)
- Last price update timestamp

### 7. **Historical Price Data**
- OHLCV data (Open, High, Low, Close, Volume)
- Multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M)
- Historical date range
- Currency
- Adjusted prices (splits, dividends)

### 8. **Instrument Information**
- ISIN
- Full company/fund name
- Trading symbol
- Asset type (stock, ETF, bond, crypto)
- Industry/sector classification
- Country of origin
- Primary currency
- Market capitalization
- Available exchanges
- Trading hours
- Minimum order size
- Fee structure

## 👀 Watchlist & Preferences

### 9. **Watchlist Items**
- ISIN of watched instruments
- Date added to watchlist
- Custom notes/tags
- Alert settings
- Price targets

## 📰 Market News & Analysis

### 10. **News Articles**
- Article ID
- Headline
- Summary/excerpt
- Full article content
- Publication timestamp
- News source
- Related ISIN(s)
- News category
- Sentiment analysis (if available)

## 🔍 Asset Discovery & Search

### 11. **Available Instruments**
- Complete catalog of tradeable instruments
- Search results and metadata
- Popular/trending instruments
- New listings
- Delisted instruments

## 📊 WebSocket Real-Time Data

### 12. **Live Price Streams**
- Real-time price updates
- Volume changes
- Market status changes
- Order book updates (if available)

### 13. **Live Portfolio Updates**
- Position value changes
- Portfolio performance updates
- Cash balance changes

### 14. **Live Trading Updates**
- Order status changes
- Execution notifications
- Account alerts

## 🗃️ Production Database Schema Design

I'll create a comprehensive production database schema that stores ALL this information efficiently:

```sql
-- Main Tables for Production Data

-- 1. Account Information
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    total_value REAL,
    total_cost REAL,
    total_return REAL,
    total_return_percentage REAL,
    available_cash REAL,
    available_for_payout REAL,
    currency TEXT DEFAULT 'EUR',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Portfolio Positions
CREATE TABLE positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT,
    isin TEXT,
    quantity REAL,
    average_price REAL,
    current_price REAL,
    market_value REAL,
    total_cost REAL,
    unrealized_pnl REAL,
    unrealized_pnl_percentage REAL,
    currency TEXT,
    exchange TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (isin) REFERENCES instruments(isin)
);

-- 3. Trading Orders
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    isin TEXT,
    order_type TEXT, -- 'market', 'limit'
    side TEXT, -- 'buy', 'sell'
    status TEXT, -- 'pending', 'executed', 'cancelled', 'rejected', 'partial'
    quantity REAL,
    executed_quantity REAL,
    order_price REAL,
    executed_price REAL,
    total_value REAL,
    fees REAL,
    venue TEXT,
    order_timestamp TIMESTAMP,
    execution_timestamp TIMESTAMP,
    expiry_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (isin) REFERENCES instruments(isin)
);

-- 4. Order Executions
CREATE TABLE executions (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    price REAL,
    quantity REAL,
    value REAL,
    fees REAL,
    venue TEXT,
    execution_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 5. Instruments Master Data
CREATE TABLE instruments (
    isin TEXT PRIMARY KEY,
    name TEXT,
    symbol TEXT,
    type TEXT, -- 'stock', 'etf', 'bond', 'crypto', 'warrant'
    sector TEXT,
    industry TEXT,
    country TEXT,
    currency TEXT,
    market_cap REAL,
    exchanges TEXT, -- JSON array of exchanges
    trading_hours TEXT, -- JSON object with trading hours
    min_order_size REAL,
    fee_structure TEXT, -- JSON object with fee details
    is_active BOOLEAN DEFAULT TRUE,
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Real-Time Prices
CREATE TABLE prices_realtime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isin TEXT,
    bid REAL,
    ask REAL,
    last REAL,
    spread REAL,
    volume REAL,
    day_high REAL,
    day_low REAL,
    day_open REAL,
    previous_close REAL,
    day_change REAL,
    day_change_percentage REAL,
    market_status TEXT,
    timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (isin) REFERENCES instruments(isin)
);

-- 7. Historical Prices
CREATE TABLE prices_historical (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isin TEXT,
    timeframe TEXT, -- '1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'
    timestamp TIMESTAMP,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume REAL,
    adjusted_close REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (isin) REFERENCES instruments(isin),
    UNIQUE(isin, timeframe, timestamp)
);

-- 8. Portfolio Performance History
CREATE TABLE portfolio_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT,
    timeframe TEXT, -- '1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'
    value REAL,
    return_absolute REAL,
    return_percentage REAL,
    benchmark_return REAL,
    timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- 9. Watchlist
CREATE TABLE watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT,
    isin TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    price_target REAL,
    alert_enabled BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (isin) REFERENCES instruments(isin),
    UNIQUE(account_id, isin)
);

-- 10. Market News
CREATE TABLE news (
    id TEXT PRIMARY KEY,
    headline TEXT,
    summary TEXT,
    content TEXT,
    source TEXT,
    category TEXT,
    sentiment TEXT,
    related_isins TEXT, -- JSON array of related ISINs
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Cash Positions
CREATE TABLE cash_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT,
    currency TEXT,
    amount REAL,
    available_for_investment REAL,
    available_for_payout REAL,
    pending_settlements REAL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- 12. Data Collection Logs
CREATE TABLE collection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_type TEXT, -- 'portfolio', 'orders', 'prices', 'news', 'watchlist'
    status TEXT, -- 'success', 'error', 'partial'
    records_collected INTEGER,
    errors_count INTEGER,
    duration_ms INTEGER,
    error_details TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_positions_isin ON positions(isin);
CREATE INDEX idx_positions_account ON positions(account_id);
CREATE INDEX idx_orders_isin ON orders(isin);
CREATE INDEX idx_orders_timestamp ON orders(order_timestamp);
CREATE INDEX idx_prices_realtime_isin ON prices_realtime(isin);
CREATE INDEX idx_prices_realtime_timestamp ON prices_realtime(timestamp);
CREATE INDEX idx_prices_historical_isin ON prices_historical(isin);
CREATE INDEX idx_prices_historical_timeframe ON prices_historical(timeframe);
CREATE INDEX idx_prices_historical_timestamp ON prices_historical(timestamp);
CREATE INDEX idx_news_published ON news(published_at);
CREATE INDEX idx_watchlist_account ON watchlist(account_id);
```

## 🎯 Data Collection Priority

### **Tier 1 - Essential Financial Data**
1. Portfolio positions and values
2. Cash positions
3. Order history and executions
4. Current account summary

### **Tier 2 - Market & Analysis Data**
1. Real-time prices for held positions
2. Historical price data
3. Instrument information
4. Portfolio performance history

### **Tier 3 - Enhanced Data**
1. Watchlist items
2. Market news
3. Available instruments catalog
4. Real-time WebSocket streams

This comprehensive database design captures **everything** available from Trade Republic and provides a solid foundation for:
- Portfolio analysis and reporting
- Trading strategy backtesting
- Performance tracking
- Tax reporting
- Investment research
- Risk management
