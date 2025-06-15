#!/usr/bin/env tsx

/**
 * APP INTERFACE DEMO
 * Demonstrates the Trade Republic App Interface capabilities
 */

import { TradeRepublicAppInterface, TradeRepublicUtils } from '../src/app-interface';

async function demonstrateUsage() {
  console.log('📱 Trade Republic App Interface Demo');
  console.log('===================================\n');
  
  const appInterface = new TradeRepublicAppInterface();
  
  try {
    // Check if system is ready
    const readiness = await appInterface.isReady();
    console.log(`System Status: ${readiness.ready ? '✅' : '❌'} ${readiness.message}\n`);
    
    // Get collection status
    const status = await appInterface.getCollectionStatus();
    console.log(`📊 Collection Status:`);
    console.log(`   Total Assets: ${status.totalAssets}`);
    console.log(`   Success Rate: ${status.successRate.toFixed(1)}%`);
    console.log(`   Markets: ${status.markets.join(', ')}`);
    console.log(`   Asset Types: ${status.assetTypes.join(', ')}\n`);
    
    // Get quick stats
    const stats = await TradeRepublicUtils.getQuickStats(appInterface);
    console.log(`📈 Quick Statistics:`);
    console.log(`   Top Markets: ${stats.topMarkets.map(([m, c]: [string, number]) => `${m}(${c})`).join(', ')}`);
    console.log(`   Data Files Available:`);
    if (stats.dataFiles.json) console.log(`     📄 JSON: ${stats.dataFiles.json}`);
    if (stats.dataFiles.csv) console.log(`     📊 CSV: ${stats.dataFiles.csv}`);
    if (stats.dataFiles.database) console.log(`     🗄️  Database: ${stats.dataFiles.database}`);
    
    // Get some assets by market
    const usAssets = await appInterface.getAssetsByMarket('US');
    console.log(`\n🇺🇸 US Assets Sample (${usAssets.length} total):`);
    usAssets.slice(0, 5).forEach(asset => {
      console.log(`   ${asset.isin} - ${asset.name || 'Unknown'} (${asset.assetType})`);
    });
    
    const deAssets = await appInterface.getAssetsByMarket('DE');
    console.log(`\n🇩🇪 German Assets Sample (${deAssets.length} total):`);
    deAssets.slice(0, 5).forEach(asset => {
      console.log(`   ${asset.isin} - ${asset.name || 'Unknown'} (${asset.assetType})`);
    });
    
    // Search functionality
    const searchResults = await appInterface.searchAssets('AAPL');
    console.log(`\n🔍 Search Results for "AAPL" (${searchResults.length} found):`);
    searchResults.forEach(asset => {
      console.log(`   ${asset.isin} - ${asset.name || 'Unknown'}`);
    });
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

demonstrateUsage();
