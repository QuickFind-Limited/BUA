const fs = require('fs');
const recording = JSON.parse(fs.readFileSync('recording-1755859779314.json', 'utf8'));

// Look at the raw input events
console.log('Checking input events in recording...\n');

const inputEvents = recording.actions.filter(a => a.type === 'input');
console.log('Total input events:', inputEvents.length);

if (inputEvents.length > 0) {
  console.log('\nFirst 3 input events:');
  inputEvents.slice(0, 3).forEach((event, i) => {
    console.log(`\nInput Event ${i + 1}:`);
    console.log('  Field ID:', event.target?.id);
    console.log('  Field Name:', event.target?.name);
    console.log('  Field Selector:', event.target?.selector);
    console.log('  Value in event:', event.value);
    console.log('  Value in target:', event.target?.value);
    console.log('  Has any value?:', Boolean(event.value || event.target?.value));
  });
}

// Check if there's a 'change' event that might have the final value
const changeEvents = recording.actions.filter(a => a.type === 'change');
console.log('\n\nChange events:', changeEvents.length);
if (changeEvents.length > 0) {
  console.log('\nChange events with values:');
  changeEvents.forEach((event, i) => {
    console.log(`\nChange Event ${i + 1}:`);
    console.log('  Field ID:', event.target?.id);
    console.log('  Field selector:', event.target?.selector);
    console.log('  Value:', event.value);
    console.log('  Target value:', event.target?.value);
    console.log('  Has value?:', Boolean(event.value || event.target?.value));
  });
}

// Check what CDP is supposed to capture
console.log('\n\n=== CDP Event Expectations ===');
console.log('CDP "input" events should fire when:');
console.log('  - Text is entered in an input field');
console.log('  - The event should include the current value');
console.log('\nCDP "change" events should fire when:');
console.log('  - Focus leaves the field (blur)');
console.log('  - Should contain the final value');

// Look for any events that DO have values
console.log('\n\n=== Looking for ANY events with values ===');
const eventsWithValues = recording.actions.filter(a => 
  a.value || a.target?.value
);
console.log('Events with values:', eventsWithValues.length);
if (eventsWithValues.length > 0) {
  console.log('\nFirst event with value:');
  const first = eventsWithValues[0];
  console.log('  Type:', first.type);
  console.log('  Value:', first.value || first.target?.value);
}