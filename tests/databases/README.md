# Test Databases

This directory contains test databases for development and testing purposes.

## 📁 Purpose

- **Sample data for development**
- **Unit test fixtures**
- **Integration test data**
- **Demo databases for examples**

## 🔧 Test Data Types

- Demo assets (Apple, Tesla, Microsoft, etc.)
- Sample price data
- Mock portfolio positions
- Test trading history

## ⚠️ Important

- **No real financial data** should be stored here
- All test data is safe to commit to git
- Production data belongs in `data/production/`

## 🧪 Creating Test Data

Test databases can be created by test scripts and should contain only:
- Well-known public companies (AAPL, TSLA, MSFT)
- Fake/sample trading data
- Mock portfolio positions for testing

## 🗑️ Cleanup

Test databases can be safely deleted anytime:
```bash
rm -rf tests/databases/*
```
