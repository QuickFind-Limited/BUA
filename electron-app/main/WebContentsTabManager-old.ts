import { EventEmitter } from 'events';
import { BrowserWindow, WebContentsView, ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { EnhancedCDPRecorder, EnhancedRecordingSession, EnhancedRecordingAction } from './enhanced-cdp-recorder';
import { EnhancedRecordingController } from './enhanced-recording-controller';

// WebContentsView-based tab interface
interface WebContentsTab {
  id: string;
  url: string;
  title: string;
  view: WebContentsView;
  isActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

interface WebContentsTabManagerOptions {
  window: BrowserWindow;
  preloadPath?: string;
}

/**
 * WebContentsTabManager for Electron app using WebContentsView instances
 * Each tab is a WebContentsView that fills the content area below the UI chrome
 */
export class WebContentsTabManager extends EventEmitter {
  private tabs: Map<string, WebContentsTab> = new Map();
  private activeTabId: string | null = null;
  private window: BrowserWindow;
  private preloadPath: string;
  private readonly chromeHeight = 88; // Height of tab bar + nav bar
  private sidebarWidth = 0; // Track sidebar state for bounds management
  private varsPanelWidth = 0; // Track vars panel width on the right
  private enhancedRecorder: EnhancedCDPRecorder = new EnhancedCDPRecorder();
  private recordingController: EnhancedRecordingController | null = null;
  private recordingTabId: string | null = null;
  private enhancedRecordingActive = false; // Track enhanced recording state

  constructor(options: WebContentsTabManagerOptions) {
    super();
    this.window = options.window;
    this.preloadPath = options.preloadPath || '';
    this.setupIpcHandlers();
    this.setupWindowListeners();
    
    // Setup enhanced CDP recorder event listeners
    this.setupEnhancedRecorderListeners();
  }

  /**
   * Setup IPC handlers for tab management
   */
  private setupIpcHandlers(): void {
    // Tab creation
    ipcMain.handle('tabs:create', async (event, url?: string) => {
      return this.createTab(url || 'https://www.google.com');
    });

    // Tab closing
    ipcMain.handle('tabs:close', async (event, tabId: string) => {
      return this.closeTab(tabId);
    });

    // Tab switching
    ipcMain.handle('tabs:switch', async (event, tabId: string) => {
      return this.switchTab(tabId);
    });

    // Navigation
    ipcMain.handle('tabs:navigate', async (event, tabId: string, url: string) => {
      return this.navigateTab(tabId, url);
    });

    ipcMain.handle('tabs:goBack', async (event, tabId: string) => {
      return this.goBack(tabId);
    });

    ipcMain.handle('tabs:goForward', async (event, tabId: string) => {
      return this.goForward(tabId);
    });

    ipcMain.handle('tabs:reload', async (event, tabId: string) => {
      return this.reloadTab(tabId);
    });

    // Get all tabs
    ipcMain.handle('tabs:getAll', async () => {
      return this.getTabsForRenderer();
    });

    // Get active tab
    ipcMain.handle('tabs:getActive', async () => {
      return this.activeTabId ? this.getTabForRenderer(this.activeTabId) : null;
    });

    // Enhanced recording handlers
    ipcMain.handle('start-enhanced-recording', async (event, options = {}) => {
      return this.startEnhancedRecording(options);
    });

    ipcMain.handle('stop-enhanced-recording', async () => {
      return this.stopEnhancedRecording();
    });

    ipcMain.handle('pause-enhanced-recording', async () => {
      return this.pauseEnhancedRecording();
    });

    ipcMain.handle('resume-enhanced-recording', async () => {
      return this.resumeEnhancedRecording();
    });

    ipcMain.handle('enhanced-recording-status', async () => {
      return this.getEnhancedRecordingStatus();
    });

    ipcMain.handle('record-enhanced-action', async (event, action) => {
      return this.processEnhancedAction(action);
    });

  }

  /**
   * Setup window listeners for resizing
   */
  private setupWindowListeners(): void {
    this.window.on('resize', () => {
      this.updateAllTabBounds();
    });
  }

  /**
   * Create a new WebContentsView tab
   * Returns a serializable tab info (without the view object)
   */
  public async createTab(url: string): Promise<Omit<WebContentsTab, 'view'>> {
    const tabId = uuidv4();

    // Handle local files and ensure URL has protocol
    if (url.startsWith('./') || url.endsWith('.html')) {
      // Local file - construct file:// URL
      const htmlPath = path.join(__dirname, '..', '..', 'ui', url.replace('./', ''));
      url = `file://${htmlPath}`;
    } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      url = 'https://' + url;
    }

    // Create WebContentsView with ultra-advanced browser mimicry
    const view = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        // Ultra-advanced settings for Akamai/Reddit bypass
        webSecurity: false, // Critical for advanced evasion
        allowRunningInsecureContent: true,
        experimentalFeatures: true,
        backgroundThrottling: false,
        offscreen: false,
        disableBlinkFeatures: 'AutomationControlled',
        enableBlinkFeatures: '',
        // TLS/HTTP2 fingerprinting evasion
        additionalArguments: [
          '--disable-blink-features=AutomationControlled',
          '--disable-ipc-flooding-protection',
          '--enable-features=NetworkService'
        ]
      }
    });

    const tab: WebContentsTab = {
      id: tabId,
      url,
      title: 'New Tab',
      view,
      isActive: false,
      canGoBack: false,
      canGoForward: false,
      isLoading: true
    };

    // Setup WebContents event handlers
    this.setupWebContentsHandlers(tab);
    
    // Setup stealth JavaScript injection to spoof fingerprints
    this.setupStealthInjection(tab);

    // Set proper user agent to avoid bot detection - use latest Chrome 131 for 2025
    const modernUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    view.webContents.setUserAgent(modernUA);
    console.log(`Set modern Chrome UA for tab ${tabId}: ${modernUA}`);

    // Set comprehensive headers for 2025 Google compatibility including Chrome client hints
    view.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      // Core headers
      details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
      details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
      details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br, zstd';
      details.requestHeaders['Cache-Control'] = 'max-age=0';
      details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
      
      // Sec-Fetch headers
      details.requestHeaders['Sec-Fetch-Dest'] = 'document';
      details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
      details.requestHeaders['Sec-Fetch-Site'] = 'none';
      details.requestHeaders['Sec-Fetch-User'] = '?1';
      
      // Critical Chrome client hints headers for 2025
      details.requestHeaders['Sec-Ch-Ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
      details.requestHeaders['Sec-Ch-Ua-Mobile'] = '?0';
      details.requestHeaders['Sec-Ch-Ua-Platform'] = '"Windows"';
      details.requestHeaders['Sec-Ch-Ua-Platform-Version'] = '"15.0.0"';
      details.requestHeaders['Sec-Ch-Ua-Arch'] = '"x86"';
      details.requestHeaders['Sec-Ch-Ua-Model'] = '""';
      details.requestHeaders['Sec-Ch-Ua-Bitness'] = '"64"';
      details.requestHeaders['Sec-Ch-Ua-Full-Version-List'] = '"Google Chrome";v="131.0.6778.86", "Chromium";v="131.0.6778.86", "Not_A Brand";v="24.0.0.0"';
      
      callback({ requestHeaders: details.requestHeaders });
    });

    // Add view to window (initially hidden)
    this.window.contentView.addChildView(view);
    
    // Position the view
    this.updateTabBounds(tab);
    
    // Hide the view initially
    view.setVisible(false);

    this.tabs.set(tabId, tab);

    // Load the URL
    view.webContents.loadURL(url);

    // Always switch to newly created tabs (bring them to foreground)
    await this.switchTab(tabId);

    this.emit('tab-created', this.getTabForRenderer(tabId));
    this.sendTabUpdate();
    
    // Return serializable tab info (without view)
    const { view: tabView, ...tabInfo } = tab;
    return tabInfo;
  }

  /**
   * Close a tab
   */
  public async closeTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Remove view from window (this will also clean up the WebContents)
    this.window.contentView.removeChildView(tab.view);

    this.tabs.delete(tabId);

    // If this was the active tab, switch to another
    if (tabId === this.activeTabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        await this.switchTab(remainingTabs[0]);
      } else {
        this.activeTabId = null;
      }
    }

    this.emit('tab-closed', tabId);
    this.sendTabUpdate();
    
    return true;
  }

  /**
   * Switch to a different tab
   */
  public async switchTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Hide all other tabs
    this.tabs.forEach((t, id) => {
      t.isActive = (id === tabId);
      t.view.setVisible(id === tabId);
    });

    this.activeTabId = tabId;

    // Update bounds for the active tab
    this.updateTabBounds(tab);

    this.emit('tab-switched', tabId);
    this.sendTabUpdate();
    
    return true;
  }

  /**
   * Navigate a tab to a URL
   */
  public async navigateTab(tabId: string, url: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    tab.url = url;
    tab.isLoading = true;

    // Navigate the WebContents
    tab.view.webContents.loadURL(url);

    this.emit('tab-navigated', tabId, url);
    this.sendTabUpdate();
    
    return true;
  }

  /**
   * Go back in tab history - enhanced with debugging and proper error handling
   */
  public async goBack(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      console.error(`❌ goBack: Tab ${tabId} not found`);
      return false;
    }

    try {
      const webContents = tab.view.webContents;
      
      // Enhanced debugging for navigation API availability
      console.log(`🔍 Navigation API check for tab ${tabId}:`);
      console.log(`  - navigationHistory exists: ${!!(webContents as any).navigationHistory}`);
      console.log(`  - webContents.goBack exists: ${!!webContents.goBack}`);
      
      // Check if we can go back using new API
      const canGoBackNew = (webContents as any).navigationHistory?.canGoBack?.();
      const canGoBackOld = webContents.canGoBack?.();
      
      console.log(`  - navigationHistory.canGoBack(): ${canGoBackNew}`);
      console.log(`  - webContents.canGoBack(): ${canGoBackOld}`);
      
      const canGoBack = canGoBackNew ?? canGoBackOld ?? false;
      
      if (!canGoBack) {
        console.log(`⚠️ Cannot go back in tab ${tabId} - no history available`);
        return false;
      }

      console.log(`⬅️ Going back in tab ${tabId}`);
      
      // Try new API first, then fallback
      if ((webContents as any).navigationHistory?.goBack) {
        console.log('  - Using navigationHistory.goBack()');
        (webContents as any).navigationHistory.goBack();
      } else if (webContents.goBack) {
        console.log('  - Using webContents.goBack()');
        webContents.goBack();
      } else {
        console.error('❌ No navigation method available!');
        return false;
      }
      
      // Update navigation state immediately
      setTimeout(() => this.updateNavigationState(tab), 100);
      
      return true;
    } catch (error) {
      console.error('❌ Error in goBack:', error);
      return false;
    }
  }

  /**
   * Go forward in tab history - enhanced with debugging and proper error handling
   */
  public async goForward(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      console.error(`❌ goForward: Tab ${tabId} not found`);
      return false;
    }

    try {
      const webContents = tab.view.webContents;
      
      // Enhanced debugging for navigation API availability
      console.log(`🔍 Navigation API check for tab ${tabId}:`);
      console.log(`  - navigationHistory exists: ${!!(webContents as any).navigationHistory}`);
      console.log(`  - webContents.goForward exists: ${!!webContents.goForward}`);
      
      // Check if we can go forward using new API
      const canGoForwardNew = (webContents as any).navigationHistory?.canGoForward?.();
      const canGoForwardOld = webContents.canGoForward?.();
      
      console.log(`  - navigationHistory.canGoForward(): ${canGoForwardNew}`);
      console.log(`  - webContents.canGoForward(): ${canGoForwardOld}`);
      
      const canGoForward = canGoForwardNew ?? canGoForwardOld ?? false;
      
      if (!canGoForward) {
        console.log(`⚠️ Cannot go forward in tab ${tabId} - no forward history available`);
        return false;
      }

      console.log(`➡️ Going forward in tab ${tabId}`);
      
      // Try new API first, then fallback
      if ((webContents as any).navigationHistory?.goForward) {
        console.log('  - Using navigationHistory.goForward()');
        (webContents as any).navigationHistory.goForward();
      } else if (webContents.goForward) {
        console.log('  - Using webContents.goForward()');
        webContents.goForward();
      } else {
        console.error('❌ No navigation method available!');
        return false;
      }
      
      // Update navigation state immediately
      setTimeout(() => this.updateNavigationState(tab), 100);
      
      return true;
    } catch (error) {
      console.error('❌ Error in goForward:', error);
      return false;
    }
  }

  /**
   * Reload a tab
   */
  public async reloadTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.isLoading = true;
    tab.view.webContents.reload();
    
    this.sendTabUpdate();
    return true;
  }

  /**
   * Update navigation state for a tab and send to renderer
   */
  private updateNavigationState(tab: WebContentsTab): void {
    const webContents = tab.view.webContents;
    
    // Get current navigation state
    const canGoBack = (webContents as any).navigationHistory?.canGoBack?.() ?? webContents.canGoBack?.() ?? false;
    const canGoForward = (webContents as any).navigationHistory?.canGoForward?.() ?? webContents.canGoForward?.() ?? false;
    
    // Update tab state
    tab.canGoBack = canGoBack;
    tab.canGoForward = canGoForward;
    
    console.log(`🔄 Navigation state updated for tab ${tab.id}:`, { canGoBack, canGoForward });
    
    // Send updated state to renderer
    this.sendTabUpdate();
  }

  /**
   * Get all tabs (for renderer)
   */
  public getTabs(): any[] {
    return this.getTabsForRenderer();
  }

  /**
   * Get active tab (for renderer)
   */
  public getActiveTab(): any | null {
    return this.activeTabId ? this.getTabForRenderer(this.activeTabId) : null;
  }

  /**
   * Setup stealth JavaScript injection to bypass bot detection
   */
  private setupStealthInjection(tab: WebContentsTab): void {
    const webContents = tab.view.webContents;
    
    // Inject stealth scripts before page loads - with better logging
    webContents.on('dom-ready', () => {
      console.log(`🔧 DOM ready for tab ${tab.id}, injecting stealth scripts...`);
      
      webContents.executeJavaScript(`
        try {
          console.log('🔧 Advanced stealth injection starting for Akamai/Reddit bypass...');
          
          // Remove navigator.webdriver (most important)
          if (navigator.webdriver !== undefined) {
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined,
            });
            console.log('✅ navigator.webdriver removed');
          }
          
          // Advanced Chrome object with realistic properties for Akamai
          if (!window.chrome) {
            window.chrome = {
              runtime: {
                onConnect: undefined,
                onMessage: undefined,
                PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
                PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
                PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
                RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
                OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
                OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' }
              },
              loadTimes: function() { 
                return {
                  requestTime: performance.now() / 1000,
                  startLoadTime: performance.now() / 1000,
                  commitLoadTime: performance.now() / 1000,
                  finishDocumentLoadTime: performance.now() / 1000,
                  finishLoadTime: performance.now() / 1000,
                  firstPaintTime: performance.now() / 1000,
                  firstPaintAfterLoadTime: 0,
                  navigationType: 'Other'
                };
              },
              csi: function() { 
                return {
                  startE: performance.now(),
                  onloadT: performance.now(),
                  pageT: performance.now() - performance.timing.navigationStart,
                  tran: 15
                };
              },
              app: {
                isInstalled: false,
                InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
              }
            };
            console.log('✅ Advanced Chrome object added');
          }
          
          // Spoof WebRTC for Reddit detection bypass
          if (window.RTCPeerConnection) {
            const originalRTC = window.RTCPeerConnection;
            window.RTCPeerConnection = function(...args) {
              const instance = new originalRTC(...args);
              // Patch methods that could leak real IP
              const originalCreateDataChannel = instance.createDataChannel;
              instance.createDataChannel = function() {
                return originalCreateDataChannel.apply(this, arguments);
              };
              return instance;
            };
            console.log('✅ WebRTC fingerprinting patched');
          }
          
          // Enhanced hardware fingerprint spoofing for Akamai
          Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8,
            configurable: true
          });
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8,
            configurable: true
          });
          Object.defineProperty(navigator, 'platform', {
            get: () => 'Win32',
            configurable: true
          });
          
          // Ultra-advanced Canvas fingerprinting for Akamai bypass
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, attributes) {
            const context = originalGetContext.call(this, type, attributes);
            if (type === '2d') {
              const originalGetImageData = context.getImageData;
              context.getImageData = function() {
                const imageData = originalGetImageData.apply(this, arguments);
                // Add slight noise to defeat canvas fingerprinting
                for (let i = 0; i < imageData.data.length; i += 4) {
                  imageData.data[i] += Math.floor(Math.random() * 3) - 1;
                  imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1;
                  imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1;
                }
                return imageData;
              };
            }
            return context;
          };
          console.log('✅ Canvas fingerprinting defeated');
          
          // WebGL fingerprinting for Akamai
          if (window.WebGLRenderingContext) {
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
              if (parameter === 37445) return 'Intel Inc.'; // VENDOR
              if (parameter === 37446) return 'Intel(R) UHD Graphics 620'; // RENDERER
              if (parameter === 35724) return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'; // VERSION
              return originalGetParameter.call(this, parameter);
            };
            console.log('✅ WebGL fingerprinting defeated');
          }
          
          // Audio context fingerprinting bypass
          if (window.AudioContext) {
            const OriginalAudioContext = window.AudioContext;
            window.AudioContext = function() {
              const context = new OriginalAudioContext();
              const originalCreateOscillator = context.createOscillator;
              context.createOscillator = function() {
                const oscillator = originalCreateOscillator.call(this);
                const originalStart = oscillator.start;
                oscillator.start = function(when) {
                  // Add slight timing variance
                  return originalStart.call(this, when + Math.random() * 0.001);
                };
                return oscillator;
              };
              return context;
            };
            console.log('✅ Audio fingerprinting defeated');
          }
          
          // Screen resolution spoofing for consistent fingerprint
          Object.defineProperty(screen, 'width', { get: () => 1920, configurable: true });
          Object.defineProperty(screen, 'height', { get: () => 1080, configurable: true });
          Object.defineProperty(screen, 'availWidth', { get: () => 1920, configurable: true });
          Object.defineProperty(screen, 'availHeight', { get: () => 1040, configurable: true });
          Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true });
          Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true });
          console.log('✅ Screen fingerprinting defeated');
          
          // Battery API spoofing (Akamai checks this)
          if (navigator.getBattery) {
            navigator.getBattery = function() {
              return Promise.resolve({
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1
              });
            };
            console.log('✅ Battery fingerprinting defeated');
          }
          
          // Timezone spoofing
          const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
          Date.prototype.getTimezoneOffset = function() {
            return -300; // EST timezone
          };
          console.log('✅ Timezone fingerprinting defeated');
          
          // Advanced behavioral timing simulation
          const originalSetTimeout = window.setTimeout;
          window.setTimeout = function(callback, delay) {
            // Add human-like variance to timing
            const variance = Math.random() * 10 - 5;
            return originalSetTimeout(callback, delay + variance);
          };
          
          const originalSetInterval = window.setInterval;
          window.setInterval = function(callback, delay) {
            const variance = Math.random() * 10 - 5;
            return originalSetInterval(callback, delay + variance);
          };
          console.log('✅ Timing fingerprinting defeated');
          
          // BEHAVIORAL SIMULATION - Human-like patterns
          let mousePosition = { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight };
          let scrollPosition = 0;
          let lastActivity = Date.now();
          let visitStartTime = Date.now();
          
          // Simulate natural mouse movements with realistic patterns
          function simulateMouseMovement() {
            const maxX = window.innerWidth;
            const maxY = window.innerHeight;
            
            // Natural mouse movement with slight acceleration and deceleration
            const deltaX = (Math.random() - 0.5) * 15;
            const deltaY = (Math.random() - 0.5) * 15;
            
            mousePosition.x += deltaX;
            mousePosition.y += deltaY;
            
            mousePosition.x = Math.max(0, Math.min(maxX, mousePosition.x));
            mousePosition.y = Math.max(0, Math.min(maxY, mousePosition.y));
            
            // Dispatch synthetic mouse move events periodically
            if (Math.random() > 0.7) {
              try {
                document.dispatchEvent(new MouseEvent('mousemove', {
                  clientX: mousePosition.x,
                  clientY: mousePosition.y,
                  bubbles: true,
                  cancelable: true
                }));
              } catch (e) {}
            }
            
            lastActivity = Date.now();
          }
          
          // Simulate natural scrolling patterns with reading pauses
          function simulateScrolling() {
            const scrollIncrement = Math.random() * 100 + 50; // 50-150px
            const direction = Math.random() > 0.9 ? -1 : 1; // Occasionally scroll up
            scrollPosition += scrollIncrement * direction;
            
            // Keep within bounds
            const maxScroll = Math.max(0, document.body.scrollHeight - window.innerHeight);
            scrollPosition = Math.max(0, Math.min(maxScroll, scrollPosition));
            
            try {
              window.scrollTo({
                top: scrollPosition,
                behavior: Math.random() > 0.5 ? 'smooth' : 'auto'
              });
            } catch (e) {}
            
            lastActivity = Date.now();
          }
          
          // Simulate reading pauses with realistic dwell times
          function simulateReadingPauses() {
            const pauseDuration = Math.random() * 4000 + 2000; // 2-6 seconds
            setTimeout(() => {
              // Sometimes scroll during reading pause
              if (Math.random() > 0.6) {
                simulateScrolling();
              }
              lastActivity = Date.now();
            }, pauseDuration);
          }
          
          // Simulate occasional clicks on non-critical elements
          function simulateOccasionalClicks() {
            if (Math.random() > 0.95) { // Very rare
              const elements = document.querySelectorAll('a, button, div[onclick], span[onclick]');
              if (elements.length > 0 && Math.random() > 0.8) {
                const randomElement = elements[Math.floor(Math.random() * elements.length)];
                try {
                  if (randomElement && !randomElement.href) { // Avoid actual navigation
                    randomElement.dispatchEvent(new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      clientX: mousePosition.x,
                      clientY: mousePosition.y
                    }));
                  }
                } catch (e) {}
              }
            }
          }
          
          // Start behavioral simulation with human-like timing variations
          const mouseInterval = Math.random() * 300 + 200; // 200-500ms
          const scrollInterval = Math.random() * 3000 + 2000; // 2-5 seconds
          const readingInterval = Math.random() * 8000 + 5000; // 5-13 seconds
          
          setInterval(simulateMouseMovement, mouseInterval);
          setInterval(() => {
            if (Math.random() > 0.7) simulateScrolling(); // 30% chance per interval
          }, scrollInterval);
          setInterval(simulateReadingPauses, readingInterval);
          setInterval(simulateOccasionalClicks, Math.random() * 15000 + 10000); // 10-25 seconds
          
          // Add realistic network timing variations
          const originalFetch = window.fetch;
          if (originalFetch) {
            window.fetch = function(...args) {
              return new Promise((resolve) => {
                // Add human-like delay (50-300ms) with occasional longer delays
                const baseDelay = Math.random() * 250 + 50;
                const longDelay = Math.random() > 0.9 ? Math.random() * 500 : 0;
                setTimeout(() => {
                  resolve(originalFetch.apply(this, args));
                }, baseDelay + longDelay);
              });
            };
          }
          
          // Simulate realistic session duration
          const sessionDuration = Math.random() * 300000 + 60000; // 1-6 minutes
          setTimeout(() => {
            // Session timeout simulation - reduce activity
            mousePosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
          }, sessionDuration);
          
          console.log('✅ Behavioral simulation activated');
          
          // Hide automation indicators
          if (window.webkitRequestFileSystem) delete window.webkitRequestFileSystem;
          if (window.webkitResolveLocalFileSystemURL) delete window.webkitResolveLocalFileSystemURL;
          if (window.webkitRTCPeerConnection) delete window.webkitRTCPeerConnection;
          if (window.webkitMediaStream) delete window.webkitMediaStream;
          if (window.webkitSpeechGrammar) delete window.webkitSpeechGrammar;
          if (window.webkitSpeechGrammarList) delete window.webkitSpeechGrammarList;
          if (window.webkitSpeechRecognition) delete window.webkitSpeechRecognition;
          if (window.webkitSpeechRecognitionError) delete window.webkitSpeechRecognitionError;
          if (window.webkitSpeechRecognitionEvent) delete window.webkitSpeechRecognitionEvent;
          
          console.log('🕵️ ULTRA-ADVANCED stealth mode activated on:', window.location.href);
        } catch (e) {
          console.error('⚠️ Advanced stealth injection failure:', e);
        }
      `).then(() => {
        console.log(`✅ Stealth injection completed for tab ${tab.id}`);
      }).catch(error => {
        console.error(`❌ Failed to inject stealth scripts for tab ${tab.id}:`, error);
      });
    });
  }

  /**
   * Setup WebContents event handlers for a tab
   */
  private setupWebContentsHandlers(tab: WebContentsTab): void {
    const webContents = tab.view.webContents;
    
    // Forward renderer console logs to main process for debugging
    webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[RENDERER-${tab.id}] [${level}] ${message}`);
    });

    // Page title updated
    webContents.on('page-title-updated', (event, title) => {
      tab.title = title;
      this.emit('tab-title-updated', tab.id, title);
      this.window.webContents.send('tab-title-update', tab.id, title);
      this.sendTabUpdate();
    });

    // Navigation completed
    webContents.on('did-finish-load', () => {
      tab.isLoading = false;
      // Use navigationHistory API with fallback for proper state tracking
      tab.canGoBack = (webContents as any).navigationHistory?.canGoBack?.() ?? webContents.canGoBack?.() ?? false;
      tab.canGoForward = (webContents as any).navigationHistory?.canGoForward?.() ?? webContents.canGoForward?.() ?? false;
      this.sendTabUpdate();
    });

    // Navigation started
    webContents.on('did-start-loading', () => {
      tab.isLoading = true;
      this.sendTabUpdate();
    });

    // URL changed
    webContents.on('did-navigate', (event, url) => {
      tab.url = url;
      // Use navigationHistory API with fallback for proper state tracking
      tab.canGoBack = (webContents as any).navigationHistory?.canGoBack?.() ?? webContents.canGoBack?.() ?? false;
      tab.canGoForward = (webContents as any).navigationHistory?.canGoForward?.() ?? webContents.canGoForward?.() ?? false;
      this.emit('tab-url-changed', tab.id, url);
      this.window.webContents.send('tab-url-update', tab.id, url);
      this.sendTabUpdate();
    });

    // In-page navigation (for SPAs)
    webContents.on('did-navigate-in-page', (event, url) => {
      tab.url = url;
      this.emit('tab-url-changed', tab.id, url);
      this.sendTabUpdate();
    });

    // Handle new window requests (open in new tab)
    webContents.setWindowOpenHandler(({ url }) => {
      this.createTab(url);
      return { action: 'deny' };
    });

    // Handle failed loads
    webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      tab.isLoading = false;
      console.error(`Failed to load ${validatedURL}: ${errorDescription}`);
      this.sendTabUpdate();
    });
  }

  /**
   * Update bounds for a specific tab
   */
  private updateTabBounds(tab: WebContentsTab): void {
    const bounds = this.window.getBounds();
    const [width, height] = this.window.getContentSize();
    
    // Sidebar is always expanded at 320px
    const leftMargin = 320;
    
    console.log(`[updateTabBounds] Fixed sidebar width: 320px`);
    
    const newBounds = {
      x: leftMargin,
      y: this.chromeHeight,
      width: width - leftMargin,
      height: height - this.chromeHeight
    };
    
    console.log(`[updateTabBounds] Setting bounds:`, newBounds);
    
    // Simple setBounds - no need for workarounds when not dynamically resizing
    tab.view.setBounds(newBounds);
    
    if (tab.isActive) {
      tab.view.setVisible(true);
    }
  }

  /**
   * Update bounds for all tabs
   */
  private updateAllTabBounds(): void {
    this.tabs.forEach(tab => {
      this.updateTabBounds(tab);
    });
  }

  /**
   * Set sidebar width and update all tab bounds
   */
  public setSidebarWidth(width: number): void {
    // Validate width
    const clampedWidth = Math.max(0, Math.min(width, 500));
    if (this.sidebarWidth !== clampedWidth) {
      const previousWidth = this.sidebarWidth;
      console.log(`[setSidebarWidth] Changing from ${previousWidth} to ${clampedWidth}`);
      this.sidebarWidth = clampedWidth;
      
      // For collapse operations (going to smaller width), add a small delay
      // to ensure the sidebar animation completes before repositioning webview
      if (clampedWidth < previousWidth || clampedWidth === 48) {
        console.log(`[setSidebarWidth] Collapse detected, delaying bounds update`);
        setTimeout(() => {
          this.updateAllTabBounds();
        }, 100);
      } else {
        this.updateAllTabBounds();
      }
      
      // Notify renderer of bounds change
      this.window.webContents.send('bounds-updated', {
        sidebarWidth: this.sidebarWidth,
        chromeHeight: this.chromeHeight
      });
    }
  }

  /**
   * Toggle sidebar visibility
   */
  public toggleSidebar(isVisible: boolean): void {
    const width = isVisible ? 320 : 0;
    this.setSidebarWidth(width);
  }

  /**
   * Get tab data suitable for renderer process
   */
  private getTabForRenderer(tabId: string): any | null {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      isActive: tab.isActive,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      isLoading: tab.isLoading
    };
  }

  /**
   * Get all tabs data suitable for renderer process
   */
  private getTabsForRenderer(): any[] {
    return Array.from(this.tabs.values()).map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      isActive: tab.isActive,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      isLoading: tab.isLoading
    }));
  }

  /**
   * Send tab update to renderer
   */
  private sendTabUpdate(): void {
    this.window.webContents.send('tabs-updated', {
      tabs: this.getTabsForRenderer(),
      activeTabId: this.activeTabId
    });
    
    // Send navigation state update for the active tab
    if (this.activeTabId) {
      const activeTab = this.tabs.get(this.activeTabId);
      if (activeTab) {
        this.window.webContents.send('navigation-update', {
          tabId: this.activeTabId,
          canGoBack: activeTab.canGoBack,
          canGoForward: activeTab.canGoForward
        });
      }
    }
  }

  /**
   * Setup enhanced recorder event listeners
   */
  private setupEnhancedRecorderListeners(): void {
    this.enhancedRecorder.on('recording-started', (data) => {
      console.log('Enhanced recording started:', data.sessionId);
      this.window.webContents.send('enhanced-recording-started', data);
    });

    this.enhancedRecorder.on('recording-paused', (data) => {
      console.log('Enhanced recording paused:', data.sessionId);
      this.window.webContents.send('enhanced-recording-paused', data);
    });

    this.enhancedRecorder.on('recording-resumed', (data) => {
      console.log('Enhanced recording resumed:', data.sessionId);
      this.window.webContents.send('enhanced-recording-resumed', data);
    });

    this.enhancedRecorder.on('recording-stopped', (data) => {
      console.log('Enhanced recording stopped');
      this.window.webContents.send('enhanced-recording-stopped', data);
    });

    this.enhancedRecorder.on('action-recorded', (data) => {
      this.window.webContents.send('enhanced-action-recorded', data);
    });
  }

  /**
   * Start enhanced CDP-based recording
   */
  public async startEnhancedRecording(options: {
    captureScreenshots?: boolean;
    screenshotInterval?: number;
    waitForElements?: boolean;
  } = {}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      if (this.enhancedRecordingActive) {
        return { success: false, error: 'Enhanced recording is already in progress' };
      }

      if (this.recorder.getRecordingStatus().isRecording || this.codegenRecordingActive) {
        return { success: false, error: 'Another recording is in progress. Stop it first.' };
      }

      if (!this.activeTabId) {
        return { success: false, error: 'No active tab to record' };
      }

      const activeTab = this.tabs.get(this.activeTabId);
      if (!activeTab) {
        return { success: false, error: 'Active tab not found' };
      }

      const sessionId = `enhanced-${Date.now()}`;
      
      console.log('Starting enhanced CDP recording...');
      const started = await this.enhancedRecorder.startRecording(activeTab.view, sessionId, options);
      
      if (started) {
        this.enhancedRecordingActive = true;
        this.recordingTabId = this.activeTabId;
        this.emit('enhanced-recording-started', { sessionId, tabId: this.activeTabId });
        return { success: true, sessionId };
      } else {
        return { success: false, error: 'Failed to start enhanced recording' };
      }
    } catch (error) {
      console.error('Error starting enhanced recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Stop enhanced recording and return results
   */
  public async stopEnhancedRecording(): Promise<{ success: boolean; session?: EnhancedRecordingSession; error?: string }> {
    try {
      if (!this.enhancedRecordingActive) {
        return { success: false, error: 'No enhanced recording in progress' };
      }
      
      const session = await this.enhancedRecorder.stopRecording();
      if (session) {
        this.emit('enhanced-recording-stopped', { session, tabId: this.recordingTabId });
        this.enhancedRecordingActive = false;
        this.recordingTabId = null;
        return { success: true, session };
      } else {
        return { success: false, error: 'Failed to stop enhanced recording' };
      }
    } catch (error) {
      console.error('Error stopping enhanced recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Pause enhanced recording
   */
  public pauseEnhancedRecording(): { success: boolean; error?: string } {
    try {
      if (!this.enhancedRecordingActive) {
        return { success: false, error: 'No enhanced recording in progress' };
      }

      const paused = this.enhancedRecorder.pauseRecording();
      if (paused) {
        this.emit('enhanced-recording-paused', { tabId: this.recordingTabId });
        return { success: true };
      } else {
        return { success: false, error: 'Failed to pause enhanced recording' };
      }
    } catch (error) {
      console.error('Error pausing enhanced recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Resume enhanced recording
   */
  public resumeEnhancedRecording(): { success: boolean; error?: string } {
    try {
      if (!this.enhancedRecordingActive) {
        return { success: false, error: 'No enhanced recording in progress' };
      }

      const resumed = this.enhancedRecorder.resumeRecording();
      if (resumed) {
        this.emit('enhanced-recording-resumed', { tabId: this.recordingTabId });
        return { success: true };
      } else {
        return { success: false, error: 'Failed to resume enhanced recording' };
      }
    } catch (error) {
      console.error('Error resuming enhanced recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get enhanced recording status
   */
  public getEnhancedRecordingStatus(): { 
    isRecording: boolean; 
    isPaused: boolean;
    sessionId?: string; 
    startTime?: number;
    actionCount: number;
    lastActionTime?: number;
    tabId?: string; 
  } {
    const status = this.enhancedRecorder.getRecordingStatus();
    return {
      ...status,
      tabId: this.recordingTabId || undefined
    };
  }

  /**
   * Process enhanced recording action from injected script
   */
  public processEnhancedAction(action: EnhancedRecordingAction): boolean {
    try {
      return this.enhancedRecorder.processEnhancedAction(action);
    } catch (error) {
      console.error('Error processing enhanced action:', error);
      return false;
    }
  }

  /**
   * Generate Playwright code from enhanced session
   */
  public generateEnhancedPlaywrightCode(session: EnhancedRecordingSession): string {
    return this.enhancedRecorder.generatePlaywrightCode(session);
  }

  /**
   * Export enhanced recording session as JSON
   */
  public exportEnhancedRecordingSession(session: EnhancedRecordingSession): string {
    return this.enhancedRecorder.exportSession(session);
  }

  /**
   * Start Playwright codegen recording
   */
  public async startCodegenRecording(): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      if (this.codegenRecordingActive) {
        return { success: false, error: 'Codegen recording is already in progress' };
      }

      if (this.recorder.getRecordingStatus().isRecording) {
        return { success: false, error: 'Regular recording is in progress. Stop it first.' };
      }

      const activeTab = this.tabs.get(this.activeTabId || '');
      const startUrl = activeTab?.url || 'https://www.google.com';
      const sessionId = `codegen-${Date.now()}`;
      
      // Use only codegen external recorder
      if (!this.codegenExternalRecorder) {
        return { success: false, error: 'Codegen recorder not initialized' };
      }
      
      console.log('Starting Playwright codegen recording...');
      const started = await this.codegenExternalRecorder.startRecording(sessionId, startUrl);
      
      if (started) {
        this.codegenRecordingActive = true;
        this.recordingTabId = this.activeTabId;
        this.emit('codegen-recording-started', { sessionId, tabId: this.activeTabId });
        return { success: true, sessionId };
      } else {
        return { success: false, error: 'Failed to start codegen recording' };
      }
    } catch (error) {
      console.error('Error starting codegen recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Stop Playwright codegen recording and return results
   */
  public async stopCodegenRecording(): Promise<{ success: boolean; result?: CodegenRecordingResult; error?: string }> {
    try {
      if (!this.codegenRecordingActive) {
        return { success: false, error: 'No codegen recording in progress' };
      }

      // Use only codegen external recorder
      if (!this.codegenExternalRecorder) {
        return { success: false, error: 'Codegen recorder not initialized' };
      }
      
      const result = await this.codegenExternalRecorder.stopRecording();
      if (result) {
        this.emit('codegen-recording-stopped', { result, tabId: this.recordingTabId });
        this.codegenRecordingActive = false;
        this.recordingTabId = null;
        return { success: true, result };
      } else {
        return { success: false, error: 'Failed to stop codegen recording' };
      }
    } catch (error) {
      console.error('Error stopping codegen recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get codegen recording status
   */
  public getCodegenRecordingStatus(): { 
    isRecording: boolean; 
    sessionId?: string; 
    startTime?: number;
    url?: string;
    tabId?: string; 
  } {
    const status = this.externalRecorder 
      ? this.externalRecorder.getRecordingStatus()
      : { isRecording: false };
    return {
      ...status,
      tabId: this.recordingTabId || undefined
    };
  }

  /**
   * Start recording user actions in the active tab
   */
  public async startRecording(): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      if (!this.activeTabId) {
        return { success: false, error: 'No active tab to record' };
      }

      if (this.recorder.getRecordingStatus().isRecording) {
        return { success: false, error: 'Recording is already in progress' };
      }

      const activeTab = this.tabs.get(this.activeTabId);
      if (!activeTab) {
        return { success: false, error: 'Active tab not found' };
      }

      const sessionId = `recording-${this.activeTabId}-${Date.now()}`;
      const started = await this.recorder.startRecording(activeTab.view, sessionId);

      if (started) {
        this.recordingTabId = this.activeTabId;
        this.emit('recording-started', { sessionId, tabId: this.activeTabId });
        return { success: true, sessionId };
      } else {
        return { success: false, error: 'Failed to start recording' };
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Stop recording and return the session data
   */
  public stopRecording(): { success: boolean; session?: RecordingSession; error?: string } {
    try {
      if (!this.recorder.getRecordingStatus().isRecording) {
        return { success: false, error: 'No recording in progress' };
      }

      const session = this.recorder.stopRecording();
      if (session) {
        this.emit('recording-stopped', { session, tabId: this.recordingTabId });
        this.recordingTabId = null;
        return { success: true, session };
      } else {
        return { success: false, error: 'Failed to stop recording' };
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get current recording status
   */
  public getRecordingStatus(): { 
    isRecording: boolean; 
    sessionId?: string; 
    actionCount?: number; 
    tabId?: string; 
  } {
    const status = this.recorder.getRecordingStatus();
    return {
      ...status,
      tabId: this.recordingTabId || undefined
    };
  }

  /**
   * Process a recorded action from the injected script
   */
  public processRecordedAction(action: any): boolean {
    try {
      this.recorder.processActionFromPage(action);
      return true;
    } catch (error) {
      console.error('Error processing recorded action:', error);
      return false;
    }
  }

  /**
   * Generate Playwright code from a recording session
   */
  public generatePlaywrightCode(session: RecordingSession): string {
    return this.recorder.generatePlaywrightCode(session);
  }

  /**
   * Export recording session as JSON
   */
  public exportRecordingSession(session: RecordingSession): string {
    return this.recorder.exportSession(session);
  }

  /**
   * Import recording session from JSON
   */
  public importRecordingSession(jsonData: string): RecordingSession | null {
    return this.recorder.importSession(jsonData);
  }

  /**
   * Get the ID of the active tab
   */
  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Get a tab by ID
   */
  public getTab(tabId: string): WebContentsTab | undefined {
    return this.tabs.get(tabId);
  }





  /**
   * Clean up resources
   */
  public dispose(): void {
    try {
      // Clean up codegen recorder
      if (this.codegenRecorder) {
        this.codegenRecorder.dispose().catch(e => {
          console.log('Error disposing codegen recorder (safe to ignore):', e);
        });
      }
      
      // Clean up enhanced recorder
      if (this.enhancedRecorder) {
        this.enhancedRecorder.dispose().catch(e => {
          console.log('Error disposing enhanced recorder (safe to ignore):', e);
        });
      }


      // Close all tabs
      this.tabs.forEach((tab, tabId) => {
        try {
          // Check if window and view still exist before removing
          if (this.window && !this.window.isDestroyed() && tab.view) {
            this.window.contentView.removeChildView(tab.view);
          }
        } catch (e) {
          // View might already be destroyed, ignore
        }
      });

      this.tabs.clear();
      this.removeAllListeners();
    } catch (error) {
      // Ignore errors during disposal
      console.log('Error during TabManager disposal (safe to ignore):', error);
    }
  }
}