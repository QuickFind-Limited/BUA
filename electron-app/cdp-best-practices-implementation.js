/**
 * CDP Best Practices Implementation
 * Enhanced Chrome DevTools Protocol usage for main-comprehensive.js
 */

// Enhanced CDP communication using Runtime.addBinding
class EnhancedCDPCommunication {
  constructor(webView) {
    this.webView = webView;
    this.debugger = webView.webContents.debugger;
    this.bindings = new Map();
    this.contextData = new Map();
  }

  /**
   * 1. Setup Runtime.addBinding for bidirectional communication
   */
  async setupRuntimeBinding() {
    try {
      // Add persistent binding that survives navigation
      await this.debugger.sendCommand('Runtime.addBinding', {
        name: 'sendToMainProcess'
      });

      // Listen for binding calls
      this.debugger.on('message', (event, method, params) => {
        if (method === 'Runtime.bindingCalled' && params.name === 'sendToMainProcess') {
          this.handleBindingCall(params);
        }
      });

      console.log('✅ Runtime binding established');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup runtime binding:', error);
      return false;
    }
  }

  /**
   * Handle binding calls from injected scripts
   */
  handleBindingCall(params) {
    try {
      const data = JSON.parse(params.payload);
      const { type, tabId, sessionId, payload } = data;

      switch (type) {
        case 'USER_ACTION':
          this.handleUserAction(tabId, sessionId, payload);
          break;
        case 'DOM_CHANGE':
          this.handleDomChange(tabId, sessionId, payload);
          break;
        case 'NAVIGATION_EVENT':
          this.handleNavigationEvent(tabId, sessionId, payload);
          break;
        case 'ERROR_EVENT':
          this.handleErrorEvent(tabId, sessionId, payload);
          break;
        default:
          console.warn('Unknown binding call type:', type);
      }
    } catch (error) {
      console.error('Error handling binding call:', error);
    }
  }

  /**
   * 2. Enhanced Page.addScriptToEvaluateOnNewDocument with context persistence
   */
  async injectPersistentScript(tabId, sessionId) {
    const persistentScript = `
      // Enhanced CDP communication script
      (function() {
        // Context persistence across navigations
        const CONTEXT_KEY = 'cdp_context_${sessionId}';
        
        // Restore context from sessionStorage
        let context = {};
        try {
          const saved = sessionStorage.getItem(CONTEXT_KEY);
          if (saved) {
            context = JSON.parse(saved);
          }
        } catch (e) {
          console.warn('Failed to restore context:', e);
        }

        // Initialize context with tab/session info
        context.tabId = '${tabId}';
        context.sessionId = '${sessionId}';
        context.url = window.location.href;
        context.startTime = context.startTime || Date.now();
        context.navigationCount = (context.navigationCount || 0) + 1;

        // Save context
        function saveContext() {
          try {
            sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
          } catch (e) {
            console.warn('Failed to save context:', e);
          }
        }

        // Enhanced binding function with context
        function sendToMainProcess(type, payload) {
          if (typeof window.sendToMainProcess === 'function') {
            const message = {
              type,
              tabId: context.tabId,
              sessionId: context.sessionId,
              timestamp: Date.now(),
              url: window.location.href,
              payload
            };
            
            window.sendToMainProcess(JSON.stringify(message));
          } else {
            console.warn('sendToMainProcess binding not available');
          }
        }

        // 3. Enhanced user action tracking with context
        const actionTracker = {
          lastAction: null,
          actionSequence: context.actionSequence || 0,

          trackAction(element, actionType, details = {}) {
            this.actionSequence++;
            
            const action = {
              sequence: this.actionSequence,
              type: actionType,
              timestamp: Date.now(),
              element: {
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                textContent: element.textContent?.substring(0, 100),
                selector: this.generateSelector(element),
                xpath: this.generateXPath(element),
                bounds: element.getBoundingClientRect()
              },
              details,
              context: {
                url: window.location.href,
                title: document.title,
                viewport: {
                  width: window.innerWidth,
                  height: window.innerHeight,
                  scrollX: window.scrollX,
                  scrollY: window.scrollY
                }
              }
            };

            sendToMainProcess('USER_ACTION', action);
            this.lastAction = action;
            context.actionSequence = this.actionSequence;
            saveContext();
          },

          generateSelector(element) {
            // Multiple selector strategies
            const selectors = [];
            
            if (element.id) {
              selectors.push('#' + element.id);
            }
            
            if (element.getAttribute('data-testid')) {
              selectors.push('[data-testid="' + element.getAttribute('data-testid') + '"]');
            }
            
            if (element.className) {
              const classes = element.className.split(' ').filter(c => c && !c.match(/^[0-9]/));
              if (classes.length > 0) {
                selectors.push(element.tagName.toLowerCase() + '.' + classes.slice(0, 2).join('.'));
              }
            }
            
            // CSS selector path
            let path = [];
            let current = element;
            while (current && current !== document.body) {
              let selector = current.tagName.toLowerCase();
              if (current.id) {
                selector += '#' + current.id;
                path.unshift(selector);
                break;
              } else if (current.className) {
                const classes = current.className.split(' ').filter(c => c).slice(0, 1);
                if (classes.length > 0) {
                  selector += '.' + classes.join('.');
                }
              }
              path.unshift(selector);
              current = current.parentElement;
            }
            selectors.push(path.join(' > '));

            return selectors;
          },

          generateXPath(element) {
            if (element.id) {
              return '//*[@id="' + element.id + '"]';
            }
            
            const path = [];
            let current = element;
            
            while (current && current.nodeType === Node.ELEMENT_NODE) {
              let index = 1;
              let sibling = current.previousElementSibling;
              
              while (sibling) {
                if (sibling.tagName === current.tagName) {
                  index++;
                }
                sibling = sibling.previousElementSibling;
              }
              
              const tagName = current.tagName.toLowerCase();
              const pathElement = index > 1 ? tagName + '[' + index + ']' : tagName;
              path.unshift(pathElement);
              
              current = current.parentElement;
            }
            
            return '/' + path.join('/');
          }
        };

        // 4. Enhanced DOM change monitoring with context
        const domMonitor = {
          observer: null,
          changeCount: context.changeCount || 0,
          lastSnapshot: 0,
          
          start() {
            if (this.observer) return;
            
            this.observer = new MutationObserver((mutations) => {
              this.changeCount += mutations.length;
              
              // Throttle DOM snapshots
              const now = Date.now();
              if (now - this.lastSnapshot < 2000) return;
              this.lastSnapshot = now;
              
              const significantChanges = mutations.filter(m => 
                m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)
              );
              
              if (significantChanges.length > 0) {
                const snapshot = this.createSnapshot();
                sendToMainProcess('DOM_CHANGE', {
                  changeCount: this.changeCount,
                  mutations: significantChanges.length,
                  snapshot
                });
                
                context.changeCount = this.changeCount;
                saveContext();
              }
            });
            
            this.observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: false, // Skip for performance
              characterData: false
            });
          },
          
          createSnapshot() {
            const interactiveElements = document.querySelectorAll(
              'button, a, input, select, textarea, [role="button"], [onclick]'
            );
            
            return {
              timestamp: Date.now(),
              elementCount: document.querySelectorAll('*').length,
              interactiveCount: interactiveElements.length,
              visibleElements: Array.from(interactiveElements)
                .filter(el => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0;
                })
                .slice(0, 20) // Limit for performance
                .map(el => ({
                  tagName: el.tagName,
                  selector: actionTracker.generateSelector(el)[0],
                  text: el.textContent?.substring(0, 50),
                  bounds: el.getBoundingClientRect()
                }))
            };
          },
          
          stop() {
            if (this.observer) {
              this.observer.disconnect();
              this.observer = null;
            }
          }
        };

        // 5. Navigation event handling with context
        function handleNavigation(event) {
          const navigationData = {
            type: event.type,
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            previousUrl: context.url,
            navigationCount: context.navigationCount,
            referrer: document.referrer,
            loadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart
          };
          
          sendToMainProcess('NAVIGATION_EVENT', navigationData);
          
          // Update context
          context.url = window.location.href;
          context.lastNavigation = Date.now();
          saveContext();
        }

        // Setup event listeners
        ['click', 'dblclick', 'mousedown', 'keydown', 'input', 'change', 'submit'].forEach(eventType => {
          document.addEventListener(eventType, (e) => {
            if (e.target) {
              let details = {};
              
              switch(eventType) {
                case 'input':
                case 'change':
                  details.value = e.target.value ? 'has_value' : 'empty';
                  details.type = e.target.type;
                  break;
                case 'click':
                case 'mousedown':
                  details.coordinates = { x: e.clientX, y: e.clientY };
                  details.button = e.button;
                  break;
                case 'keydown':
                  details.key = e.key;
                  details.code = e.code;
                  details.ctrlKey = e.ctrlKey;
                  details.shiftKey = e.shiftKey;
                  details.altKey = e.altKey;
                  break;
                case 'submit':
                  details.formAction = e.target.action;
                  details.formMethod = e.target.method;
                  break;
              }
              
              actionTracker.trackAction(e.target, eventType, details);
            }
          }, true);
        });

        // Listen for navigation events
        ['load', 'beforeunload', 'pagehide', 'pageshow'].forEach(eventType => {
          window.addEventListener(eventType, handleNavigation);
        });

        // Start monitoring
        domMonitor.start();
        
        // Notify that script is ready
        sendToMainProcess('SCRIPT_READY', {
          url: window.location.href,
          title: document.title,
          context: context
        });
        
        console.log('✅ Enhanced CDP script initialized', context);

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
          domMonitor.stop();
          saveContext();
        });

      })();
    `;

    try {
      await this.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: persistentScript,
        worldName: 'cdp_isolated' // Isolated world to avoid conflicts
      });

      // Also inject into current page if it exists
      await this.debugger.sendCommand('Runtime.evaluate', {
        expression: persistentScript,
        worldName: 'cdp_isolated'
      });

      console.log('✅ Persistent script injected');
      return true;
    } catch (error) {
      console.error('❌ Failed to inject persistent script:', error);
      return false;
    }
  }

  /**
   * 6. Enhanced navigation handling with context preservation
   */
  async handleNavigationEvents(tabId, sessionId) {
    // Listen for frame navigation
    this.debugger.on('message', (event, method, params) => {
      if (method === 'Page.frameNavigated') {
        this.handleFrameNavigated(tabId, sessionId, params);
      } else if (method === 'Page.domContentEventFired') {
        this.handleDomReady(tabId, sessionId, params);
      } else if (method === 'Page.loadEventFired') {
        this.handlePageLoad(tabId, sessionId, params);
      }
    });

    // Enable page events
    await this.debugger.sendCommand('Page.enable');
    
    // Enable frame events for iframe handling
    await this.debugger.sendCommand('Page.setLifecycleEventsEnabled', { enabled: true });
  }

  handleFrameNavigated(tabId, sessionId, params) {
    const frameData = {
      frameId: params.frame.id,
      url: params.frame.url,
      name: params.frame.name,
      timestamp: Date.now(),
      isMainFrame: !params.frame.parentId
    };

    if (frameData.isMainFrame) {
      // Main frame navigation - re-inject scripts
      setTimeout(async () => {
        await this.injectPersistentScript(tabId, sessionId);
      }, 100);
    }

    // Store navigation context
    this.contextData.set(tabId, {
      ...this.contextData.get(tabId),
      currentFrame: frameData,
      lastNavigation: Date.now()
    });

    console.log('📍 Frame navigated:', frameData);
  }

  handleDomReady(tabId, sessionId, params) {
    console.log('📄 DOM ready for tab:', tabId);
    
    // Update context
    const context = this.contextData.get(tabId) || {};
    context.domReadyTime = params.timestamp;
    this.contextData.set(tabId, context);
  }

  handlePageLoad(tabId, sessionId, params) {
    console.log('📊 Page loaded for tab:', tabId);
    
    // Update context
    const context = this.contextData.get(tabId) || {};
    context.pageLoadTime = params.timestamp;
    context.loadDuration = params.timestamp - (context.domReadyTime || params.timestamp);
    this.contextData.set(tabId, context);
  }

  /**
   * Event handlers for different types of data
   */
  handleUserAction(tabId, sessionId, payload) {
    console.log('👆 User action:', payload.type, 'on tab:', tabId);
    
    // Store in recording data structure
    if (recordingActive && recordingData) {
      recordingData.actions.push({
        tabId,
        sessionId,
        timestamp: Date.now(),
        ...payload
      });
    }
  }

  handleDomChange(tabId, sessionId, payload) {
    console.log('🔄 DOM change on tab:', tabId, 'Changes:', payload.changeCount);
    
    if (recordingActive && recordingData) {
      recordingData.domMutations.push({
        tabId,
        sessionId,
        timestamp: Date.now(),
        ...payload
      });
    }
  }

  handleNavigationEvent(tabId, sessionId, payload) {
    console.log('🧭 Navigation event:', payload.type, 'on tab:', tabId);
    
    if (recordingActive && recordingData) {
      recordingData.navigation = recordingData.navigation || [];
      recordingData.navigation.push({
        tabId,
        sessionId,
        timestamp: Date.now(),
        ...payload
      });
    }
  }

  handleErrorEvent(tabId, sessionId, payload) {
    console.log('❌ Error event on tab:', tabId, payload.message);
    
    if (recordingActive && recordingData) {
      recordingData.errors = recordingData.errors || [];
      recordingData.errors.push({
        tabId,
        sessionId,
        timestamp: Date.now(),
        ...payload
      });
    }
  }

  /**
   * 7. Context management across tabs and navigations
   */
  getTabContext(tabId) {
    return this.contextData.get(tabId) || {};
  }

  setTabContext(tabId, context) {
    this.contextData.set(tabId, context);
  }

  clearTabContext(tabId) {
    this.contextData.delete(tabId);
  }

  /**
   * 8. Cleanup and disposal
   */
  async dispose() {
    try {
      // Remove all bindings
      for (const bindingName of this.bindings.keys()) {
        await this.debugger.sendCommand('Runtime.removeBinding', {
          name: bindingName
        });
      }
      
      // Clear context data
      this.contextData.clear();
      this.bindings.clear();
      
      console.log('✅ CDP communication disposed');
    } catch (error) {
      console.error('❌ Error disposing CDP communication:', error);
    }
  }
}

// Export for use in main-comprehensive.js
module.exports = { EnhancedCDPCommunication };