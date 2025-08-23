const fs = require('fs');
const path = require('path');
const { analyzeRecording } = require('./dist/main/llm');

async function testPipeline() {
    console.log('=== Testing Pipeline with Existing Recording ===\n');
    
    // Load the existing recording
    const recordingPath = path.join(__dirname, 'recording-1755973886399.json');
    
    if (!fs.existsSync(recordingPath)) {
        console.error('❌ Recording file not found:', recordingPath);
        process.exit(1);
    }
    
    const recordingData = fs.readFileSync(recordingPath, 'utf8');
    console.log('📄 Recording loaded, size:', (recordingData.length / 1024).toFixed(2), 'KB');
    
    // Parse to check captured inputs
    const recording = JSON.parse(recordingData);
    console.log('\n📊 Recording summary:');
    console.log('  - Duration:', recording.duration, 'ms');
    console.log('  - Actions:', recording.actions?.length || 0);
    console.log('  - Captured inputs:', Object.keys(recording.capturedInputs || {}).length);
    
    // Show captured login fields
    console.log('\n🔐 Login fields in recording:');
    Object.entries(recording.capturedInputs || {}).forEach(([field, data]) => {
        if (data.isLoginField) {
            console.log(`  - ${field}: ${data.type} (isLoginField: ${data.isLoginField})`);
        }
    });
    
    console.log('\n🤖 Running through AI pipeline...');
    console.log('  Using enhanced prompt with login field requirements...\n');
    
    try {
        // Run through the pipeline
        const startTime = Date.now();
        const intentSpec = await analyzeRecording(recordingData);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Intent Spec generated in ${(duration / 1000).toFixed(2)} seconds`);
        
        // Save the new Intent Spec
        const outputPath = path.join(__dirname, `test-intent-spec-${Date.now()}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(intentSpec, null, 2));
        console.log(`💾 Saved to: ${outputPath}`);
        
        // Analyze the result
        console.log('\n=== Analyzing Generated Intent Spec ===\n');
        console.log('Name:', intentSpec.name);
        console.log('Params:', JSON.stringify(intentSpec.params || []));
        
        // Check for login variables
        const hasLoginId = intentSpec.params?.includes('LOGIN_ID');
        const hasPassword = intentSpec.params?.includes('PASSWORD');
        const hasEmail = intentSpec.params?.includes('EMAIL_ADDRESS');
        const hasUsername = intentSpec.params?.includes('USERNAME');
        
        console.log('\n🔑 Login field checks:');
        console.log(`  LOGIN_ID: ${hasLoginId ? '✅ Present' : '❌ Missing'}`);
        console.log(`  PASSWORD: ${hasPassword ? '✅ Present' : '❌ Missing'}`);
        console.log(`  EMAIL_ADDRESS: ${hasEmail ? '✅ Present' : '❌ Missing'}`);
        console.log(`  USERNAME: ${hasUsername ? '✅ Present' : '❌ Missing'}`);
        
        // Check for hardcoded credentials in snippets
        console.log('\n📝 Checking snippets for hardcoded values:');
        let hardcodedFound = false;
        
        intentSpec.steps?.forEach((step, index) => {
            if (step.snippet) {
                if (step.snippet.includes('admin@quickfindai.com')) {
                    console.log(`  ❌ Step ${index + 1}: Hardcoded email found`);
                    hardcodedFound = true;
                }
                if (step.snippet.includes('#QuickFind')) {
                    console.log(`  ❌ Step ${index + 1}: Hardcoded password found`);
                    hardcodedFound = true;
                }
                if (step.snippet.includes('{{LOGIN_ID}}') || step.snippet.includes('{{EMAIL')) {
                    console.log(`  ✅ Step ${index + 1}: Uses login variable`);
                }
                if (step.snippet.includes('{{PASSWORD}}')) {
                    console.log(`  ✅ Step ${index + 1}: Uses password variable`);
                }
            }
        });
        
        if (!hardcodedFound) {
            console.log('  ✅ No hardcoded credentials found');
        }
        
        // Final verdict
        console.log('\n=== FINAL VERDICT ===\n');
        const loginInParams = hasLoginId || hasPassword || hasEmail || hasUsername;
        
        if (loginInParams && !hardcodedFound) {
            console.log('✅ SUCCESS: Login fields are properly parameterized as variables');
        } else if (!loginInParams) {
            console.log('❌ FAILURE: Login fields are NOT included in params array');
            console.log('   The enhanced prompt generator fix may not be working correctly');
        } else if (hardcodedFound) {
            console.log('❌ FAILURE: Login credentials are hardcoded instead of using variables');
        }
        
    } catch (error) {
        console.error('❌ Error running pipeline:', error.message);
        process.exit(1);
    }
}

// Check if API key is configured
if (!process.env.ANTHROPIC_API_KEY) {
    console.log('Loading .env file...');
    require('dotenv').config();
}

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    process.exit(1);
}

console.log('✅ API key configured\n');

// Run the test
testPipeline().catch(console.error);