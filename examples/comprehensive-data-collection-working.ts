/**
 * Comprehensive Trade Republic Data Collection
 * Downloads ALL available data from your Trade Republic account
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AssetDatabaseManager } from '../src/database/asset-database.js';
import { logger } from '../src/utils/logger.js';
import type { Asset, PriceData } from '../src/database/asset-database.js';
import dotenv from 'dotenv';
import { writeFile } from 'fs/promises';

// Load environment variables
dotenv.config();

interface CollectionStats {
  portfolioPositions: number;
  orderHistory: number;
  watchlistItems: number;
  instrumentsDiscovered: number;
  priceDataPoints: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
}

interface CollectedData {
  account: {
    portfolio?: any;
    portfolioSummary?: any;
    cashPosition?: any;
    performance?: any;
  };
  trading: {
    orderHistory: any[];
    positions: any[];
  };
  market: {
    watchlist?: any;
    instruments: Map<string, any>;
    prices: Map<string, any>;
  };
  news: any[];
}

class ComprehensiveDataCollector {
  private client: TradeRepublicClient;
  private db: AssetDatabaseManager;
  private stats: CollectionStats;
  private collectedData: CollectedData;

  constructor() {
    this.client = new TradeRepublicClient();
    this.db = new AssetDatabaseManager('./data/comprehensive-trade-republic-data.db');
    this.stats = {
      portfolioPositions: 0,
      orderHistory: 0,
      watchlistItems: 0,
      instrumentsDiscovered: 0,
      priceDataPoints: 0,
      errors: 0,
      startTime: new Date()
    };
    this.collectedData = {
      account: {},
      trading: { orderHistory: [], positions: [] },
      market: { instruments: new Map(), prices: new Map() },
      news: []
    };
  }

  async collectAllData(): Promise<void> {
    console.log('🚀 Starting comprehensive Trade Republic data collection...');
    console.log('📊 This will collect ALL available data from your account\n');

    try {
      // Step 1: Authentication
      await this.authenticateWithRetry();

      // Step 2: Account Information
      await this.collectAccountInfo();

      // Step 3: Portfolio Data
      await this.collectPortfolioData();

      // Step 4: Trading History
      await this.collectTradingHistory();

      // Step 5: Watchlist
      await this.collectWatchlist();

      // Step 6: Market Data and News
      await this.collectMarketData();

      // Step 7: Generate Reports and Export
      await this.generateReports();

      this.stats.endTime = new Date();
      await this.displayFinalStats();

    } catch (error) {
      logger.error('❌ Data collection failed:', error);
      this.stats.errors++;
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async authenticateWithRetry(): Promise<void> {
    console.log('🔐 Authenticating with Trade Republic...');
    
    const username = process.env.TR_USERNAME;
    const password = process.env.TR_PASSWORD;
    const pin = process.env.TR_PIN;

    if (!username || !password || !pin) {
      throw new Error('Missing credentials. Please set TR_USERNAME, TR_PASSWORD, and TR_PIN in your .env file');
    }

    try {
      await this.client.initialize();
      
      const session = await this.client.login({
        username,
        password,
        pin
      });

      console.log('✅ Authentication successful');
      console.log(`📱 Session established: ${session.sessionId}`);
      
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private async collectAccountInfo(): Promise<void> {
    console.log('\n📋 Collecting account information...');
    
    try {
      // Portfolio summary
      const portfolioSummary = await this.client.getPortfolioSummary();
      if (portfolioSummary) {
        this.collectedData.account.portfolioSummary = portfolioSummary;
        console.log('✅ Portfolio summary collected');
      }

      // Cash position
      const cashPosition = await this.client.getCashPosition();
      if (cashPosition) {
        this.collectedData.account.cashPosition = cashPosition;
        console.log('✅ Cash position collected');
      }

      // Portfolio performance
      const performance = await this.client.getPortfolioPerformance('ALL');
      if (performance) {
        this.collectedData.account.performance = performance;
        console.log('✅ Portfolio performance collected');
      }

    } catch (error) {
      console.error('❌ Failed to collect account info:', error);
      this.stats.errors++;
    }
  }

  private async collectPortfolioData(): Promise<void> {
    console.log('\n💼 Collecting portfolio data...');
    
    try {
      // Main portfolio
      const portfolio = await this.client.getPortfolio();
      if (portfolio) {
        this.collectedData.account.portfolio = portfolio;
        console.log('✅ Portfolio data collected');
      }

      // Portfolio positions
      const positions = await this.client.getPortfolioPositions();
      if (positions && Array.isArray(positions)) {
        this.collectedData.trading.positions = positions;
        this.stats.portfolioPositions = positions.length;
        
        // For each position, collect detailed information and current prices
        for (const position of positions) {
          try {
            if (position.isin) {
              // Get instrument info
              const instrumentInfo = await this.client.getInstrumentInfo(position.isin);
              if (instrumentInfo) {
                this.collectedData.market.instruments.set(position.isin, instrumentInfo);
                this.stats.instrumentsDiscovered++;
              }

              // Get current price
              const realTimePrice = await this.client.getRealTimePrice(position.isin);
              if (realTimePrice) {
                this.collectedData.market.prices.set(position.isin, realTimePrice);
                this.stats.priceDataPoints++;
                
                // Store price in database
                const priceData: PriceData = {
                  isin: position.isin,
                  timestamp: Date.now(),
                  price: realTimePrice.price || 0,
                  bid: realTimePrice.bid,
                  ask: realTimePrice.ask,
                  currency: realTimePrice.currency || 'EUR',
                  source: 'realtime'
                };
                this.db.insertPriceData(priceData);
              }

              // Store asset in database
              const asset: Asset = {
                isin: position.isin,
                name: instrumentInfo?.name || position.name,
                symbol: instrumentInfo?.symbol || position.symbol,
                type: this.determineAssetType(instrumentInfo?.type || position.type),
                market: instrumentInfo?.exchange || 'UNKNOWN',
                currency: instrumentInfo?.currency || 'EUR',
                discoveryMethod: 'portfolio',
                discoveredAt: new Date().toISOString(),
                verified: true,
                lastUpdated: new Date().toISOString()
              };
              this.db.insertAsset(asset);

              console.log(`💰 Processed position: ${position.isin} - ${asset.name}`);
              
              // Rate limiting
              await this.sleep(200);
            }
          } catch (error) {
            console.error(`❌ Failed to process position ${position.isin}:`, error);
            this.stats.errors++;
          }
        }
        
        console.log(`✅ Portfolio positions processed (${this.stats.portfolioPositions} positions)`);
      }

    } catch (error) {
      console.error('❌ Failed to collect portfolio data:', error);
      this.stats.errors++;
    }
  }

  private async collectTradingHistory(): Promise<void> {
    console.log('\n📜 Collecting trading history...');
    
    try {
      // Order history
      const orderHistory = await this.client.getOrderHistory();
      if (orderHistory && Array.isArray(orderHistory)) {
        this.collectedData.trading.orderHistory = orderHistory;
        this.stats.orderHistory = orderHistory.length;
        
        console.log(`✅ Order history collected (${this.stats.orderHistory} orders)`);
      }

    } catch (error) {
      console.error('❌ Failed to collect trading history:', error);
      this.stats.errors++;
    }
  }

  private async collectWatchlist(): Promise<void> {
    console.log('\n👀 Collecting watchlist...');
    
    try {
      const watchlist = await this.client.getWatchlist();
      if (watchlist && watchlist.items) {
        
        for (const item of watchlist.items) {
          try {
            this.stats.watchlistItems++;
            
            if (item.isin) {
              // Get instrument info
              const instrumentInfo = await this.client.getInstrumentInfo(item.isin);
              if (instrumentInfo) {
                this.collectedData.market.instruments.set(item.isin, instrumentInfo);
                this.stats.instrumentsDiscovered++;
              }

              // Get current price
              const realTimePrice = await this.client.getRealTimePrice(item.isin);
              if (realTimePrice) {
                this.collectedData.market.prices.set(item.isin, realTimePrice);
                this.stats.priceDataPoints++;
                
                // Store price in database
                const priceData: PriceData = {
                  isin: item.isin,
                  timestamp: Date.now(),
                  price: realTimePrice.price || 0,
                  bid: realTimePrice.bid,
                  ask: realTimePrice.ask,
                  currency: realTimePrice.currency || 'EUR',
                  source: 'realtime'
                };
                this.db.insertPriceData(priceData);
              }

              // Store asset in database
              const asset: Asset = {
                isin: item.isin,
                name: instrumentInfo?.name || item.instrumentName,
                symbol: instrumentInfo?.symbol || item.symbol,
                type: this.determineAssetType(instrumentInfo?.type),
                market: instrumentInfo?.exchange || 'UNKNOWN',
                currency: instrumentInfo?.currency || item.currency || 'EUR',
                discoveryMethod: 'watchlist',
                discoveredAt: new Date().toISOString(),
                verified: true,
                lastUpdated: new Date().toISOString()
              };
              this.db.insertAsset(asset);

              console.log(`👁️  Processed watchlist item: ${item.isin} - ${asset.name}`);
              
              // Rate limiting
              await this.sleep(200);
            }
          } catch (error) {
            console.error(`❌ Failed to process watchlist item ${item.isin}:`, error);
            this.stats.errors++;
          }
        }
        
        console.log(`✅ Watchlist processed (${this.stats.watchlistItems} items)`);
      }
    } catch (error) {
      console.error('❌ Failed to collect watchlist:', error);
      this.stats.errors++;
    }
  }

  private async collectMarketData(): Promise<void> {
    console.log('\n📰 Collecting market data and news...');
    
    try {
      // General market news
      const marketNews = await this.client.getMarketNews(undefined, 50);
      if (marketNews && marketNews.articles) {
        this.collectedData.news = marketNews.articles;
        console.log(`✅ Market news collected (${marketNews.articles.length} articles)`);
      }

      // Get news for each instrument in portfolio and watchlist
      const allIsins = new Set([
        ...Array.from(this.collectedData.market.instruments.keys())
      ]);

      for (const isin of allIsins) {
        try {
          const instrumentNews = await this.client.getMarketNews(isin, 10);
          if (instrumentNews && instrumentNews.articles) {
            this.collectedData.news.push(...instrumentNews.articles);
          }
          
          // Rate limiting
          await this.sleep(100);
        } catch (error) {
          console.error(`❌ Failed to get news for ${isin}:`, error);
          this.stats.errors++;
        }
      }

      console.log(`✅ Total news articles collected: ${this.collectedData.news.length}`);

    } catch (error) {
      console.error('❌ Failed to collect market data:', error);
      this.stats.errors++;
    }
  }

  private async generateReports(): Promise<void> {
    console.log('\n📊 Generating reports and exporting data...');
    
    try {
      // Export database data
      await this.db.exportToJSON('./data/comprehensive-assets.json');
      await this.db.exportToCSV('./data/comprehensive-assets.csv');

      // Generate comprehensive report
      const report = {
        metadata: {
          collectedAt: new Date().toISOString(),
          collectionDuration: this.stats.endTime ? 
            this.stats.endTime.getTime() - this.stats.startTime.getTime() : 0,
          stats: this.stats
        },
        account: this.collectedData.account,
        trading: {
          positions: this.collectedData.trading.positions,
          orderHistory: this.collectedData.trading.orderHistory
        },
        market: {
          watchlist: this.collectedData.market.watchlist,
          instruments: Object.fromEntries(this.collectedData.market.instruments),
          prices: Object.fromEntries(this.collectedData.market.prices)
        },
        news: this.collectedData.news,
        database: this.db.getStatistics()
      };

      await writeFile('./data/comprehensive-trade-republic-report.json', 
        JSON.stringify(report, null, 2));

      // Generate summary report
      const summary = {
        collectionSummary: {
          completedAt: new Date().toISOString(),
          portfolioPositions: this.stats.portfolioPositions,
          orderHistory: this.stats.orderHistory,
          watchlistItems: this.stats.watchlistItems,
          instrumentsDiscovered: this.stats.instrumentsDiscovered,
          priceDataPoints: this.stats.priceDataPoints,
          newsArticles: this.collectedData.news.length,
          errors: this.stats.errors
        },
        accountSummary: {
          portfolioValue: this.collectedData.account.portfolioSummary?.totalValue || 'N/A',
          cashBalance: this.collectedData.account.cashPosition?.amount || 'N/A',
          currency: this.collectedData.account.cashPosition?.currency || 'EUR'
        },
        databaseStats: this.db.getStatistics()
      };

      await writeFile('./data/collection-summary.json', 
        JSON.stringify(summary, null, 2));

      console.log('✅ Reports generated:');
      console.log('   📄 comprehensive-trade-republic-report.json');
      console.log('   📋 collection-summary.json');
      console.log('   🗄️  comprehensive-assets.json');
      console.log('   📊 comprehensive-assets.csv');

    } catch (error) {
      console.error('❌ Failed to generate reports:', error);
      this.stats.errors++;
    }
  }

  private determineAssetType(type: string): Asset['type'] {
    if (!type) return 'unknown';
    
    const typeStr = type.toLowerCase();
    if (typeStr.includes('stock') || typeStr.includes('equity')) return 'stock';
    if (typeStr.includes('etf') || typeStr.includes('fund')) return 'etf';
    if (typeStr.includes('bond') || typeStr.includes('debt')) return 'bond';
    if (typeStr.includes('crypto') || typeStr.includes('bitcoin') || typeStr.includes('ethereum')) return 'crypto';
    
    return 'unknown';
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async displayFinalStats(): Promise<void> {
    const duration = this.stats.endTime!.getTime() - this.stats.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log('\n🎉 COMPREHENSIVE DATA COLLECTION COMPLETE!');
    console.log('=' .repeat(50));
    console.log(`⏱️  Duration: ${minutes}m ${seconds}s`);
    console.log(`💼 Portfolio Positions: ${this.stats.portfolioPositions}`);
    console.log(`📜 Order History: ${this.stats.orderHistory}`);
    console.log(`👀 Watchlist Items: ${this.stats.watchlistItems}`);
    console.log(`🔍 Instruments Discovered: ${this.stats.instrumentsDiscovered}`);
    console.log(`💹 Price Data Points: ${this.stats.priceDataPoints}`);
    console.log(`📰 News Articles: ${this.collectedData.news.length}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    console.log('=' .repeat(50));
    console.log('🗄️  All data saved to: comprehensive-trade-republic-data.db');
    console.log('📁 Reports generated in: data/ directory');
    console.log('\n✅ Your complete Trade Republic data is now available locally!');
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.client) {
        await this.client.logout();
      }
      if (this.db) {
        this.db.close();
      }
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

// Main execution
async function main() {
  const collector = new ComprehensiveDataCollector();
  
  try {
    await collector.collectAllData();
    process.exit(0);
  } catch (error) {
    console.error('💥 Collection failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⏹️  Collection interrupted by user');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ComprehensiveDataCollector };
