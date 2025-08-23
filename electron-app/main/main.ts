import { app, BrowserWindow, session, protocol } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { WebContentsTabManager } from './WebContentsTabManager';
import { registerIpcHandlers } from './ipc';
import { settingsManager } from './settings-manager';

// Load environment variables early
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Verify API key is loaded
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not found in environment variables');
} else {
  console.log('ANTHROPIC_API_KEY loaded successfully');
}

let mainWindow: BrowserWindow | null = null;
let tabManager: WebContentsTabManager | null = null;

// WebContentsView is used for tab management - enable remote debugging for Playwright CDP
app.commandLine.appendSwitch('remote-debugging-port', '9335');

// Enhanced automation detection bypass flags for 2025 + Akamai/Reddit protection
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor,TranslateUI,BlockInsecurePrivateNetworkRequests');
app.commandLine.appendSwitch('exclude-switches', 'enable-automation');
app.commandLine.appendSwitch('disable-automation');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-hang-monitor');
app.commandLine.appendSwitch('disable-ipc-flooding-protection');

// Ultra-advanced TLS/HTTP2 fingerprinting evasion for Akamai/Reddit 2025
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor,TranslateUI,BlinkGenPropertyTrees,AudioServiceOutOfProcess,CrOSBatteryPercentage');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

// Ultra-advanced evasion flags discovered in 2025 research
app.commandLine.appendSwitch('disable-features', 'MediaRouter,DialMediaRouteProvider,CastMediaRouteProvider');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-device-discovery-notifications');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-crash-reporter');
app.commandLine.appendSwitch('disable-extension-activity-logging');
app.commandLine.appendSwitch('disable-extensions-file-access-check');
app.commandLine.appendSwitch('disable-extensions-http-throttling');
app.commandLine.appendSwitch('disable-location-providers');
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('disable-metrics');
app.commandLine.appendSwitch('disable-metrics-reporting');
app.commandLine.appendSwitch('disable-suggestions-service');
app.commandLine.appendSwitch('disable-sync');

// HTTP/2 and TLS specific evasion
app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceLogging');
app.commandLine.appendSwitch('force-fieldtrials', 'HttpsRRRecordsLoading/Enable/');
app.commandLine.appendSwitch('variations-server-url', '');
app.commandLine.appendSwitch('disable-field-trial-config');

function createWindow(): void {
  // Create the browser window - maximized and in foreground
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Electron WebView2 Browser',
    show: false, // Don't show until ready to ensure foreground appearance
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Allows WebContentsView to access necessary features
      // Enhanced browser mimicry for Akamai/Reddit bypass
      webSecurity: false, // Disable web security for better mimicry
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      backgroundThrottling: false,
      offscreen: false
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico')
  });

  // Load the main UI (from source, not dist)
  const htmlPath = path.join(__dirname, '..', '..', 'ui', 'tabbar.html');
  mainWindow.loadFile(htmlPath);

  // Show window maximized and bring to foreground once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.moveTop();
  });

  // Initialize WebContentsTabManager for multi-tab support
  tabManager = new WebContentsTabManager({
    window: mainWindow,
    preloadPath: path.join(__dirname, '..', 'preload.js')
  });

  // Register IPC handlers
  registerIpcHandlers(getTabManager, getMainWindow);
  console.log('[MAIN] IPC handlers registered successfully');
  
  // Register settings manager IPC handlers
  settingsManager.registerIpcHandlers();

  // Setup security policies
  setupSecurity();

  // Handle window closing - dispose before window is destroyed
  mainWindow.on('close', () => {
    if (tabManager) {
      try {
        tabManager.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
      tabManager = null;
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Forward main window console logs for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[MAIN-WINDOW] [${level}] ${message}`);
  });

  // Open DevTools in development (disabled for cleaner startup)
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }

  // Handle permission requests for WebContentsView instances
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Handle permissions for WebContentsView instances
    const allowedPermissions = ['media', 'geolocation', 'notifications'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Create initial Google tab once the UI is loaded
  mainWindow.webContents.once('did-finish-load', () => {
    if (tabManager) {
      tabManager.createTab('https://www.google.com');
    }
  });
}

// Enhanced user agent spoofing with rotation to remove Electron identifiers
app.whenReady().then(() => {
  // Pool of realistic user agents for 2025 - varied but all legitimate
  const userAgentPool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  ];
  
  // Select a random user agent for this session
  const sessionUA = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
  
  // Set at app level
  app.userAgentFallback = sessionUA;
  
  // Set at session level with rotation for different requests
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // For Reddit specifically, ensure we use only mainstream browsers
    let selectedUA = sessionUA;
    if (details.url.includes('reddit.com')) {
      // Reddit blocks alternative browsers - stick to Chrome/Firefox/Safari only
      const redditSafeUAs = userAgentPool.filter(ua => 
        ua.includes('Chrome/') || ua.includes('Firefox/') || ua.includes('Safari/')
      ).filter(ua => !ua.includes('Vivaldi') && !ua.includes('Edge'));
      selectedUA = redditSafeUAs[Math.floor(Math.random() * redditSafeUAs.length)];
    }
    
    // Tesla/Akamai prefers consistent Chrome signatures
    if (details.url.includes('tesla.com')) {
      const chromeUAs = userAgentPool.filter(ua => ua.includes('Chrome/'));
      selectedUA = chromeUAs[Math.floor(Math.random() * chromeUAs.length)];
    }
    
    details.requestHeaders['User-Agent'] = selectedUA;
    
    // Add additional headers that legitimate browsers send
    details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
    details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br, zstd';
    details.requestHeaders['Sec-Ch-Ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
    details.requestHeaders['Sec-Ch-Ua-Mobile'] = '?0';
    details.requestHeaders['Sec-Ch-Ua-Platform'] = '"Windows"';
    details.requestHeaders['Sec-Fetch-Dest'] = 'document';
    details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
    details.requestHeaders['Sec-Fetch-Site'] = 'none';
    details.requestHeaders['Sec-Fetch-User'] = '?1';
    details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
    
    callback({ requestHeaders: details.requestHeaders });
  });
  
  console.log('Enhanced user agent spoofing with rotation applied. Session UA:', sessionUA);
});

function setupSecurity(): void {
  // Prevent new window creation outside of our tab system
  app.on('web-contents-created', (event, contents) => {
    contents.on('new-window' as any, (event: any, navigationUrl: string) => {
      // Prevent default and handle in tab manager
      event.preventDefault();
      if (tabManager) {
        tabManager.createTab(navigationUrl);
      }
    });

    // Prevent navigation to file:// protocol
    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.protocol === 'file:') {
        event.preventDefault();
      }
    });
  });

  // Content Security Policy - relaxed for Google compatibility
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data:;"
        ]
      }
    });
  });

  // Register protocol for local resources
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6);
    callback({ path: path.normalize(`${__dirname}/${url}`) });
  });
}

// App event handlers
app.whenReady().then(async () => {
  createWindow();
  
  // Initialize enhanced recording integration
  try {
    const { initializeEnhancedRecording } = await import('./enhanced-recording-integration');
    initializeEnhancedRecording();
  } catch (error) {
    console.log('Enhanced recording integration not available:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Cleanup enhanced recording
  try {
    const { disposeEnhancedRecording } = await import('./enhanced-recording-integration');
    await disposeEnhancedRecording();
  } catch (error) {
    // Safe to ignore if not available
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle certificate errors for WebContentsView instances
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // In production, you should verify the certificate
  if (process.env.NODE_ENV === 'development') {
    // Ignore certificate errors in development
    event.preventDefault();
    callback(true);
  } else {
    // Use default behavior in production
    callback(false);
  }
});

// Export for use in other modules
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getTabManager(): WebContentsTabManager | null {
  return tabManager;
}