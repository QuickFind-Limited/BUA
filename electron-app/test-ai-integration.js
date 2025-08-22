#!/usr/bin/env node

/**
 * Test script to verify AI integration for Intent Spec generation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Set environment to use AI
process.env.USE_AI_ANALYSIS = 'true';

async function testAIIntegration() {
  console.log('\n🚀 Testing AI Integration for Intent Spec Generation');
  console.log('=' .repeat(60));
  
  try {
    // Check if we have the necessary API keys
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env file not found. AI integration requires API keys.');
      console.log('\nTo enable AI analysis, create a .env file with:');
      console.log('ANTHROPIC_API_KEY=your-api-key-here');
      return;
    }
    
    // Load environment variables
    require('dotenv').config({ path: envPath });
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not found in .env file');
      console.log('\nAdd to your .env file:');
      console.log('ANTHROPIC_API_KEY=your-api-key-here');
      return;
    }
    
    console.log('✅ API key found');
    
    // Find the most recent recording
    const recordingsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Electron', 'recordings');
    const files = fs.readdirSync(recordingsDir)
      .filter(f => f.startsWith('recording-session-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(recordingsDir, f),
        mtime: fs.statSync(path.join(recordingsDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length === 0) {
      console.error('❌ No recordings found');
      return;
    }
    
    const recordingFile = files[0];
    console.log(`\n📁 Using recording: ${recordingFile.name}`);
    console.log(`   Modified: ${recordingFile.mtime.toLocaleString()}`);
    
    // Load recording data
    const recordingData = JSON.parse(fs.readFileSync(recordingFile.path, 'utf8'));
    console.log(`   Events: ${recordingData.events?.length || 0}`);
    
    // Test both AI and rule-based generation
    console.log('\n' + '='.repeat(60));
    console.log('1️⃣  Testing AI-Driven Generation');
    console.log('='.repeat(60));
    
    try {
      const { analyzeRecording } = require('./dist/main/llm.js');
      
      console.log('\n🤖 Calling Claude to analyze recording...');
      const startTime = Date.now();
      
      const aiIntentSpec = await analyzeRecording(recordingData);
      
      const aiTime = Date.now() - startTime;
      console.log(`✅ AI analysis completed in ${aiTime}ms`);
      
      console.log('\n📋 AI-Generated Intent Spec:');
      console.log(`   Name: ${aiIntentSpec.name}`);
      console.log(`   Description: ${aiIntentSpec.description || 'N/A'}`);
      console.log(`   URL: ${aiIntentSpec.url}`);
      console.log(`   Steps: ${aiIntentSpec.steps?.length || 0}`);
      console.log(`   Variables: ${aiIntentSpec.params?.join(', ') || 'None'}`);
      
      // Save AI result
      const aiOutputPath = path.join(recordingsDir, `ai-intent-spec-${Date.now()}.json`);
      fs.writeFileSync(aiOutputPath, JSON.stringify(aiIntentSpec, null, 2));
      console.log(`\n💾 AI Intent Spec saved to: ${aiOutputPath}`);
      
    } catch (aiError) {
      console.error('❌ AI generation failed:', aiError.message);
      console.log('\nThis might be because:');
      console.log('1. Invalid API key');
      console.log('2. Network issues');
      console.log('3. API rate limits');
      console.log('4. Claude Code CLI not installed');
    }
    
    // Test rule-based generation for comparison
    console.log('\n' + '='.repeat(60));
    console.log('2️⃣  Testing Rule-Based Generation (Fallback)');
    console.log('='.repeat(60));
    
    const { generateIntentSpecFromRichRecording } = require('./main/intent-spec-generator.js');
    
    console.log('\n📋 Using pattern matching and rules...');
    const ruleStartTime = Date.now();
    
    const ruleIntentSpec = generateIntentSpecFromRichRecording(recordingData);
    
    const ruleTime = Date.now() - ruleStartTime;
    console.log(`✅ Rule-based analysis completed in ${ruleTime}ms`);
    
    console.log('\n📋 Rule-Generated Intent Spec:');
    console.log(`   Name: ${ruleIntentSpec.name}`);
    console.log(`   Description: ${ruleIntentSpec.description || 'N/A'}`);
    console.log(`   URL: ${ruleIntentSpec.url}`);
    console.log(`   Steps: ${ruleIntentSpec.steps?.length || 0}`);
    console.log(`   Variables: ${ruleIntentSpec.params?.join(', ') || 'None'}`);
    
    // Save rule-based result
    const ruleOutputPath = path.join(recordingsDir, `rule-intent-spec-${Date.now()}.json`);
    fs.writeFileSync(ruleOutputPath, JSON.stringify(ruleIntentSpec, null, 2));
    console.log(`\n💾 Rule Intent Spec saved to: ${ruleOutputPath}`);
    
    // Compare results
    console.log('\n' + '='.repeat(60));
    console.log('📊 Comparison');
    console.log('='.repeat(60));
    console.log('\nSpeed:');
    console.log(`   AI: ${aiTime || 'N/A'}ms`);
    console.log(`   Rules: ${ruleTime}ms`);
    console.log(`   Difference: ${aiTime ? `AI is ${Math.round(aiTime/ruleTime)}x slower` : 'N/A'}`);
    
    console.log('\nQuality indicators:');
    console.log('   (Check the saved JSON files for detailed comparison)');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testAIIntegration().then(() => {
  console.log('\n✨ Test complete!\n');
}).catch(error => {
  console.error('\n❌ Test error:', error);
});