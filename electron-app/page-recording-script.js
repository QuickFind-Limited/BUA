// Lightweight Page Recording Script for CDP Injection
// Optimized for Page.addScriptToEvaluateOnNewDocument
// Captures user interactions and DOM changes, sends to main process via CDP

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.__pageRecordingActive) return;
  window.__pageRecordingActive = true;
  
  // Configuration
  const config = {
    debounceMs: 150,
    throttleMs: 100,
    domSnapshotInterval: 3000,
    maxTextLength: 200,
    maxSelectorDepth: 5,
    capturePasswords: false,
    captureMouseMove: true,
    captureScroll: true
  };
  
  // State management
  let tabContext = null;
  let actionSequence = 0;
  let lastDomSnapshot = 0;
  let debounceTimers = new Map();
  
  // Initialize tab context
  function initTabContext() {
    tabContext = {
      tabId: window.__tabId || Date.now().toString(),
      url: location.href,
      title: document.title,
      timestamp: Date.now()
    };
  }
  
  // Efficient element selector generation
  function getElementSelector(element) {
    if (!element || element === document || element === window) return '';
    
    // Priority selectors for reliability
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) return `[data-testid="${dataTestId}"]`;
    
    const id = element.id;
    if (id && /^[a-zA-Z][\w-]*$/.test(id)) return `#${id}`;
    
    // Build minimal path selector
    const path = [];
    let current = element;
    let depth = 0;
    
    while (current && current !== document.body && depth < config.maxSelectorDepth) {
      let selector = current.tagName.toLowerCase();
      
      // Add distinguishing attributes for common elements
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => 
          c && !c.startsWith('_') && c.length < 30
        ).slice(0, 2);
        if (classes.length) selector += '.' + classes.join('.');
      }
      
      // Add nth-child only if needed for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
      depth++;
    }
    
    return path.join(' > ');
  }
  
  // Get minimal element info
  function getElementInfo(element) {
    if (!element) return null;
    
    const rect = element.getBoundingClientRect();
    const info = {
      tag: element.tagName.toLowerCase(),
      text: element.textContent ? 
        element.textContent.trim().slice(0, config.maxTextLength) : null
    };
    
    // Capture key attributes
    ['type', 'name', 'placeholder', 'href', 'src', 'alt', 'role'].forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) info[attr] = value;
    });
    
    // Add coordinates if visible
    if (rect.width > 0 && rect.height > 0) {
      info.coords = {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    }
    
    return info;
  }
  
  // Send action to main process via CDP
  function sendAction(type, element, value, extra = {}) {
    try {
      const action = {
        type,
        seq: ++actionSequence,
        timestamp: Date.now(),
        tabContext,
        selector: getElementSelector(element),
        element: getElementInfo(element),
        value,
        url: location.href,
        ...extra
      };
      
      // Send via CDP binding (main process will handle via debugger.on('message'))
      if (window.__sendToMain) {
        window.__sendToMain('page-recording:action', action);
      } else {
        // Fallback: dispatch custom event that can be captured via CDP
        window.dispatchEvent(new CustomEvent('__recordingAction', { 
          detail: action 
        }));
      }
    } catch (error) {
      console.warn('Recording action failed:', error);
    }
  }
  
  // Debounced action sender
  function sendActionDebounced(key, type, element, value, extra = {}) {
    clearTimeout(debounceTimers.get(key));
    debounceTimers.set(key, setTimeout(() => {
      sendAction(type, element, value, extra);
      debounceTimers.delete(key);
    }, config.debounceMs));
  }
  
  // DOM snapshot capture
  function captureDomSnapshot() {
    const now = Date.now();
    if (now - lastDomSnapshot < config.domSnapshotInterval) return;
    
    lastDomSnapshot = now;
    
    try {
      const snapshot = {
        title: document.title,
        url: location.href,
        forms: Array.from(document.forms).map(form => ({
          action: form.action,
          method: form.method,
          elements: form.elements.length
        })),
        inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          required: input.required
        })).slice(0, 50), // Limit for performance
        links: Array.from(document.links).map(link => ({
          href: link.href,
          text: link.textContent.trim().slice(0, 50)
        })).slice(0, 20)
      };
      
      sendAction('dom-snapshot', document.documentElement, null, { snapshot });
    } catch (error) {
      console.warn('DOM snapshot failed:', error);
    }
  }
  
  // Event handlers
  function handleClick(e) {
    const extra = {
      button: e.button,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      x: e.clientX,
      y: e.clientY
    };
    
    // Detect navigation potential
    const element = e.target;
    if (element.tagName === 'A' || 
        element.tagName === 'BUTTON' || 
        element.type === 'submit' ||
        element.closest('form')) {
      extra.navigationExpected = true;
    }
    
    sendAction('click', element, null, extra);
  }
  
  function handleInput(e) {
    const element = e.target;
    const value = config.capturePasswords || element.type !== 'password' ? 
      element.value : '[HIDDEN]';
    
    sendActionDebounced(
      `input-${getElementSelector(element)}`,
      'input',
      element,
      value,
      { inputType: element.type }
    );
  }
  
  function handleKeydown(e) {
    // Only capture special keys and shortcuts
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape' || 
        e.ctrlKey || e.metaKey || e.altKey) {
      sendAction('keydown', e.target, null, {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey
      });
    }
  }
  
  function handleScroll(e) {
    if (!config.captureScroll) return;
    
    const scrollData = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth
    };
    
    sendActionThrottled('scroll', 'scroll', null, null, scrollData);
  }
  
  function handleMouseMove(e) {
    if (!config.captureMouseMove) return;
    
    sendActionThrottled('mousemove', 'mousemove', null, null, {
      x: e.clientX,
      y: e.clientY
    });
  }
  
  function handleChange(e) {
    const element = e.target;
    let value = element.value;
    
    if (element.type === 'checkbox' || element.type === 'radio') {
      value = element.checked;
    } else if (element.tagName === 'SELECT') {
      value = element.options[element.selectedIndex]?.text || element.value;
    }
    
    sendAction('change', element, value, {
      inputType: element.type || element.tagName.toLowerCase()
    });
  }
  
  function handleFocus(e) {
    sendAction('focus', e.target, null, {});
  }
  
  function handleBlur(e) {
    sendAction('blur', e.target, null, {});
  }
  
  function handleSubmit(e) {
    const form = e.target;
    const formData = {};
    
    // Collect form data (excluding passwords unless configured)
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.name) {
        if (input.type === 'password' && !config.capturePasswords) {
          formData[input.name] = '[HIDDEN]';
        } else if (input.type === 'checkbox' || input.type === 'radio') {
          formData[input.name] = input.checked;
        } else {
          formData[input.name] = input.value;
        }
      }
    });
    
    sendAction('submit', form, null, { formData });
  }
  
  function handleResize() {
    sendActionDebounced('resize', 'resize', null, null, {
      width: window.innerWidth,
      height: window.innerHeight
    });
  }
  
  function handleVisibilityChange() {
    sendAction('visibility', null, null, {
      visible: !document.hidden,
      visibilityState: document.visibilityState
    });
  }
  
  function handleError(message, source, lineno, colno, error) {
    sendAction('error', null, null, {
      message: message,
      source: source,
      line: lineno,
      column: colno,
      stack: error?.stack
    });
    return true; // Prevent default error handling
  }
  
  // Add throttling helper for mouse move and scroll
  let throttleTimers = new Map();
  function sendActionThrottled(key, type, element, value, extra) {
    if (throttleTimers.has(key)) return;
    
    sendAction(type, element, value, extra);
    throttleTimers.set(key, setTimeout(() => {
      throttleTimers.delete(key);
    }, config.throttleMs));
  }
  
  // Navigation handlers
  function handleNavigation() {
    sendAction('navigation', document.documentElement, location.href, {
      referrer: document.referrer,
      title: document.title
    });
    
    // Update tab context
    tabContext.url = location.href;
    tabContext.title = document.title;
    
    // Capture new page snapshot
    setTimeout(captureDomSnapshot, 500);
  }
  
  // Initialize recording
  function initialize() {
    // Initialize context
    initTabContext();
    
    // Set up event listeners with passive where appropriate
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('change', handleChange, true);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('error', handleError, true);
    
    // Optional mouse move tracking
    if (config.captureMouseMove) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
    }
    
    // Navigation detection
    let currentUrl = location.href;
    const checkNavigation = () => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        handleNavigation();
      }
    };
    setInterval(checkNavigation, 1000);
    
    // Initial DOM snapshot
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', captureDomSnapshot);
    } else {
      setTimeout(captureDomSnapshot, 100);
    }
    
    // Periodic DOM snapshots
    setInterval(captureDomSnapshot, config.domSnapshotInterval);
    
    // Capture performance metrics
    if (window.performance && performance.timing) {
      const timing = performance.timing;
      const performanceData = {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
      };
      
      sendAction('performance', null, null, performanceData);
    }
    
    // Send initialization signal
    sendAction('page-recording-init', document.documentElement, null, {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timestamp: Date.now()
    });
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})();