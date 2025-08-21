// Main entry point for Electron app
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
// Use multiple potential paths to ensure .env is found
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import './main';

// Export Magnitude execution system
export { MagnitudeExecutor } from './magnitude-executor';
export { PlaywrightExecutor } from './playwright-executor';
export { FlowStorage } from './flow-storage';
export * from './llm';

// SDK Decider system removed - using ExecutionOrchestrator instead

// Export Screenshot Comparison system
export { ScreenshotComparator } from './screenshot-comparator';

// Export IPC handlers with enhanced functionality
export { registerIpcHandlers, removeIpcHandlers } from './ipc';

// Check if API key is set
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY not set. Please add it to the .env file or set as environment variable.');
  console.warn('Edit the .env file and replace "your-actual-api-key-here" with your real API key.');
}

// Log startup
console.log('Electron WebView2 Browser starting...');
console.log('Platform:', process.platform);
console.log('Node version:', process.version);
console.log('Electron version:', process.versions.electron);