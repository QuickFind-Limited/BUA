// Test the worker process directly
const { fork } = require('child_process');
const path = require('path');

const workerPath = path.join(__dirname, 'dist', 'main', 'claude-code-worker.js');
console.log('Starting worker at:', workerPath);

const worker = fork(workerPath, [], {
    silent: false,
    env: { ...process.env }
});

worker.on('message', (msg) => {
    console.log('Worker message:', msg.type);
    
    if (msg.type === 'ready') {
        console.log('Worker ready, sending simple test prompt...');
        
        // Send a very simple prompt
        worker.send({
            type: 'analyze',
            prompt: 'Return this exact JSON: {"name": "test", "params": [], "steps": []}',
            options: { maxTurns: 1 }
        });
        
        // Set a timeout
        setTimeout(() => {
            console.log('Test timed out after 30 seconds');
            worker.kill();
            process.exit(1);
        }, 30000);
    }
    
    if (msg.type === 'result') {
        if (msg.success) {
            console.log('✅ Success! Result length:', msg.data?.length || 0);
            console.log('Result preview:', msg.data?.substring(0, 200));
        } else {
            console.log('❌ Error:', msg.error);
        }
        worker.kill();
        process.exit(0);
    }
});

worker.on('error', (err) => {
    console.error('Worker error:', err);
});

worker.on('exit', (code) => {
    console.log('Worker exited with code:', code);
});