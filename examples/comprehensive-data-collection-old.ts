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

  private async collectTransactionHistory(): Promise<void> {
    console.log('\n📜 Collecting transaction history...');
    
    try {
      // Timeline with all transactions
      const timeline = await this.subscribeAndWait('timeline', {});
      if (timeline && timeline.items) {
        for (const transaction of timeline.items) {
          await this.db.saveTransaction(transaction);
          this.stats.transactionHistory++;
          
          // Get detailed transaction info
          if (transaction.id) {
            const details = await this.subscribeAndWait('timelineDetail', {
              id: transaction.id
            });
            
            if (details) {
              await this.db.saveTransactionDetails(details);
            }
          }
          
          await this.sleep(50); // Rate limiting
        }
        console.log(`✅ Transaction history saved (${this.stats.transactionHistory} transactions)`);
      }

      // Orders
      const orders = await this.subscribeAndWait('orders', {});
      if (orders) {
        await this.db.saveOrders(orders);
        console.log('✅ Orders saved');
      }

    } catch (error) {
      console.error('❌ Failed to collect transaction history:', error);
      this.stats.errors++;
    }
  }

  private async collectWatchlist(): Promise<void> {
    console.log('\n👀 Collecting watchlist...');
    
    try {
      const watchlist = await this.subscribeAndWait('watchlist', {});
      if (watchlist && watchlist.instruments) {
        for (const item of watchlist.instruments) {
          await this.db.saveWatchlistItem(item);
          this.stats.watchlistItems++;
        }
        console.log(`✅ Watchlist saved (${this.stats.watchlistItems} items)`);
      }
    } catch (error) {
      console.error('❌ Failed to collect watchlist:', error);
      this.stats.errors++;
    }
  }

  private async collectSavingsPlans(): Promise<void> {
    console.log('\n💰 Collecting savings plans...');
    
    try {
      const savingsPlans = await this.subscribeAndWait('savingsPlans', {});
      if (savingsPlans && savingsPlans.savingsPlans) {
        for (const plan of savingsPlans.savingsPlans) {
          await this.db.saveSavingsPlan(plan);
          this.stats.savingsPlans++;
          
          // Get execution history for each plan
          const history = await this.subscribeAndWait('savingsPlanExecutions', {
            savingsPlanId: plan.id
          });
          
          if (history) {
            await this.db.saveSavingsPlanHistory(history);
          }
        }
        console.log(`✅ Savings plans saved (${this.stats.savingsPlans} plans)`);
      }
    } catch (error) {
      console.error('❌ Failed to collect savings plans:', error);
      this.stats.errors++;
    }
  }

  private async collectAllAvailableAssets(): Promise<void> {
    console.log('\n🔍 Discovering all available assets...');
    
    try {
      // Major market indices and their components
      const indices = [
        'US0378331005', // Apple
        'US5949181045', // Microsoft
        'US02079K3059', // Alphabet
        'US0231351067', // Amazon
        'US88160R1014', // Tesla
        'DE0007164600', // SAP
        'DE0008469008', // Deutsche Bank
        'DE0008404005', // Allianz
        'DE0007236101', // Siemens
        'NL0000235190', // ASML
        'FR0000120271', // TotalEnergies
        'GB0009252882', // HSBC
        'CH0038863350', // Nestlé
      ];

      // ETFs
      const etfs = [
        'IE00B4L5Y983', // Core MSCI World
        'IE00B0M62Q58', // iShares MSCI World
        'IE00B3RBWM25', // Vanguard FTSE All-World
        'LU0274208692', // Xtrackers MSCI World
        'DE0002635307', // iShares Core DAX
        'IE00B52VJ196', // iShares Core S&P 500
      ];

      // Cryptocurrencies (if available)
      const cryptos = [
        'BTC-EUR',
        'ETH-EUR', 
        'ADA-EUR',
        'DOT-EUR'
      ];

      const allAssets = [...indices, ...etfs, ...cryptos];
      this.stats.totalAssets = allAssets.length;

      for (const isin of allAssets) {
        try {
          // Get asset information
          const asset = await this.subscribeAndWait('instrument', { id: isin });
          if (asset) {
            await this.db.saveAsset(asset);
            this.stats.assetsCollected++;
            console.log(`📈 Asset saved: ${asset.shortName || isin}`);
          }

          // Get current price
          const ticker = await this.subscribeAndWait('ticker', { id: `${isin}.LSX` });
          if (ticker) {
            await this.db.savePriceData({
              isin: isin,
              timestamp: new Date().toISOString(),
              price: ticker.last?.price,
              bid: ticker.bid?.price,
              ask: ticker.ask?.price,
              volume: ticker.last?.size
            });
            this.stats.priceDataPoints++;
          }

          await this.sleep(200); // Rate limiting
        } catch (error) {
          console.error(`❌ Failed to collect data for ${isin}:`, error.message);
          this.stats.errors++;
        }
      }

      console.log(`✅ Asset discovery completed (${this.stats.assetsCollected}/${this.stats.totalAssets} assets)`);
    } catch (error) {
      console.error('❌ Failed to collect assets:', error);
      this.stats.errors++;
    }
  }

  private async collectRealTimePrices(): Promise<void> {
    console.log('\n💹 Collecting real-time price data...');
    
    try {
      // Get all unique ISINs from our database
      const assets = await this.db.getAllAssets();
      
      console.log(`📊 Collecting real-time prices for ${assets.length} assets...`);
      
      for (const asset of assets) {
        try {
          const ticker = await this.subscribeAndWait('ticker', { 
            id: `${asset.isin}.LSX` 
          });
          
          if (ticker) {
            await this.db.savePriceData({
              isin: asset.isin,
              timestamp: new Date().toISOString(),
              price: ticker.last?.price,
              bid: ticker.bid?.price,
              ask: ticker.ask?.price,
              open: ticker.open?.price,
              high: ticker.high?.price,
              low: ticker.low?.price,
              volume: ticker.last?.size
            });
            this.stats.priceDataPoints++;
          }
          
          await this.sleep(100); // Rate limiting
        } catch (error) {
          console.error(`❌ Failed to get price for ${asset.isin}:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✅ Real-time prices collected (${this.stats.priceDataPoints} data points)`);
    } catch (error) {
      console.error('❌ Failed to collect real-time prices:', error);
      this.stats.errors++;
    }
  }

  private async collectMarketData(): Promise<void> {
    console.log('\n📊 Collecting market data and analytics...');
    
    try {
      // News and market updates
      const news = await this.subscribeAndWait('news', {});
      if (news) {
        await this.db.saveNews(news);
        console.log('✅ Market news saved');
      }

      // Market status
      const marketStatus = await this.subscribeAndWait('marketStatus', {});
      if (marketStatus) {
        await this.db.saveMarketStatus(marketStatus);
        console.log('✅ Market status saved');
      }

    } catch (error) {
      console.error('❌ Failed to collect market data:', error);
      this.stats.errors++;
    }
  }

  private async generateReports(): Promise<void> {
    console.log('\n📋 Generating comprehensive reports...');
    
    try {
      // Generate JSON export of all data
      const allData = await this.db.exportAllData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `data/comprehensive-export-${timestamp}.json`;
      
      await this.writeFile(filename, JSON.stringify(allData, null, 2));
      console.log(`✅ Complete data export saved: ${filename}`);

      // Generate CSV reports
      await this.db.exportToCSV(`data/portfolio-${timestamp}.csv`, 'portfolio');
      await this.db.exportToCSV(`data/transactions-${timestamp}.csv`, 'transactions');
      await this.db.exportToCSV(`data/assets-${timestamp}.csv`, 'assets');
      await this.db.exportToCSV(`data/prices-${timestamp}.csv`, 'prices');
      
      console.log('✅ CSV reports generated');

    } catch (error) {
      console.error('❌ Failed to generate reports:', error);
      this.stats.errors++;
    }
  }

  private async subscribeAndWait(type: string, payload: any, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const subscriptionId = `${type}_${Date.now()}`;
      let timeoutId: NodeJS.Timeout;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        this.client.unsubscribe(subscriptionId);
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${type} data`));
      }, timeout);

      this.client.subscribe(subscriptionId, type, payload, (data) => {
        cleanup();
        resolve(data);
      });
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async writeFile(filename: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filename, content, 'utf8');
  }

  private async displayFinalStats(): Promise<void> {
    const duration = this.stats.endTime! - this.stats.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log('\n🎉 COMPREHENSIVE DATA COLLECTION COMPLETE!');
    console.log('=' .repeat(50));
    console.log(`⏱️  Duration: ${minutes}m ${seconds}s`);
    console.log(`📊 Assets Collected: ${this.stats.assetsCollected}/${this.stats.totalAssets}`);
    console.log(`💼 Portfolio Items: ${this.stats.portfolioItems}`);
    console.log(`📜 Transactions: ${this.stats.transactionHistory}`);
    console.log(`👀 Watchlist Items: ${this.stats.watchlistItems}`);
    console.log(`💰 Savings Plans: ${this.stats.savingsPlans}`);
    console.log(`💹 Price Data Points: ${this.stats.priceDataPoints}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    console.log('=' .repeat(50));
    console.log('🗄️  All data saved to: comprehensive-trade-republic-data.db');
    console.log('📁 Reports generated in: data/ directory');
    console.log('\n✅ Your complete Trade Republic data is now available locally!');
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.client) {
        await this.client.disconnect();
      }
      if (this.db) {
        await this.db.close();
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
