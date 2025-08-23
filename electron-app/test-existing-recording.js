const fs = require('fs');
const path = require('path');

console.log('=== Testing with Existing Recording ===\n');

// Load the last recording
const recordingPath = path.join(__dirname, 'recording-1755973886399.json');
const intentSpecPath = path.join(__dirname, 'intent-spec-1755973931307.json');

// Check if files exist
if (!fs.existsSync(recordingPath)) {
    console.error('❌ Recording file not found:', recordingPath);
    process.exit(1);
}

if (!fs.existsSync(intentSpecPath)) {
    console.error('❌ Intent Spec file not found:', intentSpecPath);
    process.exit(1);
}

// Load the files
const recording = JSON.parse(fs.readFileSync(recordingPath, 'utf8'));
const intentSpec = JSON.parse(fs.readFileSync(intentSpecPath, 'utf8'));

console.log('📄 Recording loaded:', recordingPath);
console.log('📄 Intent Spec loaded:', intentSpecPath);
console.log('\n=== Checking Intent Spec Variables ===\n');

// Check if login fields are in params
const hasLoginId = intentSpec.params?.includes('LOGIN_ID');
const hasPassword = intentSpec.params?.includes('PASSWORD');
const hasEmailAddress = intentSpec.params?.includes('EMAIL_ADDRESS');
const hasUsername = intentSpec.params?.includes('USERNAME');

console.log('Variables in Intent Spec params:');
console.log('  params:', JSON.stringify(intentSpec.params || []));
console.log('\nLogin field checks:');
console.log(`  LOGIN_ID: ${hasLoginId ? '✅ Present' : '❌ Missing'}`);
console.log(`  PASSWORD: ${hasPassword ? '✅ Present' : '❌ Missing'}`);
console.log(`  EMAIL_ADDRESS: ${hasEmailAddress ? '✅ Present' : '❌ Missing'}`);
console.log(`  USERNAME: ${hasUsername ? '✅ Present' : '❌ Missing'}`);

// Check if login fields are hardcoded in snippets
console.log('\n=== Checking for Hardcoded Credentials ===\n');

let hardcodedFound = false;
intentSpec.steps?.forEach((step, index) => {
    if (step.snippet) {
        // Check for hardcoded emails
        if (step.snippet.includes('admin@quickfindai.com')) {
            console.log(`❌ Step ${index + 1} has hardcoded email: admin@quickfindai.com`);
            hardcodedFound = true;
        }
        // Check for hardcoded passwords
        if (step.snippet.includes('#QuickFind')) {
            console.log(`❌ Step ${index + 1} has hardcoded password: #QuickFind`);
            hardcodedFound = true;
        }
        // Check if variables are used properly
        if (step.snippet.includes('{{LOGIN_ID}}') || step.snippet.includes('{{EMAIL_ADDRESS}}')) {
            console.log(`✅ Step ${index + 1} uses login variable properly`);
        }
        if (step.snippet.includes('{{PASSWORD}}')) {
            console.log(`✅ Step ${index + 1} uses password variable properly`);
        }
    }
});

if (!hardcodedFound) {
    console.log('✅ No hardcoded credentials found in snippets');
}

// Check captured inputs from recording
console.log('\n=== Checking Recording Captured Inputs ===\n');

const capturedInputs = recording.capturedInputs || {};
const loginFields = [];

Object.entries(capturedInputs).forEach(([field, data]) => {
    if (data.isLoginField || field.includes('LOGIN') || field.includes('PASSWORD')) {
        loginFields.push({
            field,
            type: data.type,
            isLoginField: data.isLoginField,
            url: data.url
        });
    }
});

console.log(`Found ${loginFields.length} login fields in recording:`);
loginFields.forEach(field => {
    console.log(`  - ${field.field} (${field.type}) from ${field.url?.substring(0, 50)}...`);
});

// Summary
console.log('\n=== SUMMARY ===\n');

const loginFieldsInParams = hasLoginId || hasPassword || hasEmailAddress || hasUsername;

if (loginFieldsInParams && !hardcodedFound) {
    console.log('✅ PASS: Login fields are properly parameterized');
} else if (!loginFieldsInParams) {
    console.log('❌ FAIL: Login fields are NOT in params array');
} else if (hardcodedFound) {
    console.log('❌ FAIL: Login credentials are hardcoded in snippets');
} else {
    console.log('⚠️  WARNING: Unexpected state - review manually');
}

console.log('\n=== End of Test ===');