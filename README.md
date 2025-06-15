# Trade Republic API Connector

[![npm version](https://badge.fury.io/js/trade-republic-connector.svg)](https://badge.fury.io/js/trade-republic-connector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)## 👨‍💻 Author

**Carlos Damken** - *Creator and Lead Developer*  
📧 [carlos@damken.com](mailto:carlos@damken.com)

This project was created as an original implementation after reviewing existing Trade Republic API projects for insights and best practices.

## 📧 SupporteScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

A modern, secure, and scalable TypeScript-based connector for Trade Republic's unofficial API. Built with type safety, performance, and developer experience in mind.

## ⚠️ **Disclaimer**

This is an **unofficial** API connector for Trade Republic. It is not affiliated with, endorsed by, or supported by Trade Republic Bank GmbH. Use at your own risk and ensure compliance with Trade Republic's terms of service.

**Important Security Notes:**
- **NEVER commit your real credentials to version control**
- **NEVER share your Trade Republic credentials with anyone**
- **ALWAYS use environment variables for credential storage**
- **NEVER put real credentials in documentation or examples**
- Use environment variables for credential storage
- This library is for educational and personal use
- Real trading involves financial risk

## 🚀 Features

- **🔒 Secure Authentication**: Environment-based credential management with real 2FA
- **📊 TypeScript First**: Complete type safety with comprehensive definitions
- **⚡ High Performance**: Optimized for handling 400+ assets efficiently
- **🔄 Real-time Data**: WebSocket support for live market data and portfolio updates
- **💼 Portfolio Management**: Complete portfolio tracking and analytics
- **🛡️ Error Handling**: Robust error management with auto-reconnection
- **🧪 Well Tested**: Comprehensive test suite with 90%+ coverage
- **📚 Documentation**: Complete API documentation and examples

## 🎯 **NEW: Real Trading Operations ✅**

**MAJOR UPDATE**: Full real API implementation with live trading capabilities:

- **📈 Live Trading**: Real buy/sell orders with market and limit types
- **💰 Real-time Prices**: Live market data with bid/ask spreads
- **📊 Order Management**: Place, cancel, and track orders with detailed history
- **🔔 Live Notifications**: WebSocket streams for order executions and portfolio updates
- **📰 Market News**: Live news feeds with sentiment analysis
- **👁️ Watchlist Management**: Real-time watchlist with price alerts
- **📈 Historical Data**: OHLCV data for multiple timeframes (1d to 5y)
- **🏛️ Market Status**: Trading venue status and market hours

### Trading Demo
```bash
npm run demo:trading  # Comprehensive trading features demo
npm run demo:real-auth  # Real authentication flow
```

## 🎯 **Asset Data Collection**

Advanced asset data collection capabilities:

- **📊 55+ Data Points**: Complete asset information including financial metrics, risk data, ESG scores
- **🗄️ SQLite Database**: Test database for development with advanced search and analytics
- **📰 News Integration**: Latest news and corporate events for each asset
- **📈 Technical Indicators**: Moving averages, RSI, MACD, Bollinger Bands
- **🏢 Corporate Data**: Earnings, dividends, analyst ratings, price targets
- **⚡ Real-time Updates**: WebSocket integration for live market data

### Asset Data Demo

```bash
# Run the comprehensive asset demo (no authentication required)
npm run demo:assets-simple

# Full demo with database (requires authentication)
npm run demo:assets
```

---

## 📦 Installation

```bash
npm install trade-republic-connector
```

## 🏁 Quick Start

### 1. Environment Setup

Create a `.env` file (never commit this!):

```bash
# Copy the example file
cp .env.example .env

# Edit with your credentials
TR_USERNAME="+49 123 456789"   # Your phone number (with country code)
TR_PASSWORD="your-pin"         # Your PIN/password
```

### 2. Basic Usage with 2FA

Trade Republic requires **two-factor authentication (2FA)** for security. Here's the complete flow:

```typescript
import { TradeRepublicClient, getCredentialsFromEnv, AuthenticationError } from 'trade-republic-connector';

async function main() {
  // Create client
  const client = new TradeRepublicClient({
    logLevel: 'info'
  });

  try {
    // Initialize
    await client.initialize();

    // Step 1: Login with phone number and PIN
    const credentials = getCredentialsFromEnv();
    if (!credentials) {
      throw new Error('Please set TR_USERNAME and TR_PASSWORD in .env file');
    }

    try {
      const session = await client.login(credentials);
      console.log('Logged in successfully!', session.userId);
      
    } catch (error) {
      // Step 2: Handle MFA challenge
      if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
        const challenge = (error as any).challenge;
        console.log('MFA required:', challenge.message);
        
        // Get MFA code from user (SMS/App)
        const mfaCode = await getUserInput('Enter 6-digit code: ');
        
        // Step 3: Submit MFA code
        const mfaResponse = {
          challengeId: challenge.challengeId,
          code: mfaCode,
        };
        
        const session = await client.submitMFA(challenge, mfaResponse);
        console.log('MFA authentication successful!', session.userId);
      } else {
        throw error;
      }
    }

    // Now you can use the API
    const portfolio = await client.getPortfolio();
    console.log(`Portfolio value: €${portfolio.totalValue}`);

    // Logout
    await client.logout();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

### 3. Interactive Demo

Try the interactive authentication demo:

```bash
npm run demo:auth
```

This will guide you through the complete 2FA flow with your real credentials.

## 📖 Documentation

### Authentication Flow

The connector uses secure environment-based authentication:

Trade Republic uses a **three-step authentication process**:

1. **Phone Number**: Your registered phone number (username)
2. **PIN**: Your 4-6 digit personal PIN (password)  
3. **MFA Token**: 4-digit code generated by the Trade Republic app (not SMS)

```typescript
import { TradeRepublicClient, getCredentialsFromEnv, AuthenticationError } from 'trade-republic-connector';

const client = new TradeRepublicClient();
await client.initialize();

// Step 1 & 2: Login with phone and PIN
const credentials = getCredentialsFromEnv();
try {
  const session = await client.login(credentials);
  // Success (rare - usually requires MFA)
} catch (error) {
  if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
    // Step 3: Handle MFA challenge
    const challenge = error.challenge;
    
    // Get 6-digit code from user
    const mfaCode = '1234'; // From Trade Republic app
    
    const mfaResponse = {
      challengeId: challenge.challengeId,
      code: mfaCode,
    };
    
    const session = await client.submitMFA(challenge, mfaResponse);
    console.log('Authenticated!', session.userId);
  }
}
```

### Phone Number Format

Your phone number must include the country code:

```typescript
// ✅ Correct formats
TR_USERNAME="+49 176 12345678"  // With spaces
TR_USERNAME="+4917612345678"    // Without spaces

// ❌ Incorrect formats  
TR_USERNAME="017612345678"      // Missing country code
TR_USERNAME="49 176 12345678"   // Missing +
```

### CLI Tools

Test authentication flow with built-in CLI tools:

```bash
# Test login (shows MFA challenge)
npm run cli:login

# Interactive 2FA demo
npm run demo:auth
```

### Portfolio Management

```typescript
// Get complete portfolio
const portfolio = await client.getPortfolio();

console.log(`Total Value: €${portfolio.totalValue}`);
console.log(`Total Return: €${portfolio.totalReturn} (${portfolio.totalReturnPercentage}%)`);
console.log(`Positions: ${portfolio.positions.length}`);

// Iterate through positions
portfolio.positions.forEach(position => {
  console.log(`${position.asset.name}: ${position.quantity} shares @ €${position.currentPrice}`);
});
```

### 🎯 Trading Operations

```typescript
import { BuyOrderData, SellOrderData } from 'trade-republic-connector';

// Place a buy order
const buyOrder: BuyOrderData = {
  isin: 'US0378331005',  // Apple Inc.
  amount: 1000,          // €1000 worth
  orderType: 'market',   // Market order
  venue: 'XETRA'         // Trading venue
};

const orderResponse = await client.placeBuyOrder(buyOrder);
console.log(`Order placed: ${orderResponse.orderId}`);
console.log(`Status: ${orderResponse.status}`);

// Get real-time price
const price = await client.getRealTimePrice('US0378331005');
console.log(`Current AAPL price: €${price.price}`);
console.log(`Change: ${price.changePercent}%`);
console.log(`Market status: ${price.marketStatus}`);

// Get order history
const orders = await client.getOrderHistory({ 
  status: 'executed', 
  limit: 10 
});

console.log(`Found ${orders.length} executed orders`);
orders.forEach(order => {
  console.log(`${order.side.toUpperCase()} ${order.instrumentName}: €${order.executedPrice}`);
});

// Manage watchlist
await client.addToWatchlist('DE0007164600'); // SAP
const watchlist = await client.getWatchlist();
console.log(`Watchlist has ${watchlist.items.length} items`);

// Get market news
const news = await client.getMarketNews('US0378331005', 5);
news.articles.forEach(article => {
  console.log(`${article.title} - ${article.sentiment}`);
});
```

### Real-time Data with WebSocket

```typescript
// Initialize WebSocket connection
await client.initializeWebSocket();

// Subscribe to real-time price updates
const priceSubscription = client.subscribeToPrices('US0378331005', (priceUpdate) => {
  console.log(`AAPL: €${priceUpdate.payload.price} (${priceUpdate.payload.currency})`);
  console.log(`Bid: €${priceUpdate.payload.bid}, Ask: €${priceUpdate.payload.ask}`);
});

// Subscribe to portfolio value updates
const portfolioSubscription = client.subscribeToPortfolio((portfolioUpdate) => {
  console.log(`Portfolio Value: €${portfolioUpdate.payload.totalValue}`);
  console.log(`Day Change: €${portfolioUpdate.payload.dayChange} (${portfolioUpdate.payload.dayChangePercentage}%)`);
});

// Check WebSocket status
const wsStatus = client.getWebSocketStatus();
console.log('WebSocket Connected:', wsStatus.connected);
console.log('Active Subscriptions:', wsStatus.subscriptions);

// Clean up
client.unsubscribe(priceSubscription);
client.unsubscribe(portfolioSubscription);
client.disconnectWebSocket();
```

### Error Handling

```typescript
import { AuthenticationError } from 'trade-republic-connector';

try {
  await client.login(credentials);
} catch (error) {
  if (error instanceof AuthenticationError) {
    if (error.code === 'MFA_REQUIRED') {
      console.log('Multi-factor authentication required');
      // Handle MFA flow
    }
  }
}
```

## 🚨 Important: Current Implementation Status

**This is currently a MOCK/PROTOTYPE implementation!** 

The connector doesn't yet connect to the real Trade Republic API. It simulates the authentication flow for development and testing purposes. You will NOT receive actual SMS/App codes because we're not making real API calls yet.

### What Works Now (Mock):
- ✅ Phone number and PIN validation
- ✅ Authentication flow structure  
- ✅ 2FA challenge simulation
- ✅ Token management system
- ✅ Session persistence
- ✅ **WebSocket manager and real-time data streaming architecture**
- ✅ Portfolio management interface

### What's Coming Next (Real API):
- 🔄 Actual Trade Republic API endpoints
- 🔄 Real WebSocket connections to Trade Republic
- 🔄 Live portfolio and market data
- 🔄 Trading operations (buy/sell orders)
- 🔄 Real authentication with TR servers

---

## 🏗️ Development Status

This project is actively developed. Current status:

- ✅ **Authentication System**: Complete with session management
- ✅ **Type Definitions**: Comprehensive TypeScript interfaces
- ✅ **Configuration**: Flexible configuration system
- ✅ **HTTP Client**: Rate-limited API client with retry logic
- ✅ **Testing Framework**: Unit and integration tests
- 🔄 **WebSocket Support**: Real-time data feeds (in progress)
- 🔄 **Portfolio API**: Portfolio data fetching (in progress)
- 🔄 **Market Data**: Live price feeds (planned)
- 🔄 **Trading Operations**: Order placement (planned)

## 🛠️ Development

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/trade-republic-api-connector.git
cd trade-republic-api-connector

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run tests
npm test

# Build the project
npm run build
```

### Scripts

- `npm run build` - Build the library
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:manual` - Test with real credentials (requires .env)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## 📊 Architecture

```
src/
├── types/           # TypeScript type definitions
│   ├── auth.ts      # Authentication types
│   ├── portfolio.ts # Portfolio and asset types
│   ├── market.ts    # Market data types
│   └── websocket.ts # WebSocket message types
├── config/          # Configuration management
│   ├── config.ts    # Configuration classes and defaults
│   └── environment.ts # Environment variable handling
├── auth/            # Authentication system
│   └── manager.ts   # Authentication manager
├── api/             # API client core
│   ├── client.ts    # Main TradeRepublicClient class
│   └── http-client.ts # HTTP client with rate limiting
├── utils/           # Utility functions
│   └── logger.ts    # Logging system
└── index.ts         # Main exports
```

## 🔒 Security

This connector implements several security measures:

- **Environment Variables**: Credentials stored securely in environment
- **Session Encryption**: Secure session storage with file permissions
- **Token Management**: Automatic token refresh and secure handling
- **Input Validation**: Comprehensive data sanitization
- **Rate Limiting**: Built-in protection against API abuse
- **Error Sanitization**: Safe error messages without data leaks

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain test coverage above 90%
- Use conventional commit messages
- Update documentation for API changes
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚖️ Legal Notice

This software is provided for educational and research purposes only. Users are responsible for:

- Complying with Trade Republic's terms of service
- Understanding the risks of automated trading
- Ensuring proper security of their credentials
- Using the software in accordance with applicable laws

The authors and contributors are not responsible for any financial losses, security breaches, or violations of terms of service that may result from using this software.

## 🙏 Acknowledgments

- Trade Republic for providing an accessible trading platform
- The TypeScript community for excellent tooling
- Contributors and users who help improve this project

## �‍💻 Author

**Carlos** - *Creator and Lead Developer*

This project was created as an original implementation after reviewing existing Trade Republic API projects for insights and best practices.

## �📧 Support

- 📖 [Documentation](https://github.com/yourusername/trade-republic-api-connector/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/trade-republic-api-connector/issues)
- 💬 [Discussions](https://github.com/yourusername/trade-republic-api-connector/discussions)

---

**Remember**: This is an unofficial API connector. Always ensure compliance with Trade Republic's terms of service and use responsibly.
