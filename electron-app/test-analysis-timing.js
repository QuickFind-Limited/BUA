const { analyzeRecording } = require('./dist/main/llm.js');
const fs = require('fs');

// Use the actual latest recording, not the modified one
const latestRecording = 'recording-1755945126115.json';
console.log('Testing with ACTUAL latest recording:', latestRecording);

const recording = JSON.parse(fs.readFileSync(latestRecording, 'utf8'));

console.log('Recording details:');
console.log('  - Session:', recording.sessionId);
console.log('  - Duration:', (recording.duration / 1000).toFixed(1), 'seconds');
console.log('  - File size:', (fs.statSync(latestRecording).size / 1024 / 1024).toFixed(2), 'MB');

// Check prompt size after reduction
const { generateBulletproofIntentSpecPrompt } = require('./dist/main/enhanced-prompt-generator.js');

// First extract capturedInputs (like llm.ts does)
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
    console.log('  - Captured inputs:', Object.keys(capturedInputs).join(', '));
  }
}

const prompt = generateBulletproofIntentSpecPrompt(recording);
console.log('  - Prompt size after reduction:', (prompt.length / 1024).toFixed(2), 'KB');
console.log('  - Data reduction:', ((1 - prompt.length / fs.statSync(latestRecording).size) * 100).toFixed(1) + '%');
console.log('');

console.log('Starting analysis...');
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
  
  const hasEmail = result.params?.includes('EMAIL_ADDRESS');
  const hasPassword = result.params?.includes('PASSWORD');
  
  console.log('');
  console.log('Login Variables:');
  console.log('  EMAIL_ADDRESS:', hasEmail ? '✅' : '❌');
  console.log('  PASSWORD:', hasPassword ? '✅' : '❌');
  
}).catch(err => {
  const duration = Date.now() - startTime;
  console.error('❌ Failed after', (duration / 1000).toFixed(1), 'seconds:', err.message);
});