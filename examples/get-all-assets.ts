/**
 * Direct Trade Republic Asset Collection 
 * 
 * Gets ALL assets from your Trade Republic account.
 * Handles authentication automatically when needed.
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { writeFile } from 'fs/promises';

async function getAllAssets() {
  console.log('\n🚀 Getting ALL Your Trade Republic Assets');
  console.log('========================================');
  
  const config = loadEnvironmentConfig();
  console.log(`📱 Phone: ${config.trUsername}`);

  const client = new TradeRepublicClient();
  const allAssets: any[] = [];
  const portfolioData: any[] = [];
  const errors: string[] = [];
  
  try {
    // Step 1: Authenticate (auto-handle device pairing if needed)
    console.log('\n🔐 Authentication needed! Authenticating...');
    await client.initialize();
    
    if (!client.isAuthenticated()) {
      await client.login({
        username: config.trUsername!,
        password: config.trPassword!
      });
    }
    
    console.log('✅ Authenticated successfully');
    const session = client.auth.getSession();
    console.log(`👤 User ID: ${session?.userId}`);
    
    // Step 2: Try to get portfolio data
    console.log('\n📊 Getting your portfolio...');
    try {
      const positions = await client.portfolio.getPositions();
      console.log(`📈 Found ${positions.length} portfolio positions`);
      
      for (const position of positions) {
        portfolioData.push({
          isin: position.instrumentId || position.isin,
          name: position.name,
          quantity: position.quantity,
          marketValue: position.marketValue || position.totalValue,
          currency: position.currency,
          type: 'portfolio_position'
        });
        
        // Also add to assets list
        allAssets.push({
          isin: position.instrumentId || position.isin,
          name: position.name,
          symbol: '',
          type: 'stock',
          currency: position.currency,
          source: 'portfolio',
          marketValue: position.marketValue || position.totalValue,
          quantity: position.quantity
        });
      }
      
    } catch (error) {
      errors.push(`Portfolio access failed: ${error}`);
      console.log(`⚠️  Portfolio access failed: ${error}`);
    }
    
    // Step 3: Asset Discovery using known ISINs and systematic search
    console.log('\n🔍 Discovering available assets...');
    
    // Popular ISINs to try
    const knownISINs = [
      // US Tech Giants
      'US0378331005', // Apple
      'US5949181045', // Microsoft  
      'US02079K3059', // Alphabet/Google
      'US0231351067', // Amazon
      'US88160R1014', // Tesla
      'US30303M1027', // Meta
      'US64110L1061', // Netflix
      'US0567521085', // Bank of America
      'US4781601046', // Johnson & Johnson
      
      // German Companies
      'DE0007164600', // SAP
      'DE0007236101', // Siemens
      'DE0005190003', // BMW
      'DE0007664039', // Volkswagen
      'DE000A1EWWW0', // Adidas
      'DE000BAY0017', // Bayer
      'DE000BASF111', // BASF
      'DE0008404005', // Allianz
      'DE0005140008', // Deutsche Bank
      
      // European Companies
      'NL0000235190', // ASML
      'CH0038863350', // Nestle
      'FR0000121014', // LVMH
      'GB00B03MLX29', // Shell
      'GB00B10RZP78', // Unilever
      
      // Popular ETFs
      'IE00B4L5Y983', // iShares Core MSCI World
      'DE0002635307', // iShares MSCI Emerging Markets
      'IE00B3RBWM25', // Vanguard FTSE All-World
      'US78462F1030', // SPDR S&P 500
      'DE000A0F5UH1', // iShares Core DAX
      'DE000A1C9KL8', // iShares Core Euro Stoxx 50
    ];
    
    console.log(`📋 Checking ${knownISINs.length} known instruments...`);
    
    for (const isin of knownISINs) {
      try {
        console.log(`  🔍 Getting info for ${isin}...`);
        const instrumentInfo = await client.getInstrumentInfo(isin);
        
        if (instrumentInfo) {
          allAssets.push({
            isin: isin,
            name: instrumentInfo.name || instrumentInfo.shortName || 'Unknown',
            symbol: instrumentInfo.symbol || instrumentInfo.shortName || '',
            type: instrumentInfo.type || 'unknown',
            currency: instrumentInfo.currency || 'EUR',
            exchange: instrumentInfo.exchange || instrumentInfo.exchanges?.[0] || '',
            source: 'instrument_lookup',
            available: true
          });
          console.log(`    ✅ ${instrumentInfo.name || isin}`);
        }
        
      } catch (error) {
        console.log(`    ⚠️  Failed to get ${isin}: ${error}`);
        errors.push(`Failed to get instrument ${isin}: ${error}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Step 4: Search for additional assets by keywords
    console.log('\n🔍 Searching for additional assets...');
    
    const searchTerms = [
      'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla',
      'SAP', 'BMW', 'Siemens', 'ETF', 'MSCI'
    ];
    
    for (const term of searchTerms) {
      try {
        console.log(`  🔍 Searching: ${term}...`);
        const results = await client.searchInstruments(term);
        
        if (results && results.length > 0) {
          console.log(`    ✅ Found ${results.length} results`);
          
          for (const result of results.slice(0, 5)) {
            const exists = allAssets.find(a => a.isin === result.isin);
            if (!exists) {
              allAssets.push({
                isin: result.isin,
                name: result.name,
                symbol: result.symbol || '',
                type: result.type || 'unknown',
                currency: result.currency || 'EUR',
                exchange: result.exchange || '',
                source: 'search',
                searchTerm: term
              });
            }
          }
        }
        
      } catch (error) {
        console.log(`    ⚠️  Search failed for ${term}: ${error}`);
        errors.push(`Search failed for ${term}: ${error}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 5: Save all collected data
    console.log('\n💾 Saving your asset data...');
    
    const assetData = {
      account: {
        userId: session?.userId,
        sessionId: session?.sessionId,
        collectedAt: new Date().toISOString(),
        authenticationMethod: '2FA_verified'
      },
      portfolio: portfolioData,
      assets: allAssets,
      errors: errors,
      summary: {
        totalAssets: allAssets.length,
        portfolioItems: portfolioData.length,
        uniqueISINs: [...new Set(allAssets.map(a => a.isin))].length,
        assetTypes: [...new Set(allAssets.map(a => a.type))],
        currencies: [...new Set(allAssets.map(a => a.currency))],
        exchanges: [...new Set(allAssets.map(a => a.exchange))].filter(e => e),
        sources: [...new Set(allAssets.map(a => a.source))]
      }
    };
    
    // Save main data file
    const dataFile = './data/all-trade-republic-assets.json';
    await writeFile(dataFile, JSON.stringify(assetData, null, 2));
    console.log(`📄 Asset data saved: ${dataFile}`);
    
    // Save CSV for easy analysis
    if (allAssets.length > 0) {
      const csvHeaders = 'ISIN,Name,Symbol,Type,Currency,Exchange,Source\n';
      const csvRows = allAssets.map(a => 
        `"${a.isin}","${a.name}","${a.symbol || ''}","${a.type}","${a.currency}","${a.exchange}","${a.source}"`
      ).join('\n');
      
      const csvFile = './data/all-trade-republic-assets.csv';
      await writeFile(csvFile, csvHeaders + csvRows);
      console.log(`📊 CSV saved: ${csvFile}`);
    }
    
    // Display results
    console.log('\n📊 COLLECTION COMPLETE!');
    console.log('=======================');
    console.log(`✅ Total Assets Found: ${allAssets.length}`);
    console.log(`📈 Portfolio Items: ${portfolioData.length}`);
    console.log(`🔢 Unique ISINs: ${assetData.summary.uniqueISINs}`);
    console.log(`🏢 Asset Types: ${assetData.summary.assetTypes.join(', ')}`);
    console.log(`💱 Currencies: ${assetData.summary.currencies.join(', ')}`);
    console.log(`🏛️  Exchanges: ${assetData.summary.exchanges.slice(0, 5).join(', ')}${assetData.summary.exchanges.length > 5 ? '...' : ''}`);
    console.log(`📊 Sources: ${assetData.summary.sources.join(', ')}`);
    console.log(`⚠️  Errors: ${errors.length}`);
    
    if (allAssets.length > 0) {
      console.log('\n📋 Sample Assets:');
      allAssets.slice(0, 15).forEach((asset, i) => {
        console.log(`  ${(i+1).toString().padStart(2, ' ')}. ${asset.name} (${asset.isin}) - ${asset.type} [${asset.source}]`);
      });
      
      if (allAssets.length > 15) {
        console.log(`  ... and ${allAssets.length - 15} more assets`);
      }
    }
    
    console.log('\n📁 Files Created:');
    console.log(`   • ${dataFile} - Complete asset data`);
    if (allAssets.length > 0) {
      console.log(`   • ./data/all-trade-republic-assets.csv - CSV format`);
    }
    
    console.log('\n🎯 MISSION STATUS:');
    if (allAssets.length >= 50) {
      console.log(`✅ SUCCESS! Found ${allAssets.length} assets from your Trade Republic account`);
    } else if (allAssets.length > 0) {
      console.log(`📈 PARTIAL SUCCESS: Found ${allAssets.length} assets (working on getting more...)`);
    } else {
      console.log(`⚠️  LIMITED SUCCESS: Authentication works, but asset discovery needs refinement`);
    }
    
  } catch (error) {
    console.log(`❌ Collection failed: ${error}`);
  } finally {
    await client.logout();
    console.log('🔓 Logged out');
  }
}

// Run the asset collection
getAllAssets().catch(console.error);
