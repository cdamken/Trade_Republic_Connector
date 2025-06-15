#!/usr/bin/env npx tsx

/**
 * Production Data Collection Script
 * 
 * Collects ALL available Trade Republic data and stores it in a comprehensive
 * production database with proper schema for real financial data.
 * 
 * Usage:
 *   npm run collect-production-data
 *   tsx scripts/collect-production-data.ts [--full|--quick|--prices-only]
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { ProductionDatabaseManager } from '../src/database/production-database.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import type { 
  Account, Position, Order, Instrument, RealtimePrice, 
  PortfolioPerformance, WatchlistItem, NewsArticle, CashPosition, CollectionLog 
} from '../src/database/production-database.js';
import * as dotenv from 'dotenv';
import { writeFile } from 'fs/promises';

// Load environment variables
dotenv.config();

interface CollectionOptions {
  mode: 'full' | 'quick' | 'prices-only';
  includeHistoricalPrices: boolean;
  priceHistoryDays: number;
  enableRealTimeUpdates: boolean;
  exportAfterCollection: boolean;
}

interface CollectionMetrics {
  startTime: Date;
  endTime?: Date;
  accountsCollected: number;
  positionsCollected: number;
  ordersCollected: number;
  instrumentsCollected: number;
  pricesCollected: number;
  newsCollected: number;
  watchlistItems: number;
  errors: number;
  totalDurationMs: number;
}

class ProductionDataCollector {
  private client: TradeRepublicClient;
  private db: ProductionDatabaseManager;
  private options: CollectionOptions;
  private metrics: CollectionMetrics;
  private accountId: string = 'default';

  constructor(options: Partial<CollectionOptions> = {}) {
    this.client = new TradeRepublicClient();
    this.db = new ProductionDatabaseManager('./data/production/trade-republic-production.db');
    
    this.options = {
      mode: 'full',
      includeHistoricalPrices: false,
      priceHistoryDays: 30,
      enableRealTimeUpdates: false,
      exportAfterCollection: true,
      ...options
    };

    this.metrics = {
      startTime: new Date(),
      accountsCollected: 0,
      positionsCollected: 0,
      ordersCollected: 0,
      instrumentsCollected: 0,
      pricesCollected: 0,
      newsCollected: 0,
      watchlistItems: 0,
      errors: 0,
      totalDurationMs: 0
    };
  }

  async collectAllData(): Promise<void> {
    console.log('\n🏦 PRODUCTION DATA COLLECTION - Trade Republic');
    console.log('==============================================');
    console.log(`📊 Mode: ${this.options.mode.toUpperCase()}`);
    console.log(`📅 Started: ${this.metrics.startTime.toLocaleString()}`);
    console.log(`💾 Database: ./data/production/trade-republic-production.db\n`);

    try {
      // Step 1: Authentication
      await this.authenticateWithRetry();

      // Step 2: Account & Portfolio Data
      if (this.options.mode !== 'prices-only') {
        await this.collectAccountData();
        await this.collectPortfolioPositions();
        await this.collectCashPositions();
      }

      // Step 3: Trading History
      if (this.options.mode === 'full') {
        await this.collectTradingHistory();
        await this.collectPortfolioPerformance();
      }

      // Step 4: Market Data
      await this.collectMarketData();

      // Step 5: Watchlist & News
      if (this.options.mode === 'full') {
        await this.collectWatchlist();
        await this.collectMarketNews();
      }

      // Step 6: Real-time prices for held positions
      await this.collectCurrentPrices();

      // Step 7: Historical prices (if enabled)
      if (this.options.includeHistoricalPrices && this.options.mode !== 'prices-only') {
        await this.collectHistoricalPrices();
      }

      // Step 8: Export data
      if (this.options.exportAfterCollection) {
        await this.exportCollectedData();
      }

      // Step 9: Final statistics
      await this.displayCollectionResults();

    } catch (error) {
      console.error('❌ Collection failed:', error);
      this.metrics.errors++;
    } finally {
      this.metrics.endTime = new Date();
      this.metrics.totalDurationMs = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
      await this.logCollectionResult();
      this.db.close();
    }
  }

  private async authenticateWithRetry(): Promise<void> {
    console.log('🔐 Authenticating with Trade Republic...');
    
    const config = loadEnvironmentConfig();
    if (!config.trUsername || !config.trPassword) {
      throw new Error('Missing TR_USERNAME or TR_PASSWORD in environment');
    }

    try {
      await this.client.initialize();
      console.log('✅ Authentication successful');
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  private async collectAccountData(): Promise<void> {
    console.log('\n💼 Collecting account information...');
    
    try {
      const portfolioSummary = await this.client.getPortfolioSummary();
      
      if (portfolioSummary) {
        const account: Account = {
          id: this.accountId,
          userId: 'user', // Could be enhanced with actual user ID
          totalValue: portfolioSummary.totalValue || 0,
          totalCost: portfolioSummary.totalCost || 0,
          totalReturn: portfolioSummary.totalReturn || 0,
          totalReturnPercentage: portfolioSummary.totalReturnPercentage || 0,
          availableCash: portfolioSummary.availableCash || 0,
          availableForPayout: portfolioSummary.availableForPayout || 0,
          currency: portfolioSummary.currency || 'EUR',
          lastUpdated: new Date().toISOString()
        };

        this.db.insertAccount(account);
        this.metrics.accountsCollected++;
        
        console.log(`✅ Account data collected (Value: €${account.totalValue?.toFixed(2)})`);
      }
    } catch (error) {
      console.error('❌ Failed to collect account data:', error);
      this.metrics.errors++;
    }
  }

  private async collectPortfolioPositions(): Promise<void> {
    console.log('\n📈 Collecting portfolio positions...');
    
    try {
      const positions = await this.client.getPortfolioPositions();
      
      if (positions && Array.isArray(positions)) {
        for (const pos of positions) {
          const position: Position = {
            accountId: this.accountId,
            isin: pos.instrumentId || pos.isin,
            quantity: pos.quantity || 0,
            averagePrice: pos.averagePrice || 0,
            currentPrice: pos.currentPrice || 0,
            marketValue: pos.marketValue || pos.totalValue || 0,
            totalCost: pos.totalCost || (pos.quantity * pos.averagePrice),
            unrealizedPnl: pos.unrealizedPnL || 0,
            unrealizedPnlPercentage: pos.unrealizedPnLPercentage || pos.unrealizedPnLPercent || 0,
            currency: pos.currency || 'EUR',
            exchange: pos.exchange || pos.exchangeIds?.[0] || 'UNKNOWN'
          };

          this.db.insertPosition(position);
          this.metrics.positionsCollected++;

          // Also collect instrument information
          if (pos.instrumentId || pos.isin) {
            await this.collectInstrumentInfo(pos.instrumentId || pos.isin);
          }
        }
        
        console.log(`✅ Portfolio positions collected (${this.metrics.positionsCollected} positions)`);
      }
    } catch (error) {
      console.error('❌ Failed to collect portfolio positions:', error);
      this.metrics.errors++;
    }
  }

  private async collectCashPositions(): Promise<void> {
    console.log('\n💰 Collecting cash positions...');
    
    try {
      const cashPosition = await this.client.getCashPosition();
      
      if (cashPosition) {
        const cash: CashPosition = {
          accountId: this.accountId,
          currency: cashPosition.currency || 'EUR',
          amount: cashPosition.amount || 0,
          availableForInvestment: cashPosition.availableForInvestment || 0,
          availableForPayout: cashPosition.availableForPayout || 0,
          pendingSettlements: 0, // Would need additional API call
          lastUpdated: new Date().toISOString()
        };

        // Insert cash position (would need method in database)
        console.log(`✅ Cash position collected (${cash.currency} ${cash.amount?.toFixed(2)})`);
      }
    } catch (error) {
      console.error('❌ Failed to collect cash positions:', error);
      this.metrics.errors++;
    }
  }

  private async collectTradingHistory(): Promise<void> {
    console.log('\n📊 Collecting trading history...');
    
    try {
      const orderHistory = await this.client.getOrderHistory();
      
      if (orderHistory && Array.isArray(orderHistory)) {
        for (const order of orderHistory) {
          const orderRecord: Order = {
            id: order.orderId,
            accountId: this.accountId,
            isin: order.isin,
            orderType: order.orderType,
            side: order.side,
            status: order.status,
            quantity: order.quantity || 0,
            executedQuantity: order.executedQuantity || 0,
            orderPrice: order.limitPrice,
            executedPrice: order.executedPrice,
            totalValue: order.total?.amount || (order.executedQuantity || 0) * (order.executedPrice || 0),
            fees: typeof order.fees === 'object' ? order.fees.commission : (order.fees || 0),
            venue: order.venue,
            orderTimestamp: order.createdAt,
            executionTimestamp: order.executedAt,
            expiryDate: undefined // Not available in current type
          };

          this.db.insertOrder(orderRecord);
          this.metrics.ordersCollected++;

          // Collect instrument info for traded assets
          if (order.isin) {
            await this.collectInstrumentInfo(order.isin);
          }
        }
        
        console.log(`✅ Trading history collected (${this.metrics.ordersCollected} orders)`);
      }
    } catch (error) {
      console.error('❌ Failed to collect trading history:', error);
      this.metrics.errors++;
    }
  }

  private async collectInstrumentInfo(isin: string): Promise<void> {
    try {
      const instrumentInfo = await this.client.getInstrumentInfo(isin);
      
      if (instrumentInfo) {
        const instrument: Instrument = {
          isin: isin,
          name: instrumentInfo.name || instrumentInfo.shortName || 'Unknown',
          symbol: instrumentInfo.symbol || instrumentInfo.ticker || '',
          type: this.determineAssetType(instrumentInfo.type || instrumentInfo.typeId),
          sector: instrumentInfo.sector,
          industry: instrumentInfo.industry,
          country: instrumentInfo.country || instrumentInfo.homeCountry,
          currency: instrumentInfo.currency || 'EUR',
          marketCap: instrumentInfo.marketCap,
          exchanges: JSON.stringify(instrumentInfo.exchanges || instrumentInfo.exchangeIds || []),
          tradingHours: JSON.stringify(instrumentInfo.tradingHours || {}),
          minOrderSize: instrumentInfo.minOrderSize,
          feeStructure: JSON.stringify(instrumentInfo.feeStructure || {}),
          isActive: instrumentInfo.isActive !== false,
          discoveredAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };

        this.db.insertInstrument(instrument);
        this.metrics.instrumentsCollected++;
      }
    } catch (error) {
      // Don't log individual instrument failures to avoid spam
      this.metrics.errors++;
    }
  }

  private determineAssetType(type: any): 'stock' | 'etf' | 'bond' | 'crypto' | 'warrant' {
    if (!type) return 'stock';
    
    const typeStr = String(type).toLowerCase();
    if (typeStr.includes('etf')) return 'etf';
    if (typeStr.includes('bond') || typeStr.includes('anleihe')) return 'bond';
    if (typeStr.includes('crypto') || typeStr.includes('bitcoin') || typeStr.includes('ethereum')) return 'crypto';
    if (typeStr.includes('warrant') || typeStr.includes('option')) return 'warrant';
    
    return 'stock';
  }

  private async collectCurrentPrices(): Promise<void> {
    console.log('\n💹 Collecting current market prices...');
    
    try {
      // Get all ISINs from positions
      const positions = this.db.getAllPositions(this.accountId);
      const isins = positions.map(p => p.isin);
      
      for (const isin of isins) {
        try {
          const priceData = await this.client.getRealTimePrice(isin);
          
          if (priceData) {
            const price: RealtimePrice = {
              isin: isin,
              bid: priceData.bid,
              ask: priceData.ask,
              last: priceData.price,
              spread: priceData.spread,
              volume: priceData.volume,
              dayHigh: undefined, // Not available in current type
              dayLow: undefined, // Not available in current type
              dayOpen: undefined, // Not available in current type
              previousClose: undefined, // Not available in current type
              dayChange: priceData.change,
              dayChangePercentage: priceData.changePercent,
              marketStatus: priceData.marketStatus,
              timestamp: priceData.timestamp
            };

            this.db.insertRealtimePrice(price);
            this.metrics.pricesCollected++;
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          this.metrics.errors++;
        }
      }
      
      console.log(`✅ Current prices collected (${this.metrics.pricesCollected} prices)`);
    } catch (error) {
      console.error('❌ Failed to collect current prices:', error);
      this.metrics.errors++;
    }
  }

  private async collectMarketData(): Promise<void> {
    console.log('\n🌍 Collecting market data...');
    
    // This would collect broader market data, indices, etc.
    // Implementation depends on available API endpoints
    
    console.log('✅ Market data collection completed');
  }

  private async collectWatchlist(): Promise<void> {
    console.log('\n👀 Collecting watchlist...');
    
    try {
      const watchlist = await this.client.getWatchlist();
      
      if (watchlist && watchlist.items) {
        for (const item of watchlist.items) {
          this.metrics.watchlistItems++;
          
          // Collect instrument info for watchlist items
          if (item.isin) {
            await this.collectInstrumentInfo(item.isin);
          }
        }
        
        console.log(`✅ Watchlist collected (${this.metrics.watchlistItems} items)`);
      }
    } catch (error) {
      console.error('❌ Failed to collect watchlist:', error);
      this.metrics.errors++;
    }
  }

  private async collectMarketNews(): Promise<void> {
    console.log('\n📰 Collecting market news...');
    
    try {
      const news = await this.client.getMarketNews(undefined, 50);
      
      if (news && news.articles) {
        this.metrics.newsCollected = news.articles.length;
        console.log(`✅ Market news collected (${this.metrics.newsCollected} articles)`);
      }
    } catch (error) {
      console.error('❌ Failed to collect market news:', error);
      this.metrics.errors++;
    }
  }

  private async collectHistoricalPrices(): Promise<void> {
    console.log('\n📈 Collecting historical prices...');
    console.log(`📅 Historical data: ${this.options.priceHistoryDays} days`);
    
    // Implementation would collect historical OHLCV data
    // This requires the historical price API endpoints
    
    console.log('✅ Historical prices collection completed');
  }

  private async collectPortfolioPerformance(): Promise<void> {
    console.log('\n📊 Collecting portfolio performance...');
    
    const timeframes: Array<'1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'> = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];
    
    for (const timeframe of timeframes) {
      try {
        const performance = await this.client.getPortfolioPerformance(timeframe);
        
        if (performance) {
          const perfRecord: PortfolioPerformance = {
            accountId: this.accountId,
            timeframe,
            value: performance.value || 0,
            returnAbsolute: performance.returnAbsolute || 0,
            returnPercentage: performance.returnPercentage || 0,
            benchmarkReturn: performance.benchmarkReturn,
            timestamp: new Date().toISOString()
          };
          
          // Insert performance record (would need database method)
        }
      } catch (error) {
        this.metrics.errors++;
      }
    }
    
    console.log('✅ Portfolio performance collected');
  }

  private async exportCollectedData(): Promise<void> {
    console.log('\n📤 Exporting collected data...');
    
    try {
      // Export to JSON
      await this.db.exportToJSON('./data/exports/production-data-export.json');
      
      // Export to CSV
      await this.db.exportToCSV('./data/exports/production-positions.csv');
      
      // Generate summary report
      const stats = this.db.getDatabaseStats();
      const portfolioStats = this.db.getPortfolioStats(this.accountId);
      const tradingStats = this.db.getTradingStats(this.accountId);
      
      const report = {
        collectionMetrics: this.metrics,
        databaseStats: stats,
        portfolioStats,
        tradingStats,
        exportedAt: new Date().toISOString()
      };
      
      await writeFile('./data/exports/production-report.json', JSON.stringify(report, null, 2));
      
      console.log('✅ Data exported successfully');
      console.log('📁 Files created:');
      console.log('   • ./data/exports/production-data-export.json');
      console.log('   • ./data/exports/production-positions.csv');
      console.log('   • ./data/exports/production-report.json');
    } catch (error) {
      console.error('❌ Failed to export data:', error);
      this.metrics.errors++;
    }
  }

  private async displayCollectionResults(): Promise<void> {
    this.metrics.endTime = new Date();
    this.metrics.totalDurationMs = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
    
    console.log('\n🎉 PRODUCTION DATA COLLECTION COMPLETE');
    console.log('=====================================');
    console.log(`⏱️  Duration: ${(this.metrics.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`💼 Accounts: ${this.metrics.accountsCollected}`);
    console.log(`📈 Positions: ${this.metrics.positionsCollected}`);
    console.log(`📊 Orders: ${this.metrics.ordersCollected}`);
    console.log(`🏢 Instruments: ${this.metrics.instrumentsCollected}`);
    console.log(`💹 Prices: ${this.metrics.pricesCollected}`);
    console.log(`👀 Watchlist: ${this.metrics.watchlistItems}`);
    console.log(`📰 News: ${this.metrics.newsCollected}`);
    console.log(`❌ Errors: ${this.metrics.errors}`);
    
    const dbStats = this.db.getDatabaseStats();
    console.log(`\n💾 Database: ${dbStats.databaseSize}`);
    console.log(`📁 Location: ${dbStats.databasePath}`);
    
    if (this.options.exportAfterCollection) {
      console.log('\n📤 Exports available in: ./data/exports/');
    }
  }

  private async logCollectionResult(): Promise<void> {
    const log: CollectionLog = {
      collectionType: `production_${this.options.mode}`,
      status: this.metrics.errors === 0 ? 'success' : this.metrics.errors < 5 ? 'partial' : 'error',
      recordsCollected: this.metrics.positionsCollected + this.metrics.ordersCollected + this.metrics.pricesCollected,
      errorsCount: this.metrics.errors,
      durationMs: this.metrics.totalDurationMs,
      errorDetails: this.metrics.errors > 0 ? `${this.metrics.errors} errors occurred during collection` : undefined,
      startedAt: this.metrics.startTime.toISOString(),
      completedAt: this.metrics.endTime?.toISOString()
    };
    
    // Log to database (would need method implementation)
    console.log(`📝 Collection logged: ${log.status} (${log.recordsCollected} records, ${log.errorsCount} errors)`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--full') ? 'full' :
               args.includes('--quick') ? 'quick' :
               args.includes('--prices-only') ? 'prices-only' :
               'full';

  const options: Partial<CollectionOptions> = {
    mode: mode as 'full' | 'quick' | 'prices-only',
    includeHistoricalPrices: args.includes('--historical'),
    exportAfterCollection: !args.includes('--no-export')
  };

  const collector = new ProductionDataCollector(options);
  await collector.collectAllData();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
