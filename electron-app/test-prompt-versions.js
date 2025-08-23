#!/usr/bin/env node

/**
 * Test different prompt versions to get login variables included
 */

const fs = require('fs').promises;
const path = require('path');

// Create different prompt versions
const promptVersions = {
    v1_explicit_mapping: `
## CRITICAL: Variable Name Requirements

You MUST map field names to standard variable names:
- If you see field "LOGIN_ID" → MUST use "EMAIL_ADDRESS" in params
- If you see field "PASSWORD" → MUST use "PASSWORD" in params
- Any email/username field → "EMAIL_ADDRESS" or "USERNAME"
- Any password field → "PASSWORD"

IMPORTANT: The params array must include:
1. EMAIL_ADDRESS or USERNAME (for login fields)
2. PASSWORD (for password fields)
3. Any other dynamic values from forms

Example: If recording shows LOGIN_ID="admin@example.com" and PASSWORD="secret"
Then params MUST be: ["EMAIL_ADDRESS", "PASSWORD", ...]
`,

    v2_mandatory_extraction: `
## MANDATORY VARIABLE EXTRACTION

RULE 1: Extract ALL input fields as variables
RULE 2: Use STANDARD variable names:
- LOGIN_ID/username/email → EMAIL_ADDRESS
- PASSWORD/password → PASSWORD
- item_name → ITEM_NAME
- quantity → QUANTITY

VALIDATION CHECK: If the recording contains login actions, the params array MUST include:
✓ EMAIL_ADDRESS or USERNAME
✓ PASSWORD

If these are missing, the Intent Spec is INVALID.
`,

    v3_explicit_example: `
## Variable Extraction with Examples

When you see in the recording:
[RECORDER-DATA]{"field":"LOGIN_ID","value":"admin@quickfindai.com"}
→ Add "EMAIL_ADDRESS" to params

[RECORDER-DATA]{"field":"PASSWORD","value":"***"}
→ Add "PASSWORD" to params

Input in field with value "New Box Item 100"
→ Add "ITEM_NAME" to params

REQUIRED OUTPUT:
params: ["EMAIL_ADDRESS", "PASSWORD", "ITEM_NAME", "QUANTITY"]
`,

    v4_pre_analysis: `
## Step 1: Analyze Recording for Variables

Before creating the Intent Spec, identify ALL variables:
1. Search for LOGIN_ID or username → Map to EMAIL_ADDRESS
2. Search for PASSWORD → Map to PASSWORD
3. Search for any form inputs → Create appropriate variable names

## Step 2: Required Variables

Your Intent Spec params array MUST include:
- EMAIL_ADDRESS (if any login/username field exists)
- PASSWORD (if any password field exists)
- Plus all other form field variables
`,

    v5_strict_validation: `
## VALIDATION REQUIREMENTS

The Intent Spec will be REJECTED if:
- Recording has LOGIN_ID but params lacks EMAIL_ADDRESS
- Recording has PASSWORD field but params lacks PASSWORD
- Any input field is not represented as a variable

CORRECT Example:
Recording has: LOGIN_ID, PASSWORD, item_name
Params MUST be: ["EMAIL_ADDRESS", "PASSWORD", "ITEM_NAME"]

INCORRECT Example (will be rejected):
Recording has: LOGIN_ID, PASSWORD
Params: ["LOGIN_ID", "PASSWORD"] ← WRONG! Must map to standard names
`
};

async function testPromptVersion(name, additionalPrompt, recording) {
    console.log(`\n🧪 Testing ${name}`);
    
    // Create a modified prompt generator that adds our test prompt
    const modifiedPrompt = `
You are an expert at creating BULLETPROOF Intent Specifications from comprehensive recording data.

${additionalPrompt}

Analyze this recording and create an Intent Spec.

Recording Summary:
- Contains LOGIN_ID field with value "admin@quickfindai.com"
- Contains PASSWORD field with value "#QuickFind"
- Contains item creation with "New Box Item 100"

Console logs show:
${JSON.stringify(recording.console?.['https://accounts.zoho.com']?.slice(0, 2) || [], null, 2)}

Return ONLY valid JSON with the Intent Spec. The params array is CRITICAL.
`;

    // Import and use the actual Claude analysis
    const { analyzeRecording } = require('./dist/main/llm.js');
    
    // Temporarily override the prompt generator
    const originalGenerator = require('./dist/main/enhanced-prompt-generator.js').generateBulletproofIntentSpecPrompt;
    require('./dist/main/enhanced-prompt-generator.js').generateBulletproofIntentSpecPrompt = () => modifiedPrompt;
    
    try {
        const result = await analyzeRecording(recording);
        
        // Check if login variables are included
        const hasEmail = result.params?.includes('EMAIL_ADDRESS') || result.params?.includes('USERNAME');
        const hasPassword = result.params?.includes('PASSWORD');
        
        console.log(`✅ Success`);
        console.log(`  Params: ${result.params?.join(', ') || 'none'}`);
        console.log(`  Has EMAIL/USERNAME: ${hasEmail ? '✅' : '❌'}`);
        console.log(`  Has PASSWORD: ${hasPassword ? '✅' : '❌'}`);
        
        // Restore original generator
        require('./dist/main/enhanced-prompt-generator.js').generateBulletproofIntentSpecPrompt = originalGenerator;
        
        return { name, success: true, hasEmail, hasPassword, params: result.params };
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        
        // Restore original generator
        require('./dist/main/enhanced-prompt-generator.js').generateBulletproofIntentSpecPrompt = originalGenerator;
        
        return { name, success: false, error: error.message };
    }
}

async function runTests() {
    // Create a minimal recording with login fields
    const testRecording = {
        sessionId: "test-login",
        duration: 10000,
        url: "https://accounts.zoho.com/signin",
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
        actions: [
            {
                type: "input",
                target: {
                    id: "LOGIN_ID",
                    value: "admin@quickfindai.com"
                }
            },
            {
                type: "input",
                target: {
                    id: "PASSWORD",
                    value: "#QuickFind"
                }
            }
        ]
    };
    
    const results = [];
    
    // Test each prompt version
    for (const [name, prompt] of Object.entries(promptVersions)) {
        results.push(await testPromptVersion(name, prompt, testRecording));
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success && r.hasEmail && r.hasPassword);
    
    if (successful.length > 0) {
        console.log(`\n🎉 SUCCESSFUL VERSIONS (${successful.length}):`);
        successful.forEach(r => {
            console.log(`  ✅ ${r.name}: ${r.params.join(', ')}`);
        });
    }
    
    const partial = results.filter(r => r.success && (!r.hasEmail || !r.hasPassword));
    if (partial.length > 0) {
        console.log(`\n⚠️ PARTIAL SUCCESS (${partial.length}):`);
        partial.forEach(r => {
            console.log(`  ${r.name}: ${r.params?.join(', ') || 'none'}`);
            console.log(`    Missing: ${!r.hasEmail ? 'EMAIL' : ''} ${!r.hasPassword ? 'PASSWORD' : ''}`);
        });
    }
    
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
        console.log(`\n❌ FAILED (${failed.length}):`);
        failed.forEach(r => {
            console.log(`  ${r.name}: ${r.error}`);
        });
    }
    
    // Recommendation
    console.log('\n📝 RECOMMENDATION:');
    if (successful.length > 0) {
        console.log(`Use prompt version: ${successful[0].name}`);
        console.log('This version successfully extracts both EMAIL_ADDRESS and PASSWORD');
    } else {
        console.log('None of the versions fully succeeded. May need to combine approaches.');
    }
}

console.log('🚀 Testing Prompt Versions for Login Variable Extraction');
console.log('=' + '='.repeat(59));

runTests().then(() => {
    console.log('\n✅ Testing complete');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Test error:', err);
    process.exit(1);
});