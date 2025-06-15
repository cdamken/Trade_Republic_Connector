/**
 * Simple Asset Data Collection Demo (No Database)
 * 
 * This demo demonstrates just the asset data collection functionality
 * without database storage to verify the core collection works.
 * 
 * Author: Carlos Damken <carlos@damken.com>
 */

import { ComprehensiveAssetDataCollector } from '../src/data/asset-collector';
import { logger } from '../src/utils/logger';
import type { ComprehensiveAssetInfo } from '../src/types/comprehensive-asset';

// Test ISINs for demonstration
const TEST_ISINS = [
  'US0378331005', // Apple Inc.
  'DE0007164600', // SAP SE  
  'US88160R1014'  // Tesla Inc.
];

async function main(): Promise<void> {
  console.log('\n🔍 === Simple Asset Data Collection Demo ===\n');

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

    // Collect comprehensive data for test assets
    logger.info('🔍 Starting asset data collection...\n');

    const collectedAssets: ComprehensiveAssetInfo[] = [];

    for (const isin of TEST_ISINS) {
      try {
        logger.info(`📈 Collecting data for ISIN: ${isin}`);
        
        // Collect comprehensive asset data (will use mock data since we're not authenticated)
        const assetInfo = await collector.getAssetInfo(isin);
        collectedAssets.push(assetInfo);

        logger.info(`✅ Successfully collected data for ${assetInfo.name} (${assetInfo.symbol})`);
        logger.info(`   💰 Price: ${assetInfo.currentPrice} ${assetInfo.currency}`);
        logger.info(`   📊 Type: ${assetInfo.type}`);
        logger.info(`   🏢 Country: ${assetInfo.country}`);
        logger.info(`   📰 News items: ${assetInfo.latestNews?.length || 0}`);
        logger.info(`   🏢 Corporate events: ${assetInfo.upcomingEvents?.length || 0}`);
        logger.info('');

      } catch (error) {
        logger.error(`❌ Failed to collect data for ${isin}`, { error });
        continue;
      }
    }

    // Show summary
    logger.info('📊 === Collection Summary ===');
    logger.info(`✅ Successfully collected data for ${collectedAssets.length} assets`);
    
    if (collectedAssets.length > 0) {
      logger.info('\n🔍 === Asset Details ===');
      
      collectedAssets.forEach((asset, index) => {
        logger.info(`\n${index + 1}. ${asset.name} (${asset.isin})`);
        logger.info(`   Symbol: ${asset.symbol}`);
        logger.info(`   Type: ${asset.type}`);
        logger.info(`   Price: ${asset.currentPrice} ${asset.currency}`);
        logger.info(`   Market Cap: ${asset.marketCap || 'N/A'}`);
        logger.info(`   Country: ${asset.country}`);
        logger.info(`   Exchange: ${asset.homeExchange}`);
        
        if (asset.peRatio) {
          logger.info(`   P/E Ratio: ${asset.peRatio}`);
        }
        
        if (asset.dividendYield) {
          logger.info(`   Dividend Yield: ${asset.dividendYield}%`);
        }
        
        if (asset.latestNews && asset.latestNews.length > 0) {
          logger.info(`   Latest News:`);
          asset.latestNews.slice(0, 2).forEach((news, newsIndex) => {
            logger.info(`     ${newsIndex + 1}. ${news.headline} (${news.source})`);
          });
        }
      });
    }

    logger.info('\n✅ === Demo completed successfully ===');
    logger.info('💡 Key features demonstrated:');
    logger.info('   • Asset data collection with fallback to mock data');
    logger.info('   • Comprehensive asset information structure');
    logger.info('   • News and market data integration');
    logger.info('   • Error handling and resilient data collection');

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
