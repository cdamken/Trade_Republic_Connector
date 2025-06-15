#!/usr/bin/env tsx
/**
 * Comprehensive Asset Data Collection Demo
 * 
 * Demonstrates collecting all available asset information
 * and storing it in the test database
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/index.js';
import { ComprehensiveAssetDataCollector } from '../src/data/asset-collector.js';
import { AssetTestDatabase } from '../src/database/test-database.js';
import { logger } from '../src/utils/logger.js';
import { DEFAULT_CONFIG } from '../src/config/config.js';

interface AssetDemo {
  isin: string;
  name: string;
  type: string;
}

// Sample assets to demonstrate data collection
const DEMO_ASSETS: AssetDemo[] = [
  { isin: 'US0378331005', name: 'Apple Inc.', type: 'stock' },
  { isin: 'US5949181045', name: 'Microsoft Corporation', type: 'stock' },
  { isin: 'US01609W1027', name: 'Alibaba Group', type: 'stock' },
  { isin: 'IE00B4L5Y983', name: 'Core MSCI World', type: 'etf' },
  { isin: 'DE0002635307', name: 'iShares Core MSCI Emerging Markets', type: 'etf' }
];

async function main(): Promise<void> {
  console.log('\n🔍 === Comprehensive Asset Data Collection Demo ===\n');

  try {
    // Initialize Trade Republic client
    const client = new TradeRepublicClient(DEFAULT_CONFIG);
    
    // Initialize authentication
    const authManager = client.auth;
    try {
      await authManager.initialize();
    } catch (error) {
      logger.warn('⚠️ Authentication initialization failed. Please run the authentication demo first:');
      logger.warn('   npm run demo:auth');
      return;
    }
    
    // Check if we have valid credentials and session
    if (!authManager.isAuthenticated()) {
      logger.warn('⚠️ No valid session found. Please run the authentication demo first:');
      logger.warn('   npm run demo:auth');
      return;
    }

    // Initialize asset data collector
    const collector = new ComprehensiveAssetDataCollector(authManager, {
      enableCache: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      includeHistoricalData: true,
      historicalDataPeriod: '1Y',
      includeNewsData: true,
      includeAnalystData: true,
      includeTechnicalIndicators: true
    });

    // Initialize test database
    const database = new AssetTestDatabase({
      dbPath: './data/comprehensive-assets.db'
    });
    await database.initialize();
    logger.info('📊 Test database initialized');

    // Collect data for each demo asset
    console.log('\n📈 Collecting comprehensive asset data...\n');
    
    for (const asset of DEMO_ASSETS) {
      try {
        console.log(`🔍 Processing ${asset.name} (${asset.isin})...`);
        
        // Collect comprehensive asset information
        const startTime = Date.now();
        const assetInfo = await collector.getAssetInfo(asset.isin);
        const collectTime = Date.now() - startTime;
        
        // Display collected information
        console.log(`   ✅ Data collected in ${collectTime}ms`);
        console.log(`   📊 Current Price: ${assetInfo.currentPrice?.toFixed(2)} ${assetInfo.currency}`);
        console.log(`   📈 Day Change: ${assetInfo.dayChangePercentage?.toFixed(2)}%`);
        console.log(`   💹 Market Cap: ${assetInfo.marketCap ? (assetInfo.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}`);
        console.log(`   🏢 Sector: ${assetInfo.sector || 'N/A'}`);
        console.log(`   🔗 Data Sources: ${assetInfo.dataProviders?.join(', ')}`);
        
        // Store in test database
        const recordId = await database.upsertAsset(assetInfo);
        console.log(`   💾 Stored in database: ${recordId}`);
        
        // Display additional metadata
        if (assetInfo.tradeRepublicTradable) {
          console.log(`   ✅ Trade Republic: Tradable${assetInfo.tradeRepublicFractional ? ' (fractional)' : ''}`);
        }
        
        console.log('');
        
        // Add delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Failed to process ${asset.name}:`, error instanceof Error ? error.message : error);
        console.log('');
      }
    }

    // Demonstrate search functionality
    console.log('\n🔍 Testing asset search functionality...\n');
    
    const searchResults = await collector.searchAssets({
      query: 'apple',
      type: ['stock'],
      limit: 5
    });
    
    console.log(`🔍 Search results for "apple" (${searchResults.assets.length} found):`);
    searchResults.assets.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.name} (${result.isin}) - ${result.type}`);
    });

    // Demonstrate database queries
    console.log('\n💾 Testing database queries...\n');
    
    // Get asset by ISIN
    const appleAsset = await database.getAssetByIsin('US0378331005');
    if (appleAsset) {
      console.log(`📊 Retrieved Apple from database:`);
      console.log(`   Name: ${appleAsset.name}`);
      console.log(`   Price: ${appleAsset.currentPrice} ${appleAsset.currency}`);
      console.log(`   Last Updated: ${appleAsset.lastUpdated}`);
    }

    // Search assets in database
    const techStocks = await database.searchAssets({
      query: 'technology',
      limit: 3
    });
    
    console.log(`\n🔍 Technology stocks in database (${techStocks.assets.length} found):`);
    techStocks.assets.forEach((stock, index) => {
      console.log(`   ${index + 1}. ${stock.name} - ${stock.currentPrice} ${stock.currency}`);
    });

    // Get database statistics
    const stats = await database.getStatistics();
    console.log(`\n📈 Database Statistics:`);
    console.log(`   Total Assets: ${stats.totalAssets}`);
    console.log(`   Asset Types: ${Object.entries(stats.assetTypes).map(([type, count]) => `${type}:${count}`).join(', ')}`);
    console.log(`   Last Update: ${stats.lastUpdated}`);

    console.log('\n✅ Asset data collection demo completed successfully!');
    console.log('\n📖 Next steps:');
    console.log('   - View the database: ./data/comprehensive-assets.db');
    console.log('   - Check the API documentation: ./API_ENDPOINTS.md');
    console.log('   - Run the portfolio demo: npm run demo:portfolio');

  } catch (error) {
    logger.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Demo interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', { reason, promise });
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
