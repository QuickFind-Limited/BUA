// Test with the actual recording prompt
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const { generateBulletproofIntentSpecPrompt } = require('./dist/main/enhanced-prompt-generator.js');

// Generate the actual prompt
const recording = JSON.parse(fs.readFileSync('recording-1755966456918.json', 'utf8'));
const prompt = generateBulletproofIntentSpecPrompt(recording);

console.log('Testing with actual recording prompt');
console.log('Prompt size:', (prompt.length / 1024).toFixed(2), 'KB');

const workerPath = path.join(__dirname, 'dist', 'main', 'claude-code-worker.js');
const worker = fork(workerPath, [], {
    silent: false,
    env: { ...process.env }
});

let startTime;

worker.on('message', (msg) => {
    console.log(`[${((Date.now() - startTime) / 1000).toFixed(1)}s] Worker message:`, msg.type);
    
    if (msg.type === 'ready') {
        console.log('Worker ready, sending actual recording prompt...');
        startTime = Date.now();
        
        worker.send({
            type: 'analyze',
            prompt: prompt,
            options: { maxTurns: 1 }
        });
        
        // Set a longer timeout for complex prompt
        setTimeout(() => {
            console.log('Test timed out after 120 seconds');
            worker.kill();
            process.exit(1);
        }, 120000);
    }
    
    if (msg.type === 'result') {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        if (msg.success) {
            console.log(`✅ Success after ${duration}s! Result length:`, msg.data?.length || 0);
            
            // Try to parse as JSON
            try {
                const jsonMatch = msg.data.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('Intent Spec name:', parsed.name);
                    console.log('Params:', parsed.params);
                    console.log('Steps:', parsed.steps?.length);
                }
            } catch (e) {
                console.log('Could not parse JSON');
            }
        } else {
            console.log(`❌ Error after ${duration}s:`, msg.error);
        }
        worker.kill();
        process.exit(0);
    }
});

worker.on('error', (err) => {
    console.error('Worker error:', err);
});

worker.on('exit', (code) => {
    if (code !== 0) {
        console.log('Worker exited unexpectedly with code:', code);
    }
});