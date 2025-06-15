/**
 * Trading Manager
 * 
 * Handles Trade Republic trading operations including
 * buy/sell orders, order management, and market data.
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicAPI } from '../api/trade-republic-api.js';
import { AuthManager } from '../auth/manager.js';
import { logger } from '../utils/logger.js';
import type {
  BuyOrderData,
  SellOrderData,
  OrderResponse,
  OrderHistory,
  OrderHistoryFilters,
  RealTimePrice,
  HistoricalPricesResponse,
  MarketNewsResponse,
  WatchlistResponse,
  TradingLimits,
  MarketStatus,
  TradingVenue,
} from '../types/trading.js';
import {
  TradingError,
  InsufficientFundsError,
  MarketClosedError,
  InvalidOrderError,
} from '../types/trading.js';

export class TradingManager {
  private trApi: TradeRepublicAPI;
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.trApi = new TradeRepublicAPI();
    this.authManager = authManager;
  }

  /**
   * Ensure user is authenticated before trading operations
   */
  private ensureAuthenticated(): string {
    if (!this.authManager.isAuthenticated()) {
      throw new TradingError('Authentication required for trading operations', 'NOT_AUTHENTICATED');
    }

    const session = this.authManager.getSession();
    if (!session?.token?.accessToken) {
      throw new TradingError('No valid access token', 'INVALID_TOKEN');
    }

    return session.token.accessToken;
  }

  /**
   * Validate order data before submission
   */
  private validateBuyOrder(orderData: BuyOrderData): void {
    if (!orderData.isin || orderData.isin.length !== 12) {
      throw new InvalidOrderError('Invalid ISIN format');
    }

    if (!orderData.quantity && !orderData.amount) {
      throw new InvalidOrderError('Either quantity or amount must be specified');
    }

    if (orderData.quantity && orderData.quantity <= 0) {
      throw new InvalidOrderError('Quantity must be positive');
    }

    if (orderData.amount && orderData.amount <= 0) {
      throw new InvalidOrderError('Amount must be positive');
    }

    if (orderData.orderType === 'limit' && !orderData.limitPrice) {
      throw new InvalidOrderError('Limit price required for limit orders');
    }

    if (orderData.limitPrice && orderData.limitPrice <= 0) {
      throw new InvalidOrderError('Limit price must be positive');
    }
  }

  private validateSellOrder(orderData: SellOrderData): void {
    if (!orderData.isin || orderData.isin.length !== 12) {
      throw new InvalidOrderError('Invalid ISIN format');
    }

    if (!orderData.quantity || orderData.quantity <= 0) {
      throw new InvalidOrderError('Quantity must be positive');
    }

    if (orderData.orderType === 'limit' && !orderData.limitPrice) {
      throw new InvalidOrderError('Limit price required for limit orders');
    }

    if (orderData.limitPrice && orderData.limitPrice <= 0) {
      throw new InvalidOrderError('Limit price must be positive');
    }
  }

  // ===== ORDER OPERATIONS =====

  /**
   * Place a buy order
   */
  async placeBuyOrder(orderData: BuyOrderData): Promise<OrderResponse> {
    const sessionToken = this.ensureAuthenticated();
    this.validateBuyOrder(orderData);

    try {
      logger.info('📈 Placing buy order', { 
        isin: orderData.isin,
        orderType: orderData.orderType,
        quantity: orderData.quantity,
        amount: orderData.amount,
      });

      const response = await this.trApi.placeBuyOrder(orderData, sessionToken);

      if (response.error) {
        this.handleTradingError(response.error);
      }

      if (!response.data) {
        throw new TradingError('No order data received', 'INVALID_RESPONSE');
      }

      logger.info('✅ Buy order placed successfully', { 
        orderId: response.data.orderId,
        isin: orderData.isin,
      });

      return response.data as OrderResponse;
    } catch (error) {
      logger.error('❌ Failed to place buy order', {
        error: error instanceof Error ? error.message : error,
        isin: orderData.isin,
      });
      throw error;
    }
  }

  /**
   * Place a sell order
   */
  async placeSellOrder(orderData: SellOrderData): Promise<OrderResponse> {
    const sessionToken = this.ensureAuthenticated();
    this.validateSellOrder(orderData);

    try {
      logger.info('📉 Placing sell order', { 
        isin: orderData.isin,
        orderType: orderData.orderType,
        quantity: orderData.quantity,
      });

      const response = await this.trApi.placeSellOrder(orderData, sessionToken);

      if (response.error) {
        this.handleTradingError(response.error);
      }

      if (!response.data) {
        throw new TradingError('No order data received', 'INVALID_RESPONSE');
      }

      logger.info('✅ Sell order placed successfully', { 
        orderId: response.data.orderId,
        isin: orderData.isin,
      });

      return response.data as OrderResponse;
    } catch (error) {
      logger.error('❌ Failed to place sell order', {
        error: error instanceof Error ? error.message : error,
        isin: orderData.isin,
      });
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const sessionToken = this.ensureAuthenticated();

    try {
      logger.info('❌ Cancelling order', { orderId });

      const response = await this.trApi.cancelOrder(orderId, sessionToken);

      if (response.error) {
        this.handleTradingError(response.error, orderId);
      }

      logger.info('✅ Order cancelled successfully', { orderId });
      return true;
    } catch (error) {
      logger.error('❌ Failed to cancel order', {
        error: error instanceof Error ? error.message : error,
        orderId,
      });
      throw error;
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(filters?: OrderHistoryFilters): Promise<OrderHistory[]> {
    const sessionToken = this.ensureAuthenticated();

    try {
      logger.info('📋 Retrieving order history', { filters });

      const response = await this.trApi.getOrderHistory(sessionToken, filters);

      if (response.error) {
        this.handleTradingError(response.error);
      }

      if (!response.data?.orders) {
        throw new TradingError('No order history data received', 'INVALID_RESPONSE');
      }

      logger.info('✅ Order history retrieved successfully', { 
        count: response.data.orders.length,
      });

      return response.data.orders as OrderHistory[];
    } catch (error) {
      logger.error('❌ Failed to retrieve order history', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  // ===== MARKET DATA =====

  /**
   * Get real-time price for instrument
   */
  async getRealTimePrice(isin: string): Promise<RealTimePrice> {
    const sessionToken = this.ensureAuthenticated();

    try {
      logger.debug('💰 Getting real-time price', { isin });

      const response = await this.trApi.getRealTimePrice(isin, sessionToken);

      if (response.error) {
        throw new TradingError(
          response.error.message,
          response.error.code
        );
      }

      if (!response.data) {
        throw new TradingError('No price data received', 'INVALID_RESPONSE');
      }

      return response.data as RealTimePrice;
    } catch (error) {
      logger.error('❌ Failed to get real-time price', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(
    isin: string, 
    period: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y'
  ): Promise<HistoricalPricesResponse> {
    const sessionToken = this.ensureAuthenticated();

    try {
      logger.debug('📊 Getting historical prices', { isin, period });

      const response = await this.trApi.getHistoricalPrices(isin, period, sessionToken);

      if (response.error) {
        throw new TradingError(
          response.error.message,
          response.error.code
        );
      }

      if (!response.data) {
        throw new TradingError('No historical data received', 'INVALID_RESPONSE');
      }

      return response.data as HistoricalPricesResponse;
    } catch (error) {
      logger.error('❌ Failed to get historical prices', {
        error: error instanceof Error ? error.message : error,
        isin,
        period,
      });
      throw error;
    }
  }

  /**
   * Get market news
   */
  async getMarketNews(isin?: string, limit: number = 20): Promise<MarketNewsResponse> {
    const sessionToken = this.ensureAuthenticated();

    try {
      logger.debug('📰 Getting market news', { isin, limit });

      const response = await this.trApi.getMarketNews(sessionToken, isin, limit);

      if (response.error) {
        throw new TradingError(
          response.error.message,
          response.error.code
        );
      }

      if (!response.data) {
        throw new TradingError('No news data received', 'INVALID_RESPONSE');
      }

      return response.data as MarketNewsResponse;
    } catch (error) {
      logger.error('❌ Failed to get market news', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  // ===== WATCHLIST OPERATIONS =====

  /**
   * Get watchlist
   */
  async getWatchlist(): Promise<WatchlistResponse> {
    const sessionToken = this.ensureAuthenticated();

    try {
      logger.debug('👁️ Getting watchlist');

      const response = await this.trApi.getWatchlist(sessionToken);

      if (response.error) {
        throw new TradingError(
          response.error.message,
          response.error.code
        );
      }

      if (!response.data) {
        throw new TradingError('No watchlist data received', 'INVALID_RESPONSE');
      }

      return response.data as WatchlistResponse;
    } catch (error) {
      logger.error('❌ Failed to get watchlist', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Add instrument to watchlist
   */
  async addToWatchlist(isin: string): Promise<boolean> {
    const sessionToken = this.ensureAuthenticated();

    if (!isin || isin.length !== 12) {
      throw new InvalidOrderError('Invalid ISIN format');
    }

    try {
      logger.info('➕ Adding to watchlist', { isin });

      const response = await this.trApi.addToWatchlist(isin, sessionToken);

      if (response.error) {
        throw new TradingError(
          response.error.message,
          response.error.code
        );
      }

      logger.info('✅ Added to watchlist successfully', { isin });
      return true;
    } catch (error) {
      logger.error('❌ Failed to add to watchlist', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  /**
   * Remove instrument from watchlist
   */
  async removeFromWatchlist(isin: string): Promise<boolean> {
    const sessionToken = this.ensureAuthenticated();

    if (!isin || isin.length !== 12) {
      throw new InvalidOrderError('Invalid ISIN format');
    }

    try {
      logger.info('➖ Removing from watchlist', { isin });

      const response = await this.trApi.removeFromWatchlist(isin, sessionToken);

      if (response.error) {
        throw new TradingError(
          response.error.message,
          response.error.code
        );
      }

      logger.info('✅ Removed from watchlist successfully', { isin });
      return true;
    } catch (error) {
      logger.error('❌ Failed to remove from watchlist', {
        error: error instanceof Error ? error.message : error,
        isin,
      });
      throw error;
    }
  }

  // ===== ERROR HANDLING =====

  /**
   * Handle trading-specific errors
   */
  private handleTradingError(error: { code: string; message: string; details?: any }, orderId?: string): never {
    switch (error.code) {
      case 'INSUFFICIENT_FUNDS':
        const { required, available, currency } = error.details || {};
        throw new InsufficientFundsError(required, available, currency);
      
      case 'MARKET_CLOSED':
        const venue = error.details?.venue || 'Unknown';
        throw new MarketClosedError(venue as TradingVenue);
      
      case 'INVALID_ORDER':
        throw new InvalidOrderError(error.message);
      
      default:
        throw new TradingError(error.message, error.code, orderId);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if markets are open for trading
   */
  async getMarketStatus(venue: TradingVenue): Promise<MarketStatus> {
    // This would typically call a real API endpoint
    // For now, return mock data based on time
    const now = new Date();
    const hour = now.getHours();
    
    let status: 'open' | 'closed' | 'pre_market' | 'after_hours';
    
    if (hour >= 9 && hour < 17) {
      status = 'open';
    } else if (hour >= 8 && hour < 9) {
      status = 'pre_market';
    } else if (hour >= 17 && hour < 20) {
      status = 'after_hours';
    } else {
      status = 'closed';
    }

    return {
      venue,
      status,
      timezone: 'Europe/Berlin',
    };
  }

  /**
   * Get trading limits for current account
   */
  async getTradingLimits(): Promise<TradingLimits> {
    const sessionToken = this.ensureAuthenticated();

    try {
      // This would call a real API endpoint
      // For now, return mock limits
      return {
        dailyOrderLimit: 100,
        maxOrderValue: 50000,
        minOrderValue: 1,
        availableCash: 10000,
        currency: 'EUR',
        restrictions: {
          dayTrading: true,
          shortSelling: false,
          optionsTrading: false,
        },
      };
    } catch (error) {
      logger.error('❌ Failed to get trading limits', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
}
