#!/usr/bin/env npx tsx

/**
 * Simple Working 2FA Test
 * 
 * Direct API calls to Trade Republic to test 2FA methods
 * Uses configuration from .env file including TR_2FA_METHOD
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

async function testTradRe2FA() {
  console.log('\n🔐 SIMPLE TRADE REPUBLIC 2FA TEST');
  console.log('=================================');
  
  const config = loadEnvironmentConfig();
  
  console.log(`📱 Phone: ${config.trUsername?.replace(/\d(?=\d{4})/g, '*') || 'Not set'}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);
  console.log(`📨 2FA Method: ${config.tr2faMethod?.toUpperCase() || 'APP (default)'}`);
  console.log(`🌐 API URL: ${config.apiUrl}`);

  if (!config.trUsername || !config.trPassword) {
    console.log('\n❌ Error: Missing TR_USERNAME or TR_PASSWORD in .env file');
    console.log('💡 Please check your .env file configuration');
    rl.close();
    return;
  }

  console.log('\n📱 2FA Method Details:');
  if (config.tr2faMethod === 'sms') {
    console.log('✅ SMS-based 2FA selected');
    console.log('   • You will receive a 4-digit code via SMS');
    console.log('   • Check your phone for the message');
    console.log('   • Code is usually valid for 5 minutes');
  } else {
    console.log('✅ APP-based 2FA selected (recommended)');
    console.log('   • You will receive a 4-digit code in Trade Republic app');
    console.log('   • Open TR app → Settings → Security');
    console.log('   • Code is usually valid for 5 minutes');
  }

  const proceed = await askQuestion('\n🚀 Proceed with real authentication test? (y/N): ');
  if (!proceed.toLowerCase().startsWith('y')) {
    console.log('❌ Test cancelled.');
    rl.close();
    return;
  }

  try {
    console.log('\n📞 Step 1: Attempting Trade Republic authentication...');
    
    // Make actual API call to Trade Republic
    const loginEndpoint = `${config.apiUrl}/api/v1/auth/web/login`;
    
    const requestData = {
      phoneNumber: config.trUsername,
      pin: config.trPassword,
      preferredTwoFactorMethod: config.tr2faMethod?.toUpperCase() || 'APP'
    };

    console.log(`🌐 POST ${loginEndpoint}`);
    console.log(`📊 Request: ${JSON.stringify({
      phoneNumber: requestData.phoneNumber.replace(/\d(?=\d{4})/g, '*'),
      pin: '*'.repeat(requestData.pin.length),
      preferredTwoFactorMethod: requestData.preferredTwoFactorMethod
    }, null, 2)}`);

    const response = await fetch(loginEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Trade-Republic-Connector/1.0.0',
        'X-Client-Version': '1.0.0'
      },
      body: JSON.stringify(requestData)
    });

    const responseText = await response.text();
    console.log(`\n📨 Response Status: ${response.status} ${response.statusText}`);
    
    // Log response headers (helpful for debugging)
    const headers = Object.fromEntries(response.headers.entries());
    console.log(`📋 Response Headers:`, JSON.stringify(headers, null, 2));

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log(`📦 Response Data:`, JSON.stringify(responseData, null, 2));
    } catch {
      console.log(`📦 Raw Response:`, responseText.substring(0, 500));
    }

    if (response.status === 200) {
      console.log('\n✅ API call successful!');
      
      if (responseData?.sessionToken) {
        console.log('🎉 Authentication successful without 2FA!');
        console.log(`🔑 Session token received`);
      } else if (responseData?.twoFactorRequired || responseData?.processId) {
        console.log('🔐 2FA challenge triggered!');
        console.log(`📨 Method: ${responseData.twoFactorMethod || config.tr2faMethod?.toUpperCase()}`);
        
        if (config.tr2faMethod === 'sms') {
          console.log('\n💬 SMS 2FA Success!');
          console.log('📱 Check your phone for a 4-digit SMS code');
          console.log('📞 Message should arrive within 1-2 minutes');
        } else {
          console.log('\n📱 APP 2FA Success!');
          console.log('📲 Check Trade Republic app for 4-digit code');
          console.log('⚙️  App → Settings → Security → Authentication codes');
        }

        const code = await askQuestion('\n🔢 Enter the 4-digit code you received: ');
        
        if (code && code.length === 4 && /^\d{4}$/.test(code)) {
          console.log('✅ Code format valid!');
          console.log(`🎯 Received: ${code}`);
          console.log('💡 In a real app, this would complete the authentication');
        } else {
          console.log('❌ Invalid code format. Expected 4 digits.');
        }
      }
    } else {
      console.log('\n❌ API call failed');
      
      if (response.status === 401) {
        console.log('🔐 Authentication failed - check your credentials');
      } else if (response.status === 429) {
        console.log('⏰ Rate limited - too many requests');
      } else if (response.status >= 500) {
        console.log('🔧 Server error - Trade Republic API may be down');
      }
      
      console.log('\n💡 Troubleshooting:');
      console.log('   • Verify phone number format in .env (include country code)');
      console.log('   • Check PIN is correct in Trade Republic app');
      console.log('   • Try different 2FA method (change TR_2FA_METHOD in .env)');
      console.log('   • Wait a few minutes if you see rate limiting');
    }

  } catch (error) {
    console.log('\n❌ Network error:', error instanceof Error ? error.message : error);
    console.log('\n💡 Check:');
    console.log('   • Internet connection');
    console.log('   • Trade Republic API availability');
    console.log('   • Firewall/proxy settings');
  }

  console.log('\n📊 Test Configuration Summary:');
  console.log(`   Phone: ${config.trUsername?.replace(/\d(?=\d{4})/g, '*')}`);
  console.log(`   2FA Method: ${config.tr2faMethod?.toUpperCase() || 'APP'}`);
  console.log(`   API URL: ${config.apiUrl}`);
  console.log('\n💡 To change 2FA method, edit TR_2FA_METHOD in .env file');
  
  rl.close();
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  testTradRe2FA().catch(console.error);
}
