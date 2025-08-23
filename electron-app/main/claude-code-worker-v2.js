// Worker process for Claude Code SDK (ES module)
// Version 2: Handles large prompts via file to avoid Windows CLI limits
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

// Import Claude Code SDK once at startup
let claudeCode = null;
let query = null;

async function initializeSDK() {
    if (!claudeCode) {
        console.log('[Worker] Initializing Claude Code SDK...');
        claudeCode = await eval('import("@anthropic-ai/claude-code")');
        query = claudeCode.query;
        console.log('[Worker] Claude Code SDK initialized');
    }
    return query;
}

// Handle messages from parent process
process.on('message', async (message) => {
    console.log('[Worker] Received message:', message.type);
    
    if (message.type === 'analyze') {
        try {
            // Get or initialize the query function
            const query = await initializeSDK();
            
            let prompt = message.prompt;
            
            // If prompt is a file path (for large prompts), read it
            if (message.promptFile) {
                console.log('[Worker] Reading prompt from file:', message.promptFile);
                prompt = fs.readFileSync(message.promptFile, 'utf8');
                // Clean up the temp file
                try {
                    fs.unlinkSync(message.promptFile);
                } catch (e) {
                    console.log('[Worker] Could not delete temp file:', e.message);
                }
            }
            
            console.log('[Worker] Prompt size:', prompt.length, 'bytes');
            
            let result = '';
            console.log('[Worker] Starting query...');
            
            // Set up a timeout (90 seconds)
            const timeout = setTimeout(() => {
                console.error('[Worker] Query timeout after 90 seconds');
                process.send({
                    type: 'result',
                    success: false,
                    error: 'Claude query timeout after 90 seconds'
                });
                process.exit(1);
            }, 90000);
            
            const queryOptions = {
                prompt: prompt,
                options: {
                    maxTurns: 1,
                    model: message.model || 'claude-sonnet-4-20250514',
                    ...(message.options || {})
                }
            };
            
            console.log('[Worker] Query options:', { 
                maxTurns: queryOptions.options?.maxTurns, 
                model: queryOptions.options?.model,
                promptLength: prompt.length 
            });
            
            for await (const msg of query(queryOptions)) {
                console.log('[Worker] Received message type:', msg.type, 'subtype:', msg.subtype);
                
                // The result message contains the complete response
                if (msg.type === 'result' && msg.subtype === 'success') {
                    result = msg.result || '';
                    console.log('[Worker] Got result message with length:', result.length);
                    if (result.length < 500) {
                        console.log('[Worker] Result preview:', result.substring(0, 200));
                    }
                    break;
                }
                
                // Log other message types for debugging
                if (msg.type === 'assistant') {
                    console.log('[Worker] Assistant message received');
                }
                if (msg.type === 'user') {
                    console.log('[Worker] WARNING: User message detected - this should not happen with maxTurns: 1');
                }
            }
            
            // Clear timeout if successful
            clearTimeout(timeout);
            
            console.log('[Worker] Sending result back to parent');
            // Send result back to parent
            process.send({
                type: 'result',
                success: true,
                data: result
            });
            
            console.log('[Worker] Result sent, waiting for next request...');
            // Worker stays alive for next request
            
        } catch (error) {
            console.error('[Worker] Error:', error);
            process.send({
                type: 'result',
                success: false,
                error: error.message
            });
            // Worker stays alive even after error
        }
    }
});

// Initialize SDK on startup
initializeSDK().then(() => {
    // Send ready signal after SDK is initialized
    process.send({ type: 'ready' });
    console.log('[Worker] Ready to process requests');
}).catch((err) => {
    console.error('[Worker] Failed to initialize:', err);
    // Send ready anyway to not block parent
    process.send({ type: 'ready' });
});