#!/usr/bin/env node

/**
 * Exhaustive test to identify Claude timeout cause
 */

const fs = require('fs').promises;
const { analyzeRecording } = require('./dist/main/llm.js');

// Test with timeout wrapper
async function testWithTimeout(name, recording, timeoutMs = 60000) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`Data size: ${JSON.stringify(recording).length} bytes`);
    
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log(`⏰ Timeout after ${timeoutMs/1000}s`);
            resolve({ name, success: false, reason: 'timeout' });
        }, timeoutMs);
        
        const startTime = Date.now();
        analyzeRecording(recording)
            .then(result => {
                clearTimeout(timeout);
                const duration = Date.now() - startTime;
                console.log(`✅ Success in ${(duration/1000).toFixed(1)}s`);
                const hasLogin = result?.params?.includes('PASSWORD') || result?.params?.includes('EMAIL_ADDRESS');
                console.log(`Login vars: ${hasLogin ? 'YES' : 'NO'}`);
                resolve({ name, success: true, duration, hasLogin });
            })
            .catch(error => {
                clearTimeout(timeout);
                const duration = Date.now() - startTime;
                console.log(`❌ Error after ${(duration/1000).toFixed(1)}s: ${error.message}`);
                resolve({ name, success: false, reason: error.message, duration });
            });
    });
}

async function runTests() {
    const fullRecording = JSON.parse(await fs.readFile('./recording-1755890493421.json', 'utf8'));
    console.log(`📁 Full recording: ${JSON.stringify(fullRecording).length} bytes`);
    
    const results = [];
    
    // Test 1: Absolutely minimal
    results.push(await testWithTimeout('minimal', {
        sessionId: "test",
        duration: 1000,
        url: "https://test.com",
        actions: [{ type: "click" }]
    }));
    
    // Test 2: With login fields from console
    const loginConsole = {};
    if (fullRecording.console) {
        // Find entries with LOGIN_ID or PASSWORD
        for (const [url, logs] of Object.entries(fullRecording.console)) {
            const loginLogs = logs.filter(log => {
                const text = JSON.stringify(log);
                return text.includes('LOGIN_ID') || text.includes('PASSWORD');
            }).slice(0, 5); // Just first 5
            
            if (loginLogs.length > 0) {
                loginConsole[url] = loginLogs;
                break; // Just one URL
            }
        }
    }
    
    results.push(await testWithTimeout('with-login-console', {
        sessionId: fullRecording.sessionId,
        duration: fullRecording.duration,
        url: fullRecording.url,
        actions: fullRecording.actions?.slice(0, 10) || [],
        console: loginConsole
    }));
    
    // Test 3: With many actions but no console
    results.push(await testWithTimeout('many-actions-no-console', {
        sessionId: fullRecording.sessionId,
        duration: fullRecording.duration,
        url: fullRecording.url,
        actions: fullRecording.actions?.slice(0, 500) || []
    }));
    
    // Test 4: With DOM snapshots only
    results.push(await testWithTimeout('dom-only', {
        sessionId: fullRecording.sessionId,
        duration: fullRecording.duration,
        url: fullRecording.url,
        domSnapshots: fullRecording.domSnapshots?.slice(0, 5) || []
    }));
    
    // Test 5: With network only
    const limitedNetwork = {};
    if (fullRecording.network) {
        const keys = Object.keys(fullRecording.network).slice(0, 2);
        keys.forEach(k => {
            limitedNetwork[k] = fullRecording.network[k].slice(0, 5);
        });
    }
    
    results.push(await testWithTimeout('network-only', {
        sessionId: fullRecording.sessionId,
        duration: fullRecording.duration,
        url: fullRecording.url,
        network: limitedNetwork
    }));
    
    // Test 6: Everything but limited
    results.push(await testWithTimeout('all-limited', {
        sessionId: fullRecording.sessionId,
        duration: fullRecording.duration,
        url: fullRecording.url,
        actions: fullRecording.actions?.slice(0, 50) || [],
        console: loginConsole,
        domSnapshots: fullRecording.domSnapshots?.slice(0, 2) || [],
        network: limitedNetwork
    }));
    
    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RESULTS SUMMARY:');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n✅ Successful (${successful.length}):`);
    successful.forEach(r => {
        console.log(`  ${r.name}: ${(r.duration/1000).toFixed(1)}s ${r.hasLogin ? '(with login vars)' : ''}`);
    });
    
    console.log(`\n❌ Failed (${failed.length}):`);
    failed.forEach(r => {
        console.log(`  ${r.name}: ${r.reason}`);
    });
    
    // Find pattern
    console.log('\n🔍 Analysis:');
    if (failed.length === 0) {
        console.log('All tests passed! The issue might be with the full recording size.');
    } else {
        const timeouts = failed.filter(r => r.reason === 'timeout');
        if (timeouts.length > 0) {
            console.log(`${timeouts.length} tests timed out. Common factors:`);
            console.log('- Check if these have large console logs or DOM snapshots');
        }
    }
    
    // Average response time
    if (successful.length > 0) {
        const avgTime = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
        console.log(`\nAverage successful response time: ${(avgTime/1000).toFixed(1)}s`);
    }
}

console.log('🚀 Running Exhaustive Claude Tests');
console.log('Each test has a 60-second timeout');
console.log('=' + '='.repeat(59));

runTests().then(() => {
    console.log('\n✅ Testing complete');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Test error:', err);
    process.exit(1);
});