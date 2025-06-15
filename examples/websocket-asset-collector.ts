/**
 * WebSocket-Based Asset Collector for Trade Republic
 * 
 * Since REST endpoints return HTML, this uses WebSocket connections
 * to collect real asset and portfolio data from Trade Republic
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { writeFile } from 'fs/promises';

interface AssetData {
  portfolio: any[];
  priceUpdates: any[];
  websocketEvents: any[];
  metadata: {
    collectedAt: string;
    authenticatedUserId: string;
    sessionId: string;
    totalDataPoints: number;
    websocketStatus: any;
    dataSourceMethod: string;
    collectionDurationMs: number;
  };
}

async function collectAssetsViaWebSocket() {
  console.log('\n🌐 WebSocket-Based Asset Collection');
  console.log('=================================');
  console.log('🎯 Using WebSocket for real Trade Republic data collection');
  console.log('📡 This method bypasses REST endpoints that return HTML');
  
  const startTime = Date.now();
  const config = loadEnvironmentConfig();
  console.log(`📱 Phone: ${config.trUsername}`);

  const assetData: AssetData = {
    portfolio: [],
    priceUpdates: [],
    websocketEvents: [],
    metadata: {
      collectedAt: new Date().toISOString(),
      authenticatedUserId: '',
      sessionId: '',
      totalDataPoints: 0,
      websocketStatus: {},
      dataSourceMethod: 'websocket',
      collectionDurationMs: 0
    }
  };

  try {
    console.log('\n🔐 Step 1: Authenticate with Trade Republic');
    console.log('==========================================');
    
    const client = new TradeRepublicClient();
    await client.initialize();
    
    const session = await client.login({
      username: config.trUsername!,
      password: config.trPassword!
    });
    
    console.log('✅ Authentication successful!');
    console.log(`👤 User ID: ${session.userId}`);
    console.log(`🎫 Session ID: ${session.sessionId}`);
    
    assetData.metadata.authenticatedUserId = session.userId;
    assetData.metadata.sessionId = session.sessionId;

    console.log('\n🌐 Step 2: Initialize WebSocket Connection');
    console.log('=========================================');
    
    await client.initializeWebSocket();
    const wsStatus = client.getWebSocketStatus();
    console.log('📊 WebSocket status:', wsStatus);
    assetData.metadata.websocketStatus = wsStatus;
    
    if (!wsStatus.connected) {
      console.log('⚠️  WebSocket not connected, attempting to connect...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n📊 Step 3: Subscribe to Portfolio Data');
    console.log('======================================');
    
    const portfolioSubId = client.subscribeToPortfolio((data) => {
      console.log('📈 Portfolio data received:', Object.keys(data));
      assetData.portfolio.push({
        receivedAt: new Date().toISOString(),
        data: data
      });
    });
    
    if (portfolioSubId) {
      console.log(`✅ Portfolio subscription ID: ${portfolioSubId}`);
    } else {
      console.log('⚠️  Portfolio subscription failed');
    }

    console.log('\n🔍 Step 4: Subscribe to Price Updates for Popular Assets');
    console.log('========================================================');
    
    // Popular ISINs to get real-time price data
    const popularISINs = [
      'US0378331005', // Apple
      'US5949181045', // Microsoft  
      'US02079K3059', // Alphabet/Google
      'US0231351067', // Amazon
      'US88160R1014', // Tesla
      'DE0007164600', // SAP
      'DE0007236101', // Siemens
      'DE0005190003', // BMW
      'IE00B4L5Y983', // MSCI World ETF
      'DE000A0F5UH1'  // iShares Core DAX ETF
    ];
    
    const priceSubscriptions: string[] = [];
    
    for (const isin of popularISINs) {
      console.log(`  🔍 Subscribing to prices for: ${isin}`);
      
      const priceSubId = client.subscribeToPrices(isin, (data) => {
        console.log(`💰 Price update for ${isin}:`, data);
        assetData.priceUpdates.push({
          isin: isin,
          receivedAt: new Date().toISOString(),
          data: data
        });
      });
      
      if (priceSubId) {
        priceSubscriptions.push(priceSubId);
        console.log(`    ✅ Price subscription ID: ${priceSubId}`);
      } else {
        console.log(`    ⚠️  Price subscription failed for ${isin}`);
      }
      
      // Small delay between subscriptions
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n⏰ Step 5: Collect Data for 30 Seconds');
    console.log('====================================');
    console.log('🔄 Waiting for WebSocket data to arrive...');
    
    // Wait for data to arrive
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentDataPoints = assetData.portfolio.length + assetData.priceUpdates.length;
      if (i % 5 === 0) {
        console.log(`   ⏱️  ${i+1}s - Portfolio: ${assetData.portfolio.length}, Prices: ${assetData.priceUpdates.length}`);
      }
      
      // If we get good data early, we can continue
      if (currentDataPoints > 50) {
        console.log('✅ Good amount of data received, continuing...');
        break;
      }
    }

    console.log('\n� Step 6: Clean Up Subscriptions');
    console.log('=================================');
    
    // Unsubscribe from all price updates
    for (const subId of priceSubscriptions) {
      client.unsubscribe(subId);
    }
    
    if (portfolioSubId) {
      client.unsubscribe(portfolioSubId);
    }
    
    console.log('✅ All subscriptions cleaned up');

    await client.logout();

    // Calculate final metadata
    assetData.metadata.totalDataPoints = assetData.portfolio.length + assetData.priceUpdates.length;
    assetData.metadata.collectionDurationMs = Date.now() - startTime;
    
    console.log('\n💾 Step 7: Save Collected Data');
    console.log('==============================');
    
    const filename = './data/websocket-assets-collection.json';
    await writeFile(filename, JSON.stringify(assetData, null, 2));
    
    console.log('\n🎉 WEBSOCKET COLLECTION COMPLETE!');
    console.log('================================');
    console.log(`✅ Portfolio items: ${assetData.portfolio.length}`);
    console.log(`� Price updates: ${assetData.priceUpdates.length}`);
    console.log(`📊 Total data points: ${assetData.metadata.totalDataPoints}`);
    console.log(`⏱️  Collection time: ${assetData.metadata.collectionDurationMs}ms`);
    console.log(`📁 Data saved: ${filename}`);
    
    if (assetData.metadata.totalDataPoints > 0) {
      console.log('\n🚀 SUCCESS: Real Trade Republic data collected via WebSocket!');
      console.log('💡 This proves WebSocket is the correct method for data access');
      console.log('🎯 MISSION ACCOMPLISHED: Real data collection working!');
    } else {
      console.log('\n⚠️  No data collected - investigating WebSocket implementation...');
      console.log('💡 Possible issues:');
      console.log('   • WebSocket connection not established');
      console.log('   • Subscription message format incorrect');
      console.log('   • Trade Republic WebSocket protocol requires different approach');
    }
    
  } catch (error) {
    console.log(`❌ Collection failed: ${error}`);
    console.log('💡 Possible issues:');
    console.log('   • WebSocket connection failed');
    console.log('   • Authentication session expired');
    console.log('   • Trade Republic WebSocket protocol changed');
  }
}

// Run the WebSocket asset collection
collectAssetsViaWebSocket().catch(console.error);
