/**
 * Trade Republic API Endpoint Discovery
 * Test different endpoints to find working ones
 */

import { loadEnvironmentConfig } from '../src/config/environment.js';

async function discoverWorkingEndpoints() {
  console.log('🔍 Discovering working Trade Republic endpoints...');
  
  const config = loadEnvironmentConfig();
  const sessionToken = 'test'; // We'll use real token later
  
  // Test different API base URLs
  const baseUrls = [
    'https://api.traderepublic.com',
    'https://api.traderepublic.de', 
    'https://timeline.traderepublic.com',
    'https://portfolio.traderepublic.com',
    'https://app.traderepublic.com/api',
    'https://web.traderepublic.com/api',
    'https://client.traderepublic.com',
    'https://mobile.traderepublic.com'
  ];
  
  // Test different endpoint patterns
  const endpoints = [
    '/api/v1/portfolio/positions',
    '/api/v1/instruments/search',
    '/api/v1/instruments',
    '/api/v1/user/portfolio',
    '/api/v1/assets',
    '/api/portfolio',
    '/portfolio',
    '/instruments',
    '/search',
    '/v1/portfolio',
    '/v1/instruments'
  ];
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'TradeRepublic/Android 30/App Version 1.1.5534',
    'Authorization': `Bearer ${sessionToken}`
  };
  
  console.log('🧪 Testing endpoint combinations...');
  
  for (const baseUrl of baseUrls) {
    console.log(`\\n📡 Testing base URL: ${baseUrl}`);
    
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const contentType = response.headers.get('content-type') || '';
        const status = response.status;
        
        if (status === 200) {
          console.log(`  ✅ ${endpoint} - Status: ${status}, Type: ${contentType}`);
          
          if (contentType.includes('application/json')) {
            console.log(`    🎉 FOUND JSON ENDPOINT: ${url}`);
            try {
              const data = await response.text();
              console.log(`    📊 Response preview: ${data.substring(0, 200)}...`);
            } catch (e) {
              console.log(`    ⚠️ Could not read response body`);
            }
          }
        } else if (status === 401) {
          console.log(`  🔐 ${endpoint} - Authentication required (${status})`);
        } else if (status === 403) {
          console.log(`  🚫 ${endpoint} - Forbidden (${status})`);
        } else if (status === 404) {
          console.log(`  ❌ ${endpoint} - Not found (${status})`);
        } else {
          console.log(`  ⚠️ ${endpoint} - Status: ${status}, Type: ${contentType}`);
        }
        
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`  ⏰ ${endpoint} - Timeout`);
        } else {
          console.log(`  ❌ ${endpoint} - Error: ${error.message}`);
        }
      }
      
      // Small delay to be nice to servers
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\\n🔍 Endpoint discovery completed');
  console.log('💡 Look for endpoints that returned JSON content-type');
}

// Add timeout for whole script
const globalTimeout = setTimeout(() => {
  console.log('❌ GLOBAL TIMEOUT: Script taking too long');
  process.exit(1);
}, 60000); // 1 minute timeout

discoverWorkingEndpoints()
  .then(() => {
    clearTimeout(globalTimeout);
    console.log('✅ Discovery completed');
  })
  .catch((error) => {
    clearTimeout(globalTimeout);
    console.log(`❌ Discovery failed: ${error}`);
    process.exit(1);
  });
