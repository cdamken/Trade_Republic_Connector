#!/usr/bin/env tsx

/**
 * Portfolio Data Collection Test
 * Using correct Trade Republic client methods
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client';
import { logger } from '../src/utils/logger';
import { loadEnvironmentConfig } from '../src/config/environment';
import { AssetDatabaseManager } from '../src/database/asset-database';
import * as fs from 'fs';
import * as path from 'path';

interface PortfolioCollectionResults {
  authentication: {
    success: boolean;
    userId?: string;
  };
  websocket: {
    connected: boolean;
    status: any;
  };
  portfolio: {
    dataReceived: boolean;
    messageCount: number;
    data?: any[];
    positions?: any[];
    totalValue?: number;
  };
  orders: {
    dataReceived: boolean;
    messageCount: number;
    data?: any[];
  };
  watchlist: {
    dataReceived: boolean;
    messageCount: number;
    data?: any[];
  };
  news: {
    dataReceived: boolean;
    messageCount: number;
    data?: any[];
  };
  priceUpdates: {
    dataReceived: boolean;
    messageCount: number;
    assets: string[];
    data?: any[];
  };
  assetDiscovery: {
    totalAssetsFound: number;
    uniqueAssets: number;
    assets: Array<{
      isin: string;
      name?: string;
      currentPrice?: number;
      source: string;
    }>;
  };
  metadata: {
    startTime: string;
    endTime: string;
    durationMs: number;
  };
}

async function collectPortfolioData() {
  console.log('\n📊 PORTFOLIO DATA COLLECTION TEST');
  console.log('=================================');
  console.log('🎯 Using correct Trade Republic client methods');
  
  const startTime = Date.now();
  const config = loadEnvironmentConfig();
  const database = new AssetDatabaseManager();

  const results: PortfolioCollectionResults = {
    authentication: { success: false },
    websocket: { connected: false, status: {} },
    portfolio: { dataReceived: false, messageCount: 0 },
    orders: { dataReceived: false, messageCount: 0 },
    watchlist: { dataReceived: false, messageCount: 0 },
    news: { dataReceived: false, messageCount: 0 },
    priceUpdates: { dataReceived: false, messageCount: 0, assets: [] },
    assetDiscovery: { totalAssetsFound: 0, uniqueAssets: 0, assets: [] },
    metadata: {
      startTime: new Date().toISOString(),
      endTime: '',
      durationMs: 0
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

    console.log('\n📈 Step 3: Portfolio Subscription');
    console.log('=================================');
    
    const portfolioData: any[] = [];
    
    try {
      const portfolioSubId = await client.subscribeToPortfolio((data) => {
        portfolioData.push(data);
        console.log(`📊 Portfolio data received: ${Object.keys(data).length} fields`);
        
        if (data.positions && Array.isArray(data.positions)) {
          console.log(`💼 Portfolio positions: ${data.positions.length}`);
          
          for (const position of data.positions) {
            if (position.instrumentId) {
              results.assetDiscovery.assets.push({
                isin: position.instrumentId,
                name: position.name || 'Unknown',
                currentPrice: position.netValue ? position.netValue / position.netSize : undefined,
                source: 'portfolio'
              });
              results.assetDiscovery.totalAssetsFound++;
            }
          }
        }
      });
      
      // Wait for portfolio data
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      results.portfolio = {
        dataReceived: portfolioData.length > 0,
        messageCount: portfolioData.length,
        data: portfolioData,
        positions: portfolioData.length > 0 ? portfolioData[0]?.positions : [],
        totalValue: portfolioData.length > 0 && portfolioData[0]?.positions ? 
          portfolioData[0].positions.reduce((sum: number, pos: any) => sum + (pos.netValue || 0), 0) : 0
      };
      
      if (portfolioSubId) {
        await client.unsubscribe(portfolioSubId);
      }
      
      if (portfolioData.length > 0) {
        console.log(`✅ Portfolio: ${portfolioData.length} messages received`);
      } else {
        console.log('⚠️ Portfolio: No data received');
      }
      
    } catch (error) {
      console.log(`❌ Portfolio subscription error: ${error}`);
    }

    console.log('\n📋 Step 4: Orders Subscription');
    console.log('=============================');
    
    const ordersData: any[] = [];
    
    try {
      const ordersSubId = await client.subscribeToOrders((data) => {
        ordersData.push(data);
        console.log(`📋 Order update received: ${data.type || 'unknown'}`);
      });
      
      // Wait for orders data
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      results.orders = {
        dataReceived: ordersData.length > 0,
        messageCount: ordersData.length,
        data: ordersData
      };
      
      if (ordersSubId) {
        await client.unsubscribe(ordersSubId);
      }
      
      if (ordersData.length > 0) {
        console.log(`✅ Orders: ${ordersData.length} messages received`);
      } else {
        console.log('⚠️ Orders: No data received');
      }
      
    } catch (error) {
      console.log(`❌ Orders subscription error: ${error}`);
    }

    console.log('\n🔖 Step 5: Watchlist Subscription');
    console.log('=================================');
    
    const watchlistData: any[] = [];
    
    try {
      const watchlistSubId = await client.subscribeToWatchlistUpdates((data) => {
        watchlistData.push(data);
        console.log(`🔖 Watchlist update received: ${data.type || 'unknown'}`);
      });
      
      // Wait for watchlist data
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      results.watchlist = {
        dataReceived: watchlistData.length > 0,
        messageCount: watchlistData.length,
        data: watchlistData
      };
      
      if (watchlistSubId) {
        await client.unsubscribe(watchlistSubId);
      }
      
      if (watchlistData.length > 0) {
        console.log(`✅ Watchlist: ${watchlistData.length} messages received`);
      } else {
        console.log('⚠️ Watchlist: No data received');
      }
      
    } catch (error) {
      console.log(`❌ Watchlist subscription error: ${error}`);
    }

    console.log('\n📰 Step 6: News Subscription');
    console.log('============================');
    
    const newsData: any[] = [];
    
    try {
      const newsSubId = await client.subscribeToNews((data) => {
        newsData.push(data);
        console.log(`📰 News received: ${data.payload?.title || 'unknown'}`);
      });
      
      // Wait for news data
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      results.news = {
        dataReceived: newsData.length > 0,
        messageCount: newsData.length,
        data: newsData
      };
      
      if (newsSubId) {
        await client.unsubscribe(newsSubId);
      }
      
      if (newsData.length > 0) {
        console.log(`✅ News: ${newsData.length} messages received`);
      } else {
        console.log('⚠️ News: No data received');
      }
      
    } catch (error) {
      console.log(`❌ News subscription error: ${error}`);
    }

    console.log('\n💰 Step 7: Price Updates for Known Assets');
    console.log('=========================================');
    
    // Test with some well-known ISINs
    const testAssets = [
      'US0378331005', // Apple
      'US5949181045', // Microsoft
      'DE0007164600', // SAP
      'US88160R1014', // Tesla
      'DE000A1EWWW0', // Adidas
    ];
    
    const priceData: any[] = [];
    
    for (const isin of testAssets) {
      try {
        console.log(`💰 Testing price subscription for: ${isin}`);
        
        const priceSubId = await client.subscribeToPrices(isin, (data) => {
          priceData.push({ isin, data });
          console.log(`💰 Price update for ${isin}: €${data.last?.price || 'N/A'}`);
          
          results.assetDiscovery.assets.push({
            isin,
            name: data.name || 'Unknown',
            currentPrice: data.last?.price,
            source: 'price_subscription'
          });
          results.assetDiscovery.totalAssetsFound++;
        });
        
        // Wait for price data
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (priceSubId) {
          await client.unsubscribe(priceSubId);
          results.priceUpdates.assets.push(isin);
        }
        
      } catch (error) {
        console.log(`⚠️ Price subscription failed for ${isin}: ${error}`);
      }
    }
    
    results.priceUpdates = {
      dataReceived: priceData.length > 0,
      messageCount: priceData.length,
      assets: testAssets,
      data: priceData
    };
    
    console.log(`📊 Price updates: ${priceData.length} received`);

    console.log('\n💾 Step 8: Store Assets in Database');
    console.log('===================================');
    
    // Store discovered assets
    if (results.assetDiscovery.assets.length > 0) {
      const uniqueAssets = new Map();
      
      for (const asset of results.assetDiscovery.assets) {
        if (!uniqueAssets.has(asset.isin)) {
          uniqueAssets.set(asset.isin, asset);
          
          database.insertAsset({
            isin: asset.isin,
            name: asset.name || 'Unknown',
            symbol: asset.name || 'Unknown',
            type: 'stock',
            market: 'LSX',
            sector: undefined,
            currency: 'EUR',
            discoveryMethod: asset.source,
            discoveredAt: new Date().toISOString(),
            verified: false,
            lastUpdated: new Date().toISOString()
          });
          
          // Store price data if available
          if (asset.currentPrice) {
            database.insertPriceData({
              isin: asset.isin,
              timestamp: Date.now(),
              price: asset.currentPrice,
              bid: undefined,
              ask: undefined,
              open: undefined,
              high: undefined,
              low: undefined,
              volume: undefined,
              currency: 'EUR',
              source: 'websocket'
            });
          }
        }
      }
      
      results.assetDiscovery.uniqueAssets = uniqueAssets.size;
      const allAssets = database.getAllAssets();
      console.log(`💾 Stored ${allAssets.length} total assets in database`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Portfolio data collection failed:', errorMessage);
    
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

  // Save results
  const resultsPath = path.join(process.cwd(), 'data/portfolio-collection-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log('\n📊 PORTFOLIO COLLECTION SUMMARY');
  console.log('===============================');
  console.log(`⏱️  Duration: ${(results.metadata.durationMs / 1000).toFixed(1)}s`);
  console.log(`🔐 Authentication: ${results.authentication.success ? '✅' : '❌'}`);
  console.log(`🌐 WebSocket: ${results.websocket.connected ? '✅' : '❌'}`);
  console.log(`📈 Portfolio data: ${results.portfolio.dataReceived ? '✅' : '❌'} (${results.portfolio.messageCount} messages)`);
  console.log(`📋 Orders data: ${results.orders.dataReceived ? '✅' : '❌'} (${results.orders.messageCount} messages)`);
  console.log(`🔖 Watchlist data: ${results.watchlist.dataReceived ? '✅' : '❌'} (${results.watchlist.messageCount} messages)`);
  console.log(`📰 News data: ${results.news.dataReceived ? '✅' : '❌'} (${results.news.messageCount} messages)`);
  console.log(`💰 Price updates: ${results.priceUpdates.dataReceived ? '✅' : '❌'} (${results.priceUpdates.messageCount} messages)`);
  console.log(`💼 Portfolio positions: ${results.portfolio.positions?.length || 0}`);
  console.log(`💰 Total portfolio value: €${results.portfolio.totalValue?.toFixed(2) || '0.00'}`);
  console.log(`🔍 Assets discovered: ${results.assetDiscovery.totalAssetsFound}`);
  console.log(`📈 Unique assets: ${results.assetDiscovery.uniqueAssets}`);
  
  console.log(`\n💾 Results saved to: ${resultsPath}`);
  return results;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectPortfolioData().catch(console.error);
}

export { collectPortfolioData };
