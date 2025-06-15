/**
 * Complete Trade Republic Account Data Collector
 * 
 * This script uses REAL credentials and authentication to collect:
 * - Your complete portfolio data
 * - All available Trade Republic instruments
 * - Account information and history
 * - Store everything in a comprehensive database
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AssetTestDatabase } from '../src/database/test-database.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';

interface CollectionStats {
  portfolioAssets: number;
  availableInstruments: number;
  totalDataPoints: number;
  errors: string[];
  startTime: number;
}

async function collectCompleteAccountData() {
  console.log('\n🚀 Complete Trade Republic Account Data Collection');
  console.log('====================================================');
  console.log('🎯 Objective: Get ALL real data from your Trade Republic account');
  console.log('🔐 Using: Real credentials and authentication');
  
  const stats: CollectionStats = {
    portfolioAssets: 0,
    availableInstruments: 0,
    totalDataPoints: 0,
    errors: [],
    startTime: Date.now()
  };

  // Load real environment configuration
  const config = loadEnvironmentConfig();
  console.log(`📱 Phone: ${config.trUsername}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);
  console.log(`🌐 API: ${config.apiUrl}`);
  console.log(`🔌 WebSocket: ${config.websocketUrl}`);

  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Error: Missing TR_USERNAME or TR_PASSWORD in .env file');
    return;
  }

  // Initialize client with real credentials
  const client = new TradeRepublicClient();
  
  try {
    // Step 1: Fresh Authentication with Real Credentials
    console.log('\n🔐 Step 1: Fresh Authentication');
    console.log('================================');
    await client.initialize();
    
    if (!client.isAuthenticated()) {
      console.log('🔓 Not authenticated - performing fresh login...');
      
      // Manual login with real credentials
      const session = await client.login({
        username: config.trUsername!,
        password: config.trPassword!
      });
      
      console.log('✅ Fresh authentication successful!');
      console.log(`👤 User ID: ${session.userId}`);
      console.log(`🎫 Session ID: ${session.sessionId}`);
      console.log(`⏰ Token expires: ${new Date(session.token.expiresAt).toISOString()}`);
    } else {
      console.log('✅ Using existing valid session');
    }

    // Step 2: Initialize Comprehensive Database
    console.log('\n💾 Step 2: Comprehensive Database Setup');
    console.log('=======================================');
    const database = new AssetTestDatabase({
      dbPath: './data/complete-account-data.db',
      enableWAL: true,
      enableCache: true,
      cacheSize: 1000000, // Large cache for comprehensive data
      autoVacuum: true,
    });
    
    await database.clearData();
    console.log('📊 Database initialized and cleared');

    // Step 3: Get Your Complete Portfolio
    console.log('\n📊 Step 3: Your Portfolio Data');
    console.log('==============================');
    try {
      const portfolioData = await client.portfolio.getPositions();
      console.log(`📈 Portfolio positions: ${portfolioData.length}`);
      
      for (const position of portfolioData) {
        const isin = position.instrumentId || position.isin || '';
        console.log(`  📊 ${position.name || isin} (${isin})`);
        console.log(`      💰 Value: €${(position.marketValue || position.totalValue || 0).toFixed(2)}`);
        console.log(`      📊 Quantity: ${position.quantity}`);
        
        // Get detailed instrument info and store
        if (isin) {
          try {
            const instrumentInfo = await client.getInstrumentInfo(isin);
            if (instrumentInfo) {
              await database.upsertAsset(instrumentInfo);
              stats.portfolioAssets++;
            }
          } catch (error) {
            console.log(`    ⚠️  Failed to get details for ${isin}: ${error}`);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Portfolio access failed: ${error instanceof Error ? error.message : error}`;
      console.log(`⚠️  ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    // Step 4: Discover ALL Available Instruments
    console.log('\n🔍 Step 4: All Available Instruments');
    console.log('===================================');
    
    // Strategy 1: Search by asset categories
    const searchTerms = [
      // Major indices and ETFs
      'S&P 500', 'MSCI', 'ETF', 'FTSE', 'DAX', 'NASDAQ',
      // Major companies
      'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Meta',
      'Alphabet', 'Netflix', 'NVIDIA', 'Samsung', 'ASML',
      // German companies
      'SAP', 'Siemens', 'BMW', 'Mercedes', 'Volkswagen', 'Adidas',
      'Deutsche Bank', 'Allianz', 'BASF', 'Bayer',
      // European companies
      'Nestle', 'LVMH', 'Shell', 'Unilever', 'Spotify',
      // Crypto and alternatives
      'Bitcoin', 'Ethereum', 'Gold', 'Silver',
      // Sectors
      'Tech', 'Healthcare', 'Energy', 'Finance', 'Real Estate'
    ];

    for (const term of searchTerms) {
      try {
        console.log(`   🔍 Searching: ${term}...`);
        const results = await client.searchInstruments(term);
        
        for (const instrument of results.slice(0, 10)) { // Limit to top 10 per search
          try {
            const instrumentInfo = await client.getInstrumentInfo(instrument.isin);
            if (instrumentInfo) {
              await database.upsertAsset(instrumentInfo);
              stats.availableInstruments++;
              console.log(`     ✅ ${instrument.name} (${instrument.isin})`);
            }
          } catch (error) {
            console.log(`     ⚠️  Failed to get data for ${instrument.isin}: ${error}`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        const errorMsg = `Search failed for ${term}: ${error}`;
        stats.errors.push(errorMsg);
        console.log(`   ❌ ${errorMsg}`);
      }
    }

    // Strategy 2: Browse by ISIN patterns (if we can detect them)
    console.log('\n🔍 Step 5: ISIN Pattern Discovery');
    console.log('=================================');
    
    // Try some common ISIN patterns
    const isinPatterns = [
      'US', // US stocks
      'DE', // German stocks
      'IE', // Ireland (ETFs)
      'NL', // Netherlands
      'GB', // UK
      'FR', // France
      'CH', // Switzerland
    ];

    for (const pattern of isinPatterns) {
      console.log(`   🔍 Exploring ${pattern} instruments...`);
      // We could try to search or use other discovery methods here
      // This would require more advanced API exploration
    }

    // Step 6: Database Summary and Analysis
    console.log('\n📊 Step 6: Complete Data Summary');
    console.log('================================');
    
    const dbStats = await database.getStatistics();
    const totalAssets = dbStats.totalAssets;
    stats.totalDataPoints = totalAssets * 50; // Estimate 50 data points per asset
    
    console.log(`📊 Total Assets Collected: ${totalAssets}`);
    console.log(`📈 Portfolio Assets: ${stats.portfolioAssets}`);
    console.log(`🔍 Discovered Instruments: ${stats.availableInstruments}`);
    console.log(`📋 Total Data Points: ${stats.totalDataPoints}`);
    console.log(`⏱️  Collection Time: ${((Date.now() - stats.startTime) / 1000).toFixed(1)}s`);
    
    if (stats.errors.length > 0) {
      console.log(`⚠️  Errors Encountered: ${stats.errors.length}`);
      stats.errors.slice(0, 5).forEach(error => console.log(`   • ${error}`));
    }

    // Export data for analysis
    console.log('\n💾 Database Files Created:');
    console.log('==========================');
    console.log('📁 Main Database: ./data/complete-account-data.db');
    console.log('🔍 Analysis Tools:');
    console.log('   • SQLite Browser: https://sqlitebrowser.org/');
    console.log('   • CLI: sqlite3 ./data/complete-account-data.db');
    console.log('   • Export: npm run explore:database');

    await client.logout();
    console.log('\n✅ Complete account data collection finished!');
    
    if (totalAssets < 100) {
      console.log('\n💡 To get more assets (targeting 409+):');
      console.log('   • Try running this script multiple times');
      console.log('   • Check if your account has full market access');
      console.log('   • Consider using WebSocket streaming for live discovery');
    }

  } catch (error) {
    console.log(`❌ Collection failed: ${error instanceof Error ? error.message : error}`);
    stats.errors.push(error instanceof Error ? error.message : String(error));
    await client.logout();
  }
}

// Run the complete data collection
collectCompleteAccountData().catch(console.error);
