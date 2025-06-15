#!/usr/bin/env npx tsx

/**
 * Enhanced Authentication with 2FA Method Selection
 * 
 * Demonstrates how to authenticate with Trade Republic using either:
 * - APP-based 2FA (recommended) - 4-digit code from TR app
 * - SMS-based 2FA - 6-digit code sent via SMS
 * 
 * Usage:
 *   tsx examples/enhanced-auth.ts [--method app|sms]
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { createInterface } from 'readline';
import type { LoginCredentials, MFAResponse } from '../src/types/auth.js';

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function enhancedAuthentication() {
  console.log('\n🔐 ENHANCED AUTHENTICATION WITH 2FA METHOD SELECTION');
  console.log('====================================================');
  
  // Check command line arguments for 2FA method preference
  const args = process.argv.slice(2);
  const methodArg = args.find(arg => arg.startsWith('--method='))?.split('=')[1] ||
                   (args.includes('--method') ? args[args.indexOf('--method') + 1] : null);
  
  let mfaMethod: 'APP' | 'SMS';
  
  if (methodArg && ['app', 'sms'].includes(methodArg.toLowerCase())) {
    mfaMethod = methodArg.toUpperCase() as 'APP' | 'SMS';
    console.log(`🎯 Using specified 2FA method: ${mfaMethod}`);
  } else {
    console.log('\n📱 Select your preferred 2FA method:');
    console.log('1. APP (recommended) - 4-digit code from Trade Republic app');
    console.log('2. SMS - 6-digit code sent to your phone');
    
    const choice = await askQuestion('\nEnter your choice (1 or 2): ');
    mfaMethod = choice.trim() === '2' ? 'SMS' : 'APP';
  }
  
  console.log(`\n✅ Selected 2FA method: ${mfaMethod}`);
  console.log(`${mfaMethod === 'APP' ? '📱' : '💬'} You will receive a ${mfaMethod === 'APP' ? '4' : '6'}-digit code ${mfaMethod === 'APP' ? 'in your app' : 'via SMS'}`);

  // Load credentials
  const config = loadEnvironmentConfig();
  console.log(`\n📞 Phone: ${config.trUsername}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);

  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Error: Missing TR_USERNAME or TR_PASSWORD in .env file');
    rl.close();
    return;
  }

  const client = new TradeRepublicClient();

  try {
    console.log('\n🚀 Step 1: Initiating login...');
    
    // Create credentials with preferred MFA method
    const credentials: LoginCredentials = {
      username: config.trUsername,
      password: config.trPassword,
      preferredMfaMethod: mfaMethod
    };

    try {
      // Try direct login first
      const session = await client.login(credentials);
      
      // If we get here, login was successful without MFA
      console.log('\n🎉 AUTHENTICATION SUCCESSFUL (NO MFA REQUIRED)!');
      console.log('===============================================');
      console.log(`👤 User ID: ${session.userId}`);
      console.log(`🔑 Session ID: ${session.sessionId}`);
      console.log(`⏰ Session Created: ${new Date(session.createdAt).toLocaleString()}`);
      
    } catch (loginError: any) {
      // Check if this is a 2FA required error
      if (loginError?.code === 'MFA_REQUIRED' || loginError instanceof Error && loginError.message.includes('2FA')) {
        console.log('\n🔒 Step 2: 2FA Challenge required');
        
        // Create a simulated MFA challenge based on selected method
        const challenge: import('../src/types/auth.js').MFAChallenge = {
          challengeId: 'mfa_' + Date.now(),
          type: mfaMethod,
          message: mfaMethod === 'APP' 
            ? 'Enter the 4-digit code from your Trade Republic app'
            : 'Enter the 6-digit code sent to your phone via SMS',
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
          length: mfaMethod === 'APP' ? 4 : 6
        };
        
        console.log(`📋 Challenge Type: ${challenge.type}`);
        console.log(`💬 Message: ${challenge.message}`);
        console.log(`⏰ Expires: ${new Date(challenge.expiresAt).toLocaleString()}`);
        console.log(`🔢 Expected Code Length: ${challenge.length} digits`);

        // Provide specific instructions based on method
        if (mfaMethod === 'APP') {
          console.log('\n📱 APP-based 2FA Instructions:');
          console.log('   1. Open your Trade Republic app');
          console.log('   2. Look for the 4-digit authentication code');
          console.log('   3. Enter the code below');
        } else {
          console.log('\n💬 SMS-based 2FA Instructions:');
          console.log('   1. Check your phone for an SMS message');
          console.log('   2. Look for the 6-digit verification code');
          console.log('   3. Enter the code below');
        }

        const code = await askQuestion(`\nEnter your ${challenge.length}-digit code: `);

        if (!code || code.length !== challenge.length) {
          console.log(`❌ Invalid code length. Expected ${challenge.length} digits.`);
          rl.close();
          return;
        }

        console.log('\n🔓 Step 3: Submitting 2FA code...');
        
        const mfaResponse: MFAResponse = {
          challengeId: challenge.challengeId,
          code: code.trim()
        };

        const session = await client.submitMFA(challenge, mfaResponse);
        
        console.log('\n🎉 AUTHENTICATION SUCCESSFUL!');
        console.log('=============================');
        console.log(`👤 User ID: ${session.userId}`);
        console.log(`🔑 Session ID: ${session.sessionId}`);
        console.log(`⏰ Session Created: ${new Date(session.createdAt).toLocaleString()}`);
        console.log(`🔄 Token Type: ${session.token.tokenType}`);
        console.log(`⌛ Token Expires: ${new Date(session.token.expiresAt).toLocaleString()}`);

        console.log('\n📊 2FA Method Performance:');
        console.log(`✅ Method Used: ${mfaMethod}`);
        console.log(`⚡ Code Length: ${code.length} digits`);
        console.log(`🎯 Authentication: Successful`);
        
        if (mfaMethod === 'APP') {
          console.log('💡 APP method benefits: More secure, faster, works offline');
        } else {
          console.log('💡 SMS method benefits: Works without app, universal compatibility');
        }
        
      } else {
        // Re-throw if it's not a 2FA error
        throw loginError;
      }
    }

    // Test the connection with a simple API call (common for both paths)
    console.log('\n🧪 Testing API connection...');
    try {
      const portfolio = await client.getPortfolioSummary();
      if (portfolio) {
        console.log('✅ API connection test successful');
        console.log(`💰 Portfolio Value: €${portfolio.totalValue?.toFixed(2) || 'N/A'}`);
      }
    } catch (error) {
      console.log('⚠️  API test failed (this may be normal):', error instanceof Error ? error.message : error);
    }

  } catch (error) {
    console.error('\n❌ Authentication failed:', error);
    
    if (error instanceof Error) {
      console.log('\n🔍 Error details:');
      console.log(`   Type: ${error.constructor.name}`);
      console.log(`   Message: ${error.message}`);
      
      // Provide helpful suggestions based on error
      if (error.message.includes('Invalid PIN')) {
        console.log('\n💡 Suggestions:');
        console.log('   • Check your PIN in the Trade Republic app');
        console.log('   • Ensure your .env file has the correct TR_PASSWORD');
      } else if (error.message.includes('Invalid phone')) {
        console.log('\n💡 Suggestions:');
        console.log('   • Check your phone number format (e.g., +49...)');
        console.log('   • Ensure your .env file has the correct TR_USERNAME');
      } else if (error.message.includes('MFA')) {
        console.log('\n💡 Suggestions:');
        console.log(`   • Try the other 2FA method (${mfaMethod === 'APP' ? 'SMS' : 'APP'})`);
        console.log('   • Check that your code hasn\'t expired');
        console.log('   • Verify the code length is correct');
      }
    }
  } finally {
    rl.close();
  }
}

// Command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n🔐 Enhanced Authentication with 2FA Method Selection');
  console.log('====================================================');
  console.log('\nUsage:');
  console.log('  tsx examples/enhanced-auth.ts [options]');
  console.log('\nOptions:');
  console.log('  --method app     Use APP-based 2FA (4-digit code from TR app)');
  console.log('  --method sms     Use SMS-based 2FA (6-digit code via SMS)');
  console.log('  --help, -h       Show this help message');
  console.log('\nExamples:');
  console.log('  tsx examples/enhanced-auth.ts --method app');
  console.log('  tsx examples/enhanced-auth.ts --method sms');
  console.log('  tsx examples/enhanced-auth.ts  # Interactive method selection');
  console.log('\nEnvironment Variables:');
  console.log('  TR_USERNAME      Your Trade Republic phone number');
  console.log('  TR_PASSWORD      Your Trade Republic PIN');
  console.log('\n📝 Note: APP method is recommended for better security');
  process.exit(0);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  enhancedAuthentication().catch(console.error);
}
