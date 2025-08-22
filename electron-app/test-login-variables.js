#!/usr/bin/env node

/**
 * Test that login credentials are properly included in Intent Spec
 */

const fs = require('fs').promises;
const path = require('path');
const { analyzeRecording } = require('./dist/main/llm.js');

async function testLoginVariables() {
    try {
        // Load the most recent recording
        const recordingPath = path.join(__dirname, 'recording-1755890493421.json');
        console.log('Loading recording:', recordingPath);
        
        const recordingData = JSON.parse(await fs.readFile(recordingPath, 'utf8'));
        console.log('Recording loaded successfully');
        
        // Check what inputs were captured
        console.log('\n📝 Checking captured inputs in recording...');
        
        // Look for LOGIN_ID and PASSWORD in console logs
        let loginFound = false;
        let passwordFound = false;
        
        if (recordingData.console) {
            Object.values(recordingData.console).flat().forEach(log => {
                if (log.args) {
                    log.args.forEach(arg => {
                        const text = String(arg.value || '');
                        if (text.includes('LOGIN_ID')) {
                            console.log('✅ Found LOGIN_ID field capture');
                            loginFound = true;
                        }
                        if (text.includes('PASSWORD') && text.includes('[RECORDER-DATA]')) {
                            console.log('✅ Found PASSWORD field capture');
                            passwordFound = true;
                        }
                    });
                }
            });
        }
        
        if (!loginFound || !passwordFound) {
            console.log('⚠️ Warning: Login credentials may not be properly captured');
        }
        
        // Analyze the recording
        console.log('\n🤖 Generating Intent Spec with AI...');
        const intentSpec = await analyzeRecording(recordingData);
        
        if (intentSpec) {
            console.log('\n✅ Intent Spec generated successfully');
            
            // Check for login variables in params
            console.log('\n📋 Variables in Intent Spec params:');
            if (intentSpec.params && Array.isArray(intentSpec.params)) {
                intentSpec.params.forEach(param => {
                    console.log(`  - ${param}`);
                });
                
                // Check for expected variables
                const hasUsername = intentSpec.params.includes('USERNAME') || 
                                   intentSpec.params.includes('EMAIL_ADDRESS');
                const hasPassword = intentSpec.params.includes('PASSWORD');
                const hasItemName = intentSpec.params.includes('ITEM_NAME');
                
                console.log('\n🔍 Variable Check Results:');
                console.log(`  Username/Email: ${hasUsername ? '✅ FOUND' : '❌ MISSING'}`);
                console.log(`  Password: ${hasPassword ? '✅ FOUND' : '❌ MISSING'}`);
                console.log(`  Item Name: ${hasItemName ? '✅ FOUND' : '❌ MISSING'}`);
                
                if (!hasUsername || !hasPassword) {
                    console.log('\n⚠️ WARNING: Login credentials are missing from Intent Spec!');
                    console.log('The prompt may need further updates to ensure credentials are included.');
                } else {
                    console.log('\n🎉 SUCCESS: All expected variables are present!');
                }
            } else {
                console.log('❌ No params array found in Intent Spec');
            }
            
            // Save the test result
            const testResultPath = path.join(__dirname, 'test-login-variables-result.json');
            await fs.writeFile(testResultPath, JSON.stringify(intentSpec, null, 2));
            console.log(`\n💾 Full Intent Spec saved to: ${testResultPath}`);
            
        } else {
            console.log('❌ Failed to generate Intent Spec');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
console.log('🧪 Testing Login Variable Extraction...\n');
testLoginVariables().then(() => {
    console.log('\n✅ Test completed');
}).catch(err => {
    console.error('\n❌ Test error:', err);
    process.exit(1);
});