// Test script to verify recording is working
const testRecordingScript = `
(function() {
  console.log('🔍 TESTING RECORDING SETUP');
  
  // Check if recording object exists
  if (window.__comprehensiveRecording) {
    console.log('✅ Recording object exists');
    console.log('  - Actions count:', window.__comprehensiveRecording.actions.length);
    console.log('  - Actions:', JSON.stringify(window.__comprehensiveRecording.actions));
  } else {
    console.log('❌ Recording object NOT found');
  }
  
  // Check if event listeners are attached
  const hasClickListener = getEventListeners(document).click;
  const hasInputListener = getEventListeners(document).input;
  
  console.log('  - Click listener attached:', !!hasClickListener);
  console.log('  - Input listener attached:', !!hasInputListener);
  
  // Simulate a test click to verify capture
  console.log('🧪 Simulating test click...');
  const beforeCount = window.__comprehensiveRecording ? window.__comprehensiveRecording.actions.length : 0;
  
  // Create and dispatch a test click
  const testButton = document.createElement('button');
  testButton.id = 'test-recording-button';
  testButton.textContent = 'Test';
  document.body.appendChild(testButton);
  
  testButton.click();
  
  setTimeout(() => {
    const afterCount = window.__comprehensiveRecording ? window.__comprehensiveRecording.actions.length : 0;
    if (afterCount > beforeCount) {
      console.log('✅ Test click was captured!');
    } else {
      console.log('❌ Test click was NOT captured');
    }
    
    // Clean up
    testButton.remove();
    
    // Return diagnostic info
    return {
      recordingObjectExists: !!window.__comprehensiveRecording,
      actionsCount: window.__comprehensiveRecording ? window.__comprehensiveRecording.actions.length : 0,
      lastAction: window.__comprehensiveRecording && window.__comprehensiveRecording.actions.length > 0 
        ? window.__comprehensiveRecording.actions[window.__comprehensiveRecording.actions.length - 1]
        : null
    };
  }, 100);
})();
`;

module.exports = testRecordingScript;