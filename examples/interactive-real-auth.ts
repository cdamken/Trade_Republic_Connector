/**
 * Interactive Real Trade Republic Authentication with 2FA
 * Gets all real data from your Trade Republic account with proper 2FA handling
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AssetTestDatabase } from '../src/database/test-database.js';
import { logger } from '../src/utils/logger.js';
import { TwoFactorRequiredError } from '../src/types/auth.js';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment-based credentials
const credentials = {
  username: process.env.TR_USERNAME!,
  password: process.env.TR_PASSWORD!,
};

/**
 * Interactive prompt for 2FA code
 */
function ask2FACode(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n🔐 Enter your 2FA code from Trade Republic app/SMS: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main function to authenticate and get ALL real data
 */
async function authenticateAndGetRealData() {
  console.log('\n🚀 Real Trade Republic Data Extractor');
  console.log('=====================================');
  
  // Check if credentials are available
  if (!credentials.username || !credentials.password) {
    console.log('❌ Error: Missing Trade Republic credentials!');
    console.log('💡 Please check your .env file contains:');
    console.log('   TR_USERNAME=your_phone_number');
    console.log('   TR_PASSWORD=your_pin');
    return;
  }
  
  console.log(`📱 Phone: ${credentials.username}`);
  console.log(`🔐 PIN: ${'*'.repeat(credentials.password.length)}`);

  const client = new TradeRepublicClient();
  
  try {
    // Initialize client
    console.log('\n⏳ Initializing Trade Republic client...');
    await client.initialize();
    
    // Attempt login with 2FA handling
    console.log('🔓 Attempting authentication...');
    let session;
    
    try {
      session = await client.login(credentials);
      console.log('✅ Authentication successful without 2FA!');
    } catch (error) {
      if (error instanceof TwoFactorRequiredError && error.challenge) {
        console.log('\n🔐 2FA Required!');
        console.log(`📱 Challenge Type: ${error.challenge.type}`);
        console.log(`💬 Message: ${error.challenge.message}`);
        
        // Get 2FA code from user
        const code = await ask2FACode();
        
        console.log('\n⏳ Submitting 2FA code...');
        session = await client.submitMFA(error.challenge, {
          challengeId: error.challenge.challengeId,
          code: code
        });
        
        console.log('✅ 2FA Authentication successful!');
      } else {
        throw error;
      }
    }

    console.log(`✅ Authenticated successfully!`);
    console.log(`👤 User ID: ${session.userId}`);
    console.log(`🎫 Session ID: ${session.sessionId}`);
    console.log(`⏰ Session expires: ${new Date(session.token.expiresAt).toLocaleTimeString()}`);

    // Initialize comprehensive database
    console.log('\n💾 Setting up comprehensive database...');
    const database = new AssetTestDatabase({
      dbPath: './data/real-account-data.db',
      enableWAL: true,
      enableCache: true,
      cacheSize: 100000,
      autoVacuum: true,
    });
    
    await database.initialize();
    
    console.log('🧹 Clearing old data...');
    await database.clearData();
    
    // Get real portfolio data
    console.log('\n📊 Step 1: Getting your portfolio positions...');
    try {
      const portfolio = await client.portfolio.getPositions();
      console.log(`✅ Found ${portfolio.length} portfolio positions`);
      
      for (const position of portfolio) {
        console.log(`   📈 ${position.name}: ${position.quantity} shares @ €${position.currentPrice}`);
      }
    } catch (error) {
      console.log(`⚠️  Portfolio access failed: ${error.message}`);
    }

    // Get trading history
    console.log('\n📈 Step 2: Getting your trading history...');
    try {
      const orders = await client.trading.getOrderHistory();
      console.log(`✅ Found ${orders.length} orders`);
      
      for (const order of orders.slice(0, 5)) {
        console.log(`   🔄 ${order.side} ${order.quantity} x ${order.instrumentName || 'Unknown'} @ €${order.executedPrice || order.limitPrice || 0}`);
      }
    } catch (error: any) {
      console.log(`⚠️  Trading history access failed: ${error.message}`);
    }

    // Search for available instruments
    console.log('\n🔍 Step 3: Discovering available instruments...');
    const searchTerms = [
      'Apple', 'Microsoft', 'Tesla', 'Amazon', 'Google', 'Meta', 'Netflix',
      'SAP', 'ASML', 'BMW', 'Volkswagen', 'Siemens', 'Adidas', 'Bayer',
      'ETF', 'MSCI', 'iShares', 'Vanguard', 'SPDR', 'S&P 500',
      'Bitcoin', 'Ethereum', 'Crypto', 'Gold', 'Silver'
    ];

    let discoveredAssets: any[] = [];
    
    for (const term of searchTerms) {
      try {
        console.log(`   🔍 Searching for: ${term}...`);
        const results = await client.searchInstruments(term);
        
        if (results && results.length > 0) {
          console.log(`   ✅ Found ${results.length} instruments for "${term}"`);
          discoveredAssets.push(...results);
        } else {
          console.log(`   ⚠️  No results for "${term}"`);
        }
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.log(`   ❌ Search failed for "${term}": ${error.message}`);
      }
    }

    // Remove duplicates based on ISIN
    const uniqueAssets = Array.from(
      new Map(discoveredAssets.map(asset => [asset.isin, asset])).values()
    );

    console.log(`\n📊 Discovery Summary:`);
    console.log(`   🔍 Search terms: ${searchTerms.length}`);
    console.log(`   📈 Total found: ${discoveredAssets.length}`);
    console.log(`   🎯 Unique assets: ${uniqueAssets.length}`);

    // Collect detailed data for each unique asset
    console.log(`\n📊 Step 4: Collecting detailed data for ${uniqueAssets.length} assets...`);
    let successCount = 0;
    
    for (let i = 0; i < uniqueAssets.length; i++) {
      const asset = uniqueAssets[i];
      try {
        console.log(`   [${i+1}/${uniqueAssets.length}] 📈 ${asset.name || asset.isin}...`);
        
        // Get comprehensive asset data
        const assetData = await client.getInstrumentInfo(asset.isin);
        
        if (assetData) {
          // Store in database
          await database.upsertAsset({
            isin: asset.isin,
            symbol: assetData.symbol || asset.symbol || '',
            name: assetData.name || asset.name || 'Unknown',
            type: 'STOCK' as any, // Default type
            currency: assetData.currency || 'EUR',
            country: assetData.country || 'Unknown',
            homeExchange: 'Trade Republic',
            exchanges: [],
            currentPrice: assetData.price || 0,
            sector: assetData.sector || 'Unknown',
            volume: assetData.volume || 0,
            marketCap: assetData.marketCap || 0,
            dayChange: assetData.change || 0,
            dayChangePercentage: assetData.changePercent || 0,
            tradingStatus: 'TRADING' as any,
            lastUpdated: new Date(),
            dataProviders: ['Trade Republic'],
          });
          
          successCount++;
          console.log(`   ✅ Stored (${successCount}/${uniqueAssets.length})`);
        }
        
        // Rate limiting
        if (i % 5 === 4) {
          console.log('   ⏸️  Rate limiting pause...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }

    // Final summary
    console.log(`\n🎉 Real Data Collection Complete!`);
    console.log(`===============================`);
    console.log(`✅ Successfully stored: ${successCount} assets`);
    console.log(`💾 Database: ./data/real-account-data.db`);
    console.log(`🎯 Ready for analysis and trading!`);

    // Logout
    console.log('\n🔓 Logging out...');
    await client.logout();
    console.log('✅ Logged out successfully');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('🔍 Details:', error);
  }
}

// Run the authentication and data collection
authenticateAndGetRealData().catch(console.error);
