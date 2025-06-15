/**
 * Force Fresh Device Pairing with 2FA - AUTOMATED (NO PROMPTS)
 * 
 * This will reset device pairing and force 2FA verification automatically
 * 
 * @author Carlos Damken <carlos@damken.com>
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AuthManager } from '../src/auth/manager.js';
import { logger } from '../src/utils/logger.js';
import { loadEnvironmentConfig } from '../src/config/environment.js';
import { createInterface } from 'readline';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function forceFreshDevicePairing() {
  console.log('\n🔄 AUTOMATED FRESH DEVICE PAIRING WITH 2FA');
  console.log('==========================================');
  console.log('🎯 This will automatically reset device pairing and trigger 2FA');
  console.log('⚠️  You will only need to enter the 4-digit code from Trade Republic');
  
  // Load real credentials
  const config = loadEnvironmentConfig();
  console.log(`📱 Phone: ${config.trUsername}`);
  console.log(`🔐 PIN: ${'*'.repeat(config.trPassword?.length || 0)}`);
  console.log(`🌐 API: ${config.apiUrl}`);

  if (!config.trUsername || !config.trPassword) {
    console.log('❌ Error: Missing TR_USERNAME or TR_PASSWORD in .env file');
    rl.close();
    return;
  }

  console.log('✅ Auto-proceeding with device pairing reset...');

  try {
    console.log('\n🗑️  Step 1: Remove Existing Device Keys');
    console.log('======================================');
    
    // Remove existing device keys to force fresh pairing
    const deviceKeysPath = join(homedir(), '.tr-connector', 'device-keys.json');
    const sessionPath = join(homedir(), '.tr-connector', 'session.json');
    
    try {
      await unlink(deviceKeysPath);
      console.log('✅ Removed existing device keys');
    } catch (error) {
      console.log('ℹ️  No existing device keys to remove');
    }
    
    try {
      await unlink(sessionPath);
      console.log('✅ Removed existing session');
    } catch (error) {
      console.log('ℹ️  No existing session to remove');
    }

    console.log('\n🔐 Step 2: Initiate Fresh Device Pairing');
    console.log('========================================');
    
    const client = new TradeRepublicClient();
    const authManager = new AuthManager();
    
    console.log('🚀 Starting device pairing process...');
    console.log('📱 Trade Republic will send you a 4-digit code via SMS/App');
    
    try {
      // Initiate device pairing - this should trigger SMS/App 2FA
      console.log('📞 Initiating device pairing with Trade Republic...');
      const challenge = await authManager.initiateDevicePairing({
        username: config.trUsername!,
        password: config.trPassword!
      });
      
      console.log('✅ Device pairing initiated successfully!');
      console.log(`✅ Challenge received: ${challenge.type}`);
      console.log(`💬 Message: ${challenge.message}`);
      console.log(`⏰ Expires: ${new Date(challenge.expiresAt).toLocaleString()}`);
      console.log('📱 You should receive a 4-digit code via SMS or Trade Republic app');
      
      // Ask for the 4-digit code
      const code = await askQuestion('📲 Enter the 4-digit code from Trade Republic: ');
      
      if (!code || code.trim().length !== 4) {
        console.log('❌ Invalid code. Must be 4 digits.');
        rl.close();
        return;
      }
      
      console.log('🔐 Completing device pairing...');
      
      // Complete device pairing with the 4-digit code
      const deviceKeys = await authManager.completeDevicePairing({
        challengeId: challenge.challengeId,
        code: code.trim()
      });
      console.log('✅ Device pairing completed successfully!');
      console.log(`🔑 Device ID: ${deviceKeys.deviceId}`);
      
      console.log('\n🔐 Step 3: Authenticate with New Device Keys');
      console.log('===========================================');
      
      // Now try to login with the new device keys
      await client.initialize();
      const session = await client.login({
        username: config.trUsername!,
        password: config.trPassword!
      });
      
      console.log('\n🎉 FRESH DEVICE PAIRING COMPLETED!');
      console.log('=================================');
      console.log(`✅ Authenticated User ID: ${session.userId}`);
      console.log(`🎫 Session ID: ${session.sessionId}`);
      console.log(`⏰ Token expires: ${new Date(session.token.expiresAt).toLocaleString()}`);
      console.log('🔐 2FA verification: COMPLETED');
      
      // Save success data
      const successData = {
        freshDevicePairingCompleted: true,
        authenticationSuccessful: true,
        userId: session.userId,
        sessionId: session.sessionId,
        deviceId: deviceKeys.deviceId,
        authenticatedAt: new Date().toISOString(),
        tokenExpiresAt: new Date(session.token.expiresAt).toISOString(),
        twoFactorVerified: true
      };
      
      const successFile = './data/fresh-device-pairing-success.json';
      await writeFile(successFile, JSON.stringify(successData, null, 2));
      console.log(`\n💾 Success data saved: ${successFile}`);
      
      console.log('\n🚀 READY FOR REAL DATA COLLECTION!');
      console.log('=================================');
      console.log('✅ Fresh device pairing completed');
      console.log('✅ 2FA verification successful');
      console.log('✅ Ready to collect all assets and portfolio data');
      console.log('� Run: npm run assets:all');
      
      await client.logout();
      
    } catch (error) {
      console.log(`❌ Device pairing failed: ${error}`);
      console.log('💡 Possible reasons:');
      console.log('   • Wrong phone number or PIN');
      console.log('   • Wrong 4-digit code');
      console.log('   • Code expired (try again)');
      console.log('   • Account locked or suspended');
      console.log('   • API endpoint issues');
    }
    
  } catch (error) {
    console.log(`❌ Process failed: ${error}`);
  } finally {
    rl.close();
  }
}

// Run the fresh device pairing
forceFreshDevicePairing().catch(console.error);
