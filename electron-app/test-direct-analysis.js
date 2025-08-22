#!/usr/bin/env node

const fs = require('fs');

// Create a very simple test recording
const testRecording = {
  sessionId: 'test-session',
  startTime: Date.now() - 60000,
  endTime: Date.now(),
  duration: 60000,
  url: 'https://inventory.zoho.com',
  title: 'Zoho Inventory',
  
  // Just the key actions
  actions: [
    {
      type: 'click',
      target: { selector: '#add-item-button' },
      url: 'https://inventory.zoho.com/items'
    },
    {
      type: 'input',
      target: { 
        id: 'item_name',
        selector: '#item_name',
        placeholder: 'Item Name'
      },
      value: 'Test Item 1A',
      url: 'https://inventory.zoho.com/items/new'
    },
    {
      type: 'input',
      target: {
        id: 'selling_price',
        selector: '#selling_price',
        placeholder: 'Selling Price'
      },
      value: '1325',
      url: 'https://inventory.zoho.com/items/new'
    },
    {
      type: 'input',
      target: {
        id: 'cost_price',
        selector: '#cost_price',
        placeholder: 'Cost Price'
      },
      value: '1222',
      url: 'https://inventory.zoho.com/items/new'
    },
    {
      type: 'click',
      target: { selector: '#save-button' },
      url: 'https://inventory.zoho.com/items/new'
    }
  ],
  
  // Minimal DOM snapshot
  domSnapshots: [{
    timestamp: Date.now(),
    url: 'https://inventory.zoho.com/items/new',
    title: 'Add New Item',
    interactables: [
      { tagName: 'INPUT', id: 'item_name', placeholder: 'Item Name' },
      { tagName: 'INPUT', id: 'selling_price', placeholder: 'Selling Price' },
      { tagName: 'INPUT', id: 'cost_price', placeholder: 'Cost Price' },
      { tagName: 'BUTTON', id: 'save-button', text: 'Save' }
    ]
  }],
  
  // Empty arrays for other data
  mutations: [],
  networkRequests: [],
  consoleErrors: [],
  screenshots: []
};

console.log('Test recording size:', (JSON.stringify(testRecording).length / 1024).toFixed(1) + ' KB');

// Analyze with AI
console.log('\n🤖 Testing AI analysis with minimal data...\n');
const { analyzeRecording } = require('./dist/main/llm.js');

analyzeRecording(testRecording)
  .then(intentSpec => {
    console.log('✅ ANALYSIS SUCCESS!');
    console.log('=====================================\n');
    console.log('Intent Spec Name:', intentSpec.name);
    console.log('URL:', intentSpec.url);
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      console.log('\n🎯 DETECTED VARIABLES:');
      intentSpec.params.forEach(param => {
        const name = typeof param === 'string' ? param : param.name;
        console.log('  • ' + name);
      });
      
      // Check for expected fields
      const paramNames = intentSpec.params.map(p => 
        (typeof p === 'string' ? p : p.name || '').toUpperCase()
      );
      
      console.log('\n✅ FIELD VERIFICATION:');
      console.log('  Item Name:', paramNames.some(p => p.includes('ITEM') || p.includes('NAME')) ? '✅' : '❌');
      console.log('  Selling Price:', paramNames.some(p => p.includes('SELL') || p.includes('PRICE')) ? '✅' : '❌');
      console.log('  Cost Price:', paramNames.some(p => p.includes('COST')) ? '✅' : '❌');
    }
    
    fs.writeFileSync('test-intent-spec.json', JSON.stringify(intentSpec, null, 2));
    console.log('\n💾 Saved to test-intent-spec.json');
  })
  .catch(error => {
    console.error('❌ Analysis failed:', error.message);
    console.error('Stack:', error.stack);
  });