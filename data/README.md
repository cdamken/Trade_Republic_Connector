# Data Directory Structure

This directory contains your Trade Republic data organized properly:

## 📁 Directory Structure

```
data/
├── production/          # Your real Trade Republic data (PRIVATE)
│   ├── *.db            # SQLite databases with your real portfolio data
│   └── *.json          # JSON reports from data collection
├── exports/            # Export files (PRIVATE)
│   ├── *.csv           # CSV exports for spreadsheets
│   ├── *.json          # JSON exports for analysis
│   └── reports/        # Generated reports
└── README.md           # This file
```

## 🛡️ Privacy & Security

- **ALL files in this directory are PRIVATE** and excluded from git
- Contains your personal financial data
- Never commit these files to version control
- Your data stays on your local machine only

## 📊 Production Data Files

After running `npm run collect-data`, you'll find:

### Main Database
- `production/comprehensive-trade-republic-data.db` - Complete Trade Republic data

### Export Files  
- `exports/comprehensive-trade-republic-report.json` - Full data export
- `exports/collection-summary.json` - Collection statistics
- `exports/comprehensive-assets.csv` - Asset list for spreadsheets

## 🔧 Managing Your Data

### View Your Data
```bash
# Explore database with GUI
./scripts/open-db-browser.sh

# Explore with terminal tool
npm run explore-db

# Direct SQLite access
sqlite3 data/production/comprehensive-trade-republic-data.db
```

### Backup Your Data
```bash
# Create timestamped backup
cp -r data/production data/backup-$(date +%Y%m%d_%H%M%S)
```

### Clear Old Data (if needed)
```bash
# Remove old production data (careful!)
rm -rf data/production/*
rm -rf data/exports/*
```

## ⚠️ Important Notes

- This directory should only contain YOUR real financial data
- Test data belongs in `tests/databases/` directory
- Always backup your data before major updates
- Your `.env` credentials are separate and also private

```bash
# Collect asset data
npm run collect:assets

# Export data
npm run demo:data
```

## Security Note

All files in this directory are ignored by git (.gitignore) to prevent accidentally committing personal data or collection results.

## Initial Setup

The directory structure will be automatically created when you first run the data collection scripts.
