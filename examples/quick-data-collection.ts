/**
 * Simple Data Collection Example
 * 
 * This example shows how to quickly collect your most important Trade Republic data
 * without running the full comprehensive collection.
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AssetDatabaseManager } from '../src/database/asset-database.js';
import type { Asset, PriceData } from '../src/database/asset-database.js';
import * as dotenv from 'dotenv';
import { writeFile } from 'fs/promises';

dotenv.config();

async function quickDataCollection() {
  console.log('⚡ Quick Trade Republic Data Collection\n');

  // Initialize client and database
  const client = new TradeRepublicClient();
  const db = new AssetDatabaseManager('./data/quick-collection.db');

  try {
    // Step 1: Authenticate
    console.log('🔐 Authenticating...');
    await client.initialize();
    await client.login({
      username: process.env.TR_USERNAME!,
      password: process.env.TR_PASSWORD!,
      pin: process.env.TR_PIN!
    });
    console.log('✅ Authenticated successfully');

    // Step 2: Get portfolio summary
    console.log('\n💼 Getting portfolio overview...');
    const portfolioSummary = await client.getPortfolioSummary();
    const cashPosition = await client.getCashPosition();
    
    console.log(`💰 Portfolio Value: ${portfolioSummary?.totalValue || 'N/A'}`);
    console.log(`💵 Cash Balance: ${cashPosition?.amount || 'N/A'} ${cashPosition?.currency || 'EUR'}`);

    // Step 3: Get your positions  
    console.log('\n📊 Getting positions...');
    const positions = await client.getPortfolioPositions();
    
    if (positions && Array.isArray(positions)) {
      console.log(`📈 Found ${positions.length} positions`);
      
      const results: any[] = [];
      
      for (const position of positions.slice(0, 5)) { // Limit to first 5 for demo
        try {
          // Get current price
          const price = await client.getRealTimePrice(position.isin);
          
          // Store in database
          if (price) {
            const priceData: PriceData = {
              isin: position.isin,
              timestamp: Date.now(),
              price: price.price || 0,
              currency: price.currency || 'EUR',
              source: 'realtime'
            };
            db.insertPriceData(priceData);
          }

          const asset: Asset = {
            isin: position.isin,
            name: position.name,
            symbol: position.symbol,
            type: 'stock', // Simplified for demo
            market: 'UNKNOWN',
            currency: price?.currency || 'EUR',
            discoveryMethod: 'portfolio',
            discoveredAt: new Date().toISOString(),
            verified: true,
            lastUpdated: new Date().toISOString()
          };
          db.insertAsset(asset);

          results.push({
            isin: position.isin,
            name: position.name,
            currentPrice: price?.price,
            currency: price?.currency,
            quantity: position.quantity,
            value: position.value
          });

          console.log(`   💎 ${position.name}: ${price?.price} ${price?.currency}`);
          
        } catch (error) {
          console.error(`   ❌ Error processing ${position.isin}:`, error.message);
        }
      }

      // Export results
      await writeFile('./data/quick-collection-results.json', 
        JSON.stringify({
          collectedAt: new Date().toISOString(),
          portfolioSummary,
          cashPosition,
          positions: results,
          stats: db.getStatistics()
        }, null, 2));

      console.log('\n✅ Quick collection complete!');
      console.log('📄 Results saved to: quick-collection-results.json');
      console.log('🗄️  Database saved to: quick-collection.db');
    }

    // Step 4: Get watchlist (optional)
    console.log('\n👀 Getting watchlist...');
    try {
      const watchlist = await client.getWatchlist();
      if (watchlist?.items) {
        console.log(`📋 Watchlist has ${watchlist.items.length} items`);
      }
    } catch (error) {
      console.log('ℹ️  Watchlist not available or empty');
    }

    await client.logout();
    console.log('\n🎉 Done! Your key Trade Republic data has been collected.');

  } catch (error) {
    console.error('❌ Collection failed:', error);
  } finally {
    db.close();
  }
}

// Run if called directly
// Run if called directly
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('quick-data-collection.js')) {
  quickDataCollection().catch(console.error);
}

export { quickDataCollection };
