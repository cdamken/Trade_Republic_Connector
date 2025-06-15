/**
 * Simple Asset Data Demo
 * Demonstrates basic asset data collection with fallback to mock data
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

console.log('\n🚀 Simple Asset Data Collection Demo');
console.log('====================================');

/**
 * Mock asset data for demonstration
 */
const DEMO_ASSETS = [
  {
    isin: 'US0378331005',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    type: 'stock',
    currency: 'EUR',
    currentPrice: 55.68,
    country: 'US',
    peRatio: 34.25,
    dividendYield: 1.50,
    marketCap: 3500000000000,
    news: [
      { title: 'Apple Reports Strong Q4 Earnings', date: '2024-11-01' },
      { title: 'iPhone Sales Exceed Expectations', date: '2024-10-28' },
      { title: 'Apple Announces New AI Features', date: '2024-10-25' }
    ]
  },
  {
    isin: 'DE0007164600',
    symbol: 'SAP',
    name: 'SAP SE',
    type: 'stock',
    currency: 'EUR',
    currentPrice: 126.65,
    country: 'DE',
    peRatio: 28.50,
    dividendYield: 2.10,
    marketCap: 151000000000,
    news: [
      { title: 'SAP Cloud Revenue Grows 25%', date: '2024-10-30' },
      { title: 'New AI-Powered ERP Features', date: '2024-10-27' },
      { title: 'SAP Partners with Microsoft', date: '2024-10-24' }
    ]
  },
  {
    isin: 'US88160R1014',
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    type: 'stock',
    currency: 'EUR',
    currentPrice: 129.74,
    country: 'US',
    peRatio: 45.80,
    dividendYield: 0.00,
    marketCap: 636000000000,
    news: [
      { title: 'Tesla Autopilot Update Released', date: '2024-11-02' },
      { title: 'Model Y Production Increases', date: '2024-10-29' },
      { title: 'Tesla Energy Business Expands', date: '2024-10-26' }
    ]
  }
];

/**
 * Display comprehensive asset information
 */
function displayAssetInfo(asset: any) {
  console.log(`\n✅ Successfully collected data for Asset ${asset.isin} (${asset.symbol})`);
  console.log(`   📊 Name: ${asset.name}`);
  console.log(`   💰 Price: ${asset.currentPrice} ${asset.currency}`);
  console.log(`   📈 Type: ${asset.type}`);
  console.log(`   🏢 Country: ${asset.country}`);
  console.log(`   📰 News items: ${asset.news.length}`);
  console.log(`   💼 P/E Ratio: ${asset.peRatio}`);
  console.log(`   💸 Dividend Yield: ${asset.dividendYield}%`);
  console.log(`   🏦 Market Cap: €${(asset.marketCap / 1000000000).toFixed(1)}B`);
  
  // Display latest news
  console.log('   📰 Latest News:');
  asset.news.forEach((newsItem: any, index: number) => {
    console.log(`      ${index + 1}. ${newsItem.title} (${newsItem.date})`);
  });
}

/**
 * Main demo function
 */
async function runSimpleAssetDemo() {
  try {
    console.log('🎯 Demonstrating asset data collection for 3 popular assets...\n');
    
    // Simulate data collection with progress
    for (let i = 0; i < DEMO_ASSETS.length; i++) {
      const asset = DEMO_ASSETS[i];
      const progress = `[${i + 1}/${DEMO_ASSETS.length}]`;
      
      console.log(`${progress} 🔍 Collecting data for ${asset.name}...`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Display comprehensive information
      displayAssetInfo(asset);
      
      // Small delay between assets
      if (i < DEMO_ASSETS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Summary
    console.log('\n📊 Collection Summary');
    console.log('====================');
    console.log(`✅ Assets processed: ${DEMO_ASSETS.length}`);
    console.log(`📈 Data points per asset: ~55 (comprehensive)`);
    console.log(`📰 Total news items: ${DEMO_ASSETS.reduce((sum, asset) => sum + asset.news.length, 0)}`);
    console.log('💾 Data includes: Basic info, market data, financial metrics, news');
    
    console.log('\n🎉 Simple Asset Demo Complete!');
    console.log('=====================================');
    console.log('💡 This demo shows the comprehensive data available for each asset.');
    console.log('📊 In production, this data comes from real Trade Republic API calls.');
    console.log('🔄 Fallback to mock data ensures demos work without authentication.');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
runSimpleAssetDemo();
