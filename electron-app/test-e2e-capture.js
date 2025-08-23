const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting E2E test with output capture...\n');

// Start the Electron app with proper output capture
console.log('Starting Electron app in test mode...\n');

const child = spawn('npx', ['electron', '.'], {
  cwd: __dirname,
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    E2E_TEST: 'true',
    NODE_ENV: 'development'
  }
});

let testBannerSeen = false;
let analysisCalled = false;
let testCompleted = false;

// Capture stdout
child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  // Look for test indicators
  if (output.includes('E2E TEST MODE')) {
    testBannerSeen = true;
    console.log('\n✅ TEST MODE DETECTED!\n');
  }
  
  if (output.includes('[E2E] Calling analyzeLastRecording')) {
    analysisCalled = true;
    console.log('\n✅ ANALYSIS FUNCTION CALLED!\n');
  }
  
  if (output.includes('Intent spec generated successfully')) {
    testCompleted = true;
    console.log('\n✅ TEST COMPLETED SUCCESSFULLY!\n');
    setTimeout(() => {
      console.log('Terminating test...');
      child.kill();
      process.exit(0);
    }, 2000);
  }
});

// Capture stderr
child.stderr.on('data', (data) => {
  const output = data.toString();
  
  // Filter out DevTools messages
  if (!output.includes('DevTools listening')) {
    process.stderr.write(output);
  }
  
  // Look for test mode messages in console logs
  if (output.includes('[MAIN-WINDOW]')) {
    if (output.includes('E2E TEST MODE')) {
      testBannerSeen = true;
      console.log('\n✅ TEST BANNER SHOWN IN UI!\n');
    }
    if (output.includes('analyzeLastRecording')) {
      console.log('\n📊 Analysis function interaction detected\n');
    }
  }
});

// Handle child process exit
child.on('exit', (code) => {
  console.log('\n========================================');
  console.log('Test Results:');
  console.log(`- Test banner seen: ${testBannerSeen ? '✅' : '❌'}`);
  console.log(`- Analysis called: ${analysisCalled ? '✅' : '❌'}`);
  console.log(`- Test completed: ${testCompleted ? '✅' : '❌'}`);
  console.log('========================================\n');
  
  if (code !== 0 && code !== null) {
    console.log(`App exited with code ${code}`);
  }
  
  process.exit(testBannerSeen && analysisCalled ? 0 : 1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏱️ Test timeout after 30 seconds');
  console.log('Final status:');
  console.log(`- Test banner seen: ${testBannerSeen ? '✅' : '❌'}`);
  console.log(`- Analysis called: ${analysisCalled ? '✅' : '❌'}`);
  console.log(`- Test completed: ${testCompleted ? '✅' : '❌'}`);
  child.kill();
  process.exit(1);
}, 30000);

console.log('Waiting for app to start and show test mode...\n');