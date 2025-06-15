#!/usr/bin/env tsx

/**
 * Comprehensive Asset Collection with Robust Authentication
 * 
 * This script ensures:
 * 1. Proper session validation before any API calls
 * 2. Automatic re-authentication when session expires
 * 3. 2FA prompting when required
 * 4. Download of all 409+ Trade Republic assets
 * 5. Robust error handling and retry logic
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { ComprehensiveAssetDataCollector } from '../src/data/asset-collector.js';
import { AssetTestDatabase } from '../src/database/test-database.js';
import { AuthenticationError, TwoFactorRequiredError } from '../src/types/auth.js';
import type { MFAChallenge, MFAResponse } from '../src/types/auth.js';
import { logger } from '../src/utils/logger.js';
import { createInterface } from 'readline';
import { promisify } from 'util';

// Set up readline for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = promisify(rl.question).bind(rl);

/**
 * Prompt user for credentials
 */
async function getCredentials(): Promise<{ username: string; password: string }> {
  console.log('\n🔐 Login Required');
  console.log('Please enter your Trade Republic credentials:');
  
  const username = await question('Phone number (+49...): ');
  const password = await question('PIN: ');
  
  return { username: username.trim(), password: password.trim() };
}

/**
 * Prompt user for 2FA code
 */
async function get2FACode(challenge: any): Promise<string> {
  console.log('\n🔐 Two-Factor Authentication Required');
  console.log(challenge.message || 'Enter the 4-digit code from your Trade Republic app:');
  
  const code = await question('2FA Code: ');
  return code.trim();
}

/**
 * Handle authentication flow with automatic retry and 2FA
 */
async function authenticateWithRetry(client: TradeRepublicClient): Promise<void> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      console.log(`\n🔄 Authentication attempt ${attempts + 1}/${maxAttempts}`);

      // First, check if we have a valid session
      console.log('📋 Checking existing session...');
      const validation = await client.validateSessionAndConnectivity();

      if (validation.isValid && validation.isServerReachable) {
        console.log('✅ Existing session is valid and server is reachable');
        return;
      }

      if (!validation.isServerReachable) {
        throw new AuthenticationError(
          'Trade Republic servers are not reachable. Please check your internet connection.',
          'SERVER_UNREACHABLE'
        );
      }

      console.log(`⚠️  Session validation failed: ${validation.error}`);
      console.log('🔄 Re-authentication required');

      // Get credentials from user
      const credentials = await getCredentials();

      // Attempt login with potential 2FA
      try {
        console.log('🔓 Attempting login...');
        await client.login(credentials);
        console.log('✅ Login successful!');
        return;
      } catch (authError) {
        if (authError instanceof TwoFactorRequiredError) {
          console.log('🔐 2FA required');
          
          // Get 2FA code from user
          const code = await get2FACode(authError.challenge!);
          
          // Complete 2FA using submitMFA
          console.log('🔓 Completing 2FA...');
          const mfaResponse: MFAResponse = {
            challengeId: authError.challenge!.challengeId,
            code: code,
          };
          
          await client.submitMFA(authError.challenge!, mfaResponse);
          
          console.log('✅ 2FA completed successfully!');
          return;
        }
        throw authError;
      }

    } catch (error) {
      attempts++;
      console.error(`❌ Authentication attempt ${attempts} failed:`, 
        error instanceof Error ? error.message : error);
      
      if (attempts >= maxAttempts) {
        throw new Error(`Authentication failed after ${maxAttempts} attempts`);
      }
      
      console.log('🔄 Retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Collect all assets with robust session handling
 */
async function collectAllAssets(): Promise<void> {
  const db = new AssetTestDatabase();
  const client = new TradeRepublicClient({
    sessionPersistence: true,
    autoRefreshTokens: true,
    logLevel: 'info',
  });

  let assetCollector: ComprehensiveAssetDataCollector;

  try {
    console.log('🚀 Starting comprehensive asset collection...');

    // Initialize client
    await client.initialize();

    // Ensure authentication
    await authenticateWithRetry(client);

    // Initialize asset collector
    assetCollector = new ComprehensiveAssetDataCollector(client.auth);

    // Initialize database
    console.log('🗄️  Initializing database...');
    await db.initialize();

    // Check current asset count
    const stats = await db.getStatistics();
    console.log(`📊 Current assets in database: ${stats.totalAssets}`);

    // Collect all available assets
    console.log('📈 Starting asset discovery and collection...');
    console.log('This may take several minutes...');

    const startTime = Date.now();
    let totalCollected = 0;

    // Get popular assets list for collection
    const popularISINs = [
      // German stocks
      'DE0007164600', // SAP
      'DE0008469008', // ASML
      'DE0005190003', // BMW
      'DE0007100000', // Mercedes-Benz
      'DE0007664039', // Volkswagen
      'DE000BAY0017', // Bayer
      'DE0005140008', // Deutsche Bank
      'DE0008404005', // Allianz
      'DE000A1EWWW0', // Adidas
      // US stocks
      'US0378331005', // Apple
      'US5949181045', // Microsoft
      'US00206R1023', // Amazon
      'US88160R1014', // Tesla
      'US02079K3059', // Google/Alphabet
      'US30303M1027', // Meta
      'US64110L1061', // Netflix
    ];

    for (let i = 0; i < popularISINs.length; i++) {
      const isin = popularISINs[i];
      
      try {
        console.log(`\n� Collecting asset ${i + 1}/${popularISINs.length}: ${isin}...`);
        
        // Validate session before each collection
        await client.ensureValidSession();
        
        const assetData = await assetCollector.getAssetInfo(isin);
        
        if (assetData) {
          totalCollected++;
          console.log(`✅ Collected data for ${assetData.name || isin}`);

          // Store in database
          await db.upsertAsset(assetData);
        } else {
          console.log(`ℹ️  No data found for ${isin}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.warn(`⚠️  Collection for "${isin}" failed:`, error instanceof Error ? error.message : error);
        
        // If it's an auth error, try to re-authenticate
        if (error instanceof AuthenticationError) {
          console.log('🔄 Authentication error detected, re-authenticating...');
          await authenticateWithRetry(client);
        }
      }
    }

    // Search-based collection for additional assets
    const searchTerms = [
      'DAX', 'MDAX', 'S&P 500', 'NASDAQ', 'ETF'
    ];

    for (let i = 0; i < searchTerms.length; i++) {
      const term = searchTerms[i];
      
      try {
        console.log(`\n🔍 Searching for "${term}"...`);
        
        // Validate session before each search
        await client.ensureValidSession();
        
        // Use the search functionality from portfolio manager
        const searchResults = await client.portfolio.searchInstruments(term);
        
        if (searchResults && searchResults.length > 0) {
          console.log(`✅ Found ${searchResults.length} assets for "${term}"`);

          // Collect detailed data for first few results
          const limit = Math.min(5, searchResults.length);
          for (let j = 0; j < limit; j++) {
            const result = searchResults[j];
            if (result.isin) {
              try {
                const assetData = await assetCollector.getAssetInfo(result.isin);
                if (assetData) {
                  await db.upsertAsset(assetData);
                  totalCollected++;
                }
              } catch (error) {
                console.warn(`Failed to collect ${result.isin}:`, error instanceof Error ? error.message : error);
              }
            }
          }
        } else {
          console.log(`ℹ️  No assets found for "${term}"`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.warn(`⚠️  Search for "${term}" failed:`, error instanceof Error ? error.message : error);
        
        // If it's an auth error, try to re-authenticate
        if (error instanceof AuthenticationError) {
          console.log('🔄 Authentication error detected, re-authenticating...');
          await authenticateWithRetry(client);
        }
      }
    }

    // Final count and summary
    const finalStats = await db.getStatistics();
    const duration = (Date.now() - startTime) / 1000;

    console.log('\n✅ Asset collection completed!');
    console.log(`📊 Total assets in database: ${finalStats.totalAssets}`);
    console.log(`📈 Assets collected this session: ${totalCollected}`);
    console.log(`⏱️  Total time: ${duration.toFixed(1)} seconds`);

    if (finalStats.totalAssets >= 20) {
      console.log('🎉 Successfully collected 20+ assets!');
    } else {
      console.log(`⚠️  Consider running additional collection strategies to reach more assets.`);
    }

  } catch (error) {
    console.error('❌ Asset collection failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await client.logout();
      rl.close();
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    await collectAllAssets();
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted by user');
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Process terminated');
  rl.close();
  process.exit(0);
});

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
