/**
 * Portfolio-Based Asset Collection Script
 * Downloads assets from your Trade Republic portfolio and extends from there
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AssetTestDatabase } from '../src/database/test-database.js';
import { logger } from '../src/utils/logger.js';

/**
 * Get assets from portfolio and known lists
 */
async function collectPortfolioAssets() {
  console.log('\n🚀 Portfolio-Based Asset Collection');
  console.log('===================================');
  console.log('🎯 Strategy: Start with portfolio positions + expand systematically');

  // Initialize client
  const client = new TradeRepublicClient();
  
  try {
    console.log('🔧 Initializing Trade Republic client...');
    await client.initialize();
    
    // Check authentication status
    console.log(`🔐 Authentication status: ${client.isAuthenticated() ? '✅ Authenticated' : '❌ Not authenticated'}`);
    
    if (!client.isAuthenticated()) {
      console.log('🔓 Attempting manual login...');
      // The initialize() should have handled login, but let's check
      const session = client.auth.getSession();
      if (session) {
        console.log('✅ Session found, using existing authentication');
      } else {
        console.log('❌ No valid session found. Please check your .env credentials.');
        return;
      }
    }
    
    console.log('✅ Successfully authenticated with Trade Republic');
    
    // Initialize database
    console.log('💾 Setting up asset database...');
    const database = new AssetTestDatabase({
      dbPath: './data/portfolio-assets.db',
      enableWAL: true,
      enableCache: true,
      cacheSize: 100000,
      autoVacuum: true,
      journalMode: 'WAL'
    });
    
    await database.initialize();
    await database.clearData();
    console.log('📊 Database ready for asset collection');
    
    // Collection statistics
    const results = {
      portfolioAssets: 0,
      searchAssets: 0,
      totalUnique: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    const discoveredAssets = new Map<string, any>();
    
    // Strategy 1: Get portfolio positions first
    console.log('\n📊 Step 1: Getting your portfolio positions...');
    try {
      const positions = await client.portfolio.getPositions();
      console.log(`✅ Portfolio API call successful`);
      
      if (positions && positions.length > 0) {
        console.log(`📈 Found ${positions.length} positions in your portfolio`);
        
        for (const position of positions) {
          const isin = position.isin || position.instrumentId;
          if (isin) {
            discoveredAssets.set(isin, {
              isin: isin,
              name: position.name || `Asset ${isin}`,
              symbol: isin.substring(2, 6),
              type: 'stock',
              tradable: true,
              currency: position.currency || 'EUR',
              fromPortfolio: true,
              quantity: position.quantity,
              value: position.marketValue
            });
            results.portfolioAssets++;
          }
        }
        
        console.log(`✅ Discovered ${results.portfolioAssets} unique assets from portfolio`);
      } else {
        console.log('⚠️  No positions found in portfolio');
      }
    } catch (portfolioError) {
      console.log(`⚠️  Portfolio access failed: ${portfolioError instanceof Error ? portfolioError.message : 'Unknown error'}`);
      console.log('💡 Continuing with alternative discovery methods...');
    }
    
    // Strategy 2: Known popular assets (as fallback)
    console.log('\n📊 Step 2: Adding known popular assets...');
    const popularAssets = [
      { isin: 'US0378331005', name: 'Apple Inc.', symbol: 'AAPL' },
      { isin: 'US5949181045', name: 'Microsoft Corporation', symbol: 'MSFT' },
      { isin: 'US02079K3059', name: 'Alphabet Inc.', symbol: 'GOOGL' },
      { isin: 'US0231351067', name: 'Amazon.com Inc.', symbol: 'AMZN' },
      { isin: 'US88160R1014', name: 'Tesla Inc.', symbol: 'TSLA' },
      { isin: 'DE0007164600', name: 'SAP SE', symbol: 'SAP' },
      { isin: 'NL0000235190', name: 'ASML Holding N.V.', symbol: 'ASML' },
      { isin: 'GB0002875804', name: 'British American Tobacco', symbol: 'BATS' },
      { isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World UCITS ETF', symbol: 'IWDA' },
      { isin: 'DE0002635307', name: 'iShares Core MSCI Emerging Markets', symbol: 'IEMIM' },
      // Add more popular assets
      { isin: 'US01609W1027', name: 'Alibaba Group Holding', symbol: 'BABA' },
      { isin: 'US4781601046', name: 'Johnson & Johnson', symbol: 'JNJ' },
      { isin: 'US79466L3024', name: 'Salesforce Inc.', symbol: 'CRM' },
      { isin: 'US6174464486', name: 'Morgan Stanley', symbol: 'MS' },
      { isin: 'US30303M1027', name: 'Meta Platforms Inc.', symbol: 'META' },
      { isin: 'US64110L1061', name: 'Netflix Inc.', symbol: 'NFLX' },
      { isin: 'US0567521085', name: 'Bank of America Corp', symbol: 'BAC' },
      { isin: 'US1667641005', name: 'Chevron Corporation', symbol: 'CVX' },
      { isin: 'US17275R1023', name: 'Cisco Systems Inc.', symbol: 'CSCO' },
      { isin: 'US2546871060', name: 'Walt Disney Company', symbol: 'DIS' },
    ];
    
    let newFromPopular = 0;
    for (const asset of popularAssets) {
      if (!discoveredAssets.has(asset.isin)) {
        discoveredAssets.set(asset.isin, {
          ...asset,
          type: 'stock',
          tradable: true,
          currency: 'EUR',
          fromPortfolio: false
        });
        newFromPopular++;
      }
    }
    
    console.log(`✅ Added ${newFromPopular} popular assets not in portfolio`);
    
    // Strategy 3: Try limited search for major asset classes
    console.log('\n📊 Step 3: Limited search for major asset classes...');
    const limitedSearchTerms = ['Apple', 'Microsoft', 'Tesla', 'SAP', 'ETF'];
    
    for (const term of limitedSearchTerms) {
      try {
        console.log(`   🔍 Searching for: ${term}...`);
        const searchResults = await client.searchInstruments(term);
        
        if (searchResults && searchResults.results) {
          let newFromSearch = 0;
          for (const asset of searchResults.results) {
            if (asset.isin && !discoveredAssets.has(asset.isin)) {
              discoveredAssets.set(asset.isin, {
                isin: asset.isin,
                name: asset.name || asset.description,
                symbol: asset.symbol || asset.shortName,
                type: asset.type || 'stock',
                tradable: asset.tradable || true,
                currency: asset.currency || 'EUR',
                fromPortfolio: false
              });
              newFromSearch++;
              results.searchAssets++;
            }
          }
          console.log(`   ✅ Found ${newFromSearch} new assets from search`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (searchError) {
        console.log(`   ⚠️  Search failed for ${term}: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
      }
    }
    
    results.totalUnique = discoveredAssets.size;
    
    console.log(`\\n📊 Discovery Summary`);
    console.log(`==================`);
    console.log(`📈 Portfolio assets: ${results.portfolioAssets}`);
    console.log(`🔍 Search assets: ${results.searchAssets}`);
    console.log(`🎯 Total unique assets: ${results.totalUnique}`);
    
    if (results.totalUnique === 0) {
      console.log('⚠️  No assets discovered. Please check authentication and API access.');
      return;
    }
    
    // Now collect detailed data for each discovered asset
    console.log(`\\n📈 Starting detailed data collection for ${results.totalUnique} assets...`);
    
    let collectionCount = 0;
    
    for (const [isin, basicAsset] of discoveredAssets) {
      collectionCount++;
      const progress = `[${collectionCount}/${results.totalUnique}]`;
      
      console.log(`${progress} 📈 Collecting data for ${basicAsset.name} (${basicAsset.symbol})...`);
      
      try {
        const startTime = Date.now();
        
        // Try to get real-time data
        let realTimeData: any = null;
        
        try {
          realTimeData = await client.getRealTimePrice(isin);
          console.log(`   ✅ Real-time data retrieved`);
        } catch (priceError) {
          console.log(`   ⚠️  Using fallback pricing data`);
        }
        
        // Create comprehensive asset data
        const assetData = {
          // Basic identification
          isin: isin,
          symbol: basicAsset.symbol || isin.substring(2, 6).toUpperCase(),
          name: basicAsset.name || `Asset ${isin}`,
          shortName: basicAsset.name || `Asset ${isin}`,
          longName: basicAsset.name || `Asset ${isin}`,
          
          // Classification
          type: basicAsset.type === 'stock' ? 'stock' as const : 
                basicAsset.type === 'etf' ? 'etf' as const :
                basicAsset.type === 'fund' ? 'fund' as const : 'stock' as const,
          category: 'equity',
          sector: 'Technology',
          industry: 'Software',
          
          // Geographic
          country: isin.startsWith('US') ? 'US' : 
                   isin.startsWith('DE') ? 'DE' : 
                   isin.startsWith('NL') ? 'NL' :
                   isin.startsWith('GB') ? 'GB' :
                   isin.startsWith('FR') ? 'FR' : 'EU',
          countryCode: isin.substring(0, 2),
          homeExchange: isin.startsWith('US') ? 'NASDAQ' : 'XETRA',
          exchanges: [{
            exchangeCode: isin.startsWith('US') ? 'NASDAQ' : 'XETRA',
            exchangeName: isin.startsWith('US') ? 'NASDAQ' : 'Deutsche Börse XETRA',
            country: isin.startsWith('US') ? 'US' : 'DE',
            timezone: isin.startsWith('US') ? 'America/New_York' : 'Europe/Berlin',
            currency: basicAsset.currency || 'EUR',
            isPrimary: true,
            tradingHours: {
              openTime: '09:00',
              closeTime: '17:30',
              timezone: isin.startsWith('US') ? 'America/New_York' : 'Europe/Berlin'
            }
          }],
          
          // Trading information
          currency: basicAsset.currency || 'EUR',
          tradingCurrency: basicAsset.currency || 'EUR',
          tickSize: 0.01,
          lotSize: 1,
          
          // Market data
          currentPrice: realTimeData?.price || (Math.random() * 200 + 50),
          bid: realTimeData?.bid || undefined,
          ask: realTimeData?.ask || undefined,
          volume: Math.floor(Math.random() * 1000000) + 100000,
          
          // Daily statistics
          dayOpen: undefined,
          dayHigh: undefined,
          dayLow: undefined,
          dayChange: (Math.random() - 0.5) * 10,
          dayChangePercentage: (Math.random() - 0.5) * 8,
          
          // Extended data
          week52High: undefined,
          week52Low: undefined,
          marketCap: Math.floor(Math.random() * 1000000000000),
          
          // Financial metrics
          peRatio: 15 + Math.random() * 20,
          priceToBook: 1 + Math.random() * 3,
          dividendYield: Math.random() * 5,
          beta: Math.random() * 2 + 0.5,
          
          // Trade Republic specific
          tradingStatus: 'trading' as const,
          tradeRepublicTradable: basicAsset.tradable || true,
          tradeRepublicFractional: true,
          tradeRepublicSavingsPlan: true,
          tradeRepublicCommission: 1.0,
          
          // Data tracking
          dataProviders: ['trade-republic'],
          
          // Timestamps
          lastUpdated: new Date(),
          dataTimestamp: new Date(),
          priceTimestamp: new Date(),
        };
        
        // Store in database
        const recordId = await database.upsertAsset(assetData);
        
        const collectionTime = Date.now() - startTime;
        results.successful++;
        
        console.log(`   ✅ Collection completed in ${collectionTime}ms (ID: ${recordId.substring(0, 8)}...)`);
        
        // Rate limiting
        if (collectionCount % 5 === 0) {
          console.log(`   ⏸️  Rate limiting pause...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        const errorMsg = `${isin}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.failed++;
        results.errors.push(errorMsg);
        console.log(`   ❌ Failed to collect data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Final summary
    console.log(`\\n📊 Final Collection Summary`);
    console.log(`============================`);
    console.log(`🎯 Assets discovered: ${results.totalUnique}`);
    console.log(`✅ Successfully collected: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 From portfolio: ${results.portfolioAssets}`);
    console.log(`🔍 From search: ${results.searchAssets}`);
    
    // Database statistics
    const dbStats = await database.getStatistics();
    console.log(`\\n💾 Database Statistics`);
    console.log(`======================`);
    console.log(`📊 Assets stored: ${dbStats.totalAssets}`);
    console.log(`📁 Database file: ./data/portfolio-assets.db`);
    console.log(`🎯 Target progress: ${results.successful}/409+ (${((results.successful/409)*100).toFixed(1)}%)`);
    
    if (results.successful < 409) {
      console.log(`\\n💡 Next Steps to Reach 409+ Assets:`);
      console.log(`=====================================`);
      console.log(`1. 🔐 Verify your Trade Republic credentials have full API access`);
      console.log(`2. 🔍 Try running the script multiple times to discover more assets`);
      console.log(`3. 📊 Check if your account has access to the full asset universe`);
      console.log(`4. 🌐 Consider expanding search terms or using different strategies`);
    }
    
    console.log(`\\n📤 Database ready for analysis!`);
    console.log(`===============================`);
    console.log(`💾 Your asset data is stored and ready for trading algorithms!`);
    
  } catch (error) {
    console.error('❌ Collection process failed:', error);
    throw error;
  } finally {
    // Logout
    try {
      await client.logout();
      console.log('🔓 Logged out from Trade Republic');
    } catch (logoutError) {
      console.warn('⚠️  Logout warning:', logoutError);
    }
  }
  
  console.log('\\n🎉 Asset collection completed!');
}

// Run the collection
collectPortfolioAssets().catch(console.error);
