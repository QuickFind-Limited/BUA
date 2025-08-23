const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config();

async function testHandler() {
    console.log('=== Testing Handler Directly with Existing Recording ===\n');
    
    // Load the analyzeRecording function
    const { analyzeRecording } = require('./dist/main/llm');
    
    // Load the existing recording
    const recordingPath = path.join(__dirname, 'recording-1755973886399.json');
    const recordingData = fs.readFileSync(recordingPath, 'utf8');
    const recording = JSON.parse(recordingData);
    
    console.log('📄 Recording loaded:');
    console.log('  - Session ID:', recording.sessionId);
    console.log('  - Duration:', recording.duration, 'ms');
    console.log('  - ExtractedInputs:', recording.extractedInputs?.length || 0);
    
    // Show login fields
    console.log('\n🔐 Login fields in recording:');
    recording.extractedInputs?.forEach(input => {
        if (input.field === 'LOGIN_ID' || input.field === 'PASSWORD') {
            console.log(`  - ${input.field}: ${input.value}`);
        }
    });
    
    console.log('\n🤖 Calling analyzeRecording directly...\n');
    
    try {
        const startTime = Date.now();
        const intentSpec = await analyzeRecording(recordingData);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ Analysis completed in ${(duration / 1000).toFixed(2)} seconds`);
        
        // Save the result
        const outputPath = path.join(__dirname, `test-direct-intent-spec-${Date.now()}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(intentSpec, null, 2));
        console.log(`💾 Saved to: ${outputPath}`);
        
        // Check the results
        console.log('\n=== Generated Intent Spec ===');
        console.log('Name:', intentSpec.name);
        console.log('Params:', JSON.stringify(intentSpec.params || []));
        
        const hasLoginId = intentSpec.params?.includes('LOGIN_ID');
        const hasPassword = intentSpec.params?.includes('PASSWORD');
        
        console.log('\n🔑 Login variables:');
        console.log(`  LOGIN_ID: ${hasLoginId ? '✅ Present' : '❌ Missing'}`);
        console.log(`  PASSWORD: ${hasPassword ? '✅ Present' : '❌ Missing'}`);
        
        // Check first step for hardcoding
        if (intentSpec.steps?.[0]?.snippet) {
            const snippet = intentSpec.steps[0].snippet;
            console.log('\n📝 First step snippet check:');
            
            if (snippet.includes('{{LOGIN_ID}}')) {
                console.log('  ✅ Uses LOGIN_ID variable');
            } else if (snippet.includes('admin@quickfindai.com')) {
                console.log('  ❌ Hardcoded email');
            }
            
            if (snippet.includes('{{PASSWORD}}')) {
                console.log('  ✅ Uses PASSWORD variable');
            } else if (snippet.includes('#QuickFind')) {
                console.log('  ❌ Hardcoded password');
            }
        }
        
        // Final verdict
        console.log('\n=== VERDICT ===');
        if ((hasLoginId && hasPassword)) {
            console.log('✅ SUCCESS: Login fields are in params array');
        } else {
            console.log('❌ FAILURE: Login fields missing from params');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
}

testHandler().catch(console.error);