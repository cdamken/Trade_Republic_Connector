#!/usr/bin/env npx tsx

/**
 * Trade Republic API Endpoint Discovery
 * 
 * This script explores Trade Republic's API to find the correct authentication endpoints
 * and determine the proper request format for triggering 2FA.
 */

import { loadEnvironmentConfig } from '../src/config/environment.js';
import { logger } from '../src/utils/logger.js';

const config = loadEnvironmentConfig();
const TR_API_BASE = config.apiUrl || 'https://api.traderepublic.com';

// Common TR API endpoints to test
const ENDPOINTS_TO_TEST = [
  // Authentication endpoints
  '/api/v1/auth/web/login',
  '/api/v1/auth/login',
  '/api/v1/auth/authenticate',
  '/api/v1/login',
  '/v1/auth/login',
  '/auth/login',
  '/login',
  
  // Device pairing endpoints
  '/api/v1/auth/web/deviceReset',
  '/api/v1/device/reset',
  '/api/v1/device/pair',
  '/api/v1/auth/device/reset',
  
  // 2FA endpoints  
  '/api/v1/auth/2fa',
  '/api/v1/auth/mfa',
  '/api/v1/auth/tan',
  '/api/v1/auth/sms',
];

// Test different request formats
const REQUEST_FORMATS = [
  // Format 1: Standard phone + pin
  {
    name: 'Standard Format',
    body: {
      phoneNumber: config.trUsername,
      pin: config.trPassword
    }
  },
  
  // Format 2: With 2FA method preference
  {
    name: 'With 2FA Method',
    body: {
      phoneNumber: config.trUsername,
      pin: config.trPassword,
      twoFactorMethod: config.tr2faMethod?.toUpperCase() || 'SMS'
    }
  },
  
  // Format 3: Legacy format
  {
    name: 'Legacy Format',
    body: {
      username: config.trUsername,
      password: config.trPassword
    }
  },
  
  // Format 4: Device reset format
  {
    name: 'Device Reset Format',
    body: {
      phoneNumber: config.trUsername,
      pin: config.trPassword,
      action: 'deviceReset'
    }
  }
];

async function testEndpoint(endpoint: string, requestFormat: any): Promise<any> {
  try {
    console.log(`🧪 Testing: ${endpoint} with ${requestFormat.name}`);
    
    const response = await fetch(`${TR_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Trade-Republic-Connector/1.0.0',
        'Accept': 'application/json',
        'Origin': 'https://app.traderepublic.com',
        'Referer': 'https://app.traderepublic.com/',
        'X-Client-Version': '1.0.0'
      },
      body: JSON.stringify(requestFormat.body)
    });

    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    const result = {
      endpoint,
      format: requestFormat.name,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      success: response.ok
    };

    // Check if this looks like a successful 2FA trigger
    const is2FAResponse = (
      responseData.processId || 
      responseData.challengeId ||
      responseData.status === 'MFA_REQUIRED' ||
      responseData.twoFactorRequired ||
      response.status === 202 ||
      (response.status === 200 && responseData.status)
    );

    if (is2FAResponse) {
      console.log(`✅ POTENTIAL 2FA TRIGGER: ${endpoint}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Data:`, JSON.stringify(responseData, null, 2));
    } else if (response.ok) {
      console.log(`ℹ️  Response OK but no 2FA: ${endpoint}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Data:`, JSON.stringify(responseData, null, 2).substring(0, 200));
    } else {
      console.log(`❌ Error: ${endpoint} - ${response.status} ${response.statusText}`);
      if (responseData.error || responseData.message) {
        console.log(`   Error: ${responseData.error || responseData.message}`);
      }
    }

    return result;

  } catch (error) {
    console.log(`💥 Network error: ${endpoint} - ${error instanceof Error ? error.message : error}`);
    return {
      endpoint,
      format: requestFormat.name,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function discoverAPIEndpoints() {
  console.log('\n🔍 TRADE REPUBLIC API ENDPOINT DISCOVERY');
  console.log('========================================');
  console.log(`📞 Phone: ${config.trUsername?.replace(/\d(?=\d{4})/g, '*')}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);
  console.log(`📱 2FA Method: ${config.tr2faMethod?.toUpperCase() || 'SMS'}`);
  console.log(`🌐 API Base: ${TR_API_BASE}`);
  
  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Missing credentials. Set TR_USERNAME and TR_PASSWORD in .env');
    return;
  }

  console.log('\n⚠️  This will test multiple API endpoints to find the correct one.');
  console.log('⚠️  You may receive multiple 2FA codes if any endpoints work.');
  
  const results: any[] = [];
  
  // Test a few key endpoints first
  const priorityEndpoints = [
    '/api/v1/auth/web/login',
    '/api/v1/auth/login', 
    '/api/v1/login'
  ];
  
  console.log('\n🎯 Testing Priority Endpoints');
  console.log('=============================');
  
  for (const endpoint of priorityEndpoints) {
    for (const format of REQUEST_FORMATS.slice(0, 2)) { // Test first 2 formats
      const result = await testEndpoint(endpoint, format);
      results.push(result);
      
      // If we found a 2FA trigger, stop here
      if (result.data?.processId || result.data?.challengeId || result.data?.status === 'MFA_REQUIRED') {
        console.log('\n🎉 FOUND WORKING ENDPOINT!');
        console.log(`   Endpoint: ${endpoint}`);
        console.log(`   Format: ${format.name}`);
        console.log(`   Process ID: ${result.data.processId || result.data.challengeId}`);
        console.log('\n📱 Check your phone for a 4-digit code!');
        return result;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n📊 DISCOVERY RESULTS');
  console.log('===================');
  
  const successful = results.filter(r => r.success);
  const errors = results.filter(r => r.error || !r.success);
  
  console.log(`✅ Successful responses: ${successful.length}`);
  console.log(`❌ Errors: ${errors.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successful Endpoints:');
    successful.forEach(r => {
      console.log(`   ${r.endpoint} (${r.format}) - ${r.status}`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Failed Endpoints:');
    errors.slice(0, 5).forEach(r => {
      console.log(`   ${r.endpoint} (${r.format}) - ${r.status || 'Network Error'}`);
    });
  }
  
  console.log('\n💡 Next Steps:');
  console.log('• Check if any successful endpoints triggered 2FA');
  console.log('• Look for processId or challengeId in responses');
  console.log('• Try manual testing with the successful endpoint');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  discoverAPIEndpoints().catch(console.error);
}
