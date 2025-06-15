/**
 * Trade Republic API Endpoint Discovery & Analysis
 * 
 * This script analyzes the TR API structure and discovers available endpoints
 * for dynamic asset discovery and data collection.
 * 
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { writeFile } from 'fs/promises';

interface APIEndpoint {
  url: string;
  method: string;
  purpose: string;
  status: 'working' | 'html' | 'error' | 'unknown';
  response?: any;
  notes?: string;
}

interface APIAnalysisResults {
  restEndpoints: APIEndpoint[];
  websocketEndpoints: {
    baseUrl: string;
    subscriptionTypes: string[];
    workingSubscriptions: string[];
    failedSubscriptions: string[];
  };
  discoveredAssets: {
    totalFound: number;
    sources: string[];
    sampleAssets: any[];
  };
  recommendations: {
    primaryMethod: string;
    assetDiscovery: string;
    dataCollection: string;
    scalability: string;
  };
}

async function analyzeTradeRepublicAPI() {
  console.log('\n🔍 TRADE REPUBLIC API ANALYSIS & ENDPOINT DISCOVERY');
  console.log('===================================================');
  console.log('🎯 Goal: Map all available endpoints and data sources');
  console.log('📡 Method: Systematic testing of REST + WebSocket endpoints');
  
  const config = loadEnvironmentConfig();
  
  const results: APIAnalysisResults = {
    restEndpoints: [],
    websocketEndpoints: {
      baseUrl: 'wss://api.traderepublic.com',
      subscriptionTypes: [],
      workingSubscriptions: [],
      failedSubscriptions: []
    },
    discoveredAssets: {
      totalFound: 0,
      sources: [],
      sampleAssets: []
    },
    recommendations: {
      primaryMethod: '',
      assetDiscovery: '',
      dataCollection: '',
      scalability: ''
    }
  };

  try {
    console.log('\n🔐 Step 1: Authenticate');
    console.log('=======================');
    
    const client = new TradeRepublicClient();
    await client.initialize();
    
    const session = await client.login({
      username: config.trUsername!,
      password: config.trPassword!
    });
    
    console.log('✅ Authentication successful!');

    console.log('\n🌐 Step 2: REST API Endpoint Analysis');
    console.log('====================================');
    
    const baseUrl = 'https://api.traderepublic.com';
    const potentialEndpoints = [
      { path: '/api/v1/assets', purpose: 'List all assets' },
      { path: '/api/v1/instruments', purpose: 'List instruments' },
      { path: '/api/v1/universe', purpose: 'Universe of assets' },
      { path: '/api/v1/search', purpose: 'Search assets' },
      { path: '/api/v1/portfolio', purpose: 'Portfolio data' },
      { path: '/api/v1/timeline', purpose: 'Timeline/activity' },
      { path: '/api/v1/user/portfolio', purpose: 'User portfolio' },
      { path: '/api/v1/instruments/search', purpose: 'Instrument search' },
      { path: '/api/v1/prices', purpose: 'Price data' },
      { path: '/api/v1/quotes', purpose: 'Quote data' },
      { path: '/api/v2/assets', purpose: 'Assets v2' },
      { path: '/api/v2/instruments', purpose: 'Instruments v2' },
      { path: '/universe', purpose: 'Asset universe' },
      { path: '/instruments', purpose: 'All instruments' },
      { path: '/search', purpose: 'Global search' },
      { path: '/portfolio', purpose: 'Portfolio endpoint' },
      { path: '/quotes', purpose: 'Market quotes' },
      { path: '/prices', purpose: 'Price feeds' }
    ];

    for (const endpoint of potentialEndpoints) {
      console.log(`  🔍 Testing: ${endpoint.path}`);
      
      const result = await testRESTEndpoint(baseUrl + endpoint.path, session.token.accessToken, endpoint.purpose);
      results.restEndpoints.push(result);
      
      if (result.status === 'working') {
        console.log(`    ✅ ${endpoint.path} - WORKING`);
      } else if (result.status === 'html') {
        console.log(`    ⚠️  ${endpoint.path} - Returns HTML (Web UI)`);
      } else {
        console.log(`    ❌ ${endpoint.path} - ${result.status}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📡 Step 3: WebSocket Subscription Analysis');
    console.log('==========================================');
    
    await client.initializeWebSocket();
    const wsStatus = client.getWebSocketStatus();
    
    if (wsStatus.connected) {
      console.log('✅ WebSocket connected - testing subscription types');
      
      // Test different subscription types
      const subscriptionTypes = [
        { type: 'ticker', payload: { id: 'US0378331005.LSX' }, purpose: 'Price data' },
        { type: 'portfolio', payload: {}, purpose: 'Portfolio data' },
        { type: 'timeline', payload: {}, purpose: 'Activity timeline' },
        { type: 'positions', payload: {}, purpose: 'Position data' },
        { type: 'cash', payload: {}, purpose: 'Cash balance' },
        { type: 'instrument', payload: { id: 'US0378331005' }, purpose: 'Instrument details' },
        { type: 'universe', payload: {}, purpose: 'Asset universe' },
        { type: 'search', payload: { query: 'Apple' }, purpose: 'Search results' },
        { type: 'quotes', payload: { id: 'US0378331005' }, purpose: 'Real-time quotes' },
        { type: 'watchlist', payload: {}, purpose: 'Watchlist data' }
      ];

      for (const sub of subscriptionTypes) {
        console.log(`  📊 Testing subscription: ${sub.type}`);
        
        try {
          const subId = await client.websocket?.subscribe(sub.type, sub.payload, (data) => {
            console.log(`    ✅ ${sub.type} - Data received:`, Object.keys(data).length > 0 ? Object.keys(data) : 'Empty');
            results.websocketEndpoints.workingSubscriptions.push(sub.type);
          });
          
          results.websocketEndpoints.subscriptionTypes.push(sub.type);
          
          // Wait for response
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (subId) {
            await client.unsubscribe(subId);
          }
          
        } catch (error) {
          console.log(`    ❌ ${sub.type} - Failed: ${error}`);
          results.websocketEndpoints.failedSubscriptions.push(sub.type);
        }
      }
    }

    console.log('\n🔍 Step 4: Asset Discovery Analysis');
    console.log('===================================');
    
    // Analyze the data we've collected from working methods
    const bulkData = await loadExistingAssetData();
    if (bulkData) {
      results.discoveredAssets.totalFound = bulkData.discoveredAssets?.length || 0;
      results.discoveredAssets.sources = ['websocket_price_verification', 'known_isins'];
      results.discoveredAssets.sampleAssets = bulkData.discoveredAssets?.slice(0, 10) || [];
      
      console.log(`✅ Found ${results.discoveredAssets.totalFound} assets from previous collection`);
      console.log('📊 Sample assets:', results.discoveredAssets.sampleAssets.map(a => a.isin).join(', '));
    }

    console.log('\n🎯 Step 5: Generate Recommendations');
    console.log('===================================');
    
    // Analyze results and generate recommendations
    const workingREST = results.restEndpoints.filter(e => e.status === 'working').length;
    const workingWS = results.websocketEndpoints.workingSubscriptions.length;
    
    results.recommendations = {
      primaryMethod: workingWS > 0 ? 'WebSocket' : workingREST > 0 ? 'REST' : 'Manual',
      assetDiscovery: results.discoveredAssets.totalFound > 50 ? 'Known ISIN expansion' : 'Manual ISIN collection',
      dataCollection: 'WebSocket real-time subscriptions',
      scalability: results.discoveredAssets.totalFound > 50 ? 'Production ready' : 'Needs more asset sources'
    };

    console.log('📊 API Analysis Summary:');
    console.log(`   REST endpoints working: ${workingREST}/${results.restEndpoints.length}`);
    console.log(`   WebSocket subscriptions working: ${workingWS}/${results.websocketEndpoints.subscriptionTypes.length}`);
    console.log(`   Assets discovered: ${results.discoveredAssets.totalFound}`);
    console.log(`   Primary method: ${results.recommendations.primaryMethod}`);

    await client.logout();

    console.log('\n💾 Step 6: Save API Analysis');
    console.log('============================');
    
    const filename = './data/api-analysis-results.json';
    await writeFile(filename, JSON.stringify(results, null, 2));
    
    console.log('\n🎉 API ANALYSIS COMPLETE!');
    console.log('=========================');
    console.log(`📁 Results saved: ${filename}`);
    console.log(`🔧 Primary method: ${results.recommendations.primaryMethod}`);
    console.log(`📊 Asset discovery: ${results.recommendations.assetDiscovery}`);
    console.log(`⚡ Data collection: ${results.recommendations.dataCollection}`);
    console.log(`🚀 Scalability: ${results.recommendations.scalability}`);

  } catch (error) {
    console.log(`❌ API analysis failed: ${error}`);
  }
}

/**
 * Test a REST endpoint
 */
async function testRESTEndpoint(url: string, token: string, purpose: string): Promise<APIEndpoint> {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Trade Republic/5127 CFNetwork/1492.0.1 Darwin/23.3.0',
        'Accept': 'application/json'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(text);
        return {
          url,
          method: 'GET',
          purpose,
          status: 'working',
          response: data,
          notes: `JSON response with ${Object.keys(data).length} top-level keys`
        };
      } catch {
        return {
          url,
          method: 'GET',
          purpose,
          status: 'error',
          notes: 'Invalid JSON response'
        };
      }
    } else if (contentType.includes('text/html')) {
      return {
        url,
        method: 'GET',
        purpose,
        status: 'html',
        notes: 'Returns HTML web interface'
      };
    } else {
      return {
        url,
        method: 'GET',
        purpose,
        status: 'error',
        notes: `Unexpected content type: ${contentType}`
      };
    }

  } catch (error) {
    return {
      url,
      method: 'GET',
      purpose,
      status: 'error',
      notes: `Request failed: ${error}`
    };
  }
}

/**
 * Load existing asset data from previous collections
 */
async function loadExistingAssetData(): Promise<any> {
  try {
    const fs = await import('fs/promises');
    const data = await fs.readFile('./data/bulk-asset-collection.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Run the API analysis
analyzeTradeRepublicAPI().catch(console.error);
