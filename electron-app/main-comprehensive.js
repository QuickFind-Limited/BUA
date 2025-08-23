// Comprehensive recording with aggressive data capture
const { app, BrowserWindow, ipcMain, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables
require('dotenv').config();
if (process.env.ANTHROPIC_API_KEY) {
  console.log('ANTHROPIC_API_KEY loaded successfully');
} else {
  console.warn('⚠️ ANTHROPIC_API_KEY not found in environment');
}

// Clean up old session directories on startup
async function cleanupOldSessions() {
  try {
    const userDataBase = app.getPath('userData');
    const files = await fs.readdir(userDataBase);
    const sessionDirs = files.filter(f => f.startsWith('session-'));
    
    // Delete session directories older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const dir of sessionDirs) {
      const dirPath = path.join(userDataBase, dir);
      try {
        const stats = await fs.stat(dirPath);
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.rm(dirPath, { recursive: true, force: true });
          console.log(`🗑️ Cleaned up old session: ${dir}`);
        }
      } catch (e) {
        // Ignore errors for individual directories
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

let mainWindow = null;
let webView = null;
let recordingActive = false;
let debuggerAttached = false;
let sidebarWidth = 320;
let comprehensiveScript = ''; // Store the script at module level

// Track tabs and their URLs
const tabsData = new Map();

// Comprehensive recording data structure
let recordingData = {
  // Core actions
  actions: [],
  
  // DOM data
  domSnapshots: [],
  domMutations: [],
  visibilityChanges: [],
  
  // Network
  network: {
    requests: [],
    responses: [],
    failures: [],
    timing: []
  },
  
  // Console
  console: {
    logs: [],
    errors: [],
    warnings: [],
    info: []
  },
  
  // Visual
  screenshots: [],
  viewportStates: [],
  
  // Performance
  performance: [],
  memory: [],
  
  // Metadata
  startTime: null,
  endTime: null,
  url: null,
  title: null
};

// Enable CDP for recording - use dynamic port to avoid conflicts
const CDP_PORT = 9335 + Math.floor(Math.random() * 100); // Random port between 9335-9435
app.commandLine.appendSwitch('remote-debugging-port', String(CDP_PORT));

// Enable CDP for recording
app.commandLine.appendSwitch('remote-debugging-port', String(CDP_PORT));
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Use incognito-like session to avoid sign-in persistence
const userDataPath = path.join(app.getPath('temp'), `chrome-session-${Date.now()}`);
app.setPath('userData', userDataPath);

function updateWebViewBounds() {
  if (!webView || !mainWindow) return;
  
  const bounds = mainWindow.getContentBounds();
  const navBarHeight = 88;
  
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
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'tabbar.html'));
  
  // Maximize and show the window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Use incognito-like session without persistence
  // This prevents Google from tracking sign-in state
  const sessionPartition = `session-${Date.now()}`;
  
  webView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'webview-preload.js'), // Add preload script for recording
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: sessionPartition, // Non-persistent session (no 'persist:' prefix)
      webSecurity: false,
      // Additional privacy settings
      webgl: false,
      plugins: false,
      images: true,
      javascript: true
    }
  });

  mainWindow.contentView.addChildView(webView);
  updateWebViewBounds();
  
  
  // Load Google
  webView.webContents.loadURL('https://www.google.com');
  
  // Inject CSS to hide sign-in prompts when page loads
  webView.webContents.on('dom-ready', () => {
    webView.webContents.insertCSS(`
      /* Hide Google sign-in prompts */
      div[jsname="V67aGc"], /* Sign in popup */
      div[aria-label*="Sign in"],
      div[role="dialog"][aria-label*="Sign in"],
      .gb_Kd, /* Sign in button */
      .gb_4, /* Sign in button container */
      .gb_3, /* Account button */
      div[data-ogsr-up],
      div[jscontroller][data-ved][jsaction*="dismiss"] {
        display: none !important;
      }
    `);
  });
  
  setupRecordingListeners();

  // Initialize default tab in the UI
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Main window loaded, initializing default tab');
    
    // Store the initial tab with a consistent ID
    const initialTabId = 'tab-initial';
    tabsData.set(initialTabId, { 
      id: initialTabId, 
      url: 'https://www.google.com/webhp?hl=en&gl=us&authuser=0&pws=0&gws_rd=cr',
      title: 'Google'
    });
    console.log(`📍 CDP endpoint available at: http://127.0.0.1:${CDP_PORT}`);
    console.log(`📁 User data directory: ${userDataPath}`);
    console.log(`📑 Initial tab created: ${initialTabId}`);
    
    // Send initial tab info to renderer
    mainWindow.webContents.executeJavaScript(`
      // Create initial tab
      if (typeof initializeDefaultTab === 'function') {
        initializeDefaultTab('https://www.google.com', 'Google');
      } else {
        // Fallback: manually create tab with same ID as main process
        const tabId = 'tab-initial';
        const tab = {
          id: tabId,
          title: 'Google',
          url: 'https://www.google.com',
          active: true
        };
        
        if (typeof tabs !== 'undefined') {
          tabs.set(tabId, tab);
          activeTabId = tabId;
        }
        
        // Add tab to UI
        const tabsContainer = document.getElementById('tabs-container');
        if (tabsContainer) {
          const tabElement = document.createElement('div');
          tabElement.className = 'tab active';
          tabElement.dataset.tabId = tabId;
          tabElement.innerHTML = \`
            <span class="tab-title">Google</span>
            <button class="tab-close" onclick="closeTab('\${tabId}')">×</button>
          \`;
          
          // Add click handler for tab switching
          tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
              if (typeof switchToTab === 'function') {
                switchToTab(tabId);
              }
            }
          });
          
          const newTabBtn = document.getElementById('new-tab-btn');
          if (newTabBtn && newTabBtn.parentNode === tabsContainer) {
            tabsContainer.insertBefore(tabElement, newTabBtn);
          }
        }
        
        // Update address bar
        const addressBar = document.getElementById('address-bar');
        if (addressBar) {
          addressBar.value = 'https://www.google.com';
        }
      }
      
      console.log('Default tab initialized');
    `);
  });

  // Update WebView navigation state
  webView.webContents.on('did-navigate', (event, url) => {
    console.log('WebView navigated to:', url);
    
    // Update the current tab's URL in our tracking
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        typeof activeTabId !== 'undefined' ? activeTabId : null
      `).then(activeTabId => {
        if (activeTabId && tabsData.has(activeTabId)) {
          const tabData = tabsData.get(activeTabId);
          tabData.url = url;
          console.log(`Updated tab ${activeTabId} URL to: ${url}`);
        }
      });
      
      // Send navigation state update
      mainWindow.webContents.send('navigation-update', {
        canGoBack: webView.webContents.canGoBack(),
        canGoForward: webView.webContents.canGoForward()
      });
    }
    // Update the tab UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        // Update active tab URL and title
        if (typeof activeTabId !== 'undefined' && activeTabId) {
          const tab = tabs.get(activeTabId);
          if (tab) {
            tab.url = '${url}';
            tab.title = '${webView.webContents.getTitle() || 'Loading...'}';
            
            // Update tab title in UI
            const tabElement = document.querySelector(\`.tab[data-tab-id="\${activeTabId}"] .tab-title\`);
            if (tabElement) {
              tabElement.textContent = tab.title;
            }
            
            // Update address bar
            const addressBar = document.getElementById('address-bar');
            if (addressBar) {
              addressBar.value = '${url}';
            }
          }
        }
      `);
    }
  });

  webView.webContents.on('page-title-updated', (event, title) => {
    console.log('Page title updated:', title);
    // Update the tab title
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        if (typeof activeTabId !== 'undefined' && activeTabId) {
          const tab = tabs.get(activeTabId);
          if (tab) {
            tab.title = '${title}';
            
            // Update tab title in UI
            const tabElement = document.querySelector(\`.tab[data-tab-id="\${activeTabId}"] .tab-title\`);
            if (tabElement) {
              tabElement.textContent = '${title}';
            }
          }
        }
      `);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    webView = null;
  });

  mainWindow.on('resize', () => {
    updateWebViewBounds();
  });
  
  ipcMain.handle('sidebar:resize', async (event, width) => {
    sidebarWidth = width;
    updateWebViewBounds();
    return { success: true };
  });
}

function setupRecordingListeners() {
  if (!webView) return;

  // Comprehensive network capture
  webView.webContents.on('did-start-navigation', (event, url) => {
    if (recordingActive) {
      recordingData.network.requests.push({
        type: 'navigation',
        url: url,
        timestamp: Date.now() - recordingData.startTime
      });
    }
  });

  webView.webContents.on('did-finish-load', () => {
    // Re-inject recording script after navigation
    if (recordingActive && debuggerAttached) {
      const currentTab = recordingData.currentTabId || 'tab-initial';
      const currentUrl = webView.webContents.getURL();
      console.log(`🔄 Re-injecting recording script for tab: ${currentTab} at ${currentUrl}`);
      
      // Check if comprehensiveScript is defined
      if (!comprehensiveScript || comprehensiveScript === '') {
        console.error('❌ Recording script not available for re-injection');
        // Try to inject a minimal capture script instead
        const minimalScript = `
          (function() {
            if (window.__recordingActive) return;
            window.__recordingActive = true;
            
            window.__comprehensiveRecording = window.__comprehensiveRecording || {
              actions: [],
              domSnapshots: [],
              mutations: [],
              visibilityChanges: [],
              capturedInputs: {}
            };
            
            console.log('[MINIMAL-SCRIPT] Recording script injecting on:', window.location.href);
            
            // Helper to identify login-related fields
            function isLoginField(element) {
              if (!element) return false;
              const name = (element.name || '').toLowerCase();
              const id = (element.id || '').toLowerCase();
              const type = (element.type || '').toLowerCase();
              const placeholder = (element.placeholder || '').toLowerCase();
              const autocomplete = (element.autocomplete || '').toLowerCase();
              
              // Check for password fields
              if (type === 'password') return true;
              if (name.includes('pass') || id.includes('pass')) return true;
              
              // Check for username/email fields
              if (type === 'email') return true;
              if (autocomplete.includes('username') || autocomplete.includes('email')) return true;
              if (name.includes('user') || name.includes('email') || name.includes('login')) return true;
              if (id.includes('user') || id.includes('email') || id.includes('login')) return true;
              if (placeholder.includes('user') || placeholder.includes('email') || placeholder.includes('username')) return true;
              
              // Specific field IDs/names that are commonly used for login
              if (id === 'login_id' || name === 'login_id') return true;
              if (id === 'username' || name === 'username') return true;
              if (id === 'email' || name === 'email') return true;
              
              return false;
            }
            
            // Capture form inputs with focus on login fields
            document.addEventListener('input', function(e) {
              if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                const isLogin = isLoginField(e.target);
                const fieldKey = e.target.name || e.target.id || 'field_' + Date.now();
                
                const actionData = {
                  type: 'input',
                  timestamp: Date.now(),
                  target: {
                    tagName: e.target.tagName,
                    id: e.target.id,
                    name: e.target.name,
                    type: e.target.type,
                    value: e.target.value,
                    placeholder: e.target.placeholder,
                    autocomplete: e.target.autocomplete,
                    isLoginField: isLogin
                  },
                  url: window.location.href
                };
                
                window.__comprehensiveRecording.actions.push(actionData);
                window.__comprehensiveRecording.capturedInputs[fieldKey] = actionData.target;
                
                // CRITICAL: Send data immediately to main process via console
                const dataToSend = {
                  type: 'input',
                  field: fieldKey,
                  value: e.target.value,
                  inputType: e.target.type,
                  url: window.location.href,
                  isLoginField: isLogin
                };
                console.log('[RECORDER-DATA]' + JSON.stringify(dataToSend));
                
                console.log('[MINIMAL-SCRIPT] Input captured:', 
                  fieldKey, '=', 
                  e.target.type === 'password' ? '***' : e.target.value,
                  isLogin ? '(LOGIN FIELD)' : ''
                );
              }
            }, true);
            
            // Also capture on change events
            document.addEventListener('change', function(e) {
              if (e.target && e.target.tagName === 'INPUT') {
                const isLogin = isLoginField(e.target);
                const fieldKey = e.target.name || e.target.id || 'field_' + Date.now();
                
                window.__comprehensiveRecording.capturedInputs[fieldKey] = {
                  tagName: e.target.tagName,
                  id: e.target.id,
                  name: e.target.name,
                  type: e.target.type,
                  value: e.target.value,
                  isLoginField: isLogin
                };
                
                console.log('[MINIMAL-SCRIPT] Change captured:', fieldKey, 
                  isLogin ? '(LOGIN FIELD)' : ''
                );
              }
            }, true);
            
            // Capture form submissions
            document.addEventListener('submit', function(e) {
              const form = e.target;
              const formData = {};
              const inputs = form.querySelectorAll('input, textarea, select');
              
              inputs.forEach(input => {
                const key = input.name || input.id || input.type;
                formData[key] = input.value;
              });
              
              window.__comprehensiveRecording.actions.push({
                type: 'submit',
                timestamp: Date.now(),
                formData: formData,
                formAction: form.action,
                formMethod: form.method,
                url: window.location.href
              });
              
              console.log('[MINIMAL-SCRIPT] Form submission captured with', Object.keys(formData).length, 'fields');
            }, true);
            
            // Capture clicks
            document.addEventListener('click', function(e) {
              window.__comprehensiveRecording.actions.push({
                type: 'click', 
                timestamp: Date.now(),
                target: {
                  tagName: e.target.tagName,
                  id: e.target.id,
                  className: e.target.className,
                  text: e.target.textContent?.substring(0, 100)
                },
                url: window.location.href
              });
            }, true);
            
            console.log('[MINIMAL-SCRIPT] Recording script ready on:', window.location.href);
          })();
        `;
        
        webView.webContents.debugger.sendCommand('Runtime.evaluate', {
          expression: minimalScript,
          userGesture: true
        }).then(() => {
          console.log('✅ Minimal recording script injected as fallback');
        }).catch(err => {
          console.error('Failed to inject even minimal script:', err);
        });
        return;
      }
      
      // Re-inject the comprehensive script via debugger
      webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: comprehensiveScript,
        userGesture: true
      }).then(() => {
        // Update tab context
        return webView.webContents.debugger.sendCommand('Runtime.evaluate', {
          expression: `
            if (window.__comprehensiveRecording) {
              window.__comprehensiveRecording.currentTabId = '${currentTab}';
              window.__comprehensiveRecording.currentUrl = window.location.href;
              console.log('Recording context updated for tab:', '${currentTab}');
            }
          `
        });
      }).catch(err => {
        console.error('Failed to re-inject recording script:', err);
      });
    }
    
    if (recordingActive) {
      capturePageState();
    }
  });

  // Console capture - ALL levels
  webView.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (recordingActive) {
      const logEntry = {
        level: ['log', 'warning', 'error', 'info'][level] || 'unknown',
        message: message,
        line: line,
        source: sourceId,
        timestamp: Date.now() - recordingData.startTime
      };
      
      if (level === 0) recordingData.console.logs.push(logEntry);
      else if (level === 1) recordingData.console.warnings.push(logEntry);
      else if (level === 2) recordingData.console.errors.push(logEntry);
      else recordingData.console.info.push(logEntry);
    }
  });
}

// Capture comprehensive page state
async function capturePageState() {
  if (!webView || !recordingActive) return;
  
  try {
    const pageState = await webView.webContents.executeJavaScript(`
      ({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        scrollPosition: window.scrollY,
        activeElement: document.activeElement?.tagName,
        hasFocus: document.hasFocus(),
        timestamp: Date.now()
      })
    `);
    
    recordingData.viewportStates.push(pageState);
  } catch (e) {
    console.error('Error capturing page state:', e);
  }
}

// Main recording handler with COMPREHENSIVE capture
ipcMain.handle('start-enhanced-recording', async () => {
  if (recordingActive) {
    return { success: false, error: 'Recording already active' };
  }
  
  console.log('🎬 Starting COMPREHENSIVE CDP recording...');
  console.log('  - WebView URL:', webView?.webContents.getURL());
  console.log('  - Aggressive capture mode: ENABLED');
  
  recordingActive = true;
  recordingData = {
    actions: [],
    domSnapshots: [],
    domMutations: [],
    visibilityChanges: [],
    network: { requests: [], responses: [], failures: [], timing: [] },
    console: { logs: [], errors: [], warnings: [], info: [] },
    screenshots: [],
    viewportStates: [],
    performance: [],
    memory: [],
    tabSwitches: [], // Track tab switches during recording
    currentTabId: 'tab-initial', // Track current tab
    startTime: Date.now(),
    url: webView?.webContents.getURL(),
    title: await webView?.webContents.getTitle(),
    // Add persistent storage for data across all pages and tabs
    capturedInputs: {}, // Will store ALL inputs from ALL pages/tabs
    pageTransitions: [], // Track all page navigations
    crossTabData: new Map() // Store data per tab
  };

  // Attach debugger for maximum data capture
  if (webView && !debuggerAttached) {
    try {
      webView.webContents.debugger.attach('1.3');
      debuggerAttached = true;
      console.log('✅ Debugger attached for comprehensive capture');
      
      // Enable ALL CDP domains for maximum data
      await webView.webContents.debugger.sendCommand('Page.enable');
      await webView.webContents.debugger.sendCommand('Runtime.enable');
      await webView.webContents.debugger.sendCommand('DOM.enable');
      await webView.webContents.debugger.sendCommand('Network.enable');
      await webView.webContents.debugger.sendCommand('Console.enable');
      await webView.webContents.debugger.sendCommand('Performance.enable');
      
      // CRITICAL: Bypass CSP to allow script injection on secure login pages
      console.log('🔓 Bypassing CSP for script injection...');
      await webView.webContents.debugger.sendCommand('Page.setBypassCSP', { enabled: true });
      console.log('✅ CSP bypass enabled - scripts can now be injected on secure pages');
      
      // IMMEDIATELY inject a minimal script that will persist across ALL navigations
      const minimalPersistentScript = `
        (function() {
          if (window.__recordingInjected) return;
          window.__recordingInjected = true;
          
          window.__comprehensiveRecording = window.__comprehensiveRecording || {
            actions: [],
            domSnapshots: [],
            mutations: [],
            visibilityChanges: []
          };
          
          // Capture ALL input events including password fields
          document.addEventListener('input', function(e) {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
              const fieldKey = e.target.name || e.target.id || 'field_' + Date.now();
              const fieldName = (e.target.name || '').toLowerCase();
              const fieldId = (e.target.id || '').toLowerCase();
              const fieldPlaceholder = (e.target.placeholder || '').toLowerCase();
              
              // Enhanced login field detection
              const isPassword = e.target.type === 'password';
              const isEmail = e.target.type === 'email' || 
                              fieldName.includes('email') || 
                              fieldId.includes('email') ||
                              fieldPlaceholder.includes('email');
              const isUsername = fieldName.includes('user') || 
                                fieldName.includes('login') ||
                                fieldId.includes('user') || 
                                fieldId.includes('login') ||
                                fieldPlaceholder.includes('user') ||
                                fieldPlaceholder.includes('username') ||
                                // Specific Zoho detection
                                fieldId === 'login_id' ||
                                fieldName === 'login_id';
              
              const isLogin = isPassword || isEmail || isUsername;
              
              const action = {
                type: 'input',
                timestamp: Date.now(),
                target: {
                  tagName: e.target.tagName,
                  id: e.target.id,
                  name: e.target.name,
                  type: e.target.type,
                  value: e.target.value,
                  placeholder: e.target.placeholder
                },
                url: window.location.href
              };
              window.__comprehensiveRecording.actions.push(action);
              
              // CRITICAL: Send to main process immediately
              const dataToSend = {
                type: 'input',
                field: fieldKey,
                value: e.target.value,
                inputType: e.target.type,
                url: window.location.href,
                isLoginField: isLogin
              };
              console.log('[RECORDER-DATA]' + JSON.stringify(dataToSend));
              
              console.log('[RECORDER] Input captured:', e.target.name || e.target.id, '=', e.target.type === 'password' ? '***' : e.target.value);
            }
          }, true);
          
          // Capture change events
          document.addEventListener('change', function(e) {
            if (e.target) {
              const action = {
                type: 'change',
                timestamp: Date.now(),
                target: {
                  tagName: e.target.tagName,
                  id: e.target.id,
                  name: e.target.name,
                  type: e.target.type,
                  value: e.target.value
                },
                url: window.location.href
              };
              window.__comprehensiveRecording.actions.push(action);
              console.log('[RECORDER] Change captured:', e.target.name || e.target.id);
            }
          }, true);
          
          // Capture clicks
          document.addEventListener('click', function(e) {
            const action = {
              type: 'click',
              timestamp: Date.now(),
              target: {
                tagName: e.target.tagName,
                id: e.target.id,
                className: e.target.className,
                text: e.target.textContent?.substring(0, 100)
              },
              url: window.location.href
            };
            window.__comprehensiveRecording.actions.push(action);
            console.log('[RECORDER] Click captured:', e.target.tagName, e.target.id || e.target.className);
          }, true);
          
          // Capture form submissions
          document.addEventListener('submit', function(e) {
            const formData = new FormData(e.target);
            const formFields = {};
            for (let [key, value] of formData.entries()) {
              formFields[key] = value;
            }
            const action = {
              type: 'submit',
              timestamp: Date.now(),
              target: {
                tagName: 'FORM',
                id: e.target.id,
                action: e.target.action,
                method: e.target.method,
                fields: formFields
              },
              url: window.location.href
            };
            window.__comprehensiveRecording.actions.push(action);
            console.log('[RECORDER] Form submit captured with fields:', Object.keys(formFields));
          }, true);
          
          console.log('[RECORDER] Minimal persistent recording script injected successfully on:', window.location.href);
        })();
      `;
      
      // This ensures the script runs on EVERY page load, including future navigations
      await webView.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: minimalPersistentScript
      });
      console.log('✅ Persistent recording script registered for ALL future page loads');
      
      // COMPREHENSIVE script that captures EVERYTHING
      comprehensiveScript = `
        // Initialize comprehensive recording
        window.__comprehensiveRecording = {
          actions: [],
          domSnapshots: [],
          mutations: [],
          visibilityChanges: [],
          formStates: [],
          scrollEvents: [],
          mouseMovements: [],
          keystrokes: [],
          currentTabId: 'tab-initial',
          currentUrl: window.location.href,
          
          // Capture complete DOM structure
          captureDOMStructure: function() {
            const snapshot = {
              timestamp: Date.now(),
              url: window.location.href,
              title: document.title,
              
              // Element counts
              counts: {
                total: document.querySelectorAll('*').length,
                visible: Array.from(document.querySelectorAll('*')).filter(el => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0;
                }).length,
                interactive: document.querySelectorAll('button, a, input, select, textarea, [role="button"]').length,
                forms: document.forms.length,
                images: document.images.length,
                iframes: document.querySelectorAll('iframe').length
              },
              
              // All interactive elements with multiple selectors
              interactables: Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"], [onclick]')).map(el => ({
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                name: el.name,
                type: el.type,
                value: el.value?.substring(0, 100),
                text: el.textContent?.substring(0, 100),
                href: el.href,
                
                // Multiple selector strategies
                selectors: {
                  id: el.id ? '#' + el.id : null,
                  className: el.className ? '.' + el.className.split(' ').join('.') : null,
                  name: el.name ? '[name="' + el.name + '"]' : null,
                  dataTestId: el.getAttribute('data-testid') ? '[data-testid="' + el.getAttribute('data-testid') + '"]' : null,
                  ariaLabel: el.getAttribute('aria-label') ? '[aria-label="' + el.getAttribute('aria-label') + '"]' : null,
                  role: el.getAttribute('role') ? '[role="' + el.getAttribute('role') + '"]' : null,
                  xpath: this.getXPath(el),
                  cssPath: this.getCSSPath(el)
                },
                
                // Visual properties
                visible: this.isVisible(el),
                rect: el.getBoundingClientRect(),
                styles: {
                  display: getComputedStyle(el).display,
                  visibility: getComputedStyle(el).visibility,
                  opacity: getComputedStyle(el).opacity,
                  zIndex: getComputedStyle(el).zIndex,
                  position: getComputedStyle(el).position
                },
                
                // Context
                parentTag: el.parentElement?.tagName,
                siblings: el.parentElement?.children.length,
                inForm: !!el.closest('form'),
                inModal: !!el.closest('[role="dialog"], .modal'),
                nearbyText: this.getNearbyText(el)
              })),
              
              // Form states
              forms: Array.from(document.forms).map(form => ({
                id: form.id,
                name: form.name,
                action: form.action,
                method: form.method,
                fields: Array.from(form.elements).map(field => ({
                  name: field.name,
                  type: field.type,
                  value: field.value ? 'filled' : 'empty',
                  required: field.required,
                  disabled: field.disabled,
                  visible: this.isVisible(field)
                }))
              })),
              
              // Page layout structure
              layout: {
                sections: Array.from(document.querySelectorAll('header, nav, main, section, article, aside, footer')).map(section => ({
                  tag: section.tagName,
                  id: section.id,
                  className: section.className,
                  childCount: section.children.length,
                  textLength: section.textContent?.length,
                  rect: section.getBoundingClientRect()
                }))
              },
              
              // Viewport and scroll state
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                documentHeight: document.documentElement.scrollHeight,
                documentWidth: document.documentElement.scrollWidth
              },
              
              // Performance metrics
              performance: {
                memory: performance.memory ? {
                  usedJSHeapSize: performance.memory.usedJSHeapSize,
                  totalJSHeapSize: performance.memory.totalJSHeapSize,
                  jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                } : null,
                timing: {
                  domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                  loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
                }
              }
            };
            
            return snapshot;
          },
          
          // Helper functions
          getXPath: function(element) {
            if (!element) return '';
            if (element.id) return '//*[@id="' + element.id + '"]';
            if (element === document.body) return '/html/body';
            
            let ix = 0;
            const siblings = element.parentNode?.childNodes || [];
            for (let i = 0; i < siblings.length; i++) {
              const sibling = siblings[i];
              if (sibling === element) {
                return this.getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
              }
              if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                ix++;
              }
            }
            return '';
          },
          
          getCSSPath: function(element) {
            const path = [];
            while (element && element.nodeType === Node.ELEMENT_NODE) {
              let selector = element.nodeName.toLowerCase();
              if (element.id) {
                selector += '#' + element.id;
                path.unshift(selector);
                break;
              } else {
                let sibling = element;
                let nth = 1;
                while (sibling = sibling.previousElementSibling) {
                  if (sibling.nodeName.toLowerCase() === selector) nth++;
                }
                if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
              }
              path.unshift(selector);
              element = element.parentNode;
            }
            return path.join(' > ');
          },
          
          isVisible: function(el) {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   rect.top < window.innerHeight &&
                   rect.bottom > 0;
          },
          
          getNearbyText: function(el) {
            const texts = [];
            const prev = el.previousSibling;
            const next = el.nextSibling;
            if (prev && prev.textContent) texts.push(prev.textContent.trim().substring(0, 50));
            if (next && next.textContent) texts.push(next.textContent.trim().substring(0, 50));
            return texts.join(' | ');
          },
          
          // Start comprehensive monitoring
          startMonitoring: function() {
            console.log('Starting comprehensive DOM monitoring...');
            
            // Recording indicator removed - no popup needed
            
            // Capture ALL events
            const allEvents = ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave',
                              'keydown', 'keyup', 'keypress', 'input', 'change', 'focus', 'blur',
                              'submit', 'reset', 'select', 'scroll', 'resize', 'load', 'error'];
            
            allEvents.forEach(eventType => {
              document.addEventListener(eventType, (e) => {
                // Process all events
                
                const eventData = {
                  type: eventType,
                  timestamp: Date.now(),
                  target: e.target ? {
                    tagName: e.target.tagName,
                    id: e.target.id,
                    className: e.target.className,
                    selector: this.getCSSPath(e.target),
                    // Capture the actual value for input/textarea elements
                    value: (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') ? e.target.value : undefined
                  } : null,
                  
                  // Event-specific data
                  mousePosition: e.clientX !== undefined ? { x: e.clientX, y: e.clientY } : null,
                  key: e.key,
                  keyCode: e.keyCode,
                  ctrlKey: e.ctrlKey,
                  shiftKey: e.shiftKey,
                  altKey: e.altKey,
                  metaKey: e.metaKey,
                  
                  // For input/change events, also capture the value at the event level
                  value: (eventType === 'input' || eventType === 'change') && e.target ? e.target.value : undefined,
                  
                  // Context
                  url: window.location.href,
                  scrollPosition: { x: window.scrollX, y: window.scrollY }
                };
                
                this.actions.push(eventData);
                
                // Log important events
                if (['click', 'submit', 'change', 'input'].includes(eventType)) {
                  console.log('Captured event:', eventData);
                }
              }, true);
            });
            
            // Mutation observer for DOM changes
            const observer = new MutationObserver((mutations) => {
              mutations.forEach(mutation => {
                this.mutations.push({
                  type: mutation.type,
                  target: mutation.target.tagName,
                  timestamp: Date.now(),
                  addedNodes: mutation.addedNodes.length,
                  removedNodes: mutation.removedNodes.length,
                  attributeName: mutation.attributeName,
                  oldValue: mutation.oldValue
                });
              });
            });
            
            observer.observe(document.body, {
              childList: true,
              attributes: true,
              characterData: true,
              subtree: true,
              attributeOldValue: true,
              characterDataOldValue: true
            });
            
            // Intersection observer for visibility changes
            const visibilityObserver = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.target.tagName) {
                  this.visibilityChanges.push({
                    timestamp: Date.now(),
                    element: entry.target.tagName,
                    visible: entry.isIntersecting,
                    ratio: entry.intersectionRatio
                  });
                }
              });
            });
            
            // Observe all interactive elements
            document.querySelectorAll('button, a, input, select, textarea').forEach(el => {
              visibilityObserver.observe(el);
            });
            
            // Initial comprehensive snapshot
            this.domSnapshots.push(this.captureDOMStructure());
            
            // Smart event-driven snapshots instead of aggressive time-based
            this.lastSnapshotTime = Date.now();
            this.minSnapshotInterval = 500; // Min 500ms between snapshots
            
            this.captureSnapshotIfNeeded = (reason) => {
              const now = Date.now();
              if (now - this.lastSnapshotTime >= this.minSnapshotInterval && this.captureDOMStructure) {
                const snapshot = this.captureDOMStructure();
                snapshot.tabId = this.currentTabId || 'unknown';
                snapshot.recordedUrl = window.location.href;
                snapshot.reason = reason; // Track why snapshot was taken
                this.domSnapshots.push(snapshot);
                
                console.log('DOM snapshot captured:', {
                  reason: reason,
                  total: this.domSnapshots.length,
                  elements: snapshot.counts.total,
                  interactive: snapshot.counts.interactive
                });
                
                this.lastSnapshotTime = now;
                
                // Keep only last 100 snapshots in memory
                if (this.domSnapshots.length > 100) {
                  this.domSnapshots.shift();
                }
              }
            };
            
            // Capture snapshots on significant events
            ['click', 'submit', 'load', 'DOMContentLoaded', 'popstate', 'hashchange'].forEach(eventType => {
              window.addEventListener(eventType, () => this.captureSnapshotIfNeeded(eventType), true);
            });
            
            // Capture after form changes
            document.addEventListener('change', (e) => {
              if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
                this.captureSnapshotIfNeeded('form-change');
              }
            }, true);
            
            // Capture after navigation
            const originalPushState = history.pushState;
            history.pushState = function() {
              originalPushState.apply(history, arguments);
              window.__comprehensiveRecording.captureSnapshotIfNeeded('navigation');
            };
            
            // Fallback: Capture every 5 seconds during idle
            setInterval(() => {
              if (Date.now() - this.lastSnapshotTime >= 5000) {
                this.captureSnapshotIfNeeded('periodic-idle');
              }
            }, 5000);
          }
        };
        
        // Start comprehensive monitoring
        window.__comprehensiveRecording.startMonitoring();
        console.log('Comprehensive recording initialized');
      `;
      
      // Add script to persist across navigations
      await webView.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: comprehensiveScript
      });
      
      // Also inject into current page
      await webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: comprehensiveScript,
        userGesture: true
      });
      
      // Listen for ALL CDP events
      webView.webContents.debugger.on('message', (event, method, params) => {
        if (recordingActive) {
          // CRITICAL: Capture console messages to get input data immediately
          if (method === 'Runtime.consoleAPICalled' && params.args) {
            // Check if this is a special recording data message
            const args = params.args || [];
            if (args.length > 0 && args[0].value) {
              const text = String(args[0].value);
              
              // Check for our special recording data format
              if (text.includes('[RECORDER-DATA]')) {
                try {
                  // Parse the JSON data after the marker
                  const jsonStr = text.substring(text.indexOf('[RECORDER-DATA]') + 15);
                  const data = JSON.parse(jsonStr);
                  
                  // Store input data immediately in main process
                  if (data.type === 'input' && data.field) {
                    const key = `${data.url || 'unknown'}_${data.field}_${Date.now()}`;
                    recordingData.capturedInputs[key] = {
                      field: data.field,
                      value: data.value,
                      type: data.inputType,
                      url: data.url,
                      timestamp: Date.now() - recordingData.startTime,
                      isLoginField: data.isLoginField || false
                    };
                    console.log(`💾 Captured ${data.isLoginField ? 'LOGIN' : 'input'} field: ${data.field} from ${data.url}`);
                  }
                  
                  // Store action data
                  if (data.type === 'action') {
                    recordingData.actions.push({
                      ...data,
                      timestamp: Date.now() - recordingData.startTime
                    });
                  }
                } catch (e) {
                  // Not valid JSON, ignore
                }
              }
            }
            
            // Still log regular console messages
            recordingData.console.logs.push({
              type: params.type,
              args: params.args,
              timestamp: Date.now() - recordingData.startTime
            });
          }
          
          // Network events
          if (method.startsWith('Network.')) {
            recordingData.network.requests.push({
              method: method,
              params: params,
              timestamp: Date.now() - recordingData.startTime
            });
          }
          
          // Performance events
          if (method.startsWith('Performance.')) {
            recordingData.performance.push({
              method: method,
              metrics: params.metrics,
              timestamp: Date.now() - recordingData.startTime
            });
          }
        }
      });
      
      console.log('✅ Comprehensive recording scripts injected and all CDP domains enabled');
      
      // Screenshots are only captured when stopping recording
      // startScreenshotCapture(); // Disabled - only capture on stop
      
    } catch (err) {
      console.error('Error attaching debugger:', err);
      debuggerAttached = false;
    }
  }
  
  return { 
    success: true, 
    sessionId: `comprehensive-${Date.now()}`,
    message: 'Comprehensive CDP recording started - capturing ALL data'
  };
});

// Aggressive screenshot capture
async function startScreenshotCapture() {
  if (!webView || !recordingActive) return;
  
  const captureInterval = setInterval(async () => {
    if (!recordingActive) {
      clearInterval(captureInterval);
      return;
    }
    
    try {
      // Capture both viewport and full page screenshots
      const viewportShot = await webView.webContents.capturePage();
      
      recordingData.screenshots.push({
        timestamp: Date.now() - recordingData.startTime,
        type: 'viewport',
        data: viewportShot.toDataURL(),
        size: viewportShot.getSize()
      });
      
      console.log(`📸 Screenshot captured (${recordingData.screenshots.length} total)`);
    } catch (e) {
      console.error('Screenshot capture failed:', e);
    }
  }, 2000); // Screenshot every 2 seconds
}

// Pause recording handler
ipcMain.handle('pause-enhanced-recording', async () => {
  if (!recordingActive) {
    return { success: false, error: 'No recording active' };
  }
  
  console.log('⏸️ Pausing recording...');
  recordingData.isPaused = true;
  
  // Send pause signal to page
  if (webView && debuggerAttached) {
    try {
      await webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          if (window.__comprehensiveRecording) {
            window.__comprehensiveRecording.isPaused = true;
            console.log('Recording paused');
          }
        `
      });
    } catch (e) {
      console.error('Error pausing recording:', e);
    }
  }
  
  return { success: true };
});

// Resume recording handler
ipcMain.handle('resume-enhanced-recording', async () => {
  if (!recordingActive) {
    return { success: false, error: 'No recording active' };
  }
  
  console.log('▶️ Resuming recording...');
  recordingData.isPaused = false;
  
  // Send resume signal to page
  if (webView && debuggerAttached) {
    try {
      await webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          if (window.__comprehensiveRecording) {
            window.__comprehensiveRecording.isPaused = false;
            console.log('Recording resumed');
          }
        `
      });
    } catch (e) {
      console.error('Error resuming recording:', e);
    }
  }
  
  return { success: true };
});

// Get recording status handler
ipcMain.handle('enhanced-recording-status', async () => {
  return {
    success: true,
    data: {
      isRecording: recordingActive,
      isPaused: recordingData.isPaused || false,
      sessionId: recordingActive ? `comprehensive-${recordingData.startTime}` : null
    }
  };
});

// Stop recording handler
ipcMain.handle('stop-enhanced-recording', async () => {
  if (!recordingActive) {
    return { success: false, error: 'No recording active' };
  }
  
  console.log('⏹️ Stopping comprehensive recording...');
  recordingActive = false;
  recordingData.endTime = Date.now();
  
  // Capture final screenshot before stopping
  if (webView) {
    try {
      const finalScreenshot = await webView.webContents.capturePage();
      recordingData.screenshots.push({
        timestamp: Date.now() - recordingData.startTime,
        type: 'final',
        data: finalScreenshot.toDataURL(),
        size: finalScreenshot.getSize()
      });
      console.log('📸 Final screenshot captured on stop');
    } catch (e) {
      console.error('Failed to capture final screenshot:', e);
    }
  }
  
  // Collect all captured data
  let pageData = { actions: [], domSnapshots: [], mutations: [], visibilityChanges: [] };
  let preloadData = { actions: [], inputs: {} };
  
  // First try to get data from the preload script
  if (webView) {
    try {
      const preloadResult = await webView.webContents.executeJavaScript(`
        if (window.getRecordingData) {
          window.getRecordingData();
        } else {
          null;
        }
      `);
      
      if (preloadResult) {
        preloadData = preloadResult;
        console.log('📱 Collected preload recording data:', {
          actions: preloadData.actions?.length || 0,
          inputs: Object.keys(preloadData.inputs || {}).length
        });
      }
    } catch (e) {
      console.error('Error collecting preload data:', e);
    }
  }
  
  // Then get data from CDP injection
  if (webView && debuggerAttached) {
    try {
      const result = await webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          const data = window.__comprehensiveRecording || { actions: [], domSnapshots: [], mutations: [], visibilityChanges: [], capturedInputs: {} };
          
          // Recording stopped
          
          console.log('Collected comprehensive recording data:', {
            actions: data.actions.length,
            snapshots: data.domSnapshots?.length || 0,
            mutations: data.mutations?.length || 0,
            visibilityChanges: data.visibilityChanges?.length || 0,
            capturedInputs: Object.keys(data.capturedInputs || {}).length
          });
          
          // Include captured inputs in the data
          if (data.capturedInputs) {
            console.log('Captured input fields:', Object.keys(data.capturedInputs));
          }
          
          JSON.stringify(data);
        `,
        returnByValue: true
      });
      
      if (result.result && result.result.value) {
        pageData = JSON.parse(result.result.value);
      }
      
      webView.webContents.debugger.detach();
      debuggerAttached = false;
      console.log('✅ Debugger detached');
      
    } catch (e) {
      console.error('Error collecting recording data:', e);
    }
  }
  
  // Combine all data (merge preload and CDP data)
  const allActions = [...(preloadData.actions || []), ...(pageData.actions || [])];
  
  const finalData = {
    sessionId: `comprehensive-${recordingData.startTime}`,
    startTime: recordingData.startTime,
    endTime: recordingData.endTime,
    duration: recordingData.endTime - recordingData.startTime,
    url: recordingData.url,
    title: recordingData.title,
    
    // Multi-tab workflow tracking
    tabSwitches: recordingData.tabSwitches || [],
    tabsUsed: Array.from(tabsData.keys()),
    
    // User interactions (merged from both sources)
    actions: allActions,
    
    // Preload captured inputs
    preloadInputs: preloadData.inputs || {},
    
    // DOM data
    domSnapshots: pageData.domSnapshots || [],
    mutations: pageData.mutations || [],
    visibilityChanges: pageData.visibilityChanges || [],
    
    // Network
    network: recordingData.network,
    
    // Console
    console: recordingData.console,
    
    // Visual
    screenshots: recordingData.screenshots,
    viewportStates: recordingData.viewportStates,
    
    // Performance
    performance: recordingData.performance,
    memory: recordingData.memory,
    
    // Statistics (will calculate dataSizeMB after object creation)
    stats: {
      totalActions: pageData.actions?.length || 0,
      totalSnapshots: pageData.domSnapshots?.length || 0,
      totalMutations: pageData.mutations?.length || 0,
      totalNetworkEvents: Object.values(recordingData.network).flat().length,
      totalConsoleEvents: Object.values(recordingData.console).flat().length,
      totalScreenshots: recordingData.screenshots.length
    }
  };
  
  // Add data size to stats
  finalData.stats.dataSizeMB = JSON.stringify(finalData).length / 1024 / 1024;
  
  console.log('📊 Comprehensive recording summary:', finalData.stats);
  
  // Process actions to extract final input values
  const fieldLastValue = {};
  
  // First pass: collect the final value for each field by reconstructing from keydown events
  if (finalData.actions) {
    let currentField = null;
    let currentText = '';
    
    finalData.actions.forEach(action => {
      // Track focus to know which field is being typed in
      if (action.type === 'focus' && action.target?.tagName === 'INPUT') {
        currentField = action.target.id || action.target.name || action.target.selector;
        currentText = '';
      }
      
      // Accumulate keydown events to build the text
      if (action.type === 'keydown' && currentField && action.key) {
        if (action.key === 'Backspace') {
          currentText = currentText.slice(0, -1);
        } else if (action.key.length === 1) {
          currentText += action.key;
        }
        
        // Update the field's value
        fieldLastValue[currentField] = {
          value: currentText,
          element: action.target,
          url: action.url
        };
      }
      
      // Clear on blur
      if (action.type === 'blur') {
        currentField = null;
      }
    });
  }
  
  // Also add inputs from preload script
  const preloadInputsArray = Object.entries(finalData.preloadInputs || {}).map(([field, data]) => ({
    field: field,
    value: data.value,
    url: data.url,
    element: {
      tagName: 'INPUT',
      id: data.id || field,
      name: data.name || '',
      type: data.type || 'text'
    }
  }));
  
  // Add inputs captured by the minimal script
  const capturedInputsArray = Object.entries(pageData.capturedInputs || {}).map(([field, data]) => ({
    field: field,
    value: data.value,
    url: data.url || recordingData.url,
    element: {
      tagName: data.tagName || 'INPUT',
      id: data.id || '',
      name: data.name || '',
      type: data.type || 'text',
      isLoginField: data.isLoginField || false
    }
  }));
  
  // CRITICAL: Add inputs that were captured and sent to main process immediately
  const mainProcessInputsArray = Object.entries(recordingData.capturedInputs || {}).map(([key, data]) => ({
    field: data.field,
    value: data.value,
    url: data.url,
    element: {
      tagName: 'INPUT',
      type: data.type || data.inputType || 'text',
      isLoginField: data.isLoginField || false
    }
  }));
  
  // Combine all sources of input data
  const allInputs = [
    ...Object.entries(fieldLastValue).map(([field, data]) => ({
      field: field,
      value: data.value,
      url: data.url,
      element: data.element
    })),
    ...preloadInputsArray,
    ...capturedInputsArray,
    ...mainProcessInputsArray // Add inputs captured directly in main process
  ];
  
  // Deduplicate by field name
  const uniqueInputs = {};
  allInputs.forEach(input => {
    uniqueInputs[input.field] = input;
  });
  
  finalData.extractedInputs = Object.values(uniqueInputs);
  
  console.log(`📝 Extracted ${finalData.extractedInputs.length} input fields with values`);
  console.log(`  - From CDP: ${Object.keys(fieldLastValue).length} fields`);
  console.log(`  - From Preload: ${preloadInputsArray.length} fields`);
  console.log(`  - From Page Captured: ${capturedInputsArray.length} fields`);
  console.log(`  - From Main Process: ${mainProcessInputsArray.length} fields`);
  
  // Log any login fields found
  const loginFields = finalData.extractedInputs.filter(f => f.element?.isLoginField);
  if (loginFields.length > 0) {
    console.log(`🔐 Found ${loginFields.length} login-related fields!`);
    loginFields.forEach(field => {
      console.log(`  - ${field.field} (${field.element.type}) from ${field.url}`);
    });
  }
  
  // Save data to file for analysis
  const fileName = `recording-${Date.now()}.json`;
  await fs.writeFile(fileName, JSON.stringify(finalData, null, 2));
  console.log(`💾 Recording saved to ${fileName}`);
  
  // Automatically generate Intent Spec using AI
  try {
    console.log('🤖 Generating Intent Spec with AI...');
    const { analyzeRecording } = require('./dist/main/llm.js');
    
    const intentSpec = await analyzeRecording(finalData);
    
    if (intentSpec) {
      console.log('✅ Intent Spec generated successfully');
      console.log(`  Name: ${intentSpec.name}`);
      console.log(`  Variables: ${intentSpec.params?.length || 0}`);
      
      // Save Intent Spec
      const specFileName = `intent-spec-${Date.now()}.json`;
      await fs.writeFile(specFileName, JSON.stringify(intentSpec, null, 2));
      console.log(`💾 Intent Spec saved to ${specFileName}`);
      
      // Include in response
      finalData.intentSpec = intentSpec;
    }
  } catch (error) {
    console.error('❌ Failed to generate Intent Spec:', error.message);
  }
  
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
    cdpPort: CDP_PORT,
    webViewUrl: webView?.webContents.getURL(),
    captureMode: 'COMPREHENSIVE',
    debuggerAttached: debuggerAttached
  };
});

// Tab management handlers matching preload.js
ipcMain.handle('close-tab', async (event, tabId) => {
  // In this simple implementation, we don't actually close tabs
  // since we only have one WebView
  console.log(`Close tab requested for: ${tabId}`);
  return true;
});

ipcMain.handle('switch-tab', async (event, tabId) => {
  console.log(`Switch to tab: ${tabId}`);
  
  // Track tab switch in recording
  if (recordingActive && recordingData) {
    recordingData.tabSwitches.push({
      fromTab: recordingData.currentTabId,
      toTab: tabId,
      timestamp: Date.now() - recordingData.startTime,
      url: tabsData.get(tabId)?.url
    });
    recordingData.currentTabId = tabId;
    console.log(`📑 Recording tab switch: ${recordingData.tabSwitches.length} switches recorded`);
  }
  
  // Get the tab's URL and navigate to it
  const tabData = tabsData.get(tabId);
  if (tabData && webView) {
    console.log(`Navigating to tab URL: ${tabData.url}`);
    const firefoxUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
    webView.webContents.setUserAgent(firefoxUserAgent);
    await webView.webContents.loadURL(tabData.url);
    return true;
  }
  
  return false;
});

ipcMain.handle('create-tab', async (event, url) => {
  // Use the same Google URL with parameters for new tabs
  const targetUrl = url || 'https://www.google.com';
  const tabId = `tab-${Date.now()}`;
  const title = 'New Tab';
  
  // Store tab data
  tabsData.set(tabId, { id: tabId, url: targetUrl, title });
  
  // Track new tab creation in recording
  if (recordingActive && recordingData) {
    recordingData.tabSwitches.push({
      action: 'new-tab',
      tabId: tabId,
      url: targetUrl,
      timestamp: Date.now() - recordingData.startTime
    });
    console.log(`📑 Recording new tab creation: ${tabId}`);
  }
  
  console.log(`Creating new tab: ${tabId}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Add tab to UI - wrap in try-catch to prevent errors
    try {
      await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Add the new tab to UI
            const newTab = {
              id: '${tabId}',
              title: '${title}',
              url: '${targetUrl}',
              active: true
            };
            
            // Initialize tabs if needed
            if (typeof tabs === 'undefined') {
              window.tabs = new Map();
            }
            if (typeof activeTabId === 'undefined') {
              window.activeTabId = '';
            }
            
            // Deactivate other tabs
            if (window.tabs && window.tabs.forEach) {
              window.tabs.forEach(tab => tab.active = false);
              window.tabs.set('${tabId}', newTab);
              window.activeTabId = '${tabId}';
            }
            
            // Update UI
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            
            const tabElement = document.createElement('div');
            tabElement.className = 'tab active';
            tabElement.dataset.tabId = '${tabId}';
            
            // Create tab HTML without template literals
            const titleSpan = document.createElement('span');
            titleSpan.className = 'tab-title';
            titleSpan.textContent = '${title}';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            closeBtn.onclick = function() {
              if (typeof closeTab === 'function') {
                closeTab('${tabId}');
              }
            };
            
            tabElement.appendChild(titleSpan);
            tabElement.appendChild(closeBtn);
            
            // Add click handler for tab switching
            tabElement.onclick = function(e) {
              if (!e.target.classList.contains('tab-close')) {
                if (typeof switchToTab === 'function') {
                  switchToTab('${tabId}');
                }
              }
            };
            
            const tabsContainer = document.getElementById('tabs-container');
            const newTabBtn = document.getElementById('new-tab-btn');
            if (tabsContainer && newTabBtn) {
              tabsContainer.insertBefore(tabElement, newTabBtn);
            }
            
            // Update address bar
            const addressBar = document.getElementById('address-bar');
            if (addressBar) {
              addressBar.value = '${targetUrl}';
            }
            
            console.log('New tab created:', newTab);
            return true;
          } catch (err) {
            console.error('Error in tab creation:', err);
            return false;
          }
        })();
      `);
    } catch (e) {
      console.error('Failed to create tab UI:', e);
    }
    
    // Now navigate to the new tab's URL
    if (webView) {
      const firefoxUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      webView.webContents.setUserAgent(firefoxUserAgent);
      await webView.webContents.loadURL(targetUrl);
    }
  }
  
  return {
    id: tabId,
    url: targetUrl,
    title: 'New Tab',
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

ipcMain.handle('navigate-tab', async (event, tabId, url) => {
  if (webView) {
    // Ensure Firefox user agent is maintained during navigation
    const firefoxUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
    webView.webContents.setUserAgent(firefoxUserAgent);
    
    // Handle different URL formats
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it looks like a search query or a domain
      if (url.includes(' ') || !url.includes('.')) {
        // It's a search query - use Google with parameters
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}&hl=en&gl=us&authuser=0&pws=0`;
      } else {
        // It's a domain
        url = 'https://' + url;
      }
    }
    
    console.log(`Navigating to: ${url}`);
    
    try {
      await webView.webContents.loadURL(url);
      
      // Update the UI after navigation
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const title = webView.webContents.getTitle() || 'Loading...';
          mainWindow.webContents.executeJavaScript(`
            // Update address bar
            const addressBar = document.getElementById('address-bar');
            if (addressBar) {
              addressBar.value = '${url}';
            }
            
            // Update active tab
            if (typeof activeTabId !== 'undefined' && activeTabId) {
              const tab = tabs.get(activeTabId);
              if (tab) {
                tab.url = '${url}';
                tab.title = '${title}';
                
                // Update tab title in UI
                const tabElement = document.querySelector(\`.tab[data-tab-id="\${activeTabId}"] .tab-title\`);
                if (tabElement) {
                  tabElement.textContent = '${title}';
                }
              }
            }
          `);
        }
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Navigation error:', error);
      return false;
    }
  }
  return false;
});

// Navigation handlers matching preload.js
ipcMain.handle('tab-back', async (event, tabId) => {
  console.log('🔙 Navigation back requested');
  if (webView && webView.webContents) {
    const canGoBack = webView.webContents.canGoBack();
    console.log('🔙 Can go back:', canGoBack);
    if (canGoBack) {
      webView.webContents.goBack();
      return true;
    }
  }
  return false;
});

ipcMain.handle('tab-forward', async (event, tabId) => {
  console.log('🔜 Navigation forward requested');
  if (webView && webView.webContents) {
    const canGoForward = webView.webContents.canGoForward();
    console.log('🔜 Can go forward:', canGoForward);
    if (canGoForward) {
      webView.webContents.goForward();
      return true;
    }
  }
  return false;
});

ipcMain.handle('tab-reload', async (event, tabId) => {
  console.log('🔄 Reload requested');
  if (webView && webView.webContents) {
    webView.webContents.reload();
    return true;
  }
  return false;
});

// Also keep the old handlers for compatibility
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

// Handler for Magnitude execution in WebView
ipcMain.handle('run-magnitude-webview', async (event, params) => {
  try {
    console.log('📥 run-magnitude-webview received params:', JSON.stringify({
      hasFlowSpec: !!params.flowSpec,
      flowSpecName: params.flowSpec?.name,
      variables: params.variables
    }));
    
    // Import the enhanced flow executor
    const { EnhancedFlowExecutor } = require('./dist/main/enhanced-flow-executor');
    const executor = new EnhancedFlowExecutor();
    
    // Use the current webView
    if (!webView || !webView.webContents) {
      throw new Error('No active WebView found');
    }
    
    // Set the correct CDP port for this session
    process.env.CDP_PORT = String(CDP_PORT);
    
    // Ensure ANTHROPIC_API_KEY is available
    if (!process.env.ANTHROPIC_API_KEY) {
      // Try to load from .env file
      require('dotenv').config();
    }
    
    // Set up progress callback to forward to renderer
    executor.onProgress((progress) => {
      event.sender.send('flow-progress', progress);
    });
    
    // Execute the flow
    const result = await executor.executeFlow(params.flowSpec, params.variables, webView);
    
    // Return a serializable result
    return {
      success: result.success,
      results: [],
      errors: result.errors ? result.errors.map(e => e.error || e) : [],
      completedSteps: result.completedSteps || 0,
      totalSteps: result.totalSteps || 0
    };
  } catch (error) {
    console.error('Error in run-magnitude-webview:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
});

app.whenReady().then(async () => {
  // Clean up old sessions before starting
  await cleanupOldSessions();
  
  createWindow();
  console.log('🚀 Electron app ready with COMPREHENSIVE CDP recording');
  console.log('⚡ Aggressive capture mode available - will use more resources');
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