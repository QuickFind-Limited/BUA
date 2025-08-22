#!/usr/bin/env node

const fs = require('fs');

// Load the latest recording
const recordingFile = 'recording-1755859779314.json';
console.log('📊 Examining recording:', recordingFile);
const recording = JSON.parse(fs.readFileSync(recordingFile, 'utf8'));

// Calculate sizes of different sections
function getSize(obj) {
  return JSON.stringify(obj).length;
}

function toMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

const totalSize = getSize(recording);
console.log('\n📏 TOTAL SIZE:', toMB(totalSize), 'MB');
console.log('================================\n');

// Analyze each major section
const sections = {
  'Basic Info (metadata)': {
    sessionId: recording.sessionId,
    startTime: recording.startTime,
    endTime: recording.endTime,
    duration: recording.duration,
    url: recording.url,
    title: recording.title,
    tabSwitches: recording.tabSwitches,
    tabsUsed: recording.tabsUsed
  },
  'Actions': recording.actions,
  'DOM Snapshots': recording.domSnapshots,
  'Mutations': recording.mutations,
  'Network': recording.network,
  'Console': recording.console,
  'Screenshots': recording.screenshots,
  'Visibility Changes': recording.visibilityChanges,
  'Viewport States': recording.viewportStates,
  'Performance': recording.performance,
  'Memory': recording.memory,
  'Stats': recording.stats
};

console.log('📦 Section Sizes:');
const sectionSizes = {};
for (const [name, data] of Object.entries(sections)) {
  const size = getSize(data || {});
  sectionSizes[name] = size;
  const percent = ((size / totalSize) * 100).toFixed(1);
  console.log(`  ${name}: ${toMB(size)} MB (${percent}%)`);
}

// Sort by size
console.log('\n🏆 Top 3 Largest Sections:');
const sorted = Object.entries(sectionSizes).sort((a, b) => b[1] - a[1]);
for (let i = 0; i < 3 && i < sorted.length; i++) {
  const [name, size] = sorted[i];
  console.log(`  ${i + 1}. ${name}: ${toMB(size)} MB`);
}

// Deep dive into the largest section
console.log('\n🔍 Deep Dive into Largest Section:');
const largestSection = sorted[0][0];
const largestData = sections[largestSection];

if (largestSection === 'Actions' && Array.isArray(largestData)) {
  console.log(`  Total actions: ${largestData.length}`);
  
  // Count action types
  const actionTypes = {};
  largestData.forEach(action => {
    const type = action.type || 'unknown';
    actionTypes[type] = (actionTypes[type] || 0) + 1;
  });
  
  console.log('  Action type breakdown:');
  Object.entries(actionTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([type, count]) => {
      console.log(`    - ${type}: ${count} (${(count / largestData.length * 100).toFixed(1)}%)`);
    });
    
  // Sample action to see structure
  console.log('\n  Sample action structure:');
  const sampleAction = largestData.find(a => a.type === 'click') || largestData[0];
  console.log('    Size of one action:', getSize(sampleAction), 'bytes');
  console.log('    Keys:', Object.keys(sampleAction).join(', '));
}

if (largestSection === 'Mutations' && Array.isArray(largestData)) {
  console.log(`  Total mutations: ${largestData.length}`);
  console.log('  Average mutation size:', Math.round(getSize(largestData) / largestData.length), 'bytes');
  
  // Sample mutation
  if (largestData.length > 0) {
    console.log('\n  Sample mutation structure:');
    console.log('    Keys:', Object.keys(largestData[0]).join(', '));
  }
}

if (largestSection === 'DOM Snapshots' && Array.isArray(largestData)) {
  console.log(`  Total snapshots: ${largestData.length}`);
  console.log('  Average snapshot size:', toMB(getSize(largestData) / largestData.length), 'MB');
  
  // Check what's in snapshots
  if (largestData.length > 0) {
    const snapshot = largestData[0];
    console.log('\n  Snapshot structure:');
    console.log('    Keys:', Object.keys(snapshot).join(', '));
    if (snapshot.visibleElements) {
      console.log('    Visible elements:', snapshot.visibleElements.length);
    }
    if (snapshot.html) {
      console.log('    HTML size:', toMB(snapshot.html.length), 'MB');
    }
  }
}

if (largestSection === 'Screenshots' && Array.isArray(largestData)) {
  console.log(`  Total screenshots: ${largestData.length}`);
  largestData.forEach((screenshot, i) => {
    const size = getSize(screenshot);
    console.log(`    Screenshot ${i + 1}: ${toMB(size)} MB (${screenshot.type || 'unknown'})`);
  });
}

// Check for base64 encoded data
console.log('\n🔎 Checking for Base64 encoded data:');
const jsonString = JSON.stringify(recording);
const base64Pattern = /data:image\/[^;]+;base64,[A-Za-z0-9+/]+=*/g;
const base64Matches = jsonString.match(base64Pattern) || [];
console.log(`  Found ${base64Matches.length} base64 encoded images`);

if (base64Matches.length > 0) {
  // Estimate size of base64 data
  let base64TotalSize = 0;
  base64Matches.forEach(match => {
    base64TotalSize += match.length;
  });
  console.log(`  Total base64 data: ${toMB(base64TotalSize)} MB (${(base64TotalSize / totalSize * 100).toFixed(1)}%)`);
}

// Recommendations
console.log('\n💡 Recommendations to reduce size:');
if (sorted[0][0] === 'Mutations') {
  console.log('  - Mutations are the largest section. Consider limiting to first 100-200 mutations');
}
if (sorted[0][0] === 'Actions') {
  console.log('  - Actions are the largest section. Filter to only important action types');
  console.log('    (click, input, focus, submit) and skip mousemove/mouseenter/mouseleave');
}
if (sorted[0][0] === 'DOM Snapshots') {
  console.log('  - DOM Snapshots are huge. Keep only first, middle, and last snapshot');
}
if (sorted[0][0] === 'Screenshots') {
  console.log('  - Screenshots contain base64 data. Exclude from AI analysis prompt');
}
if (base64Matches.length > 0) {
  console.log('  - Remove all base64 encoded images from the data sent to AI');
}