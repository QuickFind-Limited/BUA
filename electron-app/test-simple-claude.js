#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testSimpleClaudeCode() {
  console.log('Testing simple Claude Code SDK call...\n');
  
  try {
    // Import Claude Code SDK
    const { query } = await import('@anthropic-ai/claude-code');
    
    console.log('SDK imported successfully');
    
    // Very simple prompt
    const simplePrompt = `Extract variables from this action: User types "Test Item 123" in item name field and "299.99" in price field.
    
Output JSON with detected variables:
{
  "params": ["ITEM_NAME", "PRICE"]
}`;

    console.log('Prompt length:', simplePrompt.length, 'characters');
    console.log('\nSending to Claude...\n');
    
    let result = '';
    let messageCount = 0;
    
    // Set a timeout
    const timeout = setTimeout(() => {
      console.error('\n⏱️ Timeout: No response after 30 seconds');
      process.exit(1);
    }, 30000);
    
    for await (const message of query({ prompt: simplePrompt })) {
      messageCount++;
      console.log(`Message ${messageCount}: type=${message.type}, subtype=${message.subtype}`);
      
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
        console.log('\n✅ Got result!');
        clearTimeout(timeout);
        break;
      }
      
      if (message.type === 'error') {
        console.error('❌ Error:', message);
        clearTimeout(timeout);
        break;
      }
    }
    
    if (result) {
      console.log('\nResult:', result);
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(result);
        console.log('\nParsed variables:', parsed.params);
      } catch (e) {
        console.log('Not valid JSON, raw result shown above');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSimpleClaudeCode();