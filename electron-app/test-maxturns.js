// Simple test to verify maxTurns setting is honored by Claude Code SDK
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testMaxTurns() {
    console.log('=== Testing maxTurns Setting ===\n');
    
    try {
        // Dynamic import of ES module
        console.log('1. Importing Claude Code SDK...');
        const claudeCode = await eval('import("@anthropic-ai/claude-code")');
        const { query } = claudeCode;
        console.log('   ✓ SDK imported successfully\n');
        
        // Simple prompt that might trigger reasoning
        const testPrompt = "What is 2 + 2? Just give me the number, nothing else.";
        
        console.log('2. Sending query with maxTurns: 1');
        console.log('   Prompt:', testPrompt);
        console.log('   Config: { options: { maxTurns: 1 } }\n');
        
        console.log('3. Messages received from Claude:');
        console.log('   ' + '-'.repeat(40));
        
        let messageCount = 0;
        let assistantMessages = 0;
        let userMessages = 0;
        let result = '';
        
        // Test with maxTurns in options object (as per SDK docs)
        for await (const msg of query({
            prompt: testPrompt,
            options: {
                maxTurns: 1  // Should limit to single turn
            }
        })) {
            messageCount++;
            console.log(`   Message #${messageCount}:`);
            console.log(`     - Type: ${msg.type}`);
            console.log(`     - Subtype: ${msg.subtype || 'none'}`);
            
            if (msg.type === 'assistant') {
                assistantMessages++;
                if (msg.content) {
                    result = msg.content;
                    console.log(`     - Content: ${msg.content.substring(0, 50)}...`);
                }
            }
            
            if (msg.type === 'user') {
                userMessages++;
                console.log('     - [USER MESSAGE DETECTED - MULTI-TURN!]');
            }
            
            if (msg.type === 'result' && msg.subtype === 'success') {
                console.log('     - [RESULT MESSAGE - Breaking]');
                break;
            }
        }
        
        console.log('   ' + '-'.repeat(40));
        console.log('\n4. Summary:');
        console.log(`   - Total messages: ${messageCount}`);
        console.log(`   - Assistant messages: ${assistantMessages}`);
        console.log(`   - User messages: ${userMessages}`);
        console.log(`   - Result: ${result}\n`);
        
        if (userMessages > 0) {
            console.log('❌ FAILED: Multi-turn detected! User messages found after assistant response.');
            console.log('   This means maxTurns: 1 is NOT being honored.\n');
        } else {
            console.log('✅ SUCCESS: Single turn only. No user messages after assistant response.');
            console.log('   maxTurns: 1 is working correctly.\n');
        }
        
        // Now test without maxTurns to see difference
        console.log('5. Testing WITHOUT maxTurns for comparison:');
        console.log('   ' + '-'.repeat(40));
        
        messageCount = 0;
        assistantMessages = 0;
        userMessages = 0;
        
        for await (const msg of query({
            prompt: testPrompt
            // No options, no maxTurns
        })) {
            messageCount++;
            
            if (msg.type === 'assistant') assistantMessages++;
            if (msg.type === 'user') userMessages++;
            
            // Just count, don't log all details
            if (messageCount > 10) {
                console.log('   [Stopping after 10 messages...]');
                break;
            }
            
            if (msg.type === 'result' && msg.subtype === 'success') {
                break;
            }
        }
        
        console.log(`   - Messages without maxTurns: ${messageCount}`);
        console.log(`   - User messages: ${userMessages}`);
        console.log('   ' + '-'.repeat(40));
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

// Run the test
console.log('Starting maxTurns test...\n');
testMaxTurns().then(() => {
    console.log('Test complete.');
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});