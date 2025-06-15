/**
 * Real Trade Republic Account Data Extractor
 * 
 * Uses your REAL credentials to extract ALL account data:
 * - Portfolio positions
 * - Trading history  
 * - Available instruments
 * - Account information
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { writeFile } from 'fs/promises';

async function extractRealAccountData() {
  console.log('\n🚀 REAL Trade Republic Account Data Extraction');
  console.log('===============================================');
  console.log('🎯 Extracting ALL real data from your account');
  
  // Load your real credentials
  const config = loadEnvironmentConfig();
  console.log(`📱 Phone: ${config.trUsername}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);
  console.log(`🌐 API: ${config.apiUrl}`);

  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Error: Missing TR_USERNAME or TR_PASSWORD in .env file');
    return;
  }

  const client = new TradeRepublicClient();
  let realData: {
    account: any;
    portfolio: any[];
    instruments: any[];
    errors: string[];
    timestamp: string;
  } = {
    account: {},
    portfolio: [],
    instruments: [],
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    // Fresh authentication with your real credentials
    console.log('\n🔐 Authenticating with your real credentials...');
    await client.initialize();
    
    if (!client.isAuthenticated()) {
      console.log('🔓 Performing fresh login...');
      const session = await client.login({
        username: config.trUsername!,
        password: config.trPassword!
      });
      
      console.log('✅ Authentication successful!');
      console.log(`👤 Your User ID: ${session.userId}`);
      console.log(`🎫 Session ID: ${session.sessionId}`);
      console.log(`⏰ Valid until: ${new Date(session.token.expiresAt).toLocaleString()}`);
      
      realData.account = {
        userId: session.userId,
        sessionId: session.sessionId,
        tokenExpiresAt: new Date(session.token.expiresAt).toISOString(),
        jurisdiction: 'DE'
      };
    }

    // Get your real portfolio data
    console.log('\n📊 Extracting your portfolio positions...');
    try {
      const positions = await client.portfolio.getPositions();
      console.log(`📈 Found ${positions.length} positions in your portfolio:`);
      
      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        const isin = position.instrumentId || position.isin || '';
        const name = position.name || 'Unknown';
        const value = position.marketValue || position.totalValue || 0;
        
        console.log(`  ${i+1}. ${name}`);
        console.log(`     📊 ISIN: ${isin}`);
        console.log(`     💰 Value: €${value.toFixed(2)}`);
        console.log(`     📦 Quantity: ${position.quantity}`);
        console.log(`     💱 Currency: ${position.currency}`);
        
        // Try to get more details for each position
        if (isin) {
          try {
            console.log(`     🔍 Getting detailed info for ${isin}...`);
            const instrumentInfo = await client.getInstrumentInfo(isin);
            (position as any).detailedInfo = instrumentInfo;
            console.log(`     ✅ Got detailed instrument info`);
          } catch (error) {
            console.log(`     ⚠️  Details unavailable: ${error}`);
            realData.errors.push(`Failed to get details for ${isin}: ${error}`);
          }
        }
        
        realData.portfolio.push(position);
        
        // Rate limiting to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`\n✅ Successfully extracted ${positions.length} portfolio positions`);
      
    } catch (error) {
      const errorMsg = `Portfolio extraction failed: ${error}`;
      console.log(`❌ ${errorMsg}`);
      realData.errors.push(errorMsg);
    }

    // Try to discover available instruments
    console.log('\n🔍 Discovering available instruments...');
    const popularSearches = [
      'Apple', 'Microsoft', 'Tesla', 'Amazon', 'Google',
      'SAP', 'Siemens', 'BMW', 'Volkswagen', 'Adidas',
      'ETF', 'MSCI World', 'S&P 500', 'DAX', 'NASDAQ'
    ];

    for (const searchTerm of popularSearches) {
      try {
        console.log(`   🔍 Searching: ${searchTerm}...`);
        const results = await client.searchInstruments(searchTerm);
        
        if (results && results.length > 0) {
          console.log(`     ✅ Found ${results.length} results`);
          realData.instruments.push(...results.slice(0, 5)); // Top 5 results
          
          // Show first result as example
          const first = results[0];
          console.log(`     📊 Example: ${first.name} (${first.isin})`);
        } else {
          console.log(`     ⚠️  No results for ${searchTerm}`);
        }
        
      } catch (error) {
        const errorMsg = `Search failed for ${searchTerm}: ${error}`;
        console.log(`     ❌ ${errorMsg}`);
        realData.errors.push(errorMsg);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save all real data to files
    console.log('\n💾 Saving your real account data...');
    
    // Save as JSON
    const jsonFile = './data/real-account-data.json';
    await writeFile(jsonFile, JSON.stringify(realData, null, 2));
    console.log(`📄 JSON data saved: ${jsonFile}`);
    
    // Save portfolio summary as CSV
    if (realData.portfolio.length > 0) {
      const csvHeaders = 'ISIN,Name,Quantity,MarketValue,Currency,UnrealizedPnL\\n';
      const csvRows = realData.portfolio.map(p => 
        `${p.instrumentId || p.isin},${(p.name || '').replace(/,/g, ';')},${p.quantity},${p.marketValue || p.totalValue || 0},${p.currency},${p.unrealizedPnL || 0}`
      ).join('\\n');
      
      const csvFile = './data/real-portfolio.csv';
      await writeFile(csvFile, csvHeaders + csvRows);
      console.log(`📊 Portfolio CSV saved: ${csvFile}`);
    }

    // Summary
    console.log('\n📊 REAL ACCOUNT DATA SUMMARY');
    console.log('============================');
    console.log(`👤 Account User ID: ${realData.account.userId || 'Unknown'}`);
    console.log(`📈 Portfolio Positions: ${realData.portfolio.length}`);
    console.log(`🔍 Discovered Instruments: ${realData.instruments.length}`);
    console.log(`⚠️  Errors: ${realData.errors.length}`);
    
    if (realData.portfolio.length > 0) {
      const totalValue = realData.portfolio.reduce((sum, p) => sum + (p.marketValue || p.totalValue || 0), 0);
      console.log(`💰 Total Portfolio Value: €${totalValue.toFixed(2)}`);
    }
    
    console.log('\n📁 Files created:');
    console.log('   • ./data/real-account-data.json - Complete account data');
    console.log('   • ./data/real-portfolio.csv - Portfolio positions (if any)');

    await client.logout();
    console.log('\n✅ Real account data extraction completed!');
    
    if (realData.portfolio.length === 0) {
      console.log('\n💡 Note: No portfolio positions found.');
      console.log('   This could mean:');
      console.log('   • Your account has no current positions');
      console.log('   • API permissions do not include portfolio access');
      console.log('   • Different API endpoints needed for portfolio data');
    }

  } catch (error) {
    console.log(`❌ Extraction failed: ${error instanceof Error ? error.message : error}`);
    realData.errors.push(error instanceof Error ? error.message : String(error));
    
    // Save error data anyway
    try {
      await writeFile('./data/real-account-data-errors.json', JSON.stringify(realData, null, 2));
      console.log('📄 Error data saved to: ./data/real-account-data-errors.json');
    } catch (saveError) {
      console.log('❌ Could not save error data:', saveError);
    }
    
    await client.logout();
  }
}

// Run the real data extraction
extractRealAccountData().catch(console.error);
