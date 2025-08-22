#!/usr/bin/env node

const fs = require('fs');
const { generateBulletproofIntentSpecPrompt } = require('./dist/main/enhanced-prompt-generator.js');

// Load minimal recording
const minimal = JSON.parse(fs.readFileSync('minimal-recording.json', 'utf8'));

console.log('Generating enhanced prompt...\n');

// Generate the prompt
const prompt = generateBulletproofIntentSpecPrompt(minimal);

// Check size
console.log('Prompt statistics:');
console.log('  Total length:', prompt.length, 'characters');
console.log('  Size in KB:', (prompt.length / 1024).toFixed(1), 'KB');
console.log('  Line count:', prompt.split('\n').length);

// Save prompt to file for inspection
fs.writeFileSync('generated-prompt.txt', prompt);
console.log('\n💾 Full prompt saved to generated-prompt.txt');

// Check for problematic content
console.log('\nChecking for issues:');

// Check if it contains the actual JSON data
if (prompt.includes(JSON.stringify(minimal.actions))) {
  console.log('  ❌ Contains full actions JSON - too large!');
} else {
  console.log('  ✅ Actions are summarized');
}

if (prompt.includes(JSON.stringify(minimal.domSnapshots))) {
  console.log('  ❌ Contains full DOM snapshots JSON - too large!');
} else {
  console.log('  ✅ DOM snapshots are summarized');
}

// Extract just the data sections
const lines = prompt.split('\n');
console.log('\nPrompt structure:');

let inLargeSection = false;
let sectionStart = 0;
lines.forEach((line, i) => {
  if (line.includes('RECORDED EVENTS/ACTIONS')) {
    console.log(`  Line ${i}: ACTIONS section starts`);
    sectionStart = i;
  }
  if (line.includes('DOM SNAPSHOTS')) {
    if (sectionStart > 0) {
      console.log(`    Actions section: ${i - sectionStart} lines`);
    }
    console.log(`  Line ${i}: DOM SNAPSHOTS section starts`);
    sectionStart = i;
  }
  if (line.includes('NETWORK INSIGHTS')) {
    if (sectionStart > 0) {
      console.log(`    DOM section: ${i - sectionStart} lines`);
    }
    console.log(`  Line ${i}: NETWORK section starts`);
  }
});

// Show first part of prompt
console.log('\nFirst 500 characters of prompt:');
console.log('---');
console.log(prompt.substring(0, 500));
console.log('...');

// Show the actions section
const actionsMatch = prompt.match(/RECORDED EVENTS\/ACTIONS[\s\S]{0,1000}/);
if (actionsMatch) {
  console.log('\nActions section preview:');
  console.log('---');
  console.log(actionsMatch[0].substring(0, 500));
  console.log('...');
}