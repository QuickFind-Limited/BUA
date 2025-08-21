#!/usr/bin/env node

/**
 * Simple test launcher for the enhanced recording system
 * This bypasses TypeScript compilation issues for testing
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 CUA Enhanced Recording Test Launcher');
console.log('=========================================\n');

// Check if node_modules exists
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.error('❌ Error: node_modules not found. Please run: npm install');
  process.exit(1);
}

// Check for .env file
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.warn('⚠️  Warning: .env file not found');
  console.log('Creating .env file. Please add your ANTHROPIC_API_KEY\n');
  fs.writeFileSync(envPath, 'ANTHROPIC_API_KEY=your-api-key-here\n');
}

// Set environment variables
process.env.NODE_ENV = 'development';
process.env.CDP_PORT = '9335';

console.log('📋 Configuration:');
console.log(`  - Working Directory: ${__dirname}`);
console.log(`  - CDP Port: ${process.env.CDP_PORT}`);
console.log(`  - Node Environment: ${process.env.NODE_ENV}`);
console.log('');

console.log('🔧 Starting Electron app with enhanced recording...\n');

// Launch Electron directly without TypeScript compilation
const electron = spawn('npx', ['electron', '.'], {
  cwd: __dirname,
  env: process.env,
  shell: true,
  stdio: 'inherit'
});

electron.on('error', (err) => {
  console.error('❌ Failed to start Electron:', err);
});

electron.on('close', (code) => {
  if (code !== 0) {
    console.log(`\n⚠️  Electron exited with code ${code}`);
  } else {
    console.log('\n✅ Electron closed successfully');
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Electron...');
  electron.kill('SIGTERM');
  process.exit(0);
});

console.log('💡 Tips:');
console.log('  - Click "Record" button in the navigation bar to start recording');
console.log('  - The floating toolbar will appear with Start/Stop/Pause controls');
console.log('  - Recording uses CDP to connect to the existing browser tab');
console.log('  - No separate browser window will open (unlike codegen)');
console.log('  - Press Ctrl+C to stop the application\n');