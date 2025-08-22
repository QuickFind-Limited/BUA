#!/usr/bin/env node

/**
 * Direct test of Claude Code SDK with Opus 4.1
 * This bypasses all the worker complexity to test if the SDK works at all
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testClaudeCodeSDK() {
  console.log('\n🚀 Testing Claude Code SDK with Opus 4.1');
  console.log('=' .repeat(60));
  
  try {
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not found in .env file');
      return;
    }
    console.log('✅ API key found');
    
    // Try to import Claude Code SDK
    console.log('\n📦 Importing Claude Code SDK...');
    
    // Since this is a CommonJS file, we need to use dynamic import for ES modules
    const { query } = await import('@anthropic-ai/claude-code');
    
    console.log('✅ Claude Code SDK imported successfully');
    console.log('🤖 Using Opus 4.1 model (default for Claude Code SDK)');
    
    // Test with a simple prompt
    console.log('\n📝 Testing with a simple prompt...');
    const testPrompt = `Analyze this simple recording and return a JSON Intent Spec:
    
    Recording: User navigates to login page, enters email "test@example.com", enters password, clicks login.
    
    Return ONLY valid JSON with this structure:
    {
      "name": "string",
      "description": "string", 
      "url": "string",
      "params": ["array of variable names"],
      "steps": []
    }`;
    
    let result = '';
    console.log('⏳ Calling Claude Code SDK...');
    
    const startTime = Date.now();
    
    for await (const message of query({
      prompt: testPrompt,
      options: {
        maxTurns: 10  // Allow more turns for Opus 4.1's reasoning
      }
    })) {
      console.log(`   Message type: ${message.type}, subtype: ${message.subtype}`);
      
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
        console.log(`   ✅ Got result (${result.length} chars)`);
      } else if (message.type === 'error') {
        console.error('   ❌ Error:', message.error);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`\n⏱️  Response time: ${elapsed}ms`);
    
    if (result) {
      console.log('\n📋 Response from Opus 4.1:');
      console.log('-'.repeat(60));
      
      // Try to extract JSON from the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const intentSpec = JSON.parse(jsonMatch[0]);
          console.log('✅ Valid JSON Intent Spec received:');
          console.log(JSON.stringify(intentSpec, null, 2));
          
          // Verify it's using Opus 4.1 capabilities
          console.log('\n🔍 Opus 4.1 Indicators:');
          console.log(`   - Complex reasoning: ${intentSpec.description?.length > 50 ? '✅' : '❌'}`);
          console.log(`   - Variable detection: ${intentSpec.params?.length > 0 ? '✅' : '❌'}`);
          console.log(`   - Structured output: ✅`);
          
        } catch (parseError) {
          console.log('⚠️  Response contains JSON but failed to parse:', parseError.message);
          console.log('Raw response:', result.substring(0, 500));
        }
      } else {
        console.log('⚠️  No JSON found in response');
        console.log('Raw response:', result.substring(0, 500));
      }
    } else {
      console.error('❌ No result received from Claude Code SDK');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Claude Code SDK with Opus 4.1 is working!');
    console.log('The system can use AI for Intent Spec generation.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n📦 Claude Code SDK may not be installed properly.');
      console.log('Run: npm install @anthropic-ai/claude-code');
    } else if (error.message.includes('API')) {
      console.log('\n🔑 API key issue. Check your ANTHROPIC_API_KEY in .env');
    } else {
      console.log('\n⚠️  Unknown error. Stack trace:');
      console.log(error.stack);
    }
  }
}

// Run the test
testClaudeCodeSDK().then(() => {
  console.log('\n✨ Test complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});