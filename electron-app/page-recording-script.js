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
    domSnapshotInterval: 3000,
    maxTextLength: 200,
    maxSelectorDepth: 5,
    capturePasswords: false
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
      altKey: e.altKey
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
  
  function handleKeyDown(e) {
    if (['Enter', 'Tab', 'Escape'].includes(e.key)) {
      sendAction('keydown', e.target, e.key, {
        keyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      });
    }
  }
  
  function handleSubmit(e) {
    sendAction('submit', e.target, null, {
      action: e.target.action,
      method: e.target.method
    });
  }
  
  function handleFocus(e) {
    const element = e.target;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      sendAction('focus', element, null, { inputType: element.type });
    }
  }
  
  function handleScroll() {
    sendActionDebounced('scroll', 'scroll', document.documentElement, null, {
      scrollX: window.scrollX,
      scrollY: window.scrollY
    });
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
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('focus', handleFocus, true);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
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