// Integrated Multi-Tab Recording System
// Combines all the proper fixes for tab context attribution

const { app, BrowserWindow, ipcMain, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { RecordingEventCollector, EVENT_TYPES } = require('./recording-event-collector');

// Module-level variables
let mainWindow = null;
let webView = null;
let recordingCollector = null;
let debuggerAttached = false;
let sidebarWidth = 320;

// Track tabs and their URLs
const tabsData = new Map();

// CDP configuration
const CDP_PORT = 9335 + Math.floor(Math.random() * 100);
app.commandLine.appendSwitch('remote-debugging-port', String(CDP_PORT));
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Initialize recording collector
function initializeRecordingCollector() {
  recordingCollector = new RecordingEventCollector({
    recordingsDir: path.join(app.getPath('userData'), 'recordings'),
    enableDebugLogging: true,
    maxEventsPerSession: 10000,
    autoSaveInterval: 30000
  });
  
  console.log('✅ Recording collector initialized');
}

// Create main window
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.maximize();
  await mainWindow.loadFile(path.join(__dirname, 'ui', 'tabbar.html'));

  // Initialize WebView
  webView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.contentView.addChildView(webView);
  updateWebViewBounds();

  // Initialize recording collector
  initializeRecordingCollector();

  // Setup navigation handling for tab context
  setupNavigationHandling();

  // Load initial page
  webView.webContents.loadURL('https://www.google.com');
  
  // Initialize default tab
  const initialTabId = 'tab-initial';
  tabsData.set(initialTabId, {
    id: initialTabId,
    url: 'https://www.google.com',
    title: 'Google'
  });
  
  // Register initial tab with collector
  recordingCollector.registerTabContext(initialTabId, {
    url: 'https://www.google.com',
    title: 'Google',
    webContentsId: webView.webContents.id
  });

  console.log('📑 Initial tab created:', initialTabId);
}

// Setup navigation handling with proper tab context
function setupNavigationHandling() {
  webView.webContents.on('did-navigate', (event, url) => {
    const currentTabId = getCurrentTabId();
    console.log(`Navigation in tab ${currentTabId}: ${url}`);
    
    // Update tab data
    const tabData = tabsData.get(currentTabId);
    if (tabData) {
      tabData.url = url;
      recordingCollector.updateTabContext(currentTabId, { url });
    }
    
    // Handle recording context during navigation
    if (recordingCollector.hasActiveSession()) {
      recordingCollector.addNavigationEvent({
        type: 'did-navigate',
        url: url,
        timestamp: Date.now()
      }, currentTabId);
      
      // Re-inject recording script after navigation
      reinjectRecordingScript(currentTabId);
    }
  });

  webView.webContents.on('did-finish-load', () => {
    const currentTabId = getCurrentTabId();
    
    if (recordingCollector.hasActiveSession()) {
      // Capture DOM snapshot after page load
      captureDOMSnapshot(currentTabId, 'page-load');
    }
  });

  webView.webContents.on('page-title-updated', (event, title) => {
    const currentTabId = getCurrentTabId();
    const tabData = tabsData.get(currentTabId);
    if (tabData) {
      tabData.title = title;
      recordingCollector.updateTabContext(currentTabId, { title });
    }
  });
}

// Get current active tab ID
function getCurrentTabId() {
  // In real implementation, this would track the active tab
  // For now, return the most recently used tab
  return Array.from(tabsData.keys()).pop() || 'tab-initial';
}

// Update WebView bounds
function updateWebViewBounds() {
  if (!mainWindow || !webView) return;
  const bounds = mainWindow.getBounds();
  webView.setBounds({
    x: 0,
    y: 120, // Account for tab bar and navigation
    width: bounds.width - sidebarWidth,
    height: bounds.height - 180 // Account for status bar
  });
}

// Enhanced recording start with proper architecture
ipcMain.handle('start-enhanced-recording', async () => {
  try {
    const currentTabId = getCurrentTabId();
    const tabData = tabsData.get(currentTabId);
    
    if (!tabData) {
      return { success: false, error: 'No active tab found' };
    }
    
    // Start recording session in collector
    const sessionId = recordingCollector.startSession({
      url: tabData.url,
      title: tabData.title,
      tabId: currentTabId
    });
    
    console.log('🎬 Starting enhanced recording with proper tab context');
    console.log('  - Session ID:', sessionId);
    console.log('  - Tab ID:', currentTabId);
    console.log('  - URL:', tabData.url);
    
    // Attach debugger if not already attached
    if (!debuggerAttached) {
      webView.webContents.debugger.attach('1.3');
      debuggerAttached = true;
      
      // Enable necessary CDP domains
      await webView.webContents.debugger.sendCommand('Page.enable');
      await webView.webContents.debugger.sendCommand('Runtime.enable');
      await webView.webContents.debugger.sendCommand('DOM.enable');
      await webView.webContents.debugger.sendCommand('Network.enable');
      
      // Setup CDP binding for communication
      await webView.webContents.debugger.sendCommand('Runtime.addBinding', {
        name: 'sendToMainProcess'
      });
      
      console.log('✅ Debugger attached with CDP binding');
    }
    
    // Inject recording script with tab context
    await injectRecordingScript(currentTabId, sessionId);
    
    // Setup CDP event listeners
    setupCDPEventListeners(sessionId);
    
    // Initial DOM snapshot
    await captureDOMSnapshot(currentTabId, 'recording-start');
    
    // Start screenshot interval
    startScreenshotCapture(currentTabId, sessionId);
    
    return { success: true, sessionId };
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    return { success: false, error: error.message };
  }
});

// Inject recording script with proper tab context
async function injectRecordingScript(tabId, sessionId) {
  const script = await fs.readFile(
    path.join(__dirname, 'page-recording-script.js'),
    'utf8'
  );
  
  // Inject configuration with tab context
  const configScript = `
    window.__recordingConfig = {
      tabId: '${tabId}',
      sessionId: '${sessionId}',
      startTime: ${Date.now()}
    };
    ${script}
  `;
  
  // Inject script that persists across navigations
  await webView.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: configScript
  });
  
  // Also inject into current page
  await webView.webContents.executeJavaScript(configScript);
  
  console.log(`✅ Recording script injected for tab: ${tabId}`);
}

// Re-inject recording script after navigation
async function reinjectRecordingScript(tabId) {
  const activeSession = recordingCollector.getActiveSession();
  if (!activeSession) return;
  
  await injectRecordingScript(tabId, activeSession.sessionId);
}

// Setup CDP event listeners
function setupCDPEventListeners(sessionId) {
  webView.webContents.debugger.on('message', (event, method, params) => {
    const currentTabId = getCurrentTabId();
    
    // Handle Runtime.bindingCalled for direct communication
    if (method === 'Runtime.bindingCalled' && params.name === 'sendToMainProcess') {
      try {
        const payload = JSON.parse(params.payload);
        handleRecordingEvent(payload, currentTabId);
      } catch (error) {
        console.error('Failed to parse binding payload:', error);
      }
    }
    
    // Handle console messages (fallback)
    if (method === 'Runtime.consoleAPICalled') {
      const [type, data] = params.args || [];
      if (type?.value === 'page-recording:action') {
        handleRecordingEvent(data?.value, currentTabId);
      }
    }
    
    // Handle network events
    if (method.startsWith('Network.')) {
      recordingCollector.addNetworkEvent({
        method: method,
        params: params,
        timestamp: Date.now()
      }, currentTabId);
    }
  });
}

// Handle recording events from page
function handleRecordingEvent(event, tabId) {
  if (!event || !recordingCollector.hasActiveSession()) return;
  
  // Ensure tab context
  event.tabId = event.tabId || tabId;
  
  switch (event.type) {
    case 'action':
      recordingCollector.addAction(event.data, tabId);
      break;
    case 'domSnapshot':
      recordingCollector.addDOMSnapshot(event.data, tabId);
      break;
    case 'mutation':
      recordingCollector.addDOMMutation(event.data, tabId);
      break;
    case 'navigation':
      recordingCollector.addNavigationEvent(event.data, tabId);
      break;
    default:
      recordingCollector.addAction(event, tabId);
  }
}

// Capture DOM snapshot
async function captureDOMSnapshot(tabId, trigger = 'manual') {
  try {
    const snapshot = await webView.webContents.executeJavaScript(`
      (() => {
        const snapshot = {
          url: window.location.href,
          title: document.title,
          timestamp: Date.now(),
          trigger: '${trigger}',
          elements: {
            total: document.querySelectorAll('*').length,
            visible: Array.from(document.querySelectorAll('*')).filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }).length,
            interactive: document.querySelectorAll('button, a, input, select, textarea').length
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY
          }
        };
        return snapshot;
      })()
    `);
    
    recordingCollector.addDOMSnapshot(snapshot, tabId);
    console.log(`📸 DOM snapshot captured for tab: ${tabId}`);
    
  } catch (error) {
    console.error('Failed to capture DOM snapshot:', error);
  }
}

// Screenshot capture
let screenshotInterval = null;
function startScreenshotCapture(tabId, sessionId) {
  screenshotInterval = setInterval(async () => {
    if (!recordingCollector.hasActiveSession()) {
      clearInterval(screenshotInterval);
      return;
    }
    
    try {
      const screenshot = await webView.webContents.capturePage();
      const data = screenshot.toDataURL();
      
      recordingCollector.addScreenshot({
        data: data,
        timestamp: Date.now()
      }, tabId);
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
    }
  }, 2000); // Every 2 seconds
}

// Stop recording
ipcMain.handle('stop-enhanced-recording', async () => {
  try {
    const activeSession = recordingCollector.getActiveSession();
    if (!activeSession) {
      return { success: false, error: 'No active recording session' };
    }
    
    console.log('⏹️ Stopping recording...');
    
    // Clear intervals
    if (screenshotInterval) {
      clearInterval(screenshotInterval);
      screenshotInterval = null;
    }
    
    // Final DOM snapshot
    await captureDOMSnapshot(getCurrentTabId(), 'recording-end');
    
    // Stop session and get data
    const recordingData = await recordingCollector.stopSession(activeSession.sessionId);
    
    // Detach debugger
    if (debuggerAttached) {
      webView.webContents.debugger.detach();
      debuggerAttached = false;
    }
    
    // Save to file
    const timestamp = Date.now();
    const filename = `recording-${timestamp}.json`;
    const filepath = path.join(app.getPath('userData'), 'recordings', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(recordingData, null, 2));
    
    console.log(`💾 Recording saved to: ${filename}`);
    console.log('📊 Recording summary:', {
      totalActions: recordingData.actions?.length || 0,
      totalSnapshots: recordingData.domSnapshots?.length || 0,
      totalScreenshots: recordingData.screenshots?.length || 0,
      duration: recordingData.duration,
      tabs: Object.keys(recordingData.tabSessions || {})
    });
    
    return { success: true, data: recordingData, filename };
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    return { success: false, error: error.message };
  }
});

// Tab management handlers
ipcMain.handle('create-tab', async (event, url) => {
  const targetUrl = url || 'https://www.google.com';
  const tabId = `tab-${Date.now()}`;
  
  // Store tab data
  tabsData.set(tabId, {
    id: tabId,
    url: targetUrl,
    title: 'New Tab'
  });
  
  // Register with collector if recording
  if (recordingCollector.hasActiveSession()) {
    recordingCollector.registerTabContext(tabId, {
      url: targetUrl,
      title: 'New Tab',
      webContentsId: webView.webContents.id
    });
    
    recordingCollector.addAction({
      action: 'new-tab',
      tabId: tabId,
      url: targetUrl,
      timestamp: Date.now()
    }, tabId);
  }
  
  console.log(`Creating new tab: ${tabId}`);
  
  // Navigate to URL
  await webView.webContents.loadURL(targetUrl);
  
  // Update UI
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.webContents.send('tab-created', { id: tabId, url: targetUrl });
  }
  
  return tabId;
});

ipcMain.handle('switch-tab', async (event, tabId) => {
  console.log(`Switch to tab: ${tabId}`);
  
  const tabData = tabsData.get(tabId);
  if (tabData && webView) {
    // Track tab switch in recording
    if (recordingCollector.hasActiveSession()) {
      const previousTabId = getCurrentTabId();
      recordingCollector.addAction({
        action: 'tab-switch',
        from: previousTabId,
        to: tabId,
        timestamp: Date.now()
      }, tabId);
      
      // Re-inject recording script for new tab context
      await reinjectRecordingScript(tabId);
    }
    
    // Navigate to tab URL
    await webView.webContents.loadURL(tabData.url);
    return true;
  }
  
  return false;
});

// Initialize app
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = { recordingCollector };