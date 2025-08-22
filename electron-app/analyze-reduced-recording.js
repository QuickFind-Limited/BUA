#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load the latest recording
const recordingFile = 'recording-1755859779314.json';
console.log('📊 Loading recording:', recordingFile);
const recording = JSON.parse(fs.readFileSync(recordingFile, 'utf8'));

console.log('Original size:', (JSON.stringify(recording).length / 1024 / 1024).toFixed(2) + ' MB');

// Create a reduced version with only essential data
const reducedRecording = {
  sessionId: recording.sessionId,
  startTime: recording.startTime,
  endTime: recording.endTime,
  duration: recording.duration,
  url: recording.url,
  title: recording.title,
  
  // Filter actions to only important types
  actions: recording.actions.filter(a => {
    const importantTypes = ['click', 'input', 'focus', 'blur', 'change', 'submit', 'keydown', 'load'];
    return importantTypes.includes(a.type) || 
           (a.target && (a.target.tagName === 'INPUT' || a.target.tagName === 'BUTTON'));
  }),
  
  // Keep only first and last DOM snapshots
  domSnapshots: [
    recording.domSnapshots[0],
    recording.domSnapshots[Math.floor(recording.domSnapshots.length / 2)],
    recording.domSnapshots[recording.domSnapshots.length - 1]
  ].filter(Boolean),
  
  // Limit mutations to first 100
  mutations: (recording.mutations || []).slice(0, 100),
  
  // Don't include screenshots in prompt (they're base64 encoded and huge)
  screenshots: [], // Empty for analysis
  
  // Include network summary only
  networkRequests: (recording.network?.requests || []).slice(0, 50).map(r => ({
    url: r.url,
    method: r.method,
    status: r.status
  })),
  
  // Include console errors only
  consoleErrors: (recording.console?.errors || []).slice(0, 20),
  
  // Keep viewport info
  viewport: recording.viewport
};

// Reconstruct text inputs from keydown events
const textByField = {};
let currentField = null;

reducedRecording.actions.forEach(action => {
  if (action.type === 'focus' && action.target?.tagName === 'INPUT') {
    currentField = action.target.id || action.target.name || 'field_' + Date.now();
    if (!textByField[currentField]) {
      textByField[currentField] = {
        text: '',
        element: action.target,
        url: action.url
      };
    }
  }
  
  if (action.type === 'keydown' && currentField && action.key && action.key.length === 1) {
    textByField[currentField].text += action.key;
  }
  
  if (action.type === 'blur') {
    currentField = null;
  }
});

// Add reconstructed input events
Object.entries(textByField).forEach(([field, data]) => {
  if (data.text.length > 0) {
    console.log(`  Found input: ${field} = "${data.text}"`);
    
    // Add as a clear input event
    reducedRecording.events = reducedRecording.events || [];
    reducedRecording.events.push({
      type: 'input',
      action: 'input',
      timestamp: Date.now(),
      selector: `#${field}`,
      value: data.text,
      url: data.url,
      element: data.element
    });
  }
});

console.log('Reduced size:', (JSON.stringify(reducedRecording).length / 1024 / 1024).toFixed(2) + ' MB');
console.log('Actions reduced from', recording.actions.length, 'to', reducedRecording.actions.length);

// Save reduced recording
fs.writeFileSync('reduced-recording.json', JSON.stringify(reducedRecording, null, 2));
console.log('💾 Saved reduced recording to reduced-recording.json');

// Now analyze with AI
console.log('\n🤖 Analyzing with enhanced prompt...\n');
const { analyzeRecording } = require('./dist/main/llm.js');

analyzeRecording(reducedRecording)
  .then(intentSpec => {
    console.log('✅ Analysis Complete!');
    console.log('  Name:', intentSpec.name);
    console.log('  URL:', intentSpec.url);
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      console.log('\n🎯 DETECTED VARIABLES (' + intentSpec.params.length + '):');
      intentSpec.params.forEach(param => {
        const name = typeof param === 'string' ? param : param.name;
        console.log('  • ' + name);
      });
      
      // Check for our key fields
      const paramNames = intentSpec.params.map(p => 
        (typeof p === 'string' ? p : p.name || '').toUpperCase()
      );
      
      console.log('\n✅ Verification:');
      console.log('  Product/Item Name:', paramNames.some(p => p.includes('ITEM') || p.includes('PRODUCT') || p.includes('NAME')) ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('  Selling Price:', paramNames.some(p => p.includes('SELL') || p.includes('PRICE')) ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('  Cost Price:', paramNames.some(p => p.includes('COST')) ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('  SKU:', paramNames.some(p => p.includes('SKU')) ? '✅ FOUND' : '❌ NOT FOUND');
    } else {
      console.log('\n⚠️ No variables detected');
    }
    
    fs.writeFileSync('latest-intent-spec.json', JSON.stringify(intentSpec, null, 2));
    console.log('\n💾 Intent Spec saved to latest-intent-spec.json');
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error.message);
  });