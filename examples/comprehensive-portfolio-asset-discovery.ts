#!/usr/bin/env tsx

/**
 * Comprehensive Portfolio & Asset Discovery
 * Based on pytr protocol analysis - complete implementation
 * 
 * This script implements ALL discovered subscription types from pytr:
 * - portfolio, compactPortfolio, cash
 * - timeline, timelineTransactions, timelineActivityLog
 * - watchlist, orders, savings plans
 * - Dynamic asset discovery using various methods
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client';
import { logger } from '../src/utils/logger';
import { loadEnvironmentConfig } from '../src/config/environment';
import { AssetDatabaseManager } from '../src/database/asset-database';
import * as fs from 'fs';
import * as path from 'path';

interface SubscriptionTest {
  name: string;
  type: string;
  payload?: any;
  expectedResponse?: string;
  workingMethod?: (client: TradeRepublicClient) => Promise<any>;
}

interface ComprehensiveResults {
  authentication: {
    success: boolean;
    userId?: string;
    error?: string;
  };
  websocket: {
    connected: boolean;
    status: any;
  };
  subscriptionTests: {
    tested: number;
    successful: number;
    failed: number;
    results: Array<{
      name: string;
      success: boolean;
      dataReceived: boolean;
      messageCount: number;
      error?: string;
      sampleData?: any;
    }>;
  };
  portfolioData: {
    portfolio?: any;
    compactPortfolio?: any;
    cash?: any;
    positions?: any[];
    totalValue?: number;
  };
  assetDiscovery: {
    methodsTested: number;
    totalAssetsFound: number;
    uniqueAssets: number;
    assets: Array<{
      isin: string;
      name?: string;
      symbol?: string;
      price?: string;
      exchange?: string;
      source: string;
    }>;
  };
  timelineData: {
    transactions?: any[];
    activities?: any[];
    details?: any[];
  };
  metadata: {
    startTime: string;
    endTime: string;
    durationMs: number;
    totalDataCollected: number;
  };
}

async function comprehensivePortfolioAssetDiscovery() {
  console.log('\n🚀 COMPREHENSIVE PORTFOLIO & ASSET DISCOVERY');
  console.log('==============================================');
  console.log('📡 Mission: Discover ALL subscription types and collect complete data');
  console.log('🔬 Based on: pytr protocol analysis');
  
  const startTime = Date.now();
  const config = loadEnvironmentConfig();
  const database = new AssetDatabaseManager();

  const results: ComprehensiveResults = {
    authentication: { success: false },
    websocket: { connected: false, status: {} },
    subscriptionTests: { tested: 0, successful: 0, failed: 0, results: [] },
    portfolioData: {},
    assetDiscovery: { methodsTested: 0, totalAssetsFound: 0, uniqueAssets: 0, assets: [] },
    timelineData: {},
    metadata: {
      startTime: new Date().toISOString(),
      endTime: '',
      durationMs: 0,
      totalDataCollected: 0
    }
  };

  // Define subscription tests based on pytr API analysis
  const subscriptionTests: SubscriptionTest[] = [
    // Portfolio-related subscriptions (from pytr/api.py)
    {
      name: 'Portfolio (Full)',
      type: 'portfolio',
      expectedResponse: 'Complete portfolio with positions',
      workingMethod: async (client) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
          client.websocket?.subscribe('portfolio', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
      }
    },
    {
      name: 'Compact Portfolio',
      type: 'compactPortfolio',
      expectedResponse: 'Simplified portfolio data',
      workingMethod: async (client) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
          client.websocket?.subscribe('compactPortfolio', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
      }
    },
    {
      name: 'Portfolio Status',
      type: 'portfolioStatus',
      expectedResponse: 'Portfolio status and overview'
    },
    {
      name: 'Cash Balance',
      type: 'cash',
      expectedResponse: 'Available cash balances',
      workingMethod: async (client) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
          client.websocket?.subscribe('cash', {}, (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
      }
    },
    {
      name: 'Available Cash for Payout',
      type: 'availableCashForPayout',
      expectedResponse: 'Cash available for withdrawal'
    },
    {
      name: 'Portfolio History',
      type: 'portfolioAggregateHistory',
      payload: { range: '1d' },
      expectedResponse: 'Historical portfolio performance'
    },
    
    // Trading-related subscriptions
    {
      name: 'Orders Overview',
      type: 'orders',
      expectedResponse: 'Current and historical orders'
    },
    {
      name: 'Available Cash for Order',
      type: 'availableCash',
      expectedResponse: 'Cash available for trading'
    },
    
    // Watchlist and instruments
    {
      name: 'Watchlist',
      type: 'watchlist',
      expectedResponse: 'User watchlist with instruments'
    },
    
    // Timeline subscriptions (key for transaction history)
    {
      name: 'Timeline',
      type: 'timeline',
      expectedResponse: 'Timeline of account activities'
    },
    {
      name: 'Timeline Transactions',
      type: 'timelineTransactions',
      expectedResponse: 'Transaction history'
    },
    {
      name: 'Timeline Activity Log',
      type: 'timelineActivityLog',
      expectedResponse: 'Activity log entries'
    },
    
    // Savings plans
    {
      name: 'Savings Plans',
      type: 'savingsPlans',
      expectedResponse: 'Active savings plans'
    },
    
    // Price alarms
    {
      name: 'Price Alarms',
      type: 'priceAlarms',
      expectedResponse: 'Active price alerts'
    },
    
    // News and experience
    {
      name: 'Experience',
      type: 'experience',
      expectedResponse: 'User experience level'
    },
    {
      name: 'Message of the Day',
      type: 'messageOfTheDay',
      expectedResponse: 'MOTD from Trade Republic'
    },
    {
      name: 'Neon Cards',
      type: 'neonCards',
      expectedResponse: 'Neon card offers and info'
    },
    {
      name: 'News Subscriptions',
      type: 'newsSubscriptions',
      expectedResponse: 'Active news subscriptions'
    }
  ];

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

    console.log('\n📊 Step 3: Portfolio Data Collection');
    console.log('====================================');
    
    // Test core portfolio subscriptions first
    const corePortfolioTests = ['portfolio', 'compactPortfolio', 'cash'];
    
    for (const testType of corePortfolioTests) {
      const test = subscriptionTests.find(t => t.type === testType);
      if (!test) continue;
      
      console.log(`\n🔍 Testing: ${test.name}`);
      
      try {
        const messages: any[] = [];
        
        if (test.workingMethod) {
          const data = await test.workingMethod(client);
          messages.push(data);
          
          // Store portfolio data
          if (test.type === 'portfolio' || test.type === 'compactPortfolio') {
            results.portfolioData.portfolio = data;
            if (data.positions) {
              results.portfolioData.positions = data.positions;
              results.portfolioData.totalValue = data.positions.reduce((sum: number, pos: any) => 
                sum + (pos.netValue || 0), 0);
            }
          } else if (test.type === 'cash') {
            results.portfolioData.cash = data;
          }
        }
        
        const result = {
          name: test.name,
          success: messages.length > 0,
          dataReceived: messages.length > 0,
          messageCount: messages.length,
          sampleData: messages.length > 0 ? messages[0] : undefined
        };
        
        results.subscriptionTests.results.push(result);
        results.subscriptionTests.tested++;
        
        if (result.success) {
          results.subscriptionTests.successful++;
          console.log(`✅ ${test.name}: Success (${messages.length} messages)`);
          console.log(`📄 Sample keys: ${Object.keys(messages[0] || {}).slice(0, 5).join(', ')}`);
        } else {
          results.subscriptionTests.failed++;
          console.log(`❌ ${test.name}: No data received`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ ${test.name}: Error - ${errorMessage}`);
        
        results.subscriptionTests.results.push({
          name: test.name,
          success: false,
          dataReceived: false,
          messageCount: 0,
          error: errorMessage
        });
        results.subscriptionTests.tested++;
        results.subscriptionTests.failed++;
      }
    }

    console.log('\n🔍 Step 4: Comprehensive Subscription Testing');
    console.log('=============================================');
    
    // Test remaining subscriptions
    const remainingTests = subscriptionTests.filter(t => !corePortfolioTests.includes(t.type));
    
    for (const test of remainingTests) {
      console.log(`\n🧪 Testing: ${test.name}`);
      
      try {
        const messages: any[] = [];
        
        // Try generic subscription approach
        const wsManager = client.websocket;
        if (wsManager) {
          const payload = test.payload || {};
          
          const subscriptionPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              resolve(); // Don't reject, just resolve with no data
            }, 3000);
            
            const messageHandler = (data: any) => {
              messages.push(data);
              clearTimeout(timeout);
              resolve();
            };
            
            wsManager.subscribe(test.type, payload, messageHandler).catch(() => {
              clearTimeout(timeout);
              resolve();
            });
          });
          
          await subscriptionPromise;
        }
        
        const result = {
          name: test.name,
          success: messages.length > 0,
          dataReceived: messages.length > 0,
          messageCount: messages.length,
          sampleData: messages.length > 0 ? messages[0] : undefined
        };
        
        results.subscriptionTests.results.push(result);
        results.subscriptionTests.tested++;
        
        if (result.success) {
          results.subscriptionTests.successful++;
          console.log(`✅ ${test.name}: Success (${messages.length} messages)`);
          
          // Store timeline data
          if (test.type === 'timeline' || test.type === 'timelineTransactions') {
            if (!results.timelineData.transactions) results.timelineData.transactions = [];
            results.timelineData.transactions.push(...messages);
          } else if (test.type === 'timelineActivityLog') {
            if (!results.timelineData.activities) results.timelineData.activities = [];
            results.timelineData.activities.push(...messages);
          }
        } else {
          results.subscriptionTests.failed++;
          console.log(`⚠️ ${test.name}: No data (expected for some)`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ ${test.name}: Error - ${errorMessage}`);
        
        results.subscriptionTests.results.push({
          name: test.name,
          success: false,
          dataReceived: false,
          messageCount: 0,
          error: errorMessage
        });
        results.subscriptionTests.tested++;
        results.subscriptionTests.failed++;
      }
    }

    console.log('\n🔬 Step 5: Asset Discovery from Portfolio');
    console.log('=========================================');
    
    // Extract assets from portfolio positions
    if (results.portfolioData.positions) {
      for (const position of results.portfolioData.positions) {
        if (position.instrumentId) {
          // Get detailed instrument information
          try {
            const instrumentData = await new Promise<any>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
              client.websocket?.subscribe('instrument', { id: position.instrumentId }, (data) => {
                clearTimeout(timeout);
                resolve(data);
              });
            });
            
            results.assetDiscovery.assets.push({
              isin: position.instrumentId,
              name: instrumentData?.shortName || instrumentData?.name || position.name,
              symbol: instrumentData?.shortName || position.name,
              price: position.netValue ? (position.netValue / position.netSize).toString() : undefined,
              exchange: instrumentData?.exchangeIds?.[0] || 'LSX',
              source: 'portfolio'
            });
            
            results.assetDiscovery.totalAssetsFound++;
          } catch (error) {
            console.log(`⚠️ Could not get details for ${position.instrumentId}`);
            
            results.assetDiscovery.assets.push({
              isin: position.instrumentId,
              name: position.name || 'Unknown',
              source: 'portfolio'
            });
            results.assetDiscovery.totalAssetsFound++;
          }
        }
      }
      
      results.assetDiscovery.methodsTested++;
      console.log(`📊 Found ${results.assetDiscovery.totalAssetsFound} assets from portfolio`);
    }

    console.log('\n💾 Step 6: Data Storage');
    console.log('======================');
    
    // Store assets in database
    if (results.assetDiscovery.assets.length > 0) {
      for (const asset of results.assetDiscovery.assets) {
        database.insertAsset({
          isin: asset.isin,
          name: asset.name || 'Unknown',
          symbol: asset.symbol || asset.name || 'Unknown',
          type: 'stock', // Default type
          market: asset.exchange || 'LSX',
          sector: undefined,
          currency: 'EUR',
          discoveryMethod: asset.source,
          discoveredAt: new Date().toISOString(),
          verified: false,
          lastUpdated: new Date().toISOString()
        });
      }
      
      const allAssets = database.getAllAssets();
      console.log(`💾 Stored ${allAssets.length} assets in database`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Comprehensive discovery failed:', errorMessage);
    
    if (!results.authentication.success) {
      results.authentication = { success: false, error: errorMessage };
    }
  } finally {
    if (client!) {
      client.disconnectWebSocket();
    }
  }

  // Finalize results
  results.metadata.endTime = new Date().toISOString();
  results.metadata.durationMs = Date.now() - startTime;
  results.metadata.totalDataCollected = (results.portfolioData.positions?.length || 0) + 
                                       (results.timelineData.transactions?.length || 0) + 
                                       (results.timelineData.activities?.length || 0);
  results.assetDiscovery.uniqueAssets = new Set(results.assetDiscovery.assets.map(a => a.isin)).size;

  // Save comprehensive results
  const resultsPath = path.join(process.cwd(), 'data/comprehensive-discovery-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log('\n📊 COMPREHENSIVE DISCOVERY SUMMARY');
  console.log('==================================');
  console.log(`⏱️  Duration: ${(results.metadata.durationMs / 1000).toFixed(1)}s`);
  console.log(`🔐 Authentication: ${results.authentication.success ? '✅' : '❌'}`);
  console.log(`🌐 WebSocket: ${results.websocket.connected ? '✅' : '❌'}`);
  console.log(`📊 Subscriptions tested: ${results.subscriptionTests.tested}`);
  console.log(`   ✅ Successful: ${results.subscriptionTests.successful}`);
  console.log(`   ❌ Failed: ${results.subscriptionTests.failed}`);
  console.log(`💼 Portfolio positions: ${results.portfolioData.positions?.length || 0}`);
  console.log(`💰 Total portfolio value: €${results.portfolioData.totalValue?.toFixed(2) || '0.00'}`);
  console.log(`🔍 Assets discovered: ${results.assetDiscovery.totalAssetsFound}`);
  console.log(`📈 Unique assets: ${results.assetDiscovery.uniqueAssets}`);
  console.log(`📄 Total data points: ${results.metadata.totalDataCollected}`);
  
  console.log('\n🎯 Working Subscription Types:');
  results.subscriptionTests.results
    .filter(r => r.success)
    .forEach(r => console.log(`   ✅ ${r.name}: ${r.messageCount} messages`));
  
  console.log(`\n💾 Results saved to: ${resultsPath}`);
  return results;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  comprehensivePortfolioAssetDiscovery().catch(console.error);
}

export { comprehensivePortfolioAssetDiscovery };
