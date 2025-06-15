/**
 * Debug WebSocket Test with Timeouts
 * Quick test to see what's happening with timeouts
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';

async function debugTest() {
  console.log('🔍 Starting debug test with timeouts...');
  
  const timeout = setTimeout(() => {
    console.log('❌ TIMEOUT: Script taking too long, forcing exit');
    process.exit(1);
  }, 10000); // 10 second timeout
  
  try {
    const config = loadEnvironmentConfig();
    console.log(`📱 Phone: ${config.trUsername}`);
    console.log(`🌐 API: ${config.apiUrl}`);
    
    console.log('🔧 Creating client...');
    const client = new TradeRepublicClient();
    
    console.log('🔧 Initializing client...');
    await client.initialize();
    
    console.log('✅ Client initialized successfully');
    
    if (!client.isAuthenticated()) {
      console.log('🔓 Not authenticated, attempting login...');
      
      const loginTimeout = setTimeout(() => {
        console.log('❌ LOGIN TIMEOUT: Login taking too long');
        clearTimeout(timeout);
        process.exit(1);
      }, 5000);
      
      const session = await client.login({
        username: config.trUsername!,
        password: config.trPassword!
      });
      
      clearTimeout(loginTimeout);
      console.log(`✅ Login successful: ${session.userId}`);
    } else {
      console.log('✅ Already authenticated');
    }
    
    console.log('🔍 Testing simple operation...');
    
    // Try a simple operation with timeout
    const opTimeout = setTimeout(() => {
      console.log('❌ OPERATION TIMEOUT: Operation taking too long');
      clearTimeout(timeout);
      process.exit(1);
    }, 5000);
    
    try {
      console.log('📊 Testing portfolio access...');
      const positions = await client.portfolio.getPositions();
      console.log(`📈 Portfolio positions: ${positions.length}`);
      clearTimeout(opTimeout);
    } catch (error) {
      clearTimeout(opTimeout);
      console.log(`⚠️ Portfolio error: ${error}`);
    }
    
    await client.logout();
    clearTimeout(timeout);
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    clearTimeout(timeout);
    console.log(`❌ Error: ${error}`);
    process.exit(1);
  }
}

debugTest().catch((error) => {
  console.log(`❌ Unhandled error: ${error}`);
  process.exit(1);
});
