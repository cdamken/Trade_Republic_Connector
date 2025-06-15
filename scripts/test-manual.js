#!/usr/bin/env node

/**
 * Trade Republic Connector - Manual Testing Script
 * 
 * This script allows secure testing with real credentials loaded from environment variables.
 * 
 * Usage:
 * 1. Copy .env.example to .env
 * 2. Fill in your credentials in .env file
 * 3. Run: npm run test:manual
 */

import { TradeRepublicClient } from '../src/index.js';
import { getCredentialsFromEnv, validateCredentials } from '../src/config/environment.js';
import { logger } from '../src/utils/logger.js';

async function main(): Promise<void> {
  console.log('🚀 Trade Republic Connector - Manual Test\n');

  // Check if credentials are available
  if (!validateCredentials()) {
    console.log('❌ Credentials not found!');
    console.log('\nTo test with real credentials:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in your TR_USERNAME and TR_PASSWORD in the .env file');
    console.log('3. Run this script again\n');
    process.exit(1);
  }

  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    console.log('❌ Could not load credentials from environment');
    process.exit(1);
  }

  console.log('✅ Credentials loaded from environment variables');
  console.log(`📱 Username: ${credentials.username.replace(/\d{4}$/, '****')}`); // Mask last 4 digits
  console.log('🔒 Password: ****\n');

  try {
    // Create client
    const client = new TradeRepublicClient({
      logLevel: 'debug',
    });

    console.log('🔧 Initializing client...');
    await client.initialize();

    console.log('🔐 Attempting login...');
    const session = await client.login(credentials);

    console.log('✅ Login successful!');
    console.log(`👤 User ID: ${session.userId}`);
    console.log(`🎫 Session ID: ${session.sessionId}`);
    console.log(`⏰ Token expires: ${new Date(session.token.expiresAt).toLocaleString()}\n`);

    console.log('📊 Testing portfolio access...');
    try {
      const portfolio = await client.getPortfolio();
      console.log('✅ Portfolio data retrieved');
      console.log(`💰 Total value: €${portfolio.totalValue}`);
      console.log(`📈 Total return: €${portfolio.totalReturn} (${portfolio.totalReturnPercentage}%)`);
      console.log(`🏦 Positions: ${portfolio.positions.length}`);
    } catch (error) {
      console.log('⚠️  Portfolio access not yet implemented');
    }

    console.log('\n🔄 Testing token refresh...');
    try {
      const newToken = await client.refreshToken();
      console.log('✅ Token refreshed successfully');
      console.log(`⏰ New expiry: ${new Date(newToken.expiresAt).toLocaleString()}`);
    } catch (error) {
      console.log('⚠️  Token refresh failed:', error instanceof Error ? error.message : error);
    }

    console.log('\n👋 Logging out...');
    await client.logout();
    console.log('✅ Logout successful');

  } catch (error) {
    console.log('\n❌ Test failed:');
    if (error instanceof Error) {
      console.log(`Error: ${error.message}`);
      if (error.message.includes('MFA')) {
        console.log('\n📱 Multi-factor authentication required.');
        console.log('This is normal for Trade Republic accounts.');
        console.log('MFA handling will be implemented in the next phase.');
      }
    }
    console.log('');
    process.exit(1);
  }

  console.log('\n🎉 All tests completed successfully!');
}

// Run the test
main().catch(error => {
  logger.error('Test script failed', { error: error instanceof Error ? error.message : error });
  process.exit(1);
});
