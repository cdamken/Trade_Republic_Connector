#!/usr/bin/env node

/**
 * SQLite Database Explorer for Trade Republic Data
 * 
 * This script helps you explore and query your Trade Republic database
 * with common queries and examples.
 */

import Database from 'better-sqlite3';
import { readdir } from 'fs/promises';
import path from 'path';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

async function findDatabases() {
  try {
    const productionDir = './data/production';
    const testDir = './tests/databases';
    
    const databases: string[] = [];
    
    // Production databases (priority)
    try {
      const prodFiles = await readdir(productionDir);
      databases.push(...prodFiles.filter(file => file.endsWith('.db')).map(file => path.join(productionDir, file)));
    } catch {}
    
    // Test databases (if no production data found)
    if (databases.length === 0) {
      try {
        const testFiles = await readdir(testDir);
        databases.push(...testFiles.filter(file => file.endsWith('.db')).map(file => path.join(testDir, file)));
      } catch {}
    }
    
    return databases;
  } catch {
    return [];
  }
}

function formatTable(rows: any[], title: string) {
  if (!rows || rows.length === 0) {
    console.log(`${colors.yellow}No data found for ${title}${colors.reset}\n`);
    return;
  }

  console.log(`${colors.bright}${colors.blue}=== ${title} ===${colors.reset}`);
  console.table(rows);
  console.log(`${colors.green}Found ${rows.length} record(s)${colors.reset}\n`);
}

function exploreDatabase(dbPath: string) {
  console.log(`${colors.bright}${colors.cyan}📊 Exploring database: ${dbPath}${colors.reset}\n`);
  
  const db = new Database(dbPath);

  try {
    // Database overview
    console.log(`${colors.bright}${colors.yellow}📋 DATABASE OVERVIEW${colors.reset}`);
    
    // Check what tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{name: string}>;
    
    console.log(`${colors.green}Tables found:${colors.reset}`, tables.map(t => t.name).join(', '));
    console.log();

    // Assets overview
    try {
      const assetStats = db.prepare(`
        SELECT 
          type,
          COUNT(*) as count,
          COUNT(CASE WHEN verified = 1 THEN 1 END) as verified_count
        FROM assets 
        GROUP BY type 
        ORDER BY count DESC
      `).all();
      formatTable(assetStats, 'Assets by Type');
    } catch (e) {
      console.log(`${colors.yellow}Assets table not found or empty${colors.reset}\n`);
    }

    // Recent assets
    try {
      const recentAssets = db.prepare(`
        SELECT isin, name, symbol, type, market, discovery_method, verified
        FROM assets 
        ORDER BY last_updated DESC 
        LIMIT 10
      `).all();
      formatTable(recentAssets, 'Recent Assets (Last 10)');
    } catch (e) {
      console.log(`${colors.yellow}Could not fetch recent assets${colors.reset}\n`);
    }

    // Portfolio assets (if discovered via portfolio)
    try {
      const portfolioAssets = db.prepare(`
        SELECT isin, name, symbol, type, market
        FROM assets 
        WHERE discovery_method = 'portfolio' AND verified = 1
        ORDER BY name
      `).all();
      formatTable(portfolioAssets, 'Your Portfolio Assets');
    } catch (e) {
      console.log(`${colors.yellow}No portfolio assets found${colors.reset}\n`);
    }

    // Price data overview
    try {
      const priceStats = db.prepare(`
        SELECT 
          COUNT(*) as total_price_records,
          COUNT(DISTINCT isin) as assets_with_prices,
          MIN(datetime(timestamp/1000, 'unixepoch')) as oldest_price,
          MAX(datetime(timestamp/1000, 'unixepoch')) as latest_price
        FROM price_data
      `).get() as any;
      
      if (priceStats && priceStats.total_price_records > 0) {
        console.log(`${colors.bright}${colors.blue}=== Price Data Overview ===${colors.reset}`);
        console.log(`Total price records: ${colors.green}${priceStats.total_price_records}${colors.reset}`);
        console.log(`Assets with prices: ${colors.green}${priceStats.assets_with_prices}${colors.reset}`);
        console.log(`Oldest price: ${colors.cyan}${priceStats.oldest_price}${colors.reset}`);
        console.log(`Latest price: ${colors.cyan}${priceStats.latest_price}${colors.reset}\n`);
      }
    } catch (e) {
      console.log(`${colors.yellow}No price data found${colors.reset}\n`);
    }

    // Recent prices
    try {
      const recentPrices = db.prepare(`
        SELECT 
          pd.isin,
          a.name,
          a.symbol,
          pd.price,
          pd.currency,
          datetime(pd.timestamp/1000, 'unixepoch') as price_time
        FROM price_data pd
        LEFT JOIN assets a ON pd.isin = a.isin
        ORDER BY pd.timestamp DESC
        LIMIT 10
      `).all();
      formatTable(recentPrices, 'Recent Price Updates');
    } catch (e) {
      console.log(`${colors.yellow}Could not fetch recent prices${colors.reset}\n`);
    }

    // Sample queries section
    console.log(`${colors.bright}${colors.yellow}🔍 SAMPLE QUERIES YOU CAN RUN${colors.reset}`);
    console.log(`${colors.cyan}Command line:${colors.reset}`);
    console.log(`  sqlite3 ${dbPath}`);
    console.log();
    console.log(`${colors.cyan}Useful queries:${colors.reset}`);
    console.log(`  -- View all your portfolio assets`);
    console.log(`  SELECT name, symbol, type, market FROM assets WHERE discovery_method = 'portfolio';`);
    console.log();
    console.log(`  -- Get latest prices for your holdings`);
    console.log(`  SELECT a.name, a.symbol, pd.price, pd.currency`);
    console.log(`  FROM assets a JOIN price_data pd ON a.isin = pd.isin`);
    console.log(`  WHERE a.discovery_method = 'portfolio'`);
    console.log(`  GROUP BY a.isin HAVING pd.timestamp = MAX(pd.timestamp);`);
    console.log();
    console.log(`  -- Asset type distribution`);
    console.log(`  SELECT type, COUNT(*) as count FROM assets WHERE verified = 1 GROUP BY type;`);
    console.log();

  } catch (error) {
    console.error(`${colors.red}Error exploring database:${colors.reset}`, error);
  } finally {
    db.close();
  }
}

async function main() {
  console.log(`${colors.bright}${colors.green}🗄️  Trade Republic Database Explorer${colors.reset}\n`);

  // Find all databases
  const databases = await findDatabases();
  
  if (databases.length === 0) {
    console.log(`${colors.yellow}No database files found in ./data directory.${colors.reset}`);
    console.log(`${colors.cyan}Run data collection first:${colors.reset}`);
    console.log(`  npm run collect-data`);
    console.log(`  npm run quick-collect`);
    return;
  }

  console.log(`${colors.green}Found ${databases.length} database(s):${colors.reset}`);
  databases.forEach(db => console.log(`  📄 ${db}`));
  console.log();

  // Explore each database
  for (const dbPath of databases) {
    exploreDatabase(dbPath);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);
  }

  // GUI instructions
  console.log(`${colors.bright}${colors.blue}💡 GUI DATABASE BROWSER${colors.reset}`);
  console.log(`${colors.green}You can also use the GUI tool that was installed:${colors.reset}`);
  console.log(`  1. Open "DB Browser for SQLite" from Applications`);
  console.log(`  2. Click "Open Database" and select your .db file`);
  console.log(`  3. Use the "Browse Data" tab to view tables`);
  console.log(`  4. Use the "Execute SQL" tab for custom queries`);
  console.log();
  
  console.log(`${colors.bright}${colors.green}🎉 Database exploration complete!${colors.reset}`);
}

// Run if called directly
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('explore-database.js')) {
  main().catch(console.error);
}

export { exploreDatabase, findDatabases };
