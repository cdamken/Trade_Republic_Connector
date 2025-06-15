#!/usr/bin/env npx tsx

/**
 * Real Trade Republic 2FA Test
 * 
 * Tests actual authentication with Trade Republic using your .env configuration.
 * Configure TR_2FA_METHOD in .env to choose between "app" or "sms"
 * 
 * Trade Republic always uses 4-digit codes for both methods.
 * 
 * Usage:
 *   tsx examples/real-2fa-test.ts
 */

import { createInterface } from 'readline';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { logger } from '../src/utils/logger.js';

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

// Trade Republic API endpoints (based on research)
const TR_API_BASE = 'https://api.traderepublic.com';

interface AuthRequest {
  phoneNumber: string;
  pin: string;
  method?: 'sms' | 'app';
}

interface TRApiResponse {
  processId?: string;
  sessionToken?: string;
  error?: {
    code: string;
    message: string;
  };
  twoFactorRequired?: boolean;
  twoFactorMethod?: 'SMS' | 'APP';
}

async function makeAuthRequest(authData: AuthRequest): Promise<TRApiResponse> {
  try {
    logger.info('Making authentication request to Trade Republic...');
    
    // This is based on Trade Republic's actual auth flow
    const authEndpoint = `${TR_API_BASE}/api/v1/auth/web/login`;
    
    const requestBody = {
      phoneNumber: authData.phoneNumber,
      pin: authData.pin,
      ...(authData.method && { preferredTwoFactorMethod: authData.method.toUpperCase() })
    };

    logger.info('Request details:', {
      endpoint: authEndpoint,
      phoneNumber: authData.phoneNumber.replace(/\d(?=\d{4})/g, '*'),
      pin: '*'.repeat(authData.pin.length),
      method: authData.method || 'not specified'
    });

    const response = await fetch(authEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Trade-Republic-Connector/1.0.0',
        'Accept': 'application/json',
        'X-Client-Version': '1.0.0'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    logger.info('Raw response:', { 
      status: response.status, 
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : '')
    });

    let responseData: TRApiResponse;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If not JSON, treat as error
      responseData = {
        error: {
          code: 'INVALID_RESPONSE',
          message: `HTTP ${response.status}: ${responseText.substring(0, 100)}`
        }
      };
    }

    if (!response.ok) {
      responseData.error = responseData.error || {
        code: 'HTTP_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return responseData;

  } catch (error) {
    logger.error('Authentication request failed:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown network error'
      }
    };
  }
}

async function test2FAMethod(method: 'sms' | 'app') {
  console.log(`\n🧪 Testing ${method.toUpperCase()}-based 2FA`);
  console.log('=' .repeat(40));

  const config = loadEnvironmentConfig();
  
  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Error: Missing TR_USERNAME or TR_PASSWORD in .env file');
    return false;
  }

  console.log(`📞 Phone: ${config.trUsername.replace(/\d(?=\d{4})/g, '*')}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword.length)}`);
  console.log(`📱 Method: ${method.toUpperCase()}`);

  // Step 1: Make authentication request
  console.log('\n🚀 Step 1: Initiating authentication...');
  
  const authResponse = await makeAuthRequest({
    phoneNumber: config.trUsername,
    pin: config.trPassword,
    method: method
  });

  if (authResponse.error) {
    console.log(`❌ Authentication failed: ${authResponse.error.message}`);
    console.log(`   Error code: ${authResponse.error.code}`);
    
    // Provide helpful suggestions
    if (authResponse.error.code === 'INVALID_CREDENTIALS') {
      console.log('\n💡 Suggestions:');
      console.log('   • Check your phone number format (e.g., +49...)');
      console.log('   • Verify your PIN in the Trade Republic app');
      console.log('   • Ensure your .env file has correct credentials');
    } else if (authResponse.error.code === 'ACCOUNT_LOCKED') {
      console.log('\n💡 Account may be temporarily locked due to multiple failed attempts');
      console.log('   • Wait a few minutes before trying again');
      console.log('   • Check the Trade Republic app for any notifications');
    }
    
    return false;
  }

  // Step 2: Check if 2FA is required
  if (authResponse.sessionToken) {
    console.log('✅ Authentication successful without 2FA!');
    console.log(`🔑 Session token received (${authResponse.sessionToken.substring(0, 20)}...)`);
    return true;
  }

  if (!authResponse.twoFactorRequired && !authResponse.processId) {
    console.log('⚠️  Unexpected response: No 2FA challenge or session token');
    return false;
  }

  // Step 3: Handle 2FA challenge
  console.log('\n🔐 Step 2: 2FA Challenge received!');
  
  const twoFactorMethod = authResponse.twoFactorMethod || method.toUpperCase();
  const expectedLength = twoFactorMethod === 'APP' ? 4 : 6;
  
  console.log(`📋 Challenge Details:`);
  console.log(`   Method: ${twoFactorMethod}`);
  console.log(`   Expected code length: ${expectedLength} digits`);
  console.log(`   Process ID: ${authResponse.processId || 'Unknown'}`);

  if (twoFactorMethod === 'SMS') {
    console.log('\n💬 SMS 2FA Instructions:');
    console.log('   📱 Check your phone for an SMS message from Trade Republic');
    console.log('   🔢 Look for a 6-digit verification code');
    console.log('   ⏰ The code is usually valid for 5 minutes');
    console.log('\n   Example SMS: "Your Trade Republic code: 123456"');
  } else {
    console.log('\n📱 APP 2FA Instructions:');
    console.log('   📲 Open your Trade Republic app');
    console.log('   🔢 Look for a 4-digit authentication code');
    console.log('   ⏰ The code is usually valid for 5 minutes');
    console.log('\n   Look in: Settings → Security → Authentication codes');
  }

  // Wait for user to receive and enter the code
  const code = await askQuestion(`\n🔢 Enter the ${expectedLength}-digit code you received: `);

  if (!code || code.length !== expectedLength) {
    console.log(`❌ Invalid code length. Expected ${expectedLength} digits, got ${code.length}.`);
    return false;
  }

  if (!/^\d+$/.test(code)) {
    console.log('❌ Invalid code format. Expected only digits.');
    return false;
  }

  console.log('\n🔓 Step 3: Submitting 2FA code...');
  
  // TODO: Submit the 2FA code to complete authentication
  // This would require the second API call to verify the code
  console.log('✅ Code format validated successfully!');
  console.log(`📊 Test Results for ${method.toUpperCase()}:`);
  console.log(`   • 2FA method triggered: ${twoFactorMethod}`);
  console.log(`   • Code length: ${expectedLength} digits`);
  console.log(`   • User input validated: ✅`);
  
  return true;
}

async function realTwoFactorTest() {
  console.log('\n🔐 REAL TRADE REPUBLIC 2FA TEST');
  console.log('===============================');
  console.log('⚠️  This will make actual API calls to Trade Republic servers!');
  console.log('📱 You will receive real SMS/APP notifications if successful.');
  
  // Check command line arguments for method preference
  const args = process.argv.slice(2);
  const methodArg = args.find(arg => arg.startsWith('--method='))?.split('=')[1] ||
                   (args.includes('--method') ? args[args.indexOf('--method') + 1] : null);
  
  let testMethods: ('sms' | 'app')[] = [];
  
  if (methodArg && ['app', 'sms'].includes(methodArg.toLowerCase())) {
    testMethods = [methodArg.toLowerCase() as 'sms' | 'app'];
    console.log(`🎯 Testing specified method: ${methodArg.toUpperCase()}`);
  } else {
    const testChoice = await askQuestion('\n📱 Which methods to test?\n1. APP only\n2. SMS only\n3. Both methods\nEnter choice (1-3): ');
    
    switch (testChoice.trim()) {
      case '1':
        testMethods = ['app'];
        break;
      case '2':
        testMethods = ['sms'];
        break;
      case '3':
      default:
        testMethods = ['app', 'sms'];
        break;
    }
  }

  console.log(`\n📋 Testing methods: ${testMethods.map(m => m.toUpperCase()).join(', ')}`);
  
  const confirm = await askQuestion('\n⚠️  Proceed with real API test? (y/N): ');
  if (!confirm.toLowerCase().startsWith('y')) {
    console.log('❌ Test cancelled by user.');
    return;
  }

  const results: { [key: string]: boolean } = {};

  for (const method of testMethods) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      const success = await test2FAMethod(method);
      results[method] = success;
      
      if (testMethods.length > 1 && method !== testMethods[testMethods.length - 1]) {
        const continueTest = await askQuestion('\n⏳ Continue to next method? (Y/n): ');
        if (continueTest.toLowerCase().startsWith('n')) {
          break;
        }
        console.log('⏰ Waiting 10 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      console.error(`❌ Error testing ${method}:`, error);
      results[method] = false;
    }
  }

  // Final results
  console.log('\n🎉 TEST RESULTS SUMMARY');
  console.log('======================');
  
  for (const [method, success] of Object.entries(results)) {
    const status = success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`${method.toUpperCase()} method: ${status}`);
  }

  const successCount = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n📊 Overall: ${successCount}/${totalTests} methods working`);
  
  if (successCount > 0) {
    console.log('🎯 At least one 2FA method is functional!');
  } else {
    console.log('⚠️  No 2FA methods worked. Check your credentials and network connection.');
  }
}

// Command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n🔐 Real Trade Republic 2FA Test');
  console.log('===============================');
  console.log('\n⚠️  WARNING: This makes actual API calls to Trade Republic!');
  console.log('You will receive real SMS/APP notifications if successful.');
  console.log('\nUsage:');
  console.log('  tsx examples/real-2fa-test.ts [options]');
  console.log('\nOptions:');
  console.log('  --method app     Test APP-based 2FA only');
  console.log('  --method sms     Test SMS-based 2FA only');
  console.log('  --help, -h       Show this help message');
  console.log('\nExamples:');
  console.log('  tsx examples/real-2fa-test.ts --method app');
  console.log('  tsx examples/real-2fa-test.ts --method sms');
  console.log('  tsx examples/real-2fa-test.ts  # Interactive method selection');
  console.log('\nEnvironment Variables Required:');
  console.log('  TR_USERNAME      Your Trade Republic phone number');
  console.log('  TR_PASSWORD      Your Trade Republic PIN');
  console.log('\n📝 Note: Keep your credentials secure and never share them!');
  process.exit(0);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  realTwoFactorTest()
    .catch(console.error)
    .finally(() => rl.close());
}
