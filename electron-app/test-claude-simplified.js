#!/usr/bin/env node

/**
 * Test Claude with simplified recording data
 */

const fs = require('fs').promises;
const path = require('path');
const { analyzeRecording } = require('./dist/main/llm.js');

async function testClaude() {
    try {
        // Create a simplified recording with just the essentials
        console.log('📝 Creating simplified recording for testing...');
        
        const simplifiedRecording = {
            sessionId: "test-session",
            duration: 30000,
            url: "https://accounts.zoho.com/signin",
            title: "Zoho Login",
            
            // Include the captured login fields
            console: {
                "https://accounts.zoho.com": [
                    {
                        args: [{
                            value: '[RECORDER-DATA]{"type":"input","field":"LOGIN_ID","value":"admin@quickfindai.com","inputType":"text","url":"https://accounts.zoho.com/signin","isLoginField":true}'
                        }]
                    },
                    {
                        args: [{
                            value: '[RECORDER-DATA]{"type":"input","field":"PASSWORD","value":"#QuickFind","inputType":"password","url":"https://accounts.zoho.com/signin","isLoginField":true}'
                        }]
                    }
                ]
            },
            
            // Simplified actions
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
                        selector: "#LOGIN_ID",
                        value: "admin@quickfindai.com"
                    },
                    timestamp: 2000
                },
                {
                    type: "click",
                    target: {
                        selector: "button#nextbtn",
                        text: "Next"
                    },
                    timestamp: 3000
                },
                {
                    type: "input",
                    target: {
                        id: "PASSWORD",
                        selector: "#PASSWORD",
                        value: "#QuickFind"
                    },
                    timestamp: 4000
                },
                {
                    type: "click",
                    target: {
                        selector: "button#nextbtn",
                        text: "Sign In"
                    },
                    timestamp: 5000
                },
                {
                    type: "navigate",
                    url: "https://inventory.zoho.com/app",
                    timestamp: 6000
                }
            ],
            
            // Minimal DOM snapshot
            domSnapshots: [{
                url: "https://accounts.zoho.com/signin",
                title: "Sign In",
                interactables: [
                    { tagName: "INPUT", id: "LOGIN_ID", name: "LOGIN_ID" },
                    { tagName: "INPUT", id: "PASSWORD", name: "PASSWORD", type: "password" },
                    { tagName: "BUTTON", id: "nextbtn", text: "Next" }
                ]
            }]
        };
        
        console.log('\n🤖 Sending simplified recording to Claude...');
        console.log('Recording size:', JSON.stringify(simplifiedRecording).length, 'bytes');
        
        const startTime = Date.now();
        const intentSpec = await analyzeRecording(simplifiedRecording);
        const duration = Date.now() - startTime;
        
        console.log(`\n✅ Claude responded in ${(duration/1000).toFixed(1)} seconds`);
        
        if (intentSpec) {
            console.log('\n📋 Intent Spec Generated:');
            console.log('Name:', intentSpec.name);
            console.log('Description:', intentSpec.description);
            
            console.log('\n🔍 Variables Found:');
            if (intentSpec.params && Array.isArray(intentSpec.params)) {
                intentSpec.params.forEach(param => {
                    console.log(`  - ${param}`);
                });
                
                // Check for expected variables
                const hasUsername = intentSpec.params.includes('USERNAME') || 
                                   intentSpec.params.includes('EMAIL_ADDRESS');
                const hasPassword = intentSpec.params.includes('PASSWORD');
                
                console.log('\n✅ Variable Check:');
                console.log(`  Username/Email: ${hasUsername ? '✅ FOUND' : '❌ MISSING'}`);
                console.log(`  Password: ${hasPassword ? '✅ FOUND' : '❌ MISSING'}`);
                
                if (!hasUsername || !hasPassword) {
                    console.log('\n⚠️ Login credentials are missing from params!');
                } else {
                    console.log('\n🎉 All login credentials included!');
                }
            }
            
            // Save result
            await fs.writeFile('test-claude-result.json', JSON.stringify(intentSpec, null, 2));
            console.log('\n💾 Full Intent Spec saved to test-claude-result.json');
            
        } else {
            console.log('❌ No Intent Spec generated');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
    }
}

// Run the test
console.log('🧪 Testing Claude with Simplified Recording\n');
console.log('This tests if Claude can extract login credentials as variables.\n');

testClaude().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Test error:', err);
    process.exit(1);
});