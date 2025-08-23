// Test Claude directly with the actual prompt we're sending
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testClaudeTiming() {
    console.log('Testing Claude with actual prompt...\n');
    
    try {
        // Load and generate the actual prompt
        const { generateBulletproofIntentSpecPrompt } = require('./dist/main/enhanced-prompt-generator.js');
        const recording = JSON.parse(fs.readFileSync('recording-1755945126115.json', 'utf8'));
        const prompt = generateBulletproofIntentSpecPrompt(recording);
        
        console.log('Prompt size:', (prompt.length / 1024).toFixed(2), 'KB');
        console.log('');
        
        // Import Claude SDK
        const claudeCode = await eval('import("@anthropic-ai/claude-code")');
        const { query } = claudeCode;
        
        console.log('Sending to Claude with maxTurns: 1...');
        const startTime = Date.now();
        
        let messageCount = 0;
        let result = '';
        let assistantReceived = false;
        
        for await (const msg of query({
            prompt: prompt,
            options: {
                maxTurns: 1
            }
        })) {
            messageCount++;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            
            console.log(`[${elapsed}s] Message #${messageCount}: type=${msg.type}, subtype=${msg.subtype || 'none'}`);
            
            if (msg.type === 'assistant') {
                assistantReceived = true;
                // Handle different response formats
                if (msg.content) {
                    result = msg.content;
                } else if (msg.message && msg.message.content) {
                    const content = msg.message.content;
                    if (Array.isArray(content)) {
                        result = content.map(c => c.text || '').join('');
                    } else {
                        result = content;
                    }
                } else if (msg.text) {
                    result = msg.text;
                }
                
                if (result) {
                    console.log(`  -> Got assistant response: ${result.length} chars`);
                }
            }
            
            if (msg.type === 'user') {
                console.log('  ⚠️ USER MESSAGE - Multi-turn detected!');
            }
            
            if (msg.type === 'result' && msg.subtype === 'success') {
                if (!result && msg.result) {
                    result = msg.result;
                }
                console.log('  -> Result message received, exiting');
                break;
            }
            
            // Safety limit
            if (messageCount > 10) {
                console.log('  -> Safety limit reached');
                break;
            }
        }
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\nCompleted in ${totalTime} seconds`);
        console.log(`Messages received: ${messageCount}`);
        console.log(`Result length: ${result.length} chars`);
        
        if (result) {
            // Try to parse as JSON
            try {
                const jsonMatch = result.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('\n✅ Valid Intent Spec JSON received');
                    console.log('Intent name:', parsed.name);
                    console.log('Params:', parsed.params);
                    console.log('Steps:', parsed.steps?.length || 0);
                }
            } catch (e) {
                console.log('\n❌ Could not parse JSON from result');
                console.log('First 500 chars:', result.substring(0, 500));
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testClaudeTiming().then(() => {
    console.log('\nTest complete');
    process.exit(0);
}).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});