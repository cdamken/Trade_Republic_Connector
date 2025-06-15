/**
 * Simple Trade Republic WebSocket Test
 * Tests the new pytr-based WebSocket implementation
 * 
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { writeFile } from 'fs/promises';

interface CollectedData {
  portfolio: any[];
  priceUpdates: any[];
  instrumentData: any[];
  metadata: {
    collectedAt: string;
    authenticatedUserId: string;
    sessionId: string;
    totalDataPoints: number;
    websocketStatus: any;
    collectionDurationMs: number;
  };
}

async function testTradeRepublicWebSocket() {
  console.log('\n🚀 Trade Republic WebSocket Test (pytr-based)');
  console.log('=============================================');
  console.log('🔌 Testing new WebSocket implementation based on pytr protocol');
  
  const startTime = Date.now();
  const config = loadEnvironmentConfig();
  console.log(`📱 Phone: ${config.trUsername}`);

  const collectedData: CollectedData = {
    portfolio: [],
    priceUpdates: [],
    instrumentData: [],
    metadata: {
      collectedAt: new Date().toISOString(),
      authenticatedUserId: '',
      sessionId: '',
      totalDataPoints: 0,
      websocketStatus: {},
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
    
    collectedData.metadata.authenticatedUserId = session.userId;
    collectedData.metadata.sessionId = session.sessionId;

    console.log('\n🌐 Step 2: Initialize WebSocket Connection');
    console.log('=========================================');
    
    await client.initializeWebSocket();
    const wsStatus = client.getWebSocketStatus();
    console.log('📊 WebSocket status:', wsStatus);
    collectedData.metadata.websocketStatus = wsStatus;
    
    if (!wsStatus.connected) {
      throw new Error('WebSocket connection failed');
    }

    console.log('\n📊 Step 3: Subscribe to Portfolio Data');
    console.log('======================================');
    
    const portfolioSubId = await client.subscribeToPortfolio((data) => {
      console.log('📈 Portfolio data received:', Object.keys(data).length > 0 ? Object.keys(data) : 'Empty data');
      collectedData.portfolio.push({
        receivedAt: new Date().toISOString(),
        data: data
      });
    });
    
    if (portfolioSubId) {
      console.log(`✅ Portfolio subscription ID: ${portfolioSubId}`);
    } else {
      console.log('⚠️  Portfolio subscription failed');
    }

    console.log('\n🔍 Step 4: Subscribe to Price Updates');
    console.log('====================================');
    
    // Test a few popular ISINs
    const testISINs = [
      'US0378331005', // Apple
      'US5949181045', // Microsoft  
      'US88160R1014', // Tesla
      'DE0007164600', // SAP
      'IE00B4L5Y983', // MSCI World ETF
    ];
    
    const priceSubscriptions: string[] = [];
    
    for (const isin of testISINs) {
      console.log(`  🔍 Subscribing to prices for: ${isin}`);
      
      try {
        const priceSubId = await client.subscribeToPrices(isin, (data) => {
          console.log(`💰 Price update for ${isin}:`, data);
          collectedData.priceUpdates.push({
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
      } catch (error) {
        console.log(`    ❌ Error subscribing to ${isin}:`, error);
      }
      
      // Small delay between subscriptions
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n📋 Step 5: Subscribe to Instrument Details');
    console.log('==========================================');
    
    // Test instrument details for one ISIN
    const testIsin = 'US0378331005'; // Apple
    console.log(`🔍 Getting instrument details for: ${testIsin}`);
    
    try {
      const instrumentSubId = await client.websocket?.subscribeToInstrument(testIsin, (data) => {
        console.log(`📋 Instrument data for ${testIsin}:`, Object.keys(data).length > 0 ? Object.keys(data) : 'Empty data');
        collectedData.instrumentData.push({
          isin: testIsin,
          receivedAt: new Date().toISOString(),
          data: data
        });
      });
      
      if (instrumentSubId) {
        console.log(`✅ Instrument subscription ID: ${instrumentSubId}`);
      } else {
        console.log('⚠️  Instrument subscription failed');
      }
    } catch (error) {
      console.log('❌ Error subscribing to instrument:', error);
    }

    console.log('\n⏰ Step 6: Collect Data for 20 Seconds');
    console.log('====================================');
    console.log('🔄 Waiting for WebSocket data to arrive...');
    
    // Wait for data to arrive
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentDataPoints = collectedData.portfolio.length + collectedData.priceUpdates.length + collectedData.instrumentData.length;
      if (i % 5 === 0 || currentDataPoints > 0) {
        console.log(`   ⏱️  ${i+1}s - Portfolio: ${collectedData.portfolio.length}, Prices: ${collectedData.priceUpdates.length}, Instruments: ${collectedData.instrumentData.length}`);
      }
      
      // If we get good data early, continue but don't break
      if (currentDataPoints > 10) {
        console.log('✅ Good amount of data received, continuing...');
      }
    }

    console.log('\n🧹 Step 7: Clean Up Subscriptions');
    console.log('=================================');
    
    try {
      // Unsubscribe from all price updates
      for (const subId of priceSubscriptions) {
        await client.unsubscribe(subId);
      }
      
      if (portfolioSubId) {
        await client.unsubscribe(portfolioSubId);
      }
      
      console.log('✅ All subscriptions cleaned up');
    } catch (error) {
      console.log('⚠️  Error during cleanup:', error);
    }

    await client.logout();

    // Calculate final metadata
    collectedData.metadata.totalDataPoints = collectedData.portfolio.length + collectedData.priceUpdates.length + collectedData.instrumentData.length;
    collectedData.metadata.collectionDurationMs = Date.now() - startTime;
    
    console.log('\n💾 Step 8: Save Collected Data');
    console.log('==============================');
    
    const filename = './data/tr-websocket-test-results.json';
    await writeFile(filename, JSON.stringify(collectedData, null, 2));
    
    console.log('\n🎉 TRADE REPUBLIC WEBSOCKET TEST COMPLETE!');
    console.log('=========================================');
    console.log(`✅ Portfolio items: ${collectedData.portfolio.length}`);
    console.log(`💰 Price updates: ${collectedData.priceUpdates.length}`);
    console.log(`📋 Instrument data: ${collectedData.instrumentData.length}`);
    console.log(`📊 Total data points: ${collectedData.metadata.totalDataPoints}`);
    console.log(`⏱️  Collection time: ${collectedData.metadata.collectionDurationMs}ms`);
    console.log(`📁 Data saved: ${filename}`);
    
    if (collectedData.metadata.totalDataPoints > 0) {
      console.log('\n🚀 SUCCESS: Real Trade Republic data collected via WebSocket!');
      console.log('💡 This proves the pytr-based WebSocket protocol is working!');
      console.log('🎯 Ready for full asset collection implementation!');
    } else {
      console.log('\n⚠️  No data collected - need to investigate WebSocket responses...');
      console.log('💡 Possible issues:');
      console.log('   • Different subscription payload format needed');
      console.log('   • Authentication token issue');
      console.log('   • Need different subscription types');
      console.log('   • TR WebSocket protocol has changed');
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error}`);
    console.log('💡 Check the error details and WebSocket implementation');
  }
}

// Run the WebSocket test
testTradeRepublicWebSocket().catch(console.error);
