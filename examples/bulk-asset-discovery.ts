/**
 * Next-Level Asset Discovery & Bulk Collection
 * 
 * Step 2 of mission: Scale up to discover and collect ALL 409+ assets
 * Now that WebSocket is working, let's find all available assets
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { writeFile } from 'fs/promises';

interface DiscoveredAsset {
  isin: string;
  name?: string;
  symbol?: string;
  currentPrice?: string;
  exchange?: string;
  discoveryMethod: string;
  discoveredAt: string;
  priceData?: any;
}

interface BulkCollectionResults {
  discoveredAssets: DiscoveredAsset[];
  portfolioData: any[];
  metadata: {
    totalAssetsDiscovered: number;
    validAssetsWithData: number;
    portfolioItems: number;
    discoveryStarted: string;
    discoveryCompleted: string;
    durationMs: number;
    websocketStatus: any;
  };
}

async function discoverAndCollectAllAssets() {
  console.log('\n🚀 NEXT-LEVEL ASSET DISCOVERY & BULK COLLECTION');
  console.log('===============================================');
  console.log('🎯 Mission: Discover and collect ALL 409+ Trade Republic assets');
  console.log('📡 Method: WebSocket-based discovery and real-time data collection');
  
  const startTime = Date.now();
  const config = loadEnvironmentConfig();

  const results: BulkCollectionResults = {
    discoveredAssets: [],
    portfolioData: [],
    metadata: {
      totalAssetsDiscovered: 0,
      validAssetsWithData: 0,
      portfolioItems: 0,
      discoveryStarted: new Date().toISOString(),
      discoveryCompleted: '',
      durationMs: 0,
      websocketStatus: {}
    }
  };

  try {
    console.log('\n🔐 Step 1: Authenticate & Connect');
    console.log('=================================');
    
    const client = new TradeRepublicClient();
    await client.initialize();
    
    const session = await client.login({
      username: config.trUsername!,
      password: config.trPassword!
    });
    
    console.log('✅ Authentication successful!');
    console.log(`👤 User ID: ${session.userId}`);

    console.log('\n🌐 Step 2: Initialize WebSocket');
    console.log('==============================');
    
    await client.initializeWebSocket();
    const wsStatus = client.getWebSocketStatus();
    console.log('📊 WebSocket status:', wsStatus);
    results.metadata.websocketStatus = wsStatus;

    if (!wsStatus.connected) {
      throw new Error('WebSocket connection failed');
    }

    console.log('\n📊 Step 3: Try Portfolio Discovery (Fixed)');
    console.log('==========================================');
    
    try {
      const portfolioSubId = await client.subscribeToPortfolio((data) => {
        console.log('📈 Portfolio data received:', Object.keys(data).length > 0 ? Object.keys(data) : 'Empty');
        results.portfolioData.push({
          receivedAt: new Date().toISOString(),
          data: data
        });
      });
      
      if (portfolioSubId) {
        console.log(`✅ Portfolio subscription successful: ${portfolioSubId}`);
        
        // Wait for portfolio data
        console.log('⏳ Waiting 5 seconds for portfolio data...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await client.unsubscribe(portfolioSubId);
        console.log(`📊 Portfolio items collected: ${results.portfolioData.length}`);
      }
    } catch (error) {
      console.log(`⚠️  Portfolio subscription failed: ${error}`);
      console.log('💡 Continuing with asset discovery...');
    }

    console.log('\n🔍 Step 4: Comprehensive Asset Discovery');
    console.log('=======================================');
    
    // Massive list of known ISINs from major markets
    const knownISINs = [
      // US Tech Giants (FAANG+)
      'US0378331005', // Apple Inc
      'US5949181045', // Microsoft Corp
      'US02079K3059', // Alphabet Inc (Google)
      'US0231351067', // Amazon.com Inc
      'US88160R1014', // Tesla Inc
      'US30303M1027', // Meta Platforms (Facebook)
      'US64110L1061', // Netflix Inc
      'US67066G1040', // Nvidia Corp
      'US4781601046', // Johnson & Johnson
      'US1912161007', // Coca-Cola Co
      
      // US Financial
      'US46625H1005', // JPMorgan Chase
      'US0605051046', // Bank of America
      'US9497461015', // Wells Fargo
      'US38141G1040', // Goldman Sachs
      'US6174464486', // Morgan Stanley
      'US92826C8394', // Visa Inc
      'US57636Q1040', // Mastercard Inc
      
      // German DAX 40
      'DE0007164600', // SAP SE
      'DE0007236101', // Siemens AG
      'DE0005190003', // BMW AG
      'DE0007100000', // Mercedes-Benz Group
      'DE0007664039', // Volkswagen AG
      'DE000A1EWWW0', // Adidas AG
      'DE000BAY0017', // Bayer AG
      'DE0005140008', // Deutsche Bank AG
      'DE0008404005', // Allianz SE
      'DE000BASF111', // BASF SE
      'DE0008232125', // Deutsche Lufthansa AG
      'DE0006231004', // Infineon Technologies
      'DE000A1X3543', // Airbus SE
      'DE0008469008', // Deutsche Post AG
      'DE000A0D6554', // Nordex SE
      
      // Dutch (ASML & others)
      'NL0010273215', // ASML Holding NV
      'NL0000009165', // Unilever NV
      'NL0011821202', // ASMI
      
      // Popular ETFs
      'IE00B4L5Y983', // iShares MSCI World UCITS ETF
      'DE000A0F5UH1', // iShares Core DAX UCITS ETF
      'IE00B3RBWM25', // Vanguard FTSE All-World UCITS ETF
      'LU0274208692', // Xtrackers MSCI World UCITS ETF
      'IE00B5BMR087', // iShares Core S&P 500 UCITS ETF
      'IE00B52VJ196', // iShares NASDAQ 100 UCITS ETF
      'LU0392494562', // Xtrackers NASDAQ 100 UCITS ETF
      'IE00BKM4GZ66', // iShares Core MSCI Emerging Markets UCITS ETF
      'LU0274211480', // Xtrackers MSCI Emerging Markets UCITS ETF
      
      // Additional Popular US Stocks
      'US0846707026', // Berkshire Hathaway Inc
      'US9311421039', // Walmart Inc
      'US1729674242', // Costco Wholesale Corp
      'US2441991054', // Walt Disney Co
      'US6541061031', // Nike Inc
      'US58933Y1055', // Merck & Co Inc
      'US7427181091', // Procter & Gamble Co
      'US4592001014', // Intel Corp
      'US0231351067', // Amazon.com Inc
      'US17275R1023', // Cisco Systems Inc
      'US00724F1012', // Adobe Inc
      'US79466L3024', // Salesforce Inc
      
      // European Stocks
      'NL0000235190', // Airbus SE (Netherlands listing)
      'FR0000120271', // TotalEnergies SE
      'CH0038863350', // Nestle SA
      'CH0012032048', // Roche Holding AG
      'FR0000121014', // LVMH
      'GB0009252882', // ASML (London)
      'IT0003128367', // Enel SpA
      'ES0113900J37', // Banco Santander SA
      
      // More ETFs and Index Funds
      'IE00B1XK9C88', // iShares NASDAQ 100 UCITS ETF
      'IE00B3XXRP09', // Vanguard S&P 500 UCITS ETF
      'LU0378434079', // Xtrackers EURO STOXX 50 UCITS ETF
      'DE0002635307', // iShares EURO STOXX 50 UCITS ETF
      'LU0274212538', // Xtrackers MSCI Europe UCITS ETF
    ];

    console.log(`🔄 Testing ${knownISINs.length} known ISINs for validity...`);
    
    let validAssets = 0;
    let subscriptionPromises: Promise<void>[] = [];
    
    // Process in batches to avoid overwhelming the WebSocket
    const batchSize = 5;
    for (let i = 0; i < knownISINs.length; i += batchSize) {
      const batch = knownISINs.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(knownISINs.length/batchSize)} (${batch.length} ISINs)`);
      
      for (const isin of batch) {
        const promise = testAssetValidity(client, isin, results);
        subscriptionPromises.push(promise);
      }
      
      // Wait for batch to complete
      await Promise.allSettled(subscriptionPromises);
      subscriptionPromises = [];
      
      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n⏱️  Step 5: Final Data Collection (10 seconds)');
    console.log('==============================================');
    console.log('🔄 Allowing time for all WebSocket responses...');
    
    // Wait for all data to arrive
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const currentAssets = results.discoveredAssets.length;
      if (i % 2 === 0) {
        console.log(`   ⏱️  ${i+1}s - Assets discovered: ${currentAssets}`);
      }
    }

    // Final cleanup
    console.log('\n🧹 Step 6: Cleanup & Finalize');
    console.log('=============================');
    
    results.metadata.totalAssetsDiscovered = results.discoveredAssets.length;
    results.metadata.validAssetsWithData = results.discoveredAssets.filter(a => a.priceData).length;
    results.metadata.portfolioItems = results.portfolioData.length;
    results.metadata.discoveryCompleted = new Date().toISOString();
    results.metadata.durationMs = Date.now() - startTime;

    console.log('\n💾 Step 7: Save Complete Results');
    console.log('================================');
    
    const filename = './data/bulk-asset-collection.json';
    await writeFile(filename, JSON.stringify(results, null, 2));
    
    await client.logout();

    console.log('\n🎉 BULK ASSET DISCOVERY & COLLECTION COMPLETE!');
    console.log('==============================================');
    console.log(`✅ Total assets discovered: ${results.metadata.totalAssetsDiscovered}`);
    console.log(`📊 Assets with price data: ${results.metadata.validAssetsWithData}`);
    console.log(`📈 Portfolio items: ${results.metadata.portfolioItems}`);
    console.log(`⏱️  Total time: ${Math.round(results.metadata.durationMs / 1000)}s`);
    console.log(`📁 Data saved: ${filename}`);
    
    if (results.metadata.validAssetsWithData >= 50) {
      console.log('\n🚀 MISSION SUCCESS: Major asset collection achieved!');
      console.log('💡 WebSocket protocol fully operational!');
      console.log('🎯 Ready for production-scale data collection!');
    } else if (results.metadata.validAssetsWithData >= 20) {
      console.log('\n✅ Good progress: Solid asset base established!');
      console.log('💡 Can scale up further with more ISIN discovery');
    } else {
      console.log('\n⚠️  Limited asset discovery - need investigation');
      console.log('💡 Check rate limiting and subscription handling');
    }

  } catch (error) {
    console.log(`❌ Bulk collection failed: ${error}`);
    console.log('💡 Check WebSocket connection and subscription handling');
  }
}

/**
 * Test if an asset is valid and collect its data
 */
async function testAssetValidity(client: TradeRepublicClient, isin: string, results: BulkCollectionResults): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      console.log(`  🔍 Testing: ${isin}`);
      
      const subId = await client.subscribeToPrices(isin, (data) => {
        // Asset is valid if we get price data
        const asset: DiscoveredAsset = {
          isin: isin,
          currentPrice: data.last?.price,
          exchange: 'LSX', // Default exchange used
          discoveryMethod: 'websocket_price_verification',
          discoveredAt: new Date().toISOString(),
          priceData: data
        };
        
        results.discoveredAssets.push(asset);
        console.log(`    ✅ ${isin} - Valid (Price: ${data.last?.price})`);
        resolve();
      });
      
      // Set timeout for this subscription
      setTimeout(async () => {
        if (subId) {
          try {
            await client.unsubscribe(subId);
          } catch (error) {
            // Ignore unsubscribe errors
          }
        }
        resolve();
      }, 2000);
      
    } catch (error) {
      console.log(`    ❌ ${isin} - Error: ${error}`);
      resolve();
    }
  });
}

// Run the bulk asset discovery and collection
discoverAndCollectAllAssets().catch(console.error);
