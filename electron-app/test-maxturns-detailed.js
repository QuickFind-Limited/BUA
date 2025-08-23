// Detailed test to understand Claude Code SDK message flow
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testMaxTurnsDetailed() {
    console.log('=== Detailed maxTurns Testing ===\n');
    
    try {
        // Dynamic import of ES module
        console.log('Importing Claude Code SDK...');
        const claudeCode = await eval('import("@anthropic-ai/claude-code")');
        const { query } = claudeCode;
        console.log('SDK imported successfully\n');
        
        // Test with a prompt that requires more complex reasoning
        const complexPrompt = `Analyze this simple login flow and return ONLY a JSON object with name and params:
        1. User enters email
        2. User enters password
        3. User clicks login button
        
        Return format: {"name": "...", "params": [...]}`;
        
        console.log('Testing COMPLEX prompt with maxTurns: 1');
        console.log('Prompt:', complexPrompt.substring(0, 100) + '...\n');
        
        console.log('Messages received:');
        console.log('-'.repeat(60));
        
        let messageCount = 0;
        let result = '';
        let gotAssistantContent = false;
        
        for await (const msg of query({
            prompt: complexPrompt,
            options: {
                maxTurns: 1
            }
        })) {
            messageCount++;
            console.log(`\nMessage #${messageCount}:`);
            console.log(`  Type: ${msg.type}`);
            console.log(`  Subtype: ${msg.subtype || 'none'}`);
            
            // Log ALL properties of the message
            const keys = Object.keys(msg).filter(k => k !== 'type' && k !== 'subtype');
            if (keys.length > 0) {
                console.log('  Other properties:', keys.join(', '));
            }
            
            if (msg.type === 'assistant') {
                if (msg.content) {
                    gotAssistantContent = true;
                    result = msg.content;
                    console.log(`  Content length: ${msg.content.length} chars`);
                    console.log(`  Content preview: ${msg.content.substring(0, 200)}`);
                } else if (msg.text) {
                    gotAssistantContent = true;
                    result = msg.text;
                    console.log(`  Text length: ${msg.text.length} chars`);
                    console.log(`  Text preview: ${msg.text.substring(0, 200)}`);
                } else if (msg.message) {
                    gotAssistantContent = true;
                    result = typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message);
                    console.log(`  Message type: ${typeof msg.message}`);
                    console.log(`  Message preview: ${JSON.stringify(msg.message).substring(0, 200)}`);
                } else {
                    console.log('  [No content/text/message property found]');
                    console.log('  Full message:', JSON.stringify(msg, null, 2).substring(0, 500));
                }
            }
            
            if (msg.type === 'user') {
                console.log('  ⚠️ USER MESSAGE DETECTED - This indicates multi-turn!');
                if (msg.content || msg.text || msg.message) {
                    console.log('  User content:', (msg.content || msg.text || msg.message).substring(0, 100));
                }
            }
            
            if (msg.type === 'result') {
                if (msg.result) {
                    console.log('  Result property found:', msg.result.substring(0, 200));
                    if (!result) result = msg.result;
                }
                if (msg.subtype === 'success') {
                    console.log('  [SUCCESS - Breaking]');
                    break;
                }
            }
            
            // Safety limit
            if (messageCount > 20) {
                console.log('\n[Stopping after 20 messages for safety]');
                break;
            }
        }
        
        console.log('\n' + '-'.repeat(60));
        console.log('\nSummary:');
        console.log(`  Total messages: ${messageCount}`);
        console.log(`  Got assistant content: ${gotAssistantContent}`);
        console.log(`  Final result length: ${result.length} chars`);
        
        if (result) {
            console.log('\nFinal result:');
            console.log(result.substring(0, 500));
            
            // Try to parse as JSON if it looks like JSON
            if (result.includes('{') && result.includes('}')) {
                try {
                    const jsonMatch = result.match(/\{[^}]+\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        console.log('\nParsed JSON:', JSON.stringify(parsed, null, 2));
                    }
                } catch (e) {
                    console.log('\n(Could not parse JSON from result)');
                }
            }
        }
        
    } catch (error) {
        console.error('\nError:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testMaxTurnsDetailed().then(() => {
    console.log('\nTest complete.');
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});