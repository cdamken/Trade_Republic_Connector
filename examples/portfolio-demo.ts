#!/usr/bin/env tsx

/**
 * Portfolio Management Demo
 * 
 * Demonstrates portfolio operations using the real Trade Republic API
 * with actual authentication and position data.
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { config } from 'dotenv';
import { TradeRepublicClient } from '../src/index.js';
import type { LoginCredentials } from '../src/types/auth.js';

// Load environment variables
config();

/**
 * Portfolio Management Demo
 */
async function demonstratePortfolioOperations() {
  console.log('📊 Trade Republic Portfolio Management Demo');
  console.log('=============================================\n');

  // Get credentials from environment variables
  const username = process.env.TR_USERNAME;
  const password = process.env.TR_PASSWORD;

  if (!username || !password) {
    console.error('❌ Missing credentials in .env file');
    console.error('Please set TR_USERNAME and TR_PASSWORD in your .env file');
    return;
  }

  console.log(`📱 Using phone number: ${username.replace(/(\d{4})$/, '****')}`);
  console.log(`🔑 Using PIN: ${'*'.repeat(password.length)}\n`);

  const client = new TradeRepublicClient();
  const credentials: LoginCredentials = { username, password };

  try {
    // Step 1: Initialize and authenticate
    console.log('🔍 Step 1: Initializing client and authenticating...');
    
    await client.initialize();
    
    // Check if already authenticated
    if (!client.isAuthenticated()) {
      console.log('🔓 Authenticating with existing device keys...');
      await client.initializeAuth();
      await client.login(credentials);
    } else {
      console.log('✅ Already authenticated with valid session');
    }

    // Step 2: Get portfolio summary
    console.log('\n📊 Step 2: Fetching portfolio summary...');
    try {
      const summary = await client.getPortfolioSummary();
      console.log('✅ Portfolio Summary:');
      console.log(`   💰 Total Value: ${summary.totalValue.toFixed(2)} ${summary.currency}`);
      console.log(`   📈 Total P&L: ${summary.totalPnL.toFixed(2)} ${summary.currency} (${summary.totalPnLPercent.toFixed(2)}%)`);
      console.log(`   💵 Available Cash: ${summary.availableCash.toFixed(2)} ${summary.currency}`);
      console.log(`   📦 Positions: ${summary.positionCount}`);
      console.log(`   🕐 Last Updated: ${summary.lastUpdated.toLocaleString()}\n`);
    } catch (error) {
      console.log('⚠️  Portfolio summary not available (may need mock data)');
      console.log(`   Error: ${error instanceof Error ? error.message : error}\n`);
    }

    // Step 3: Get all positions
    console.log('📊 Step 3: Fetching all portfolio positions...');
    try {
      const positions = await client.getPortfolioPositions();
      console.log(`✅ Found ${positions.length} positions:\n`);

      if (positions.length > 0) {
        positions.forEach((position, index) => {
          console.log(`   ${index + 1}. ${position.name || position.instrumentId}`);
          console.log(`      📊 ISIN: ${position.instrumentId}`);
          console.log(`      📈 Quantity: ${position.quantity}`);
          console.log(`      💰 Value: ${position.marketValue.toFixed(2)} ${position.currency}`);
          console.log(`      📊 P&L: ${position.unrealizedPnL.toFixed(2)} (${(position.unrealizedPnLPercent || 0).toFixed(2)}%)`);
          console.log('');
        });
      } else {
        console.log('   📭 No positions found in portfolio\n');
      }
    } catch (error) {
      console.log('⚠️  Positions not available (may need mock data)');
      console.log(`   Error: ${error instanceof Error ? error.message : error}\n`);
    }

    // Step 4: Get cash position
    console.log('💰 Step 4: Fetching cash position...');
    try {
      const cash = await client.getCashPosition();
      console.log('✅ Cash Position:');
      console.log(`   💵 Available: ${cash.amount.toFixed(2)} ${cash.currency}`);
      if (cash.availableForInvestment !== undefined) {
        console.log(`   📈 For Investment: ${cash.availableForInvestment.toFixed(2)} ${cash.currency}`);
      }
      if (cash.availableForPayout !== undefined) {
        console.log(`   💸 For Payout: ${cash.availableForPayout.toFixed(2)} ${cash.currency}`);
      }
      console.log('');
    } catch (error) {
      console.log('⚠️  Cash position not available (may need mock data)');
      console.log(`   Error: ${error instanceof Error ? error.message : error}\n`);
    }

    // Step 5: Search for instruments
    console.log('🔍 Step 5: Searching for popular instruments...');
    const searchQueries = ['Apple', 'Tesla', 'MSCI World'];
    
    for (const query of searchQueries) {
      try {
        console.log(`   Searching for "${query}"...`);
        const results = await client.searchInstruments(query);
        
        if (results.length > 0) {
          console.log(`   ✅ Found ${results.length} results:`);
          results.slice(0, 3).forEach(result => {
            console.log(`      • ${result.name} (${result.isin}) - ${result.type.toUpperCase()}`);
          });
        } else {
          console.log(`   📭 No results found for "${query}"`);
        }
      } catch (error) {
        console.log(`   ⚠️  Search failed for "${query}": ${error instanceof Error ? error.message : error}`);
      }
      console.log('');
    }

    // Step 6: Get portfolio performance
    console.log('📈 Step 6: Fetching portfolio performance...');
    try {
      const performance = await client.getPortfolioPerformance('1M');
      console.log('✅ 1-Month Performance:');
      console.log(`   📊 Absolute Change: ${performance.absoluteChange.toFixed(2)}`);
      console.log(`   📈 Percent Change: ${performance.percentChange.toFixed(2)}%`);
      console.log(`   📅 Data Points: ${performance.data.length}`);
      console.log('');
    } catch (error) {
      console.log('⚠️  Performance data not available (may need mock data)');
      console.log(`   Error: ${error instanceof Error ? error.message : error}\n`);
    }

    // Step 7: Analyze positions
    console.log('🔍 Step 7: Analyzing portfolio positions...');
    try {
      const winningPositions = await client.getWinningPositions();
      const losingPositions = await client.getLosingPositions();
      
      console.log(`✅ Portfolio Analysis:`);
      console.log(`   📈 Winning Positions: ${winningPositions.length}`);
      console.log(`   📉 Losing Positions: ${losingPositions.length}`);
      
      if (winningPositions.length > 0) {
        console.log('   🏆 Top Winners:');
        winningPositions.slice(0, 3).forEach(pos => {
          console.log(`      • ${pos.name || pos.instrumentId}: +${pos.unrealizedPnL.toFixed(2)} (+${(pos.unrealizedPnLPercent || 0).toFixed(2)}%)`);
        });
      }
      
      if (losingPositions.length > 0) {
        console.log('   📉 Top Losers:');
        losingPositions.slice(0, 3).forEach(pos => {
          console.log(`      • ${pos.name || pos.instrumentId}: ${pos.unrealizedPnL.toFixed(2)} (${(pos.unrealizedPnLPercent || 0).toFixed(2)}%)`);
        });
      }
      console.log('');
    } catch (error) {
      console.log('⚠️  Position analysis not available (may need mock data)');
      console.log(`   Error: ${error instanceof Error ? error.message : error}\n`);
    }

    console.log('🎉 Portfolio demo completed successfully!');
    console.log('💡 Note: Some data may be mocked if the real API endpoints are not available yet.');

  } catch (error) {
    console.error('\n❌ Portfolio demo failed:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('Device not paired')) {
      console.error('💡 Please run the authentication demo first: npm run demo:real-auth');
    } else if (error instanceof Error && error.message.includes('Session expired')) {
      console.error('💡 Your session has expired. Please run: npm run demo:real-auth');
    } else {
      console.error('💡 This may be expected as we\'re still implementing the real portfolio API endpoints');
    }
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstratePortfolioOperations().catch(console.error);
}

export { demonstratePortfolioOperations };
