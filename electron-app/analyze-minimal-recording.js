#!/usr/bin/env node

const fs = require('fs');

// Load the latest recording
const recordingFile = 'recording-1755859779314.json';
console.log('📊 Loading recording:', recordingFile);
const recording = JSON.parse(fs.readFileSync(recordingFile, 'utf8'));

console.log('Original size:', (JSON.stringify(recording).length / 1024 / 1024).toFixed(2) + ' MB');

// Create a minimal version optimized for AI analysis
const minimalRecording = {
  sessionId: recording.sessionId,
  startTime: recording.startTime,
  endTime: recording.endTime,
  duration: recording.duration,
  url: recording.url,
  title: recording.title,
  
  // Keep only critical action types
  actions: recording.actions.filter(a => {
    const criticalTypes = ['click', 'input', 'focus', 'blur', 'change', 'submit'];
    return criticalTypes.includes(a.type);
  }).map(a => ({
    type: a.type,
    timestamp: a.timestamp,
    target: a.target,
    url: a.url,
    value: a.value,
    key: a.key
  })),
  
  // Only 3 DOM snapshots: first, middle, last
  domSnapshots: [
    recording.domSnapshots[0],
    recording.domSnapshots[Math.floor(recording.domSnapshots.length / 2)],
    recording.domSnapshots[recording.domSnapshots.length - 1]
  ].filter(Boolean).map(snap => ({
    timestamp: snap.timestamp,
    url: snap.url,
    title: snap.title,
    // Only keep form-related interactables
    interactables: snap.interactables?.filter(el => 
      el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT'
    ).slice(0, 20),
    forms: snap.forms
  })),
  
  // Limit mutations to 50
  mutations: (recording.mutations || []).slice(0, 50).map(m => ({
    type: m.type,
    target: m.target,
    timestamp: m.timestamp
  })),
  
  // NO screenshots (base64 data)
  screenshots: [],
  
  // Network summary only - no body data
  networkRequests: (recording.network?.requests || []).slice(0, 30).map(r => ({
    url: r.url,
    method: r.method,
    status: r.status,
    type: r.type
  })),
  
  // Console errors only, first 10
  consoleErrors: (recording.console?.errors || []).slice(0, 10).map(e => ({
    message: e.message,
    timestamp: e.timestamp
  })),
  
  // Basic viewport info
  viewport: recording.viewport || { width: 1920, height: 1080 }
};

// Extract key input values from actions
console.log('\n📝 Extracting input values...');
const inputValues = {};
let lastFocusedField = null;

minimalRecording.actions.forEach(action => {
  if (action.type === 'focus' && action.target?.tagName === 'INPUT') {
    lastFocusedField = action.target.id || action.target.name || action.target.placeholder || 'field';
  }
  
  if (action.type === 'input' && action.target) {
    const fieldId = action.target.id || action.target.name || action.target.placeholder || lastFocusedField;
    if (fieldId) {
      inputValues[fieldId] = action.value || action.target.value || '';
      console.log(`  ${fieldId}: "${inputValues[fieldId]}"`);
    }
  }
});

// Add extracted values as events for clarity
minimalRecording.events = Object.entries(inputValues).map(([field, value]) => ({
  type: 'input',
  field: field,
  value: value
}));

console.log('\nMinimal size:', (JSON.stringify(minimalRecording).length / 1024 / 1024).toFixed(2) + ' MB');
console.log('Reductions:');
console.log('  Actions:', recording.actions.length, '→', minimalRecording.actions.length);
console.log('  DOM Snapshots:', recording.domSnapshots.length, '→', minimalRecording.domSnapshots.length);
console.log('  Mutations:', (recording.mutations || []).length, '→', minimalRecording.mutations.length);
console.log('  Network:', (recording.network?.requests || []).length, '→', minimalRecording.networkRequests.length);
console.log('  Screenshots removed (base64 data not needed for AI)');

// Save minimal recording
fs.writeFileSync('minimal-recording.json', JSON.stringify(minimalRecording, null, 2));
console.log('\n💾 Saved minimal recording to minimal-recording.json');

// Now analyze with AI
console.log('\n🤖 Analyzing with enhanced prompt...\n');
const { analyzeRecording } = require('./dist/main/llm.js');

analyzeRecording(minimalRecording)
  .then(intentSpec => {
    console.log('✅ ANALYSIS COMPLETE!');
    console.log('=====================================\n');
    console.log('Intent Spec Name:', intentSpec.name);
    console.log('URL:', intentSpec.url);
    console.log('Steps:', intentSpec.steps?.length || 0);
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      console.log('\n🎯 DETECTED VARIABLES (' + intentSpec.params.length + '):');
      console.log('-------------------------------------');
      intentSpec.params.forEach((param, i) => {
        const name = typeof param === 'string' ? param : param.name;
        console.log(`  ${i + 1}. ${name}`);
      });
      
      // Check for expected Zoho inventory fields
      const paramNames = intentSpec.params.map(p => 
        (typeof p === 'string' ? p : p.name || '').toUpperCase()
      );
      
      console.log('\n✅ FIELD VERIFICATION:');
      console.log('-------------------------------------');
      const checks = [
        { name: 'Product/Item Name', found: paramNames.some(p => p.includes('ITEM') || p.includes('PRODUCT') || p.includes('NAME')) },
        { name: 'Selling Price', found: paramNames.some(p => p.includes('SELL') || p.includes('PRICE') && !p.includes('COST')) },
        { name: 'Cost Price', found: paramNames.some(p => p.includes('COST')) },
        { name: 'SKU', found: paramNames.some(p => p.includes('SKU')) },
        { name: 'Quantity', found: paramNames.some(p => p.includes('QUANTITY') || p.includes('QTY')) }
      ];
      
      checks.forEach(check => {
        console.log(`  ${check.name}: ${check.found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      });
      
      const foundCount = checks.filter(c => c.found).length;
      console.log(`\n  Success Rate: ${foundCount}/${checks.length} fields detected`);
    } else {
      console.log('\n⚠️ WARNING: No variables detected!');
      console.log('This may indicate an issue with the recording or analysis.');
    }
    
    // Save the Intent Spec
    fs.writeFileSync('latest-intent-spec.json', JSON.stringify(intentSpec, null, 2));
    console.log('\n💾 Full Intent Spec saved to latest-intent-spec.json');
    
    // Show first few steps
    if (intentSpec.steps && intentSpec.steps.length > 0) {
      console.log('\n📋 First 3 Steps:');
      console.log('-------------------------------------');
      intentSpec.steps.slice(0, 3).forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.name || step.ai_instruction || 'Unnamed step'}`);
        if (step.value && step.value.includes('{{')) {
          console.log(`     Variable: ${step.value}`);
        }
      });
    }
  })
  .catch(error => {
    console.error('\n❌ ANALYSIS FAILED:', error.message);
    console.error('Error details:', error);
  });