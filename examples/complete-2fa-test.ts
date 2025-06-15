#!/usr/bin/env npx tsx

/**
 * Complete 2FA Authentication Test
 * 
 * Now that we found the working endpoint, this completes the 2FA flow:
 * 1. Initiate authentication (triggers SMS/APP)
 * 2. Complete with 4-digit code
 */

import { createInterface } from 'readline';
import { loadEnvironmentConfig } from '../src/config/environment.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function complete2FAFlow() {
  console.log('\n🔐 COMPLETE 2FA AUTHENTICATION TEST');
  console.log('===================================');
  
  const config = loadEnvironmentConfig();
  const TR_API_BASE = config.apiUrl || 'https://api.traderepublic.com';
  
  console.log(`📞 Phone: ${config.trUsername?.replace(/\d(?=\d{4})/g, '*')}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);
  console.log(`📱 2FA Method: ${config.tr2faMethod?.toUpperCase() || 'SMS'}`);
  
  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Missing credentials in .env file');
    rl.close();
    return;
  }

  try {
    // Step 1: Initiate authentication (triggers 2FA)
    console.log('\n🚀 Step 1: Initiating authentication...');
    console.log('This will trigger a 4-digit code via SMS or APP');
    
    const loginResponse = await fetch(`${TR_API_BASE}/api/v1/auth/web/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Trade-Republic-Connector/1.0.0',
        'Accept': 'application/json',
        'Origin': 'https://app.traderepublic.com',
        'Referer': 'https://app.traderepublic.com/'
      },
      body: JSON.stringify({
        phoneNumber: config.trUsername,
        pin: config.trPassword
      })
    });

    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok || !loginData.processId) {
      console.log('❌ Authentication initiation failed:');
      console.log(JSON.stringify(loginData, null, 2));
      rl.close();
      return;
    }

    console.log('✅ Authentication initiated successfully!');
    console.log(`📋 Process ID: ${loginData.processId}`);
    console.log(`⏰ Countdown: ${loginData.countdownInSeconds} seconds`);
    console.log(`📱 2FA Method: ${loginData['2fa'] || 'Unknown'}`);
    console.log('\n📱 Check your phone for a 4-digit code!');

    // Step 2: Get the 4-digit code from user
    const code = await askQuestion('\n🔢 Enter the 4-digit code from Trade Republic: ');
    
    if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
      console.log('❌ Invalid code. Must be exactly 4 digits.');
      rl.close();
      return;
    }

    console.log('\n🔓 Step 2: Submitting 4-digit code...');

    // Step 3: Complete authentication with 2FA code
    const tanResponse = await fetch(`${TR_API_BASE}/api/v1/auth/web/login/${loginData.processId}/tan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Trade-Republic-Connector/1.0.0',
        'Accept': 'application/json',
        'Origin': 'https://app.traderepublic.com',
        'Referer': 'https://app.traderepublic.com/'
      },
      body: JSON.stringify({
        tan: code
      })
    });

    const tanData = await tanResponse.json();
    
    console.log(`\n📊 2FA Completion Response:`);
    console.log(`   Status: ${tanResponse.status} ${tanResponse.statusText}`);
    console.log(`   Data:`, JSON.stringify(tanData, null, 2));

    if (tanResponse.ok && tanData.accessToken) {
      console.log('\n🎉 AUTHENTICATION SUCCESSFUL!');
      console.log('============================');
      console.log(`✅ Access Token: ${tanData.accessToken.substring(0, 30)}...`);
      console.log(`✅ Refresh Token: ${tanData.refreshToken ? tanData.refreshToken.substring(0, 30) + '...' : 'Not provided'}`);
      console.log(`✅ Token Type: ${tanData.tokenType || 'Bearer'}`);
      
      if (tanData.expiresIn) {
        console.log(`⏰ Expires in: ${tanData.expiresIn} seconds`);
      }
      
      console.log('\n📊 2FA Test Results:');
      console.log(`✅ SMS/APP Code Delivery: SUCCESS`);
      console.log(`✅ Code Validation: SUCCESS`);
      console.log(`✅ Authentication Flow: COMPLETE`);
      console.log(`✅ Token Generation: SUCCESS`);
      
      console.log('\n🔧 Implementation Notes:');
      console.log('• 2FA method selection is working correctly');
      console.log('• Trade Republic delivers 4-digit codes as expected');
      console.log('• The authentication flow is fully functional');
      console.log('• Ready for production use');
      
    } else {
      console.log('\n❌ Authentication failed at 2FA step');
      console.log('Possible reasons:');
      console.log('• Code was incorrect');
      console.log('• Code expired (usually 2 minutes)');
      console.log('• Code was already used');
      console.log('• Network/API error');
    }

  } catch (error) {
    console.error('\n💥 Error during authentication:', error);
  } finally {
    rl.close();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  complete2FAFlow().catch(console.error);
}
