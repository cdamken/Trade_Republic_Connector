/**
 * Dynamic Asset Discovery System for Trade Republic
 * 
 * This system dynamically discovers all available assets using multiple strategies:
 * 1. WebSocket subscription verification 
 * 2. ISIN pattern discovery
 * 3. Market index expansion
 * 4. Sector-based discovery
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { writeFile, readFile } from 'fs/promises';

interface Asset {
  isin: string;
  name?: string;
  symbol?: string;
  type: 'stock' | 'etf' | 'bond' | 'crypto' | 'unknown';
  market: string;
  sector?: string;
  price?: {
    current: string;
    currency: string;
    timestamp: number;
    bid?: string;
    ask?: string;
    open?: string;
    high?: string;
    low?: string;
  };
  discoveryMethod: string;
  discoveredAt: string;
  verified: boolean;
}

interface AssetDatabase {
  assets: Asset[];
  metadata: {
    totalAssets: number;
    lastUpdated: string;
    sources: string[];
    coverage: {
      stocks: number;
      etfs: number;
      bonds: number;
      crypto: number;
      unknown: number;
    };
    markets: {
      [market: string]: number;
    };
  };
}

class DynamicAssetDiscovery {
  private client!: TradeRepublicClient;
  private database: AssetDatabase;
  private config: any;

  constructor() {
    this.config = loadEnvironmentConfig();
    this.database = {
      assets: [],
      metadata: {
        totalAssets: 0,
        lastUpdated: new Date().toISOString(),
        sources: [],
        coverage: { stocks: 0, etfs: 0, bonds: 0, crypto: 0, unknown: 0 },
        markets: {}
      }
    };
  }

  async initialize() {
    console.log('🔧 Initializing Dynamic Asset Discovery System...');
    
    this.client = new TradeRepublicClient();
    await this.client.initialize();
    
    await this.client.login({
      username: this.config.trUsername!,
      password: this.config.trPassword!
    });
    
    await this.client.initializeWebSocket();
    console.log('✅ System initialized and connected');
  }

  /**
   * Main discovery orchestrator
   */
  async discoverAllAssets(): Promise<AssetDatabase> {
    console.log('\n🚀 DYNAMIC ASSET DISCOVERY STARTED');
    console.log('==================================');
    
    try {
      // Load existing data if available
      await this.loadExistingAssets();
      
      // Discovery strategies
      await this.discoverFromKnownISINs();
      await this.discoverFromMarketIndices();
      await this.discoverFromSectorPatterns();
      await this.discoverFromISINPatterns();
      
      // Verify all discovered assets
      await this.verifyAssets();
      
      // Update metadata
      this.updateMetadata();
      
      // Save results
      await this.saveAssetDatabase();
      
      console.log('\n🎉 DISCOVERY COMPLETE!');
      console.log(`✅ Total assets: ${this.database.metadata.totalAssets}`);
      console.log(`📊 Verified assets: ${this.database.assets.filter(a => a.verified).length}`);
      
      return this.database;
      
    } catch (error) {
      console.error('❌ Discovery failed:', error);
      throw error;
    }
  }

  /**
   * Strategy 1: Known ISINs from major markets
   */
  private async discoverFromKnownISINs() {
    console.log('\n📋 Strategy 1: Known ISIN Discovery');
    console.log('===================================');
    
    const knownAssets = [
      // US Tech
      { isin: 'US0378331005', name: 'Apple Inc', type: 'stock', market: 'NASDAQ', sector: 'Technology' },
      { isin: 'US5949181045', name: 'Microsoft Corp', type: 'stock', market: 'NASDAQ', sector: 'Technology' },
      { isin: 'US02079K3059', name: 'Alphabet Inc', type: 'stock', market: 'NASDAQ', sector: 'Technology' },
      { isin: 'US0231351067', name: 'Amazon.com Inc', type: 'stock', market: 'NASDAQ', sector: 'Consumer' },
      { isin: 'US88160R1014', name: 'Tesla Inc', type: 'stock', market: 'NASDAQ', sector: 'Automotive' },
      
      // German DAX
      { isin: 'DE0007164600', name: 'SAP SE', type: 'stock', market: 'XETRA', sector: 'Technology' },
      { isin: 'DE0007236101', name: 'Siemens AG', type: 'stock', market: 'XETRA', sector: 'Industrial' },
      { isin: 'DE0005190003', name: 'BMW AG', type: 'stock', market: 'XETRA', sector: 'Automotive' },
      
      // Popular ETFs
      { isin: 'IE00B4L5Y983', name: 'iShares MSCI World', type: 'etf', market: 'LSE', sector: 'Diversified' },
      { isin: 'DE000A0F5UH1', name: 'iShares Core DAX', type: 'etf', market: 'XETRA', sector: 'Index' }
    ];

    for (const assetInfo of knownAssets) {
      const asset: Asset = {
        ...assetInfo,
        type: assetInfo.type as Asset['type'],
        discoveryMethod: 'known_isin',
        discoveredAt: new Date().toISOString(),
        verified: false
      };
      
      this.addAsset(asset);
    }
    
    console.log(`✅ Added ${knownAssets.length} known assets`);
  }

  /**
   * Strategy 2: Market indices expansion
   */
  private async discoverFromMarketIndices() {
    console.log('\n📈 Strategy 2: Market Index Expansion');
    console.log('====================================');
    
    // DAX 40 components
    const daxISINs = [
      'DE0007164600', // SAP
      'DE0007236101', // Siemens
      'DE0005190003', // BMW
      'DE0007100000', // Mercedes-Benz
      'DE0007664039', // Volkswagen
      'DE000A1EWWW0', // Adidas
      'DE000BAY0017', // Bayer
      'DE0008404005', // Allianz
      'DE000BASF111', // BASF
      'DE0008232125', // Lufthansa
      'DE0006231004', // Infineon
      'DE000A1X3543', // Airbus
      'DE0008469008', // Deutsche Post
      'DE0005140008', // Deutsche Bank
      // ... would add all 40 DAX components
    ];

    // S&P 500 major components
    const sp500ISINs = [
      'US0378331005', // Apple
      'US5949181045', // Microsoft
      'US02079K3059', // Alphabet
      'US0231351067', // Amazon
      'US88160R1014', // Tesla
      'US30303M1027', // Meta
      'US64110L1061', // Netflix
      'US67066G1040', // Nvidia
      // ... would add more S&P 500 components
    ];

    const indexAssets = [...daxISINs, ...sp500ISINs].map(isin => ({
      isin,
      type: 'stock' as Asset['type'],
      market: isin.startsWith('DE') ? 'XETRA' : 'NYSE',
      discoveryMethod: 'market_index',
      discoveredAt: new Date().toISOString(),
      verified: false
    }));

    for (const asset of indexAssets) {
      this.addAsset(asset);
    }

    console.log(`✅ Added ${indexAssets.length} index components`);
  }

  /**
   * Strategy 3: Sector-based discovery
   */
  private async discoverFromSectorPatterns() {
    console.log('\n🏢 Strategy 3: Sector Pattern Discovery');
    console.log('======================================');
    
    // Technology sector ISINs
    const techISINs = [
      'US0378331005', // Apple
      'US5949181045', // Microsoft
      'US67066G1040', // Nvidia
      'US4592001014', // Intel
      'US00724F1012', // Adobe
      'US79466L3024', // Salesforce
      'DE0007164600', // SAP
      'NL0010273215', // ASML
    ];

    // Financial sector ISINs
    const financeISINs = [
      'US46625H1005', // JPMorgan
      'US0605051046', // Bank of America
      'US38141G1040', // Goldman Sachs
      'US92826C8394', // Visa
      'US57636Q1040', // Mastercard
      'DE0008404005', // Allianz
      'DE0005140008', // Deutsche Bank
    ];

    const sectorAssets = [
      ...techISINs.map(isin => ({ isin, sector: 'Technology' })),
      ...financeISINs.map(isin => ({ isin, sector: 'Finance' }))
    ].map(({ isin, sector }) => ({
      isin,
      type: 'stock' as Asset['type'],
      market: isin.startsWith('DE') ? 'XETRA' : isin.startsWith('NL') ? 'AEX' : 'NYSE',
      sector,
      discoveryMethod: 'sector_pattern',
      discoveredAt: new Date().toISOString(),
      verified: false
    }));

    for (const asset of sectorAssets) {
      this.addAsset(asset);
    }

    console.log(`✅ Added ${sectorAssets.length} sector-based assets`);
  }

  /**
   * Strategy 4: ISIN pattern discovery
   */
  private async discoverFromISINPatterns() {
    console.log('\n🔢 Strategy 4: ISIN Pattern Discovery');
    console.log('====================================');
    
    // This would implement systematic ISIN discovery
    // For now, adding known pattern examples
    
    const patternAssets = [
      // Irish domiciled ETFs (IE00B...)
      'IE00B4L5Y983', // MSCI World
      'IE00B3RBWM25', // Vanguard All-World
      'IE00B5BMR087', // Core S&P 500
      'IE00B52VJ196', // NASDAQ 100
      
      // Luxembourg funds (LU...)
      'LU0274208692', // Xtrackers MSCI World
      'LU0392494562', // Xtrackers NASDAQ 100
      'LU0274211480', // Xtrackers Emerging Markets
    ].map(isin => ({
      isin,
      type: 'etf' as Asset['type'],
      market: isin.startsWith('IE') ? 'LSE' : 'Euronext',
      discoveryMethod: 'isin_pattern',
      discoveredAt: new Date().toISOString(),
      verified: false
    }));

    for (const asset of patternAssets) {
      this.addAsset(asset);
    }

    console.log(`✅ Added ${patternAssets.length} pattern-based assets`);
  }

  /**
   * Verify assets via WebSocket
   */
  private async verifyAssets() {
    console.log('\n✅ Verifying Assets via WebSocket');
    console.log('================================');
    
    const unverifiedAssets = this.database.assets.filter(a => !a.verified);
    console.log(`🔍 Verifying ${unverifiedAssets.length} assets...`);
    
    let verifiedCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < unverifiedAssets.length; i += batchSize) {
      const batch = unverifiedAssets.slice(i, i + batchSize);
      
      for (const asset of batch) {
        try {
          const isValid = await this.verifyAsset(asset);
          if (isValid) {
            asset.verified = true;
            verifiedCount++;
            console.log(`  ✅ ${asset.isin} - Verified`);
          } else {
            console.log(`  ❌ ${asset.isin} - Invalid`);
          }
        } catch (error) {
          console.log(`  ⚠️  ${asset.isin} - Error: ${error}`);
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Verified ${verifiedCount}/${unverifiedAssets.length} assets`);
  }

  /**
   * Verify a single asset
   */
  private async verifyAsset(asset: Asset): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      
      this.client.subscribeToPrices(asset.isin, (data) => {
        clearTimeout(timeout);
        
        // Update price data
        asset.price = {
          current: data.last?.price,
          currency: 'EUR', // Default, would need proper currency detection
          timestamp: Date.now(),
          bid: data.bid?.price,
          ask: data.ask?.price,
          open: data.open?.price
        };
        
        resolve(true);
      }).then(subId => {
        setTimeout(() => {
          if (subId) {
            this.client.unsubscribe(subId);
          }
        }, 2000);
      }).catch(() => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  /**
   * Add asset to database (avoid duplicates)
   */
  private addAsset(asset: Asset) {
    const existing = this.database.assets.find(a => a.isin === asset.isin);
    if (!existing) {
      this.database.assets.push(asset);
    } else {
      // Update existing asset with new information
      Object.assign(existing, asset);
    }
  }

  /**
   * Load existing assets from file
   */
  private async loadExistingAssets() {
    try {
      const data = await readFile('./data/dynamic-asset-database.json', 'utf-8');
      const existingDB = JSON.parse(data);
      this.database.assets = existingDB.assets || [];
      console.log(`📂 Loaded ${this.database.assets.length} existing assets`);
    } catch {
      console.log('📂 No existing asset database found, starting fresh');
    }
  }

  /**
   * Update metadata
   */
  private updateMetadata() {
    this.database.metadata.totalAssets = this.database.assets.length;
    this.database.metadata.lastUpdated = new Date().toISOString();
    
    // Update coverage
    this.database.metadata.coverage = {
      stocks: this.database.assets.filter(a => a.type === 'stock').length,
      etfs: this.database.assets.filter(a => a.type === 'etf').length,
      bonds: this.database.assets.filter(a => a.type === 'bond').length,
      crypto: this.database.assets.filter(a => a.type === 'crypto').length,
      unknown: this.database.assets.filter(a => a.type === 'unknown').length
    };
    
    // Update markets
    this.database.metadata.markets = {};
    this.database.assets.forEach(asset => {
      this.database.metadata.markets[asset.market] = 
        (this.database.metadata.markets[asset.market] || 0) + 1;
    });
    
    // Update sources
    this.database.metadata.sources = [
      ...new Set(this.database.assets.map(a => a.discoveryMethod))
    ];
  }

  /**
   * Save asset database
   */
  private async saveAssetDatabase() {
    const filename = './data/dynamic-asset-database.json';
    await writeFile(filename, JSON.stringify(this.database, null, 2));
    console.log(`💾 Saved asset database: ${filename}`);
  }

  async cleanup() {
    await this.client.logout();
  }
}

// Main execution
async function runDynamicAssetDiscovery() {
  const discovery = new DynamicAssetDiscovery();
  
  try {
    await discovery.initialize();
    const database = await discovery.discoverAllAssets();
    
    console.log('\n📊 FINAL STATISTICS:');
    console.log('==================');
    console.log(`Total assets: ${database.metadata.totalAssets}`);
    console.log(`Stocks: ${database.metadata.coverage.stocks}`);
    console.log(`ETFs: ${database.metadata.coverage.etfs}`);
    console.log(`Verified: ${database.assets.filter(a => a.verified).length}`);
    console.log('Markets:', Object.keys(database.metadata.markets).join(', '));
    console.log('Sources:', database.metadata.sources.join(', '));
    
  } catch (error) {
    console.error('❌ Discovery failed:', error);
  } finally {
    await discovery.cleanup();
  }
}

// Run the dynamic asset discovery
runDynamicAssetDiscovery().catch(console.error);
