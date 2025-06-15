#!/usr/bin/env node
/**
 * Database Explorer Script
 * Explore and analyze the collected market data
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'comprehensive-assets.db');

try {
  const db = new Database(dbPath);

  console.log('🗄️  Trade Republic Market Data Database Explorer');
  console.log('================================================\n');

  // Check if database exists and has data
  const countResult = db.prepare('SELECT COUNT(*) as count FROM assets').get();
  console.log(`📊 Total Assets in Database: ${countResult.count}\n`);

  if (countResult.count === 0) {
    console.log('⚠️  No data found. Please run the enhanced data collection script to collect real data first.');
    console.log('   Available commands:');
    console.log('   - npm run cli:login  (authenticate first)');
    console.log('   - tsx examples/enhanced-data-collection.ts  (collect real asset data)');
    process.exit(0);
  }

  // Asset overview
  console.log('🏢 Asset Overview:');
  console.log('==================');
  const assets = db.prepare(`
    SELECT isin, name, current_price, currency, day_change_percentage, sector, market_cap 
    FROM assets 
    ORDER BY market_cap DESC
  `).all();

  assets.forEach((asset, i) => {
    const change = asset.day_change_percentage || 0;
    const changeIcon = change >= 0 ? '📈' : '📉';
    const marketCapB = asset.market_cap ? (asset.market_cap / 1e9).toFixed(2) : 'N/A';
    
    console.log(`${i + 1}. ${asset.name.replace('Asset ', '')}`);
    console.log(`   ISIN: ${asset.isin}`);
    console.log(`   Price: €${Number(asset.current_price).toFixed(2)} ${changeIcon} ${change.toFixed(2)}%`);
    console.log(`   Market Cap: €${marketCapB}B`);
    console.log(`   Sector: ${asset.sector}`);
    console.log('');
  });

  // Sector analysis
  console.log('🎯 Sector Analysis:');
  console.log('===================');
  const sectors = db.prepare(`
    SELECT 
      sector,
      COUNT(*) as count,
      AVG(current_price) as avg_price,
      AVG(market_cap) as avg_market_cap,
      AVG(day_change_percentage) as avg_change
    FROM assets 
    GROUP BY sector 
    ORDER BY count DESC
  `).all();

  sectors.forEach(sector => {
    const avgChange = sector.avg_change || 0;
    const changeIcon = avgChange >= 0 ? '📈' : '📉';
    
    console.log(`🏢 ${sector.sector}:`);
    console.log(`   Assets: ${sector.count}`);
    console.log(`   Avg Price: €${Number(sector.avg_price).toFixed(2)}`);
    console.log(`   Avg Market Cap: €${(sector.avg_market_cap / 1e9).toFixed(2)}B`);
    console.log(`   Avg Change: ${changeIcon} ${avgChange.toFixed(2)}%`);
    console.log('');
  });

  // Performance summary
  console.log('📈 Performance Summary:');
  console.log('=======================');
  const performance = db.prepare(`
    SELECT 
      COUNT(*) as total,
      AVG(current_price) as avg_price,
      MIN(current_price) as min_price,
      MAX(current_price) as max_price,
      AVG(day_change_percentage) as avg_change,
      COUNT(CASE WHEN day_change_percentage > 0 THEN 1 END) as gainers,
      COUNT(CASE WHEN day_change_percentage < 0 THEN 1 END) as losers,
      SUM(market_cap) as total_market_cap
    FROM assets
  `).get();

  console.log(`📊 Total Assets: ${performance.total}`);
  console.log(`💰 Average Price: €${Number(performance.avg_price).toFixed(2)}`);
  console.log(`📉 Price Range: €${Number(performance.min_price).toFixed(2)} - €${Number(performance.max_price).toFixed(2)}`);
  console.log(`📈 Average Change: ${Number(performance.avg_change).toFixed(2)}%`);
  console.log(`🟢 Gainers: ${performance.gainers}`);
  console.log(`🔴 Losers: ${performance.losers}`);
  console.log(`💹 Total Market Cap: €${(performance.total_market_cap / 1e9).toFixed(2)}B`);
  console.log('');

  // Trade Republic specific data
  console.log('🏦 Trade Republic Information:');
  console.log('==============================');
  const trInfo = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN tr_tradable = 1 THEN 1 END) as tradable,
      COUNT(CASE WHEN tr_fractional = 1 THEN 1 END) as fractional,
      COUNT(CASE WHEN tr_savings_plan = 1 THEN 1 END) as savings_plan
    FROM assets
  `).get();

  console.log(`📊 Total Assets: ${trInfo.total}`);
  console.log(`✅ Tradable: ${trInfo.tradable}/${trInfo.total}`);
  console.log(`🔢 Fractional Trading: ${trInfo.fractional}/${trInfo.total}`);
  console.log(`💰 Savings Plan Available: ${trInfo.savings_plan}/${trInfo.total}`);
  console.log('');

  // Recent updates
  console.log('🕒 Data Freshness:');
  console.log('==================');
  const freshness = db.prepare(`
    SELECT 
      MIN(last_updated) as oldest,
      MAX(last_updated) as newest,
      COUNT(DISTINCT last_updated) as update_sessions
    FROM assets
  `).get();

  console.log(`📅 Oldest Data: ${new Date(freshness.oldest).toLocaleString()}`);
  console.log(`🆕 Newest Data: ${new Date(freshness.newest).toLocaleString()}`);
  console.log(`🔄 Update Sessions: ${freshness.update_sessions}`);
  console.log('');

  console.log('✅ Database exploration complete!');
  console.log('\n🔧 Advanced Analysis Options:');
  console.log('   - SQLite Browser: https://sqlitebrowser.org/');
  console.log(`   - Command line: sqlite3 ${dbPath}`);
  console.log('   - VS Code SQLite extension');
  console.log('\n📊 Export data:');
  console.log('   - CSV: sqlite3 -header -csv database.db "SELECT * FROM assets;" > assets.csv');
  console.log('   - JSON: Use the API or write custom scripts');

  db.close();

} catch (error) {
  console.error('❌ Database error:', error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('   1. Make sure you have collected data: tsx examples/enhanced-data-collection.ts');
  console.log('   2. Check if database file exists:', dbPath);
  console.log('   3. Verify database permissions');
  process.exit(1);
}
