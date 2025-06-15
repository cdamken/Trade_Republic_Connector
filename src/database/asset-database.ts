/**
 * Trade Republic Asset Database Manager
 * 
 * Provides database storage and retrieval for Trade Republic assets
 * with real-time price updates and portfolio management.
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import Database from 'better-sqlite3';
import { writeFile } from 'fs/promises';
import path from 'path';

export interface Asset {
  isin: string;
  name?: string;
  symbol?: string;
  type: 'stock' | 'etf' | 'bond' | 'crypto' | 'unknown';
  market: string;
  sector?: string;
  currency?: string;
  discoveryMethod: string;
  discoveredAt: string;
  verified: boolean;
  lastUpdated: string;
}

export interface PriceData {
  isin: string;
  timestamp: number;
  price: number;
  bid?: number;
  ask?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  currency: string;
  source: string;
}

export interface Portfolio {
  userId: string;
  isin: string;
  quantity: number;
  averagePrice: number;
  currentValue: number;
  unrealizedPnl: number;
  lastUpdated: string;
}

export class AssetDatabaseManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = './data/trade-republic-assets.db') {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables() {
    // Assets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        isin TEXT PRIMARY KEY,
        name TEXT,
        symbol TEXT,
        type TEXT NOT NULL,
        market TEXT NOT NULL,
        sector TEXT,
        currency TEXT DEFAULT 'EUR',
        discovery_method TEXT NOT NULL,
        discovered_at TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        last_updated TEXT NOT NULL
      )
    `);

    // Price data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isin TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        price REAL NOT NULL,
        bid REAL,
        ask REAL,
        open REAL,
        high REAL,
        low REAL,
        volume INTEGER,
        currency TEXT DEFAULT 'EUR',
        source TEXT NOT NULL,
        FOREIGN KEY (isin) REFERENCES assets (isin)
      )
    `);

    // Portfolio table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        isin TEXT NOT NULL,
        quantity REAL NOT NULL,
        average_price REAL NOT NULL,
        current_value REAL NOT NULL,
        unrealized_pnl REAL NOT NULL,
        last_updated TEXT NOT NULL,
        FOREIGN KEY (isin) REFERENCES assets (isin)
      )
    `);

    // Create indices for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_price_data_isin_timestamp 
      ON price_data (isin, timestamp);
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_user_id 
      ON portfolio (user_id);
    `);

    console.log('✅ Database tables initialized');
  }

  /**
   * Insert or update an asset
   */
  insertAsset(asset: Asset): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO assets 
      (isin, name, symbol, type, market, sector, currency, discovery_method, discovered_at, verified, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      asset.isin,
      asset.name,
      asset.symbol,
      asset.type,
      asset.market,
      asset.sector,
      asset.currency || 'EUR',
      asset.discoveryMethod,
      asset.discoveredAt,
      asset.verified ? 1 : 0,
      asset.lastUpdated
    );
  }

  /**
   * Batch insert assets
   */
  insertAssetsBatch(assets: Asset[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO assets 
      (isin, name, symbol, type, market, sector, currency, discovery_method, discovered_at, verified, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((assets: Asset[]) => {
      for (const asset of assets) {
        stmt.run(
          asset.isin,
          asset.name,
          asset.symbol,
          asset.type,
          asset.market,
          asset.sector,
          asset.currency || 'EUR',
          asset.discoveryMethod,
          asset.discoveredAt,
          asset.verified ? 1 : 0,
          asset.lastUpdated
        );
      }
    });

    transaction(assets);
    console.log(`✅ Inserted ${assets.length} assets`);
  }

  /**
   * Insert price data
   */
  insertPriceData(priceData: PriceData): void {
    const stmt = this.db.prepare(`
      INSERT INTO price_data 
      (isin, timestamp, price, bid, ask, open, high, low, volume, currency, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      priceData.isin,
      priceData.timestamp,
      priceData.price,
      priceData.bid,
      priceData.ask,
      priceData.open,
      priceData.high,
      priceData.low,
      priceData.volume,
      priceData.currency,
      priceData.source
    );
  }

  /**
   * Batch insert price data
   */
  insertPriceDataBatch(priceDataList: PriceData[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO price_data 
      (isin, timestamp, price, bid, ask, open, high, low, volume, currency, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((priceDataList: PriceData[]) => {
      for (const priceData of priceDataList) {
        stmt.run(
          priceData.isin,
          priceData.timestamp,
          priceData.price,
          priceData.bid,
          priceData.ask,
          priceData.open,
          priceData.high,
          priceData.low,
          priceData.volume,
          priceData.currency,
          priceData.source
        );
      }
    });

    transaction(priceDataList);
    console.log(`✅ Inserted ${priceDataList.length} price records`);
  }

  /**
   * Get all assets
   */
  getAllAssets(): Asset[] {
    const stmt = this.db.prepare(`
      SELECT isin, name, symbol, type, market, sector, currency, 
             discovery_method as discoveryMethod, discovered_at as discoveredAt, 
             verified, last_updated as lastUpdated
      FROM assets
      ORDER BY last_updated DESC
    `);

    return stmt.all().map((row: any) => ({
      isin: row.isin,
      name: row.name,
      symbol: row.symbol,
      type: row.type,
      market: row.market,
      sector: row.sector,
      currency: row.currency,
      discoveryMethod: row.discoveryMethod,
      discoveredAt: row.discoveredAt,
      verified: Boolean(row.verified),
      lastUpdated: row.lastUpdated
    }));
  }

  /**
   * Get verified assets only
   */
  getVerifiedAssets(): Asset[] {
    const stmt = this.db.prepare(`
      SELECT isin, name, symbol, type, market, sector, currency,
             discovery_method as discoveryMethod, discovered_at as discoveredAt,
             verified, last_updated as lastUpdated
      FROM assets
      WHERE verified = 1
      ORDER BY last_updated DESC
    `);

    return stmt.all().map((row: any) => ({
      isin: row.isin,
      name: row.name,
      symbol: row.symbol,
      type: row.type,
      market: row.market,
      sector: row.sector,
      currency: row.currency,
      discoveryMethod: row.discoveryMethod,
      discoveredAt: row.discoveredAt,
      verified: Boolean(row.verified),
      lastUpdated: row.lastUpdated
    }));
  }

  /**
   * Get assets by type
   */
  getAssetsByType(type: Asset['type']): Asset[] {
    const stmt = this.db.prepare(`
      SELECT isin, name, symbol, type, market, sector, currency,
             discovery_method as discoveryMethod, discovered_at as discoveredAt,
             verified, last_updated as lastUpdated
      FROM assets
      WHERE type = ? AND verified = 1
      ORDER BY last_updated DESC
    `);

    return stmt.all(type).map((row: any) => ({
      isin: row.isin,
      name: row.name,
      symbol: row.symbol,
      type: row.type,
      market: row.market,
      sector: row.sector,
      currency: row.currency,
      discoveryMethod: row.discoveryMethod,
      discoveredAt: row.discoveredAt,
      verified: Boolean(row.verified),
      lastUpdated: row.lastUpdated
    }));
  }

  /**
   * Get latest price for an asset
   */
  getLatestPrice(isin: string): PriceData | null {
    const stmt = this.db.prepare(`
      SELECT isin, timestamp, price, bid, ask, open, high, low, volume, currency, source
      FROM price_data
      WHERE isin = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    return stmt.get(isin) as PriceData | null;
  }

  /**
   * Get price history for an asset
   */
  getPriceHistory(isin: string, limit: number = 100): PriceData[] {
    const stmt = this.db.prepare(`
      SELECT isin, timestamp, price, bid, ask, open, high, low, volume, currency, source
      FROM price_data
      WHERE isin = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(isin, limit) as PriceData[];
  }

  /**
   * Get database statistics
   */
  getStatistics() {
    const totalAssets = this.db.prepare('SELECT COUNT(*) as count FROM assets').get() as { count: number };
    const verifiedAssets = this.db.prepare('SELECT COUNT(*) as count FROM assets WHERE verified = 1').get() as { count: number };
    const priceRecords = this.db.prepare('SELECT COUNT(*) as count FROM price_data').get() as { count: number };
    
    const assetsByType = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM assets 
      WHERE verified = 1 
      GROUP BY type
    `).all() as { type: string; count: number }[];

    const assetsByMarket = this.db.prepare(`
      SELECT market, COUNT(*) as count 
      FROM assets 
      WHERE verified = 1 
      GROUP BY market
    `).all() as { market: string; count: number }[];

    return {
      totalAssets: totalAssets.count,
      verifiedAssets: verifiedAssets.count,
      priceRecords: priceRecords.count,
      assetsByType: Object.fromEntries(assetsByType.map(row => [row.type, row.count])),
      assetsByMarket: Object.fromEntries(assetsByMarket.map(row => [row.market, row.count]))
    };
  }

  /**
   * Export assets to JSON
   */
  async exportToJSON(filename: string): Promise<void> {
    const assets = this.getAllAssets();
    const statistics = this.getStatistics();
    
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalAssets: assets.length,
        statistics
      },
      assets
    };

    await writeFile(filename, JSON.stringify(exportData, null, 2));
    console.log(`✅ Exported ${assets.length} assets to ${filename}`);
  }

  /**
   * Export to CSV
   */
  async exportToCSV(filename: string): Promise<void> {
    const assets = this.getVerifiedAssets();
    
    const csvHeader = 'ISIN,Name,Symbol,Type,Market,Sector,Currency,Verified,LastUpdated\n';
    const csvRows = assets.map(asset => 
      `"${asset.isin}","${asset.name || ''}","${asset.symbol || ''}","${asset.type}","${asset.market}","${asset.sector || ''}","${asset.currency}","${asset.verified}","${asset.lastUpdated}"`
    ).join('\n');

    await writeFile(filename, csvHeader + csvRows);
    console.log(`✅ Exported ${assets.length} assets to CSV: ${filename}`);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    console.log('✅ Database connection closed');
  }
}

// Example usage and testing
export async function demonstrateAssetDatabase() {
  console.log('\n💾 ASSET DATABASE DEMONSTRATION');
  console.log('==============================');
  
  const dbManager = new AssetDatabaseManager();
  
  try {
    // Load existing data from bulk collection
    const fs = await import('fs/promises');
    try {
      const bulkData = await fs.readFile('./data/bulk-asset-collection.json', 'utf-8');
      const data = JSON.parse(bulkData);
      
      if (data.discoveredAssets && data.discoveredAssets.length > 0) {
        console.log(`📥 Loading ${data.discoveredAssets.length} assets from bulk collection...`);
        
        const assets: Asset[] = data.discoveredAssets.map((asset: any) => ({
          isin: asset.isin,
          name: asset.name,
          symbol: asset.symbol,
          type: asset.type || 'stock',
          market: asset.exchange || 'UNKNOWN',
          sector: asset.sector,
          currency: asset.currency || 'EUR',
          discoveryMethod: asset.discoveryMethod,
          discoveredAt: asset.discoveredAt,
          verified: Boolean(asset.priceData),
          lastUpdated: new Date().toISOString()
        }));
        
        dbManager.insertAssetsBatch(assets);
        
        // Insert price data
        const priceDataList: PriceData[] = data.discoveredAssets
          .filter((asset: any) => asset.priceData)
          .map((asset: any) => ({
            isin: asset.isin,
            timestamp: Date.now(),
            price: parseFloat(asset.currentPrice || asset.priceData.last?.price || '0'),
            bid: asset.priceData.bid ? parseFloat(asset.priceData.bid.price) : undefined,
            ask: asset.priceData.ask ? parseFloat(asset.priceData.ask.price) : undefined,
            open: asset.priceData.open ? parseFloat(asset.priceData.open.price) : undefined,
            currency: 'EUR',
            source: 'websocket'
          }));
        
        dbManager.insertPriceDataBatch(priceDataList);
      }
    } catch (error) {
      console.log('📂 No bulk collection data found, using sample data...');
      
      // Insert sample data
      const sampleAssets: Asset[] = [
        {
          isin: 'US0378331005',
          name: 'Apple Inc',
          symbol: 'AAPL',
          type: 'stock',
          market: 'NASDAQ',
          sector: 'Technology',
          currency: 'USD',
          discoveryMethod: 'sample',
          discoveredAt: new Date().toISOString(),
          verified: true,
          lastUpdated: new Date().toISOString()
        }
      ];
      
      dbManager.insertAssetsBatch(sampleAssets);
    }
    
    // Display statistics
    const stats = dbManager.getStatistics();
    console.log('\n📊 DATABASE STATISTICS:');
    console.log('=====================');
    console.log(`Total assets: ${stats.totalAssets}`);
    console.log(`Verified assets: ${stats.verifiedAssets}`);
    console.log(`Price records: ${stats.priceRecords}`);
    console.log('Assets by type:', stats.assetsByType);
    console.log('Assets by market:', stats.assetsByMarket);
    
    // Export data
    await dbManager.exportToJSON('./data/assets-export.json');
    await dbManager.exportToCSV('./data/assets-export.csv');
    
  } catch (error) {
    console.error('❌ Database demonstration failed:', error);
  } finally {
    dbManager.close();
  }
}

// Run demonstration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAssetDatabase().catch(console.error);
}
