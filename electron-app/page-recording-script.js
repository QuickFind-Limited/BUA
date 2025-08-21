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
    captureScroll: true,
    captureHover: true,
    captureClipboard: true,
    captureDragDrop: true,
    captureTouch: true,
    captureMedia: true,
    capturePerformance: true,
    captureConsole: true,
    captureStorage: true
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
      clickCount: e.detail,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
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
  
  function handleDoubleClick(e) {
    sendAction('dblclick', e.target, null, {
      x: e.clientX,
      y: e.clientY
    });
  }
  
  function handleContextMenu(e) {
    sendAction('contextmenu', e.target, null, {
      x: e.clientX,
      y: e.clientY
    });
  }
  
  function handleMouseEnter(e) {
    sendActionThrottled(`hover-${getElementSelector(e.target)}`, 'mouseenter', e.target, null, {
      x: e.clientX,
      y: e.clientY
    });
  }
  
  function handleMouseLeave(e) {
    sendActionThrottled(`hover-${getElementSelector(e.target)}`, 'mouseleave', e.target, null, {
      x: e.clientX,
      y: e.clientY
    });
  }
  
  function handleWheel(e) {
    sendActionThrottled('wheel', 'wheel', e.target, null, {
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode
    });
  }
  
  function handleDragStart(e) {
    const dataTransferInfo = {};
    if (e.dataTransfer) {
      dataTransferInfo.types = Array.from(e.dataTransfer.types);
      dataTransferInfo.effectAllowed = e.dataTransfer.effectAllowed;
    }
    sendAction('dragstart', e.target, null, {
      x: e.clientX,
      y: e.clientY,
      dataTransfer: dataTransferInfo
    });
  }
  
  function handleDragEnd(e) {
    sendAction('dragend', e.target, null, {
      x: e.clientX,
      y: e.clientY,
      dropEffect: e.dataTransfer?.dropEffect
    });
  }
  
  function handleDrop(e) {
    const dataTransferInfo = {};
    if (e.dataTransfer) {
      dataTransferInfo.types = Array.from(e.dataTransfer.types);
      dataTransferInfo.files = Array.from(e.dataTransfer.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }));
    }
    sendAction('drop', e.target, null, {
      x: e.clientX,
      y: e.clientY,
      dataTransfer: dataTransferInfo
    });
  }
  
  function handleCopy(e) {
    sendAction('copy', e.target, window.getSelection().toString());
  }
  
  function handlePaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData ? clipboardData.getData('text') : null;
    sendAction('paste', e.target, pastedText?.slice(0, 100));
  }
  
  function handleCut(e) {
    sendAction('cut', e.target, window.getSelection().toString());
  }
  
  function handleTouchStart(e) {
    const touches = Array.from(e.touches).map(t => ({
      x: t.clientX,
      y: t.clientY,
      id: t.identifier
    }));
    sendAction('touchstart', e.target, null, { touches });
  }
  
  function handleTouchEnd(e) {
    const touches = Array.from(e.changedTouches).map(t => ({
      x: t.clientX,
      y: t.clientY,
      id: t.identifier
    }));
    sendAction('touchend', e.target, null, { touches });
  }
  
  function handleFullscreenChange() {
    sendAction('fullscreenchange', document.fullscreenElement, null, {
      isFullscreen: !!document.fullscreenElement
    });
  }
  
  function handleBeforePrint() {
    sendAction('beforeprint', null, null, {});
  }
  
  function handleAfterPrint() {
    sendAction('afterprint', null, null, {});
  }
  
  function handleStorageChange(e) {
    sendAction('storage', null, null, {
      key: e.key,
      oldValue: e.oldValue?.slice(0, 100),
      newValue: e.newValue?.slice(0, 100),
      storageArea: e.storageArea === localStorage ? 'local' : 'session',
      url: e.url
    });
  }
  
  function handlePopState(e) {
    sendAction('popstate', null, null, {
      state: e.state,
      url: location.href
    });
  }
  
  function handleHashChange(e) {
    sendAction('hashchange', null, null, {
      oldURL: e.oldURL,
      newURL: e.newURL
    });
  }
  
  function handleOnline() {
    sendAction('online', null, null, { online: true });
  }
  
  function handleOffline() {
    sendAction('offline', null, null, { online: false });
  }
  
  function captureConsoleWarning() {
    const originalWarn = console.warn;
    console.warn = function(...args) {
      sendAction('console-warn', null, null, {
        message: args.map(a => String(a)).join(' ').slice(0, 500)
      });
      originalWarn.apply(console, args);
    };
  }
  
  function captureMediaEvents() {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => {
      media.addEventListener('play', () => sendAction('media-play', media, null, {
        currentTime: media.currentTime,
        duration: media.duration
      }));
      media.addEventListener('pause', () => sendAction('media-pause', media, null, {
        currentTime: media.currentTime
      }));
      media.addEventListener('seeked', () => sendAction('media-seeked', media, null, {
        currentTime: media.currentTime
      }));
      media.addEventListener('volumechange', () => sendAction('media-volume', media, null, {
        volume: media.volume,
        muted: media.muted
      }));
    });
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
    document.addEventListener('dblclick', handleDoubleClick, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('change', handleChange, true);
    
    // Mouse events
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Drag and drop
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('dragend', handleDragEnd, true);
    document.addEventListener('drop', handleDrop, true);
    
    // Clipboard
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('cut', handleCut, true);
    
    // Touch events
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Window events
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    
    // Storage
    window.addEventListener('storage', handleStorageChange);
    
    // Navigation
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    
    // Network
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Errors
    window.addEventListener('error', handleError, true);
    
    // Console warnings
    captureConsoleWarning();
    
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
    
    // Monitor for new media elements
    const mediaObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
            captureMediaEvents();
          }
        });
      });
    });
    mediaObserver.observe(document.body, { childList: true, subtree: true });
    
    // Initial media capture
    captureMediaEvents();
    
    // Capture file inputs
    document.addEventListener('change', (e) => {
      if (e.target.type === 'file') {
        const files = Array.from(e.target.files).map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        }));
        sendAction('file-selected', e.target, null, { files });
      }
    }, true);
    
    // Capture performance metrics
    if (window.performance && performance.timing) {
      const timing = performance.timing;
      const performanceData = {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0,
        largestContentfulPaint: 0
      };
      
      // Capture LCP
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        performanceData.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
      });
      
      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {}
      
      // Capture CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        sendAction('performance-cls', null, null, { cls: clsValue });
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {}
      
      // Capture long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          sendAction('long-task', null, null, {
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
      
      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {}
      
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