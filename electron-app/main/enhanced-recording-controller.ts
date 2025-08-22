import { EventEmitter } from 'events';
import { WebContentsView, BrowserWindow } from 'electron';
import { Browser, Page, CDPSession } from 'playwright';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Enhanced Recording Controller
 * Connects to WebContentsView via CDP for performant data capture
 * Target: < 5% performance overhead through strategic monitoring
 */

interface RecordingSession {
  id: string;
  startTime: number;
  webView: WebContentsView;
  isActive: boolean;
  metadata: RecordingMetadata;
}

interface RecordingMetadata {
  sessionId: string;
  startUrl: string;
  startTime: number;
  endTime?: number;
  totalActions: number;
  screenshotCount: number;
  networkRequestCount: number;
  consoleErrorCount: number;
  domMutationCount: number;
}

interface DOMElement {
  selector: string;
  tagName: string;
  type?: string;
  textContent?: string;
  isVisible: boolean;
  isInteractable: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

interface NetworkRequest {
  url: string;
  method: string;
  statusCode?: number;
  timestamp: number;
  responseSize?: number;
  timing?: { start: number; end: number };
}

interface ConsoleError {
  message: string;
  source: string;
  timestamp: number;
  stackTrace?: string;
}

interface DOMSnapshot {
  timestamp: number;
  visibleElements: DOMElement[];
  interactableElements: DOMElement[];
  pageUrl: string;
  title: string;
  viewport: { width: number; height: number };
}

interface RecordingData {
  session: RecordingMetadata;
  domSnapshots: DOMSnapshot[];
  networkRequests: NetworkRequest[];
  consoleErrors: ConsoleError[];
  screenshots: string[];
  finalState?: DOMSnapshot;
}

export class EnhancedRecordingController extends EventEmitter {
  private sessions: Map<string, RecordingSession> = new Map();
  private activeSessionId: string | null = null;
  private playwrightBrowser: Browser | null = null;
  private playwrightPage: Page | null = null;
  private cdpSession: CDPSession | null = null;
  private recordingsDir: string;
  private isConnected = false;
  
  // Performance optimization: throttling and batching
  private domMutationThrottle = 1000; // 1 second between DOM snapshots
  private screenshotThrottle = 5000; // 5 seconds between strategic screenshots
  private lastDomSnapshot = 0;
  private lastScreenshot = 0;
  private pendingDomMutations = 0;
  
  // Data collection settings for <5% overhead
  private maxDomElements = 100; // Limit DOM elements per snapshot
  private maxNetworkRequests = 200; // Limit network request tracking
  private maxConsoleErrors = 50; // Limit console error tracking
  private screenshotQuality = 80; // Balanced quality/performance

  constructor(recordingsDir?: string) {
    super();
    this.recordingsDir = recordingsDir || path.join(process.cwd(), 'recordings');
    this.ensureRecordingsDirectory();
  }

  private async ensureRecordingsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create recordings directory:', error);
    }
  }

  /**
   * Connect to WebContentsView via CDP
   */
  public async connectToWebView(webView: WebContentsView): Promise<boolean> {
    try {
      console.log('🔗 Connecting Enhanced Recording Controller to WebContentsView...');

      // Import chromium from playwright
      const { chromium } = await import('playwright');
      
      // Connect to CDP endpoint (port 9335 as configured in main.ts)
      const cdpPort = process.env.CDP_PORT || '9335';
      const cdpEndpoint = `http://127.0.0.1:${cdpPort}`;
      
      console.log(`📡 Connecting to CDP endpoint: ${cdpEndpoint}`);
      
      // Connect to the browser via CDP
      this.playwrightBrowser = await chromium.connectOverCDP(cdpEndpoint);
      
      if (!this.playwrightBrowser) {
        console.error('❌ Failed to connect browser via CDP');
        return false;
      }
      
      // Get existing contexts and find WebView pages
      const contexts = this.playwrightBrowser.contexts();
      if (contexts.length === 0) {
        console.error('❌ No browser contexts found');
        return false;
      }
      
      const context = contexts[0];
      const pages = context.pages();
      
      // Find the WebView page (http/https URLs only)
      let webViewPage = null;
      for (const page of pages) {
        const url = page.url();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          webViewPage = page;
          console.log(`✅ Found WebView page: ${url}`);
          break;
        }
      }
      
      if (!webViewPage) {
        console.error('❌ No WebView page found with web content');
        return false;
      }
      
      this.playwrightPage = webViewPage;
      
      // Get CDP session for low-level operations
      this.cdpSession = await this.playwrightPage.context().newCDPSession(this.playwrightPage);
      
      this.isConnected = true;
      console.log('✅ Enhanced Recording Controller connected successfully');
      
      // Setup popup blocking immediately
      await this.setupPopupBlocking();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to WebView:', error);
      return false;
    }
  }

  /**
   * Setup comprehensive popup blocking
   */
  private async setupPopupBlocking(): Promise<void> {
    if (!this.playwrightPage || !this.cdpSession) return;

    try {
      console.log('🚫 Setting up popup blocking...');

      // Block new window/tab creation
      this.playwrightPage.on('popup', async (popup) => {
        console.log('🚫 Blocking popup:', popup.url());
        await popup.close();
      });

      // Block common notification APIs
      await this.playwrightPage.addInitScript(() => {
        // Block notifications
        Object.defineProperty(window.Notification, 'permission', { value: 'denied' });
        window.Notification.requestPermission = () => Promise.resolve('denied');
        
        // Block geolocation
        Object.defineProperty(navigator, 'geolocation', { 
          value: undefined, 
          configurable: false, 
          writable: false 
        });
        
        // Block camera/microphone
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = () => 
            Promise.reject(new Error('Permission denied'));
        }
        
        // Block beforeunload dialogs
        window.addEventListener('beforeunload', (e) => {
          e.preventDefault();
          e.returnValue = '';
          return '';
        });

        // Intercept and block common sign-in popups
        const originalOpen = window.open;
        window.open = function(...args) {
          console.log('Blocking popup attempt:', args[0]);
          return null;
        };

        // Block OAuth redirects that open new windows
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
          get: () => originalLocation,
          set: (value) => {
            if (typeof value === 'string' && 
                (value.includes('google.com/oauth') || 
                 value.includes('accounts.google.com') ||
                 value.includes('login.microsoftonline.com'))) {
              console.log('Blocking OAuth redirect:', value);
              return;
            }
            originalLocation.href = value;
          }
        });
      });

      console.log('✅ Popup blocking setup complete');
    } catch (error) {
      console.error('❌ Failed to setup popup blocking:', error);
    }
  }

  /**
   * Start recording session
   */
  public async startRecording(webView: WebContentsView, startUrl?: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Not connected to WebView. Call connectToWebView first.');
    }

    const sessionId = `recording-${Date.now()}`;
    const session: RecordingSession = {
      id: sessionId,
      startTime: Date.now(),
      webView,
      isActive: true,
      metadata: {
        sessionId,
        startUrl: startUrl || 'unknown',
        startTime: Date.now(),
        totalActions: 0,
        screenshotCount: 0,
        networkRequestCount: 0,
        consoleErrorCount: 0,
        domMutationCount: 0
      }
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;

    console.log(`🎬 Started recording session: ${sessionId}`);

    // Initialize monitoring with performance optimization
    await this.initializeMonitoring(session);

    // Take initial screenshot
    await this.captureStrategicScreenshot(session, 'initial');

    // Emit session started event
    this.emit('recording-started', { sessionId, startUrl });

    return sessionId;
  }

  /**
   * Initialize lightweight monitoring for performance
   */
  private async initializeMonitoring(session: RecordingSession): Promise<void> {
    if (!this.playwrightPage || !this.cdpSession) return;

    try {
      // Enable only essential CDP domains for performance
      await this.cdpSession.send('DOM.enable');
      await this.cdpSession.send('Network.enable');
      await this.cdpSession.send('Runtime.enable');

      // Lightweight DOM mutation observer
      await this.setupDOMMutationObserver(session);

      // Network request monitoring (metadata only)
      await this.setupNetworkMonitoring(session);

      // Console error monitoring (errors only, not all logs)
      await this.setupConsoleErrorMonitoring(session);

      console.log('✅ Lightweight monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize monitoring:', error);
    }
  }

  /**
   * Setup efficient DOM mutation monitoring
   */
  private async setupDOMMutationObserver(session: RecordingSession): Promise<void> {
    if (!this.playwrightPage) return;

    // Inject lightweight DOM observer
    await this.playwrightPage.addInitScript(() => {
      let mutationCount = 0;
      let lastSnapshot = 0;
      const THROTTLE_MS = 1000; // 1 second throttle

      const observer = new MutationObserver((mutations) => {
        mutationCount += mutations.length;
        
        const now = Date.now();
        if (now - lastSnapshot < THROTTLE_MS) return;
        
        lastSnapshot = now;
        
        // Only capture structure, not content for performance
        const visibleElements = Array.from(document.querySelectorAll('*'))
          .filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .slice(0, 50) // Limit to 50 elements for performance
          .map(el => ({
            tagName: el.tagName,
            selector: generateSelector(el),
            isVisible: true,
            isInteractable: isInteractable(el),
            bounds: el.getBoundingClientRect()
          }));

        // Send to main process via page evaluate
        window.postMessage({
          type: 'DOM_SNAPSHOT',
          sessionId: (window as any).recordingSessionId,
          timestamp: now,
          visibleElements,
          mutationCount
        }, '*');
      });

      observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: false, // Skip attribute changes for performance
        characterData: false // Skip text changes for performance
      });

      // Helper functions
      function generateSelector(element) {
        if (element.id) return `#${element.id}`;
        if (element.className) {
          const classes = element.className.split(' ').slice(0, 2); // Max 2 classes
          return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
        }
        return element.tagName.toLowerCase();
      }

      function isInteractable(element) {
        const interactableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
        return interactableTags.includes(element.tagName) ||
               element.hasAttribute('onclick') ||
               element.style.cursor === 'pointer';
      }
    });

    // Set session ID for the page
    await this.playwrightPage.evaluate((sessionId) => {
      (window as any).recordingSessionId = sessionId;
    }, session.id);

    // Listen for DOM snapshots
    this.playwrightPage.on('pageerror', () => {}); // Ignore page errors for performance
  }

  /**
   * Setup network monitoring (metadata only)
   */
  private async setupNetworkMonitoring(session: RecordingSession): Promise<void> {
    if (!this.cdpSession) return;

    // Track network requests with minimal overhead
    this.cdpSession.on('Network.responseReceived', (params) => {
      if (session.metadata.networkRequestCount >= this.maxNetworkRequests) return;

      const request: NetworkRequest = {
        url: params.response.url,
        method: params.response.requestHeaders?.method || 'GET',
        statusCode: params.response.status,
        timestamp: Date.now(),
        responseSize: params.response.encodedDataLength,
        timing: {
          start: params.response.timing?.requestTime || 0,
          end: params.response.timing?.receiveHeadersEnd || 0
        }
      };

      session.metadata.networkRequestCount++;
      this.emit('network-request', { sessionId: session.id, request });
    });
  }

  /**
   * Setup console error monitoring (errors only, not all logs)
   */
  private async setupConsoleErrorMonitoring(session: RecordingSession): Promise<void> {
    if (!this.cdpSession) return;

    // Only capture console errors for performance
    this.cdpSession.on('Runtime.consoleAPICalled', (params) => {
      if (params.type !== 'error' && params.type !== 'warning') return;
      if (session.metadata.consoleErrorCount >= this.maxConsoleErrors) return;

      const error: ConsoleError = {
        message: params.args[0]?.value?.toString() || 'Unknown error',
        source: (params as any).source || 'unknown',
        timestamp: params.timestamp,
        stackTrace: params.stackTrace?.description
      };

      session.metadata.consoleErrorCount++;
      this.emit('console-error', { sessionId: session.id, error });
    });

    // Also capture runtime exceptions
    this.cdpSession.on('Runtime.exceptionThrown', (params) => {
      if (session.metadata.consoleErrorCount >= this.maxConsoleErrors) return;

      const error: ConsoleError = {
        message: params.exceptionDetails.text,
        source: params.exceptionDetails.url || 'unknown',
        timestamp: params.timestamp,
        stackTrace: params.exceptionDetails.stackTrace?.description
      };

      session.metadata.consoleErrorCount++;
      this.emit('console-error', { sessionId: session.id, error });
    });
  }

  /**
   * Capture strategic screenshots (not continuous)
   */
  private async captureStrategicScreenshot(session: RecordingSession, trigger: string): Promise<string | null> {
    const now = Date.now();
    
    // Throttle screenshots for performance
    if (now - this.lastScreenshot < this.screenshotThrottle && trigger !== 'final') {
      return null;
    }
    
    this.lastScreenshot = now;

    try {
      if (!session.webView.webContents || session.webView.webContents.isDestroyed()) {
        console.log('⚠️ WebContents destroyed, cannot capture screenshot');
        return null;
      }

      const screenshotPath = path.join(
        this.recordingsDir, 
        `${session.id}-${trigger}-${Date.now()}.png`
      );

      // Capture with balanced quality/performance
      const screenshot = await session.webView.webContents.capturePage();
      const pngBuffer = screenshot.resize({ quality: this.screenshotQuality as any }).toPNG();
      
      await fs.writeFile(screenshotPath, pngBuffer);
      
      session.metadata.screenshotCount++;
      console.log(`📸 Strategic screenshot captured: ${trigger}`);
      
      return screenshotPath;
    } catch (error) {
      console.error('❌ Failed to capture screenshot:', error);
      return null;
    }
  }

  /**
   * Capture current DOM snapshot with performance optimization
   */
  private async captureDOMSnapshot(session: RecordingSession): Promise<DOMSnapshot | null> {
    if (!this.playwrightPage) return null;

    const now = Date.now();
    if (now - this.lastDomSnapshot < this.domMutationThrottle) {
      return null; // Throttled
    }
    
    this.lastDomSnapshot = now;

    try {
      const snapshot: DOMSnapshot = await this.playwrightPage.evaluate(() => {
        const visibleElements: DOMElement[] = [];
        const interactableElements: DOMElement[] = [];
        
        // Get all visible elements (limited for performance)
        const elements = document.querySelectorAll('*');
        let count = 0;
        
        for (const el of elements) {
          if (count >= 100) break; // Performance limit
          
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          
          const elementInfo: DOMElement = {
            selector: generateSimpleSelector(el),
            tagName: el.tagName,
            type: el.getAttribute('type') || undefined,
            textContent: el.textContent?.substring(0, 100) || undefined, // Limit text
            isVisible: true,
            isInteractable: isInteractableElement(el),
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
          
          visibleElements.push(elementInfo);
          if (elementInfo.isInteractable) {
            interactableElements.push(elementInfo);
          }
          
          count++;
        }
        
        return {
          timestamp: Date.now(),
          visibleElements,
          interactableElements,
          pageUrl: window.location.href,
          title: document.title,
          viewport: { 
            width: window.innerWidth, 
            height: window.innerHeight 
          }
        };
        
        function generateSimpleSelector(element: Element): string {
          if (element.id) return `#${element.id}`;
          if (element.classList.length > 0) {
            return `${element.tagName.toLowerCase()}.${Array.from(element.classList).slice(0, 2).join('.')}`;
          }
          return element.tagName.toLowerCase();
        }
        
        function isInteractableElement(element: Element): boolean {
          const interactableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
          if (interactableTags.includes(element.tagName)) return true;
          
          const style = window.getComputedStyle(element);
          if (style.cursor === 'pointer') return true;
          
          return element.hasAttribute('onclick') || element.hasAttribute('role');
        }
      });
      
      session.metadata.domMutationCount++;
      return snapshot;
    } catch (error) {
      console.error('❌ Failed to capture DOM snapshot:', error);
      return null;
    }
  }

  /**
   * Stop recording and capture final state
   */
  public async stopRecording(sessionId: string): Promise<RecordingData | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      console.error(`❌ Session not found or not active: ${sessionId}`);
      return null;
    }

    console.log(`🛑 Stopping recording session: ${sessionId}`);
    
    session.isActive = false;
    session.metadata.endTime = Date.now();

    // Capture final screenshot and DOM state
    console.log('📸 Capturing final state...');
    await this.captureStrategicScreenshot(session, 'final');
    const finalSnapshot = await this.captureDOMSnapshot(session);

    // Compile recording data (structure will depend on your data storage)
    const recordingData: RecordingData = {
      session: session.metadata,
      domSnapshots: [], // Would be collected during recording
      networkRequests: [], // Would be collected during recording
      consoleErrors: [], // Would be collected during recording
      screenshots: [], // Would be collected during recording
      finalState: finalSnapshot || undefined
    };

    // Save recording metadata
    const metadataPath = path.join(this.recordingsDir, `${sessionId}-metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(recordingData, null, 2));
    
    // Clean up session
    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    console.log(`✅ Recording stopped and saved: ${sessionId}`);
    console.log(`📊 Session stats:`, {
      duration: (session.metadata.endTime - session.metadata.startTime) / 1000 + 's',
      screenshots: session.metadata.screenshotCount,
      networkRequests: session.metadata.networkRequestCount,
      consoleErrors: session.metadata.consoleErrorCount,
      domMutations: session.metadata.domMutationCount
    });

    this.emit('recording-stopped', { sessionId, recordingData });
    
    return recordingData;
  }

  /**
   * Get active recording session
   */
  public getActiveSession(): RecordingSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * Check if currently recording
   */
  public isRecording(): boolean {
    return this.activeSessionId !== null && 
           this.sessions.get(this.activeSessionId)?.isActive === true;
  }

  /**
   * Get recording statistics for performance monitoring
   */
  public getPerformanceStats(): object {
    const activeSession = this.getActiveSession();
    if (!activeSession) return {};

    const duration = Date.now() - activeSession.startTime;
    return {
      sessionId: activeSession.id,
      duration: duration / 1000,
      screenshots: activeSession.metadata.screenshotCount,
      networkRequests: activeSession.metadata.networkRequestCount,
      consoleErrors: activeSession.metadata.consoleErrorCount,
      domMutations: activeSession.metadata.domMutationCount,
      averageScreenshotInterval: activeSession.metadata.screenshotCount > 0 
        ? duration / activeSession.metadata.screenshotCount / 1000 
        : 0,
      averageDomMutationInterval: activeSession.metadata.domMutationCount > 0 
        ? duration / activeSession.metadata.domMutationCount / 1000 
        : 0
    };
  }

  /**
   * Dispose and cleanup
   */
  public async dispose(): Promise<void> {
    console.log('🧹 Disposing Enhanced Recording Controller...');

    // Stop any active recordings
    for (const [sessionId, session] of this.sessions) {
      if (session.isActive) {
        await this.stopRecording(sessionId);
      }
    }

    // Cleanup CDP connections
    if (this.cdpSession) {
      await this.cdpSession.detach();
      this.cdpSession = null;
    }

    if (this.playwrightBrowser) {
      await this.playwrightBrowser.close();
      this.playwrightBrowser = null;
    }

    this.playwrightPage = null;
    this.isConnected = false;
    this.sessions.clear();
    this.activeSessionId = null;

    console.log('✅ Enhanced Recording Controller disposed');
  }
}