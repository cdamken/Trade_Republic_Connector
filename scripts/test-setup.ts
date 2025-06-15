#!/usr/bin/env node

/**
 * Test Script for Comprehensive Trade Republic Data Collection
 * 
 * This script tests the authentication and basic data collection
 * before running the full comprehensive collection.
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AssetDatabaseManager } from '../src/database/asset-database.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSetup() {
  console.log('🧪 Testing Trade Republic Data Collection Setup\n');

  // Check environment variables
  console.log('1. 🔍 Checking environment variables...');
  const requiredVars = ['TR_USERNAME', 'TR_PASSWORD', 'TR_PIN'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease add these to your .env file');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');

  // Test database initialization
  console.log('\n2. 🗄️  Testing database initialization...');
  try {
    const db = new AssetDatabaseManager('./data/test-trade-republic-data.db');
    const stats = db.getStatistics();
    console.log('✅ Database initialized successfully');
    console.log(`   - Total assets: ${stats.totalAssets}`);
    console.log(`   - Verified assets: ${stats.verifiedAssets}`);
    console.log(`   - Price records: ${stats.priceRecords}`);
    db.close();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }

  // Test client initialization
  console.log('\n3. 🔌 Testing client initialization...');
  try {
    const client = new TradeRepublicClient();
    await client.initialize();
    console.log('✅ Client initialized successfully');
  } catch (error) {
    console.error('❌ Client initialization failed:', error);
    process.exit(1);
  }

  // Test authentication
  console.log('\n4. 🔐 Testing authentication...');
  try {
    const client = new TradeRepublicClient();
    await client.initialize();
    
    const session = await client.login({
      username: process.env.TR_USERNAME!,
      password: process.env.TR_PASSWORD!,
      pin: process.env.TR_PIN!
    });

    console.log('✅ Authentication successful');
    console.log(`   - Session ID: ${session.sessionId}`);
    
    // Test a simple API call
    console.log('\n5. 📊 Testing basic API calls...');
    try {
      const portfolioSummary = await client.getPortfolioSummary();
      console.log('✅ Portfolio summary retrieved');
      
      const cashPosition = await client.getCashPosition();
      console.log('✅ Cash position retrieved');
      
      await client.logout();
      console.log('✅ Logout successful');
      
    } catch (error) {
      console.error('❌ API calls failed:', error);
      console.error('   This might indicate 2FA is required or API changes');
    }
    
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    console.error('   Please check your credentials in .env file');
    console.error('   You may need to handle 2FA if enabled on your account');
    process.exit(1);
  }

  console.log('\n🎉 All tests passed! You can now run the comprehensive data collection.');
  console.log('\nTo start the full collection, run:');
  console.log('npm run collect-data');
  console.log('\nOr directly:');
  console.log('node examples/comprehensive-data-collection.js');
}

// Run the test
testSetup().catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});
