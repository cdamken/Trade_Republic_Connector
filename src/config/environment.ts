/**
 * Environment Configuration
 * 
 * Secure environment variable handling for Trade Republic credentials
 */

import { config } from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables from .env file
config();

export interface EnvironmentConfig {
  // Trade Republic Credentials (from environment variables)
  trUsername?: string;
  trPassword?: string;
  trPin?: string;
  
  // API Configuration
  apiUrl: string;
  websocketUrl: string;
  
  // Development/Testing
  isDevelopment: boolean;
  logLevel: string;
  
  // Security
  encryptionKey?: string;
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    // Credentials from environment variables (secure)
    trUsername: process.env.TR_USERNAME,
    trPassword: process.env.TR_PASSWORD,
    trPin: process.env.TR_PIN,
    
    // API endpoints
    apiUrl: process.env.TR_API_URL ?? 'https://api.traderepublic.com',
    websocketUrl: process.env.TR_WS_URL ?? 'wss://api.traderepublic.com/websocket',
    
    // Development settings
    isDevelopment: process.env.NODE_ENV !== 'production',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    
    // Security
    encryptionKey: process.env.TR_ENCRYPTION_KEY,
  };
}

export function validateCredentials(): boolean {
  const config = loadEnvironmentConfig();
  
  if (!config.trUsername || !config.trPassword) {
    logger.warn('Trade Republic credentials not found in environment variables');
    logger.info('Please set TR_USERNAME and TR_PASSWORD environment variables');
    return false;
  }
  
  return true;
}

export function getCredentialsFromEnv(): { username: string; password: string; pin?: string } | null {
  const config = loadEnvironmentConfig();
  
  if (!config.trUsername || !config.trPassword) {
    return null;
  }
  
  return {
    username: config.trUsername,
    password: config.trPassword,
    pin: config.trPin,
  };
}
