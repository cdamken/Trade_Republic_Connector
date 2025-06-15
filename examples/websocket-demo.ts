/**
 * WebSocket Demo - Real-time data streaming
 *
 * Demonstrates WebSocket connectivity and real-time price subscriptions
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/index';
import { getCredentialsFromEnv } from '../src/config/environment';
import { logger } from '../src/utils/logger';

async function webSocketDemo(): Promise<void> {
  const client = new TradeRepublicClient({
    logLevel: 'debug',
  });

  try {
    logger.info('🚀 Starting WebSocket Demo...');

    // Initialize client
    await client.initialize();
    logger.info('✅ Client initialized');

    // Get credentials
    const credentials = getCredentialsFromEnv();
    logger.info('📱 Credentials loaded from environment');

    // Note: This demo shows the flow but would require device pairing first
    // In a real scenario, you would:
    // 1. Run device pairing (only once per device)
    // 2. Login with credentials
    // 3. Initialize WebSocket
    // 4. Subscribe to data

    logger.info('📊 WebSocket functionality available:');
    logger.info('  - Real-time price updates for any ISIN');
    logger.info('  - Portfolio value updates');
    logger.info('  - Auto-reconnection with exponential backoff');
    logger.info('  - Subscription management');

    // Show WebSocket status
    const wsStatus = client.getWebSocketStatus();
    logger.info('📡 WebSocket Status:', wsStatus);

    // Example usage (commented out as it requires authentication):
    /*
    // Initialize WebSocket connection
    await client.initializeWebSocket();
    
    // Subscribe to AAPL price updates
    const priceSubscription = client.subscribeToPrices('US0378331005', (priceUpdate) => {
      logger.info('📈 Price Update:', {
        isin: priceUpdate.payload.isin,
        price: priceUpdate.payload.price,
        currency: priceUpdate.payload.currency,
        timestamp: new Date(priceUpdate.timestamp).toISOString(),
      });
    });

    // Subscribe to portfolio updates
    const portfolioSubscription = client.subscribeToPortfolio((portfolioUpdate) => {
      logger.info('💼 Portfolio Update:', {
        totalValue: portfolioUpdate.payload.totalValue,
        dayChange: portfolioUpdate.payload.dayChange,
        dayChangePercentage: portfolioUpdate.payload.dayChangePercentage,
        timestamp: new Date(portfolioUpdate.timestamp).toISOString(),
      });
    });

    // Let it run for a while
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Cleanup
    client.unsubscribe(priceSubscription);
    client.unsubscribe(portfolioSubscription);
    client.disconnectWebSocket();
    */

    logger.info('🎯 WebSocket implementation complete!');
    logger.info('📝 To use:');
    logger.info('  1. Complete device pairing with TR app');
    logger.info('  2. Login with phone number and PIN');
    logger.info('  3. Call client.initializeWebSocket()');
    logger.info('  4. Subscribe to price/portfolio updates');

  } catch (error) {
    logger.error('❌ Demo failed:', {
      error: error instanceof Error ? error.message : error,
    });
  }
}

// Run the demo
webSocketDemo().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

export { webSocketDemo };
