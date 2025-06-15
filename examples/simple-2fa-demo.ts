#!/usr/bin/env npx tsx

/**
 * Simple 2FA Method Selection Demo
 * 
 * Demonstrates the enhanced 2FA options (SMS vs APP) without complex authentication.
 * This is a demonstration of the user interface and method selection.
 * 
 * Usage:
 *   tsx examples/simple-2fa-demo.ts [--method app|sms]
 */

import { createInterface } from 'readline';

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

async function demonstrate2FAMethodSelection() {
  console.log('\n🔐 ENHANCED 2FA METHOD SELECTION DEMO');
  console.log('=====================================');
  
  // Check command line arguments for 2FA method preference
  const args = process.argv.slice(2);
  const methodArg = args.find(arg => arg.startsWith('--method='))?.split('=')[1] ||
                   (args.includes('--method') ? args[args.indexOf('--method') + 1] : null);
  
  let mfaMethod: 'APP' | 'SMS';
  
  if (methodArg && ['app', 'sms'].includes(methodArg.toLowerCase())) {
    mfaMethod = methodArg.toUpperCase() as 'APP' | 'SMS';
    console.log(`🎯 Using specified 2FA method: ${mfaMethod}`);
  } else {
    console.log('\n📱 Select your preferred 2FA method:');
    console.log('1. APP (recommended) - 4-digit code from Trade Republic app');
    console.log('2. SMS - 6-digit code sent to your phone');
    
    const choice = await askQuestion('\nEnter your choice (1 or 2): ');
    mfaMethod = choice.trim() === '2' ? 'SMS' : 'APP';
  }
  
  console.log(`\n✅ Selected 2FA method: ${mfaMethod}`);
  console.log(`${mfaMethod === 'APP' ? '📱' : '💬'} You will receive a ${mfaMethod === 'APP' ? '4' : '6'}-digit code ${mfaMethod === 'APP' ? 'in your app' : 'via SMS'}`);

  // Simulate the 2FA challenge
  const challenge = {
    challengeId: 'demo_' + Date.now(),
    type: mfaMethod,
    message: mfaMethod === 'APP' 
      ? 'Enter the 4-digit code from your Trade Republic app'
      : 'Enter the 6-digit code sent to your phone via SMS',
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    length: mfaMethod === 'APP' ? 4 : 6
  };
  
  console.log(`\n📋 Challenge Details:`);
  console.log(`   Type: ${challenge.type}`);
  console.log(`   Message: ${challenge.message}`);
  console.log(`   Expected Length: ${challenge.length} digits`);
  console.log(`   Expires: ${new Date(challenge.expiresAt).toLocaleString()}`);

  // Provide specific instructions based on method
  if (mfaMethod === 'APP') {
    console.log('\n📱 APP-based 2FA Instructions:');
    console.log('   ✅ More secure (not transmitted over SMS network)');
    console.log('   ✅ Works offline once app is loaded');
    console.log('   ✅ Faster response time');
    console.log('   ✅ 4-digit code is easier to type');
    console.log('\n   Steps:');
    console.log('   1. Open your Trade Republic app');
    console.log('   2. Look for the 4-digit authentication code');
    console.log('   3. Enter the code when prompted');
  } else {
    console.log('\n💬 SMS-based 2FA Instructions:');
    console.log('   ✅ Works without app access');
    console.log('   ✅ Universal compatibility');
    console.log('   ✅ Good backup method');
    console.log('   ⚠️  Requires cellular network');
    console.log('\n   Steps:');
    console.log('   1. Check your phone for an SMS message');
    console.log('   2. Look for the 6-digit verification code');
    console.log('   3. Enter the code when prompted');
  }

  // Simulate code input
  const code = await askQuestion(`\n🔢 Enter your ${challenge.length}-digit code (demo - any ${challenge.length} digits): `);

  if (!code || code.length !== challenge.length) {
    console.log(`❌ Invalid code length. Expected ${challenge.length} digits.`);
    rl.close();
    return;
  }

  if (!/^\d+$/.test(code)) {
    console.log(`❌ Invalid code format. Expected only digits.`);
    rl.close();
    return;
  }

  console.log('\n🎉 DEMO AUTHENTICATION SUCCESSFUL!');
  console.log('==================================');
  console.log(`👤 Demo User: demo-user`);
  console.log(`🔑 Method Used: ${mfaMethod}`);
  console.log(`⚡ Code Length: ${code.length} digits`);
  console.log(`🎯 Authentication: Successful`);
  
  console.log('\n📊 Method Comparison:');
  if (mfaMethod === 'APP') {
    console.log('💡 APP method benefits:');
    console.log('   • More secure (no SMS interception risk)');
    console.log('   • Faster (no network delay)');
    console.log('   • Works offline');
    console.log('   • Shorter code (4 vs 6 digits)');
  } else {
    console.log('💡 SMS method benefits:');
    console.log('   • Works without app');
    console.log('   • Universal phone compatibility');
    console.log('   • Good as backup method');
    console.log('   • Familiar to most users');
  }

  console.log('\n🔧 Implementation Features:');
  console.log('✅ Command line method selection (--method app|sms)');
  console.log('✅ Interactive method selection');
  console.log('✅ Method-specific instructions');
  console.log('✅ Proper code length validation');
  console.log('✅ User-friendly error messages');
  console.log('✅ Security best practices');

  console.log('\n📚 Learn More:');
  console.log('• Full implementation: examples/enhanced-auth.ts');
  console.log('• Documentation: docs/API_REFERENCE.md');
  console.log('• Project structure: docs/PROJECT_ORGANIZATION_COMPLETE.md');
}

// Command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n🔐 Simple 2FA Method Selection Demo');
  console.log('===================================');
  console.log('\nThis demo showcases the enhanced 2FA method selection feature.');
  console.log('Users can choose between APP-based (4-digit) or SMS-based (6-digit) 2FA.');
  console.log('\nUsage:');
  console.log('  tsx examples/simple-2fa-demo.ts [options]');
  console.log('\nOptions:');
  console.log('  --method app     Demo APP-based 2FA (4-digit code)');
  console.log('  --method sms     Demo SMS-based 2FA (6-digit code)');
  console.log('  --help, -h       Show this help message');
  console.log('\nExamples:');
  console.log('  tsx examples/simple-2fa-demo.ts --method app');
  console.log('  tsx examples/simple-2fa-demo.ts --method sms');
  console.log('  tsx examples/simple-2fa-demo.ts  # Interactive selection');
  console.log('\n📝 Note: This is a demo. For real authentication, use enhanced-auth.ts');
  process.exit(0);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrate2FAMethodSelection()
    .catch(console.error)
    .finally(() => rl.close());
}
