#!/usr/bin/env tsx

/**
 * Real Trade Republic Authentication Demo
 * 
 * Shows the actual device pairing and authentication flow
 * that connects to Trade Republic's real API endpoints.
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import * as readline from 'readline';
import { config } from 'dotenv';
import { TradeRepublicClient } from '../src/index.js';
import { AuthManager } from '../src/auth/manager.js';
import type { LoginCredentials, MFAResponse } from '../src/types/auth.js';
import { AuthenticationError, TwoFactorRequiredError } from '../src/types/auth.js';

// Load environment variables
config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Real Trade Republic Authentication Flow Demo
 */
async function demonstrateRealAuth() {
  console.log('🚀 Trade Republic Real API Authentication Demo');
  console.log('===============================================\n');

  const client = new TradeRepublicClient();
  const authManager = new AuthManager();

  try {
    // Get credentials from environment variables
    const username = process.env.TR_USERNAME;
    const password = process.env.TR_PASSWORD;

    if (!username || !password) {
      console.error('❌ Missing credentials in .env file');
      console.error('Please set TR_USERNAME and TR_PASSWORD in your .env file');
      return;
    }

    console.log(`📱 Using phone number: ${username.replace(/(\d{4})$/, '****')}`);
    console.log(`🔑 Using PIN: ${'*'.repeat(password.length)}`);

    const credentials: LoginCredentials = { username, password };

    // Step 1: Check if device is already paired
    console.log('\n🔍 Step 1: Checking device pairing status...');
    
    try {
      await authManager.initialize();
      console.log('✅ Device is already paired! Attempting login...\n');
      
      // Try to login with existing device keys
      const session = await authManager.login(credentials);
      
      console.log('✅ Login successful!');
      console.log(`👤 User ID: ${session.userId}`);
      console.log(`🆔 Session ID: ${session.sessionId}`);
      console.log(`⏰ Expires: ${new Date(session.token.expiresAt).toLocaleString()}`);
      
    } catch (error) {
      if (error instanceof AuthenticationError && error.code === 'DEVICE_NOT_PAIRED') {
        console.log('⚠️  Device not paired. Starting pairing process...\n');
        
        // Step 2: Device Pairing
        console.log('🔑 Step 2: Device Pairing with Trade Republic');
        console.log('This will connect to the REAL Trade Republic API!');
        console.log('Make sure you have your Trade Republic app ready.\n');
        
        try {
          console.log('📡 Contacting Trade Republic servers...');
          const challenge = await authManager.initiateDevicePairing(credentials);
          
          console.log('✅ Device pairing initiated!');
          console.log('📱 Please check your Trade Republic app for a 4-digit authentication code.\n');
          
          // Step 3: Complete pairing with app code
          const code = await askQuestion('Enter the 4-digit code from your TR app: ');
          
          const mfaResponse: MFAResponse = {
            challengeId: challenge.challengeId,
            code: code.trim(),
          };
          
          console.log('\n🔓 Completing device pairing...');
          const deviceKeys = await authManager.completeDevicePairing(mfaResponse);
          
          console.log('✅ Device successfully paired!');
          console.log(`🔑 Device ID: ${deviceKeys.deviceId}`);
          console.log('💾 Device keys have been securely stored.\n');
          
          // Step 4: Login with newly paired device
          console.log('🔓 Step 4: Logging in with paired device...');
          const session = await authManager.login(credentials);
          
          console.log('✅ Login successful!');
          console.log(`👤 User ID: ${session.userId}`);
          console.log(`🆔 Session ID: ${session.sessionId}`);
          console.log(`⏰ Expires: ${new Date(session.token.expiresAt).toLocaleString()}`);
          
        } catch (pairingError) {
          if (pairingError instanceof TwoFactorRequiredError) {
            console.error('❌ Invalid authentication code. Please try again.');
            console.error('💡 Make sure you enter the 4-digit code from your Trade Republic app.');
          } else {
            console.error('❌ Device pairing failed:', pairingError instanceof Error ? pairingError.message : pairingError);
          }
          throw pairingError;
        }
      } else {
        throw error;
      }
    }

    console.log('\n🎉 Authentication completed successfully!');
    console.log('📈 You can now use the Trade Republic API for trading operations.');

  } catch (error) {
    console.error('\n❌ Authentication failed:', error instanceof Error ? error.message : error);
    
    if (error instanceof AuthenticationError) {
      switch (error.code) {
        case 'INVALID_PHONE':
          console.error('💡 Please use format: +49 176 12345678 (German mobile number)');
          break;
        case 'INVALID_PIN':
          console.error('💡 PIN must be 4-6 digits');
          break;
        case 'NETWORK_ERROR':
          console.error('💡 Check your internet connection and try again');
          break;
        case 'RATE_LIMITED':
          console.error('💡 Too many attempts. Please wait and try again later');
          break;
        default:
          console.error('💡 Please check your credentials and try again');
      }
    }
  } finally {
    rl.close();
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRealAuth().catch(console.error);
}

export { demonstrateRealAuth };
