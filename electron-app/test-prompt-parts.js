#!/usr/bin/env node

/**
 * Test Claude with different parts of the recording to identify bottlenecks
 */

const fs = require('fs').promises;
const path = require('path');
const { generateBulletproofIntentSpecPrompt } = require('./dist/main/enhanced-prompt-generator');

async function testPromptPart(name, recording) {
    console.log(`\n📝 Testing: ${name}`);
    console.log(`Recording size: ${JSON.stringify(recording).length} bytes`);
    
    const prompt = generateBulletproofIntentSpecPrompt(recording);
    console.log(`Prompt size: ${prompt.length} bytes`);
    
    // Save prompt for inspection
    await fs.writeFile(`test-prompt-${name}.txt`, prompt);
    
    // Show key metrics
    const metrics = {
        actions: recording.actions?.length || 0,
        console: Object.values(recording.console || {}).flat().length,
        domSnapshots: recording.domSnapshots?.length || 0,
        network: Object.keys(recording.network || {}).length
    };
    console.log('Metrics:', metrics);
    
    return { name, promptSize: prompt.length, metrics };
}

async function runTests() {
    try {
        // Load the full recording
        const fullRecording = JSON.parse(await fs.readFile('./recording-1755890493421.json', 'utf8'));
        console.log('Full recording loaded:', JSON.stringify(fullRecording).length, 'bytes');
        
        const results = [];
        
        // Test 1: Just basic info
        const basic = {
            sessionId: fullRecording.sessionId,
            duration: fullRecording.duration,
            url: fullRecording.url,
            title: fullRecording.title,
            viewport: fullRecording.viewport
        };
        results.push(await testPromptPart('basic', basic));
        
        // Test 2: Basic + first 10 actions
        const withFewActions = {
            ...basic,
            actions: fullRecording.actions?.slice(0, 10) || []
        };
        results.push(await testPromptPart('few-actions', withFewActions));
        
        // Test 3: Basic + first 100 actions
        const withManyActions = {
            ...basic,
            actions: fullRecording.actions?.slice(0, 100) || []
        };
        results.push(await testPromptPart('many-actions', withManyActions));
        
        // Test 4: Basic + all actions (1209)
        const withAllActions = {
            ...basic,
            actions: fullRecording.actions || []
        };
        results.push(await testPromptPart('all-actions', withAllActions));
        
        // Test 5: Basic + DOM snapshots
        const withDOM = {
            ...basic,
            domSnapshots: fullRecording.domSnapshots || []
        };
        results.push(await testPromptPart('dom-snapshots', withDOM));
        
        // Test 6: Basic + console logs
        const withConsole = {
            ...basic,
            console: fullRecording.console || {}
        };
        results.push(await testPromptPart('console-logs', withConsole));
        
        // Test 7: Basic + network
        const withNetwork = {
            ...basic,
            network: fullRecording.network || {}
        };
        results.push(await testPromptPart('network', withNetwork));
        
        // Test 8: Everything together
        results.push(await testPromptPart('full-recording', fullRecording));
        
        // Display summary
        console.log('\n📊 SUMMARY:');
        console.log('═══════════════════════════════════════════');
        results.forEach(r => {
            console.log(`${r.name.padEnd(20)} | Prompt: ${String(r.promptSize).padStart(8)} bytes | Actions: ${String(r.metrics.actions).padStart(4)} | Console: ${String(r.metrics.console).padStart(4)} | DOM: ${String(r.metrics.domSnapshots).padStart(2)} | Network: ${String(r.metrics.network).padStart(3)}`);
        });
        
        // Check which prompt is largest
        const sorted = [...results].sort((a, b) => b.promptSize - a.promptSize);
        console.log('\n🔍 Largest prompts:');
        sorted.slice(0, 3).forEach(r => {
            console.log(`  ${r.name}: ${r.promptSize} bytes (${(r.promptSize/1024).toFixed(1)} KB)`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the tests
console.log('🧪 Testing Prompt Generation with Different Data Parts\n');
runTests().then(() => {
    console.log('\n✅ Test completed');
}).catch(err => {
    console.error('\n❌ Test error:', err);
});