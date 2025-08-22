#!/usr/bin/env node

/**
 * Simplest possible test of Claude Code SDK
 */

async function testSimple() {
  try {
    // Load env
    require('dotenv').config({ path: '.env' });
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('No API key');
      return;
    }
    
    // Import SDK
    const { query } = await import('@anthropic-ai/claude-code');
    
    // Simple prompt
    const prompt = 'Return this exact JSON: {"test": "success", "model": "opus-4.1"}';
    
    console.log('Calling Claude Code SDK...');
    
    for await (const message of query({ prompt })) {
      console.log('Message:', message.type, message.subtype);
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('SUCCESS! Result:', message.result);
        } else {
          console.log('Result subtype:', message.subtype);
          console.log('Full message:', JSON.stringify(message, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSimple();