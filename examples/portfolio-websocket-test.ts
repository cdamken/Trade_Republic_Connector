#!/usr/bin/env ts-node

/**
 * Portfolio WebSocket Test
 * Test portfolio subscription via WebSocket with different subscription types
 */

import { TradeRepublicClient } from '../src/api/client';
import { logger } from '../src/utils/logger';
import { loadEnvironmentConfig } from '../src/config/environment';
import * as fs from 'fs';
import * as path from 'path';

interface PortfolioTestResult {
  timestamp: string;
  subscriptionType: string;
  success: boolean;
  data?: any;
  error?: string;
}

async function testPortfolioSubscriptions() {
  logger.info('🧪 Starting Portfolio WebSocket Tests');
  
  const config = loadEnvironmentConfig();
  const client = new TradeRepublicClient();

  // Various subscription types to test for portfolio data
  const subscriptionTypes = [
    'portfolio',
    'portfolioOverview',
    'portfolioPositions', 
    'portfolioSummary',
    'account',
    'accountOverview',
    'accountSummary',
    'positions',
    'holdings',
    'balance',
    'cash',
    'instruments',
    'myInstruments',
    'watchlist',
    'orders',
    'transactions',
    'performance'
  ];

  const results: PortfolioTestResult[] = [];

  try {
    // Authenticate first
    logger.info('🔐 Authenticating...');
    
    await client.initialize();
    const session = await client.login({
      username: config.trUsername!,
      password: config.trPassword!
    });
    
    logger.info('✅ Authentication successful');
    logger.info(`👤 User ID: ${session.userId}`);

    // Connect to WebSocket
    logger.info('🔌 Connecting to WebSocket...');
    await client.initializeWebSocket();
    const wsStatus = client.getWebSocketStatus();
    
    if (!wsStatus.connected) {
      throw new Error('WebSocket connection failed');
    }
    
    logger.info('✅ WebSocket connected');

    // Test each subscription type
    for (const subscriptionType of subscriptionTypes) {
      logger.info(`\n📡 Testing subscription: ${subscriptionType}`);
      
      try {
        const result: PortfolioTestResult = {
          timestamp: new Date().toISOString(),
          subscriptionType,
          success: false
        };

        const messages: any[] = [];
        
        // Set up message handler
        const messageHandler = (data: any) => {
          messages.push(data);
          logger.info(`📨 Received message for ${subscriptionType}:`, data);
        };

        // Set up message handler and try subscription
        let subscriptionId: string | undefined = undefined;
        
        try {
          // Try to subscribe using the client's subscribe method
          if (subscriptionType === 'portfolio') {
            subscriptionId = await client.subscribeToPortfolio(messageHandler);
          } else {
            // Try generic subscription (this might not work for all types)
            logger.warn(`⚠️ Testing generic subscription for: ${subscriptionType}`);
            continue; // Skip generic subscriptions for now
          }
          
          // Wait for messages
          await new Promise(resolve => setTimeout(resolve, 3000));

          if (messages.length > 0) {
            result.success = true;
            result.data = messages;
            logger.info(`✅ ${subscriptionType}: Received ${messages.length} messages`);
          } else {
            result.success = false;
            result.error = 'No messages received';
            logger.warn(`❌ ${subscriptionType}: No messages received`);
          }
        } finally {
          // Unsubscribe if we had a subscription
          if (subscriptionId) {
            try {
              await client.unsubscribe(subscriptionId);
            } catch (error) {
              logger.warn('Failed to unsubscribe:', error);
            }
          }
        }

        results.push(result);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`❌ Error testing ${subscriptionType}:`, errorMessage);
        
        results.push({
          timestamp: new Date().toISOString(),
          subscriptionType,
          success: false,
          error: errorMessage
        });
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Portfolio WebSocket test failed:', errorMessage);
  } finally {
    client.disconnectWebSocket();
  }

  // Save results
  const resultsPath = path.join(process.cwd(), 'data/portfolio-websocket-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  logger.info('\n📊 Portfolio WebSocket Test Summary:');
  logger.info(`Total tests: ${results.length}`);
  logger.info(`Successful: ${results.filter(r => r.success).length}`);
  logger.info(`Failed: ${results.filter(r => !r.success).length}`);
  
  const successful = results.filter(r => r.success);
  if (successful.length > 0) {
    logger.info('\n✅ Working subscription types:');
    successful.forEach(r => {
      logger.info(`  - ${r.subscriptionType}: ${r.data?.length || 0} messages`);
    });
  }

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    logger.info('\n❌ Failed subscription types:');
    failed.forEach(r => {
      logger.info(`  - ${r.subscriptionType}: ${r.error}`);
    });
  }

  logger.info(`\n💾 Results saved to: ${resultsPath}`);
  return results;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPortfolioSubscriptions().catch(console.error);
}

export { testPortfolioSubscriptions };
