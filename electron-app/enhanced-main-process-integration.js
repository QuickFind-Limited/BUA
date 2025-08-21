/**
 * Enhanced Main Process Integration
 * Shows how to integrate CDP best practices into main-comprehensive.js
 */

const { EnhancedCDPCommunication } = require('./cdp-best-practices-implementation');

/**
 * Enhanced CDP Recording Manager
 * Integrates with existing main-comprehensive.js structure
 */
class EnhancedCDPRecordingManager {
  constructor() {
    this.cdpCommunication = null;
    this.recordingSessions = new Map();
    this.tabContexts = new Map();
    this.isRecording = false;
  }

  /**
   * Initialize CDP communication for a WebView
   */
  async initializeCDP(webView, tabId, sessionId) {
    try {
      console.log('🚀 Initializing Enhanced CDP for tab:', tabId);
      
      this.cdpCommunication = new EnhancedCDPCommunication(webView);
      
      // Setup runtime binding
      const bindingSuccess = await this.cdpCommunication.setupRuntimeBinding();
      if (!bindingSuccess) {
        throw new Error('Failed to setup runtime binding');
      }
      
      // Setup navigation event handling
      await this.cdpCommunication.handleNavigationEvents(tabId, sessionId);
      
      // Inject persistent script
      await this.cdpCommunication.injectPersistentScript(tabId, sessionId);
      
      console.log('✅ Enhanced CDP initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced CDP:', error);
      return false;
    }
  }

  /**
   * Start enhanced recording session
   */
  async startEnhancedRecording(webView, url = null) {
    if (this.isRecording) {
      return { success: false, error: 'Recording already active' };
    }

    const sessionId = `enhanced-${Date.now()}`;
    const tabId = this.getOrCreateTabId(webView);
    
    console.log('🎬 Starting Enhanced CDP Recording...');
    console.log('  - Session ID:', sessionId);
    console.log('  - Tab ID:', tabId);
    console.log('  - URL:', url || webView.webContents.getURL());

    try {
      // Initialize CDP communication
      const cdpSuccess = await this.initializeCDP(webView, tabId, sessionId);
      if (!cdpSuccess) {
        return { success: false, error: 'Failed to initialize CDP communication' };
      }

      // Create recording session
      const session = {
        id: sessionId,
        tabId: tabId,
        startTime: Date.now(),
        url: url || webView.webContents.getURL(),
        webView: webView,
        isActive: true,
        data: {
          actions: [],
          domMutations: [],
          navigation: [],
          errors: [],
          context: {}
        }
      };

      this.recordingSessions.set(sessionId, session);
      this.isRecording = true;

      // Setup enhanced event handlers
      this.setupEnhancedEventHandlers(sessionId);

      console.log('✅ Enhanced recording started:', sessionId);
      return { 
        success: true, 
        sessionId: sessionId,
        tabId: tabId,
        message: 'Enhanced CDP recording started with context persistence'
      };

    } catch (error) {
      console.error('❌ Error starting enhanced recording:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup enhanced event handlers for the recording session
   */
  setupEnhancedEventHandlers(sessionId) {
    const session = this.recordingSessions.get(sessionId);
    if (!session || !this.cdpCommunication) return;

    // Listen for user actions
    this.cdpCommunication.on('user_action', (data) => {
      session.data.actions.push({
        timestamp: Date.now(),
        sessionId: sessionId,
        ...data
      });
      console.log('👆 Enhanced user action recorded:', data.payload?.type);
    });

    // Listen for DOM changes
    this.cdpCommunication.on('dom_change', (data) => {
      session.data.domMutations.push({
        timestamp: Date.now(),
        sessionId: sessionId,
        ...data
      });
      console.log('🔄 Enhanced DOM change recorded');
    });

    // Listen for navigation events
    this.cdpCommunication.on('navigation_event', (data) => {
      session.data.navigation.push({
        timestamp: Date.now(),
        sessionId: sessionId,
        ...data
      });
      console.log('🧭 Enhanced navigation recorded:', data.payload?.type);
    });

    // Listen for error events
    this.cdpCommunication.on('error_event', (data) => {
      session.data.errors.push({
        timestamp: Date.now(),
        sessionId: sessionId,
        ...data
      });
      console.log('❌ Enhanced error recorded:', data.payload?.message);
    });

    // Listen for script ready events
    this.cdpCommunication.on('script_ready', (data) => {
      console.log('✅ Enhanced script ready on tab:', data.tabId);
      session.data.context = data.payload?.context || {};
    });
  }

  /**
   * Stop enhanced recording and collect comprehensive data
   */
  async stopEnhancedRecording() {
    if (!this.isRecording) {
      return { success: false, error: 'No recording active' };
    }

    console.log('🛑 Stopping Enhanced CDP Recording...');

    try {
      const activeSessions = Array.from(this.recordingSessions.values()).filter(s => s.isActive);
      const results = [];

      for (const session of activeSessions) {
        // Mark session as inactive
        session.isActive = false;
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;

        // Collect final context data
        if (this.cdpCommunication && session.tabId) {
          const finalContext = this.cdpCommunication.getTabContext(session.tabId);
          session.data.finalContext = finalContext;
        }

        // Get final page state
        try {
          const finalPageState = await this.captureFinalPageState(session.webView);
          session.data.finalPageState = finalPageState;
        } catch (e) {
          console.warn('Failed to capture final page state:', e);
        }

        // Compile comprehensive recording data
        const recordingData = {
          session: {
            id: session.id,
            tabId: session.tabId,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            url: session.url,
            finalUrl: session.webView.webContents.getURL()
          },
          stats: {
            totalActions: session.data.actions.length,
            totalDomMutations: session.data.domMutations.length,
            totalNavigations: session.data.navigation.length,
            totalErrors: session.data.errors.length,
            contextPreserved: !!session.data.context.sessionId
          },
          data: session.data
        };

        // Save recording data
        const fs = require('fs').promises;
        const fileName = `enhanced-recording-${session.id}.json`;
        await fs.writeFile(fileName, JSON.stringify(recordingData, null, 2));
        
        console.log(`💾 Enhanced recording saved: ${fileName}`);
        console.log('📊 Recording Stats:', recordingData.stats);

        results.push(recordingData);
      }

      // Cleanup
      await this.cleanup();
      
      this.isRecording = false;
      console.log('✅ Enhanced recording stopped successfully');

      return {
        success: true,
        sessions: results,
        message: 'Enhanced CDP recording completed with full context preservation'
      };

    } catch (error) {
      console.error('❌ Error stopping enhanced recording:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Capture final page state with enhanced details
   */
  async captureFinalPageState(webView) {
    try {
      const pageState = await webView.webContents.executeJavaScript(`
        ({
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          
          // Enhanced page metrics
          dimensions: {
            documentHeight: document.documentElement.scrollHeight,
            documentWidth: document.documentElement.scrollWidth,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            scrollX: window.scrollX,
            scrollY: window.scrollY
          },
          
          // Interactive elements snapshot
          interactiveElements: Array.from(
            document.querySelectorAll('button, a, input, select, textarea, [role="button"], [onclick]')
          ).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }).slice(0, 50).map(el => ({
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            text: el.textContent?.substring(0, 100),
            href: el.href,
            type: el.type,
            bounds: el.getBoundingClientRect(),
            visible: true
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
              hasValue: !!field.value,
              required: field.required,
              disabled: field.disabled
            }))
          })),
          
          // Performance timing
          performance: {
            navigation: performance.timing ? {
              domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
              loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
            } : null,
            memory: performance.memory ? {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize
            } : null
          },
          
          // Enhanced context from sessionStorage
          preservedContext: (() => {
            try {
              const contextKeys = [];
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key.startsWith('cdp_context_')) {
                  contextKeys.push({
                    key: key,
                    data: JSON.parse(sessionStorage.getItem(key))
                  });
                }
              }
              return contextKeys;
            } catch (e) {
              return [];
            }
          })(),
          
          timestamp: Date.now()
        })
      `);

      return pageState;
    } catch (error) {
      console.error('Error capturing final page state:', error);
      return null;
    }
  }

  /**
   * Get or create tab ID for WebView
   */
  getOrCreateTabId(webView) {
    // Try to find existing tab ID
    for (const [tabId, context] of this.tabContexts) {
      if (context.webView === webView) {
        return tabId;
      }
    }

    // Create new tab ID
    const tabId = `tab-enhanced-${Date.now()}`;
    this.tabContexts.set(tabId, { webView, createdAt: Date.now() });
    return tabId;
  }

  /**
   * Get enhanced recording status
   */
  getStatus() {
    const activeSession = Array.from(this.recordingSessions.values()).find(s => s.isActive);
    
    return {
      isRecording: this.isRecording,
      hasActiveCDP: !!this.cdpCommunication,
      activeSession: activeSession ? {
        id: activeSession.id,
        tabId: activeSession.tabId,
        duration: Date.now() - activeSession.startTime,
        actionCount: activeSession.data.actions.length,
        mutationCount: activeSession.data.domMutations.length,
        errorCount: activeSession.data.errors.length
      } : null,
      totalSessions: this.recordingSessions.size,
      tabContexts: Array.from(this.tabContexts.keys())
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.cdpCommunication) {
        await this.cdpCommunication.dispose();
        this.cdpCommunication = null;
      }

      // Clear old sessions (keep last 5)
      const sessions = Array.from(this.recordingSessions.entries());
      if (sessions.length > 5) {
        const toRemove = sessions.slice(0, sessions.length - 5);
        toRemove.forEach(([sessionId]) => {
          this.recordingSessions.delete(sessionId);
        });
      }

      // Clear old tab contexts
      const now = Date.now();
      for (const [tabId, context] of this.tabContexts) {
        if (now - context.createdAt > 3600000) { // 1 hour
          this.tabContexts.delete(tabId);
        }
      }

      console.log('🧹 Enhanced CDP cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

// Integration example for main-comprehensive.js
function integrateEnhancedCDP() {
  const enhancedRecordingManager = new EnhancedCDPRecordingManager();

  // Add to existing IPC handlers
  ipcMain.handle('start-enhanced-cdp-recording', async () => {
    if (!webView) {
      return { success: false, error: 'No WebView available' };
    }

    return await enhancedRecordingManager.startEnhancedRecording(webView);
  });

  ipcMain.handle('stop-enhanced-cdp-recording', async () => {
    return await enhancedRecordingManager.stopEnhancedRecording();
  });

  ipcMain.handle('enhanced-cdp-recording-status', async () => {
    return enhancedRecordingManager.getStatus();
  });

  // Cleanup on app quit
  app.on('before-quit', async () => {
    await enhancedRecordingManager.cleanup();
  });

  return enhancedRecordingManager;
}

module.exports = {
  EnhancedCDPRecordingManager,
  integrateEnhancedCDP
};