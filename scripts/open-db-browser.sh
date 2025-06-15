#!/bin/bash

# SQLite Database Browser Launcher
# Opens your Trade Republic database in the GUI browser

echo "🗄️  Opening Trade Republic Database Browser..."

# Find database files
DB_FILES=$(find ./data/production -name "*.db" 2>/dev/null)

if [ -z "$DB_FILES" ]; then
    echo "❌ No production database files found in ./data/production directory"
    echo "💡 Run data collection first:"
    echo "   npm run collect-data"
    echo "   npm run quick-collect"
    exit 1
fi

echo "📊 Found database files:"
echo "$DB_FILES"
echo ""

# Get the most recent database file
LATEST_DB=$(ls -t ./data/production/*.db 2>/dev/null | head -1)

if [ -n "$LATEST_DB" ]; then
    echo "🚀 Opening latest database: $LATEST_DB"
    open -a "DB Browser for SQLite" "$LATEST_DB"
else
    echo "❌ Could not find database file"
    exit 1
fi

echo "✅ Database browser should now be open!"
echo ""
echo "💡 In the browser:"
echo "   📋 Use 'Browse Data' tab to view tables"
echo "   🔍 Use 'Execute SQL' tab for custom queries"
echo "   📊 Check out the 'assets' and 'price_data' tables"
