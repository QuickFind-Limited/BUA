// Test if we can use Sonnet model with Claude Code SDK
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testSonnetModel() {
    console.log('Testing Claude Code SDK with Sonnet model...\n');
    
    try {
        // Import Claude Code SDK
        const claudeCode = await eval('import("@anthropic-ai/claude-code")');
        const { query } = claudeCode;
        
        // Simple test prompt
        const testPrompt = 'Return this exact JSON: {"name": "test", "params": ["EMAIL", "PASSWORD"], "steps": []}';
        
        // Try different ways to specify the model
        const configs = [
            {
                name: 'With model in options',
                options: { 
                    prompt: testPrompt,
                    options: { 
                        maxTurns: 1,
                        model: 'claude-sonnet-4-20250514'
                    }
                }
            },
            {
                name: 'With model at top level',
                options: {
                    prompt: testPrompt,
                    model: 'claude-sonnet-4-20250514',
                    options: { maxTurns: 1 }
                }
            },
            {
                name: 'Default (Opus)',
                options: {
                    prompt: testPrompt,
                    options: { maxTurns: 1 }
                }
            }
        ];
        
        for (const config of configs) {
            console.log(`Testing: ${config.name}`);
            console.log('Config:', JSON.stringify(config.options, null, 2));
            
            const startTime = Date.now();
            let result = '';
            let messageCount = 0;
            
            try {
                for await (const msg of query(config.options)) {
                    messageCount++;
                    
                    if (msg.type === 'system' && msg.model) {
                        console.log('  Model detected:', msg.model);
                    }
                    
                    if (msg.type === 'result' && msg.subtype === 'success') {
                        result = msg.result || '';
                        break;
                    }
                    
                    // Safety limit
                    if (messageCount > 10) break;
                }
                
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`  Result in ${duration}s: ${result ? result.substring(0, 100) : 'No result'}`);
                
            } catch (err) {
                console.log('  Error:', err.message);
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error('Failed:', error.message);
    }
}

testSonnetModel().then(() => {
    console.log('Test complete');
    process.exit(0);
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});