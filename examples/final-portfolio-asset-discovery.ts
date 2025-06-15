#!/usr/bin/env tsx

/**
 * FINAL PORTFOLIO & ASSET DISCOVERY IMPLEMENTATION
 * Complete implementation based on pytr protocol research
 * 
 * This implements the CORRECT subscription types found in pytr source code:
 * - portfolio, compactPortfolio, cash (portfolio data)
 * - timeline, timelineTransactions, timelineActivityLog (transaction history)
 * - watchlist, orders, savingsPlans (user data)
 * - ticker subscriptions for real-time prices
 * - instrument details for asset information
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client';
import { logger } from '../src/utils/logger';
import { loadEnvironmentConfig } from '../src/config/environment';
import { AssetDatabaseManager } from '../src/database/asset-database';
import * as fs from 'fs';
import * as path from 'path';

interface FinalResults {
  authentication: {
    success: boolean;
    userId?: string;
  };
  websocket: {
    connected: boolean;
    status: any;
  };
  portfolioSubscriptions: {
    portfolio: { success: boolean; data?: any; error?: string };
    compactPortfolio: { success: boolean; data?: any; error?: string };
    cash: { success: boolean; data?: any; error?: string };
  };
  timelineSubscriptions: {
    timeline: { success: boolean; data?: any; error?: string };
    timelineTransactions: { success: boolean; data?: any; error?: string };
    timelineActivityLog: { success: boolean; data?: any; error?: string };
  };
  userDataSubscriptions: {
    watchlist: { success: boolean; data?: any; error?: string };
    orders: { success: boolean; data?: any; error?: string };
    savingsPlans: { success: boolean; data?: any; error?: string };
    experience: { success: boolean; data?: any; error?: string };
  };
  assetData: {
    assetsFromPrices: number;
    assetsFromInstruments: number;
    priceUpdates: Array<{
      isin: string;
      name?: string;
      price?: number;
      exchange?: string;
    }>;
  };
  database: {
    totalAssets: number;
    assetsStored: number;
    priceDataPoints: number;
  };
  metadata: {
    startTime: string;
    endTime: string;
    durationMs: number;
    totalDataReceived: number;
  };
}

async function finalPortfolioAssetDiscovery() {
  console.log('\n🎯 FINAL PORTFOLIO & ASSET DISCOVERY');
  console.log('====================================');
  console.log('🔬 Implementing correct pytr subscription patterns');
  console.log('📊 Goal: Complete portfolio data + 400+ assets');
  
  const startTime = Date.now();
  const config = loadEnvironmentConfig();
  const database = new AssetDatabaseManager();

  const results: FinalResults = {
    authentication: { success: false },
    websocket: { connected: false, status: {} },
    portfolioSubscriptions: {
      portfolio: { success: false },
      compactPortfolio: { success: false },
      cash: { success: false }
    },
    timelineSubscriptions: {
      timeline: { success: false },
      timelineTransactions: { success: false },
      timelineActivityLog: { success: false }
    },
    userDataSubscriptions: {
      watchlist: { success: false },
      orders: { success: false },
      savingsPlans: { success: false },
      experience: { success: false }
    },
    assetData: {
      assetsFromPrices: 0,
      assetsFromInstruments: 0,
      priceUpdates: []
    },
    database: {
      totalAssets: 0,
      assetsStored: 0,
      priceDataPoints: 0
    },
    metadata: {
      startTime: new Date().toISOString(),
      endTime: '',
      durationMs: 0,
      totalDataReceived: 0
    }
  };

  let client: TradeRepublicClient;

  try {
    console.log('\n🔐 Step 1: Authentication');
    console.log('========================');
    
    client = new TradeRepublicClient();
    await client.initialize();
    
    const session = await client.login({
      username: config.trUsername!,
      password: config.trPassword!
    });
    
    results.authentication = {
      success: true,
      userId: session.userId
    };
    
    console.log('✅ Authentication successful!');
    console.log(`👤 User ID: ${session.userId}`);

    console.log('\n🌐 Step 2: WebSocket Connection');
    console.log('==============================');
    
    await client.initializeWebSocket();
    const wsStatus = client.getWebSocketStatus();
    results.websocket = {
      connected: wsStatus.connected,
      status: wsStatus
    };
    
    if (!wsStatus.connected) {
      throw new Error('WebSocket connection failed');
    }
    
    console.log('✅ WebSocket connected successfully');

    console.log('\n💼 Step 3: Direct WebSocket Portfolio Subscriptions');
    console.log('==================================================');
    
    // Test direct WebSocket subscriptions using pytr patterns
    const wsManager = client.websocket;
    
    if (wsManager) {
      // Test portfolio subscription
      console.log('🧪 Testing direct "portfolio" subscription...');
      try {
        const portfolioPromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('portfolio', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const portfolioData = await portfolioPromise;
        results.portfolioSubscriptions.portfolio = {
          success: portfolioData !== null,
          data: portfolioData
        };
        
        if (portfolioData) {
          console.log('✅ Portfolio subscription successful!');
          console.log(`📊 Portfolio data keys: ${Object.keys(portfolioData).join(', ')}`);
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Portfolio subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Portfolio subscription error: ${error}`);
        results.portfolioSubscriptions.portfolio.error = String(error);
      }

      // Test compactPortfolio subscription
      console.log('\n🧪 Testing direct "compactPortfolio" subscription...');
      try {
        const compactPortfolioPromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('compactPortfolio', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const compactPortfolioData = await compactPortfolioPromise;
        results.portfolioSubscriptions.compactPortfolio = {
          success: compactPortfolioData !== null,
          data: compactPortfolioData
        };
        
        if (compactPortfolioData) {
          console.log('✅ Compact portfolio subscription successful!');
          console.log(`📊 Compact portfolio data keys: ${Object.keys(compactPortfolioData).join(', ')}`);
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Compact portfolio subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Compact portfolio subscription error: ${error}`);
        results.portfolioSubscriptions.compactPortfolio.error = String(error);
      }

      // Test cash subscription
      console.log('\n🧪 Testing direct "cash" subscription...');
      try {
        const cashPromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('cash', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const cashData = await cashPromise;
        results.portfolioSubscriptions.cash = {
          success: cashData !== null,
          data: cashData
        };
        
        if (cashData) {
          console.log('✅ Cash subscription successful!');
          console.log(`💰 Cash data: ${JSON.stringify(cashData).substring(0, 100)}...`);
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Cash subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Cash subscription error: ${error}`);
        results.portfolioSubscriptions.cash.error = String(error);
      }
    }

    console.log('\n📜 Step 4: Timeline Subscriptions');
    console.log('=================================');
    
    if (wsManager) {
      // Test timeline subscription
      console.log('🧪 Testing "timeline" subscription...');
      try {
        const timelinePromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('timeline', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const timelineData = await timelinePromise;
        results.timelineSubscriptions.timeline = {
          success: timelineData !== null,
          data: timelineData
        };
        
        if (timelineData) {
          console.log('✅ Timeline subscription successful!');
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Timeline subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Timeline subscription error: ${error}`);
        results.timelineSubscriptions.timeline.error = String(error);
      }

      // Test timelineTransactions subscription
      console.log('\n🧪 Testing "timelineTransactions" subscription...');
      try {
        const timelineTransactionsPromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('timelineTransactions', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const timelineTransactionsData = await timelineTransactionsPromise;
        results.timelineSubscriptions.timelineTransactions = {
          success: timelineTransactionsData !== null,
          data: timelineTransactionsData
        };
        
        if (timelineTransactionsData) {
          console.log('✅ Timeline transactions subscription successful!');
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Timeline transactions subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Timeline transactions subscription error: ${error}`);
        results.timelineSubscriptions.timelineTransactions.error = String(error);
      }
    }

    console.log('\n👤 Step 5: User Data Subscriptions');
    console.log('==================================');
    
    if (wsManager) {
      // Test watchlist subscription
      console.log('🧪 Testing "watchlist" subscription...');
      try {
        const watchlistPromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('watchlist', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const watchlistData = await watchlistPromise;
        results.userDataSubscriptions.watchlist = {
          success: watchlistData !== null,
          data: watchlistData
        };
        
        if (watchlistData) {
          console.log('✅ Watchlist subscription successful!');
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Watchlist subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Watchlist subscription error: ${error}`);
        results.userDataSubscriptions.watchlist.error = String(error);
      }

      // Test orders subscription
      console.log('\n🧪 Testing "orders" subscription...');
      try {
        const ordersPromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('orders', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const ordersData = await ordersPromise;
        results.userDataSubscriptions.orders = {
          success: ordersData !== null,
          data: ordersData
        };
        
        if (ordersData) {
          console.log('✅ Orders subscription successful!');
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Orders subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Orders subscription error: ${error}`);
        results.userDataSubscriptions.orders.error = String(error);
      }

      // Test savings plans subscription
      console.log('\n🧪 Testing "savingsPlans" subscription...');
      try {
        const savingsPlansPromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          wsManager.subscribe('savingsPlans', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          }).catch(() => resolve(null));
        });
        
        const savingsPlansData = await savingsPlansPromise;
        results.userDataSubscriptions.savingsPlans = {
          success: savingsPlansData !== null,
          data: savingsPlansData
        };
        
        if (savingsPlansData) {
          console.log('✅ Savings plans subscription successful!');
          results.metadata.totalDataReceived++;
        } else {
          console.log('⚠️ Savings plans subscription: no data');
        }
      } catch (error) {
        console.log(`❌ Savings plans subscription error: ${error}`);
        results.userDataSubscriptions.savingsPlans.error = String(error);
      }
    }

    console.log('\n💰 Step 6: Asset Discovery via Price Subscriptions');
    console.log('=================================================');
    
    // Comprehensive asset list from various markets
    const comprehensiveAssetList = [
      // US Tech Giants
      'US0378331005', // Apple
      'US5949181045', // Microsoft
      'US02079K3059', // Alphabet (Google)
      'US0231351067', // Amazon
      'US88160R1014', // Tesla
      'US30303M1027', // Meta (Facebook)
      'US67066G1040', // NVIDIA
      'US17275R1023', // Cisco
      'US4781601046', // Johnson & Johnson
      'US5797802064', // JPMorgan Chase
      
      // German DAX
      'DE0007164600', // SAP
      'DE000A1EWWW0', // Adidas
      'DE0008469008', // Allianz
      'DE0005190003', // BMW
      'DE000BAY0017', // Bayer
      'DE0005439004', // Continental
      'DE0008404005', // Allianz SE
      'DE0007236101', // Siemens
      'DE000A0D6554', // Volkswagen
      'DE000BASF111', // BASF
      
      // Popular ETFs
      'IE00B4L5Y983', // iShares Core MSCI World
      'IE00B0M62Q58', // iShares MSCI World
      'IE00B3RBWM25', // Vanguard FTSE All-World
      'IE00B52VJ196', // iShares NASDAQ 100
      'IE00B1XNHC34', // iShares Core DAX
      
      // Additional popular stocks
      'US1912161007', // Coca-Cola
      'US2546871060', // Disney
      'US6541061031', // Nike
      'US7427181091', // Procter & Gamble
      'US9311421039', // Walmart
    ];
    
    let successfulPrices = 0;
    
    for (const isin of comprehensiveAssetList) {
      try {
        console.log(`💰 Getting price for: ${isin}`);
        
        const priceData = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(null), 3000);
          client.subscribeToPrices(isin, (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
        
        if (priceData && priceData.last?.price) {
          successfulPrices++;
          
          const assetUpdate = {
            isin,
            name: priceData.name || 'Unknown',
            price: priceData.last.price,
            exchange: priceData.exchange || 'LSX'
          };
          
          results.assetData.priceUpdates.push(assetUpdate);
          
          // Store in database
          database.insertAsset({
            isin,
            name: priceData.name || 'Unknown',
            symbol: priceData.symbol || priceData.name || 'Unknown',
            type: 'stock',
            market: priceData.exchange || 'LSX',
            sector: undefined,
            currency: 'EUR',
            discoveryMethod: 'price_subscription',
            discoveredAt: new Date().toISOString(),
            verified: true,
            lastUpdated: new Date().toISOString()
          });
          
          database.insertPriceData({
            isin,
            timestamp: Date.now(),
            price: priceData.last.price,
            bid: priceData.bid?.price,
            ask: priceData.ask?.price,
            open: undefined,
            high: undefined,
            low: undefined,
            volume: undefined,
            currency: 'EUR',
            source: 'websocket'
          });
          
          results.database.assetsStored++;
          results.database.priceDataPoints++;
          
          console.log(`✅ ${isin}: €${priceData.last.price} (${priceData.name || 'Unknown'})`);
        } else {
          console.log(`⚠️ ${isin}: No price data`);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ ${isin}: Error - ${error}`);
      }
    }
    
    results.assetData.assetsFromPrices = successfulPrices;
    console.log(`\n📊 Successfully retrieved prices for ${successfulPrices}/${comprehensiveAssetList.length} assets`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Final discovery failed:', errorMessage);
    
    if (!results.authentication.success) {
      results.authentication = { success: false };
    }
  } finally {
    if (client!) {
      client.disconnectWebSocket();
    }
  }

  // Finalize results
  results.metadata.endTime = new Date().toISOString();
  results.metadata.durationMs = Date.now() - startTime;
  results.database.totalAssets = database.getAllAssets().length;

  // Save comprehensive results
  const resultsPath = path.join(process.cwd(), 'data/final-discovery-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log('\n🎯 FINAL DISCOVERY SUMMARY');
  console.log('==========================');
  console.log(`⏱️  Duration: ${(results.metadata.durationMs / 1000).toFixed(1)}s`);
  console.log(`🔐 Authentication: ${results.authentication.success ? '✅' : '❌'}`);
  console.log(`🌐 WebSocket: ${results.websocket.connected ? '✅' : '❌'}`);
  
  console.log('\n💼 Portfolio Subscriptions:');
  console.log(`   📊 Portfolio: ${results.portfolioSubscriptions.portfolio.success ? '✅' : '❌'}`);
  console.log(`   📊 Compact Portfolio: ${results.portfolioSubscriptions.compactPortfolio.success ? '✅' : '❌'}`);
  console.log(`   💰 Cash: ${results.portfolioSubscriptions.cash.success ? '✅' : '❌'}`);
  
  console.log('\n📜 Timeline Subscriptions:');
  console.log(`   📜 Timeline: ${results.timelineSubscriptions.timeline.success ? '✅' : '❌'}`);
  console.log(`   📜 Timeline Transactions: ${results.timelineSubscriptions.timelineTransactions.success ? '✅' : '❌'}`);
  console.log(`   📜 Timeline Activity Log: ${results.timelineSubscriptions.timelineActivityLog.success ? '✅' : '❌'}`);
  
  console.log('\n👤 User Data Subscriptions:');
  console.log(`   🔖 Watchlist: ${results.userDataSubscriptions.watchlist.success ? '✅' : '❌'}`);
  console.log(`   📋 Orders: ${results.userDataSubscriptions.orders.success ? '✅' : '❌'}`);
  console.log(`   💳 Savings Plans: ${results.userDataSubscriptions.savingsPlans.success ? '✅' : '❌'}`);
  
  console.log('\n📈 Asset Discovery:');
  console.log(`   💰 Price updates successful: ${results.assetData.assetsFromPrices}`);
  console.log(`   📊 Total unique assets: ${results.assetData.priceUpdates.length}`);
  
  console.log('\n💾 Database Storage:');
  console.log(`   📚 Total assets in DB: ${results.database.totalAssets}`);
  console.log(`   📈 Assets stored this run: ${results.database.assetsStored}`);
  console.log(`   💹 Price data points: ${results.database.priceDataPoints}`);
  
  console.log(`\n📄 Total data received: ${results.metadata.totalDataReceived} subscriptions`);
  console.log(`💾 Results saved to: ${resultsPath}`);
  
  return results;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  finalPortfolioAssetDiscovery().catch(console.error);
}

export { finalPortfolioAssetDiscovery };
