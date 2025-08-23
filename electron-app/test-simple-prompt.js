#!/usr/bin/env node

/**
 * Simple test to check if Claude maps login variables correctly
 */

const { analyzeRecording } = require('./dist/main/llm.js');

// Create a test recording with explicit login fields
const testRecording = {
    sessionId: "test-login-mapping",
    duration: 5000,
    url: "https://accounts.zoho.com/signin",
    title: "Zoho Sign In",
    viewport: { width: 1920, height: 1080 },
    
    // Include explicit console logs with LOGIN_ID and PASSWORD
    console: {
        "https://accounts.zoho.com": [
            {
                level: "log",
                args: [{
                    value: '[RECORDER-DATA]{"type":"input","field":"LOGIN_ID","value":"admin@quickfindai.com","inputType":"text","isLoginField":true}'
                }]
            },
            {
                level: "log", 
                args: [{
                    value: '[RECORDER-DATA]{"type":"input","field":"PASSWORD","value":"#QuickFind","inputType":"password","isLoginField":true}'
                }]
            }
        ]
    },
    
    // Include actions that clearly show login
    actions: [
        {
            type: "navigate",
            url: "https://accounts.zoho.com/signin",
            timestamp: 1000
        },
        {
            type: "input",
            target: {
                id: "LOGIN_ID",
                name: "LOGIN_ID",
                selector: "#LOGIN_ID",
                value: "admin@quickfindai.com",
                tagName: "INPUT",
                type: "text"
            },
            value: "admin@quickfindai.com",
            timestamp: 2000
        },
        {
            type: "click",
            target: {
                selector: "#nextbtn",
                text: "Next"
            },
            timestamp: 3000
        },
        {
            type: "input",
            target: {
                id: "PASSWORD",
                name: "PASSWORD", 
                selector: "#PASSWORD",
                value: "#QuickFind",
                tagName: "INPUT",
                type: "password"
            },
            value: "#QuickFind",
            timestamp: 4000
        },
        {
            type: "click",
            target: {
                selector: "#nextbtn",
                text: "Sign In"
            },
            timestamp: 5000
        }
    ],
    
    // Include capturedInputs to be extra clear
    capturedInputs: {
        "LOGIN_ID": {
            field: "LOGIN_ID",
            value: "admin@quickfindai.com",
            type: "text",
            url: "https://accounts.zoho.com/signin",
            isLoginField: true
        },
        "PASSWORD": {
            field: "PASSWORD",
            value: "#QuickFind",
            type: "password",
            url: "https://accounts.zoho.com/signin",
            isLoginField: true
        }
    },
    
    // Minimal DOM snapshot
    domSnapshots: [{
        timestamp: 1500,
        url: "https://accounts.zoho.com/signin",
        title: "Sign In",
        interactables: [
            { tagName: "INPUT", id: "LOGIN_ID", name: "LOGIN_ID", type: "text", placeholder: "Email or Phone" },
            { tagName: "INPUT", id: "PASSWORD", name: "PASSWORD", type: "password", placeholder: "Password" },
            { tagName: "BUTTON", id: "nextbtn", text: "Next" }
        ]
    }]
};

async function testVariableMapping() {
    console.log('🧪 Testing Variable Mapping with Explicit Login Recording\n');
    console.log('Recording contains:');
    console.log('  - LOGIN_ID field with value "admin@quickfindai.com"');
    console.log('  - PASSWORD field with value "#QuickFind"');
    console.log('\nExpected output:');
    console.log('  - params should include EMAIL_ADDRESS or USERNAME');
    console.log('  - params should include PASSWORD\n');
    
    console.log('Sending to Claude...\n');
    
    try {
        const startTime = Date.now();
        const intentSpec = await analyzeRecording(testRecording);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Analysis completed in ${(duration/1000).toFixed(1)}s\n`);
        
        console.log('Intent Spec received:');
        console.log('  Name:', intentSpec.name);
        console.log('  URL:', intentSpec.url);
        console.log('  Params:', intentSpec.params);
        
        // Check for correct variables
        const hasEmail = intentSpec.params?.includes('EMAIL_ADDRESS');
        const hasUsername = intentSpec.params?.includes('USERNAME');
        const hasPassword = intentSpec.params?.includes('PASSWORD');
        const hasLoginId = intentSpec.params?.includes('LOGIN_ID'); // This would be wrong
        
        console.log('\n📋 Variable Check:');
        console.log(`  EMAIL_ADDRESS: ${hasEmail ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log(`  USERNAME: ${hasUsername ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log(`  PASSWORD: ${hasPassword ? '✅ FOUND' : '❌ NOT FOUND'}`);
        
        if (hasLoginId) {
            console.log(`  ⚠️ LOGIN_ID: Found (should be mapped to EMAIL_ADDRESS)`);
        }
        
        if ((hasEmail || hasUsername) && hasPassword) {
            console.log('\n🎉 SUCCESS: Login variables correctly mapped!');
        } else {
            console.log('\n❌ FAILED: Login variables not properly mapped');
            console.log('\nClaude is not following the variable mapping instructions.');
            console.log('The prompt needs to be more explicit about this requirement.');
        }
        
        // Save for inspection
        await require('fs').promises.writeFile(
            'test-simple-result.json',
            JSON.stringify(intentSpec, null, 2)
        );
        console.log('\n💾 Full Intent Spec saved to test-simple-result.json');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

testVariableMapping().then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
});