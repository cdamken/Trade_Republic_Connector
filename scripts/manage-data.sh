#!/bin/bash

# Trade Republic Connector - Data Management Script
# Provides proper separation between test and production data

show_usage() {
    echo "🔧 Trade Republic Connector - Data Management"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  status          Show current data status"
    echo "  clean-test      Remove test databases (safe)"
    echo "  clean-prod      Remove production data (⚠️  CAREFUL!)"
    echo "  backup-prod     Create backup of production data"
    echo "  show-structure  Show directory structure"
    echo ""
}

show_status() {
    echo "📊 Trade Republic Connector Data Status"
    echo "======================================="
    echo ""
    
    echo "🏭 Production Data:"
    if [ -d "./data/production" ]; then
        PROD_DBS=$(find ./data/production -name "*.db" 2>/dev/null | wc -l)
        PROD_SIZE=$(du -sh ./data/production 2>/dev/null | cut -f1)
        echo "   📁 Directory: ./data/production"
        echo "   🗄️  Databases: $PROD_DBS"
        echo "   📏 Size: ${PROD_SIZE:-0B}"
        
        if [ $PROD_DBS -gt 0 ]; then
            echo "   📄 Files:"
            ls -lh ./data/production/*.db 2>/dev/null | awk '{print "      " $9 " (" $5 ")"}'
        fi
    else
        echo "   ❌ No production directory found"
    fi
    echo ""
    
    echo "📤 Export Data:"
    if [ -d "./data/exports" ]; then
        EXPORT_FILES=$(find ./data/exports -type f 2>/dev/null | wc -l)
        EXPORT_SIZE=$(du -sh ./data/exports 2>/dev/null | cut -f1)
        echo "   📁 Directory: ./data/exports"
        echo "   📄 Files: $EXPORT_FILES"
        echo "   📏 Size: ${EXPORT_SIZE:-0B}"
    else
        echo "   ❌ No exports directory found"
    fi
    echo ""
    
    echo "🧪 Test Data:"
    if [ -d "./tests/databases" ]; then
        TEST_DBS=$(find ./tests/databases -name "*.db" 2>/dev/null | wc -l)
        TEST_SIZE=$(du -sh ./tests/databases 2>/dev/null | cut -f1)
        echo "   📁 Directory: ./tests/databases"
        echo "   🗄️  Databases: $TEST_DBS"
        echo "   📏 Size: ${TEST_SIZE:-0B}"
    else
        echo "   ❌ No test databases directory found"
    fi
    echo ""
}

clean_test_data() {
    echo "🧹 Cleaning Test Data"
    echo "===================="
    echo ""
    
    if [ -d "./tests/databases" ]; then
        TEST_DBS=$(find ./tests/databases -name "*.db" 2>/dev/null)
        if [ -n "$TEST_DBS" ]; then
            echo "🗑️  Removing test databases:"
            echo "$TEST_DBS"
            rm -f ./tests/databases/*.db
            echo "✅ Test databases cleaned"
        else
            echo "ℹ️  No test databases to clean"
        fi
    else
        echo "ℹ️  No test databases directory found"
    fi
    echo ""
}

clean_production_data() {
    echo "⚠️  DANGER: Cleaning Production Data"
    echo "===================================="
    echo ""
    echo "This will DELETE your real Trade Republic data!"
    echo "Make sure you have a backup if needed."
    echo ""
    read -p "Type 'DELETE MY DATA' to confirm: " -r
    if [[ $REPLY == "DELETE MY DATA" ]]; then
        if [ -d "./data/production" ]; then
            rm -rf ./data/production/*
            echo "✅ Production data deleted"
        fi
        if [ -d "./data/exports" ]; then
            rm -rf ./data/exports/*
            echo "✅ Export data deleted"
        fi
        echo "🗑️  Production data cleanup complete"
    else
        echo "❌ Production cleanup cancelled"
    fi
    echo ""
}

backup_production_data() {
    echo "💾 Backing Up Production Data"
    echo "============================="
    echo ""
    
    if [ ! -d "./data/production" ] || [ -z "$(ls -A ./data/production 2>/dev/null)" ]; then
        echo "❌ No production data to backup"
        return 1
    fi
    
    BACKUP_DIR="./backups/production-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    cp -r ./data/production/* "$BACKUP_DIR/"
    if [ -d "./data/exports" ]; then
        cp -r ./data/exports "$BACKUP_DIR/"
    fi
    
    BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
    echo "✅ Backup created: $BACKUP_DIR ($BACKUP_SIZE)"
    echo ""
}

show_structure() {
    echo "📁 Project Structure"
    echo "==================="
    echo ""
    echo "Trade_Republic_Connector/"
    echo "├── data/"
    echo "│   ├── production/          # 🔒 Your real Trade Republic data (PRIVATE)"
    echo "│   │   ├── *.db            # SQLite databases"
    echo "│   │   └── *.json          # JSON reports"
    echo "│   ├── exports/            # 📤 Export files (PRIVATE)"
    echo "│   │   ├── *.csv          # CSV for spreadsheets"
    echo "│   │   └── *.json         # JSON exports"
    echo "│   └── README.md           # Data directory documentation"
    echo "├── tests/"
    echo "│   ├── databases/          # 🧪 Test databases (safe to delete)"
    echo "│   │   ├── *.db           # Test data only"
    echo "│   │   └── README.md      # Test data documentation"
    echo "│   └── *.test.ts          # Unit tests"
    echo "└── scripts/               # 🔧 Management scripts"
    echo ""
    echo "🛡️  Privacy:"
    echo "   ✅ data/production/ - Ignored by git (private)"
    echo "   ✅ data/exports/ - Ignored by git (private)"
    echo "   ✅ .env - Ignored by git (private)"
    echo "   ⚠️  tests/databases/ - Can be tracked (test data only)"
    echo ""
}

# Main script logic
case "${1:-}" in
    "status")
        show_status
        ;;
    "clean-test")
        clean_test_data
        ;;
    "clean-prod")
        clean_production_data
        ;;
    "backup-prod")
        backup_production_data
        ;;
    "show-structure")
        show_structure
        ;;
    *)
        show_usage
        ;;
esac
