#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load the fresh recording
const recordingFile = 'recording-1755858442251.json';
const recording = JSON.parse(fs.readFileSync(recordingFile, 'utf8'));

console.log('📊 Fresh Recording Analysis');
console.log('===========================\n');

console.log('Basic Info:');
console.log(`  URL: ${recording.url}`);
console.log(`  Duration: ${(recording.duration / 1000).toFixed(1)}s`);
console.log(`  Actions: ${recording.actions?.length || 0}`);
console.log(`  DOM Snapshots: ${recording.domSnapshots?.length || 0}`);
console.log(`  Network Events: ${recording.networkEvents?.length || 0}`);
console.log(`  Console Events: ${recording.consoleEvents?.length || 0}`);

// Analyze action types
const actionTypes = {};
recording.actions?.forEach(action => {
  const type = action.type || action.action || 'unknown';
  actionTypes[type] = (actionTypes[type] || 0) + 1;
});

console.log('\nAction Types:');
Object.entries(actionTypes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

// Find input-related actions
console.log('\n🔍 Looking for Input Fields:');

// Check for keydown/keyup events that might contain values
const keyEvents = recording.actions?.filter(a => 
  (a.type === 'keydown' || a.type === 'keyup' || a.type === 'keypress') && 
  a.key && a.key.length === 1
) || [];

console.log(`  Key events: ${keyEvents.length}`);

// Build text from key events by target
const textByTarget = {};
keyEvents.forEach(event => {
  const targetId = event.target?.id || event.target?.name || event.target?.selector || 'unknown';
  if (!textByTarget[targetId]) {
    textByTarget[targetId] = {
      text: '',
      element: event.target,
      url: event.url
    };
  }
  if (event.type === 'keydown' && event.key && event.key.length === 1) {
    textByTarget[targetId].text += event.key;
  }
});

console.log('\n📝 Text Input Detected:');
Object.entries(textByTarget).forEach(([targetId, data]) => {
  if (data.text.length > 2) {  // Only show meaningful input
    console.log(`  Field: ${targetId}`);
    console.log(`    Value: "${data.text}"`);
    console.log(`    Element: ${data.element?.tagName} ${data.element?.type || ''}`);
    console.log(`    URL: ${data.url}`);
  }
});

// Look for focus/blur patterns that might indicate form fields
const focusEvents = recording.actions?.filter(a => a.type === 'focus') || [];
console.log(`\n🎯 Focus events (potential form fields): ${focusEvents.length}`);

focusEvents.slice(0, 5).forEach(event => {
  console.log(`  - ${event.target?.tagName} #${event.target?.id || 'no-id'} (${event.target?.type || 'unknown type'})`);
});

// Check DOM snapshots for form elements
console.log('\n📸 Checking DOM Snapshots for Form Fields:');
if (recording.domSnapshots && recording.domSnapshots.length > 0) {
  // Look at a middle snapshot (likely to have form visible)
  const midSnapshot = recording.domSnapshots[Math.floor(recording.domSnapshots.length / 2)];
  
  if (midSnapshot.visibleElements) {
    const inputs = midSnapshot.visibleElements.filter(el => 
      el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
    );
    console.log(`  Found ${inputs.length} input elements in snapshot`);
    inputs.slice(0, 10).forEach(input => {
      console.log(`    - ${input.tagName} #${input.id || 'no-id'} (${input.type || 'text'})`);
    });
  }
}

// Look for specific Zoho Inventory patterns
console.log('\n🏷️ Zoho Inventory Specific Patterns:');
const itemNameField = recording.actions?.find(a => 
  a.target?.id?.includes('item_name') || 
  a.target?.name?.includes('item_name') ||
  a.target?.placeholder?.includes('Item Name')
);
console.log(`  Item Name field: ${itemNameField ? 'Found' : 'Not found'}`);

const priceFields = recording.actions?.filter(a => 
  a.target?.id?.includes('price') || 
  a.target?.name?.includes('price') ||
  a.target?.placeholder?.includes('Price')
) || [];
console.log(`  Price fields found: ${priceFields.length}`);

// Save a summary for AI analysis
const summary = {
  url: recording.url,
  duration: recording.duration,
  actionCount: recording.actions?.length || 0,
  textInputs: Object.entries(textByTarget)
    .filter(([_, data]) => data.text.length > 2)
    .map(([targetId, data]) => ({
      field: targetId,
      value: data.text,
      element: data.element
    })),
  focusedFields: focusEvents.slice(0, 10).map(e => ({
    id: e.target?.id,
    type: e.target?.type,
    tagName: e.target?.tagName
  }))
};

fs.writeFileSync('recording-summary.json', JSON.stringify(summary, null, 2));
console.log('\n💾 Summary saved to recording-summary.json');

// Now let's analyze this with AI
console.log('\n🤖 Running AI Analysis...');
const { analyzeRecording } = require('./dist/main/llm.js');

analyzeRecording(recording)
  .then(intentSpec => {
    console.log('\n✅ AI Analysis Complete!');
    console.log(`  Intent Spec: ${intentSpec.name}`);
    console.log(`  Variables detected: ${intentSpec.params?.length || 0}`);
    
    if (intentSpec.params) {
      console.log('\n  Variables:');
      intentSpec.params.forEach(param => {
        const name = typeof param === 'string' ? param : param.name;
        console.log(`    • ${name}`);
      });
    }
    
    // Save the Intent Spec
    fs.writeFileSync('fresh-intent-spec.json', JSON.stringify(intentSpec, null, 2));
    console.log('\n💾 Intent Spec saved to fresh-intent-spec.json');
  })
  .catch(error => {
    console.error('\n❌ AI Analysis failed:', error.message);
  });