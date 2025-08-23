// Test the latest recording with the fixed worker
const { analyzeRecording } = require('./dist/main/llm.js');
const fs = require('fs');

// Find the latest recording
const latestRecording = 'recording-1755966456918.json';
console.log('Testing latest recording:', latestRecording);

const recording = JSON.parse(fs.readFileSync(latestRecording, 'utf8'));

console.log('Recording details:');
console.log('  - Session:', recording.sessionId);
console.log('  - Duration:', (recording.duration / 1000).toFixed(1), 'seconds');
console.log('  - File size:', (fs.statSync(latestRecording).size / 1024 / 1024).toFixed(2), 'MB');

// Check captured inputs
if (recording.capturedInputs) {
    console.log('  - Captured inputs:', Object.keys(recording.capturedInputs).join(', '));
}

// Extract from console logs like llm.ts does
if (!recording.capturedInputs && recording.console) {
    const capturedInputs = {};
    Object.values(recording.console).forEach(logs => {
        logs.forEach(log => {
            if (log.args) {
                log.args.forEach(arg => {
                    if (arg.value && arg.value.includes('[RECORDER-DATA]')) {
                        try {
                            const data = JSON.parse(arg.value.replace('[RECORDER-DATA]', ''));
                            if (data.field && data.value) {
                                capturedInputs[data.field] = {
                                    field: data.field,
                                    value: data.value,
                                    type: data.inputType || 'text',
                                    isLoginField: data.isLoginField || false
                                };
                            }
                        } catch (e) {}
                    }
                });
            }
        });
    });
    
    if (Object.keys(capturedInputs).length > 0) {
        recording.capturedInputs = capturedInputs;
        console.log('  - Extracted inputs:', Object.keys(capturedInputs).join(', '));
    }
}

// Check prompt size
const { generateBulletproofIntentSpecPrompt } = require('./dist/main/enhanced-prompt-generator.js');
const prompt = generateBulletproofIntentSpecPrompt(recording);
console.log('  - Prompt size:', (prompt.length / 1024).toFixed(2), 'KB');
console.log('');

console.log('Starting analysis with fixed worker...');
const startTime = Date.now();

analyzeRecording(recording).then(result => {
    const duration = Date.now() - startTime;
    
    console.log('');
    console.log('✅ Analysis completed successfully!');
    console.log('⏱️ Time taken:', (duration / 1000).toFixed(1), 'seconds');
    console.log('');
    console.log('Intent Spec:');
    console.log('  Name:', result.name);
    console.log('  Params:', result.params);
    console.log('  Steps:', result.steps?.length || 0);
    
    console.log('');
    console.log('Variables detected:');
    result.params?.forEach(param => {
        console.log('  -', param);
    });
    
    // Check if login variables are properly mapped
    const hasEmail = result.params?.includes('EMAIL_ADDRESS') || result.params?.includes('EMAIL');
    const hasPassword = result.params?.includes('PASSWORD');
    
    console.log('');
    console.log('Login variable mapping:');
    console.log('  EMAIL_ADDRESS/EMAIL:', hasEmail ? '✅' : '❌');
    console.log('  PASSWORD:', hasPassword ? '✅' : '❌');
    
}).catch(err => {
    const duration = Date.now() - startTime;
    console.error('❌ Failed after', (duration / 1000).toFixed(1), 'seconds:', err.message);
    console.error('Stack:', err.stack);
});