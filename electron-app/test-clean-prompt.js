// Test with cleaned prompt
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load the clean prompt
const cleanPrompt = fs.readFileSync('debug-prompt-clean.txt', 'utf8');

console.log('Testing with cleaned prompt');
console.log('Prompt size:', (cleanPrompt.length / 1024).toFixed(2), 'KB');

const workerPath = path.join(__dirname, 'dist', 'main', 'claude-code-worker.js');
const worker = fork(workerPath, [], {
    silent: false,
    env: { ...process.env }
});

let startTime;

worker.on('message', (msg) => {
    const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) : '0.0';
    console.log(`[${elapsed}s] Worker message:`, msg.type);
    
    if (msg.type === 'ready') {
        console.log('Worker ready, sending cleaned prompt...');
        startTime = Date.now();
        
        worker.send({
            type: 'analyze',
            prompt: cleanPrompt,
            options: { maxTurns: 1 }
        });
        
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
            
            // Check if it's valid JSON
            try {
                const jsonMatch = msg.data.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('Intent Spec:');
                    console.log('  Name:', parsed.name);
                    console.log('  Params:', parsed.params);
                    console.log('  Steps:', parsed.steps?.length);
                    
                    // Check for login variables
                    const hasEmail = parsed.params?.includes('EMAIL_ADDRESS') || parsed.params?.includes('EMAIL');
                    const hasPassword = parsed.params?.includes('PASSWORD');
                    console.log('\\nVariable mapping:');
                    console.log('  EMAIL_ADDRESS/EMAIL:', hasEmail ? '✅' : '❌');
                    console.log('  PASSWORD:', hasPassword ? '✅' : '❌');
                }
            } catch (e) {
                console.log('Could not parse JSON:', e.message);
                console.log('First 500 chars:', msg.data?.substring(0, 500));
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
    if (code !== 0 && code !== null) {
        console.log('Worker exited with code:', code);
    }
});