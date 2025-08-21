// Comprehensive recording with aggressive data capture
const { app, BrowserWindow, ipcMain, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs').promises;

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
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Set user data directory to avoid cache conflicts
const userDataPath = path.join(app.getPath('userData'), `session-${Date.now()}`);
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

  webView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:default',
      webSecurity: false
    }
  });

  mainWindow.contentView.addChildView(webView);
  updateWebViewBounds();
  
  // Use Firefox user agent to bypass Google's Electron detection
  // This prevents the "Stay signed out" prompt
  const firefoxUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
  webView.webContents.setUserAgent(firefoxUserAgent);
  
  // Load Google with parameters to prevent sign-in prompts and redirects
  // gl=us - US region, hl=en - English, gws_rd=cr - stay on .com, pws=0 - no personalization
  webView.webContents.loadURL('https://www.google.com/webhp?gl=us&hl=en&gws_rd=cr&pws=0');
  
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
    console.log(`📍 CDP endpoint available at: http://127.0.0.1:${CDP_PORT}`);
    console.log(`📁 User data directory: ${userDataPath}`);
    // Send initial tab info to renderer
    mainWindow.webContents.executeJavaScript(`
      // Create initial tab
      if (typeof initializeDefaultTab === 'function') {
        initializeDefaultTab('https://www.google.com', 'Google');
      } else {
        // Fallback: manually create tab
        const tabId = 'tab-' + Date.now();
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
    // Send navigation state update
    if (mainWindow && !mainWindow.isDestroyed()) {
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
    startTime: Date.now(),
    url: webView?.webContents.getURL(),
    title: await webView?.webContents.getTitle()
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
      
      // COMPREHENSIVE script that captures EVERYTHING
      const comprehensiveScript = `
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
                    selector: this.getCSSPath(e.target)
                  } : null,
                  
                  // Event-specific data
                  mousePosition: e.clientX !== undefined ? { x: e.clientX, y: e.clientY } : null,
                  key: e.key,
                  keyCode: e.keyCode,
                  ctrlKey: e.ctrlKey,
                  shiftKey: e.shiftKey,
                  altKey: e.altKey,
                  metaKey: e.metaKey,
                  
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
            
            // Regular comprehensive snapshots (aggressive - every 500ms)
            setInterval(() => {
              const snapshot = this.captureDOMStructure();
              this.domSnapshots.push(snapshot);
              
              // Keep only last 100 snapshots in memory
              if (this.domSnapshots.length > 100) {
                this.domSnapshots.shift();
              }
              
              console.log('Comprehensive snapshot captured:', {
                elements: snapshot.counts.total,
                interactive: snapshot.counts.interactive,
                timestamp: snapshot.timestamp
              });
            }, 500); // Aggressive capture every 500ms
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
          // Network events
          if (method.startsWith('Network.')) {
            recordingData.network.requests.push({
              method: method,
              params: params,
              timestamp: Date.now() - recordingData.startTime
            });
          }
          
          // Console events
          if (method === 'Runtime.consoleAPICalled') {
            recordingData.console.logs.push({
              type: params.type,
              args: params.args,
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
      
      // Start taking periodic screenshots (aggressive)
      startScreenshotCapture();
      
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
  
  // Collect all captured data
  let pageData = { actions: [], domSnapshots: [], mutations: [], visibilityChanges: [] };
  if (webView && debuggerAttached) {
    try {
      const result = await webView.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          const data = window.__comprehensiveRecording || { actions: [], domSnapshots: [], mutations: [], visibilityChanges: [] };
          
          // Recording stopped
          
          console.log('Collected comprehensive recording data:', {
            actions: data.actions.length,
            snapshots: data.domSnapshots.length,
            mutations: data.mutations.length,
            visibilityChanges: data.visibilityChanges.length
          });
          
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
  
  // Combine all data
  const finalData = {
    sessionId: `comprehensive-${recordingData.startTime}`,
    duration: recordingData.endTime - recordingData.startTime,
    url: recordingData.url,
    title: recordingData.title,
    
    // User interactions
    actions: pageData.actions || [],
    
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
  
  // Save data to file for analysis
  const fileName = `recording-${Date.now()}.json`;
  await fs.writeFile(fileName, JSON.stringify(finalData, null, 2));
  console.log(`💾 Recording saved to ${fileName}`);
  
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
  // In this simple implementation, switching tabs just means
  // potentially navigating to a different URL
  console.log(`Switch to tab: ${tabId}`);
  return true;
});

ipcMain.handle('create-tab', async (event, url) => {
  // Use the same Google URL with parameters for new tabs
  const targetUrl = url || 'https://www.google.com/webhp?gl=us&hl=en&gws_rd=cr&pws=0';
  const tabId = `tab-${Date.now()}`;
  const title = 'New Tab';
  
  // Since we only have one webView, we'll track tabs in the UI only
  console.log(`Creating new tab: ${tabId}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Add tab to UI
    await mainWindow.webContents.executeJavaScript(`
          // Add the new tab to UI
          const newTab = {
            id: '${tabId}',
            title: '${title}',
            url: '${targetUrl}',
            active: true
          };
          
          // Deactivate other tabs
          if (typeof tabs !== 'undefined') {
            tabs.forEach(tab => tab.active = false);
            tabs.set('${tabId}', newTab);
            activeTabId = '${tabId}';
          }
          
          // Update UI
          document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
          
          const tabElement = document.createElement('div');
          tabElement.className = 'tab active';
          tabElement.dataset.tabId = '${tabId}';
          tabElement.innerHTML = \`
            <span class="tab-title">\${newTab.title}</span>
            <button class="tab-close" onclick="closeTab('\${newTab.id}')">×</button>
          \`;
          
          tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
              switchToTab('${tabId}');
            }
          });
          
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
        `);
    
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
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}&gl=us&hl=en&pws=0`;
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