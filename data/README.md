# Data Directory

This directory contains the databases and exported data from the Trade Republic API connector.

## Structure

```
data/
├── assets.db              # Main SQLite database (created after collection)
├── exports/               # Data exports directory
│   ├── assets-YYYY-MM-DD.json
│   └── assets-YYYY-MM-DD.csv
└── backups/               # Database backups (created by backup script)
    └── assets-backup-YYYY-MM-DD.db
```

## Usage

The data directory will be populated when you run:

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
