#!/usr/bin/env tsx

/**
 * SIMPLE DATA ACCESS DEMO
 * Demonstrates data access without complex client dependencies
 */

import * as fs from 'fs';
import * as path from 'path';

interface SimpleAsset {
  isin: string;
  name?: string;
  ticker?: string;
  market: string;
  assetType: 'stock' | 'etf' | 'bond' | 'crypto' | 'unknown';
  lastPrice?: number;
  currency?: string;
  lastUpdated: string;
}

class SimpleDataAccess {
  private dataDirectory: string;

  constructor(dataDirectory: string = './data') {
    this.dataDirectory = dataDirectory;
  }

  /**
   * Get all assets from the latest export
   */
  async getAllAssets(): Promise<SimpleAsset[]> {
    try {
      const files = this.getLatestDataFiles();
      if (files.json && fs.existsSync(files.json)) {
        const data = JSON.parse(fs.readFileSync(files.json, 'utf8'));
        
        let assets: any[] = [];
        if (data.assets && Array.isArray(data.assets)) {
          assets = data.assets;
        }
        
        return assets.map(this.mapToSimpleAsset);
      }
      return [];
    } catch (error) {
      console.error('Failed to get assets:', error);
      return [];
    }
  }

  /**
   * Get assets by market
   */
  async getAssetsByMarket(market: string): Promise<SimpleAsset[]> {
    const allAssets = await this.getAllAssets();
    return allAssets.filter(asset => asset.market.includes(market));
  }

  /**
   * Get collection statistics
   */
  async getCollectionStatus() {
    try {
      const resultsPath = path.join(this.dataDirectory, 'production-results.json');
      if (fs.existsSync(resultsPath)) {
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        return {
          totalAssets: results.assetDiscovery?.totalAttempted || 0,
          successfulCollections: results.assetDiscovery?.successfulPrices || 0,
          failedCollections: results.assetDiscovery?.failedPrices || 0,
          successRate: results.assetDiscovery?.successRate || 0,
          lastCollectionTime: results.metadata?.endTime,
          markets: results.assetDiscovery?.markets || [],
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get collection status:', error);
      return null;
    }
  }

  /**
   * Get the most recent data files
   */
  getLatestDataFiles(): { json?: string; csv?: string; database: string } {
    const files: { json?: string; csv?: string; database: string } = {
      database: path.join(this.dataDirectory, 'production-assets.db')
    };

    try {
      const exportDir = path.join(this.dataDirectory, 'production-exports');
      if (fs.existsSync(exportDir)) {
        const exportFiles = fs.readdirSync(exportDir);
        
        const jsonFiles = exportFiles.filter(f => f.endsWith('.json')).sort().reverse();
        const csvFiles = exportFiles.filter(f => f.endsWith('.csv')).sort().reverse();
        
        if (jsonFiles.length > 0) {
          files.json = path.join(exportDir, jsonFiles[0]);
        }
        
        if (csvFiles.length > 0) {
          files.csv = path.join(exportDir, csvFiles[0]);
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return files;
  }

  /**
   * Helper method to map data to simple asset
   */
  private mapToSimpleAsset(data: any): SimpleAsset {
    return {
      isin: data.isin || data.ISIN,
      name: data.name || data.Name || `Asset_${data.isin || data.ISIN}`,
      ticker: data.ticker || data.symbol || data.Symbol,
      market: data.market || data.Market || this.inferMarketFromISIN(data.isin || data.ISIN),
      assetType: data.assetType || data.type || data.Type || 'stock',
      lastPrice: data.lastPrice || data.last_price || data.price,
      currency: data.currency || data.Currency || 'EUR',
      lastUpdated: data.lastUpdated || data.last_updated || new Date().toISOString()
    };
  }

  /**
   * Infer market from ISIN
   */
  private inferMarketFromISIN(isin: string): string {
    if (!isin) return 'Unknown';
    const countryCode = isin.substring(0, 2);
    const marketMap: Record<string, string> = {
      'US': 'US',
      'DE': 'DE',
      'IE': 'EU',
      'LU': 'EU',
      'GB': 'GB',
      'FR': 'FR',
      'NL': 'NL',
      'CH': 'CH'
    };
    return marketMap[countryCode] || 'Unknown';
  }
}

async function demonstrateDataAccess() {
  console.log('📊 Trade Republic Data Access Demo');
  console.log('=================================\n');
  
  const dataAccess = new SimpleDataAccess();
  
  try {
    // Get collection status
    const status = await dataAccess.getCollectionStatus();
    if (status) {
      console.log(`📈 Collection Status:`);
      console.log(`   Total Assets: ${status.totalAssets}`);
      console.log(`   Successful: ${status.successfulCollections}`);
      console.log(`   Failed: ${status.failedCollections}`);
      console.log(`   Success Rate: ${status.successRate.toFixed(1)}%`);
      console.log(`   Last Collection: ${new Date(status.lastCollectionTime).toLocaleString()}`);
      console.log(`   Markets: ${status.markets.join(', ')}\n`);
    }
    
    // Get data files
    const files = dataAccess.getLatestDataFiles();
    console.log(`📁 Available Data Files:`);
    if (files.json) console.log(`   📄 Latest JSON: ${files.json}`);
    if (files.csv) console.log(`   📊 Latest CSV: ${files.csv}`);
    console.log(`   🗄️  Database: ${files.database}\n`);
    
    // Get all assets
    const allAssets = await dataAccess.getAllAssets();
    console.log(`📦 Total Assets: ${allAssets.length}\n`);
    
    // Get assets by market
    const usAssets = await dataAccess.getAssetsByMarket('US');
    console.log(`🇺🇸 US Assets (${usAssets.length} total):`);
    usAssets.slice(0, 10).forEach(asset => {
      console.log(`   ${asset.isin} - ${asset.name} (${asset.assetType})`);
    });
    
    console.log();
    
    const deAssets = await dataAccess.getAssetsByMarket('DE');
    console.log(`🇩🇪 German Assets (${deAssets.length} total):`);
    deAssets.slice(0, 10).forEach(asset => {
      console.log(`   ${asset.isin} - ${asset.name} (${asset.assetType})`);
    });
    
    console.log();
    
    // Market distribution
    const marketDistribution = allAssets.reduce((acc, asset) => {
      acc[asset.market] = (acc[asset.market] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`🌍 Market Distribution:`);
    Object.entries(marketDistribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([market, count]) => {
        console.log(`   ${market}: ${count} assets`);
      });

    console.log('\n✅ Data access demonstration complete!');
    console.log('\n💡 To collect fresh data, run: npm run collect:assets');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

demonstrateDataAccess();
