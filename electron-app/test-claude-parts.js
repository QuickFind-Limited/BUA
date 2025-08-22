#!/usr/bin/env node

/**
 * Test Claude with different parts of the recording to find timeout cause
 */

const fs = require('fs').promises;
const { analyzeRecording } = require('./dist/main/llm.js');

async function testClaude(name, recording) {
    console.log(`\n🤖 Testing ${name}...`);
    console.log(`Data size: ${JSON.stringify(recording).length} bytes`);
    
    try {
        const startTime = Date.now();
        const intentSpec = await analyzeRecording(recording);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Success in ${(duration/1000).toFixed(1)}s`);
        
        if (intentSpec?.params) {
            console.log(`Variables found: ${intentSpec.params.join(', ') || 'none'}`);
        }
        
        return { name, success: true, duration, params: intentSpec?.params || [] };
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        return { name, success: false, error: error.message };
    }
}

async function runTests() {
    const fullRecording = JSON.parse(await fs.readFile('./recording-1755890493421.json', 'utf8'));
    
    const results = [];
    
    // Test 1: Minimal - should work
    console.log('\n═══ TEST 1: Minimal Recording ═══');
    const minimal = {
        sessionId: fullRecording.sessionId,
        duration: fullRecording.duration,
        url: fullRecording.url,
        actions: fullRecording.actions?.slice(0, 5) || []
    };
    results.push(await testClaude('minimal', minimal));
    
    // Test 2: With login actions only
    console.log('\n═══ TEST 2: Login Actions Only ═══');
    const loginActions = fullRecording.actions?.filter(a => 
        a.url?.includes('accounts.zoho.com') || 
        a.target?.id === 'LOGIN_ID' || 
        a.target?.id === 'PASSWORD'
    ).slice(0, 20) || [];
    
    const withLogin = {
        ...minimal,
        actions: loginActions,
        console: {
            "https://accounts.zoho.com": fullRecording.console?.["https://accounts.zoho.com"]?.slice(0, 10) || []
        }
    };
    results.push(await testClaude('login-only', withLogin));
    
    // Test 3: With DOM snapshots
    console.log('\n═══ TEST 3: With DOM Snapshots ═══');
    const withDOM = {
        ...minimal,
        domSnapshots: fullRecording.domSnapshots?.slice(0, 2) || []
    };
    results.push(await testClaude('with-dom', withDOM));
    
    // Test 4: Full recording (the one that times out)
    console.log('\n═══ TEST 4: Full Recording (may timeout) ═══');
    console.log('⏱️ This may take up to 2 minutes...');
    results.push(await testClaude('full', fullRecording));
    
    // Summary
    console.log('\n\n📊 RESULTS SUMMARY:');
    console.log('═══════════════════════════════════════════');
    results.forEach(r => {
        if (r.success) {
            console.log(`✅ ${r.name.padEnd(15)} | ${(r.duration/1000).toFixed(1)}s | Params: ${r.params.join(', ') || 'none'}`);
        } else {
            console.log(`❌ ${r.name.padEnd(15)} | Failed: ${r.error}`);
        }
    });
}

console.log('🧪 Testing Claude with Different Recording Parts');
console.log('This will identify which data causes timeouts\n');

// Set a global timeout
const timeout = setTimeout(() => {
    console.log('\n⏰ Global timeout reached (3 minutes). Exiting...');
    process.exit(1);
}, 180000);

runTests().then(() => {
    clearTimeout(timeout);
    console.log('\n✅ All tests completed');
    process.exit(0);
}).catch(err => {
    clearTimeout(timeout);
    console.error('\n❌ Test error:', err);
    process.exit(1);
});