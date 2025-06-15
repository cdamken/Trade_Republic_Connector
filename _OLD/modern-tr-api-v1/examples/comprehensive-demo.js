/**
 * 🚀 Modern Trade Republic API - Complete Example
 *
 * This example demonstrates how to use the new, simple, and scalable
 * Trade Republic API to efficiently handle 400+ assets.
 */
import { createTRClient, TRWebSocketManager, TRPortfolio, TRMarketData } from '../src/modern-index.js';
// Example: Portfolio analysis for 400+ ETFs
async function portfolioAnalysisExample() {
    console.log('🚀 Starting Modern TR API Demo - Portfolio Analysis for 400+ Assets');
    // Step 1: Create client
    const tr = createTRClient('+4917681033982', '1704', 'de');
    // Step 2: Set up WebSocket and modules
    const wsManager = new TRWebSocketManager(tr.config);
    const portfolio = new TRPortfolio(wsManager);
    const market = new TRMarketData(wsManager);
    try {
        // Step 3: Authenticate (device pairing - only needed once)
        console.log('📱 Authenticating...');
        if (!tr.auth.isAuthenticated) {
            // First time setup - will guide through SMS verification
            await tr.auth.pair();
        }
        // Get session token
        const sessionToken = await tr.auth.getSessionToken();
        console.log('✅ Authentication successful');
        // Step 4: Connect WebSocket
        console.log('🔌 Connecting WebSocket...');
        await wsManager.connect(sessionToken);
        console.log('✅ WebSocket connected');
        // Step 5: Initialize portfolio
        console.log('💼 Loading portfolio...');
        await portfolio.initialize();
        const positions = await portfolio.getPositions();
        const summary = await portfolio.getSummary();
        console.log(`📊 Portfolio loaded: ${positions.length} positions, Total: €${summary?.totalValue.toFixed(2)}`);
        // Step 6: Get list of 400+ popular ETFs/assets for analysis
        const popularETFs = [
            'IE00B4L5Y983', // iShares Core MSCI World UCITS ETF USD (Acc)
            'LU0274208692', // Xtrackers MSCI World UCITS ETF 1C
            'IE00B3RBWM25', // Vanguard FTSE All-World UCITS ETF USD Dist
            'IE00BK5BQT80', // Vanguard FTSE All-World UCITS ETF USD Acc
            'LU0629459743', // UBS ETF - MSCI USA UCITS ETF (USD) A-dis
            'IE00B1XNHC34', // iShares Core S&P 500 UCITS ETF USD (Acc)
            // ... would continue with 400+ ISINs in real usage
        ];
        console.log(`🔍 Analyzing ${popularETFs.length} popular ETFs...`);
        // Step 7: Subscribe to real-time data for all ETFs (efficient batch operation)
        console.log('📡 Subscribing to real-time price updates...');
        await market.subscribeToPriceUpdates(popularETFs, 'LSX');
        // Step 8: Get instrument details for all ETFs
        console.log('📋 Fetching instrument details...');
        const instruments = await market.getInstruments(popularETFs);
        console.log(`✅ Retrieved details for ${instruments.size} instruments`);
        // Step 9: Get current prices for all ETFs
        console.log('💰 Fetching current prices...');
        const prices = await market.getPrices(popularETFs, 'LSX');
        console.log(`✅ Retrieved prices for ${prices.size} instruments`);
        // Step 10: Real-time price monitoring
        console.log('👀 Starting real-time monitoring...');
        let updateCount = 0;
        market.on('priceUpdated', (priceData) => {
            updateCount++;
            console.log(`💱 Price Update #${updateCount}: ${priceData.isin} = €${priceData.price.toFixed(4)} (${priceData.change > 0 ? '+' : ''}${priceData.changePercent?.toFixed(2)}%)`);
            // In a real application, you might:
            // - Store in database
            // - Update portfolio calculations
            // - Trigger alerts/notifications
            // - Update UI in real-time
        });
        // Step 11: Portfolio position updates
        portfolio.on('positionUpdated', (position) => {
            console.log(`📈 Position Update: ${position.name || position.instrumentId} = €${position.marketValue.toFixed(2)} (P&L: €${position.unrealizedPnL.toFixed(2)})`);
        });
        // Step 12: Demonstrate search functionality
        console.log('🔎 Searching for Apple...');
        const searchResults = await market.search('Apple', 'stock', 5);
        searchResults.forEach(result => {
            console.log(`  📱 ${result.name} (${result.isin}) - ${result.exchange}`);
        });
        // Step 13: Get historical data example
        if (popularETFs.length > 0) {
            console.log('📊 Getting historical data for first ETF...');
            const firstETF = popularETFs[0];
            if (firstETF) {
                const historical = await market.getHistoricalData(firstETF, '1M', 86400000); // 1 day resolution
                console.log(`  📈 Historical data: ${historical.data.length} data points`);
            }
        }
        // Step 14: Performance analysis
        console.log('📈 Portfolio Performance Analysis:');
        const winningPositions = await portfolio.getWinningPositions();
        const losingPositions = await portfolio.getLosingPositions();
        console.log(`  🟢 Winning positions: ${winningPositions.length}`);
        console.log(`  🔴 Losing positions: ${losingPositions.length}`);
        const totalPnL = summary?.totalPnL || 0;
        console.log(`  💰 Total P&L: €${totalPnL.toFixed(2)} (${summary?.totalPnLPercent.toFixed(2)}%)`);
        // Step 15: Get status information
        const status = {
            wsConnected: wsManager.connected,
            portfolioReady: portfolio.isReady,
            activeSubscriptions: wsManager.subscriptionCount,
            cachedInstruments: market.instrumentCount,
            activePriceFeeds: market.activePriceSubscriptions
        };
        console.log('📊 System Status:', status);
        // Keep running for demonstration (in real app, this would run continuously)
        console.log('⏰ Running for 30 seconds to show real-time updates...');
        await new Promise(resolve => setTimeout(resolve, 30000));
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        // Step 16: Cleanup
        console.log('🧹 Cleaning up...');
        await market.dispose();
        await portfolio.dispose();
        await wsManager.close();
        console.log('✅ Cleanup complete');
    }
}
// Example: Market scanning for opportunities
async function marketScanningExample() {
    console.log('🔍 Market Scanning Example');
    const tr = createTRClient('+4917681033982', '1704');
    const wsManager = new TRWebSocketManager(tr.config);
    const market = new TRMarketData(wsManager);
    try {
        // Connect
        const sessionToken = await tr.auth.getSessionToken();
        await wsManager.connect(sessionToken);
        // Search for tech stocks
        const techStocks = await market.search('technology', 'stock', 50);
        console.log(`Found ${techStocks.length} tech stocks`);
        // Get prices for all tech stocks
        const techISINs = techStocks.map(stock => stock.isin);
        const prices = await market.getPrices(techISINs.slice(0, 20)); // Limit to 20 for demo
        // Find stocks with significant moves
        const significantMoves = Array.from(prices.values())
            .filter(price => Math.abs(price.changePercent || 0) > 2)
            .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0));
        console.log('📊 Stocks with >2% moves:');
        significantMoves.forEach(price => {
            const direction = (price.changePercent || 0) > 0 ? '📈' : '📉';
            console.log(`  ${direction} ${price.isin}: ${(price.changePercent || 0).toFixed(2)}%`);
        });
    }
    finally {
        await market.dispose();
        await wsManager.close();
    }
}
// Export examples for use
export { portfolioAnalysisExample, marketScanningExample };
// Run main example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    portfolioAnalysisExample()
        .then(() => console.log('🎉 Demo completed successfully'))
        .catch(error => console.error('❌ Demo failed:', error));
}
//# sourceMappingURL=comprehensive-demo.js.map