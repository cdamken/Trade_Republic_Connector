// Count parameters in stmt.run() call
const params = [
  'record.id', 'record.isin', 'record.wkn', 'record.symbol', 'record.name', 'record.shortName', 'record.longName',
  'record.type', 'record.subType', 'record.category', 'record.sector', 'record.industry',
  'record.country', 'record.countryCode', 'record.region', 'record.homeExchange', 'record.currency',
  'record.tradingCurrency', 'record.quoteCurrency', 'record.tickSize', 'record.lotSize',
  'record.minTradeAmount', 'record.maxTradeAmount',
  'record.currentPrice', 'record.bid', 'record.ask', 'record.spread', 'record.volume', 'record.volumeWeightedAveragePrice',
  'record.dayOpen', 'record.dayHigh', 'record.dayLow', 'record.dayClose', 'record.previousClose',
  'record.dayChange', 'record.dayChangePercentage', 'record.dayVolume', 'record.dayTurnover',
  'record.week52High', 'record.week52Low', 'record.marketCap', 'record.sharesOutstanding',
  'record.floatShares', 'record.averageVolume', 'record.averageVolume10Day', 'record.averageVolume30Day',
  'record.peRatio', 'record.pegRatio', 'record.priceToBook', 'record.priceToSales',
  'record.enterpriseValue', 'record.evToRevenue', 'record.evToEbitda',
  'record.profitMargin', 'record.grossMargin', 'record.operatingMargin',
  'record.returnOnEquity', 'record.returnOnAssets',
  'record.dividendYield', 'record.dividendPerShare', 'record.dividendDate', 'record.exDividendDate',
  'record.paymentDate', 'record.dividendFrequency',
  'record.netAssetValue', 'record.premiumDiscount', 'record.aum', 'record.expenseRatio',
  'record.distributionYield', 'record.replicationMethod', 'record.trackingError', 'record.numberOfHoldings',
  'record.maturityDate', 'record.couponRate', 'record.yieldToMaturity', 'record.currentYield',
  'record.duration', 'record.modifiedDuration', 'record.convexity', 'record.creditRating', 'record.creditRatingAgency',
  'record.circulatingSupply', 'record.totalSupply', 'record.maxSupply',
  'record.beta', 'record.volatility', 'record.volatility30Day', 'record.volatility90Day',
  'record.sharpeRatio', 'record.sortinoRatio', 'record.maxDrawdown', 'record.var95',
  'record.tradingStatus', 'record.isHalted', 'record.haltReason', 'record.isDelisted', 'record.delistingDate',
  'record.analystRating?.rating', 'record.analystRating?.numberOfAnalysts', 'record.priceTarget', 'record.priceTargetHigh',
  'record.priceTargetLow', 'record.priceTargetMean',
  'record.sma20', 'record.sma50', 'record.sma200', 'record.ema12', 'record.ema26', 'record.rsi',
  'record.macd?.macd', 'record.macd?.signal', 'record.macd?.histogram',
  'record.bollingerBands?.upper', 'record.bollingerBands?.middle', 'record.bollingerBands?.lower',
  'record.bollingerBands?.bandwidth', 'record.bollingerBands?.percentB',
  'record.hasOptions', 'record.impliedVolatility', 'record.openInterest',
  'record.esgScore', 'record.environmentScore', 'record.socialScore', 'record.governanceScore', 'record.controversyLevel',
  'record.tradeRepublicTradable', 'record.tradeRepublicFractional', 'record.tradeRepublicSavingsPlan',
  'record.lastUpdated.toISOString()', 'record.createdAt.toISOString()', 'record.updatedAt.toISOString()',
  'record.version', 'record.source', 'record.checksum',
  'JSON.stringify(record.dataProviders)', 'record.updateFrequency', 'record.reliability'
];

console.log('Number of parameters:', params.length);

const columns = [
  'id', 'isin', 'wkn', 'symbol', 'name', 'short_name', 'long_name',
  'type', 'sub_type', 'category', 'sector', 'industry',
  'country', 'country_code', 'region', 'home_exchange', 'currency',
  'trading_currency', 'quote_currency', 'tick_size', 'lot_size',
  'min_trade_amount', 'max_trade_amount',
  'current_price', 'bid', 'ask', 'spread', 'volume', 'vwap',
  'day_open', 'day_high', 'day_low', 'day_close', 'previous_close',
  'day_change', 'day_change_percentage', 'day_volume', 'day_turnover',
  'week52_high', 'week52_low', 'market_cap', 'shares_outstanding',
  'float_shares', 'average_volume', 'average_volume_10day', 'average_volume_30day',
  'pe_ratio', 'peg_ratio', 'price_to_book', 'price_to_sales',
  'enterprise_value', 'ev_to_revenue', 'ev_to_ebitda',
  'profit_margin', 'gross_margin', 'operating_margin',
  'return_on_equity', 'return_on_assets',
  'dividend_yield', 'dividend_per_share', 'dividend_date', 'ex_dividend_date',
  'payment_date', 'dividend_frequency',
  'net_asset_value', 'premium_discount', 'aum', 'expense_ratio',
  'distribution_yield', 'replication_method', 'tracking_error', 'number_of_holdings',
  'maturity_date', 'coupon_rate', 'yield_to_maturity', 'current_yield',
  'duration', 'modified_duration', 'convexity', 'credit_rating', 'credit_rating_agency',
  'circulating_supply', 'total_supply', 'max_supply',
  'beta', 'volatility', 'volatility_30day', 'volatility_90day',
  'sharpe_ratio', 'sortino_ratio', 'max_drawdown', 'var95',
  'trading_status', 'is_halted', 'halt_reason', 'is_delisted', 'delisting_date',
  'analyst_rating', 'analyst_count', 'price_target', 'price_target_high',
  'price_target_low', 'price_target_mean',
  'sma20', 'sma50', 'sma200', 'ema12', 'ema26', 'rsi',
  'macd_line', 'macd_signal', 'macd_histogram',
  'bb_upper', 'bb_middle', 'bb_lower', 'bb_bandwidth', 'bb_percent_b',
  'has_options', 'implied_volatility', 'open_interest',
  'esg_score', 'environment_score', 'social_score', 'governance_score', 'controversy_level',
  'tr_tradable', 'tr_fractional', 'tr_savings_plan',
  'last_updated', 'created_at', 'updated_at', 'version', 'source', 'checksum',
  'data_providers', 'update_frequency', 'reliability'
];

console.log('Number of columns:', columns.length);

console.log('\nColumns vs Parameters comparison:');
for (let i = 0; i < Math.max(columns.length, params.length); i++) {
  const col = columns[i] || 'MISSING';
  const param = params[i] || 'MISSING';
  console.log(`${i+1}: ${col} | ${param}`);
}
