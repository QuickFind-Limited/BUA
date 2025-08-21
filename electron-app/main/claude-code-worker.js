// Worker process for Claude Code SDK (ES module)
// This runs in a separate Node.js process to handle ES module imports

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

// Handle messages from parent process
process.on('message', async (message) => {
  console.log('[Worker] Received message:', message.type);
  if (message.type === 'analyze') {
    try {
      console.log('[Worker] Starting Claude Code SDK import...');
      // Dynamic import of ES module using eval to prevent TypeScript compilation issues
      const claudeCode = await eval('import("@anthropic-ai/claude-code")');
      const { query } = claudeCode;
      console.log('[Worker] Claude Code SDK imported successfully');
      
      let result = '';
      console.log('[Worker] Starting query...');
      // Use Claude Code SDK with Opus 4.1 (default)
      // Note: maxTurns of 2 allows for system message + assistant response
      for await (const msg of query({
        prompt: message.prompt,
        options: {
          maxTurns: 2
        }
      })) {
        console.log('[Worker] Received message type:', msg.type, 'subtype:', msg.subtype);
        if (msg.type === 'result' && msg.subtype === 'success') {
          result = msg.result;
          console.log('[Worker] Got result, length:', result.length);
        }
      }
      
      console.log('[Worker] Sending result back to parent');
      // Send result back to parent
      process.send({
        type: 'result',
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[Worker] Error:', error);
      process.send({
        type: 'result',
        success: false,
        error: error.message
      });
    }
  }
});

// Send ready signal
process.send({ type: 'ready' });