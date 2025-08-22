// Webview preload script for recording functionality
console.log('[WEBVIEW-PRELOAD] Loading recording preload script...');

// Check if we're in recording mode by looking for a flag set by main process
let isRecording = false;

// Initialize recording storage
window.__recordingData = {
  actions: [],
  inputs: {}
};

// Function to capture input values
function captureInput(element) {
  if (!element || !isRecording) return;
  
  const data = {
    type: 'input',
    timestamp: Date.now(),
    url: window.location.href,
    target: {
      tagName: element.tagName,
      id: element.id || '',
      name: element.name || '',
      type: element.type || '',
      placeholder: element.placeholder || '',
      value: element.value || '',
      className: element.className || ''
    }
  };
  
  // Store input value for later extraction
  const key = element.id || element.name || `input_${Date.now()}`;
  window.__recordingData.inputs[key] = {
    value: element.value,
    type: element.type,
    name: element.name,
    id: element.id,
    url: window.location.href
  };
  
  window.__recordingData.actions.push(data);
  console.log('[WEBVIEW-PRELOAD] Input captured:', key, '=', element.type === 'password' ? '***' : element.value);
}

// Set up event listeners when DOM is ready
function setupRecording() {
  console.log('[WEBVIEW-PRELOAD] Setting up recording on:', window.location.href);
  
  // Capture all input events
  document.addEventListener('input', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      captureInput(e.target);
    }
  }, true);
  
  // Capture change events (for select elements)
  document.addEventListener('change', function(e) {
    if (e.target) {
      captureInput(e.target);
    }
  }, true);
  
  // Capture form submissions
  document.addEventListener('submit', function(e) {
    if (!isRecording) return;
    
    const form = e.target;
    const formData = new FormData(form);
    const fields = {};
    
    for (let [key, value] of formData.entries()) {
      fields[key] = value;
      console.log('[WEBVIEW-PRELOAD] Form field:', key, '=', key.includes('password') ? '***' : value);
    }
    
    window.__recordingData.actions.push({
      type: 'submit',
      timestamp: Date.now(),
      url: window.location.href,
      formFields: fields,
      formAction: form.action,
      formMethod: form.method
    });
  }, true);
  
  // Capture clicks
  document.addEventListener('click', function(e) {
    if (!isRecording) return;
    
    window.__recordingData.actions.push({
      type: 'click',
      timestamp: Date.now(),
      url: window.location.href,
      target: {
        tagName: e.target.tagName,
        id: e.target.id || '',
        className: e.target.className || '',
        text: e.target.textContent ? e.target.textContent.substring(0, 100) : ''
      }
    });
  }, true);
}

// Listen for recording state changes from main process
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'RECORDING_STATE') {
    isRecording = event.data.isRecording;
    console.log('[WEBVIEW-PRELOAD] Recording state changed:', isRecording);
    
    if (isRecording && document.readyState !== 'loading') {
      setupRecording();
    }
  }
});

// Set up recording when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupRecording);
} else {
  setupRecording();
}

// Also set up on page navigation
window.addEventListener('load', setupRecording);

// Expose a way to get recording data
window.getRecordingData = function() {
  return window.__recordingData;
};

// Start in recording mode by default (will be controlled by main process)
isRecording = true;

console.log('[WEBVIEW-PRELOAD] Recording preload script loaded successfully');