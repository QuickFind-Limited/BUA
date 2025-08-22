// Integrated Multi-Tab Recording System
// Combines all the proper fixes for tab context attribution

const { app, BrowserWindow, ipcMain, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { RecordingEventCollector, EVENT_TYPES } = require('./recording-event-collector');

// Keep using default Electron paths to preserve cookies and sessions
// This ensures Google sign-in and other authentications continue to work

// Only disable GPU cache to reduce errors without affecting functionality
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');

// Module-level variables
let mainWindow = null;
let webView = null;
let recordingCollector = null;
let debuggerAttached = false;
let sidebarWidth = 320;
let currentActiveTabId = 'tab-initial';

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
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadFile(path.join(__dirname, 'ui', 'tabbar.html'));
  mainWindow.maximize();
  mainWindow.show(); // Show after loading

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

  // Initialize default tab FIRST
  const initialTabId = 'tab-initial';
  tabsData.set(initialTabId, {
    id: initialTabId,
    url: 'https://www.google.com',
    title: 'Google'
  });
  currentActiveTabId = initialTabId;
  
  // Register initial tab with collector
  recordingCollector.registerTabContext(initialTabId, {
    url: 'https://www.google.com',
    title: 'Google',
    webContentsId: webView.webContents.id
  });

  console.log('📑 Initial tab created:', initialTabId);

  // Setup navigation handling for tab context
  setupNavigationHandling();

  // Load initial page
  webView.webContents.loadURL('https://www.google.com');
  
  // Initialize notification to UI
  mainWindow.on('resize', () => {
    updateWebViewBounds();
  });
  
  // Send initial tab data to UI immediately (UI is already loaded)
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const tabs = Array.from(tabsData.values());
        console.log('Sending initial tabs-updated with tabs:', tabs);
        mainWindow.webContents.send('tabs-updated', {
          tabs: tabs,
          activeTabId: initialTabId
        });
        
        // Send initial navigation state
        mainWindow.webContents.send('navigation-update', {
          canGoBack: false,
          canGoForward: false
        });
      } catch (error) {
        console.error('Error sending initial data to UI:', error);
      }
    }
  }, 100);
}

// Setup navigation handling with proper tab context
function setupNavigationHandling() {
  if (!webView || !webView.webContents) {
    console.error('WebView not ready for navigation handling');
    return;
  }
  
  webView.webContents.on('did-navigate', (event, url) => {
    const currentTabId = getCurrentTabId();
    console.log(`Navigation in tab ${currentTabId}: ${url}`);
    
    // Update tab data
    const tabData = tabsData.get(currentTabId);
    if (tabData) {
      tabData.url = url;
      recordingCollector.updateTabContext(currentTabId, { url });
    }
    
    // Send navigation update to UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-url-update', currentTabId, url);
      mainWindow.webContents.send('navigation-update', {
        canGoBack: webView.webContents.canGoBack(),
        canGoForward: webView.webContents.canGoForward()
      });
    }
    
    // Handle recording context during navigation
    if (recordingCollector.getActiveSessionId()) {
      recordingCollector.addAction({
        action: 'navigation',
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
    
    if (recordingCollector.getActiveSessionId()) {
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
      
      // Send title update to UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tab-title-update', currentTabId, title);
      }
    }
  });
}

// Get current active tab ID
function getCurrentTabId() {
  return currentActiveTabId;
}

// Update WebView bounds
function updateWebViewBounds() {
  if (!mainWindow || !webView) return;
  const bounds = mainWindow.contentView.getBounds();
  const navBarHeight = 88;
  
  webView.setBounds({
    x: sidebarWidth,
    y: navBarHeight,
    width: bounds.width - sidebarWidth,
    height: bounds.height - navBarHeight
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
    
    // Don't start interval screenshots - too large
    // startScreenshotCapture(currentTabId, sessionId);
    
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
  
  // Inject configuration with tab context and binding function
  const configScript = `
    window.__recordingConfig = {
      tabId: '${tabId}',
      sessionId: '${sessionId}',
      startTime: ${Date.now()}
    };
    window.__tabId = '${tabId}';
    
    // Create the binding function for sending data to main process
    window.__sendToMain = function(type, data) {
      if (window.sendToMainProcess) {
        window.sendToMainProcess(JSON.stringify([type, data]));
      }
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
  const activeSessionId = recordingCollector.getActiveSessionId();
  if (!activeSessionId) return;
  
  await injectRecordingScript(tabId, activeSessionId);
}

// Setup CDP event listeners
function setupCDPEventListeners(sessionId) {
  webView.webContents.debugger.on('message', (event, method, params) => {
    const currentTabId = getCurrentTabId();
    
    // Handle Runtime.bindingCalled for direct communication
    if (method === 'Runtime.bindingCalled' && params.name === 'sendToMainProcess') {
      try {
        const payload = JSON.parse(params.payload);
        // Handle events from page-recording-script.js
        if (payload[0] === 'page-recording:action') {
          const actionData = payload[1];
          // Store the action with its specific type
          recordingCollector.addAction({
            action: actionData.type,  // The actual event type (click, scroll, etc.)
            element: actionData.element,
            selector: actionData.selector,
            value: actionData.value,
            url: actionData.url,
            timestamp: actionData.timestamp,
            ...actionData  // Include all other event-specific data
          }, currentTabId);
        } else {
          handleRecordingEvent(payload, currentTabId);
        }
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
    
    // Handle network events - only log important ones
    if (method.startsWith('Network.')) {
      // Only log main frame navigations, not every resource
      if (method === 'Network.requestWillBeSent' && params.type === 'Document') {
        recordingCollector.addAction({
          action: 'network',
          method: method,
          url: params.request.url,
          timestamp: Date.now()
        }, currentTabId);
      }
    }
  });
}

// Handle recording events from page
function handleRecordingEvent(event, tabId) {
  if (!event || !recordingCollector.getActiveSessionId()) return;
  
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
      recordingCollector.addAction({
        action: 'navigation',
        ...event.data
      }, tabId);
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
    if (!recordingCollector.getActiveSessionId()) {
      clearInterval(screenshotInterval);
      return;
    }
    
    try {
      const screenshot = await webView.webContents.capturePage();
      const data = screenshot.toDataURL();
      
      recordingCollector.addAction({
        action: 'screenshot',
        screenshot: data,
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
    const activeSessionId = recordingCollector.getActiveSessionId();
    if (!activeSessionId) {
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
    
    // Capture final screenshot
    try {
      const screenshot = await webView.webContents.capturePage();
      const screenshotData = screenshot.toDataURL();
      recordingCollector.addAction({
        action: 'final-screenshot',
        screenshot: screenshotData,
        timestamp: Date.now()
      }, getCurrentTabId());
      console.log('📸 Final screenshot captured');
    } catch (error) {
      console.error('Failed to capture final screenshot:', error);
    }
    
    // Stop session and get data
    const recordingData = await recordingCollector.stopSession(activeSessionId);
    
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
    
    // Automatically start Intent Spec generation
    console.log('🤖 Starting automatic Intent Spec generation...');
    
    // Send progress update to UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis-progress', {
        status: 'starting',
        message: 'Analyzing recording to generate Intent Spec...'
      });
    }
    
    // Generate Intent Spec from the recording
    setTimeout(async () => {
      try {
        // Import the generator functions (use .js extension for compiled files)
        const { generateIntentSpecFromRichRecording } = require('./main/intent-spec-generator.js');
        const { generateEnhancedIntentSpecPrompt, generateVariableExtractionPrompt } = require('./main/enhanced-intent-spec-prompt.js');
        const { WorkflowAnalyzer } = require('./main/workflow-analyzer.js');
        const { analyzeRecording } = require('./dist/main/llm.js');
        
        // Send progress update
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('analysis-progress', {
            status: 'processing',
            message: 'Extracting actions and identifying variables...'
          });
        }
        
        // Debug: Check recording data structure
        console.log('Recording data structure:', {
          hasEvents: !!recordingData.events,
          eventCount: recordingData.events?.length || 0,
          hasActions: !!recordingData.actions,
          actionCount: recordingData.actions?.length || 0,
          keys: Object.keys(recordingData)
        });
        
        // Analyze the workflow to understand context
        const analyzer = new WorkflowAnalyzer();
        const workflowAnalysis = analyzer.analyzeWorkflow(recordingData.events || []);
        
        console.log('🧠 Workflow Analysis:', {
          type: workflowAnalysis.type,
          context: workflowAnalysis.context,
          suggestedVariables: workflowAnalysis.suggestedVariables
        });
        
        // Generate the Intent Spec using AI or fallback to hardcoded
        let intentSpec;
        const useAI = process.env.USE_AI_ANALYSIS !== 'false'; // Default to true unless explicitly disabled
        
        if (useAI) {
          try {
            console.log('🤖 Using AI to analyze recording and generate Intent Spec...');
            
            // Send progress update
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('analysis-progress', {
                status: 'analyzing',
                message: 'AI is analyzing your recording to understand the workflow...'
              });
            }
            
            // Call Claude to analyze the recording
            intentSpec = await analyzeRecording(recordingData);
            console.log('✅ AI analysis complete');
            
            // Enhance with workflow metadata
            intentSpec.workflow = {
              type: workflowAnalysis.type,
              context: workflowAnalysis.context.domain,
              processType: workflowAnalysis.context.processType,
              isMultiStep: workflowAnalysis.context.isMultiStep
            };
            
          } catch (aiError) {
            console.error('❌ AI analysis failed, falling back to rule-based generation:', aiError.message);
            
            // Send progress update about fallback
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('analysis-progress', {
                status: 'processing',
                message: 'Using rule-based analysis as fallback...'
              });
            }
            
            // Fallback to hardcoded generation
            intentSpec = generateIntentSpecFromRichRecording(recordingData);
          }
        } else {
          console.log('📋 Using rule-based Intent Spec generation (AI disabled)');
          intentSpec = generateIntentSpecFromRichRecording(recordingData);
        }
        
        // Extract variables with UI-compatible names
        const serializedRecording = JSON.stringify(recordingData, null, 2);
        const variablePrompt = generateVariableExtractionPrompt(serializedRecording);
        
        // Extract variables based on input values and context
        const extractedVariables = [];
        const seenVariables = new Set();
        const fieldLastValue = {}; // Track final value for each field
        const workflowSuggestions = workflowAnalysis.suggestedVariables || {};
        
        // First pass: collect the final value for each field
        if (recordingData.events) {
          recordingData.events.forEach(event => {
            if (event.type === 'action' && event.data) {
              const action = event.data;
              if (action.action === 'input' && action.value && action.selector) {
                // Keep updating with the latest value for this field
                fieldLastValue[action.selector] = {
                  value: action.value,
                  url: action.url,
                  element: action.element || action.elementInfo || {},
                  timestamp: action.timestamp
                };
              }
            }
          });
        }
        
        // Second pass: process only the final values for variable detection
        console.log(`🔍 Processing ${Object.keys(fieldLastValue).length} fields with final values`);
        Object.keys(fieldLastValue).forEach(selector => {
          const fieldData = fieldLastValue[selector];
          const action = {
            value: fieldData.value,
            url: fieldData.url,
            selector: selector
          };
          const elementInfo = fieldData.element;
          
          console.log(`  Field ${selector}: "${action.value}" on ${action.url}`);
          
          if (action.value) {
                let varName = 'VALUE';
                
                // elementInfo already defined above
                const fieldType = elementInfo.type || '';
                const fieldName = (elementInfo.name || elementInfo.id || '').toLowerCase();
                const placeholder = (elementInfo.placeholder || '').toLowerCase();
                
                // Try to get field label from text or aria-label
                const fieldText = (elementInfo.text || elementInfo['aria-label'] || '').toLowerCase();
                
                // Check URL context for business-specific detection
                const url = action.url || '';
                const isInventoryPage = url.includes('inventory') || url.includes('product') || url.includes('item');
                
                // First check workflow suggestions for intelligent naming
                let workflowSuggestion = null;
                for (const [key, value] of Object.entries(workflowSuggestions)) {
                  if (fieldName.includes(key) || placeholder.includes(key) || fieldText.includes(key)) {
                    workflowSuggestion = value;
                    break;
                  }
                }
                
                if (workflowSuggestion) {
                  console.log(`    📊 Using workflow suggestion: ${workflowSuggestion} for field ${selector}`);
                  varName = workflowSuggestion;
                } else if (fieldType === 'password' || fieldName.includes('password') || placeholder.includes('password')) {
                  varName = 'PASSWORD';
                } else if (fieldType === 'email' || fieldName.includes('email') || placeholder.includes('email')) {
                  varName = 'EMAIL_ADDRESS';
                } else if (fieldName.includes('username') || fieldName.includes('user') || placeholder.includes('username')) {
                  varName = 'USERNAME';
                } else if (fieldType === 'tel' || fieldName.includes('phone') || placeholder.includes('phone')) {
                  varName = 'PHONE_NUMBER';
                } else if (fieldName.includes('search') || fieldName.includes('query') || placeholder.includes('search')) {
                  varName = 'SEARCH_QUERY';
                } else if (isInventoryPage) {
                  // Context-aware detection for inventory/product pages
                  // Use field text, placeholder, or position to determine type
                  if (fieldText.includes('name') || placeholder.includes('name') || fieldName.includes('name')) {
                    varName = 'ITEM_NAME';
                  } else if (fieldText.includes('selling') || fieldText.includes('sell') || placeholder.includes('selling')) {
                    varName = 'SELLING_PRICE';
                  } else if (fieldText.includes('cost') || fieldText.includes('buy') || placeholder.includes('cost')) {
                    varName = 'COST_PRICE';
                  } else if (fieldText.includes('sku') || placeholder.includes('sku')) {
                    varName = 'SKU';
                  } else if (fieldText.includes('quantity') || fieldText.includes('qty')) {
                    varName = 'QUANTITY';
                  } else if (fieldText.includes('description')) {
                    varName = 'DESCRIPTION';
                  } else if (/^\d+(\.\d+)?$/.test(action.value)) {
                    // Numeric value on inventory page - likely a price
                    if (!seenVariables.has('SELLING_PRICE')) {
                      varName = 'SELLING_PRICE';
                    } else if (!seenVariables.has('COST_PRICE')) {
                      varName = 'COST_PRICE';
                    } else {
                      varName = 'AMOUNT';
                    }
                  } else if (action.value.length > 3) {
                    // Text value on inventory page - likely item name
                    if (!seenVariables.has('ITEM_NAME')) {
                      varName = 'ITEM_NAME';
                    }
                  }
                } else {
                  // Generic detection for other contexts
                  if (fieldName.includes('first') || placeholder.includes('first name')) {
                    varName = 'FIRST_NAME';
                  } else if (fieldName.includes('last') || placeholder.includes('last name')) {
                    varName = 'LAST_NAME';
                  } else if (fieldName.includes('company') || placeholder.includes('company')) {
                    varName = 'COMPANY_NAME';
                  } else if (fieldName.includes('amount') || fieldName.includes('price')) {
                    varName = 'AMOUNT';
                  }
                }
                
                // Add to variables list if not already present
                if (!seenVariables.has(varName)) {
                  console.log(`    ✅ Detected variable: ${varName}`);
                  extractedVariables.push(varName);
                  seenVariables.add(varName);
                }
              }
        });
        
        // Update Intent Spec with variables (prefer AI-detected, fallback to extracted)
        if (!intentSpec.params || intentSpec.params.length === 0) {
          // Only override if AI didn't provide variables
          intentSpec.params = extractedVariables.length > 0 ? extractedVariables : ['USERNAME', 'PASSWORD'];
        } else {
          console.log('📝 Using AI-detected variables:', intentSpec.params);
        }
        
        // Add workflow metadata if not already present
        if (!intentSpec.workflow) {
          intentSpec.workflow = {
            type: workflowAnalysis.type,
            context: workflowAnalysis.context.domain,
            processType: workflowAnalysis.context.processType,
            isMultiStep: workflowAnalysis.context.isMultiStep
          };
        }
        
        // Send progress update
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('analysis-progress', {
            status: 'complete',
            message: `Intent Spec generated with ${intentSpec.steps.length} steps and ${intentSpec.params.length} variables`
          });
          
          // Show only the Intent Spec with variables in the vars panel (not full spec)
          // The vars panel only needs name, description, params, and url
          const intentSpecForVarsPanel = {
            name: intentSpec.name,
            description: intentSpec.description || `Automated flow from recording with ${intentSpec.steps.length} steps`,
            params: intentSpec.params,
            url: intentSpec.url || recordingData.events?.[0]?.data?.url || 'https://example.com'
          };
          
          mainWindow.webContents.send('show-intent-spec', intentSpecForVarsPanel);
        }
        
        // Save the Intent Spec
        const intentSpecFilename = `intent-spec-${timestamp}.json`;
        const intentSpecPath = path.join(app.getPath('userData'), 'recordings', intentSpecFilename);
        await fs.writeFile(intentSpecPath, JSON.stringify(intentSpec, null, 2));
        
        console.log(`📝 Intent Spec saved to: ${intentSpecFilename}`);
        console.log(`✅ Analysis complete. Variables detected: ${intentSpec.params.join(', ')}`);
        
      } catch (error) {
        console.error('Failed to generate Intent Spec:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('analysis-progress', {
            status: 'error',
            message: `Failed to generate Intent Spec: ${error.message}`
          });
        }
      }
    }, 1000); // Small delay to ensure UI is ready
    
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
  
  // Set as active tab
  currentActiveTabId = tabId;
  
  // Register with collector if recording
  if (recordingCollector.getActiveSessionId()) {
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
  
  // Update UI with all tabs
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tabs-updated', {
      tabs: Array.from(tabsData.values()),
      activeTabId: tabId
    });
  }
  
  return { success: true, tabId };
});

ipcMain.handle('switch-tab', async (event, tabId) => {
  console.log(`Switch to tab: ${tabId}`);
  
  const tabData = tabsData.get(tabId);
  if (tabData && webView) {
    // Update active tab
    currentActiveTabId = tabId;
    // Track tab switch in recording
    if (recordingCollector.getActiveSessionId()) {
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
    
    // Update UI to show active tab
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tabs-updated', {
        tabs: Array.from(tabsData.values()),
        activeTabId: tabId
      });
    }
    
    return true;
  }
  
  return false;
});

// Add missing IPC handlers for UI compatibility
ipcMain.handle('navigate-tab', async (event, tabId, url) => {
  const targetUrl = url.startsWith('http') ? url : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  
  if (recordingCollector.getActiveSessionId()) {
    recordingCollector.addAction({
      action: 'navigate',
      url: targetUrl,
      timestamp: Date.now()
    }, tabId || getCurrentTabId());
  }
  
  await webView.webContents.loadURL(targetUrl);
  return { success: true };
});

ipcMain.handle('tab-back', async (event, tabId) => {
  if (webView.webContents.canGoBack()) {
    webView.webContents.goBack();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('tab-forward', async (event, tabId) => {
  if (webView.webContents.canGoForward()) {
    webView.webContents.goForward();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('reload-tab', async (event, tabId) => {
  webView.webContents.reload();
  return { success: true };
});

ipcMain.handle('close-tab', async (event, tabId) => {
  tabsData.delete(tabId);
  if (recordingCollector.getActiveSessionId()) {
    recordingCollector.addAction({
      action: 'close-tab',
      tabId: tabId,
      timestamp: Date.now()
    }, tabId);
  }
  
  // Update UI with remaining tabs
  if (mainWindow && !mainWindow.isDestroyed()) {
    const remainingTabs = Array.from(tabsData.values());
    const newActiveTab = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null;
    
    mainWindow.webContents.send('tabs-updated', {
      tabs: remainingTabs,
      activeTabId: newActiveTab
    });
    
    // If there's an active tab, navigate to it
    if (newActiveTab) {
      const tabData = tabsData.get(newActiveTab);
      if (tabData && webView) {
        await webView.webContents.loadURL(tabData.url);
      }
    }
  }
  
  return { success: true };
});

ipcMain.handle('sidebar:resize', async (event, width) => {
  sidebarWidth = width;
  updateWebViewBounds();
  return { success: true };
});

// Enhanced recording status and pause/resume handlers
ipcMain.handle('enhanced-recording-status', async () => {
  const hasActiveSession = recordingCollector.getActiveSessionId();
  return { 
    success: true, 
    data: { 
      isRecording: hasActiveSession,
      isPaused: false // We don't have pause functionality yet 
    } 
  };
});

// Pause/resume handlers - not implemented yet
ipcMain.handle('pause-enhanced-recording', async () => {
  return { success: false, message: 'Pause not implemented' };
});

ipcMain.handle('resume-enhanced-recording', async () => {
  return { success: false, message: 'Resume not implemented' };
});

// Clean up only problematic caches on startup, preserve cookies/auth
async function cleanupOldCache() {
  try {
    const { session } = require('electron');
    // Only clear service workers and cache storage that cause errors
    // Do NOT clear cookies, localStorage, or sessionStorage
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage'],
      quotas: ['temporary']
    });
    console.log('✅ Service worker cache cleaned');
  } catch (error) {
    console.warn('Could not clear cache:', error.message);
  }
}

// Initialize app
app.whenReady().then(async () => {
  // Clean up cache to prevent IO errors
  await cleanupOldCache();
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = { recordingCollector };