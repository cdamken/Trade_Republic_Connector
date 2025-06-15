#!/usr/bin/env tsx

/**
 * Enhanced CLI with Session Validation and Re-authentication
 * 
 * This enhanced CLI demonstrates:
 * 1. Session validation before operations
 * 2. Automatic re-authentication prompts when session expires
 * 3. 2FA handling
 * 4. Robust error handling for connectivity issues
 */

import { TradeRepublicClient } from '../src/api/client.js';
import { AuthenticationError, TwoFactorRequiredError } from '../src/types/auth.js';
import type { MFAChallenge, MFAResponse } from '../src/types/auth.js';
import { logger } from '../src/utils/logger.js';
import { createInterface } from 'readline';
import { promisify } from 'util';

// Set up readline for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = promisify(rl.question).bind(rl);

/**
 * CLI Commands
 */
interface Command {
  name: string;
  description: string;
  action: (client: TradeRepublicClient) => Promise<void>;
}

/**
 * Display session status
 */
async function showSessionStatus(client: TradeRepublicClient): Promise<void> {
  console.log('\n📊 Session Status Check');
  console.log('='.repeat(50));

  try {
    const validation = await client.validateSessionAndConnectivity();
    
    console.log(`🌐 Server reachable: ${validation.isServerReachable ? '✅ Yes' : '❌ No'}`);
    console.log(`🔐 Session valid: ${validation.isValid ? '✅ Yes' : '❌ No'}`);
    console.log(`🔄 Requires re-auth: ${validation.requiresReauth ? '❌ Yes' : '✅ No'}`);
    
    if (validation.error) {
      console.log(`⚠️  Error: ${validation.error}`);
    }

    const session = client.getSession();
    if (session) {
      const timeLeft = Math.max(0, session.token.expiresAt - Date.now());
      const minutesLeft = Math.floor(timeLeft / 60000);
      console.log(`⏰ Token expires in: ${minutesLeft} minutes`);
      console.log(`👤 User ID: ${session.userId}`);
      console.log(`🆔 Session ID: ${session.sessionId.substring(0, 8)}...`);
    } else {
      console.log('❌ No active session');
    }

  } catch (error) {
    console.error('❌ Failed to check session status:', error instanceof Error ? error.message : error);
  }
}

/**
 * Force re-authentication
 */
async function forceReAuthentication(client: TradeRepublicClient): Promise<void> {
  console.log('\n🔄 Force Re-authentication');
  console.log('='.repeat(50));

  try {
    console.log('Please enter your Trade Republic credentials:');
    const username = await question('Phone number (+49...): ');
    const password = await question('PIN: ');

    const credentials = { username: username.trim(), password: password.trim() };

    console.log('🔓 Attempting re-authentication...');
    const result = await client.forceReAuthentication(credentials);

    if (result.session) {
      console.log('✅ Re-authentication successful!');
      console.log(`👤 User ID: ${result.session.userId}`);
    } else if (result.requiresMFA && result.challenge) {
      console.log('🔐 2FA required');
      console.log(result.challenge.message || 'Enter the 4-digit code from your Trade Republic app:');
      
      const code = await question('2FA Code: ');
      const mfaResponse: MFAResponse = {
        challengeId: result.challenge.challengeId,
        code: code.trim(),
      };

      console.log('🔓 Completing 2FA...');
      await client.submitMFA(result.challenge, mfaResponse);
      console.log('✅ 2FA completed successfully!');
    }

  } catch (error) {
    console.error('❌ Re-authentication failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Test API operations with session validation
 */
async function testAPIOperations(client: TradeRepublicClient): Promise<void> {
  console.log('\n🧪 Test API Operations');
  console.log('='.repeat(50));

  const operations = [
    {
      name: 'Portfolio Summary',
      action: async () => {
        await client.ensureValidSession();
        return await client.portfolio.getSummary();
      }
    },
    {
      name: 'Search Instruments',
      action: async () => {
        await client.ensureValidSession();
        return await client.portfolio.searchInstruments('Apple');
      }
    },
    {
      name: 'Get Positions',
      action: async () => {
        await client.ensureValidSession();
        return await client.portfolio.getPositions();
      }
    }
  ];

  for (const operation of operations) {
    try {
      console.log(`\n🔍 Testing: ${operation.name}...`);
      const result = await operation.action();
      console.log(`✅ ${operation.name}: Success`);
      if (result && typeof result === 'object') {
        console.log(`📊 Result: ${Array.isArray(result) ? `${result.length} items` : 'Object returned'}`);
      }
    } catch (error) {
      console.error(`❌ ${operation.name}: Failed`);
      if (error instanceof AuthenticationError) {
        console.log(`🔐 Authentication error: ${error.message}`);
        console.log('💡 Try running "reauth" command to re-authenticate');
      } else {
        console.log(`⚠️  Error: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}

/**
 * Show help
 */
async function showHelp(): Promise<void> {
  console.log('\n📖 Available Commands');
  console.log('='.repeat(50));
  commands.forEach(cmd => {
    console.log(`${cmd.name.padEnd(12)} - ${cmd.description}`);
  });
  console.log('quit         - Exit the CLI');
}

/**
 * Available commands
 */
const commands: Command[] = [
  {
    name: 'status',
    description: 'Check session and connectivity status',
    action: showSessionStatus
  },
  {
    name: 'reauth',
    description: 'Force re-authentication with 2FA',
    action: forceReAuthentication
  },
  {
    name: 'test',
    description: 'Test API operations with session validation',
    action: testAPIOperations
  },
  {
    name: 'help',
    description: 'Show this help message',
    action: async () => { await showHelp(); }
  }
];

/**
 * Main CLI loop
 */
async function runCLI(): Promise<void> {
  const client = new TradeRepublicClient({
    sessionPersistence: true,
    autoRefreshTokens: true,
    logLevel: 'info',
  });

  try {
    console.log('🚀 Trade Republic Enhanced CLI');
    console.log('Features: Session validation, auto re-auth, 2FA handling');
    console.log('Type "help" for available commands or "quit" to exit\n');

    // Initialize client
    await client.initialize();

    // Check initial session status
    await showSessionStatus(client);

    // Main command loop
    while (true) {
      console.log('');
      const input = await question('TR-CLI> ');
      const commandName = input.trim().toLowerCase();

      if (commandName === 'quit' || commandName === 'exit') {
        console.log('👋 Goodbye!');
        break;
      }

      const command = commands.find(cmd => cmd.name === commandName);
      if (command) {
        try {
          await command.action(client);
        } catch (error) {
          console.error('❌ Command failed:', error instanceof Error ? error.message : error);
        }
      } else if (commandName) {
        console.log(`❌ Unknown command: ${commandName}`);
        console.log('Type "help" for available commands');
      }
    }

  } catch (error) {
    console.error('❌ CLI failed:', error instanceof Error ? error.message : error);
  } finally {
    // Cleanup
    try {
      await client.logout();
    } catch {
      // Ignore cleanup errors
    }
    rl.close();
  }
}

/**
 * Handle process termination
 */
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted by user');
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Process terminated');
  rl.close();
  process.exit(0);
});

/**
 * Run the CLI
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
