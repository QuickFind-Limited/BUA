// Minimal test main file for Electron with enhanced recording
const { app, BrowserWindow, ipcMain, WebContentsView } = require('electron');
const path = require('path');

let mainWindow = null;
let webView = null;
let recordingActive = false;

// Enable CDP for recording
app.commandLine.appendSwitch('remote-debugging-port', '9335');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

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

  // Set bounds for the WebView (below the tab bar and respecting sidebar)
  const bounds = mainWindow.getContentBounds();
  const sidebarWidth = 300; // Default sidebar width
  webView.setBounds({
    x: sidebarWidth, // Start after the sidebar
    y: 88, // Height of tab bar + nav bar
    width: bounds.width - sidebarWidth,
    height: bounds.height - 88
  });

  // Load a default page in the WebView
  webView.webContents.loadURL('https://www.google.com');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window resize
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getContentBounds();
    const sidebarWidth = 300; // Keep consistent sidebar width
    webView.setBounds({
      x: sidebarWidth,
      y: 88,
      width: bounds.width - sidebarWidth,
      height: bounds.height - 88
    });
  });
  
  // Handle sidebar resize messages
  ipcMain.handle('sidebar:resize', async (event, width) => {
    const bounds = mainWindow.getContentBounds();
    webView.setBounds({
      x: width,
      y: 88,
      width: bounds.width - width,
      height: bounds.height - 88
    });
    console.log(`Sidebar resized to ${width}px`);
    return { success: true };
  });

  // Log for debugging
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Main window loaded');
    console.log('📍 CDP endpoint available at: http://127.0.0.1:9335');
    console.log('🌐 WebView loaded with Google');
  });
}

// IPC handler for the button click (matches what UI expects)
ipcMain.handle('start-enhanced-recording', async () => {
  if (recordingActive) {
    return { success: false, error: 'Recording already active' };
  }
  
  console.log('🎬 Starting enhanced recording...');
  console.log('  - CDP Port: 9335');
  console.log('  - WebView URL:', webView?.webContents.getURL());
  
  recordingActive = true;
  
  // Inject a simple recording indicator into the WebView
  if (webView) {
    webView.webContents.executeJavaScript(`
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
      \`;
      document.body.appendChild(indicator);
      console.log('Recording indicator added');
    `);
  }
  
  return { 
    success: true, 
    sessionId: `test-${Date.now()}`,
    message: 'Recording started (test mode)'
  };
});

// Alternative handler name (for compatibility)
ipcMain.handle('enhanced-recording:start', async () => {
  return ipcMain.emit('start-enhanced-recording');
});

ipcMain.handle('stop-enhanced-recording', async () => {
  if (!recordingActive) {
    return { success: false, error: 'No recording active' };
  }
  
  console.log('⏹️ Stopping enhanced recording...');
  recordingActive = false;
  
  // Remove recording indicator from WebView
  if (webView) {
    webView.webContents.executeJavaScript(`
      const indicator = document.getElementById('__recording_indicator');
      if (indicator) {
        indicator.remove();
        console.log('Recording indicator removed');
      }
    `);
  }
  
  // Return mock recording data for testing
  return {
    success: true,
    data: {
      sessionId: `test-${Date.now()}`,
      actions: [],
      domSnapshots: [],
      screenshots: [],
      duration: 0,
      message: 'Recording stopped (test mode - no data captured)'
    }
  };
});

// Alternative handler name
ipcMain.handle('enhanced-recording:stop', async () => {
  return ipcMain.emit('stop-enhanced-recording');
});

ipcMain.handle('enhanced-recording:status', async () => {
  return {
    isRecording: recordingActive,
    isPaused: false,
    mode: 'test'
  };
});

// Tab management handlers (minimal)
ipcMain.handle('tabs:create', async (event, url) => {
  console.log(`Creating tab: ${url}`);
  return {
    id: `tab-${Date.now()}`,
    url: url || 'https://www.google.com',
    title: 'New Tab',
    isActive: true
  };
});

ipcMain.handle('tabs:getAll', async () => {
  return [{
    id: 'tab-1',
    url: 'https://www.google.com',
    title: 'Google',
    isActive: true
  }];
});

app.whenReady().then(() => {
  createWindow();
  console.log('🚀 Electron app ready');
  console.log('📋 Enhanced recording test mode active');
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