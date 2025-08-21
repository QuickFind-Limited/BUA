import { WebContentsView } from 'electron';
import { EventEmitter } from 'events';

export interface EnhancedRecordingAction {
  type: string;
  timestamp: number;
  selector: string;
  element?: {
    tagName: string;
    attributes: Record<string, string>;
    textContent?: string;
  };
  value?: string;
  coordinates?: { x: number; y: number };
  url?: string;
  waitFor?: number;
}

export interface EnhancedRecordingSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  url: string;
  actions: EnhancedRecordingAction[];
  screenshots: Array<{
    timestamp: number;
    data: Buffer;
    actionIndex: number;
  }>;
  metadata: {
    userAgent: string;
    viewport: { width: number; height: number };
    title: string;
  };
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  sessionId?: string;
  startTime?: number;
  actionCount: number;
  lastActionTime?: number;
}

/**
 * Enhanced CDP-based recorder that provides more precise control over recording
 * with pause/resume functionality and better action detection
 */
export class EnhancedCDPRecorder extends EventEmitter {
  private session: EnhancedRecordingSession | null = null;
  private webView: WebContentsView | null = null;
  private recordingState: RecordingState = {
    isRecording: false,
    isPaused: false,
    actionCount: 0
  };
  private cdpSession: any = null;
  private actionBuffer: EnhancedRecordingAction[] = [];
  private screenshotInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Start enhanced recording using CDP
   */
  public async startRecording(
    webView: WebContentsView, 
    sessionId: string,
    options: {
      captureScreenshots?: boolean;
      screenshotInterval?: number;
      waitForElements?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      if (this.recordingState.isRecording) {
        throw new Error('Recording already in progress');
      }

      this.webView = webView;
      const webContents = webView.webContents;

      // Enable CDP session
      this.cdpSession = await webContents.debugger.attach('1.3');
      console.log('CDP session attached');

      // Enable required domains
      await this.cdpSession.sendCommand('Runtime.enable');
      await this.cdpSession.sendCommand('DOM.enable');
      await this.cdpSession.sendCommand('Page.enable');
      await this.cdpSession.sendCommand('Network.enable');
      await this.cdpSession.sendCommand('Input.enable');

      // Get page information
      const url = webContents.getURL();
      const title = webContents.getTitle();
      const [width, height] = webContents.getContentSize();

      // Initialize session
      this.session = {
        sessionId,
        startTime: Date.now(),
        url,
        actions: [],
        screenshots: [],
        metadata: {
          userAgent: webContents.getUserAgent(),
          viewport: { width, height },
          title
        }
      };

      this.recordingState = {
        isRecording: true,
        isPaused: false,
        sessionId,
        startTime: Date.now(),
        actionCount: 0
      };

      // Set up CDP event listeners for enhanced recording
      await this.setupCDPListeners();

      // Inject enhanced recording script
      await this.injectRecordingScript();

      // Start periodic screenshots if enabled
      if (options.captureScreenshots !== false) {
        this.startScreenshotCapture(options.screenshotInterval || 5000);
      }

      this.emit('recording-started', { sessionId, session: this.session });
      console.log('Enhanced CDP recording started:', sessionId);

      return true;
    } catch (error) {
      console.error('Failed to start enhanced recording:', error);
      await this.cleanup();
      return false;
    }
  }

  /**
   * Pause recording (stops capturing actions but maintains session)
   */
  public pauseRecording(): boolean {
    if (!this.recordingState.isRecording || this.recordingState.isPaused) {
      return false;
    }

    this.recordingState.isPaused = true;
    this.emit('recording-paused', { sessionId: this.recordingState.sessionId });
    console.log('Enhanced recording paused');
    return true;
  }

  /**
   * Resume recording (continues capturing actions)
   */
  public resumeRecording(): boolean {
    if (!this.recordingState.isRecording || !this.recordingState.isPaused) {
      return false;
    }

    this.recordingState.isPaused = false;
    this.emit('recording-resumed', { sessionId: this.recordingState.sessionId });
    console.log('Enhanced recording resumed');
    return true;
  }

  /**
   * Stop recording and return session data
   */
  public async stopRecording(): Promise<EnhancedRecordingSession | null> {
    try {
      if (!this.recordingState.isRecording || !this.session) {
        return null;
      }

      // Process any remaining actions
      if (this.actionBuffer.length > 0) {
        this.session.actions.push(...this.actionBuffer);
        this.actionBuffer = [];
      }

      // Set end time
      this.session.endTime = Date.now();

      // Take final screenshot
      await this.captureScreenshot('final');

      // Clean up
      await this.cleanup();

      const completedSession = this.session;
      this.session = null;
      this.recordingState = {
        isRecording: false,
        isPaused: false,
        actionCount: 0
      };

      this.emit('recording-stopped', { session: completedSession });
      console.log('Enhanced CDP recording stopped');

      return completedSession;
    } catch (error) {
      console.error('Error stopping enhanced recording:', error);
      await this.cleanup();
      return null;
    }
  }

  /**
   * Get current recording status
   */
  public getRecordingStatus(): RecordingState {
    return { ...this.recordingState };
  }

  /**
   * Setup CDP event listeners for enhanced action detection
   */
  private async setupCDPListeners(): Promise<void> {
    if (!this.cdpSession) return;

    // Listen for mouse clicks
    this.cdpSession.on('Input.dispatchMouseEvent', (params: any) => {
      if (this.recordingState.isPaused) return;
      this.handleMouseEvent(params);
    });

    // Listen for keyboard input
    this.cdpSession.on('Input.dispatchKeyEvent', (params: any) => {
      if (this.recordingState.isPaused) return;
      this.handleKeyEvent(params);
    });

    // Listen for page navigation
    this.cdpSession.on('Page.frameNavigated', (params: any) => {
      if (this.recordingState.isPaused) return;
      this.handleNavigation(params);
    });

    // Listen for DOM changes
    this.cdpSession.on('DOM.documentUpdated', () => {
      if (this.recordingState.isPaused) return;
      // Handle dynamic content changes
    });
  }

  /**
   * Inject enhanced recording script into the page
   */
  private async injectRecordingScript(): Promise<void> {
    if (!this.webView) return;

    const script = `
      (function() {
        if (window.__enhancedRecordingActive) return;
        window.__enhancedRecordingActive = true;
        
        console.log('Enhanced CDP recording script injected');
        
        // Enhanced event capture with better element identification
        function getElementSelector(element) {
          if (!element) return '';
          
          // Try data-testid first (best practice)
          if (element.getAttribute('data-testid')) {
            return '[data-testid="' + element.getAttribute('data-testid') + '"]';
          }
          
          // Try id
          if (element.id) {
            return '#' + element.id;
          }
          
          // Try unique class combinations
          if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\\s+/);
            if (classes.length > 0 && classes[0]) {
              return '.' + classes.join('.');
            }
          }
          
          // Build path selector as fallback
          const path = [];
          let current = element;
          
          while (current && current !== document.body && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();
            
            // Add nth-child if needed for uniqueness
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                child => child.tagName === current.tagName
              );
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += ':nth-child(' + index + ')';
              }
            }
            
            path.unshift(selector);
            current = current.parentElement;
          }
          
          return path.join(' > ');
        }
        
        function getElementInfo(element) {
          if (!element) return null;
          
          const rect = element.getBoundingClientRect();
          const attributes = {};
          
          // Capture important attributes
          ['id', 'class', 'data-testid', 'name', 'type', 'placeholder', 'href', 'src'].forEach(attr => {
            const value = element.getAttribute(attr);
            if (value) attributes[attr] = value;
          });
          
          return {
            tagName: element.tagName.toLowerCase(),
            attributes,
            textContent: element.textContent ? element.textContent.slice(0, 100) : undefined,
            coordinates: {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2
            }
          };
        }
        
        function recordAction(type, element, value, extra = {}) {
          const action = {
            type,
            timestamp: Date.now(),
            selector: getElementSelector(element),
            element: getElementInfo(element),
            value,
            url: window.location.href,
            ...extra
          };
          
          // Send to main process
          if (window.electronAPI && window.electronAPI.recordEnhancedAction) {
            window.electronAPI.recordEnhancedAction(action);
          }
        }
        
        // Enhanced click tracking with wait detection
        document.addEventListener('click', function(e) {
          recordAction('click', e.target, null, {
            button: e.button,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey
          });
          
          // Detect if click might require waiting
          const element = e.target;
          if (element.tagName === 'BUTTON' || 
              element.type === 'submit' || 
              element.href ||
              element.classList.contains('loading') ||
              element.getAttribute('data-loading')) {
            recordAction('waitForNavigation', element, null, { reason: 'click_navigation' });
          }
        }, true);
        
        // Enhanced input tracking with debouncing
        let inputTimeout;
        document.addEventListener('input', function(e) {
          clearTimeout(inputTimeout);
          inputTimeout = setTimeout(() => {
            recordAction('input', e.target, e.target.value);
          }, 300); // Debounce input events
        }, true);
        
        // Form submission tracking
        document.addEventListener('submit', function(e) {
          recordAction('submit', e.target, null);
          recordAction('waitForNavigation', e.target, null, { reason: 'form_submit' });
        }, true);
        
        // Key press tracking (for special keys)
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') {
            recordAction('keydown', e.target, e.key, {
              keyCode: e.keyCode,
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey,
              altKey: e.altKey
            });
          }
        }, true);
        
        // Scroll tracking (debounced)
        let scrollTimeout;
        window.addEventListener('scroll', function() {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            recordAction('scroll', document.documentElement, null, {
              scrollX: window.scrollX,
              scrollY: window.scrollY
            });
          }, 500);
        });
        
        // Focus tracking for form elements
        document.addEventListener('focus', function(e) {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            recordAction('focus', e.target, null);
          }
        }, true);
        
        console.log('Enhanced recording event listeners attached');
      })();
    `;

    await this.webView.webContents.executeJavaScript(script);
  }

  /**
   * Handle mouse events from CDP
   */
  private handleMouseEvent(params: any): void {
    if (!this.session || this.recordingState.isPaused) return;

    const action: EnhancedRecordingAction = {
      type: `mouse_${params.type}`,
      timestamp: Date.now(),
      selector: '', // Will be filled by injected script
      coordinates: { x: params.x, y: params.y }
    };

    this.actionBuffer.push(action);
  }

  /**
   * Handle keyboard events from CDP
   */
  private handleKeyEvent(params: any): void {
    if (!this.session || this.recordingState.isPaused) return;

    const action: EnhancedRecordingAction = {
      type: `key_${params.type}`,
      timestamp: Date.now(),
      selector: '',
      value: params.text || params.key
    };

    this.actionBuffer.push(action);
  }

  /**
   * Handle navigation events
   */
  private handleNavigation(params: any): void {
    if (!this.session || this.recordingState.isPaused) return;

    const action: EnhancedRecordingAction = {
      type: 'navigation',
      timestamp: Date.now(),
      selector: '',
      url: params.frame.url
    };

    this.session.actions.push(action);
    this.recordingState.actionCount++;
    this.recordingState.lastActionTime = Date.now();
  }

  /**
   * Process action from injected script
   */
  public processEnhancedAction(action: EnhancedRecordingAction): boolean {
    try {
      if (!this.session || this.recordingState.isPaused) {
        return false;
      }

      this.session.actions.push(action);
      this.recordingState.actionCount++;
      this.recordingState.lastActionTime = Date.now();

      this.emit('action-recorded', { action, sessionId: this.recordingState.sessionId });
      return true;
    } catch (error) {
      console.error('Error processing enhanced action:', error);
      return false;
    }
  }

  /**
   * Start periodic screenshot capture
   */
  private startScreenshotCapture(interval: number): void {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
    }

    this.screenshotInterval = setInterval(async () => {
      if (!this.recordingState.isPaused) {
        await this.captureScreenshot('interval');
      }
    }, interval);
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(type: 'interval' | 'action' | 'final'): Promise<void> {
    try {
      if (!this.webView || !this.session) return;

      const screenshot = await this.webView.webContents.capturePage();
      const buffer = screenshot.toPNG();

      this.session.screenshots.push({
        timestamp: Date.now(),
        data: buffer,
        actionIndex: this.session.actions.length
      });

      console.log(`Screenshot captured (${type}):`, buffer.length, 'bytes');
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  }

  /**
   * Generate Playwright code from enhanced session
   */
  public generatePlaywrightCode(session: EnhancedRecordingSession): string {
    const lines: string[] = [];
    
    lines.push("import { test, expect } from '@playwright/test';");
    lines.push("");
    lines.push(`test('${session.metadata.title || 'Enhanced recorded test'}', async ({ page }) => {`);
    lines.push(`  // Enhanced recording from ${new Date(session.startTime).toISOString()}`);
    lines.push(`  await page.goto('${session.url}');`);
    lines.push("");
    
    for (const action of session.actions) {
      switch (action.type) {
        case 'click':
          lines.push(`  await page.click('${action.selector}');`);
          if (action.waitFor) {
            lines.push(`  await page.waitForTimeout(${action.waitFor});`);
          }
          break;
        case 'input':
          lines.push(`  await page.fill('${action.selector}', '${action.value || ''}');`);
          break;
        case 'keydown':
          if (action.value === 'Enter') {
            lines.push(`  await page.press('${action.selector}', 'Enter');`);
          } else if (action.value === 'Tab') {
            lines.push(`  await page.press('${action.selector}', 'Tab');`);
          }
          break;
        case 'navigation':
          lines.push(`  await page.waitForURL('${action.url}');`);
          break;
        case 'scroll':
          if (action.element?.coordinates) {
            lines.push(`  await page.mouse.wheel(0, ${action.element.coordinates.y});`);
          }
          break;
        case 'waitForNavigation':
          lines.push(`  await page.waitForLoadState('networkidle');`);
          break;
      }
    }
    
    lines.push("});");
    
    return lines.join('\n');
  }

  /**
   * Export session as JSON
   */
  public exportSession(session: EnhancedRecordingSession): string {
    // Remove screenshot data for export (too large)
    const exportSession = {
      ...session,
      screenshots: session.screenshots.map(s => ({
        timestamp: s.timestamp,
        actionIndex: s.actionIndex,
        size: s.data.length
      }))
    };

    return JSON.stringify(exportSession, null, 2);
  }

  /**
   * Clean up CDP session and resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }

      if (this.cdpSession) {
        await this.cdpSession.detach();
        this.cdpSession = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Dispose and cleanup all resources
   */
  public async dispose(): Promise<void> {
    await this.cleanup();
    this.removeAllListeners();
  }
}