// Integrated main file with actual CDP recording
const { app, BrowserWindow, ipcMain, WebContentsView } = require('electron');
const path = require('path');

let mainWindow = null;
let webView = null;
let recordingActive = false;
let debuggerAttached = false;
let sidebarWidth = 320; // Track actual sidebar width
let recordingData = {
  actions: [],
  domSnapshots: [],
  network: [],
  console: [],
  startTime: null
};

// Enable CDP for recording
app.commandLine.appendSwitch('remote-debugging-port', '9335');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

function updateWebViewBounds() {
  if (!webView || !mainWindow) return;
  
  const bounds = mainWindow.getContentBounds();
  const navBarHeight = 88;
  
  // Calculate exact width to align with sidebar
  webView.setBounds({
    x: sidebarWidth,
    y: navBarHeight,
    width: bounds.width - sidebarWidth,
    height: bounds.height - navBarHeight
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the tab bar UI
  mainWindow.loadFile(path.join(__dirname, 'ui', 'tabbar.html'));

  // Create and add WebContentsView for the browser
  webView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Add the WebView to the window
  mainWindow.contentView.addChildView(webView);

  // Set initial bounds
  updateWebViewBounds();

  // Load a default page in the WebView
  webView.webContents.loadURL('https://www.google.com');

  // Setup WebView event listeners for recording
  setupRecordingListeners();

  mainWindow.on('closed', () => {
    mainWindow = null;
    webView = null;
  });

  // Handle window resize
  mainWindow.on('resize', () => {
    updateWebViewBounds();
  });
  
  // Handle sidebar resize
  ipcMain.handle('sidebar:resize', async (event, width) => {
    sidebarWidth = width;
    updateWebViewBounds();
    console.log(`Sidebar resized to ${width}px`);
    return { success: true };
  });

  // Log for debugging
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Main window loaded');
    console.log('📍 CDP endpoint available at: http://127.0.0.1:9335');
    console.log('🌐 WebView ready for recording');
  });
}

function setupRecordingListeners() {
  if (!webView) return;

  // Capture network requests
  webView.webContents.on('did-start-navigation', (event, url) => {
    if (recordingActive) {
      recordingData.network.push({
        type: 'navigation',
        url: url,
        timestamp: Date.now() - recordingData.startTime
      });
    }
  });

  // Capture console messages
  webView.webContents.on('console-message', (event, level, message) => {
    if (recordingActive && level === 2) { // Error level
      recordingData.console.push({
        level: 'error',
        message: message,
        timestamp: Date.now() - recordingData.startTime
      });
    }
  });
}

// Main recording handler
ipcMain.handle('start-enhanced-recording', async () => {
  if (recordingActive) {
    return { success: false, error: 'Recording already active' };
  }
  
  console.log('🎬 Starting CDP recording...');
  console.log('  - WebView URL:', webView?.webContents.getURL());
  
  recordingActive = true;
  recordingData = {
    actions: [],
    domSnapshots: [],
    network: [],
    console: [],
    startTime: Date.now()
  };

  // Attach debugger for persistent script injection
  if (webView && !debuggerAttached) {
    try {
      webView.webContents.debugger.attach('1.3');
      debuggerAttached = true;
      console.log('✅ Debugger attached');
      
      // Enable necessary CDP domains
      await webView.webContents.debugger.sendCommand('Page.enable');
      await webView.webContents.debugger.sendCommand('Runtime.enable');
      await webView.webContents.debugger.sendCommand('DOM.enable');
      
      // Add script that will persist across navigations
      const scriptSource = `
        // Initialize recording data structure
        if (!window.__recordingData) {
          window.__recordingData = {
            actions: [],
            domSnapshots: []
          };
        }
        
        // Add recording indicator
        if (!document.getElementById('__recording_indicator')) {
          const indicator = document.createElement('div');
          indicator.id = '__recording_indicator';
          indicator.innerHTML = '🔴 Recording...';
          indicator.style.cssText = \`
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 999999;
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            pointer-events: none;
          \`;
          if (document.body) {
            document.body.appendChild(indicator);
          } else {
            document.addEventListener('DOMContentLoaded', () => {
              document.body.appendChild(indicator);
            });
          }
        }
        
        // Capture user actions
        ['click', 'input', 'change', 'submit'].forEach(eventType => {
          document.addEventListener(eventType, (e) => {
            const target = e.target;
            if (target.id === '__recording_indicator') return;
            
            const action = {
              type: eventType,
              timestamp: Date.now(),
              target: {
                tagName: target.tagName,
                id: target.id,
                className: target.className,
                text: target.textContent?.substring(0, 100),
                value: target.value,
                selector: target.id ? '#' + target.id : 
                         target.className ? '.' + target.className.split(' ')[0] :
                         target.tagName.toLowerCase()
              },
              url: window.location.href
            };
            
            window.__recordingData.actions.push(action);
            console.log('CDP Action captured:', action);
          }, true);
        });
        
        // Capture DOM snapshots
        function captureSnapshot() {
          const snapshot = {
            timestamp: Date.now(),
            url: window.location.href,
            title: document.title,
            elementCount: document.querySelectorAll('*').length,
            forms: document.forms.length,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length,
            links: document.querySelectorAll('a').length
          };
          window.__recordingData.domSnapshots.push(snapshot);
          console.log('CDP DOM snapshot:', snapshot);
        }
        
        // Initial snapshot
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', captureSnapshot);
        } else {
          captureSnapshot();
        }
        
        // Periodic snapshots
        setInterval(captureSnapshot, 2000);
        
        console.log('CDP Recording script injected via debugger');
      `;
      
      await webView.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: scriptSource
      });
      
      console.log('📝 Script added to evaluate on new document');
      
      // Listen for debugger events
      webView.webContents.debugger.on('message', (event, method, params) => {
        if (recordingActive) {
          // Capture console messages
          if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
            recordingData.console.push({
              level: 'error',
              message: params.args?.[0]?.value || 'Unknown error',
              timestamp: Date.now() - recordingData.startTime
            });
          }
          
          // Capture network events
          if (method === 'Page.frameNavigated') {
            recordingData.network.push({
              type: 'navigation',
              url: params.frame.url,
              timestamp: Date.now() - recordingData.startTime
            });
          }
        }
      });
      
      // Also inject into current page
      await webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: scriptSource,
        userGesture: true
      });
      
      console.log('✅ Recording scripts injected and debugger listening');
      
    } catch (err) {
      console.error('Error attaching debugger:', err);
      debuggerAttached = false;
    }
  }

  
  return { 
    success: true, 
    sessionId: `recording-${Date.now()}`,
    message: 'CDP recording started'
  };
});

// Stop recording handler
ipcMain.handle('stop-enhanced-recording', async () => {
  if (!recordingActive) {
    return { success: false, error: 'No recording active' };
  }
  
  console.log('⏹️ Stopping CDP recording...');
  
  // Collect captured data from the page using debugger
  let pageData = { actions: [], domSnapshots: [] };
  if (webView && debuggerAttached) {
    try {
      // Evaluate in page context to get data
      const result = await webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          const data = window.__recordingData || { actions: [], domSnapshots: [] };
          
          // Remove recording indicator
          const indicator = document.getElementById('__recording_indicator');
          if (indicator) indicator.remove();
          
          console.log('Collected recording data:', data);
          
          // Return captured data
          JSON.stringify(data);
        `,
        returnByValue: true
      });
      
      if (result.result && result.result.value) {
        pageData = JSON.parse(result.result.value);
      }
      
      // Detach debugger after collecting data
      webView.webContents.debugger.detach();
      debuggerAttached = false;
      console.log('✅ Debugger detached');
      
    } catch (e) {
      console.error('Error collecting recording data:', e);
      // Try fallback method
      try {
        const fallbackData = await webView.webContents.executeJavaScript(`
          JSON.stringify(window.__recordingData || { actions: [], domSnapshots: [] })
        `);
        pageData = JSON.parse(fallbackData);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    }
  }
  
  // Combine all data
  const finalData = {
    sessionId: `recording-${recordingData.startTime}`,
    duration: Date.now() - recordingData.startTime,
    url: webView?.webContents.getURL(),
    actions: pageData.actions || [],
    domSnapshots: pageData.domSnapshots || [],
    network: recordingData.network,
    console: recordingData.console,
    stats: {
      totalActions: pageData.actions?.length || 0,
      totalSnapshots: pageData.domSnapshots?.length || 0,
      totalNetworkEvents: recordingData.network.length,
      totalConsoleErrors: recordingData.console.length
    }
  };
  
  recordingActive = false;
  console.log('📊 Recording summary:', finalData.stats);
  
  return {
    success: true,
    data: finalData
  };
});

// Status handler
ipcMain.handle('enhanced-recording:status', async () => {
  return {
    isRecording: recordingActive,
    isPaused: false,
    cdpPort: 9335,
    webViewUrl: webView?.webContents.getURL()
  };
});

// Tab management handlers
ipcMain.handle('tabs:create', async (event, url) => {
  if (webView) {
    webView.webContents.loadURL(url || 'https://www.google.com');
  }
  return {
    id: `tab-${Date.now()}`,
    url: url || 'https://www.google.com',
    title: 'Tab',
    isActive: true
  };
});

ipcMain.handle('tabs:getAll', async () => {
  return [{
    id: 'tab-1',
    url: webView?.webContents.getURL() || 'https://www.google.com',
    title: webView?.webContents.getTitle() || 'Google',
    isActive: true
  }];
});

// Navigation handlers
ipcMain.handle('tabs:navigate', async (event, tabId, url) => {
  if (webView) {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    await webView.webContents.loadURL(url);
    return true;
  }
  return false;
});

ipcMain.handle('tabs:goBack', async () => {
  if (webView && webView.webContents.canGoBack()) {
    webView.webContents.goBack();
    return true;
  }
  return false;
});

ipcMain.handle('tabs:goForward', async () => {
  if (webView && webView.webContents.canGoForward()) {
    webView.webContents.goForward();
    return true;
  }
  return false;
});

ipcMain.handle('tabs:reload', async () => {
  if (webView) {
    webView.webContents.reload();
    return true;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();
  console.log('🚀 Electron app ready with integrated CDP recording');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});