/**
 * Comprehensive Asset Data Collection Mock Demo
 * 
 * This demo bypasses authentication to demonstrate the asset data collection
 * and database features using mock data.
 * 
 * Author: Carlos Damken <carlos@damken.com>
 */

import { ComprehensiveAssetDataCollector } from '../src/data/asset-collector';
import { AssetTestDatabase } from '../src/database/test-database';
import { logger } from '../src/utils/logger';
import type { ComprehensiveAssetInfo } from '../src/types/comprehensive-asset';

// Test ISINs for demonstration
const TEST_ISINS = [
  'US0378331005', // Apple Inc.
  'DE0007164600', // SAP SE  
  'US88160R1014', // Tesla Inc.
  'NL0000235190', // Airbus SE
  'GB0002875804'  // British American Tobacco
];

async function main(): Promise<void> {
  console.log('\n🔍 === Comprehensive Asset Data Collection Mock Demo ===\n');

  try {
    // Create a mock auth manager (this is just for testing without authentication)
    const mockAuthManager = {
      isAuthenticated: () => true,
      getAuthHeader: () => 'Bearer mock-token-for-testing'
    } as any;

    // Initialize asset data collector with mock authentication
    const collector = new ComprehensiveAssetDataCollector(mockAuthManager, {
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
      dbPath: './data/mock-comprehensive-assets.db'
    });

    await database.initialize();
    logger.info('📊 Test database initialized');

    // Clear any existing test data
    await database.clearData();
    logger.info('🧹 Cleared existing test data');

    // Collect comprehensive data for test assets
    logger.info('🔍 Starting comprehensive asset data collection...\n');

    const collectedAssets: ComprehensiveAssetInfo[] = [];

    for (const isin of TEST_ISINS) {
      try {
        logger.info(`📈 Collecting data for ISIN: ${isin}`);
        
        // Collect comprehensive asset data (will use mock data since we're not authenticated)
        const assetInfo = await collector.getAssetInfo(isin);

        collectedAssets.push(assetInfo);

        // Store in database
        const recordId = await database.upsertAsset(assetInfo);
        logger.info(`✅ Stored asset data with ID: ${recordId}`);

        // Add some delay between requests (real-world scenario)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.error(`❌ Failed to collect data for ${isin}`, { error });
        continue;
      }
    }

    // Demonstrate database search and query functionality
    logger.info('\n🔍 === Database Query Demonstrations ===\n');

    // Get all ISINs
    const allIsins = await database.getAllIsins();
    logger.info(`📊 Total ISINs in database: ${allIsins.length}`);

    // Search by asset type
    const stocks = await database.searchAssets({
      type: ['stock'],
      limit: 10
    });
    logger.info(`🏢 Found ${stocks.assets.length} stocks`);

    // Search by currency
    const eurAssets = await database.searchAssets({
      currency: ['EUR'],
      limit: 5
    });
    logger.info(`💶 Found ${eurAssets.assets.length} EUR-denominated assets`);

    // Get asset statistics
    const stats = await database.getStatistics();
    logger.info('📈 Asset database statistics:', stats);

    // Demonstrate detailed asset information
    if (collectedAssets.length > 0) {
      const sampleAsset = collectedAssets[0];
      logger.info('\n📊 === Sample Asset Information ===');
      logger.info(`🏷️  Name: ${sampleAsset.name}`);
      logger.info(`🔢 ISIN: ${sampleAsset.isin}`);
      logger.info(`💰 Current Price: ${sampleAsset.currentPrice} ${sampleAsset.currency}`);
      logger.info(`📈 Historical Data Points: ${sampleAsset.historicalData?.length || 0}`);
      logger.info(`📰 News Items: ${sampleAsset.latestNews?.length || 0}`);
      logger.info(`🏢 Corporate Events: ${sampleAsset.corporateEvents?.length || 0}`);
      logger.info(`🔍 Technical Indicators: ${Object.keys(sampleAsset.technicalIndicators || {}).length}`);
    }

    // Test database querying by ISIN
    if (TEST_ISINS.length > 0) {
      const assetByIsin = await database.getAssetByIsin(TEST_ISINS[0]);
      if (assetByIsin) {
        logger.info(`✅ Successfully retrieved asset by ISIN: ${assetByIsin.name}`);
      }
    }

    logger.info('\n✅ === Demo completed successfully ===');
    logger.info('💡 Key features demonstrated:');
    logger.info('   • Comprehensive asset data collection');
    logger.info('   • SQLite database storage and indexing');
    logger.info('   • Asset search and filtering');
    logger.info('   • Historical data collection');
    logger.info('   • News and corporate events tracking');
    logger.info('   • Technical indicators calculation');
    logger.info('   • Database statistics and analytics');
    logger.info(`\n📁 Database file: ./data/mock-comprehensive-assets.db`);
    logger.info('🔧 Use SQLite browser to inspect the data structure\n');

  } catch (error) {
    logger.error('❌ Demo failed:', { error: error instanceof Error ? error.message : error });
    if (error instanceof Error && error.stack) {
      logger.debug('Stack trace:', { stack: error.stack });
    }
    process.exit(1);
  }
}

// Run the demo
main().catch((error) => {
  logger.error('💥 Unhandled error in demo:', { error });
  process.exit(1);
});
