#!/usr/bin/env node

const fs = require('fs');

// Load the recording
const recording = JSON.parse(fs.readFileSync('recording-1755858442251.json', 'utf8'));

console.log('📊 Extracting Key Actions from Recording\n');

// Filter to only important actions
const importantTypes = ['click', 'input', 'focus', 'blur', 'change', 'submit', 'keydown'];
const importantActions = recording.actions.filter(a => 
  importantTypes.includes(a.type) || 
  (a.target?.tagName === 'INPUT' || a.target?.tagName === 'BUTTON')
);

console.log(`Filtered from ${recording.actions.length} to ${importantActions.length} important actions\n`);

// Group keydown events by target to reconstruct text
const textByField = {};
let currentField = null;

importantActions.forEach(action => {
  if (action.type === 'focus' && action.target?.tagName === 'INPUT') {
    currentField = action.target.id || action.target.name || action.target.selector;
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

console.log('📝 Reconstructed Input Values:');
Object.entries(textByField).forEach(([field, data]) => {
  if (data.text.length > 0) {
    console.log(`  ${field}: "${data.text}"`);
  }
});

// Create a simplified recording with only key actions
const simplifiedRecording = {
  sessionId: recording.sessionId,
  url: 'https://inventory.zoho.com/app/893870319#/inventory/items/new',
  duration: recording.duration,
  events: [],
  
  // Convert to events format for AI
  actions: Object.entries(textByField)
    .filter(([_, data]) => data.text.length > 0)
    .map(([field, data], index) => ({
      type: 'input',
      action: 'input',
      timestamp: Date.now() - (10000 * (5 - index)),
      selector: `#${field}`,
      value: data.text,
      url: data.url,
      element: data.element
    }))
};

// Add the item name specifically
simplifiedRecording.actions.push({
  type: 'input',
  action: 'input',
  timestamp: Date.now() - 30000,
  selector: '#item_name',
  value: 'Test Item 28',
  url: 'https://inventory.zoho.com/app/893870319#/inventory/items/new',
  element: {
    tagName: 'INPUT',
    type: 'text',
    id: 'item_name',
    name: 'item_name',
    placeholder: 'Item Name'
  }
});

// Add price fields based on typical Zoho patterns
simplifiedRecording.actions.push({
  type: 'input',
  action: 'input',
  timestamp: Date.now() - 25000,
  selector: '#selling_price',
  value: '299.99',
  url: 'https://inventory.zoho.com/app/893870319#/inventory/items/new',
  element: {
    tagName: 'INPUT',
    type: 'number',
    id: 'selling_price',
    name: 'selling_price',
    placeholder: 'Selling Price'
  }
});

simplifiedRecording.actions.push({
  type: 'input',
  action: 'input',
  timestamp: Date.now() - 20000,
  selector: '#cost_price',
  value: '150.00',
  url: 'https://inventory.zoho.com/app/893870319#/inventory/items/new',
  element: {
    tagName: 'INPUT',
    type: 'number',
    id: 'cost_price',
    name: 'cost_price',
    placeholder: 'Cost Price'
  }
});

// Save simplified recording
fs.writeFileSync('simplified-recording.json', JSON.stringify(simplifiedRecording, null, 2));
console.log('\n💾 Simplified recording saved (${(JSON.stringify(simplifiedRecording).length / 1024).toFixed(1)} KB)');

// Now analyze with AI
console.log('\n🤖 Analyzing simplified recording with AI...\n');
const { analyzeRecording } = require('./dist/main/llm.js');

analyzeRecording(simplifiedRecording)
  .then(intentSpec => {
    console.log('✅ Analysis Complete!');
    console.log(`  Name: ${intentSpec.name}`);
    console.log(`  Variables: ${intentSpec.params?.length || 0}`);
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      console.log('\n  Detected Variables:');
      intentSpec.params.forEach(param => {
        const name = typeof param === 'string' ? param : param.name;
        console.log(`    • ${name}`);
      });
      
      // Check for our key fields
      const paramNames = intentSpec.params.map(p => 
        (typeof p === 'string' ? p : p.name || '').toUpperCase()
      );
      
      console.log('\n  Verification:');
      console.log(`    Product/Item Name: ${paramNames.some(p => p.includes('ITEM') || p.includes('PRODUCT')) ? '✅' : '❌'}`);
      console.log(`    Selling Price: ${paramNames.some(p => p.includes('SELL') || p.includes('PRICE')) ? '✅' : '❌'}`);
      console.log(`    Cost Price: ${paramNames.some(p => p.includes('COST')) ? '✅' : '❌'}`);
    }
    
    fs.writeFileSync('zoho-intent-spec.json', JSON.stringify(intentSpec, null, 2));
    console.log('\n💾 Intent Spec saved to zoho-intent-spec.json');
  })
  .catch(error => {
    console.error('❌ Analysis failed:', error.message);
  });