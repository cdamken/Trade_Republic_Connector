/**
 * Test Database for Comprehensive Asset Information
 * 
 * SQLite-based database for testing and development
 * @author Carlos Damken <carlos@damken.com>
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdir, access } from 'fs/promises';
import type { 
  ComprehensiveAssetInfo, 
  AssetDatabaseRecord,
  AssetSearchQuery,
  AssetSearchResult,
  ComprehensiveHistoricalData 
} from '../types/comprehensive-asset';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface TestDatabaseConfig {
  dbPath?: string;
  enableWAL?: boolean;
  enableCache?: boolean;
  cacheSize?: number;
  autoVacuum?: boolean;
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
}

export class AssetTestDatabase {
  private db!: Database.Database;
  private config: Required<TestDatabaseConfig>;
  private dbPath: string;

  constructor(config?: TestDatabaseConfig) {
    this.config = {
      dbPath: config?.dbPath || join(process.cwd(), 'data', 'test-assets.db'),
      enableWAL: config?.enableWAL ?? true,
      enableCache: config?.enableCache ?? true,
      cacheSize: config?.cacheSize ?? 10000,
      autoVacuum: config?.autoVacuum ?? true,
      journalMode: config?.journalMode ?? 'WAL'
    };

    this.dbPath = this.config.dbPath;
  }

  /**
   * Initialize the database and create tables
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
      try {
        await access(dir);
      } catch {
        await mkdir(dir, { recursive: true });
      }

      // Open database connection
      this.db = new Database(this.dbPath);

      // Configure database
      this.configureBatabase();

      // Create tables
      this.createTables();

      // Create indexes
      this.createIndexes();

      logger.info('📊 Test database initialized successfully', { 
        path: this.dbPath,
        config: this.config 
      });

    } catch (error) {
      logger.error('❌ Failed to initialize test database', { error });
      throw error;
    }
  }

  /**
   * Insert or update comprehensive asset information
   */
  public async upsertAsset(assetInfo: ComprehensiveAssetInfo): Promise<string> {
    const record: AssetDatabaseRecord = {
      ...assetInfo,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      source: 'trade-republic-connector',
      checksum: this.calculateChecksum(assetInfo)
    };

    try {
      // Key comprehensive asset data fields
      const values = [
        record.id, record.isin, record.wkn, record.symbol, record.name, record.shortName, record.longName,
        record.type, record.subType, record.category, record.sector, record.industry,
        record.country, record.countryCode, record.region, record.homeExchange, record.currency,
        record.tradingCurrency, record.currentPrice, record.bid, record.ask, record.spread, record.volume,
        record.dayOpen, record.dayHigh, record.dayLow, record.dayClose, record.previousClose,
        record.dayChange, record.dayChangePercentage, record.week52High, record.week52Low,
        record.marketCap, record.peRatio, record.dividendYield, record.beta, record.volatility,
        record.tradingStatus, record.tradeRepublicTradable ? 1 : 0, record.tradeRepublicFractional ? 1 : 0, record.tradeRepublicSavingsPlan ? 1 : 0,
        record.lastUpdated.toISOString(), record.createdAt.toISOString(), record.updatedAt.toISOString(), 
        record.version, record.source, record.checksum,
        JSON.stringify(record.dataProviders || []), record.reliability
      ];

      logger.debug('📊 Values being inserted', { 
        isin: record.isin, 
        valueCount: values.length,
        undefinedCount: values.filter(v => v === undefined).length
      });

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO assets (
          id, isin, wkn, symbol, name, short_name, long_name,
          type, sub_type, category, sector, industry,
          country, country_code, region, home_exchange, currency,
          trading_currency, current_price, bid, ask, spread, volume,
          day_open, day_high, day_low, day_close, previous_close,
          day_change, day_change_percentage, week52_high, week52_low,
          market_cap, pe_ratio, dividend_yield, beta, volatility,
          trading_status, tr_tradable, tr_fractional, tr_savings_plan,
          last_updated, created_at, updated_at, version, source, checksum,
          data_providers, reliability
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      stmt.run(...values);

      // Store exchanges data
      if (record.exchanges) {
        await this.upsertExchanges(record.id, record.exchanges);
      }

      // Store historical data
      if (record.historicalData) {
        await this.upsertHistoricalData(record.id, record.historicalData);
      }

      // Store news data
      if (record.latestNews) {
        await this.upsertNews(record.id, record.latestNews);
      }

      logger.debug('✅ Asset upserted successfully', { isin: record.isin, id: record.id });
      return record.id;

    } catch (error: any) {
      logger.error('❌ Failed to upsert asset', { 
        isin: assetInfo.isin, 
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        },
        recordSample: {
          isin: record.isin,
          name: record.name,
          symbol: record.symbol,
          type: record.type,
          country: record.country,
          homeExchange: record.homeExchange,
          currency: record.currency,
          currentPrice: record.currentPrice,
          tradingStatus: record.tradingStatus
        }
      });
      throw error;
    }
  }

  /**
   * Get comprehensive asset information by ISIN
   */
  public async getAssetByIsin(isin: string): Promise<ComprehensiveAssetInfo | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM assets WHERE isin = ?
      `);

      const row = stmt.get(isin) as any;
      if (!row) return null;

      const asset = this.rowToAssetInfo(row);

      // Load related data
      asset.exchanges = await this.getExchanges(row.id);
      asset.latestNews = await this.getNews(row.id);

      logger.debug('✅ Asset retrieved by ISIN', { isin });
      return asset;

    } catch (error) {
      logger.error('❌ Failed to get asset by ISIN', { isin, error });
      throw error;
    }
  }

  /**
   * Search assets with filters
   */
  public async searchAssets(query: AssetSearchQuery): Promise<AssetSearchResult> {
    try {
      const { whereClause, params } = this.buildSearchQuery(query);
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      // Get total count
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total FROM assets ${whereClause}
      `);
      const countResult = countStmt.get(...params) as { total: number };

      // Get results
      const searchStmt = this.db.prepare(`
        SELECT * FROM assets ${whereClause}
        ORDER BY ${this.getSortClause(query)}
        LIMIT ? OFFSET ?
      `);

      const rows = searchStmt.all(...params, limit, offset) as any[];
      const assets = await Promise.all(
        rows.map(async (row) => {
          const asset = this.rowToAssetInfo(row);
          asset.exchanges = await this.getExchanges(row.id);
          return asset;
        })
      );

      const result: AssetSearchResult = {
        assets,
        total: countResult.total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: offset + limit < countResult.total,
        searchTime: 0 // Would be calculated in real implementation
      };

      logger.debug('✅ Asset search completed', { 
        query: query.query, 
        found: assets.length, 
        total: countResult.total 
      });

      return result;

    } catch (error) {
      logger.error('❌ Failed to search assets', { query, error });
      throw error;
    }
  }

  /**
   * Get all available ISINs
   */
  public async getAllIsins(): Promise<string[]> {
    try {
      const stmt = this.db.prepare('SELECT isin FROM assets ORDER BY isin');
      const rows = stmt.all() as { isin: string }[];
      return rows.map(row => row.isin);
    } catch (error) {
      logger.error('❌ Failed to get all ISINs', { error });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public async getStatistics(): Promise<{
    totalAssets: number;
    assetTypes: Record<string, number>;
    countries: Record<string, number>;
    currencies: Record<string, number>;
    lastUpdated: Date;
    databaseSize: number;
  }> {
    try {
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM assets');
      const total = totalStmt.get() as { count: number };

      const typesStmt = this.db.prepare('SELECT type, COUNT(*) as count FROM assets GROUP BY type');
      const types = typesStmt.all() as Array<{ type: string; count: number }>;

      const countriesStmt = this.db.prepare('SELECT country, COUNT(*) as count FROM assets GROUP BY country');
      const countries = countriesStmt.all() as Array<{ country: string; count: number }>;

      const currenciesStmt = this.db.prepare('SELECT currency, COUNT(*) as count FROM assets GROUP BY currency');
      const currencies = currenciesStmt.all() as Array<{ currency: string; count: number }>;

      const lastUpdatedStmt = this.db.prepare('SELECT MAX(last_updated) as last_updated FROM assets');
      const lastUpdated = lastUpdatedStmt.get() as { last_updated: string };

      return {
        totalAssets: total.count,
        assetTypes: Object.fromEntries(types.map(t => [t.type, t.count])),
        countries: Object.fromEntries(countries.map(c => [c.country, c.count])),
        currencies: Object.fromEntries(currencies.map(c => [c.currency, c.count])),
        lastUpdated: new Date(lastUpdated.last_updated),
        databaseSize: this.getDatabaseSize()
      };
    } catch (error) {
      logger.error('❌ Failed to get database statistics', { error });
      throw error;
    }
  }

  /**
   * Clear all data
   */
  public async clearData(): Promise<void> {
    try {
      this.db.exec(`
        DELETE FROM historical_data;
        DELETE FROM exchanges;
        DELETE FROM news;
        DELETE FROM assets;
      `);
      logger.info('🧹 Test database cleared');
    } catch (error) {
      logger.error('❌ Failed to clear database', { error });
      throw error;
    }
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      logger.info('📊 Test database connection closed');
    }
  }

  // =================
  // Private Methods
  // =================

  private configureBatabase(): void {
    this.db.pragma(`journal_mode = ${this.config.journalMode}`);
    this.db.pragma(`cache_size = ${this.config.cacheSize}`);
    
    if (this.config.autoVacuum) {
      this.db.pragma('auto_vacuum = FULL');
    }

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  private createTables(): void {
    // Main assets table with all possible fields
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        isin TEXT UNIQUE NOT NULL,
        wkn TEXT,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        short_name TEXT,
        long_name TEXT,
        
        -- Classification
        type TEXT NOT NULL,
        sub_type TEXT,
        category TEXT,
        sector TEXT,
        industry TEXT,
        
        -- Geographic
        country TEXT NOT NULL,
        country_code TEXT,
        region TEXT,
        home_exchange TEXT NOT NULL,
        currency TEXT NOT NULL,
        trading_currency TEXT,
        quote_currency TEXT,
        
        -- Trading info
        tick_size REAL,
        lot_size INTEGER,
        min_trade_amount REAL,
        max_trade_amount REAL,
        
        -- Current market data
        current_price REAL NOT NULL,
        bid REAL,
        ask REAL,
        spread REAL,
        volume INTEGER,
        vwap REAL,
        
        -- Daily statistics
        day_open REAL,
        day_high REAL,
        day_low REAL,
        day_close REAL,
        previous_close REAL,
        day_change REAL,
        day_change_percentage REAL,
        day_volume INTEGER,
        day_turnover REAL,
        
        -- Extended price data
        week52_high REAL,
        week52_low REAL,
        market_cap REAL,
        shares_outstanding REAL,
        float_shares REAL,
        average_volume REAL,
        average_volume_10day REAL,
        average_volume_30day REAL,
        
        -- Financial metrics
        pe_ratio REAL,
        peg_ratio REAL,
        price_to_book REAL,
        price_to_sales REAL,
        enterprise_value REAL,
        ev_to_revenue REAL,
        ev_to_ebitda REAL,
        profit_margin REAL,
        gross_margin REAL,
        operating_margin REAL,
        return_on_equity REAL,
        return_on_assets REAL,
        
        -- Dividend info
        dividend_yield REAL,
        dividend_per_share REAL,
        dividend_date TEXT,
        ex_dividend_date TEXT,
        payment_date TEXT,
        dividend_frequency TEXT,
        
        -- ETF specific
        net_asset_value REAL,
        premium_discount REAL,
        aum REAL,
        expense_ratio REAL,
        distribution_yield REAL,
        replication_method TEXT,
        tracking_error REAL,
        number_of_holdings INTEGER,
        
        -- Bond specific
        maturity_date TEXT,
        coupon_rate REAL,
        yield_to_maturity REAL,
        current_yield REAL,
        duration REAL,
        modified_duration REAL,
        convexity REAL,
        credit_rating TEXT,
        credit_rating_agency TEXT,
        
        -- Crypto specific
        circulating_supply REAL,
        total_supply REAL,
        max_supply REAL,
        
        -- Risk metrics
        beta REAL,
        volatility REAL,
        volatility_30day REAL,
        volatility_90day REAL,
        sharpe_ratio REAL,
        sortino_ratio REAL,
        max_drawdown REAL,
        var95 REAL,
        
        -- Trading status
        trading_status TEXT NOT NULL,
        is_halted BOOLEAN,
        halt_reason TEXT,
        is_delisted BOOLEAN,
        delisting_date TEXT,
        
        -- Analyst info
        analyst_rating TEXT,
        analyst_count INTEGER,
        price_target REAL,
        price_target_high REAL,
        price_target_low REAL,
        price_target_mean REAL,
        
        -- Technical indicators
        sma20 REAL,
        sma50 REAL,
        sma200 REAL,
        ema12 REAL,
        ema26 REAL,
        rsi REAL,
        macd_line REAL,
        macd_signal REAL,
        macd_histogram REAL,
        bb_upper REAL,
        bb_middle REAL,
        bb_lower REAL,
        bb_bandwidth REAL,
        bb_percent_b REAL,
        
        -- Options
        has_options BOOLEAN,
        implied_volatility REAL,
        open_interest INTEGER,
        
        -- ESG
        esg_score REAL,
        environment_score REAL,
        social_score REAL,
        governance_score REAL,
        controversy_level REAL,
        
        -- Trade Republic specific
        tr_tradable BOOLEAN,
        tr_fractional BOOLEAN,
        tr_savings_plan BOOLEAN,
        
        -- Metadata
        last_updated TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        source TEXT NOT NULL,
        checksum TEXT,
        data_providers TEXT,
        update_frequency TEXT,
        reliability REAL
      )
    `);

    // Exchanges table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        exchange_code TEXT NOT NULL,
        exchange_name TEXT NOT NULL,
        country TEXT NOT NULL,
        timezone TEXT NOT NULL,
        currency TEXT NOT NULL,
        is_primary BOOLEAN NOT NULL,
        open_time TEXT,
        close_time TEXT,
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
      )
    `);

    // Historical data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS historical_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        interval_type TEXT NOT NULL,
        open_price REAL NOT NULL,
        high_price REAL NOT NULL,
        low_price REAL NOT NULL,
        close_price REAL NOT NULL,
        volume INTEGER,
        adjusted_close REAL,
        vwap REAL,
        turnover REAL,
        trades INTEGER,
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
      )
    `);

    // News table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        headline TEXT NOT NULL,
        summary TEXT,
        url TEXT,
        source TEXT NOT NULL,
        published_at TEXT NOT NULL,
        sentiment TEXT,
        relevance_score REAL,
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
      )
    `);
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_assets_isin ON assets (isin);
      CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets (symbol);
      CREATE INDEX IF NOT EXISTS idx_assets_name ON assets (name);
      CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (type);
      CREATE INDEX IF NOT EXISTS idx_assets_country ON assets (country);
      CREATE INDEX IF NOT EXISTS idx_assets_currency ON assets (currency);
      CREATE INDEX IF NOT EXISTS idx_assets_sector ON assets (sector);
      CREATE INDEX IF NOT EXISTS idx_assets_last_updated ON assets (last_updated);
      CREATE INDEX IF NOT EXISTS idx_historical_data_asset_timestamp ON historical_data (asset_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_news_asset_published ON news (asset_id, published_at);
    `);
  }

  private async upsertExchanges(assetId: string, exchanges: any[]): Promise<void> {
    // Delete existing exchanges
    const deleteStmt = this.db.prepare('DELETE FROM exchanges WHERE asset_id = ?');
    deleteStmt.run(assetId);

    // Insert new exchanges
    const insertStmt = this.db.prepare(`
      INSERT INTO exchanges (
        asset_id, exchange_code, exchange_name, country, timezone, 
        currency, is_primary, open_time, close_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const exchange of exchanges) {
      insertStmt.run(
        assetId, 
        exchange.exchangeCode || null, 
        exchange.exchangeName || null, 
        exchange.country || null, 
        exchange.timezone || null, 
        exchange.currency || null, 
        exchange.isPrimary ? 1 : 0,  // Convert boolean to integer
        exchange.tradingHours?.openTime || null, 
        exchange.tradingHours?.closeTime || null
      );
    }
  }

  private async upsertHistoricalData(assetId: string, historicalData: ComprehensiveHistoricalData[]): Promise<void> {
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO historical_data (
        asset_id, timestamp, interval_type, open_price, high_price, 
        low_price, close_price, volume, adjusted_close, vwap, turnover, trades
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const history of historicalData) {
      for (const dataPoint of history.data) {
        insertStmt.run(
          assetId, dataPoint.timestamp.toISOString(), history.interval,
          dataPoint.open, dataPoint.high, dataPoint.low, dataPoint.close,
          dataPoint.volume, dataPoint.adjustedClose, dataPoint.vwap,
          dataPoint.turnover, dataPoint.trades
        );
      }
    }
  }

  private async upsertNews(assetId: string, news: any[]): Promise<void> {
    // Delete old news (keep only recent)
    const deleteStmt = this.db.prepare(`
      DELETE FROM news WHERE asset_id = ? AND published_at < ?
    `);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    deleteStmt.run(assetId, thirtyDaysAgo.toISOString());

    // Insert new news
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO news (
        asset_id, headline, summary, url, source, published_at, sentiment, relevance_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const newsItem of news) {
      insertStmt.run(
        assetId, newsItem.headline, newsItem.summary, newsItem.url,
        newsItem.source, newsItem.publishedAt.toISOString(),
        newsItem.sentiment, newsItem.relevanceScore
      );
    }
  }

  private async getExchanges(assetId: string): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM exchanges WHERE asset_id = ?');
    return stmt.all(assetId) as any[];
  }

  private async getNews(assetId: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM news WHERE asset_id = ? 
      ORDER BY published_at DESC LIMIT 10
    `);
    return stmt.all(assetId) as any[];
  }

  private rowToAssetInfo(row: any): ComprehensiveAssetInfo {
    return {
      isin: row.isin,
      wkn: row.wkn,
      symbol: row.symbol,
      name: row.name,
      shortName: row.short_name,
      longName: row.long_name,
      type: row.type,
      subType: row.sub_type,
      category: row.category,
      sector: row.sector,
      industry: row.industry,
      country: row.country,
      countryCode: row.country_code,
      region: row.region,
      homeExchange: row.home_exchange,
      currency: row.currency,
      tradingCurrency: row.trading_currency,
      quoteCurrency: row.quote_currency,
      tickSize: row.tick_size,
      lotSize: row.lot_size,
      minTradeAmount: row.min_trade_amount,
      maxTradeAmount: row.max_trade_amount,
      currentPrice: row.current_price,
      bid: row.bid,
      ask: row.ask,
      spread: row.spread,
      volume: row.volume,
      volumeWeightedAveragePrice: row.vwap,
      dayOpen: row.day_open,
      dayHigh: row.day_high,
      dayLow: row.day_low,
      dayClose: row.day_close,
      previousClose: row.previous_close,
      dayChange: row.day_change,
      dayChangePercentage: row.day_change_percentage,
      dayVolume: row.day_volume,
      dayTurnover: row.day_turnover,
      week52High: row.week52_high,
      week52Low: row.week52_low,
      marketCap: row.market_cap,
      sharesOutstanding: row.shares_outstanding,
      floatShares: row.float_shares,
      averageVolume: row.average_volume,
      averageVolume10Day: row.average_volume_10day,
      averageVolume30Day: row.average_volume_30day,
      peRatio: row.pe_ratio,
      pegRatio: row.peg_ratio,
      priceToBook: row.price_to_book,
      priceToSales: row.price_to_sales,
      enterpriseValue: row.enterprise_value,
      evToRevenue: row.ev_to_revenue,
      evToEbitda: row.ev_to_ebitda,
      profitMargin: row.profit_margin,
      grossMargin: row.gross_margin,
      operatingMargin: row.operating_margin,
      returnOnEquity: row.return_on_equity,
      returnOnAssets: row.return_on_assets,
      dividendYield: row.dividend_yield,
      dividendPerShare: row.dividend_per_share,
      dividendDate: row.dividend_date ? new Date(row.dividend_date) : undefined,
      exDividendDate: row.ex_dividend_date ? new Date(row.ex_dividend_date) : undefined,
      paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
      dividendFrequency: row.dividend_frequency as any,
      netAssetValue: row.net_asset_value,
      premiumDiscount: row.premium_discount,
      aum: row.aum,
      expenseRatio: row.expense_ratio,
      distributionYield: row.distribution_yield,
      replicationMethod: row.replication_method as any,
      trackingError: row.tracking_error,
      numberOfHoldings: row.number_of_holdings,
      maturityDate: row.maturity_date ? new Date(row.maturity_date) : undefined,
      couponRate: row.coupon_rate,
      yieldToMaturity: row.yield_to_maturity,
      currentYield: row.current_yield,
      duration: row.duration,
      modifiedDuration: row.modified_duration,
      convexity: row.convexity,
      creditRating: row.credit_rating,
      creditRatingAgency: row.credit_rating_agency,
      circulatingSupply: row.circulating_supply,
      totalSupply: row.total_supply,
      maxSupply: row.max_supply,
      beta: row.beta,
      volatility: row.volatility,
      volatility30Day: row.volatility_30day,
      volatility90Day: row.volatility_90day,
      sharpeRatio: row.sharpe_ratio,
      sortinoRatio: row.sortino_ratio,
      maxDrawdown: row.max_drawdown,
      var95: row.var95,
      tradingStatus: row.trading_status,
      isHalted: row.is_halted,
      haltReason: row.halt_reason,
      isDelisted: row.is_delisted,
      delistingDate: row.delisting_date ? new Date(row.delisting_date) : undefined,
      analystRating: row.analyst_rating ? {
        rating: row.analyst_rating,
        numberOfAnalysts: row.analyst_count,
        lastUpdated: new Date(row.updated_at)
      } : undefined,
      priceTarget: row.price_target,
      priceTargetHigh: row.price_target_high,
      priceTargetLow: row.price_target_low,
      priceTargetMean: row.price_target_mean,
      sma20: row.sma20,
      sma50: row.sma50,
      sma200: row.sma200,
      ema12: row.ema12,
      ema26: row.ema26,
      rsi: row.rsi,
      macd: row.macd_line ? {
        macd: row.macd_line,
        signal: row.macd_signal,
        histogram: row.macd_histogram
      } : undefined,
      bollingerBands: row.bb_upper ? {
        upper: row.bb_upper,
        middle: row.bb_middle,
        lower: row.bb_lower,
        bandwidth: row.bb_bandwidth,
        percentB: row.bb_percent_b
      } : undefined,
      hasOptions: row.has_options,
      impliedVolatility: row.implied_volatility,
      openInterest: row.open_interest,
      esgScore: row.esg_score,
      environmentScore: row.environment_score,
      socialScore: row.social_score,
      governanceScore: row.governance_score,
      controversyLevel: row.controversy_level,
      tradeRepublicTradable: row.tr_tradable,
      tradeRepublicFractional: row.tr_fractional,
      tradeRepublicSavingsPlan: row.tr_savings_plan,
      lastUpdated: new Date(row.last_updated),
      dataProviders: row.data_providers ? JSON.parse(row.data_providers) : [],
      updateFrequency: row.update_frequency,
      reliability: row.reliability,
      exchanges: [] // Will be populated separately
    };
  }

  private buildSearchQuery(query: AssetSearchQuery): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.query) {
      conditions.push('(name LIKE ? OR symbol LIKE ? OR isin LIKE ?)');
      const searchTerm = `%${query.query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (query.type && query.type.length > 0) {
      conditions.push(`type IN (${query.type.map(() => '?').join(', ')})`);
      params.push(...query.type);
    }

    if (query.country && query.country.length > 0) {
      conditions.push(`country IN (${query.country.map(() => '?').join(', ')})`);
      params.push(...query.country);
    }

    if (query.currency && query.currency.length > 0) {
      conditions.push(`currency IN (${query.currency.map(() => '?').join(', ')})`);
      params.push(...query.currency);
    }

    if (query.sector && query.sector.length > 0) {
      conditions.push(`sector IN (${query.sector.map(() => '?').join(', ')})`);
      params.push(...query.sector);
    }

    if (query.marketCapMin !== undefined) {
      conditions.push('market_cap >= ?');
      params.push(query.marketCapMin);
    }

    if (query.marketCapMax !== undefined) {
      conditions.push('market_cap <= ?');
      params.push(query.marketCapMax);
    }

    if (query.priceMin !== undefined) {
      conditions.push('current_price >= ?');
      params.push(query.priceMin);
    }

    if (query.priceMax !== undefined) {
      conditions.push('current_price <= ?');
      params.push(query.priceMax);
    }

    if (query.tradableOnTR !== undefined) {
      conditions.push('tr_tradable = ?');
      params.push(query.tradableOnTR);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  private getSortClause(query: AssetSearchQuery): string {
    const sortBy = query.sortBy || 'name';
    const sortOrder = query.sortOrder || 'asc';
    
    const columnMap: Record<string, string> = {
      name: 'name',
      symbol: 'symbol',
      price: 'current_price',
      marketCap: 'market_cap',
      volume: 'volume',
      dayChange: 'day_change',
      dayChangePercentage: 'day_change_percentage',
      peRatio: 'pe_ratio',
      dividendYield: 'dividend_yield',
      lastUpdated: 'last_updated'
    };

    const column = columnMap[sortBy] || 'name';
    return `${column} ${sortOrder.toUpperCase()}`;
  }

  private calculateChecksum(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private getDatabaseSize(): number {
    try {
      const fs = require('fs');
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}
