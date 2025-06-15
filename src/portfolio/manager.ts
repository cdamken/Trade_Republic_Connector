/**
 * Portfolio Manager
 *
 * Handles Trade Republic portfolio operations including positions,
 * performance tracking, and market data integration.
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicAPI } from '../api/trade-republic-api.js';
import { AuthManager } from '../auth/manager.js';
import { AuthenticationError } from '../types/auth.js';
import type { Position, PortfolioSummary, CashPosition, PortfolioPerformance } from '../types/portfolio.js';
import { logger } from '../utils/logger.js';

export interface InstrumentInfo {
  isin: string;
  name: string;
  shortName?: string;
  type: 'stock' | 'etf' | 'fund' | 'crypto' | 'derivative';
  currency: string;
  exchange?: string;
  company?: {
    name: string;
    country: string;
    sector?: string;
    description?: string;
  };
  price?: {
    value: number;
    currency: string;
    timestamp: Date;
    exchange?: string;
  };
}

export interface SearchResult {
  isin: string;
  name: string;
  type: string;
  currency: string;
  tags?: string[];
}

export class PortfolioManager {
  private trApi: TradeRepublicAPI;
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.trApi = new TradeRepublicAPI();
  }

  /**
   * Get current session token for API calls
   */
  private async getSessionToken(): Promise<string> {
    const session = this.authManager.getSession();
    if (!session) {
      throw new AuthenticationError('No active session. Please login first.', 'NO_SESSION');
    }

    // Check if token is expired
    if (session.token.expiresAt <= Date.now()) {
      throw new AuthenticationError('Session expired. Please login again.', 'SESSION_EXPIRED');
    }

    return session.token.accessToken;
  }

  /**
   * Get all portfolio positions
   */
  async getPositions(): Promise<Position[]> {
    try {
      logger.info('📊 Fetching portfolio positions...');
      
      const sessionToken = await this.getSessionToken();
      const response = await this.trApi.getPortfolioPositions(sessionToken);

      if (response.error) {
        throw new AuthenticationError(response.error.message, response.error.code);
      }

      if (!response.data) {
        return [];
      }

      // Transform API response to our Position interface
      const positions: Position[] = (response.data.positions || response.data).map((pos: any) => ({
        instrumentId: pos.isin || pos.instrumentId,
        name: pos.name || pos.shortName,
        quantity: parseFloat(pos.quantity || pos.size || 0),
        averagePrice: parseFloat(pos.averagePrice || pos.buyPrice || 0),
        currentPrice: parseFloat(pos.currentPrice || pos.price || 0),
        marketValue: parseFloat(pos.marketValue || pos.value || 0),
        unrealizedPnL: parseFloat(pos.unrealizedPnL || pos.pnl || 0),
        unrealizedPnLPercent: parseFloat(pos.unrealizedPnLPercent || pos.pnlPercent || 0),
        exchange: pos.exchange,
        exchangeIds: pos.exchangeIds,
        currency: pos.currency || 'EUR',
        lastUpdated: pos.lastUpdated ? new Date(pos.lastUpdated) : new Date(),
      }));

      logger.info(`✅ Retrieved ${positions.length} portfolio positions`);
      return positions;
    } catch (error) {
      logger.error('Failed to fetch portfolio positions', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get portfolio summary and overview
   */
  async getSummary(): Promise<PortfolioSummary> {
    try {
      logger.info('📊 Fetching portfolio summary...');
      
      const sessionToken = await this.getSessionToken();
      const response = await this.trApi.getPortfolioSummary(sessionToken);

      if (response.error) {
        throw new AuthenticationError(response.error.message, response.error.code);
      }

      if (!response.data) {
        throw new AuthenticationError('No portfolio data received', 'NO_DATA');
      }

      // Transform API response to our PortfolioSummary interface
      const data = response.data;
      const summary: PortfolioSummary = {
        totalValue: parseFloat(data.totalValue || data.portfolioValue || 0),
        totalInvested: parseFloat(data.totalInvested || data.investedAmount || 0),
        totalPnL: parseFloat(data.totalPnL || data.unrealizedPnL || 0),
        totalPnLPercent: parseFloat(data.totalPnLPercent || data.unrealizedPnLPercent || 0),
        availableCash: parseFloat(data.availableCash || data.cash || 0),
        currency: data.currency || 'EUR',
        positionCount: parseInt(data.positionCount || data.positions?.length || 0),
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
      };

      logger.info('✅ Portfolio summary retrieved successfully');
      return summary;
    } catch (error) {
      logger.error('Failed to fetch portfolio summary', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get specific position by ISIN
   */
  async getPosition(isin: string): Promise<Position | null> {
    try {
      logger.info('📊 Fetching position details...', { isin });
      
      const positions = await this.getPositions();
      const position = positions.find(pos => pos.instrumentId === isin);

      if (position) {
        logger.info('✅ Position found', { isin, value: position.marketValue });
      } else {
        logger.info('📭 Position not found in portfolio', { isin });
      }

      return position || null;
    } catch (error) {
      logger.error('Failed to fetch position', { isin, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get cash position and available funds
   */
  async getCash(): Promise<CashPosition> {
    try {
      logger.info('💰 Fetching cash position...');
      
      const summary = await this.getSummary();

      const cashPosition: CashPosition = {
        amount: summary.availableCash,
        currency: summary.currency,
        availableForPayout: summary.availableCash, // Assuming full amount is available for payout
        availableForInvestment: summary.availableCash, // Assuming full amount is available for investment
      };

      logger.info('✅ Cash position retrieved', { amount: cashPosition.amount, currency: cashPosition.currency });
      return cashPosition;
    } catch (error) {
      logger.error('Failed to fetch cash position', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get portfolio performance for a given timeframe
   */
  async getPerformance(timeframe: PortfolioPerformance['timeframe'] = '1M'): Promise<PortfolioPerformance> {
    try {
      logger.info('📈 Calculating portfolio performance...', { timeframe });
      
      // For now, calculate performance based on current positions
      // In a real implementation, this would fetch historical data
      const summary = await this.getSummary();

      const performance: PortfolioPerformance = {
        timeframe,
        absoluteChange: summary.totalPnL,
        percentChange: summary.totalPnLPercent,
        data: [
          {
            timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            value: summary.totalValue - summary.totalPnL,
          },
          {
            timestamp: new Date(),
            value: summary.totalValue,
          },
        ],
      };

      logger.info('✅ Portfolio performance calculated', { 
        change: performance.absoluteChange, 
        changePercent: performance.percentChange 
      });
      return performance;
    } catch (error) {
      logger.error('Failed to calculate portfolio performance', { timeframe, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get instrument information by ISIN
   */
  async getInstrumentInfo(isin: string): Promise<InstrumentInfo | null> {
    try {
      logger.info('🔍 Fetching instrument information...', { isin });
      
      const sessionToken = await this.getSessionToken();
      const response = await this.trApi.getInstrumentInfo(isin, sessionToken);

      if (response.error) {
        if (response.error.code === 'HTTP_404') {
          logger.info('📭 Instrument not found', { isin });
          return null;
        }
        throw new AuthenticationError(response.error.message, response.error.code);
      }

      if (!response.data) {
        return null;
      }

      // Transform API response to our InstrumentInfo interface
      const data = response.data;
      const instrumentInfo: InstrumentInfo = {
        isin: data.isin || isin,
        name: data.name || data.shortName || '',
        shortName: data.shortName,
        type: data.type || 'stock',
        currency: data.currency || 'EUR',
        exchange: data.exchange,
        company: data.company ? {
          name: data.company.name || data.name,
          country: data.company.country || 'Unknown',
          sector: data.company.sector,
          description: data.company.description,
        } : undefined,
        price: data.price ? {
          value: parseFloat(data.price.value || data.price || 0),
          currency: data.price.currency || data.currency || 'EUR',
          timestamp: data.price.timestamp ? new Date(data.price.timestamp) : new Date(),
          exchange: data.price.exchange,
        } : undefined,
      };

      logger.info('✅ Instrument information retrieved', { isin, name: instrumentInfo.name });
      return instrumentInfo;
    } catch (error) {
      logger.error('Failed to fetch instrument information', { isin, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Search for instruments by name or symbol
   */
  async searchInstruments(query: string): Promise<SearchResult[]> {
    try {
      logger.info('🔍 Searching instruments...', { query });
      
      const sessionToken = await this.getSessionToken();
      const response = await this.trApi.searchInstruments(query, sessionToken);

      if (response.error) {
        throw new AuthenticationError(response.error.message, response.error.code);
      }

      if (!response.data) {
        return [];
      }

      // Transform API response to our SearchResult interface
      const results: SearchResult[] = (response.data.results || response.data).map((item: any) => ({
        isin: item.isin || item.instrumentId,
        name: item.name || item.shortName || '',
        type: item.type || 'stock',
        currency: item.currency || 'EUR',
        tags: item.tags || [],
      }));

      logger.info(`✅ Found ${results.length} instruments`, { query });
      return results;
    } catch (error) {
      logger.error('Failed to search instruments', { query, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get positions filtered by minimum value
   */
  async getPositionsByValue(minValue: number = 0): Promise<Position[]> {
    try {
      const positions = await this.getPositions();
      const filtered = positions.filter(pos => pos.marketValue >= minValue);
      
      logger.info(`📊 Filtered positions by value >= ${minValue}`, { 
        total: positions.length, 
        filtered: filtered.length 
      });
      
      return filtered;
    } catch (error) {
      logger.error('Failed to filter positions by value', { minValue, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get positions with positive performance
   */
  async getWinningPositions(): Promise<Position[]> {
    try {
      const positions = await this.getPositions();
      const winning = positions.filter(pos => pos.unrealizedPnL > 0);
      
      logger.info(`📈 Found ${winning.length} winning positions out of ${positions.length}`);
      return winning;
    } catch (error) {
      logger.error('Failed to get winning positions', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get positions with negative performance
   */
  async getLosingPositions(): Promise<Position[]> {
    try {
      const positions = await this.getPositions();
      const losing = positions.filter(pos => pos.unrealizedPnL < 0);
      
      logger.info(`📉 Found ${losing.length} losing positions out of ${positions.length}`);
      return losing;
    } catch (error) {
      logger.error('Failed to get losing positions', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }
}
