/**
 * Production Trade Republic Database Manager
 * 
 * Comprehensive database for storing ALL Trade Republic data including:
 * - Portfolio positions and performance
 * - Trading history and executions
 * - Market data and prices
 * - Instruments and metadata
 * - Watchlist and news
 * - Account information
 */

import Database from 'better-sqlite3';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Comprehensive interfaces for production data
export interface Account {
  id: string;
  userId?: string;
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercentage: number;
  availableCash: number;
  availableForPayout: number;
  currency: string;
  lastUpdated: string;
}

export interface Position {
  id?: number;
  accountId: string;
  isin: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPercentage: number;
  currency: string;
  exchange: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  accountId: string;
  isin: string;
  orderType: 'market' | 'limit';
  side: 'buy' | 'sell';
  status: 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial';
  quantity: number;
  executedQuantity: number;
  orderPrice?: number;
  executedPrice?: number;
  totalValue: number;
  fees: number;
  venue: string;
  orderTimestamp: string;
  executionTimestamp?: string;
  expiryDate?: string;
  createdAt?: string;
}

export interface Execution {
  id: string;
  orderId: string;
  price: number;
  quantity: number;
  value: number;
  fees: number;
  venue: string;
  executionTimestamp: string;
  createdAt?: string;
}

export interface Instrument {
  isin: string;
  name: string;
  symbol: string;
  type: 'stock' | 'etf' | 'bond' | 'crypto' | 'warrant';
  sector?: string;
  industry?: string;
  country?: string;
  currency: string;
  marketCap?: number;
  exchanges: string; // JSON array
  tradingHours?: string; // JSON object
  minOrderSize?: number;
  feeStructure?: string; // JSON object
  isActive: boolean;
  discoveredAt?: string;
  lastUpdated?: string;
}

export interface RealtimePrice {
  id?: number;
  isin: string;
  bid?: number;
  ask?: number;
  last: number;
  spread?: number;
  volume?: number;
  dayHigh?: number;
  dayLow?: number;
  dayOpen?: number;
  previousClose?: number;
  dayChange?: number;
  dayChangePercentage?: number;
  marketStatus?: string;
  timestamp: string;
  createdAt?: string;
}

export interface HistoricalPrice {
  id?: number;
  isin: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  adjustedClose?: number;
  createdAt?: string;
}

export interface PortfolioPerformance {
  id?: number;
  accountId: string;
  timeframe: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
  value: number;
  returnAbsolute: number;
  returnPercentage: number;
  benchmarkReturn?: number;
  timestamp: string;
  createdAt?: string;
}

export interface WatchlistItem {
  id?: number;
  accountId: string;
  isin: string;
  addedAt?: string;
  notes?: string;
  priceTarget?: number;
  alertEnabled: boolean;
}

export interface NewsArticle {
  id: string;
  headline: string;
  summary?: string;
  content?: string;
  source: string;
  category?: string;
  sentiment?: string;
  relatedIsins?: string; // JSON array
  publishedAt: string;
  createdAt?: string;
}

export interface CashPosition {
  id?: number;
  accountId: string;
  currency: string;
  amount: number;
  availableForInvestment: number;
  availableForPayout: number;
  pendingSettlements?: number;
  lastUpdated?: string;
}

export interface CollectionLog {
  id?: number;
  collectionType: string;
  status: 'success' | 'error' | 'partial';
  recordsCollected: number;
  errorsCount: number;
  durationMs: number;
  errorDetails?: string;
  startedAt: string;
  completedAt?: string;
}

export class ProductionDatabaseManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    
    this.initializeTables();
  }

  private initializeTables(): void {
    const schema = `
      -- 1. Account Information
      CREATE TABLE IF NOT EXISTS accounts (
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
      CREATE TABLE IF NOT EXISTS positions (
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
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        isin TEXT,
        order_type TEXT,
        side TEXT,
        status TEXT,
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
      CREATE TABLE IF NOT EXISTS executions (
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
      CREATE TABLE IF NOT EXISTS instruments (
        isin TEXT PRIMARY KEY,
        name TEXT,
        symbol TEXT,
        type TEXT,
        sector TEXT,
        industry TEXT,
        country TEXT,
        currency TEXT,
        market_cap REAL,
        exchanges TEXT,
        trading_hours TEXT,
        min_order_size REAL,
        fee_structure TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 6. Real-Time Prices
      CREATE TABLE IF NOT EXISTS prices_realtime (
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
      CREATE TABLE IF NOT EXISTS prices_historical (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isin TEXT,
        timeframe TEXT,
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
      CREATE TABLE IF NOT EXISTS portfolio_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT,
        timeframe TEXT,
        value REAL,
        return_absolute REAL,
        return_percentage REAL,
        benchmark_return REAL,
        timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      -- 9. Watchlist
      CREATE TABLE IF NOT EXISTS watchlist (
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
      CREATE TABLE IF NOT EXISTS news (
        id TEXT PRIMARY KEY,
        headline TEXT,
        summary TEXT,
        content TEXT,
        source TEXT,
        category TEXT,
        sentiment TEXT,
        related_isins TEXT,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 11. Cash Positions
      CREATE TABLE IF NOT EXISTS cash_positions (
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
      CREATE TABLE IF NOT EXISTS collection_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_type TEXT,
        status TEXT,
        records_collected INTEGER,
        errors_count INTEGER,
        duration_ms INTEGER,
        error_details TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_positions_isin ON positions(isin);
      CREATE INDEX IF NOT EXISTS idx_positions_account ON positions(account_id);
      CREATE INDEX IF NOT EXISTS idx_orders_isin ON orders(isin);
      CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(order_timestamp);
      CREATE INDEX IF NOT EXISTS idx_prices_realtime_isin ON prices_realtime(isin);
      CREATE INDEX IF NOT EXISTS idx_prices_realtime_timestamp ON prices_realtime(timestamp);
      CREATE INDEX IF NOT EXISTS idx_prices_historical_isin ON prices_historical(isin);
      CREATE INDEX IF NOT EXISTS idx_prices_historical_timeframe ON prices_historical(timeframe);
      CREATE INDEX IF NOT EXISTS idx_prices_historical_timestamp ON prices_historical(timestamp);
      CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);
      CREATE INDEX IF NOT EXISTS idx_watchlist_account ON watchlist(account_id);
    `;

    this.db.exec(schema);
    console.log('✅ Production database tables initialized');
  }

  // Account Methods
  insertAccount(account: Account): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO accounts 
      (id, user_id, total_value, total_cost, total_return, total_return_percentage, 
       available_cash, available_for_payout, currency, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      account.id,
      account.userId,
      account.totalValue,
      account.totalCost,
      account.totalReturn,
      account.totalReturnPercentage,
      account.availableCash,
      account.availableForPayout,
      account.currency,
      account.lastUpdated
    );
  }

  // Position Methods
  insertPosition(position: Position): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO positions 
      (account_id, isin, quantity, average_price, current_price, market_value,
       total_cost, unrealized_pnl, unrealized_pnl_percentage, currency, exchange)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      position.accountId,
      position.isin,
      position.quantity,
      position.averagePrice,
      position.currentPrice,
      position.marketValue,
      position.totalCost,
      position.unrealizedPnl,
      position.unrealizedPnlPercentage,
      position.currency,
      position.exchange
    );
  }

  // Order Methods
  insertOrder(order: Order): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO orders 
      (id, account_id, isin, order_type, side, status, quantity, executed_quantity,
       order_price, executed_price, total_value, fees, venue, order_timestamp,
       execution_timestamp, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      order.id,
      order.accountId,
      order.isin,
      order.orderType,
      order.side,
      order.status,
      order.quantity,
      order.executedQuantity,
      order.orderPrice,
      order.executedPrice,
      order.totalValue,
      order.fees,
      order.venue,
      order.orderTimestamp,
      order.executionTimestamp,
      order.expiryDate
    );
  }

  // Instrument Methods
  insertInstrument(instrument: Instrument): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO instruments 
      (isin, name, symbol, type, sector, industry, country, currency,
       market_cap, exchanges, trading_hours, min_order_size, fee_structure, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      instrument.isin,
      instrument.name,
      instrument.symbol,
      instrument.type,
      instrument.sector,
      instrument.industry,
      instrument.country,
      instrument.currency,
      instrument.marketCap,
      instrument.exchanges,
      instrument.tradingHours,
      instrument.minOrderSize,
      instrument.feeStructure,
      instrument.isActive
    );
  }

  // Price Methods
  insertRealtimePrice(price: RealtimePrice): void {
    const stmt = this.db.prepare(`
      INSERT INTO prices_realtime 
      (isin, bid, ask, last, spread, volume, day_high, day_low, day_open,
       previous_close, day_change, day_change_percentage, market_status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      price.isin,
      price.bid,
      price.ask,
      price.last,
      price.spread,
      price.volume,
      price.dayHigh,
      price.dayLow,
      price.dayOpen,
      price.previousClose,
      price.dayChange,
      price.dayChangePercentage,
      price.marketStatus,
      price.timestamp
    );
  }

  insertHistoricalPrice(price: HistoricalPrice): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO prices_historical 
      (isin, timeframe, timestamp, open, high, low, close, volume, adjusted_close)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      price.isin,
      price.timeframe,
      price.timestamp,
      price.open,
      price.high,
      price.low,
      price.close,
      price.volume,
      price.adjustedClose
    );
  }

  // Bulk insert methods for efficiency
  insertHistoricalPricesBulk(prices: HistoricalPrice[]): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO prices_historical 
      (isin, timeframe, timestamp, open, high, low, close, volume, adjusted_close)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = this.db.transaction((prices: HistoricalPrice[]) => {
      for (const price of prices) {
        stmt.run(
          price.isin,
          price.timeframe,
          price.timestamp,
          price.open,
          price.high,
          price.low,
          price.close,
          price.volume,
          price.adjustedClose
        );
      }
    });
    
    transaction(prices);
  }

  // Query Methods
  getAccountSummary(accountId: string): Account | undefined {
    const stmt = this.db.prepare('SELECT * FROM accounts WHERE id = ?');
    return stmt.get(accountId) as Account | undefined;
  }

  getAllPositions(accountId: string): Position[] {
    const stmt = this.db.prepare('SELECT * FROM positions WHERE account_id = ? ORDER BY market_value DESC');
    return stmt.all(accountId) as Position[];
  }

  getOrderHistory(accountId: string, limit: number = 100): Order[] {
    const stmt = this.db.prepare(`
      SELECT * FROM orders 
      WHERE account_id = ? 
      ORDER BY order_timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(accountId, limit) as Order[];
  }

  getLatestPrices(isins: string[]): RealtimePrice[] {
    const placeholders = isins.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT DISTINCT isin, bid, ask, last, timestamp
      FROM prices_realtime 
      WHERE isin IN (${placeholders})
      AND timestamp = (
        SELECT MAX(timestamp) 
        FROM prices_realtime p2 
        WHERE p2.isin = prices_realtime.isin
      )
    `);
    return stmt.all(...isins) as RealtimePrice[];
  }

  // Export Methods
  async exportToJSON(exportPath: string): Promise<void> {
    const data = {
      accounts: this.db.prepare('SELECT * FROM accounts').all(),
      positions: this.db.prepare('SELECT * FROM positions').all(),
      orders: this.db.prepare('SELECT * FROM orders ORDER BY order_timestamp DESC LIMIT 1000').all(),
      instruments: this.db.prepare('SELECT * FROM instruments WHERE is_active = TRUE').all(),
      watchlist: this.db.prepare('SELECT * FROM watchlist').all(),
      exportedAt: new Date().toISOString(),
      database: this.dbPath
    };

    await writeFile(exportPath, JSON.stringify(data, null, 2));
  }

  async exportToCSV(exportPath: string): Promise<void> {
    // Export positions as CSV (most commonly needed)
    const positions = this.db.prepare(`
      SELECT 
        p.isin,
        i.name,
        i.symbol,
        p.quantity,
        p.average_price,
        p.current_price,
        p.market_value,
        p.total_cost,
        p.unrealized_pnl,
        p.unrealized_pnl_percentage,
        p.currency,
        p.exchange
      FROM positions p
      LEFT JOIN instruments i ON p.isin = i.isin
      ORDER BY p.market_value DESC
    `).all();

    const header = 'ISIN,Name,Symbol,Quantity,AvgPrice,CurrentPrice,MarketValue,TotalCost,UnrealizedPnL,UnrealizedPnL%,Currency,Exchange\n';
    const rows = positions.map((row: any) => 
      Object.values(row).map(val => val === null ? '' : String(val)).join(',')
    ).join('\n');

    await writeFile(exportPath, header + rows);
  }

  // Analytics Methods
  getPortfolioStats(accountId: string): any {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_positions,
        SUM(market_value) as total_value,
        SUM(total_cost) as total_cost,
        SUM(unrealized_pnl) as total_pnl,
        AVG(unrealized_pnl_percentage) as avg_return_pct,
        MAX(market_value) as largest_position,
        MIN(market_value) as smallest_position
      FROM positions 
      WHERE account_id = ?
    `);
    return stmt.get(accountId);
  }

  getTradingStats(accountId: string): any {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_orders,
        COUNT(CASE WHEN side = 'buy' THEN 1 END) as buy_orders,
        COUNT(CASE WHEN side = 'sell' THEN 1 END) as sell_orders,
        SUM(fees) as total_fees,
        AVG(total_value) as avg_order_value
      FROM orders 
      WHERE account_id = ?
    `);
    return stmt.get(accountId);
  }

  // Utility Methods
  getDatabaseStats(): any {
    const tables = [
      'accounts', 'positions', 'orders', 'executions', 'instruments',
      'prices_realtime', 'prices_historical', 'portfolio_performance',
      'watchlist', 'news', 'cash_positions', 'collection_logs'
    ];
    
    const stats: any = {};
    for (const table of tables) {
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      stats[table] = count.count;
    }
    
    return {
      ...stats,
      databasePath: this.dbPath,
      databaseSize: this.getDatabaseSize()
    };
  }

  private getDatabaseSize(): string {
    try {
      const fs = require('fs');
      const stats = fs.statSync(this.dbPath);
      const sizeInBytes = stats.size;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      return `${sizeInMB} MB`;
    } catch {
      return 'Unknown';
    }
  }

  close(): void {
    this.db.close();
    console.log('✅ Production database connection closed');
  }
}
