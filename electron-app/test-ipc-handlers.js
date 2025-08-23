const { ipcMain } = require('electron');

console.log('=== IPC Handler Test Script ===');
console.log('Testing IPC handler registration...\n');

// Get all registered IPC handlers
const handlers = ipcMain._invokeHandlers || {};
const handlerNames = Object.keys(handlers);

console.log(`Total handlers registered: ${handlerNames.length}`);
console.log('\nAll registered handlers:');
handlerNames.sort().forEach(name => {
    console.log(`  - ${name}`);
});

// Check specifically for our problematic handler
const problematicHandler = 'run-magnitude-webview';
if (handlerNames.includes(problematicHandler)) {
    console.log(`\n✅ Handler '${problematicHandler}' is registered`);
} else {
    console.log(`\n❌ Handler '${problematicHandler}' is NOT registered`);
}

// Check for related handlers
const relatedHandlers = handlerNames.filter(name => 
    name.includes('magnitude') || 
    name.includes('execute') || 
    name.includes('flow')
);

console.log('\nRelated handlers found:');
relatedHandlers.forEach(name => {
    console.log(`  - ${name}`);
});

console.log('\n=== End of Test ===');