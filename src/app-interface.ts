#!/usr/bin/env tsx

/**
 * SIMPLIFIED APP DATA INTERFACE
 * Clean interface for apps to access Trade Republic asset data
 * 
 * This provides a simple, clean API for applications to:
 * ✅ Access stored asset data
 * ✅ Get real-time prices
 * ✅ Export data in multiple formats
 * ✅ Monitor collection progress
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client';
import { AssetDatabaseManager } from '../src/database/asset-database';
import { logger } from '../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface SimpleAsset {
  isin: string;
  name?: string;
  ticker?: string;
  market: string;
  assetType: 'stock' | 'etf' | 'bond' | 'crypto' | 'unknown';
  lastPrice?: number;
  currency?: string;
  lastUpdated: string;
}

export interface PriceInfo {
  isin: string;
  price: number;
  bid?: number;
  ask?: number;
  timestamp: number;
  currency: string;
}

export interface CollectionStatus {
  totalAssets: number;
  successfulCollections: number;
  failedCollections: number;
  successRate: number;
  lastCollectionTime: string;
  markets: string[];
  assetTypes: string[];
}

/**
 * Simple App Data Interface
 * Clean API for accessing Trade Republic data in applications
 */
class TradeRepublicAppInterface {
  private client: TradeRepublicClient;
  private database: AssetDatabaseManager;
  private dataDirectory: string;

  constructor(dataDirectory: string = './data') {
    this.client = new TradeRepublicClient();
    this.database = new AssetDatabaseManager(path.join(dataDirectory, 'assets.db'));
    this.dataDirectory = dataDirectory;
  }

  /**
   * Get all assets stored in the database
   */
  async getAllAssets(): Promise<SimpleAsset[]> {
    try {
      // Simple implementation - read from exported JSON if available
      const files = this.getLatestDataFiles();
      if (files.json && fs.existsSync(files.json)) {
        const data = JSON.parse(fs.readFileSync(files.json, 'utf8'));
        
        // Handle different JSON structures
        let assets: any[] = [];
        if (data.assets && Array.isArray(data.assets)) {
          assets = data.assets;
        } else if (Array.isArray(data)) {
          assets = data;
        } else {
          // Search for assets array in the data structure
          for (const key in data) {
            if (Array.isArray(data[key]) && data[key].length > 0 && data[key][0].isin) {
              assets = data[key];
              break;
            }
          }
        }
        
        return assets.map(this.mapToSimpleAsset);
      }
      return [];
    } catch (error) {
      logger.error('Failed to get assets:', error);
      return [];
    }
  }

  /**
   * Get assets by market (US, DE, EU, etc.)
   */
  async getAssetsByMarket(market: string): Promise<SimpleAsset[]> {
    try {
      const allAssets = await this.getAllAssets();
      return allAssets.filter(asset => asset.market.includes(market));
    } catch (error) {
      logger.error(`Failed to get assets for market ${market}:`, error);
      return [];
    }
  }

  /**
   * Get assets by type (stock, etf, etc.)
   */
  async getAssetsByType(assetType: 'stock' | 'etf' | 'bond' | 'crypto' | 'unknown'): Promise<SimpleAsset[]> {
    try {
      const allAssets = await this.getAllAssets();
      return allAssets.filter(asset => asset.assetType === assetType);
    } catch (error) {
      logger.error(`Failed to get assets for type ${assetType}:`, error);
      return [];
    }
  }

  /**
   * Get real-time price for a specific asset
   */
  async getRealTimePrice(isin: string): Promise<PriceInfo | null> {
    try {
      // For this simplified version, return cached price data if available
      const allAssets = await this.getAllAssets();
      const asset = allAssets.find(a => a.isin === isin);
      
      if (asset && asset.lastPrice) {
        return {
          isin,
          price: asset.lastPrice,
          timestamp: Date.now(),
          currency: asset.currency || 'EUR'
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get real-time price for ${isin}:`, error);
      return null;
    }
  }

  /**
   * Get collection status and statistics
   */
  async getCollectionStatus(): Promise<CollectionStatus> {
    try {
      const allAssets = await this.getAllAssets();
      const markets = [...new Set(allAssets.map(a => a.market))];
      const assetTypes = [...new Set(allAssets.map(a => a.assetType))];
      
      // Read latest collection results if available
      let successfulCollections = allAssets.length;
      let failedCollections = 0;
      let lastCollectionTime = new Date().toISOString();
      
      try {
        const resultsPath = path.join(this.dataDirectory, 'production-results.json');
        if (fs.existsSync(resultsPath)) {
          const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
          successfulCollections = results.assetDiscovery?.successfulPrices || allAssets.length;
          failedCollections = results.assetDiscovery?.failedPrices || 0;
          lastCollectionTime = results.metadata?.endTime || lastCollectionTime;
        }
      } catch (error) {
        // Ignore errors reading results file
      }

      const totalAssets = successfulCollections + failedCollections;
      const successRate = totalAssets > 0 ? (successfulCollections / totalAssets) * 100 : 0;

      return {
        totalAssets,
        successfulCollections,
        failedCollections,
        successRate,
        lastCollectionTime,
        markets,
        assetTypes
      };
    } catch (error) {
      logger.error('Failed to get collection status:', error);
      return {
        totalAssets: 0,
        successfulCollections: 0,
        failedCollections: 0,
        successRate: 0,
        lastCollectionTime: new Date().toISOString(),
        markets: [],
        assetTypes: []
      };
    }
  }

  /**
   * Export data in different formats
   */
  async exportData(format: 'json' | 'csv', outputPath?: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = outputPath || path.join(this.dataDirectory, `export-${timestamp}.${format}`);

      // Simple export from existing data
      const allAssets = await this.getAllAssets();
      
      if (format === 'json') {
        fs.writeFileSync(fileName, JSON.stringify(allAssets, null, 2));
      } else if (format === 'csv') {
        const csvContent = this.convertToCSV(allAssets);
        fs.writeFileSync(fileName, csvContent);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      return fileName;
    } catch (error) {
      logger.error(`Failed to export data as ${format}:`, error);
      throw error;
    }
  }

  /**
   * Convert assets to CSV format
   */
  private convertToCSV(assets: SimpleAsset[]): string {
    if (assets.length === 0) return '';
    
    const headers = Object.keys(assets[0]).join(',');
    const rows = assets.map(asset => 
      Object.values(asset).map(value => 
        typeof value === 'string' ? `"${value}"` : value
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  /**
   * Search for assets by name or ISIN
   */
  async searchAssets(query: string): Promise<SimpleAsset[]> {
    try {
      const allAssets = await this.getAllAssets();
      const lowerQuery = query.toLowerCase();
      
      return allAssets.filter(asset => 
        asset.isin.toLowerCase().includes(lowerQuery) ||
        asset.name?.toLowerCase().includes(lowerQuery) ||
        asset.ticker?.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      logger.error(`Failed to search assets with query "${query}":`, error);
      return [];
    }
  }

  /**
   * Get the most recent data file paths
   */
  getLatestDataFiles(): { json?: string; csv?: string; database: string } {
    try {
      const files: { json?: string; csv?: string; database: string } = {
        database: path.join(this.dataDirectory, 'production-assets.db')
      };

      // Look for latest exports
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

      return files;
    } catch (error) {
      logger.error('Failed to get latest data files:', error);
      return {
        database: path.join(this.dataDirectory, 'production-assets.db')
      };
    }
  }

  /**
   * Check if the client is ready for data collection
   */
  async isReady(): Promise<{ ready: boolean; message: string }> {
    try {
      // For this simplified version, just check if we have data available
      const files = this.getLatestDataFiles();
      
      if (files.json && fs.existsSync(files.json)) {
        return {
          ready: true,
          message: 'Data available from previous collection. Use collect:assets to refresh.'
        };
      }

      return {
        ready: false,
        message: 'No data available. Run "npm run collect:assets" to collect asset data first.'
      };
    } catch (error) {
      return {
        ready: false,
        message: `System not ready: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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

/**
 * Quick utility functions for common operations
 */
class TradeRepublicUtils {
  
  /**
   * Get summary statistics
   */
  static async getQuickStats(dataInterface: TradeRepublicAppInterface): Promise<any> {
    const status = await dataInterface.getCollectionStatus();
    const assets = await dataInterface.getAllAssets();
    
    const marketDistribution = status.markets.reduce((acc, market) => {
      acc[market] = assets.filter(a => a.market === market).length;
      return acc;
    }, {} as Record<string, number>);

    const typeDistribution = status.assetTypes.reduce((acc, type) => {
      acc[type] = assets.filter(a => a.assetType === type).length;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAssets: status.totalAssets,
      successRate: status.successRate,
      lastCollection: status.lastCollectionTime,
      marketDistribution,
      typeDistribution,
      topMarkets: Object.entries(marketDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      dataFiles: dataInterface.getLatestDataFiles()
    };
  }

  /**
   * Validate ISIN format
   */
  static validateISIN(isin: string): boolean {
    return /^[A-Z]{2}[A-Z0-9]{10}$/.test(isin);
  }

  /**
   * Extract market from ISIN
   */
  static getMarketFromISIN(isin: string): string {
    const countryCode = isin.substring(0, 2);
    const marketMap: Record<string, string> = {
      'US': 'United States',
      'DE': 'Germany',
      'IE': 'Ireland/International',
      'GB': 'United Kingdom',
      'FR': 'France',
      'NL': 'Netherlands',
      'CH': 'Switzerland',
      'LU': 'Luxembourg'
    };
    return marketMap[countryCode] || 'Unknown';
  }
}

// Export classes for use in other modules
export { TradeRepublicAppInterface, TradeRepublicUtils };
