// Tab management and IPC communication with main process

let activeTabId = null;
let tabs = new Map();

// Make tabs globally accessible for dynamic tab creation
window.tabs = tabs;
window.activeTabId = activeTabId;

// Function to load the full Intent Spec from file
async function loadFullIntentSpec() {
    try {
        // Try multiple paths to find the Intent Spec file
        // Using the latest generated Intent Spec
        const paths = [
            './intent-spec-1756038275999.json',
            '../intent-spec-1756038275999.json',
            'intent-spec-1756038275999.json',
            // Fallback to older spec if new one not found
            './intent-spec-1755985558961.json',
            '../intent-spec-1755985558961.json',
            'intent-spec-1755985558961.json'
        ];
        
        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const spec = await response.json();
                    console.log(`✅ Loaded Intent Spec from ${path}`);
                    return spec;
                }
            } catch (e) {
                // Try next path
            }
        }
        
        // If file loading fails, check localStorage
        const storedSpec = localStorage.getItem('lastIntentSpec');
        if (storedSpec) {
            console.log('✅ Loaded Intent Spec from localStorage');
            return JSON.parse(storedSpec);
        }
        
    } catch (error) {
        console.error('Failed to load Intent Spec:', error);
    }
    
    return null;
}

// Test Flow Function for Zoho Inventory
window.runTestFlow = async function() {
    console.log('🧪 Running test flow for Zoho Inventory...');
    
    // Test values
    const testValues = {
        LOGIN_ID: "admin@quickfindai.com",
        PASSWORD: "#QuickFind",
        ITEM_NAME: "Test Box 3676",
        SELLING_PRICE: "400",
        COST_PRICE: "300"
    };
    
    try {
        // First priority: Use the last generated Intent Spec if available
        let intentSpec = window.lastIntentSpec;
        
        if (intentSpec) {
            console.log('✅ Using last generated Intent Spec');
        } else {
            // Second priority: Load the full Intent Spec from saved file
            console.log('Loading full Intent Spec from file...');
            
            // Use the full Intent Spec data directly (embedded for reliability)
            intentSpec = await loadFullIntentSpec();
            
            if (intentSpec) {
                console.log('✅ Loaded full Intent Spec with', intentSpec.steps?.length, 'steps');
                // Store it for future use
                window.lastIntentSpec = intentSpec;
            }
        }
        
        // Show the vars panel with the Intent Spec
        if (window.varsPanelManager) {
            window.varsPanelManager.showVarsPanel(intentSpec);
            
            // Auto-fill the test values after a short delay
            setTimeout(() => {
                Object.keys(testValues).forEach(key => {
                    const input = document.querySelector(`#var-${key}`);
                    if (input) {
                        input.value = testValues[key];
                        // Trigger change event
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
                
                console.log('✅ Test values filled. Starting automation directly...');
                
                // Automatically execute the flow with the test values
                setTimeout(() => {
                    console.log('🚀 Executing test flow with Magnitude...');
                    
                    // Use runMagnitudeWithWebView which is the correct handler
                    if (window.electronAPI && window.electronAPI.runMagnitudeWithWebView) {
                        window.electronAPI.runMagnitudeWithWebView(intentSpec, testValues)
                            .then(result => {
                                console.log('Test execution result:', result);
                                
                                // Show result notification
                                const notification = document.createElement('div');
                                notification.style.cssText = `
                                    position: fixed;
                                    top: 100px;
                                    right: 20px;
                                    background: ${result.success ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ff4444'};
                                    color: white;
                                    padding: 15px 20px;
                                    border-radius: 8px;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                                    z-index: 10000;
                                    animation: slideIn 0.3s ease;
                                `;
                                notification.innerHTML = result.success 
                                    ? '✅ Test flow completed successfully!' 
                                    : `❌ Test failed: ${result.error || 'Unknown error'}`;
                                document.body.appendChild(notification);
                                
                                setTimeout(() => notification.remove(), 5000);
                            })
                            .catch(error => {
                                console.error('Test execution error:', error);
                                alert(`Test execution failed: ${error.message}`);
                            });
                    } else {
                        console.error('runMagnitudeWithWebView API not available');
                        alert('Execution API not available. Please check the configuration.');
                    }
                }, 1000); // Small delay to let the UI update
            }, 500);
        } else {
            console.error('Vars panel manager not available');
        }
    } catch (error) {
        console.error('Failed to load test configuration:', error);
        alert('Please complete a recording first to generate an Intent Spec.');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing tab manager...');
    console.log('📋 Available electronAPI methods:', Object.keys(window.electronAPI || {}));
    initializeUI();
    // Initial tab will be created by main process
});

function initializeUI() {
    // Set up new tab button
    const newTabBtn = document.getElementById('new-tab-btn');
    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => createNewTab());
    }

    // Set up navigation buttons
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const goBtn = document.getElementById('go-btn');
    const addressBar = document.getElementById('address-bar');
    const launcherBtn = document.getElementById('launcher-btn');
    const enhancedRecorderBtn = document.getElementById('enhanced-recorder-btn');
    const settingsBtn = document.getElementById('settings-btn');

    if (backBtn) {
        console.log('🔙 Back button found, adding event listener');
        backBtn.addEventListener('click', () => {
            console.log('🔙 Back button clicked directly');
            navigateBack();
        });
    } else {
        console.error('❌ Back button not found!');
    }
    
    if (forwardBtn) {
        console.log('🔜 Forward button found, adding event listener');
        forwardBtn.addEventListener('click', () => {
            console.log('🔜 Forward button clicked directly');
            navigateForward();
        });
    } else {
        console.error('❌ Forward button not found!');
    }
    if (reloadBtn) reloadBtn.addEventListener('click', () => reloadPage());
    if (goBtn) goBtn.addEventListener('click', () => navigateToUrl());
    if (launcherBtn) launcherBtn.addEventListener('click', () => launchPlaywrightRecorder());
    if (enhancedRecorderBtn) enhancedRecorderBtn.addEventListener('click', () => toggleEnhancedRecording());
    if (settingsBtn) settingsBtn.addEventListener('click', () => openSettings());

    // Connect the run-magnitude button to execute the flow
    const runMagnitudeBtn = document.getElementById('run-magnitude-btn');
    if (runMagnitudeBtn) {
        runMagnitudeBtn.addEventListener('click', () => {
            // Check if varsPanelManager exists and has a flow loaded
            if (window.varsPanelManager && window.varsPanelManager.currentFlow) {
                console.log('Executing flow from Start Automation button');
                window.varsPanelManager.executeFlow();
            } else {
                console.warn('No flow loaded or varsPanelManager not initialized');
                // Show a message to the user
                const statusText = document.getElementById('flow-variables-status');
                if (statusText) {
                    statusText.textContent = 'Please load a flow first';
                    statusText.style.color = '#ff4444';
                    setTimeout(() => {
                        statusText.textContent = '';
                    }, 3000);
                }
            }
        });
    }

    // Address bar enter key
    if (addressBar) {
        addressBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                navigateToUrl();
            }
        });
    }

    // Listen for tab updates from main process
    if (window.electronAPI) {
        window.electronAPI.onTabsUpdated((data) => {
            updateTabDisplay(data.tabs, data.activeTabId);
        });

        window.electronAPI.onNavigationUpdate((data) => {
            updateNavigationState(data);
        });

        window.electronAPI.onTabTitleUpdate((tabId, title) => {
            updateTabTitle(tabId, title);
        });

        window.electronAPI.onTabUrlUpdate((tabId, url) => {
            updateTabUrl(tabId, url);
            if (tabId === activeTabId) {
                updateAddressBar(url);
            }
        });

        // Listen for recording completion
        window.electronAPI.onRecordingComplete && window.electronAPI.onRecordingComplete((intentSpec) => {
            handleRecordingComplete(intentSpec);
        });
    }
}

function createInitialTab() {
    const tabId = 'tab-' + Date.now();
    const tab = {
        id: tabId,
        title: 'Google',
        url: 'https://www.google.com',
        active: true
    };
    
    tabs.set(tabId, tab);
    activeTabId = tabId;
    
    // Add tab to UI
    addTabToUI(tab);
    
    // Send IPC message to create tab in main process
    if (window.electronAPI) {
        window.electronAPI.createTab(tab.url);
    }
    
    // Update status
    updateStatus();
}

async function createNewTab(url = 'https://www.google.com') {
    // Just send IPC message to create tab in main process
    // The main process will send back the tab update which will update the UI
    if (window.electronAPI) {
        await window.electronAPI.createTab(url);
    }
}

function addTabToUI(tab) {
    const tabsContainer = document.getElementById('tabs-container');
    if (!tabsContainer) return;
    
    const tabElement = document.createElement('div');
    tabElement.className = 'tab' + (tab.active ? ' active' : '');
    tabElement.dataset.tabId = tab.id;
    tabElement.innerHTML = `
        <span class="tab-title">${tab.title}</span>
        <button class="tab-close" onclick="closeTab('${tab.id}')">×</button>
    `;
    
    tabElement.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
            switchToTab(tab.id);
        }
    });
    
    // Insert tab before the + button (which is the last child)
    const newTabBtn = document.getElementById('new-tab-btn');
    if (newTabBtn && newTabBtn.parentNode === tabsContainer) {
        tabsContainer.insertBefore(tabElement, newTabBtn);
    } else {
        tabsContainer.appendChild(tabElement);
    }
}

function switchToTab(tabId) {
    // Update active state
    tabs.forEach((tab, id) => {
        tab.active = (id === tabId);
    });
    activeTabId = tabId;
    window.activeTabId = tabId; // Keep global reference updated
    
    // Update tab UI
    document.querySelectorAll('.tab').forEach(el => {
        if (el.dataset.tabId === tabId) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    
    // Send IPC message to switch tab in main process
    if (window.electronAPI) {
        window.electronAPI.switchTab(tabId);
    }
    
    // Update address bar with current tab URL
    const tab = tabs.get(tabId);
    if (tab) {
        updateAddressBar(tab.url);
    }
}

function closeTab(tabId) {
    console.log(`Closing tab: ${tabId}`);
    
    // Don't close if it's the only tab
    if (tabs.size <= 1) {
        console.log('Cannot close the only tab');
        return;
    }
    
    // Call IPC to handle the close properly (it will handle UI removal and navigation)
    if (window.electronAPI && window.electronAPI.closeTab) {
        window.electronAPI.closeTab(tabId).then(result => {
            console.log('Tab closed via IPC:', result);
            updateStatus();
        }).catch(err => {
            console.error('Failed to close tab:', err);
            // Fallback: remove from UI locally
            tabs.delete(tabId);
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabElement) tabElement.remove();
            
            // If this was the active tab, switch to another
            if (activeTabId === tabId) {
                const firstTab = tabs.keys().next().value;
                if (firstTab) {
                    switchToTab(firstTab);
                }
            }
            updateStatus();
        });
    } else {
        console.error('electronAPI.closeTab not available');
    }
}

// Make functions globally available for dynamically created tabs
window.closeTab = closeTab;
window.switchToTab = switchToTab;

function updateTabTitle(tabId, title) {
    const tab = tabs.get(tabId);
    if (tab) {
        tab.title = title || 'New Tab';
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
        if (tabElement) {
            tabElement.textContent = tab.title;
        }
    }
}

function updateTabUrl(tabId, url) {
    const tab = tabs.get(tabId);
    if (tab) {
        tab.url = url;
    }
}

function updateAddressBar(url) {
    const addressBar = document.getElementById('address-bar');
    if (addressBar) {
        addressBar.value = url || '';
    }
}

function navigateToUrl() {
    const addressBar = document.getElementById('address-bar');
    if (!addressBar) return;
    
    let url = addressBar.value.trim();
    if (!url) return;
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // Check if it looks like a URL
        if (url.includes('.') && !url.includes(' ')) {
            url = 'https://' + url;
        } else {
            // Treat as search
            url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
    }
    
    // Send IPC message to navigate current tab
    if (window.electronAPI && activeTabId) {
        window.electronAPI.navigateTab(activeTabId, url);
    }
}

async function navigateBack() {
    console.log('🔙 Back button clicked, activeTabId:', activeTabId);
    if (window.electronAPI && activeTabId) {
        try {
            const result = await window.electronAPI.goBack(activeTabId);
            console.log('🔙 Navigation back result:', result);
        } catch (error) {
            console.error('❌ Navigation back error:', error);
        }
    } else {
        console.error('❌ No electronAPI or activeTabId available');
    }
}

async function navigateForward() {
    console.log('🔜 Forward button clicked, activeTabId:', activeTabId);
    if (window.electronAPI && activeTabId) {
        try {
            const result = await window.electronAPI.goForward(activeTabId);
            console.log('🔜 Navigation forward result:', result);
        } catch (error) {
            console.error('❌ Navigation forward error:', error);
        }
    } else {
        console.error('❌ No electronAPI or activeTabId available');
    }
}

function reloadPage() {
    if (window.electronAPI && activeTabId) {
        window.electronAPI.reloadTab(activeTabId);
    }
}

function updateNavigationState(data) {
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    if (backBtn) {
        backBtn.disabled = !data.canGoBack;
    }
    if (forwardBtn) {
        forwardBtn.disabled = !data.canGoForward;
    }
}

// Global variables for recorder state
let recorderMonitorInterval = null;
let currentRecordingPath = null;
let isMonitoringRecorder = false;
let lastRecordingData = null;

async function launchPlaywrightRecorder() {
    const launcherBtn = document.getElementById('launcher-btn');
    if (!launcherBtn) return;
    
    if (isMonitoringRecorder) {
        console.log('Recorder already monitoring...');
        return;
    }
    
    console.log('Launching Playwright recorder...');
    
    try {
        // Get current URL from address bar or use default
        const addressBar = document.getElementById('address-bar');
        const startUrl = addressBar ? addressBar.value : 'https://www.google.com';
        
        // Launch recorder removed - using CDP recording instead
        console.log('Playwright launcher removed - using CDP recording');
        showRecordingError('Please use the Recording button instead (CDP-based recording)');
    } catch (error) {
        console.error('Error launching recorder:', error);
        showRecordingError('Error launching recorder: ' + error.message);
    }
}

// Start monitoring the recorder process and file
function startRecorderMonitoring() {
    console.log('Starting recorder monitoring...');
    
    // Listen for recorder events from main process
    if (window.electronAPI) {
        // Listen for when recording is launched
        if (window.electronAPI.onRecordingLaunched) {
            window.electronAPI.onRecordingLaunched((data) => {
                console.log('Recording launched:', data);
            });
        }
        
        // Listen for when recording starts (file detected)
        if (window.electronAPI.onRecordingStarted) {
            window.electronAPI.onRecordingStarted((data) => {
                console.log('Recording started:', data);
                lastRecordingData = data;
                // Show Begin Analysis button immediately (disabled initially)
                showBeginAnalysisButton(data.buttonEnabled || false);
            });
        }
        
        // Listen for when browser closes (enable the button)
        if (window.electronAPI.onBrowserClosed) {
            window.electronAPI.onBrowserClosed((data) => {
                console.log('Browser closed, enabling button');
                // Only enable the button if analysis hasn't started
                const beginAnalysisBtn = document.getElementById('begin-analysis-btn');
                if (beginAnalysisBtn) {
                    // Check if analysis is already in progress
                    // Don't enable if button text is "Analyzing..." or sidebar is showing
                    const isAnalyzing = beginAnalysisBtn.textContent === 'Analyzing...' || 
                                       beginAnalysisBtn.classList.contains('analyzing');
                    const sidebarVisible = document.getElementById('analysis-sidebar')?.classList.contains('open');
                    
                    if (!isAnalyzing && !sidebarVisible) {
                        beginAnalysisBtn.disabled = false;
                        beginAnalysisBtn.title = 'Analyze Recording';
                    } else {
                        console.log('Analysis in progress, keeping button disabled');
                    }
                }
            });
        }
        
        // Listen for when recording is saved
        if (window.electronAPI.onRecordingSaved) {
            window.electronAPI.onRecordingSaved((data) => {
                console.log('Recording saved:', data);
                lastRecordingData = data;
            });
        }
        
        // Listen for when recording is complete
        if (window.electronAPI.onRecordingComplete) {
            window.electronAPI.onRecordingComplete((data) => {
                console.log('Recording complete:', data);
                lastRecordingData = data;
            });
        }
        
        // Listen for when recording is cancelled
        if (window.electronAPI.onRecordingCancelled) {
            window.electronAPI.onRecordingCancelled((data) => {
                console.log('Recording cancelled:', data);
            });
        }
        
        // Listen for when recorder process exits
        if (window.electronAPI.onRecorderExit) {
            window.electronAPI.onRecorderExit((data) => {
                console.log('Recorder exited:', data);
                handleRecorderExit(data);
            });
        }
    }
    
    // Also poll periodically to check recorder status
    recorderMonitorInterval = setInterval(async () => {
        try {
            if (window.electronAPI && window.electronAPI.getRecorderStatus) {
                const status = await window.electronAPI.getRecorderStatus();
                
                if (!status.isRecording && lastRecordingData) {
                    // Recorder has stopped and we have recording data
                    handleRecorderExit({ hasRecording: true });
                }
            }
        } catch (error) {
            console.error('Error checking recorder status:', error);
        }
    }, 2000); // Check every 2 seconds
}

// Show Begin Analysis button immediately when recording starts
function showBeginAnalysisButton(enabled = false) {
    console.log('Showing Begin Analysis button, enabled:', enabled);
    
    const recordingControls = document.querySelector('.recording-controls');
    if (recordingControls) {
        recordingControls.innerHTML = `
            <button class="begin-analysis-btn" id="begin-analysis-btn" title="${enabled ? 'Analyze Recording' : 'Close browser to enable'}" ${enabled ? '' : 'disabled'}>
                <span class="analysis-text">Begin Analysis</span>
            </button>
        `;
        
        // Add event listener to begin analysis button
        const beginAnalysisBtn = document.getElementById('begin-analysis-btn');
        if (beginAnalysisBtn) {
            beginAnalysisBtn.addEventListener('click', async () => {
                console.log('Begin analysis clicked');
                await analyzeRecording();
            });
        }
    }
}

// Handle when recorder process exits
function handleRecorderExit(data) {
    console.log('Handling recorder exit:', data);
    
    // Stop monitoring
    if (recorderMonitorInterval) {
        clearInterval(recorderMonitorInterval);
        recorderMonitorInterval = null;
    }
    isMonitoringRecorder = false;
    
    const launcherBtn = document.getElementById('launcher-btn');
    const recordingControls = document.querySelector('.recording-controls');
    
    if (data.hasRecording || lastRecordingData) {
        // Recording was saved, show Begin Analysis button
        console.log('Recording available, showing Begin Analysis button');
        
        if (recordingControls) {
            recordingControls.innerHTML = `
                <button class="begin-analysis-btn" id="begin-analysis-btn" title="Analyze Recording">
                    <span class="analysis-text">Begin Analysis</span>
                </button>
            `;
            
            // Add event listener to begin analysis button
            const beginAnalysisBtn = document.getElementById('begin-analysis-btn');
            if (beginAnalysisBtn) {
                beginAnalysisBtn.addEventListener('click', async () => {
                    console.log('Begin analysis clicked');
                    await analyzeRecording();
                });
            }
        }
    } else {
        // No recording, restore Launch Recorder button
        console.log('No recording saved, restoring Launch Recorder button');
        
        if (launcherBtn) {
            launcherBtn.classList.remove('monitoring');
            launcherBtn.querySelector('.launcher-text').textContent = 'Launch Recorder';
        }
    }
}

// Analyze the recorded Playwright spec
async function analyzeRecording() {
    console.log('Starting analysis of recording...');
    
    const beginAnalysisBtn = document.getElementById('begin-analysis-btn');
    if (beginAnalysisBtn) {
        beginAnalysisBtn.disabled = true;
        beginAnalysisBtn.classList.add('analyzing');
        beginAnalysisBtn.querySelector('.analysis-text').textContent = 'Analyzing...';
    }
    
    // Get the recording data (either from lastRecordingData or from the saved file)
    let recordingData = lastRecordingData;
    
    if (!recordingData && window.electronAPI && window.electronAPI.getLastRecording) {
        recordingData = await window.electronAPI.getLastRecording();
    }
    
    if (recordingData && recordingData.specCode) {
        // Create a session object for compatibility
        const session = {
            id: recordingData.sessionId || Date.now().toString(),
            url: recordingData.url || 'https://www.google.com',
            title: 'Recorded Flow',
            specCode: recordingData.specCode,
            path: recordingData.path
        };
        
        // Store for analysis
        window.lastRecordingSession = session;
        
        // Trigger analysis
        await analyzeLastRecording();
        
        // After analysis, restore the Launch Recorder button
        const recordingControls = document.querySelector('.recording-controls');
        if (recordingControls) {
            recordingControls.innerHTML = `
                <button class="launcher-btn" id="launcher-btn" title="Launch Playwright Recorder">
                    <span class="launcher-text">Launch Recorder</span>
                </button>
            `;
            
            // Re-add event listener
            const newLauncherBtn = document.getElementById('launcher-btn');
            if (newLauncherBtn) {
                newLauncherBtn.addEventListener('click', () => launchPlaywrightRecorder());
            }
        }
    } else {
        console.error('No recording data available for analysis');
        showRecordingError('No recording data available');
        
        if (beginAnalysisBtn) {
            beginAnalysisBtn.disabled = false;
            beginAnalysisBtn.querySelector('.analysis-text').textContent = 'Begin Analysis';
        }
    }
}

// Handle completed recording data (kept for IPC listener compatibility)
function handleRecordingComplete(session) {
    console.log('Recording session complete (stop button clicked):', session);
    
    // Store the recording session for analysis
    window.lastRecordingSession = session;
    lastRecordingData = session;
    
    // Stop monitoring since recording is complete
    if (recorderMonitorInterval) {
        clearInterval(recorderMonitorInterval);
        recorderMonitorInterval = null;
    }
    isMonitoringRecorder = false;
    
    // Show Begin Analysis button immediately
    const recordingControls = document.querySelector('.recording-controls');
    if (recordingControls) {
        console.log('Showing Begin Analysis button after stop button click');
        recordingControls.innerHTML = `
            <button class="begin-analysis-btn" id="begin-analysis-btn" title="Analyze Recording">
                <span class="analysis-text">Begin Analysis</span>
            </button>
        `;
        
        // Add event listener to begin analysis button
        const beginAnalysisBtn = document.getElementById('begin-analysis-btn');
        if (beginAnalysisBtn) {
            beginAnalysisBtn.addEventListener('click', async () => {
                console.log('Begin analysis clicked');
                await analyzeRecording();
            });
        }
    }
    
    // Show recording summary
    showRecordingSummary(session);
    
    // Optionally trigger onRecordingComplete callback if set
    if (window.recordingCompleteCallback) {
        window.recordingCompleteCallback(session);
    }
    
    // Emit custom event for other parts of the app to listen to
    window.dispatchEvent(new CustomEvent('recordingComplete', { detail: session }));
}

// Show recording summary in UI
function showRecordingSummary(session) {
    const statusText = document.getElementById('status-text');
    
    // Handle both old format (with actions) and new format (with session/specCode)
    const actualSession = session.session || session;
    const hasActions = session.actions && Array.isArray(session.actions);
    
    if (statusText) {
        if (hasActions) {
            statusText.textContent = `Recording complete: ${session.actions.length} actions captured`;
        } else {
            statusText.textContent = `Recording complete - ready for analysis`;
        }
        
        // Reset status after 5 seconds
        setTimeout(() => {
            statusText.textContent = 'Ready';
        }, 5000);
    }
    
    // Log detailed summary to console
    console.group('Recording Summary');
    console.log('Session ID:', actualSession.id);
    
    if (actualSession.startTime && actualSession.endTime) {
        console.log('Duration:', ((actualSession.endTime - actualSession.startTime) / 1000).toFixed(1) + 's');
    }
    
    if (hasActions) {
        console.log('Actions:', session.actions.length);
        // Group actions by type
        const actionsByType = {};
        session.actions.forEach(action => {
            actionsByType[action.type] = (actionsByType[action.type] || 0) + 1;
        });
        console.log('Action breakdown:', actionsByType);
    } else if (session.specCode) {
        console.log('Playwright spec generated');
        console.log('Spec length:', session.specCode.length, 'characters');
    }
    
    console.log('URL:', actualSession.url);
    console.log('Title:', actualSession.title);
    
    if (session.screenshotPath || actualSession.screenshotPath) {
        console.log('Screenshot:', session.screenshotPath || actualSession.screenshotPath);
    }
    
    console.groupEnd();
}

// Show recording status message
function showRecordingStatus(message) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.textContent = message;
        
        // Reset status after 3 seconds
        setTimeout(() => {
            statusText.textContent = 'Ready';
        }, 3000);
    }
}

// Show recording error message
function showRecordingError(errorMessage) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.textContent = errorMessage;
        statusText.style.color = '#ff6b6b';
        
        // Reset status and color after 5 seconds
        setTimeout(() => {
            statusText.textContent = 'Ready';
            statusText.style.color = '';
        }, 5000);
    }
    
    console.error('Recording Error:', errorMessage);
}

// Function to set a callback for recording completion
function onRecordingComplete(callback) {
    window.recordingCompleteCallback = callback;
}

// Make functions globally available
window.onRecordingComplete = onRecordingComplete;

// Analysis Progress Sidebar Management
class AnalysisSidebar {
    constructor() {
        this.sidebar = document.getElementById('analysis-sidebar');
        this.toggleBtn = document.getElementById('sidebar-toggle-btn');
        // Timer element removed
        this.detailContent = document.getElementById('detail-content');
        this.isCollapsed = false;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
    }
    
    show() {
        if (this.sidebar) {
            this.sidebar.classList.add('active');
            document.body.classList.add('sidebar-visible');
            // Timer removed
            this.resetProgress();
        }
    }
    
    hide() {
        if (this.sidebar) {
            this.sidebar.classList.remove('active');
            document.body.classList.remove('sidebar-visible');
            // Timer removed
        }
    }
    
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        if (this.sidebar) {
            if (this.isCollapsed) {
                this.sidebar.classList.add('collapsed');
                document.body.classList.remove('sidebar-visible');
                this.toggleBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>`;
                this.toggleBtn.title = 'Expand';
            } else {
                this.sidebar.classList.remove('collapsed');
                document.body.classList.add('sidebar-visible');
                this.toggleBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>`;
                this.toggleBtn.title = 'Collapse';
            }
        }
    }
    
    // Timer methods removed
    
    resetProgress() {
        // Reset all progress items
        const items = ['recording', 'parsing', 'analyzing', 'variables', 'generating', 'validating'];
        items.forEach(item => {
            const element = document.getElementById(`progress-${item}`);
            if (element) {
                element.classList.remove('active', 'completed');
                const statusElement = element.querySelector('.progress-status');
                if (statusElement && item !== 'recording') {
                    statusElement.textContent = '';
                }
            }
        });
        
        // Mark recording as completed since we're analyzing
        const recordingItem = document.getElementById('progress-recording');
        if (recordingItem) {
            recordingItem.classList.add('completed');
        }
        
        // Clear details
        if (this.detailContent) {
            this.detailContent.innerHTML = '<div class="detail-item">Analysis starting...</div>';
        }
    }
    
    updateProgress(step, status = 'active', details = null) {
        const element = document.getElementById(`progress-${step}`);
        if (element) {
            // Remove active from all
            document.querySelectorAll('.progress-item.active').forEach(item => {
                item.classList.remove('active');
            });
            
            if (status === 'active') {
                element.classList.add('active');
                element.classList.remove('completed');
            } else if (status === 'completed') {
                element.classList.remove('active');
                element.classList.add('completed');
                const statusElement = element.querySelector('.progress-status');
                if (statusElement) {
                    statusElement.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007acc" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>`;
                }
            }
        }
        
        // Update details if provided
        if (details && this.detailContent) {
            const detailItem = document.createElement('div');
            detailItem.className = 'detail-item';
            detailItem.textContent = details;
            this.detailContent.appendChild(detailItem);
            // Keep only last 10 items
            while (this.detailContent.children.length > 10) {
                this.detailContent.removeChild(this.detailContent.firstChild);
            }
            // Scroll to bottom
            this.detailContent.scrollTop = this.detailContent.scrollHeight;
        }
    }
    
    completeAnalysis(success = true) {
        this.stopTimer();
        if (success) {
            this.updateProgress('validating', 'completed', 'Analysis completed successfully!');
        } else {
            if (this.detailContent) {
                const detailItem = document.createElement('div');
                detailItem.className = 'detail-item';
                detailItem.style.color = '#ef4444';
                detailItem.textContent = 'Analysis failed. Please check the console for details.';
                this.detailContent.appendChild(detailItem);
            }
        }
    }
}

// Initialize sidebar (use modern sidebar if available, fallback to old)
const analysisSidebar = window.modernSidebar || new AnalysisSidebar();

// Analyze the last recording
async function analyzeLastRecording() {
    console.log('==========================================');
    console.log('analyzeLastRecording function called!');
    console.log('lastRecordingSession exists:', !!window.lastRecordingSession);
    console.log('==========================================');
    
    if (!window.lastRecordingSession) {
        showRecordingError('No recording available to analyze');
        return;
    }
    
    const analyzeBtn = document.getElementById('analyze-btn');
    const statusText = document.getElementById('status-text');
    
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        analyzeBtn.classList.add('analyzing');
    }
    
    if (statusText) {
        statusText.textContent = 'Analyzing recording...';
    }
    
    // Show the modern sidebar
    console.log('Checking for modernSidebar:', !!window.modernSidebar);
    if (window.modernSidebar) {
        // Force reset the sidebar state before showing
        window.modernSidebar.isVisible = false;
        console.log('Force reset sidebar visibility, calling show()');
        await window.modernSidebar.show();
        console.log('Starting analysis flow...');
        // Don't immediately update parsing - wait for actual parsing to begin
    } else {
        console.log('Falling back to analysisSidebar');
        // Fallback to old sidebar
        analysisSidebar.show();
    }
    
    try {
        if (window.electronAPI && window.electronAPI.analyzeRecording) {
            // Prepare recording data for analysis
            // Send the actual recording session with actions, not just spec code
            const recordingSession = window.lastRecordingSession;
            
            console.log('Recording session object:', recordingSession);
            console.log('Number of actions:', recordingSession.actions ? recordingSession.actions.length : 0);
            
            // Send the spec code for analysis (Playwright codegen generates spec code)
            const recordingData = {
                recordingData: recordingSession.specCode || '',
                url: recordingSession.url || '',
                title: recordingSession.title || 'Recording',
                screenshotPath: recordingSession.screenshotPath
            };
            
            console.log('Sending recording for analysis:', recordingData);
            console.log('Recording data is valid:', !!recordingData.recordingData);
            
            // Use modern sidebar if available
            const sidebar = window.modernSidebar || analysisSidebar;
            
            // Track step completion times to ensure minimum duration
            const stepStartTimes = {};
            
            // Listen for progress updates from backend
            if (window.electronAPI && window.electronAPI.onAnalysisProgress) {
                window.electronAPI.onAnalysisProgress((progress) => {
                    console.log('Analysis progress update from backend:', progress);
                    
                    const stepId = `progress-${progress.step}`;
                    const stepIndex = analysisSteps.findIndex(s => s.id === stepId);
                    
                    if (stepIndex !== -1) {
                        const step = analysisSteps[stepIndex];
                        
                        if (progress.status === 'active') {
                            // Record when this step started
                            stepStartTimes[stepId] = Date.now();
                            
                            // If this is step 3 or later, update immediately
                            if (stepIndex >= 2) {
                                currentStepIndex = stepIndex - 1; // Set to previous so advance goes to this one
                                advanceAnalysisStep(true); // Skip auto-advance
                            }
                        } else if (progress.status === 'completed') {
                            // Calculate how long the step has been showing
                            const startTime = stepStartTimes[stepId] || Date.now();
                            const elapsed = Date.now() - startTime;
                            const remaining = Math.max(0, step.minDuration - elapsed);
                            
                            // Wait for minimum duration before advancing
                            setTimeout(() => {
                                updateAnalysisStep(stepId, 'completed');
                                
                                // If this is the last step, complete the analysis
                                if (progress.step === 'validating') {
                                    stepTimers.forEach(timer => clearTimeout(timer));
                                    stepTimers = [];
                                    completeAnalysis();
                                    sidebar.completeAnalysis(true);
                                } else {
                                    // Move to next step if backend indicates more to come
                                    const nextStepIndex = stepIndex + 1;
                                    if (nextStepIndex < analysisSteps.length) {
                                        currentStepIndex = stepIndex;
                                        advanceAnalysisStep(true); // Skip auto-advance, let backend control
                                    }
                                }
                            }, remaining);
                        }
                    }
                    
                    // Also update sidebar
                    sidebar.updateProgress(progress.step, progress.status, progress.message);
                });
            }
            
            console.log('About to call electronAPI.analyzeRecording...');
            
            // The actual analysis call - backend will send progress events
            const result = await window.electronAPI.analyzeRecording(recordingData);
            console.log('IPC call returned:', result);
            
            if (result.success && result.data) {
                console.log('Analysis successful:', result.data);
                console.log('Intent Spec:', JSON.stringify(result.data.intentSpec, null, 2));
                
                // Save Intent Spec to file for debugging and reuse
                if (result.data.intentSpec && window.electronAPI && window.electronAPI.saveIntentSpec) {
                    const timestamp = Date.now();
                    const filename = `intent-spec-${timestamp}.json`;
                    window.electronAPI.saveIntentSpec(result.data.intentSpec, filename)
                        .then(saveResult => {
                            console.log('Intent Spec saved to:', saveResult.path);
                        })
                        .catch(err => {
                            console.error('Failed to save Intent Spec:', err);
                        });
                }
                
                // Keep analyze button visible for testing
                // if (analyzeBtn) {
                //     analyzeBtn.style.display = 'none';
                // }
                
                // Mark analysis as complete
                completeAnalysis();
                
                // Update sidebar to show success
                const sidebar = window.modernSidebar || analysisSidebar;
                sidebar.completeAnalysis(true);
                
                // Mark validating step as completed (the UI uses 'validating' not 'analysis')
                const validatingStep = document.getElementById('progress-validating');
                if (validatingStep) {
                    validatingStep.classList.remove('active');
                    validatingStep.classList.add('completed');
                    const statusEl = validatingStep.querySelector('.progress-status');
                    if (statusEl) {
                        statusEl.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007acc" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>`;
                    }
                }
                
                // Show vars panel with the Intent Spec (not the entire data object)
                if (result.data.intentSpec) {
                    showVarsPanel(result.data.intentSpec);
                } else {
                    console.error('No intentSpec found in result.data');
                    showVarsPanel(result.data); // Fallback to old behavior
                }
                
                if (statusText) {
                    statusText.textContent = 'Analysis complete - Intent Spec generated';
                }
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
        } else {
            throw new Error('Analysis API not available');
        }
    } catch (error) {
        console.error('Analysis error:', error);
        showRecordingError('Analysis failed: ' + error.message);
        
        // Update sidebar to show failure
        const sidebar = window.modernSidebar || analysisSidebar;
        sidebar.completeAnalysis(false);
    } finally {
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze';
            analyzeBtn.classList.remove('analyzing');
        }
    }
}

// Legacy function for compatibility (if needed elsewhere)
function handleRecordingCompleteIntent(intentSpec) {
    console.log('Recording completed, showing vars panel with Intent Spec:', intentSpec);
    // Reset recording button
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
        recordBtn.classList.remove('recording');
        recordBtn.querySelector('.record-text').textContent = 'Record';
    }
    
    // Show vars panel with the Intent Spec
    showVarsPanel(intentSpec);
}

function showVarsPanel(intentSpec) {
    // Save the Intent Spec for future use
    if (intentSpec && intentSpec.steps && intentSpec.steps.length > 0) {
        window.lastIntentSpec = intentSpec;
        
        // Also save to localStorage for persistence
        try {
            localStorage.setItem('lastIntentSpec', JSON.stringify(intentSpec));
            console.log('✅ Intent Spec saved to localStorage');
        } catch (e) {
            console.warn('Could not save Intent Spec to localStorage:', e);
        }
    }
    
    // Access the vars panel manager from the global scope
    if (window.varsPanelManager) {
        window.varsPanelManager.showVarsPanel(intentSpec);
    } else {
        console.error('VarsPanelManager not available');
    }
}

function hideVarsPanel() {
    if (window.varsPanelManager) {
        window.varsPanelManager.hideVarsPanel();
    }
}

function updateStatus() {
    const statusText = document.getElementById('status-text');
    const tabCount = document.getElementById('tab-count');
    
    if (statusText) statusText.textContent = 'Ready';
    if (tabCount) tabCount.textContent = `${tabs.size} tab${tabs.size !== 1 ? 's' : ''}`;
}

function updateTabDisplay(tabsData, activeId) {
    // Update from main process if needed
    console.log('Tab update from main:', tabsData, activeId);
    
    // Sync local tabs with main process data
    if (tabsData) {
        tabs.clear();
        const tabsContainer = document.getElementById('tabs-container');
        if (tabsContainer) {
            // Save the + button before clearing
            const newTabBtn = document.getElementById('new-tab-btn');
            const savedBtn = newTabBtn ? newTabBtn.cloneNode(true) : null;
            
            // Clear all tabs
            tabsContainer.innerHTML = '';
            
            // Always ensure + button exists
            if (savedBtn) {
                tabsContainer.appendChild(savedBtn);
                // Re-attach event listener since cloneNode doesn't copy listeners
                savedBtn.addEventListener('click', () => createNewTab());
            } else {
                // Create + button if it doesn't exist
                const plusBtn = document.createElement('button');
                plusBtn.className = 'new-tab-btn';
                plusBtn.id = 'new-tab-btn';
                plusBtn.title = 'New Tab';
                plusBtn.textContent = '+';
                plusBtn.addEventListener('click', () => createNewTab());
                tabsContainer.appendChild(plusBtn);
            }
        }
        
        tabsData.forEach(tabData => {
            tabs.set(tabData.id, tabData);
            addTabToUI(tabData);
        });
        
        activeTabId = activeId;
        
        // Update UI to reflect active tab
        document.querySelectorAll('.tab').forEach(el => {
            if (el.dataset.tabId === activeId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        
        // Update address bar
        const activeTab = tabs.get(activeId);
        if (activeTab) {
            updateAddressBar(activeTab.url);
        }
        
        updateStatus();
    }
}

// Settings window functionality
function openSettings() {
    console.log('Opening settings window...');
    
    // Create a new tab for settings
    if (window.electronAPI && window.electronAPI.createTab) {
        const settingsUrl = './error-recovery-settings.html';
        window.electronAPI.createTab(settingsUrl)
            .then(result => {
                console.log('Settings tab created:', result);
            })
            .catch(error => {
                console.error('Failed to create settings tab:', error);
                // Fallback: open in new window
                openSettingsInNewWindow();
            });
    } else {
        openSettingsInNewWindow();
    }
}

function openSettingsInNewWindow() {
    // Open settings in a new browser window as fallback
    const settingsWindow = window.open('./error-recovery-settings.html', 'settings', 
        'width=900,height=700,scrollbars=yes,resizable=yes');
    
    if (!settingsWindow) {
        console.error('Failed to open settings window - popup blocked?');
        alert('Settings window was blocked. Please allow popups for this application.');
    }
}

// Enhanced Recording Variables
let isEnhancedRecording = false;
let enhancedRecordingSessionId = null;

/**
 * Toggle Enhanced CDP Recording with pause/resume functionality
 */
async function toggleEnhancedRecording() {
    const enhancedRecorderBtn = document.getElementById('enhanced-recorder-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    if (!enhancedRecorderBtn) return;
    
    if (!isEnhancedRecording) {
        // Start enhanced recording
        console.log('Starting Enhanced CDP Recording...');
        
        try {
            const options = {
                captureScreenshots: true,
                screenshotInterval: 5000,
                waitForElements: true
            };
            
            if (window.electronAPI && window.electronAPI.startEnhancedRecording) {
                const result = await window.electronAPI.startEnhancedRecording(options);
                
                if (result.success) {
                    console.log('Enhanced recording started successfully:', result.data?.sessionId);
                    
                    isEnhancedRecording = true;
                    enhancedRecordingSessionId = result.data?.sessionId;
                    
                    // Update record button to disabled state with "Recording" text
                    enhancedRecorderBtn.disabled = true;
                    enhancedRecorderBtn.classList.add('recording');
                    enhancedRecorderBtn.querySelector('.enhanced-recorder-text').textContent = 'Recording';
                    enhancedRecorderBtn.title = 'Recording in progress';
                    
                    // Show control buttons
                    if (pauseBtn) pauseBtn.style.display = 'flex';
                    if (stopBtn) stopBtn.style.display = 'flex';
                    
                    console.log('Enhanced recording UI updated');
                } else {
                    console.error('Failed to start enhanced recording:', result.error);
                    alert('Failed to start enhanced recording: ' + result.error);
                }
            } else {
                console.error('Enhanced recording API not available');
                alert('Enhanced recording is not available. Please restart the application.');
            }
        } catch (error) {
            console.error('Error starting enhanced recording:', error);
            alert('Error starting enhanced recording: ' + error.message);
        }
    } else {
        // Stop enhanced recording
        console.log('Stopping Enhanced CDP Recording...');
        
        try {
            if (window.electronAPI && window.electronAPI.stopEnhancedRecording) {
                const result = await window.electronAPI.stopEnhancedRecording();
                
                if (result.success) {
                    console.log('Enhanced recording stopped successfully');
                    
                    isEnhancedRecording = false;
                    enhancedRecordingSessionId = null;
                    
                    // Update button back to start state
                    enhancedRecorderBtn.classList.remove('recording', 'paused');
                    enhancedRecorderBtn.querySelector('.enhanced-recorder-text').textContent = 'Record';
                    enhancedRecorderBtn.title = 'Start Recording';
                    
                    // Hide control buttons
                    if (pauseBtn) pauseBtn.style.display = 'none';
                    if (resumeBtn) resumeBtn.style.display = 'none';
                    if (stopBtn) stopBtn.style.display = 'none';
                    
                    // Store recording session for analysis
                    if (result.data?.session) {
                        window.lastEnhancedRecordingSession = result.data.session;
                        console.log('Enhanced recording session stored for analysis');
                        
                        // Show analysis options
                        showEnhancedRecordingAnalysis(result.data.session);
                    }
                    
                    console.log('Enhanced recording UI reset');
                } else {
                    console.error('Failed to stop enhanced recording:', result.error);
                    alert('Failed to stop enhanced recording: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error stopping enhanced recording:', error);
            alert('Error stopping enhanced recording: ' + error.message);
        }
    }
}

/**
 * Add pause/resume controls for enhanced recording
 */
function addEnhancedRecordingControls() {
    const recordingControls = document.querySelector('.recording-controls');
    if (!recordingControls) return;
    
    // Create pause/resume button
    const pauseResumeBtn = document.createElement('button');
    pauseResumeBtn.className = 'pause-resume-btn';
    pauseResumeBtn.id = 'pause-resume-btn';
    pauseResumeBtn.title = 'Pause Enhanced Recording';
    pauseResumeBtn.innerHTML = '<span class="pause-resume-text">⏸️ Pause</span>';
    
    pauseResumeBtn.addEventListener('click', () => toggleEnhancedRecordingPause());
    
    // Insert after enhanced recorder button
    const enhancedRecorderBtn = document.getElementById('enhanced-recorder-btn');
    if (enhancedRecorderBtn) {
        recordingControls.insertBefore(pauseResumeBtn, enhancedRecorderBtn.nextSibling);
    }
}

// Old pause/resume control functions removed - using new icon buttons

// Old toggle function removed
async function oldToggleEnhancedRecordingPause() {
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    const enhancedRecorderBtn = document.getElementById('enhanced-recorder-btn');
    if (!pauseResumeBtn || !enhancedRecorderBtn) return;
    
    try {
        // Check current status
        if (window.electronAPI && window.electronAPI.getEnhancedRecordingStatus) {
            const statusResult = await window.electronAPI.getEnhancedRecordingStatus();
            const isPaused = statusResult.data?.isPaused || false;
            
            if (!isPaused) {
                // Pause recording
                console.log('Pausing enhanced recording...');
                const result = await window.electronAPI.pauseEnhancedRecording();
                
                if (result.success) {
                    pauseResumeBtn.querySelector('.pause-resume-text').textContent = '▶️ Resume';
                    pauseResumeBtn.title = 'Resume Enhanced Recording';
                    enhancedRecorderBtn.classList.add('paused');
                    console.log('Enhanced recording paused');
                } else {
                    console.error('Failed to pause enhanced recording:', result.error);
                }
            } else {
                // Resume recording
                console.log('Resuming enhanced recording...');
                const result = await window.electronAPI.resumeEnhancedRecording();
                
                if (result.success) {
                    pauseResumeBtn.querySelector('.pause-resume-text').textContent = '⏸️ Pause';
                    pauseResumeBtn.title = 'Pause Enhanced Recording';
                    enhancedRecorderBtn.classList.remove('paused');
                    console.log('Enhanced recording resumed');
                } else {
                    console.error('Failed to resume enhanced recording:', result.error);
                }
            }
        }
    } catch (error) {
        console.error('Error toggling enhanced recording pause:', error);
        alert('Error controlling enhanced recording: ' + error.message);
    }
}

/**
 * Show enhanced recording analysis options
 */
function showEnhancedRecordingAnalysis(session) {
    console.log('Showing enhanced recording analysis for session:', session.sessionId);
    
    // You can integrate this with the existing analysis UI
    // For now, just log that we have the enhanced session data
    console.log('Enhanced recording session available:', {
        sessionId: session.sessionId,
        actionCount: session.actions.length,
        duration: session.endTime - session.startTime,
        screenshots: session.screenshots.length
    });
    
    // Could show a notification or update the sidebar to indicate
    // that enhanced recording analysis is available
    const sidebar = document.querySelector('.analysis-sidebar');
    if (sidebar) {
        // Add a visual indicator that enhanced recording is ready for analysis
        const indicator = document.createElement('div');
        indicator.className = 'enhanced-recording-indicator';
        indicator.innerHTML = '🔬 Enhanced recording ready for analysis';
        indicator.style.cssText = 'background: #e8f5e8; border-left: 4px solid #28a745; padding: 8px; margin: 8px 0; border-radius: 4px; font-size: 12px;';
        
        sidebar.insertBefore(indicator, sidebar.firstChild);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 5000);
    }
}

// Enhanced recording event listeners
if (window.electronAPI && window.electronAPI.onEnhancedRecordingStarted) {
    window.electronAPI.onEnhancedRecordingStarted((data) => {
        console.log('Enhanced recording started event:', data);
    });
}

if (window.electronAPI && window.electronAPI.onEnhancedRecordingStopped) {
    window.electronAPI.onEnhancedRecordingStopped((data) => {
        console.log('Enhanced recording stopped event:', data);
    });
}

if (window.electronAPI && window.electronAPI.onEnhancedRecordingPaused) {
    window.electronAPI.onEnhancedRecordingPaused((data) => {
        console.log('Enhanced recording paused event:', data);
    });
}

if (window.electronAPI && window.electronAPI.onEnhancedRecordingResumed) {
    window.electronAPI.onEnhancedRecordingResumed((data) => {
        console.log('Enhanced recording resumed event:', data);
    });
}

if (window.electronAPI && window.electronAPI.onEnhancedActionRecorded) {
    window.electronAPI.onEnhancedActionRecorded((data) => {
        console.log('Enhanced action recorded:', data.action);
        
        // Update progress indicator if available
        const enhancedRecorderBtn = document.getElementById('enhanced-recorder-btn');
        if (enhancedRecorderBtn && isEnhancedRecording) {
            const actionCount = data.action ? 1 : 0; // This would be cumulative in practice
            // Could update button text to show action count
        }
    });
}

// Pause recording
async function pauseRecording() {
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    
    if (window.electronAPI && window.electronAPI.pauseEnhancedRecording) {
        const result = await window.electronAPI.pauseEnhancedRecording();
        if (result.success) {
            console.log('Recording paused');
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'flex';
        }
    }
}

// Resume recording
async function resumeRecording() {
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    
    if (window.electronAPI && window.electronAPI.resumeEnhancedRecording) {
        const result = await window.electronAPI.resumeEnhancedRecording();
        if (result.success) {
            console.log('Recording resumed');
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'flex';
        }
    }
}

// Stop recording
async function stopRecording() {
    const enhancedRecorderBtn = document.getElementById('enhanced-recorder-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    // Immediately change button to "Analysing" and keep it disabled
    if (enhancedRecorderBtn) {
        enhancedRecorderBtn.disabled = true;
        enhancedRecorderBtn.classList.remove('recording');
        enhancedRecorderBtn.classList.add('analysing');
        enhancedRecorderBtn.querySelector('.enhanced-recorder-text').textContent = 'Analysing';
        enhancedRecorderBtn.title = 'Analysis in progress...';
    }
    
    // Hide control buttons immediately
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    
    // Start the analysis progress tracking
    startAnalysisProgress();
    
    if (window.electronAPI && window.electronAPI.stopEnhancedRecording) {
        const result = await window.electronAPI.stopEnhancedRecording();
        if (result.success) {
            console.log('Recording stopped');
            isEnhancedRecording = false;
            
            // Handle the recorded session
            // The main process returns the data directly, not wrapped in a session object
            if (result.data) {
                window.lastRecordingSession = result.data;
                lastRecordingData = result.data;
                
                // Check if Intent Spec was already generated
                if (result.data.intentSpec) {
                    console.log('Intent Spec already generated by backend:', result.data.intentSpec);
                    
                    // Progress animation continues but we already have the spec
                    setTimeout(() => {
                        // Complete all progress steps quickly since analysis is done
                        completeAnalysis();
                        
                        // Show the vars panel with the Intent Spec
                        if (window.varsPanelManager) {
                            window.varsPanelManager.showVarsPanel(result.data.intentSpec);
                        }
                    }, 2000); // Show progress for 2 seconds then complete
                } else {
                    // No Intent Spec yet, trigger analysis
                    console.log('No Intent Spec found, triggering analysis...');
                    
                    // Wait a moment for the first progress step to show, then start real analysis
                    setTimeout(async () => {
                        console.log('Starting actual analysis...');
                        await analyzeRecording();
                    }, 500);
                }
            }
        }
    }
}

// Analysis progress tracking
let analysisSteps = [
    { id: 'progress-recording', label: 'Recording captured', minDuration: 2000 },
    { id: 'progress-parsing', label: 'Parsing actions', minDuration: 2000 },
    { id: 'progress-analyzing', label: 'AI analysis', minDuration: 3000 },
    { id: 'progress-variables', label: 'Extracting variables', minDuration: 2000 },
    { id: 'progress-generating', label: 'Generating Intent Spec', minDuration: 2500 },
    { id: 'progress-validating', label: 'Validating output', minDuration: 2000 }
];

let currentStepIndex = -1;
let analysisStartTime = null;
let stepTimers = [];

// Start the analysis progress animation
function startAnalysisProgress() {
    currentStepIndex = -1;
    analysisStartTime = Date.now();
    stepTimers = [];
    
    // Show the analysis sidebar
    const analysisSidebar = document.querySelector('#analysis-sidebar');
    if (analysisSidebar) {
        analysisSidebar.classList.add('active');
        document.body.classList.add('sidebar-visible');
    }
    
    // Expand the analysis progress section
    const progressSection = document.getElementById('analysis-progress-content');
    const progressChevron = document.getElementById('analysis-progress-chevron');
    if (progressSection && !progressSection.classList.contains('expanded')) {
        progressSection.classList.add('expanded');
        progressChevron.classList.add('expanded');
    }
    
    // Reset all steps
    analysisSteps.forEach(step => {
        const element = document.getElementById(step.id);
        if (element) {
            element.classList.remove('completed', 'active', 'error');
            const statusEl = element.querySelector('.progress-status');
            if (statusEl) statusEl.textContent = '';
        }
    });
    
    // Start the first step
    advanceAnalysisStep();
}

// Advance to the next analysis step
function advanceAnalysisStep(skipAutoAdvance = false) {
    // Complete the current step
    if (currentStepIndex >= 0 && currentStepIndex < analysisSteps.length) {
        const currentStep = analysisSteps[currentStepIndex];
        const element = document.getElementById(currentStep.id);
        if (element) {
            element.classList.remove('active');
            element.classList.add('completed');
            const statusEl = element.querySelector('.progress-status');
            if (statusEl) statusEl.textContent = '✓';
        }
    }
    
    // Move to next step
    currentStepIndex++;
    
    if (currentStepIndex < analysisSteps.length) {
        const nextStep = analysisSteps[currentStepIndex];
        const element = document.getElementById(nextStep.id);
        if (element) {
            element.classList.add('active');
            const statusEl = element.querySelector('.progress-status');
            if (statusEl) {
                statusEl.innerHTML = '<div class="mini-spinner"></div>';
            }
        }
        
        // Only auto-advance for the first 2 steps (recording and parsing)
        // The rest will be controlled by actual backend progress
        if (!skipAutoAdvance && currentStepIndex < 2) {
            const timer = setTimeout(() => {
                advanceAnalysisStep();
            }, nextStep.minDuration);
            stepTimers.push(timer);
        }
    } else {
        // Analysis complete
        completeAnalysis();
    }
}

// Complete the analysis
function completeAnalysis() {
    console.log('✅ Analysis complete');
    
    // Reset the Record button
    const enhancedRecorderBtn = document.getElementById('enhanced-recorder-btn');
    if (enhancedRecorderBtn) {
        enhancedRecorderBtn.disabled = false;
        enhancedRecorderBtn.classList.remove('analysing');
        enhancedRecorderBtn.querySelector('.enhanced-recorder-text').textContent = 'Record';
        enhancedRecorderBtn.title = 'Start Recording';
    }
    
    // Clear any pending step timers
    if (stepTimers && stepTimers.length > 0) {
        stepTimers.forEach(timer => clearTimeout(timer));
        stepTimers = [];
    }
    
    // Reset analysis start time
    analysisStartTime = null;
    
    // Show completion status
    const progressStatus = document.getElementById('analysis-progress-status');
    if (progressStatus) {
        progressStatus.textContent = 'Complete';
        progressStatus.style.color = '#4CAF50';
    }
    
    // After 3 seconds, collapse the analysis progress section
    setTimeout(() => {
        const progressSection = document.getElementById('analysis-progress-content');
        const progressChevron = document.getElementById('analysis-progress-chevron');
        if (progressSection && progressSection.classList.contains('expanded')) {
            progressSection.classList.remove('expanded');
            progressSection.classList.add('collapsed');
        }
        if (progressChevron && progressChevron.classList.contains('expanded')) {
            progressChevron.classList.remove('expanded');
            progressChevron.classList.add('collapsed');
        }
        
        // Clear the progress status after collapsing
        if (progressStatus) {
            progressStatus.textContent = '';
        }
    }, 3000);
}

// Update a specific analysis step (can be called from backend)
function updateAnalysisStep(stepId, status) {
    const stepIndex = analysisSteps.findIndex(s => s.id === stepId);
    if (stepIndex !== -1) {
        const element = document.getElementById(stepId);
        if (element) {
            element.classList.remove('active', 'completed', 'error');
            if (status === 'active') {
                element.classList.add('active');
                const statusEl = element.querySelector('.progress-status');
                if (statusEl) {
                    statusEl.innerHTML = '<div class="mini-spinner"></div>';
                }
            } else if (status === 'completed') {
                element.classList.add('completed');
                const statusEl = element.querySelector('.progress-status');
                if (statusEl) statusEl.textContent = '✓';
            } else if (status === 'error') {
                element.classList.add('error');
                const statusEl = element.querySelector('.progress-status');
                if (statusEl) statusEl.textContent = '✗';
            }
        }
    }
}

// Handle actual analysis progress from backend
function updateAnalysisStep(stepName) {
    // Find the step index
    const stepIndex = analysisSteps.findIndex(s => 
        s.label.toLowerCase().includes(stepName.toLowerCase()) ||
        s.id.includes(stepName.toLowerCase())
    );
    
    if (stepIndex > currentStepIndex) {
        // Clear remaining timers
        stepTimers.forEach(timer => clearTimeout(timer));
        stepTimers = [];
        
        // Jump to this step
        while (currentStepIndex < stepIndex - 1) {
            currentStepIndex++;
            const step = analysisSteps[currentStepIndex];
            const element = document.getElementById(step.id);
            if (element) {
                element.classList.add('completed');
                const statusEl = element.querySelector('.progress-status');
                if (statusEl) statusEl.textContent = '✓';
            }
        }
        
        // Activate the current step
        currentStepIndex = stepIndex;
        const currentStep = analysisSteps[currentStepIndex];
        const element = document.getElementById(currentStep.id);
        if (element) {
            element.classList.remove('completed');
            element.classList.add('active');
            const statusEl = element.querySelector('.progress-status');
            if (statusEl) {
                statusEl.innerHTML = '<div class="mini-spinner"></div>';
            }
        }
        
        // Continue with minimum duration
        const timer = setTimeout(() => {
            advanceAnalysisStep();
        }, currentStep.minDuration);
        stepTimers.push(timer);
    }
}

// Function to show analysis progress in the sidebar
function showAnalysisProgress(progressData) {
    console.log('📊 Analysis progress:', progressData);
    
    // Show progress in the analysis sidebar if it exists
    const analysisSidebar = document.querySelector('#analysis-sidebar');
    if (analysisSidebar) {
        analysisSidebar.classList.add('active');
        document.body.classList.add('sidebar-visible');
        
        // Update progress message
        const detailContent = document.getElementById('detail-content');
        if (detailContent) {
            const statusColor = progressData.status === 'error' ? '#ff4444' : 
                               progressData.status === 'complete' ? '#4CAF50' : '#2196F3';
            
            detailContent.innerHTML = `
                <div style="padding: 12px; background: rgba(33, 150, 243, 0.1); border-radius: 8px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <div class="spinner" style="display: ${progressData.status === 'processing' ? 'block' : 'none'}"></div>
                        <span style="font-weight: 600; color: ${statusColor};">
                            ${progressData.status === 'starting' ? '🚀 Starting Analysis' :
                              progressData.status === 'processing' ? '⚙️ Processing' :
                              progressData.status === 'complete' ? '✅ Complete' :
                              progressData.status === 'error' ? '❌ Error' : '📊 Analysis'}
                        </span>
                    </div>
                    <div style="color: #666; font-size: 13px;">
                        ${progressData.message}
                    </div>
                </div>
            `;
            
            // Auto-hide sidebar after completion
            if (progressData.status === 'complete') {
                setTimeout(() => {
                    analysisSidebar.classList.remove('active');
                    document.body.classList.remove('sidebar-visible');
                }, 3000);
            }
        }
    }
}

// Function to show Intent Spec in the vars panel
function showIntentSpecInVarsPanel(intentSpec) {
    console.log('📝 Showing Intent Spec in vars panel:', intentSpec);
    
    // Check if vars panel manager exists
    if (window.varsPanelManager) {
        window.varsPanelManager.showVarsPanel(intentSpec);
    } else {
        console.warn('Vars panel manager not found, trying to initialize...');
        // Try again after a short delay
        setTimeout(() => {
            if (window.varsPanelManager) {
                window.varsPanelManager.showVarsPanel(intentSpec);
            } else {
                console.error('Could not show Intent Spec - vars panel not available');
            }
        }, 1000);
    }
}

// Setup analysis listeners
if (window.electronAPI) {
    // Listen for analysis progress
    window.electronAPI.onAnalysisProgress && window.electronAPI.onAnalysisProgress((progressData) => {
        showAnalysisProgress(progressData);
    });
    
    // Listen for Intent Spec to show in vars panel
    window.electronAPI.onShowIntentSpec && window.electronAPI.onShowIntentSpec((intentSpec) => {
        showIntentSpecInVarsPanel(intentSpec);
    });
}

// Make functions globally available for onclick handlers and external access
window.closeTab = closeTab;
window.showVarsPanel = showVarsPanel;
window.hideVarsPanel = hideVarsPanel;
window.handleRecordingComplete = handleRecordingComplete;
window.analyzeLastRecording = analyzeLastRecording;
window.openSettings = openSettings;
window.pauseRecording = pauseRecording;
window.resumeRecording = resumeRecording;
window.stopRecording = stopRecording;
window.showAnalysisProgress = showAnalysisProgress;
window.showIntentSpecInVarsPanel = showIntentSpecInVarsPanel;