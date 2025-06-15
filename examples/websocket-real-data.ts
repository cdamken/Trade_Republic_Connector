/**
 * WebSocket-Based Real Trade Republic Data Extractor
 * Uses WebSocket subscriptions to get all real data from your Trade Republic account
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AssetTestDatabase } from '../src/database/test-database.js';
import { logger } from '../src/utils/logger.js';
import { TwoFactorRequiredError } from '../src/types/auth.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment-based credentials
const credentials = {
  username: process.env.TR_USERNAME!,
  password: process.env.TR_PASSWORD!,
};

/**
 * Main function to authenticate and get ALL real data via WebSocket
 */
async function extractRealDataViaWebSocket() {
  console.log('\n🚀 WebSocket-Based Real Trade Republic Data Extractor');
  console.log('=====================================================');
  
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
    
    // Attempt login
    console.log('🔓 Attempting authentication...');
    const session = await client.login(credentials);
    
    console.log(`✅ Authenticated successfully!`);
    console.log(`👤 User ID: ${session.userId}`);
    console.log(`🎫 Session ID: ${session.sessionId}`);
    console.log(`⏰ Session expires: ${new Date(session.token.expiresAt).toLocaleTimeString()}`);

    // Initialize database
    console.log('\n💾 Setting up comprehensive database...');
    const database = new AssetTestDatabase({
      dbPath: './data/websocket-real-data.db',
      enableWAL: true,
      enableCache: true,
      cacheSize: 100000,
      autoVacuum: true,
    });
    
    await database.initialize();
    await database.clearData();
    
    // Connect to WebSocket
    console.log('\n🔌 Connecting to Trade Republic WebSocket...');
    const wsManager = client.websocket;
    await wsManager.connect();
    
    console.log('✅ WebSocket connected successfully!');
    
    // Collections for data
    let portfolioPositions: any[] = [];
    let orderHistory: any[] = [];
    let priceData: Map<string, any> = new Map();
    let newsData: any[] = [];
    
    // Step 1: Subscribe to portfolio updates
    console.log('\n📊 Step 1: Getting your portfolio via WebSocket...');
    
    const portfolioPromise = new Promise<void>((resolve) => {
      let portfolioReceived = false;
      
      const portfolioSub = wsManager.subscribePortfolio((message) => {
        console.log(`   📈 Portfolio update received:`, message);
        
        if (message.positions && Array.isArray(message.positions)) {
          portfolioPositions.push(...message.positions);
          console.log(`   ✅ Added ${message.positions.length} portfolio positions`);
        }
        
        if (!portfolioReceived) {
          portfolioReceived = true;
          setTimeout(() => {
            wsManager.unsubscribe(portfolioSub);
            resolve();
          }, 2000); // Wait 2 seconds for all data
        }
      });
      
      // Timeout fallback
      setTimeout(() => {
        if (!portfolioReceived) {
          console.log('   ⚠️  Portfolio subscription timeout');
          wsManager.unsubscribe(portfolioSub);
          resolve();
        }
      }, 10000);
    });
    
    await portfolioPromise;
    console.log(`📊 Portfolio collection complete: ${portfolioPositions.length} positions`);
    
    // Step 2: Subscribe to order updates
    console.log('\n📈 Step 2: Getting your order history via WebSocket...');
    
    const ordersPromise = new Promise<void>((resolve) => {
      let ordersReceived = false;
      
      const ordersSub = wsManager.subscribeOrders((message) => {
        console.log(`   🔄 Order update received:`, message);
        orderHistory.push(message);
        console.log(`   ✅ Added order: ${message.instrumentId} - ${message.side} ${message.quantity}`);
        
        if (!ordersReceived) {
          ordersReceived = true;
          setTimeout(() => {
            wsManager.unsubscribe(ordersSub);
            resolve();
          }, 2000);
        }
      });
      
      setTimeout(() => {
        if (!ordersReceived) {
          console.log('   ⚠️  Orders subscription timeout');
          wsManager.unsubscribe(ordersSub);
          resolve();
        }
      }, 10000);
    });
    
    await ordersPromise;
    console.log(`📈 Order history complete: ${orderHistory.length} orders`);
    
    // Step 3: Get prices for instruments we found
    console.log('\n💰 Step 3: Getting real-time prices via WebSocket...');
    
    // Extract unique ISINs from portfolio
    const isins = new Set<string>();
    portfolioPositions.forEach(pos => {
      if (pos.isin) isins.add(pos.isin);
      if (pos.instrumentId) isins.add(pos.instrumentId);
    });
    
    // Add some popular ISINs to test
    const popularIsins = [
      'US0378331005', // Apple
      'US5949181045', // Microsoft  
      'DE0007164600', // SAP
      'US88160R1014', // Tesla
      'IE00B4L5Y983', // iShares MSCI World
    ];
    popularIsins.forEach(isin => isins.add(isin));
    
    console.log(`   🎯 Getting prices for ${isins.size} instruments...`);
    
    // Subscribe to prices for each ISIN
    const pricePromises = Array.from(isins).map(isin => {
      return new Promise<void>((resolve) => {
        let priceReceived = false;
        
        const priceSub = wsManager.subscribePrices(isin, (message) => {
          console.log(`   💰 Price for ${isin}: €${message.price} (${message.change > 0 ? '+' : ''}${message.change}%)`);
          priceData.set(isin, message);
          
          if (!priceReceived) {
            priceReceived = true;
            setTimeout(() => {
              wsManager.unsubscribe(priceSub);
              resolve();
            }, 1000);
          }
        });
        
        setTimeout(() => {
          if (!priceReceived) {
            console.log(`   ⚠️  Price timeout for ${isin}`);
            wsManager.unsubscribe(priceSub);
            resolve();
          }
        }, 5000);
      });
    });
    
    await Promise.all(pricePromises);
    console.log(`💰 Price collection complete: ${priceData.size} prices received`);
    
    // Step 4: Store everything in database
    console.log('\n💾 Step 4: Storing all data in database...');
    
    let storedCount = 0;
    
    // Store portfolio positions as assets
    for (const position of portfolioPositions) {
      try {
        const isin = position.isin || position.instrumentId;
        const priceInfo = priceData.get(isin);
        
        await database.upsertAsset({
          isin: isin,
          symbol: position.symbol || '',
          name: position.name || position.instrumentName || 'Unknown',
          type: 'STOCK' as any,
          currency: position.currency || 'EUR',
          country: 'Unknown',
          homeExchange: 'Trade Republic',
          exchanges: [],
          currentPrice: priceInfo?.price || position.currentPrice || 0,
          volume: position.quantity || 0,
          marketCap: 0,
          dayChange: priceInfo?.change || 0,
          dayChangePercentage: priceInfo?.changePercent || 0,
          tradingStatus: 'TRADING' as any,
          lastUpdated: new Date(),
          dataProviders: ['Trade Republic WebSocket'],
        });
        
        storedCount++;
        console.log(`   ✅ Stored portfolio asset: ${position.name || isin}`);
      } catch (error: any) {
        console.log(`   ❌ Failed to store ${position.name}: ${error.message}`);
      }
    }
    
    // Store price-only data for other instruments
    for (const [isin, priceInfo] of priceData.entries()) {
      try {
        // Skip if already stored from portfolio
        const existsInPortfolio = portfolioPositions.some(p => 
          (p.isin === isin) || (p.instrumentId === isin)
        );
        
        if (!existsInPortfolio) {
          await database.upsertAsset({
            isin: isin,
            symbol: priceInfo.symbol || '',
            name: priceInfo.name || `Asset ${isin}`,
            type: 'STOCK' as any,
            currency: 'EUR',
            country: 'Unknown',
            homeExchange: 'Trade Republic',
            exchanges: [],
            currentPrice: priceInfo.price || 0,
            dayChange: priceInfo.change || 0,
            dayChangePercentage: priceInfo.changePercent || 0,
            tradingStatus: 'TRADING' as any,
            lastUpdated: new Date(),
            dataProviders: ['Trade Republic WebSocket'],
          });
          
          storedCount++;
          console.log(`   ✅ Stored market asset: ${priceInfo.name || isin}`);
        }
      } catch (error: any) {
        console.log(`   ❌ Failed to store ${isin}: ${error.message}`);
      }
    }
    
    // Final summary
    console.log(`\n🎉 WebSocket Data Collection Complete!`);
    console.log(`=====================================`);
    console.log(`✅ Portfolio positions: ${portfolioPositions.length}`);
    console.log(`✅ Order history: ${orderHistory.length}`);
    console.log(`✅ Price data: ${priceData.size}`);
    console.log(`✅ Assets stored: ${storedCount}`);
    console.log(`💾 Database: ./data/websocket-real-data.db`);
    console.log(`🎯 Real Trade Republic account data successfully extracted!`);
    
    // Disconnect WebSocket
    console.log('\n📡 Disconnecting WebSocket...');
    wsManager.disconnect();
    
    // Logout
    console.log('🔓 Logging out...');
    await client.logout();
    console.log('✅ Session closed successfully');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('🔍 Details:', error);
  }
}

// Run the WebSocket-based data extraction
extractRealDataViaWebSocket().catch(console.error);
