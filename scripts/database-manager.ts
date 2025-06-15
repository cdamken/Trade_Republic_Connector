#!/usr/bin/env npx tsx

/**
 * Database Manager - Prevent Clutter and Manage Data Files
 * 
 * This utility helps:
 * - Clean up stray database files
 * - Move files to correct locations
 * - Prevent accidental commits of sensitive data
 * - Provide status of data organization
 */

import { readdir, stat, unlink, mkdir, rename } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { existsSync } from 'fs';

interface FileInfo {
  path: string;
  size: number;
  modified: Date;
  type: 'database' | 'export' | 'temporary';
}

class DatabaseManager {
  private readonly rootDir = process.cwd();
  private readonly productionDir = join(this.rootDir, 'data', 'production');
  private readonly exportsDir = join(this.rootDir, 'data', 'exports');
  private readonly testDir = join(this.rootDir, 'tests', 'databases');

  async findStrayFiles(): Promise<FileInfo[]> {
    const strayFiles: FileInfo[] = [];
    
    // Search patterns for files that shouldn't be in root or wrong locations
    const searchPaths = [
      this.rootDir,
      join(this.rootDir, 'data'),
      join(this.rootDir, 'examples'),
      join(this.rootDir, 'scripts'),
      join(this.rootDir, 'src')
    ];

    for (const searchPath of searchPaths) {
      if (!existsSync(searchPath)) continue;
      
      try {
        const files = await readdir(searchPath);
        
        for (const file of files) {
          const filePath = join(searchPath, file);
          const stats = await stat(filePath);
          
          if (stats.isFile()) {
            let shouldFlag = false;
            let type: 'database' | 'export' | 'temporary' = 'temporary';
            
            // Check for database files
            if (file.endsWith('.db') || file.endsWith('.db-wal') || file.endsWith('.db-shm')) {
              shouldFlag = true;
              type = 'database';
            }
            
            // Check for export files in wrong locations
            if (file.endsWith('.json') && (
              file.includes('asset') || 
              file.includes('portfolio') || 
              file.includes('trade') ||
              file.includes('export') ||
              file.includes('collection')
            )) {
              shouldFlag = true;
              type = 'export';
            }
            
            // Check for temporary files
            if (file.endsWith('.tmp') || file.includes('temp') || file.includes('tmp')) {
              shouldFlag = true;
              type = 'temporary';
            }
            
            if (shouldFlag) {
              strayFiles.push({
                path: filePath,
                size: stats.size,
                modified: stats.mtime,
                type
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not scan ${searchPath}:`, error instanceof Error ? error.message : error);
      }
    }
    
    return strayFiles;
  }

  async ensureDirectories(): Promise<void> {
    const dirs = [this.productionDir, this.exportsDir, this.testDir];
    
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    }
  }

  async cleanupStrayFiles(dryRun: boolean = true): Promise<void> {
    const strayFiles = await this.findStrayFiles();
    
    if (strayFiles.length === 0) {
      console.log('✅ No stray files found! Database organization is clean.');
      return;
    }

    console.log(`\n🔍 Found ${strayFiles.length} stray files:\n`);
    
    for (const file of strayFiles) {
      const relativePath = file.path.replace(this.rootDir + '/', '');
      const sizeKB = Math.round(file.size / 1024);
      console.log(`📁 ${relativePath} (${sizeKB}KB, ${file.type}, modified: ${file.modified.toLocaleDateString()})`);
      
      if (!dryRun) {
        try {
          if (file.type === 'database' && basename(file.path).includes('test')) {
            // Move test databases to correct location
            const newPath = join(this.testDir, basename(file.path));
            await rename(file.path, newPath);
            console.log(`   ➜ Moved to: tests/databases/${basename(file.path)}`);
          } else if (file.type === 'export') {
            // Move exports to correct location
            const newPath = join(this.exportsDir, basename(file.path));
            await rename(file.path, newPath);
            console.log(`   ➜ Moved to: data/exports/${basename(file.path)}`);
          } else {
            // Delete temporary files
            await unlink(file.path);
            console.log(`   ➜ Deleted temporary file`);
          }
        } catch (error) {
          console.log(`   ❌ Error processing: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    
    if (dryRun) {
      console.log('\n🔍 This was a dry run. To actually clean up files, run:');
      console.log('npm run clean-databases');
    } else {
      console.log('\n✅ Cleanup complete!');
    }
  }

  async showStatus(): Promise<void> {
    console.log('\n📊 DATABASE ORGANIZATION STATUS');
    console.log('================================');
    
    const sections = [
      { name: 'Production Data', path: this.productionDir, expected: 'Real financial data' },
      { name: 'Exports', path: this.exportsDir, expected: 'CSV/JSON exports' },
      { name: 'Test Data', path: this.testDir, expected: 'Demo/test databases' }
    ];
    
    for (const section of sections) {
      console.log(`\n📁 ${section.name} (${section.path.replace(this.rootDir + '/', '')})`);
      
      if (!existsSync(section.path)) {
        console.log('   📭 Directory does not exist');
        continue;
      }
      
      try {
        const files = await readdir(section.path);
        const relevantFiles = files.filter(f => 
          f.endsWith('.db') || 
          f.endsWith('.json') || 
          f.endsWith('.csv') ||
          f === 'README.md'
        );
        
        if (relevantFiles.length === 0) {
          console.log('   📭 Empty');
        } else {
          for (const file of relevantFiles) {
            const filePath = join(section.path, file);
            const stats = await stat(filePath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`   📄 ${file} (${sizeKB}KB)`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error reading directory: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    // Check for stray files
    const strayFiles = await this.findStrayFiles();
    if (strayFiles.length > 0) {
      console.log(`\n⚠️  Found ${strayFiles.length} stray files in wrong locations`);
      console.log('   Run "npm run scan-databases" to see details');
    } else {
      console.log('\n✅ All databases are in correct locations');
    }
  }

  async createDemoData(): Promise<void> {
    console.log('\n🎯 Creating demo test database...');
    
    await this.ensureDirectories();
    
    // Create a simple test database
    const testDbPath = join(this.testDir, 'demo-portfolio.db');
    
    // Create database using our existing infrastructure
    const { AssetDatabaseManager } = await import('../src/database/asset-database');
    const db = new AssetDatabaseManager(testDbPath);
    
    // Add some demo data
    const demoAssets = [
      {
        isin: 'US0378331005',
        name: 'Apple Inc.',
        symbol: 'AAPL',
        type: 'stock' as const,
        market: 'NASDAQ',
        sector: 'Technology',
        currency: 'USD',
        discoveryMethod: 'demo',
        discoveredAt: new Date().toISOString(),
        verified: true,
        lastUpdated: new Date().toISOString()
      },
      {
        isin: 'US5949181045',
        name: 'Microsoft Corporation',
        symbol: 'MSFT',
        type: 'stock' as const,
        market: 'NASDAQ',
        sector: 'Technology',
        currency: 'USD',
        discoveryMethod: 'demo',
        discoveredAt: new Date().toISOString(),
        verified: true,
        lastUpdated: new Date().toISOString()
      }
    ];
    
    for (const asset of demoAssets) {
      await db.insertAsset(asset);
    }
    
    await db.close();
    console.log(`✅ Created demo database: ${testDbPath}`);
  }
}

async function main() {
  const action = process.argv[2] || 'status';
  const manager = new DatabaseManager();
  
  try {
    await manager.ensureDirectories();
    
    switch (action) {
      case 'status':
        await manager.showStatus();
        break;
        
      case 'scan':
        await manager.cleanupStrayFiles(true);
        break;
        
      case 'clean':
        await manager.cleanupStrayFiles(false);
        break;
        
      case 'demo':
        await manager.createDemoData();
        break;
        
      default:
        console.log('📖 Database Manager Commands:');
        console.log('  status  - Show organization status');
        console.log('  scan    - Scan for stray files (dry run)');
        console.log('  clean   - Clean up stray files');
        console.log('  demo    - Create demo test data');
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
