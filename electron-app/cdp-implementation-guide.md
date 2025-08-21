# CDP Implementation Guide

## Current CDP Analysis & Best Practices Implementation

This guide provides a comprehensive analysis of the current CDP (Chrome DevTools Protocol) implementation and demonstrates best practices for improvement.

## Current Implementation Analysis

### 1. **CDP Events Currently Used**

From `main-comprehensive.js`:

```javascript
// Enabled CDP domains
await webView.webContents.debugger.sendCommand('Page.enable');
await webView.webContents.debugger.sendCommand('Runtime.enable');
await webView.webContents.debugger.sendCommand('DOM.enable');
await webView.webContents.debugger.sendCommand('Network.enable');
await webView.webContents.debugger.sendCommand('Console.enable');
await webView.webContents.debugger.sendCommand('Performance.enable');

// Event listeners
webView.webContents.debugger.on('message', (event, method, params) => {
  if (method.startsWith('Network.')) {
    // Network event handling
  }
  if (method === 'Runtime.consoleAPICalled') {
    // Console logging
  }
  if (method.startsWith('Performance.')) {
    // Performance monitoring
  }
});
```

## Best Practices Implementation

### 1. **Enhanced Runtime.addBinding Usage**

**Current Issue:** The existing code doesn't use `Runtime.bindingCalled` effectively.

**Solution:** Implement persistent communication channel:

```javascript
// Setup persistent binding
await debugger.sendCommand('Runtime.addBinding', {
  name: 'sendToMainProcess'
});

// Listen for binding calls
debugger.on('message', (event, method, params) => {
  if (method === 'Runtime.bindingCalled' && params.name === 'sendToMainProcess') {
    const data = JSON.parse(params.payload);
    handleMainProcessMessage(data);
  }
});
```

**Injected Script Usage:**
```javascript
// From injected script
function sendToMainProcess(type, payload) {
  if (typeof window.sendToMainProcess === 'function') {
    const message = {
      type,
      tabId: context.tabId,
      sessionId: context.sessionId,
      timestamp: Date.now(),
      payload
    };
    window.sendToMainProcess(JSON.stringify(message));
  }
}
```

### 2. **Enhanced Page.addScriptToEvaluateOnNewDocument**

**Current Usage:**
```javascript
await webView.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
  source: comprehensiveScript
});
```

**Enhanced Usage with Context Persistence:**
```javascript
await debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
  source: persistentScriptWithContext,
  worldName: 'cdp_isolated' // Isolated execution context
});
```

**Script with Context Management:**
```javascript
const persistentScript = `
(function() {
  const CONTEXT_KEY = 'cdp_context_${sessionId}';
  
  // Restore context from sessionStorage
  let context = {};
  try {
    const saved = sessionStorage.getItem(CONTEXT_KEY);
    if (saved) {
      context = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to restore context:', e);
  }

  // Initialize context
  context.tabId = '${tabId}';
  context.sessionId = '${sessionId}';
  context.navigationCount = (context.navigationCount || 0) + 1;
  context.startTime = context.startTime || Date.now();

  // Save context function
  function saveContext() {
    try {
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch (e) {
      console.warn('Failed to save context:', e);
    }
  }

  // Your recording logic here...
})();
`;
```

### 3. **Maintaining Tab/Frame Context**

**Issue:** Context is lost across navigations and tab switches.

**Solution:** Implement comprehensive context management:

```javascript
class TabContextManager {
  constructor() {
    this.contexts = new Map();
  }

  // Store context per tab
  setTabContext(tabId, context) {
    this.contexts.set(tabId, {
      ...context,
      lastUpdated: Date.now()
    });
  }

  // Retrieve context with fallback
  getTabContext(tabId) {
    return this.contexts.get(tabId) || {
      tabId,
      created: Date.now(),
      navigationCount: 0,
      actions: []
    };
  }

  // Handle navigation while preserving context
  async handleNavigation(tabId, url) {
    const context = this.getTabContext(tabId);
    context.previousUrl = context.currentUrl;
    context.currentUrl = url;
    context.navigationCount++;
    context.lastNavigation = Date.now();
    
    this.setTabContext(tabId, context);
    
    // Re-inject script with preserved context
    await this.reinjectScript(tabId, context);
  }

  async reinjectScript(tabId, context) {
    const script = this.generateContextScript(tabId, context);
    await debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      worldName: 'cdp_isolated'
    });
  }
}
```

### 4. **Handling Navigation Events Properly**

**Enhanced Navigation Handling:**

```javascript
// Enable lifecycle events
await debugger.sendCommand('Page.setLifecycleEventsEnabled', { enabled: true });

// Listen for navigation events
debugger.on('message', (event, method, params) => {
  switch (method) {
    case 'Page.frameNavigated':
      handleFrameNavigation(params);
      break;
    case 'Page.domContentEventFired':
      handleDomReady(params);
      break;
    case 'Page.loadEventFired':
      handlePageLoad(params);
      break;
    case 'Page.frameStartedLoading':
      handleNavigationStart(params);
      break;
  }
});

function handleFrameNavigation(params) {
  const { frame } = params;
  const isMainFrame = !frame.parentId;
  
  if (isMainFrame) {
    console.log('Main frame navigated:', frame.url);
    
    // Update context
    const context = getTabContext(currentTabId);
    context.url = frame.url;
    context.navigationCount++;
    
    // Re-inject scripts after navigation
    setTimeout(() => {
      reinjectScriptsWithContext(currentTabId, context);
    }, 100);
  }
}
```

### 5. **Using Runtime.addBinding for Persistent Communication**

**Complete Implementation:**

```javascript
class PersistentCDPCommunication {
  async setup(webView, tabId, sessionId) {
    this.debugger = webView.webContents.debugger;
    
    // Add persistent binding
    await this.debugger.sendCommand('Runtime.addBinding', {
      name: 'communicateWithMain'
    });
    
    // Listen for binding calls
    this.debugger.on('message', (event, method, params) => {
      if (method === 'Runtime.bindingCalled' && params.name === 'communicateWithMain') {
        this.handleMessage(params);
      }
    });
    
    // Inject communication script
    await this.injectCommunicationScript(tabId, sessionId);
  }

  async injectCommunicationScript(tabId, sessionId) {
    const script = `
      (function() {
        // Persistent communication setup
        window.cdpContext = {
          tabId: '${tabId}',
          sessionId: '${sessionId}',
          messageId: 0
        };

        // Send message to main process
        function sendToMain(type, data) {
          window.cdpContext.messageId++;
          const message = {
            id: window.cdpContext.messageId,
            type: type,
            tabId: window.cdpContext.tabId,
            sessionId: window.cdpContext.sessionId,
            timestamp: Date.now(),
            data: data
          };
          
          window.communicateWithMain(JSON.stringify(message));
        }

        // Setup event listeners
        document.addEventListener('click', (e) => {
          sendToMain('user_click', {
            element: e.target.tagName,
            x: e.clientX,
            y: e.clientY
          });
        });

        // Navigation tracking
        const originalPushState = history.pushState;
        history.pushState = function() {
          originalPushState.apply(history, arguments);
          sendToMain('navigation', {
            type: 'pushState',
            url: window.location.href
          });
        };

        // Ready signal
        sendToMain('script_ready', {
          url: window.location.href,
          title: document.title
        });
      })();
    `;

    // Inject as persistent script
    await this.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: script,
      worldName: 'cdp_communication'
    });

    // Also inject into current page
    await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      worldName: 'cdp_communication'
    });
  }

  handleMessage(params) {
    try {
      const message = JSON.parse(params.payload);
      console.log('Received message:', message.type, message.data);
      
      switch (message.type) {
        case 'user_click':
          this.handleUserClick(message);
          break;
        case 'navigation':
          this.handleNavigation(message);
          break;
        case 'script_ready':
          this.handleScriptReady(message);
          break;
      }
    } catch (error) {
      console.error('Error handling CDP message:', error);
    }
  }
}
```

## Integration with Existing Code

### Step 1: Modify main-comprehensive.js

```javascript
// Add to the top of main-comprehensive.js
const { EnhancedCDPCommunication } = require('./cdp-best-practices-implementation');
const { EnhancedCDPRecordingManager } = require('./enhanced-main-process-integration');

// Initialize enhanced CDP manager
let enhancedCDPManager = null;

// Modify the existing start-enhanced-recording handler
ipcMain.handle('start-enhanced-recording', async () => {
  if (recordingActive) {
    return { success: false, error: 'Recording already active' };
  }
  
  // Initialize enhanced CDP if not already done
  if (!enhancedCDPManager) {
    enhancedCDPManager = new EnhancedCDPRecordingManager();
  }
  
  // Start enhanced recording with context preservation
  const result = await enhancedCDPManager.startEnhancedRecording(webView);
  
  if (result.success) {
    recordingActive = true;
    // Keep existing recording data structure
    recordingData = {
      // ... existing structure
      enhancedSession: result.sessionId,
      contextPreservation: true
    };
  }
  
  return result;
});
```

### Step 2: Add New IPC Handlers

```javascript
// Enhanced CDP-specific handlers
ipcMain.handle('start-enhanced-cdp-recording', async () => {
  if (!enhancedCDPManager) {
    enhancedCDPManager = new EnhancedCDPRecordingManager();
  }
  return await enhancedCDPManager.startEnhancedRecording(webView);
});

ipcMain.handle('stop-enhanced-cdp-recording', async () => {
  if (enhancedCDPManager) {
    return await enhancedCDPManager.stopEnhancedRecording();
  }
  return { success: false, error: 'No enhanced CDP manager' };
});

ipcMain.handle('enhanced-cdp-status', async () => {
  if (enhancedCDPManager) {
    return enhancedCDPManager.getStatus();
  }
  return { isRecording: false, hasActiveCDP: false };
});
```

### Step 3: Update preload.js

```javascript
// Add to preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  
  // Enhanced CDP APIs
  startEnhancedCDPRecording: () => ipcRenderer.invoke('start-enhanced-cdp-recording'),
  stopEnhancedCDPRecording: () => ipcRenderer.invoke('stop-enhanced-cdp-recording'),
  getEnhancedCDPStatus: () => ipcRenderer.invoke('enhanced-cdp-status'),
});
```

## Usage Examples

### 1. **Start Enhanced Recording with Context**

```javascript
// From renderer process
const result = await window.electronAPI.startEnhancedCDPRecording();

if (result.success) {
  console.log('Enhanced recording started:', result.sessionId);
  console.log('Tab ID:', result.tabId);
  
  // Monitor status
  const status = await window.electronAPI.getEnhancedCDPStatus();
  console.log('Recording status:', status);
}
```

### 2. **Handle Navigation Events**

```javascript
// The enhanced system automatically handles:
// - Page navigation while preserving context
// - Tab switches with context restoration
// - Frame navigation in SPAs
// - History API navigation (pushState/replaceState)

// Context is automatically preserved in sessionStorage
// and restored on each navigation/page load
```

### 3. **Stop Recording and Get Data**

```javascript
const result = await window.electronAPI.stopEnhancedCDPRecording();

if (result.success) {
  console.log('Recording stopped. Sessions:', result.sessions.length);
  
  result.sessions.forEach(session => {
    console.log('Session:', session.session.id);
    console.log('Actions recorded:', session.stats.totalActions);
    console.log('DOM mutations:', session.stats.totalDomMutations);
    console.log('Navigations:', session.stats.totalNavigations);
    console.log('Context preserved:', session.stats.contextPreserved);
  });
}
```

## Key Improvements

### 1. **Context Preservation**
- Session context persists across navigations
- Tab-specific context management
- Automatic context restoration

### 2. **Enhanced Communication**
- Bidirectional communication via Runtime.addBinding
- Message queuing and error handling
- Isolated execution contexts

### 3. **Better Navigation Handling**
- Comprehensive navigation event coverage
- Automatic script re-injection
- Context-aware navigation tracking

### 4. **Performance Optimization**
- Efficient event throttling
- Memory management
- Resource cleanup

### 5. **Error Resilience**
- Graceful degradation
- Error recovery mechanisms
- Comprehensive logging

## Testing

### Test Enhanced CDP Implementation

```javascript
// Run enhanced recording test
node examples/enhanced-recording-test.js

// Or use the interactive UI
// Load examples/enhanced-recording-example.html in the app
```

This implementation provides a robust, production-ready CDP integration that maintains context across navigations, handles tab switching properly, and provides efficient bidirectional communication between injected scripts and the main process.