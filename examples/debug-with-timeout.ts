#!/usr/bin/env tsx
/**
 * Debug script with built-in timeout functionality to diagnose hanging issues
 */

import { config } from 'dotenv';
import { AuthManager } from '../src/auth/manager.js';
import { TradeRepublicAPI } from '../src/api/trade-republic-api.js';
import { logger } from '../src/utils/logger.js';

config();

async function runWithTimeout<T>(
  operation: () => Promise<T>, 
  timeoutMs: number = 30000,
  operationName: string = 'Operation'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation()
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function debugAuthStatus() {
  try {
    logger.info('🔍 Starting debug session...');
    
    // Test 1: Check AuthManager initialization
    logger.info('📱 Test 1: Initializing AuthManager...');
    const authManager = await runWithTimeout(
      () => Promise.resolve(new AuthManager()),
      5000,
      'AuthManager initialization'
    );
    logger.info('✅ AuthManager initialized');

    // Test 2: Check session validation
    logger.info('🔐 Test 2: Checking session validation...');
    const validation = await runWithTimeout(
      () => authManager.validateSessionAndConnectivity(),
      15000,
      'Session validation'
    );
    logger.info(`✅ Session validation completed:`, validation);

    // Test 3: Check API client initialization
    logger.info('🌐 Test 3: Initializing API client...');
    const apiClient = await runWithTimeout(
      () => Promise.resolve(new TradeRepublicAPI()),
      5000,
      'API client initialization'
    );
    logger.info('✅ API client initialized');

    // Test 4: Check connectivity
    logger.info('🔌 Test 4: Testing basic connectivity...');
    const connectivityTest = await runWithTimeout(
      async () => {
        const response = await fetch('https://api.traderepublic.com', {
          method: 'HEAD'
        });
        return response.status;
      },
      15000,
      'Connectivity test'
    );
    logger.info(`✅ Connectivity test completed: Status ${connectivityTest}`);

    // Test 5: Check environment variables
    logger.info('⚙️ Test 5: Checking environment variables...');
    const envCheck = {
      hasPhone: !!process.env.TR_PHONE,
      hasPin: !!process.env.TR_PIN,
      hasDeviceId: !!process.env.TR_DEVICE_ID,
      hasProcessId: !!process.env.TR_PROCESS_ID,
      hasDeviceToken: !!process.env.TR_DEVICE_TOKEN,
      hasRefreshToken: !!process.env.TR_REFRESH_TOKEN
    };
    logger.info('✅ Environment check:', envCheck);

    logger.info('🎉 All debug tests completed successfully!');
    
  } catch (error) {
    logger.error('❌ Debug test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('🛑 Debug session interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Debug session terminated');
  process.exit(0);
});

// Run debug
debugAuthStatus().catch(error => {
  logger.error('💥 Unhandled error:', error);
  process.exit(1);
});
