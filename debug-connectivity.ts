#!/usr/bin/env tsx

import { TradeRepublicAPI } from './src/api/trade-republic-api.js';

async function testConnectivity() {
  console.log('Testing Trade Republic API connectivity...');
  
  const api = new TradeRepublicAPI();
  
  try {
    console.log('Testing connection...');
    const isConnected = await api.testConnection();
    console.log('Connection result:', isConnected);
    
    if (isConnected) {
      console.log('✅ Successfully connected to Trade Republic servers');
    } else {
      console.log('❌ Failed to connect to Trade Republic servers');
    }
  } catch (error) {
    console.error('❌ Error testing connectivity:', error);
  }
}

testConnectivity().catch(console.error);
