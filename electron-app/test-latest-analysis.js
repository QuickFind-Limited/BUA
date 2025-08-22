#!/usr/bin/env node

const fs = require('fs');

// Get the latest recording
const recordingFile = 'recording-1755859779314.json';
console.log('📊 Testing with latest recording:', recordingFile);

// Check if minimal version exists
if (fs.existsSync('minimal-recording.json')) {
  const minimal = JSON.parse(fs.readFileSync('minimal-recording.json', 'utf8'));
  console.log('Using minimal version:', (JSON.stringify(minimal).length / 1024).toFixed(1) + ' KB');
  console.log('Actions:', minimal.actions?.length || 0);
  console.log('DOM Snapshots:', minimal.domSnapshots?.length || 0);
  console.log('Input events:', minimal.events?.length || 0);
  
  // Show what inputs were captured
  if (minimal.events && minimal.events.length > 0) {
    console.log('\nCaptured input fields:');
    minimal.events.forEach(event => {
      console.log(`  - ${event.field}: "${event.value}"`);
    });
  }
  
  // Test with minimal recording
  const { analyzeRecording } = require('./dist/main/llm.js');
  
  console.log('\n🤖 Starting AI analysis...\n');
  console.log('This may take 30-60 seconds...\n');
  
  const startTime = Date.now();
  
  analyzeRecording(minimal)
    .then(intentSpec => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log('\n✅ ANALYSIS SUCCESSFUL!');
      console.log(`Completed in ${duration} seconds`);
      console.log('=====================================');
      console.log('Intent Spec Name:', intentSpec.name);
      console.log('Description:', intentSpec.description);
      console.log('URL:', intentSpec.url);
      console.log('Steps:', intentSpec.steps?.length || 0);
      
      if (intentSpec.params && intentSpec.params.length > 0) {
        console.log('\n🎯 DETECTED VARIABLES (' + intentSpec.params.length + '):');
        intentSpec.params.forEach((param, i) => {
          const name = typeof param === 'string' ? param : param.name;
          console.log(`  ${i + 1}. ${name}`);
        });
        
        // Verify expected fields
        const paramNames = intentSpec.params.map(p => 
          (typeof p === 'string' ? p : p.name || '').toUpperCase()
        );
        
        console.log('\n✅ FIELD VERIFICATION:');
        const checks = [
          { 
            name: 'Item/Product Name', 
            found: paramNames.some(p => p.includes('ITEM') || p.includes('PRODUCT') || p.includes('NAME'))
          },
          { 
            name: 'Selling Price', 
            found: paramNames.some(p => p.includes('SELL') || (p.includes('PRICE') && !p.includes('COST')))
          },
          { 
            name: 'Cost Price', 
            found: paramNames.some(p => p.includes('COST'))
          }
        ];
        
        checks.forEach(check => {
          console.log(`  ${check.name}: ${check.found ? '✅ FOUND' : '❌ MISSING'}`);
        });
        
        const foundCount = checks.filter(c => c.found).length;
        console.log(`\nSuccess rate: ${foundCount}/${checks.length} expected fields detected`);
      } else {
        console.log('\n⚠️ WARNING: No variables detected!');
        console.log('This indicates the AI did not identify any parameterizable fields.');
      }
      
      // Show first few steps
      if (intentSpec.steps && intentSpec.steps.length > 0) {
        console.log('\n📋 First 3 Steps:');
        intentSpec.steps.slice(0, 3).forEach((step, i) => {
          console.log(`  ${i + 1}. ${step.name || step.ai_instruction || 'Unnamed step'}`);
          if (step.value && step.value.includes('{{')) {
            console.log(`     Variable: ${step.value}`);
          }
        });
      }
      
      // Save
      fs.writeFileSync('latest-analysis-result.json', JSON.stringify(intentSpec, null, 2));
      console.log('\n💾 Full Intent Spec saved to latest-analysis-result.json');
    })
    .catch(error => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n❌ Analysis failed after ${duration} seconds`);
      console.error('Error:', error.message);
      
      if (error.message.includes('ENAMETOOLONG')) {
        console.error('\n⚠️ Prompt is still too long. Need more aggressive reduction.');
        console.error('Current prompt size is likely over OS limits.');
      } else if (error.message.includes('timeout')) {
        console.error('\n⚠️ Analysis timed out. Claude Code SDK may be hanging.');
      } else {
        console.error('\nFull error:', error);
      }
      
      process.exit(1);
    });
} else {
  console.error('❌ Minimal recording not found.');
  console.error('Run: node analyze-minimal-recording.js first');
  process.exit(1);
}