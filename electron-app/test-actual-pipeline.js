const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');

// Initialize the app
app.whenReady().then(async () => {
    console.log('=== Testing ACTUAL Pipeline with Existing Recording ===\n');
    
    // Register IPC handlers
    const { registerIpcHandlers } = require('./dist/main/ipc');
    registerIpcHandlers();
    console.log('✅ IPC handlers registered\n');
    
    // Load the existing recording
    const recordingPath = path.join(__dirname, 'recording-1755973886399.json');
    const recordingData = fs.readFileSync(recordingPath, 'utf8');
    const recording = JSON.parse(recordingData);
    
    console.log('📄 Recording loaded:');
    console.log('  - Session ID:', recording.sessionId);
    console.log('  - Duration:', recording.duration, 'ms');
    console.log('  - Actions:', recording.actions?.length || 0);
    console.log('  - ExtractedInputs:', recording.extractedInputs?.length || 0);
    
    // Show login fields in recording
    console.log('\n🔐 Login fields in recording:');
    recording.extractedInputs?.forEach(input => {
        if (input.field === 'LOGIN_ID' || input.field === 'PASSWORD') {
            console.log(`  - ${input.field}: ${input.value}`);
        }
    });
    
    // Simulate the IPC call from renderer
    console.log('\n🤖 Calling llm:analyzeRecording handler...\n');
    
    const event = { sender: { send: () => {} } };
    const params = { recordingData };
    
    try {
        const startTime = Date.now();
        
        // Call the actual IPC handler
        const handler = ipcMain._invokeHandlers['llm:analyzeRecording'];
        if (!handler) {
            throw new Error('Handler not found!');
        }
        
        const result = await handler(event, params);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ Analysis completed in ${(duration / 1000).toFixed(2)} seconds`);
        
        if (result.success && result.data?.intentSpec) {
            const intentSpec = result.data.intentSpec;
            
            // Save the generated Intent Spec
            const outputPath = path.join(__dirname, `test-actual-intent-spec-${Date.now()}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(intentSpec, null, 2));
            console.log(`💾 Intent Spec saved to: ${outputPath}`);
            
            // Analyze the result
            console.log('\n=== Generated Intent Spec Analysis ===');
            console.log('Name:', intentSpec.name);
            console.log('Params:', JSON.stringify(intentSpec.params || []));
            
            // Check for login variables
            const hasLoginId = intentSpec.params?.includes('LOGIN_ID');
            const hasPassword = intentSpec.params?.includes('PASSWORD');
            
            console.log('\n🔑 Login field checks:');
            console.log(`  LOGIN_ID: ${hasLoginId ? '✅ Present' : '❌ Missing'}`);
            console.log(`  PASSWORD: ${hasPassword ? '✅ Present' : '❌ Missing'}`);
            
            // Check for hardcoded credentials
            console.log('\n📝 Checking for hardcoded credentials:');
            let hardcodedFound = false;
            
            intentSpec.steps?.forEach((step, index) => {
                if (step.snippet) {
                    if (step.snippet.includes('admin@quickfindai.com')) {
                        console.log(`  ❌ Step ${index + 1}: Hardcoded email`);
                        hardcodedFound = true;
                    }
                    if (step.snippet.includes('#QuickFind')) {
                        console.log(`  ❌ Step ${index + 1}: Hardcoded password`);
                        hardcodedFound = true;
                    }
                    if (step.snippet.includes('{{LOGIN_ID}}')) {
                        console.log(`  ✅ Step ${index + 1}: Uses LOGIN_ID variable`);
                    }
                    if (step.snippet.includes('{{PASSWORD}}')) {
                        console.log(`  ✅ Step ${index + 1}: Uses PASSWORD variable`);
                    }
                }
            });
            
            if (!hardcodedFound) {
                console.log('  ✅ No hardcoded credentials found');
            }
            
            // Final verdict
            console.log('\n=== FINAL VERDICT ===');
            if ((hasLoginId || hasPassword) && !hardcodedFound) {
                console.log('✅ SUCCESS: Login fields are properly included as variables');
            } else if (!hasLoginId && !hasPassword) {
                console.log('❌ FAILURE: Login fields are NOT in params array');
            } else if (hardcodedFound) {
                console.log('❌ FAILURE: Credentials are hardcoded instead of variables');
            }
            
        } else {
            console.error('❌ Analysis failed:', result.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
    
    app.quit();
});