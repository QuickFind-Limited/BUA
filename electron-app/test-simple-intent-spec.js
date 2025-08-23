// Test with a simple Intent Spec request
const { fork } = require('child_process');
const path = require('path');

const simplePrompt = `You are an expert at creating Intent Specifications.

Create an Intent Spec for a simple login flow. Return ONLY valid JSON.

The user:
1. Goes to https://example.com/login
2. Enters email: user@example.com
3. Enters password
4. Clicks login button

Return this JSON structure:
{
  "name": "Example Login",
  "params": ["EMAIL", "PASSWORD"],
  "steps": [
    {
      "name": "Navigate to login",
      "ai_instruction": "Go to login page",
      "snippet": "await page.goto('https://example.com/login');",
      "prefer": "snippet",
      "fallback": "none"
    },
    {
      "name": "Enter email",
      "ai_instruction": "Enter email",
      "snippet": "await page.fill('#email', '{{EMAIL}}');",
      "prefer": "snippet",
      "fallback": "ai"
    },
    {
      "name": "Enter password",
      "ai_instruction": "Enter password",
      "snippet": "await page.fill('#password', '{{PASSWORD}}');",
      "prefer": "snippet",
      "fallback": "ai"
    },
    {
      "name": "Click login",
      "ai_instruction": "Click login button",
      "snippet": "await page.click('#login-btn');",
      "prefer": "snippet",
      "fallback": "ai"
    }
  ]
}`;

console.log('Testing with simple Intent Spec prompt');
console.log('Prompt size:', (simplePrompt.length / 1024).toFixed(2), 'KB');

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
        console.log('Worker ready, sending simple Intent Spec prompt...');
        startTime = Date.now();
        
        worker.send({
            type: 'analyze',
            prompt: simplePrompt,
            options: { maxTurns: 1 }
        });
        
        setTimeout(() => {
            console.log('Test timed out after 60 seconds');
            worker.kill();
            process.exit(1);
        }, 60000);
    }
    
    if (msg.type === 'result') {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        if (msg.success) {
            console.log(`✅ Success after ${duration}s! Result length:`, msg.data?.length || 0);
            
            try {
                const jsonMatch = msg.data.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('Intent Spec:');
                    console.log('  Name:', parsed.name);
                    console.log('  Params:', parsed.params);
                    console.log('  Steps:', parsed.steps?.length);
                }
            } catch (e) {
                console.log('Result preview:', msg.data?.substring(0, 500));
            }
        } else {
            console.log(`❌ Error after ${duration}s:`, msg.error);
        }
        worker.kill();
        process.exit(0);
    }
});

worker.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        console.log('Worker exited with code:', code);
    }
});