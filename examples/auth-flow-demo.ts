/**
 * Trade Republic Authentication Flow Demo
 * 
 * This example demonstrates the complete 2FA authentication flow:
 * 1. Login with phone number and PIN
 * 2. Handle MFA challenge (SMS/App token)
 * 3. Complete authentication
 * 
 * Author: Carlos Damken (carlos@damken.com)
 */

import { TradeRepublicClient, getCredentialsFromEnv } from '../src/index';
import { AuthenticationError } from '../src/auth/manager';
import { logger } from '../src/utils/logger';
import readline from 'readline';

// Set up readline for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function demonstrateAuthFlow() {
  console.log('🚀 Trade Republic Authentication Flow Demo');
  console.log('==========================================');

  try {
    // Create client
    const client = new TradeRepublicClient({
      logLevel: 'info',
    });

    await client.initialize();

    // Get credentials from environment or prompt
    let credentials = getCredentialsFromEnv();
    
    if (!credentials) {
      console.log('\n📱 Enter your Trade Republic credentials:');
      const username = await askQuestion('Phone number (e.g., +49 176 12345678): ');
      const password = await askQuestion('PIN (4-6 digits): ');
      
      credentials = { username, password };
    }

    console.log('\n🔑 Step 1: Attempting login with phone number and PIN...');
    
    try {
      // This will trigger MFA challenge
      const session = await client.login(credentials);
      console.log('✅ Login successful (no MFA required):', session.userId);
      
    } catch (error) {
      if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
        console.log('📲 Step 2: MFA authentication required');
        
        // Extract challenge from error
        const challenge = (error as any).challenge;
        if (challenge) {
          console.log(`📨 ${challenge.message}`);
          console.log(`⏰ Code expires at: ${new Date(challenge.expiresAt).toLocaleTimeString()}`);
          
          // Prompt for MFA code
          const mfaCode = await askQuestion('\nEnter 4-digit code from Trade Republic app: ');
          
          const mfaResponse = {
            challengeId: challenge.challengeId,
            code: mfaCode,
          };

          console.log('\n🔐 Step 3: Submitting MFA code...');
          
          try {
            const session = await client.submitMFA(challenge, mfaResponse);
            console.log('✅ MFA authentication successful!');
            console.log('👤 User ID:', session.userId);
            console.log('🎫 Session ID:', session.sessionId);
            console.log('⏰ Token expires at:', new Date(session.token.expiresAt).toLocaleString());
            
            // Now you can use the client for API calls
            console.log('\n🎉 Ready to make Trade Republic API calls!');
            
            // Demo: Get portfolio (mocked for now)
            console.log('\n📊 Testing API call - Getting portfolio...');
            try {
              const portfolio = await client.getPortfolio();
              console.log('📈 Portfolio loaded:', {
                totalValue: portfolio.totalValue,
                assetCount: portfolio.positions.length,
              });
            } catch (apiError) {
              console.log('⚠️  Portfolio API not yet implemented:', (apiError as Error).message);
            }
            
          } catch (mfaError) {
            console.error('❌ MFA authentication failed:', (mfaError as Error).message);
          }
        }
      } else {
        console.error('❌ Login failed:', (error as Error).message);
      }
    }

  } catch (error) {
    console.error('💥 Demo failed:', (error as Error).message);
  } finally {
    rl.close();
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAuthFlow().catch(console.error);
}

export { demonstrateAuthFlow };
