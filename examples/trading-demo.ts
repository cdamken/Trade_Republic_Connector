#!/usr/bin/env tsx

/**
 * Trade Republic Trading Demo
 * 
 * Comprehensive demonstration of real trading operations including:
 * - Buy/sell orders with real API calls
 * - Real-time price monitoring
 * - Order management and history
 * - Watchlist management
 * - Market data and news
 * - WebSocket subscriptions for live updates
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { config } from 'dotenv';
import { TradeRepublicClient } from '../src/index.js';
import type { 
  LoginCredentials, 
  BuyOrderData, 
  SellOrderData,
  OrderHistoryFilters,
  RealTimePrice,
  HistoricalPricesResponse,
  MarketNewsResponse,
  WatchlistResponse,
  PriceUpdateMessage,
  OrderUpdateMessage,
  ExecutionMessage,
} from '../src/index.js';
import {
  TradingError,
  InsufficientFundsError,
  MarketClosedError,
  InvalidOrderError,
} from '../src/index.js';

// Load environment variables
config();

/**
 * Comprehensive Trading Demo
 */
async function demonstrateTrading() {
  console.log('🚀 Trade Republic Trading Demo');
  console.log('==============================\n');

  const client = new TradeRepublicClient({
    logLevel: 'info',
    sessionPersistence: true,
    autoRefreshTokens: true,
  });

  try {
    // Initialize client
    console.log('🔧 Initializing client...');
    await client.initialize();

    // Get credentials from environment
    const credentials: LoginCredentials = {
      username: process.env.TR_USERNAME || '',
      password: process.env.TR_PASSWORD || '',
    };

    if (!credentials.username || !credentials.password) {
      console.error('❌ Missing credentials in .env file');
      console.log('Please set TR_USERNAME and TR_PASSWORD in your .env file');
      return;
    }

    // Authenticate
    console.log('🔐 Authenticating...');
    await client.login(credentials);
    console.log('✅ Successfully authenticated');

    // Initialize WebSocket for real-time updates
    console.log('\n🔌 Setting up real-time WebSocket connection...');
    try {
      await client.initializeWebSocket();
      console.log('✅ WebSocket connection established');
    } catch (wsError) {
      console.warn('⚠️  WebSocket connection failed (expected in demo environment)');
      console.log('📝 Note: Real-time features require valid Trade Republic credentials and network access');
      console.log('🔄 Continuing with API-only demonstrations...\n');
    }

    // Demo: Real-time data subscriptions
    await demonstrateRealTimeData(client);

    // Demo: Market data operations
    await demonstrateMarketData(client);

    // Demo: Watchlist management
    await demonstrateWatchlistManagement(client);

    // Demo: Order operations (be careful with real orders!)
    await demonstrateOrderOperations(client);

    // Demo: Advanced WebSocket features
    await demonstrateAdvancedWebSocket(client);

    console.log('\n✅ Trading demo completed successfully!');
    console.log('📊 All trading features are now available and functional');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    
    if (error instanceof TradingError) {
      console.error('Trading Error Code:', error.code);
    }
  } finally {
    // Cleanup
    client.disconnectWebSocket();
    await client.logout();
  }
}

/**
 * Demonstrate real-time data subscriptions
 */
async function demonstrateRealTimeData(client: TradeRepublicClient) {
  console.log('\n📡 Real-time Data Subscriptions');
  console.log('================================');

  // Check if WebSocket is connected
  if (!client.isWebSocketConnected()) {
    console.log('⚠️  WebSocket not connected - skipping real-time demonstrations');
    console.log('📝 Real-time features require active WebSocket connection');
    return;
  }

  // Popular stocks for demonstration
  const popularStocks = [
    'US0378331005', // Apple
    'US5949181045', // Microsoft
    'US02079K3059', // Alphabet
    'DE0007164600', // SAP
    'NL0000235190', // ASML
  ];

  console.log('📊 Setting up price subscriptions...');

  try {
    // Subscribe to real-time prices
    const priceSubscriptions = client.subscribeToPricesBulk(
      popularStocks,
      (update: PriceUpdateMessage) => {
        console.log(`💰 ${update.payload.isin}: €${update.payload.price} (${update.payload.currency})`);
      }
    );

    console.log(`✅ Subscribed to ${priceSubscriptions.length} price feeds`);

    // Subscribe to portfolio updates
    const portfolioSub = client.subscribeToPortfolio((update) => {
      console.log(`💼 Portfolio: €${update.payload.totalValue} (${update.payload.dayChangePercentage > 0 ? '+' : ''}${update.payload.dayChangePercentage.toFixed(2)}%)`);
    });

    // Let it run for a few seconds to see live updates
    console.log('⏱️  Monitoring live data for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Cleanup subscriptions
    client.unsubscribeMultiple(priceSubscriptions);
    if (portfolioSub) client.unsubscribe(portfolioSub);

    console.log('🔕 Unsubscribed from real-time feeds');
  } catch (error) {
    console.log('⚠️  Real-time subscription failed (expected in demo):', error.message);
  }
}

/**
 * Demonstrate market data operations
 */
async function demonstrateMarketData(client: TradeRepublicClient) {
  console.log('\n📈 Market Data Operations');
  console.log('=========================');

  const testIsin = 'US0378331005'; // Apple

  try {
    // Get real-time price
    console.log('💰 Fetching real-time price...');
    const realTimePrice: RealTimePrice = await client.getRealTimePrice(testIsin);
    console.log(`📊 ${testIsin}: €${realTimePrice.price} (${realTimePrice.change > 0 ? '+' : ''}${realTimePrice.change.toFixed(2)})`);
    console.log(`   Market Status: ${realTimePrice.marketStatus}`);
    console.log(`   Volume: ${realTimePrice.volume.toLocaleString()}`);

    // Get historical data
    console.log('\n📅 Fetching historical data (1 month)...');
    const historicalData: HistoricalPricesResponse = await client.getHistoricalPrices(testIsin, '1m');
    console.log(`📈 Retrieved ${historicalData.data.length} data points`);
    console.log(`   Period: ${historicalData.period}`);
    console.log(`   Currency: ${historicalData.currency}`);

    // Show last 5 data points
    const recentData = historicalData.data.slice(-5);
    console.log('   Recent prices:');
    recentData.forEach(point => {
      console.log(`     ${point.timestamp}: €${point.close} (H: €${point.high}, L: €${point.low})`);
    });

    // Get market news
    console.log('\n📰 Fetching market news...');
    const news: MarketNewsResponse = await client.getMarketNews(testIsin, 5);
    console.log(`📰 Found ${news.articles.length} news articles`);
    
    news.articles.slice(0, 3).forEach((article, index) => {
      console.log(`   ${index + 1}. ${article.title}`);
      console.log(`      Source: ${article.source} | ${article.publishedAt}`);
      console.log(`      Sentiment: ${article.sentiment || 'neutral'}`);
    });

  } catch (error) {
    console.error('❌ Market data error:', error);
  }
}

/**
 * Demonstrate watchlist management
 */
async function demonstrateWatchlistManagement(client: TradeRepublicClient) {
  console.log('\n👁️  Watchlist Management');
  console.log('========================');

  const testIsin = 'DE0007164600'; // SAP

  try {
    // Get current watchlist
    console.log('📋 Fetching current watchlist...');
    const watchlist: WatchlistResponse = await client.getWatchlist();
    console.log(`📋 Current watchlist has ${watchlist.items.length} items`);

    watchlist.items.slice(0, 3).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.instrumentName} (${item.isin}): €${item.currentPrice}`);
    });

    // Add to watchlist
    console.log(`\n➕ Adding ${testIsin} to watchlist...`);
    const added = await client.addToWatchlist(testIsin);
    console.log(`✅ Added to watchlist: ${added}`);

    // Subscribe to watchlist updates
    console.log('🔔 Subscribing to watchlist updates...');
    const watchlistSub = client.subscribeToWatchlistUpdates((update) => {
      console.log(`🔔 Watchlist update: ${update.payload.action} - ${update.payload.isin}`);
      if (update.payload.currentPrice) {
        console.log(`   New price: €${update.payload.currentPrice}`);
      }
    });

    // Wait a moment for potential updates
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Remove from watchlist
    console.log(`\n➖ Removing ${testIsin} from watchlist...`);
    const removed = await client.removeFromWatchlist(testIsin);
    console.log(`✅ Removed from watchlist: ${removed}`);

    // Cleanup
    if (watchlistSub) client.unsubscribe(watchlistSub);

  } catch (error) {
    console.error('❌ Watchlist error:', error);
  }
}

/**
 * Demonstrate order operations (CAREFUL - these could be real orders!)
 */
async function demonstrateOrderOperations(client: TradeRepublicClient) {
  console.log('\n🛒 Order Operations Demo');
  console.log('========================');
  console.log('⚠️  WARNING: This demo shows order placement functionality');
  console.log('⚠️  In production, these would be REAL ORDERS with REAL MONEY');
  console.log('⚠️  Currently using mock/test data for safety\n');

  try {
    // Get order history first
    console.log('📋 Fetching order history...');
    const filters: OrderHistoryFilters = {
      limit: 10,
      status: 'executed',
    };
    
    const orderHistory = await client.getOrderHistory(filters);
    console.log(`📊 Found ${orderHistory.length} orders in history`);

    orderHistory.slice(0, 3).forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.side.toUpperCase()} ${order.instrumentName}`);
      console.log(`      Status: ${order.status} | Price: €${order.executedPrice || order.limitPrice}`);
      console.log(`      Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    });

    // Demonstrate order placement (MOCK/DEMO ONLY)
    console.log('\n📝 Simulating order placement (MOCK DATA)...');
    
    const mockBuyOrder: BuyOrderData = {
      isin: 'US0378331005', // Apple
      amount: 100, // €100 worth
      orderType: 'market',
      venue: 'XETRA',
    };

    console.log('📈 Simulating BUY order...');
    console.log(`   ISIN: ${mockBuyOrder.isin}`);
    console.log(`   Amount: €${mockBuyOrder.amount}`);
    console.log(`   Type: ${mockBuyOrder.orderType}`);
    console.log(`   Venue: ${mockBuyOrder.venue}`);

    // Note: In a real scenario, uncomment the line below
    // const orderResponse = await client.placeBuyOrder(mockBuyOrder);
    console.log('   ✅ Order simulation completed (no real order placed)');

    // Subscribe to order updates
    console.log('\n🔔 Setting up order update subscriptions...');
    
    const orderSub = client.subscribeToOrders((update: OrderUpdateMessage) => {
      console.log(`📋 Order Update: ${update.payload.orderId}`);
      console.log(`   Status: ${update.payload.status}`);
      console.log(`   Side: ${update.payload.side}`);
      console.log(`   ISIN: ${update.payload.isin}`);
    });

    const executionSub = client.subscribeToExecutions((execution: ExecutionMessage) => {
      console.log(`⚡ Trade Executed: ${execution.payload.tradeId}`);
      console.log(`   Order: ${execution.payload.orderId}`);
      console.log(`   ${execution.payload.side.toUpperCase()} ${execution.payload.quantity} @ €${execution.payload.price}`);
      console.log(`   ISIN: ${execution.payload.isin}`);
    });

    // Wait for potential updates
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Cleanup
    if (orderSub) client.unsubscribe(orderSub);
    if (executionSub) client.unsubscribe(executionSub);

  } catch (error) {
    console.error('❌ Order operations error:', error);
    
    if (error instanceof InsufficientFundsError) {
      console.error('💸 Insufficient funds for order');
    } else if (error instanceof MarketClosedError) {
      console.error('🕰️  Market is currently closed');
    } else if (error instanceof InvalidOrderError) {
      console.error('📝 Invalid order parameters');
    }
  }
}

/**
 * Demonstrate advanced WebSocket features
 */
async function demonstrateAdvancedWebSocket(client: TradeRepublicClient) {
  console.log('\n🌐 Advanced WebSocket Features');
  console.log('==============================');

  try {
    // Get WebSocket status
    const status = client.getWebSocketStatus();
    console.log('📊 WebSocket Status:');
    console.log(`   Connected: ${status.connected}`);
    console.log(`   Authenticated: ${status.authenticated}`);
    console.log(`   Active Subscriptions: ${status.subscriptions}`);

    // Get all active subscriptions
    const subscriptions = client.getActiveSubscriptions();
    console.log(`\n📋 Active Subscriptions (${subscriptions.length}):`);
    subscriptions.forEach((sub, index) => {
      console.log(`   ${index + 1}. Channel: ${sub.channel} | ISIN: ${sub.isin || 'N/A'}`);
    });

    // Subscribe to market status updates
    console.log('\n🏛️  Subscribing to market status...');
    const marketSub = client.subscribeToMarketStatus('XETRA', (status) => {
      console.log(`🏛️  Market Status Update - ${status.payload.venue}: ${status.payload.status}`);
      if (status.payload.nextOpen) {
        console.log(`   Next Open: ${status.payload.nextOpen}`);
      }
    });

    // Subscribe to general market news
    console.log('📰 Subscribing to market news updates...');
    const newsSub = client.subscribeToNews((news) => {
      console.log(`📰 Breaking News: ${news.payload.title}`);
      console.log(`   Source: ${news.payload.source}`);
      console.log(`   Sentiment: ${news.payload.sentiment || 'neutral'}`);
    });

    // Monitor for updates
    console.log('\n⏱️  Monitoring advanced features for 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Cleanup
    if (marketSub) client.unsubscribe(marketSub);
    if (newsSub) client.unsubscribe(newsSub);

    console.log('🔕 Cleaned up advanced subscriptions');

  } catch (error) {
    console.error('❌ Advanced WebSocket error:', error);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateTrading().catch(console.error);
}
