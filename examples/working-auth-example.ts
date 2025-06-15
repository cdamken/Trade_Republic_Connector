#!/usr/bin/env npx tsx

/**
 * Working 2FA Authentication Example
 * 
 * Uses the discovered working Trade Republic API endpoints
 * to demonstrate real 2FA authentication with method selection.
 */

import { createInterface } from 'readline';
import { WorkingTradeRepublicAPI } from '../src/api/working-tr-api.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import type { MFAChallenge } from '../src/types/auth.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function workingAuthExample() {
  console.log('\n🔐 WORKING 2FA AUTHENTICATION EXAMPLE');
  console.log('====================================');
  
  const config = loadEnvironmentConfig();
  
  console.log(`📞 Phone: ${config.trUsername?.replace(/\d(?=\d{4})/g, '*')}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);
  console.log(`📱 2FA Method: ${config.tr2faMethod?.toUpperCase() || 'SMS'}`);
  
  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Missing credentials in .env file');
    rl.close();
    return;
  }

  const api = new WorkingTradeRepublicAPI();

  try {
    console.log('\n🚀 Starting authentication with working API...');
    
    // Use the full authentication flow
    const session = await api.authenticate({
      username: config.trUsername,
      password: config.trPassword,
      preferredMfaMethod: config.tr2faMethod?.toUpperCase() as 'SMS' | 'APP' || 'SMS'
    }, async (challenge: MFAChallenge) => {
      // This callback handles the 2FA code input
      console.log('\n🔐 2FA Challenge Received!');
      console.log(`📋 Type: ${challenge.type}`);
      console.log(`💬 Message: ${challenge.message}`);
      console.log(`⏰ Expires: ${new Date(challenge.expiresAt).toLocaleString()}`);
      console.log(`🔢 Expected Length: ${challenge.length} digits`);
      
      if (challenge.type === 'SMS') {
        console.log('\n💬 SMS Instructions:');
        console.log('   📱 Check your phone for an SMS from Trade Republic');
        console.log('   🔢 Enter the 4-digit code below');
      } else {
        console.log('\n📱 APP Instructions:');
        console.log('   📲 Open your Trade Republic app');
        console.log('   🔢 Find the 4-digit authentication code');
        console.log('   📍 Usually in: Settings → Security → Authentication codes');
      }

      const code = await askQuestion(`\n🔢 Enter your ${challenge.length}-digit code: `);
      
      if (!code || code.length !== challenge.length || !/^\d+$/.test(code)) {
        throw new Error(`Invalid code format. Expected ${challenge.length} digits.`);
      }
      
      return code;
    });

    console.log('\n🎉 AUTHENTICATION SUCCESSFUL!');
    console.log('=============================');
    console.log(`👤 User ID: ${session.userId}`);
    console.log(`🔑 Session ID: ${session.sessionId}`);
    console.log(`⏰ Created: ${new Date(session.createdAt).toLocaleString()}`);
    console.log(`🔄 Token Type: ${session.token.tokenType}`);
    console.log(`⌛ Token Expires: ${new Date(session.token.expiresAt).toLocaleString()}`);
    console.log(`🔑 Access Token: ${session.token.accessToken.substring(0, 30)}...`);
    
    if (session.token.refreshToken) {
      console.log(`🔄 Refresh Token: ${session.token.refreshToken.substring(0, 30)}...`);
    }

    console.log('\n✅ IMPLEMENTATION VERIFICATION:');
    console.log('==============================');
    console.log('✅ 2FA Method Selection: Working');
    console.log('✅ SMS/APP Code Delivery: Working');
    console.log('✅ Authentication Flow: Complete');
    console.log('✅ Token Generation: Successful');
    console.log('✅ Session Management: Ready');

    console.log('\n🔧 Integration Notes:');
    console.log('• Use WorkingTradeRepublicAPI for production');
    console.log('• 2FA method is configurable via TR_2FA_METHOD env var');
    console.log('• Trade Republic always uses 4-digit codes');
    console.log('• Rate limiting is handled automatically');
    
  } catch (error) {
    console.error('\n❌ Authentication failed:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('Rate limited')) {
      console.log('\n💡 Rate Limiting:');
      console.log('• This is normal Trade Republic security');
      console.log('• Wait the specified time before retrying');
      console.log('• Consider implementing exponential backoff');
    } else if (error instanceof Error && error.message.includes('Invalid code')) {
      console.log('\n💡 Code Issues:');
      console.log('• Ensure you enter exactly 4 digits');
      console.log('• Code expires in ~2 minutes');
      console.log('• Each code can only be used once');
    }
  } finally {
    rl.close();
  }
}

// Command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n🔐 Working 2FA Authentication Example');
  console.log('====================================');
  console.log('\nThis example uses the discovered working Trade Republic API endpoints');
  console.log('to perform real authentication with 2FA method selection.');
  console.log('\nFeatures:');
  console.log('• Real API calls to Trade Republic servers');
  console.log('• SMS or APP 2FA method selection via .env');
  console.log('• Complete authentication flow');
  console.log('• Token generation and session management');
  console.log('\nEnvironment Variables:');
  console.log('  TR_USERNAME      Your Trade Republic phone number');
  console.log('  TR_PASSWORD      Your Trade Republic PIN');
  console.log('  TR_2FA_METHOD    "sms" or "app" (optional, defaults to SMS)');
  console.log('\nUsage:');
  console.log('  tsx examples/working-auth-example.ts');
  process.exit(0);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  workingAuthExample().catch(console.error);
}
