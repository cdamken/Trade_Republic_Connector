# Data Management and Organization

This document explains how to properly manage data in the Trade Republic Connector to prevent clutter and ensure proper separation between test and production data.

## 📁 Directory Structure

```
Trade_Republic_Connector/
├── data/
│   ├── production/          # 🔐 PRIVATE - Real financial data (gitignored)
│   │   ├── comprehensive-trade-republic-data.db
│   │   └── quick-collection.db
│   ├── exports/            # 🔐 PRIVATE - Data exports (gitignored)
│   │   ├── comprehensive-assets.csv
│   │   ├── comprehensive-assets.json
│   │   └── quick-collection-results.json
│   └── README.md           # Documentation
├── tests/
│   └── databases/          # ✅ PUBLIC - Demo/test data (some files tracked)
│       ├── demo-portfolio.db
│       ├── test-assets.db
│       └── README.md
└── scripts/
    └── database-manager.ts # Data management utility
```

## 🛡️ Security and Privacy

### Production Data (NEVER Committed)
- **Location**: `data/production/` and `data/exports/`
- **Content**: Real financial data, portfolios, transactions
- **Git Status**: Completely ignored by .gitignore
- **Security**: Contains sensitive personal financial information

### Test Data (Selectively Tracked)
- **Location**: `tests/databases/`
- **Content**: Demo data with fake assets for testing
- **Git Status**: Some files tracked for development, real data ignored
- **Purpose**: Enable development and testing without exposing real data

## 🔧 Database Management Commands

### Check Organization Status
```bash
npm run db:status
```
Shows current state of all data directories and any organizational issues.

### Scan for Stray Files
```bash
npm run db:scan
```
Performs a dry-run scan to find database files in wrong locations.

### Clean Up Stray Files
```bash
npm run db:clean
```
Automatically moves or deletes files that are in wrong locations:
- Moves test databases to `tests/databases/`
- Moves exports to `data/exports/`
- Deletes temporary files

### Create Demo Data
```bash
npm run db:demo
```
Creates sample test data in `tests/databases/` for development.

## 📋 Best Practices

### ✅ DO:
- Always use production scripts for real data collection
- Store real data in `data/production/`
- Store exports in `data/exports/`
- Use test data in `tests/databases/` for development
- Run `npm run db:status` regularly to check organization
- Run `npm run db:clean` if you see stray files

### ❌ DON'T:
- Never commit files from `data/production/` or `data/exports/`
- Don't create database files in the root directory
- Don't mix test and production data
- Don't commit real financial data anywhere
- Don't ignore the database manager warnings

## 🚀 Data Collection Workflows

### Production Data Collection
```bash
# Full comprehensive collection
npm run collect-data

# Quick portfolio collection  
npm run quick-collect
```
These automatically save to `data/production/` and export to `data/exports/`.

### Development and Testing
```bash
# Create demo data for testing
npm run db:demo

# Explore any database
npm run explore-db
```

## 🔄 Automatic Protection

The project includes several layers of protection against data mishaps:

### Enhanced .gitignore
- Blocks all `.db`, `.db-wal`, `.db-shm` files by default
- Allows specific test databases in `tests/databases/`
- Prevents JSON exports in wrong locations
- Comprehensive coverage of sensitive data patterns

### Database Manager
- Automatic detection of files in wrong locations
- Smart categorization of database, export, and temporary files
- Safe cleanup with dry-run preview
- Directory structure enforcement

### NPM Scripts
- Consistent commands for all data operations
- Clear separation between production and test workflows
- Built-in database management integration

## 🧹 Regular Maintenance

### Weekly Check
```bash
npm run db:status
npm run db:scan
```

### Monthly Cleanup
```bash
npm run db:clean
```

### After Development Sessions
If you've been testing or developing:
```bash
npm run db:scan  # Check for stray files
npm run db:clean # Clean up if needed
```

## 🆘 Troubleshooting

### "Found stray files" Warning
Run `npm run db:scan` to see details, then `npm run db:clean` to fix.

### Database in Wrong Location
The database manager will automatically suggest the correct location and can move files safely.

### Accidental Commit of Sensitive Data
1. Remove files from git: `git rm --cached filename`
2. Update .gitignore if needed
3. Use `git filter-branch` or BFG Repo-Cleaner for history cleanup
4. Force push with caution: `git push --force-with-lease`

### Large Database Files
Production databases can grow large. Use the export functions to create smaller JSON/CSV files for analysis:
```bash
npm run explore-db  # Check database size and contents
```

## 📊 Monitoring

The database manager provides detailed status information:
- File sizes and modification dates
- Directory organization compliance
- Automatic categorization of data types
- Warnings for potential issues

This system ensures your real financial data stays private while making development smooth and organized.
