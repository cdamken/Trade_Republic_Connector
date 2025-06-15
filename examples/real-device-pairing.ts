/**
 * REAL Trade Republic Device Pairing with SMS 2FA
 * 
 * This implements the REAL device pairing flow that triggers SMS/App 2FA:
 * 1. Initiate device pairing with phone/PIN
 * 2. Trade Republic sends 4-digit SMS/App code
 * 3. Complete pairing with the code
 * 4. Get real authenticated session
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

async function realDevicePairingWith2FA() {
  console.log('\n📱 REAL Trade Republic Device Pairing with SMS 2FA');
  console.log('==================================================');
  console.log('🎯 This will trigger REAL SMS/App code from Trade Republic');
  console.log('⚠️  You will receive a 4-digit code on your phone');
  
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

  try {
    console.log('\n🗑️  Step 1: Clean Slate - Remove Old Device Keys');
    console.log('===============================================');
    
    // Remove existing device keys to force fresh pairing
    const deviceKeysPath = join(homedir(), '.tr-connector', 'device-keys.json');
    const sessionPath = join(homedir(), '.tr-connector', 'session.json');
    
    try {
      await unlink(deviceKeysPath);
      console.log('✅ Removed old device keys');
    } catch (error) {
      console.log('ℹ️  No old device keys found');
    }
    
    try {
      await unlink(sessionPath);
      console.log('✅ Removed old session');
    } catch (error) {
      console.log('ℹ️  No old session found');
    }

    console.log('\n📱 Step 2: Initiate Device Pairing (Triggers SMS/App Code)');
    console.log('=========================================================');
    
    // Create auth manager directly to access pairing methods
    const authManager = new AuthManager();
    
    console.log('🚀 Sending device pairing request to Trade Republic...');
    console.log('📲 Trade Republic will send you a 4-digit code via SMS or app');
    console.log('⏳ Please wait...');
    
    try {
      // This should trigger the real 2FA SMS/app code
      const challenge = await authManager.initiateDevicePairing({
        username: config.trUsername!,
        password: config.trPassword!
      });
      
      console.log('\n🎉 SUCCESS! Trade Republic sent 2FA challenge!');
      console.log('==============================================');
      console.log(`✅ Challenge received!`);
      console.log(`📱 Challenge Type: ${challenge.type}`);
      console.log(`💬 Message: ${challenge.message}`);
      console.log(`⏰ Expires: ${new Date(challenge.expiresAt).toLocaleString()}`);
      console.log(`🆔 Process ID: ${challenge.challengeId}`);
      
      // Ask for the 4-digit code
      console.log('\n📲 Check your phone for the 4-digit Trade Republic code');
      const code = await askQuestion('🔢 Enter the 4-digit code: ');
      
      if (!code || code.trim().length !== 4 || !/^\d{4}$/.test(code.trim())) {
        console.log('❌ Invalid code format. Must be exactly 4 digits.');
        rl.close();
        return;
      }
      
      console.log('\n🔐 Step 3: Complete Device Pairing');
      console.log('=================================');
      console.log('⏳ Submitting your 4-digit code...');
      
      try {
        // Complete device pairing with the code
        const deviceKeys = await authManager.completeDevicePairing({
          challengeId: challenge.challengeId,
          code: code.trim()
        });
        
        console.log('\n🎉 DEVICE PAIRING SUCCESSFUL!');
        console.log('============================');
        console.log('✅ Device successfully paired with Trade Republic!');
        console.log(`🔑 Device ID: ${deviceKeys.deviceId || 'Generated'}`);
        console.log('💾 Device keys saved securely');
        
        console.log('\n🔐 Step 4: Authenticate with New Device Keys');
        console.log('==========================================');
        
        // Now try to login with the new device keys
        const client = new TradeRepublicClient();
        await client.initialize();
        
        const session = await client.login({
          username: config.trUsername!,
          password: config.trPassword!
        });
        
        console.log('\n🎉 FULL AUTHENTICATION SUCCESS!');
        console.log('===============================');
        console.log(`✅ Authenticated User ID: ${session.userId}`);
        console.log(`🎫 Session ID: ${session.sessionId}`);
        console.log(`⏰ Token expires: ${new Date(session.token.expiresAt).toLocaleString()}`);
        console.log('🔐 2FA verification: COMPLETED');
        
        // Save success data
        const successData = {
          devicePairingCompleted: true,
          authenticationSuccessful: true,
          userId: session.userId,
          sessionId: session.sessionId,
          deviceId: deviceKeys.deviceId,
          authenticatedAt: new Date().toISOString(),
          tokenExpiresAt: new Date(session.token.expiresAt).toISOString(),
          twoFactorVerified: true
        };
        
        const successFile = './data/device-pairing-success.json';
        await writeFile(successFile, JSON.stringify(successData, null, 2));
        console.log(`\n💾 Success data saved: ${successFile}`);
        
        console.log('\n🚀 NOW YOU CAN GET REAL ACCOUNT DATA!');
        console.log('====================================');
        console.log('✅ Device is paired and authenticated');
        console.log('✅ 2FA verification completed');
        console.log('✅ Ready to access real Trade Republic data');
        console.log('💡 Run: npm run extract:account');
        
        await client.logout();
        
      } catch (completionError) {
        console.log(`❌ Device pairing completion failed: ${completionError}`);
        console.log('💡 Possible reasons:');
        console.log('   • Wrong 4-digit code');
        console.log('   • Code expired (try again)');
        console.log('   • Network/API error');
      }
      
    } catch (initiationError) {
      console.log(`❌ Device pairing initiation failed: ${initiationError}`);
      console.log('💡 Possible reasons:');
      console.log('   • Wrong phone number or PIN');
      console.log('   • Account locked or suspended');
      console.log('   • API endpoint issues');
      console.log('   • Network connectivity problems');
    }
    
  } catch (error) {
    console.log(`❌ Process failed: ${error}`);
  } finally {
    rl.close();
  }
}

// Run the real device pairing with 2FA
realDevicePairingWith2FA().catch(console.error);
