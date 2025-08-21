#!/usr/bin/env node

/**
 * Performance Test Runner Script
 * 
 * This script ensures the Electron app is built before running performance tests
 * and provides additional test orchestration capabilities.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`${colors.bold}[${step}]${colors.reset} ${message}`);
}

async function execPromise(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function checkBuild() {
  logStep('BUILD CHECK', 'Checking if Electron app is built...');
  
  const distPath = path.join(__dirname, '..', 'dist', 'main', 'index.js');
  
  if (!fs.existsSync(distPath)) {
    log(`❌ Build not found at: ${distPath}`, colors.red);
    return false;
  }
  
  // Check if build is recent (last 24 hours) or if source files are newer
  const distStats = fs.statSync(distPath);
  const buildAge = Date.now() - distStats.mtime.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  if (buildAge > oneDayMs) {
    log(`⚠️  Build is older than 24 hours (${Math.round(buildAge / (1000 * 60 * 60))} hours)`, colors.yellow);
    return false;
  }
  
  log(`✅ Build found and is recent (${Math.round(buildAge / (1000 * 60))} minutes old)`, colors.green);
  return true;
}

async function buildApp() {
  logStep('BUILD', 'Building Electron app...');
  
  try {
    const { stdout, stderr } = await execPromise('npm run build');
    log('✅ Build completed successfully', colors.green);
    if (stdout) log(`Build output:\n${stdout}`, colors.cyan);
    return true;
  } catch ({ error, stdout, stderr }) {
    log('❌ Build failed', colors.red);
    if (stdout) log(`Build stdout:\n${stdout}`, colors.yellow);
    if (stderr) log(`Build stderr:\n${stderr}`, colors.red);
    return false;
  }
}

async function runPerformanceTest() {
  logStep('PERF TEST', 'Running performance test...');
  
  return new Promise((resolve) => {
    const testProcess = spawn('npx', ['playwright', 'test', 'tests/recording-performance.spec.ts', '--reporter=list'], {
      stdio: 'inherit',
      shell: true
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ Performance test completed successfully', colors.green);
        resolve(true);
      } else {
        log(`❌ Performance test failed with exit code ${code}`, colors.red);
        resolve(false);
      }
    });
    
    testProcess.on('error', (error) => {
      log(`❌ Failed to run performance test: ${error.message}`, colors.red);
      resolve(false);
    });
  });
}

async function generateReport() {
  logStep('REPORT', 'Generating HTML test report...');
  
  try {
    await execPromise('npx playwright show-report --host=127.0.0.1 --port=9323');
    log('📊 Test report available at: http://127.0.0.1:9323', colors.cyan);
  } catch (error) {
    log('⚠️  Could not start report server (report files may still be available)', colors.yellow);
  }
}

async function checkEnvironment() {
  logStep('ENV CHECK', 'Checking test environment...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  log(`Node.js version: ${nodeVersion}`, colors.cyan);
  
  // Check if Playwright is installed
  try {
    await execPromise('npx playwright --version');
    log('✅ Playwright is available', colors.green);
  } catch (error) {
    log('❌ Playwright not available', colors.red);
    return false;
  }
  
  // Check available memory
  const totalMem = Math.round(require('os').totalmem() / 1024 / 1024 / 1024);
  const freeMem = Math.round(require('os').freemem() / 1024 / 1024 / 1024);
  log(`System memory: ${freeMem}GB free / ${totalMem}GB total`, colors.cyan);
  
  if (freeMem < 2) {
    log('⚠️  Low available memory may affect test accuracy', colors.yellow);
  }
  
  return true;
}

async function main() {
  log(`${colors.bold}${colors.blue}🧪 Recording Performance Test Runner${colors.reset}\n`);
  
  try {
    // Check environment
    const envOk = await checkEnvironment();
    if (!envOk) {
      process.exit(1);
    }
    
    // Check if build is needed
    const buildExists = await checkBuild();
    if (!buildExists) {
      const buildSuccess = await buildApp();
      if (!buildSuccess) {
        log('\n❌ Cannot run performance test without successful build', colors.red);
        process.exit(1);
      }
    }
    
    // Run the performance test
    log(''); // Empty line for clarity
    logStep('TEST START', 'Starting performance test suite...');
    const testSuccess = await runPerformanceTest();
    
    if (testSuccess) {
      log(`\n${colors.bold}${colors.green}🎉 Performance test completed successfully!${colors.reset}`);
      log(`Check the test-results/ directory for detailed performance reports.`, colors.cyan);
      
      // Optionally generate interactive report
      if (process.argv.includes('--report') || process.argv.includes('-r')) {
        await generateReport();
      } else {
        log(`\nTip: Use --report flag to view interactive HTML report`, colors.yellow);
      }
    } else {
      log(`\n${colors.bold}${colors.red}❌ Performance test failed!${colors.reset}`);
      log(`Review the test output above for details about performance issues.`, colors.yellow);
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n${colors.red}💥 Unexpected error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  log(`${colors.bold}Recording Performance Test Runner${colors.reset}`);
  log('');
  log('Usage: node scripts/run-performance-test.js [options]');
  log('');
  log('Options:');
  log('  --help, -h     Show this help message');
  log('  --report, -r   Generate and serve interactive HTML report');
  log('');
  log('Environment Variables:');
  log('  CI=true        Run in CI mode (affects test behavior)');
  log('');
  log('Examples:');
  log('  node scripts/run-performance-test.js');
  log('  node scripts/run-performance-test.js --report');
  log('  npm run test:performance');
  process.exit(0);
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, checkBuild, buildApp, runPerformanceTest };