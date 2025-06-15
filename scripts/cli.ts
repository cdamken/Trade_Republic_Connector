/**
 * Trade Republic CLI Tool
 * 
 * Simple command-line interface for testing Trade Republic API functionality
 * 
 * Usage:
 *   npm run cli:login    - Test login flow
 *   npm run cli:demo     - Run full demo
 * 
 * Author: Carlos Damken (carlos@damken.com)
 */

import { TradeRepublicClient, getCredentialsFromEnv } from '../src/index';
import { AuthenticationError } from '../src/auth/manager';

const command = process.argv[2];

async function testLogin() {
  console.log('🔑 Testing Trade Republic Login Flow');
  console.log('=====================================');

  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    console.error('❌ No credentials found. Set TR_USERNAME and TR_PASSWORD in .env file');
    process.exit(1);
  }

  const client = new TradeRepublicClient({
    logLevel: 'debug',
  });

  await client.initialize();

  console.log('📱 Phone:', credentials.username.replace(/(\d{4})$/, '****'));
  console.log('🔐 PIN: ****');

  try {
    console.log('\n⏳ Attempting login...');
    const session = await client.login(credentials);
    
    console.log('✅ Login successful!');
    console.log('👤 User ID:', session.userId);
    console.log('🎫 Session ID:', session.sessionId);
    
  } catch (error) {
    if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
      console.log('📲 MFA Required - This is expected!');
      console.log('🔑 Challenge:', (error as any).challenge);
      console.log('\n💡 To complete authentication, use the interactive demo:');
      console.log('   npm run demo:auth');
    } else {
      console.error('❌ Login failed:', (error as Error).message);
    }
  }
}

async function runDemo() {
  const { demonstrateAuthFlow } = await import('../examples/auth-flow-demo');
  await demonstrateAuthFlow();
}

async function main() {
  switch (command) {
    case 'login':
      await testLogin();
      break;
    case 'demo':
      await runDemo();
      break;
    default:
      console.log('Trade Republic CLI Tool');
      console.log('');
      console.log('Commands:');
      console.log('  login  - Test login flow');
      console.log('  demo   - Run interactive demo');
      console.log('');
      console.log('Examples:');
      console.log('  npm run cli:login');
      console.log('  npm run cli:demo');
  }
}

main().catch(console.error);
