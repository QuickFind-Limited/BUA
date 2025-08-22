# Comprehensive Recording Data Capture Documentation

## Overview
The recording system captures data through two main mechanisms:
1. **Chrome DevTools Protocol (CDP)** - Network-level browser events
2. **Injected JavaScript** - DOM-level user interactions

## 1. CDP Data Capture (Native Browser Events)

### Enabled CDP Domains:
- **Page** - Page lifecycle events
- **Runtime** - JavaScript execution context
- **DOM** - DOM tree structure and mutations
- **Network** - All network requests/responses
- **Console** - Console messages and errors
- **Performance** - Performance metrics

### CDP Events Captured:

#### Network Events (`recordingData.network`)
- All `Network.*` events including:
  - `Network.requestWillBeSent` - Outgoing requests
  - `Network.responseReceived` - Incoming responses
  - `Network.loadingFinished` - Request completion
  - Request method, URL, headers, response status
  - Timing information for each request

#### Console Events (`recordingData.console`)
- All `Console.*` events including:
  - Console logs
  - Console errors
  - Console warnings
  - Stack traces

#### Performance Events (`recordingData.performance`)
- All `Performance.*` events including:
  - Page load metrics
  - Runtime performance data
  - Memory usage

## 2. Injected JavaScript Data Capture

### Core Recording Arrays:

#### `actions[]` - All User Interactions
Captures ALL DOM events including:
- **Mouse Events**: click, dblclick, mousedown, mouseup, mousemove, mouseenter, mouseleave, mouseover, mouseout, contextmenu
- **Keyboard Events**: keydown, keyup, keypress
- **Form Events**: input, change, focus, blur, submit, reset
- **Scroll Events**: scroll, wheel
- **Touch Events**: touchstart, touchmove, touchend, touchcancel
- **Drag Events**: dragstart, drag, dragend, dragenter, dragover, dragleave, drop
- **Clipboard Events**: copy, cut, paste
- **Media Events**: play, pause, ended, volumechange
- **Window Events**: resize, orientationchange

Each action includes:
```javascript
{
  type: 'click',              // Event type
  timestamp: 1234567890,      // Time since recording start
  target: {
    tagName: 'BUTTON',        // Element tag
    id: 'submit-btn',         // Element ID
    className: 'btn primary', // CSS classes
    selector: 'button#submit-btn.btn.primary', // Full CSS selector
    value: 'Submit'           // NEW: Actual value for inputs (fixed!)
  },
  // Event-specific data
  mousePosition: { x: 100, y: 200 },  // For mouse events
  key: 'a',                   // For keyboard events
  keyCode: 65,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  value: 'Test Item 1A',      // NEW: Direct value for input/change events
  // Context
  url: 'https://example.com',
  scrollPosition: { x: 0, y: 100 }
}
```

#### `domSnapshots[]` - DOM State Captures
Periodic snapshots (every 5 seconds) containing:
```javascript
{
  timestamp: 1234567890,
  url: 'https://example.com',
  title: 'Page Title',
  counts: {
    total: 500,        // Total elements
    visible: 450,      // Visible elements
    interactive: 50,   // Buttons, links, inputs
    forms: 2,          // Form count
    images: 10,        // Image count
    iframes: 1         // IFrame count
  },
  interactables: [     // All interactive elements
    {
      tagName: 'INPUT',
      id: 'username',
      className: 'form-control',
      name: 'username',
      type: 'text',
      value: 'current value',
      placeholder: 'Enter username',
      ariaLabel: 'Username field',
      dataset: { testid: 'username-input' },
      visible: true,
      rect: { top: 100, left: 50, width: 200, height: 40 }
    }
  ],
  forms: [             // All forms with their fields
    {
      id: 'login-form',
      action: '/login',
      method: 'POST',
      fields: [...]
    }
  ],
  layout: {            // Page layout info
    viewport: { width: 1920, height: 1080 },
    documentHeight: 3000,
    documentWidth: 1920
  },
  viewport: { top: 0, left: 0, width: 1920, height: 1080 },
  performance: {       // Performance metrics at snapshot time
    memory: { usedJSHeapSize: 10000000 },
    timing: { loadEventEnd: 2000 }
  }
}
```

#### `mutations[]` - DOM Changes
MutationObserver tracking:
- Element additions/removals
- Attribute changes
- Text content changes
- Child list modifications
```javascript
{
  type: 'childList',
  target: { id: 'container', tagName: 'DIV' },
  addedNodes: 5,
  removedNodes: 2,
  timestamp: 1234567890
}
```

#### `visibilityChanges[]` - Element Visibility
IntersectionObserver tracking elements entering/leaving viewport:
```javascript
{
  selector: '#important-element',
  visible: true,
  intersectionRatio: 0.8,
  timestamp: 1234567890
}
```

## 3. Additional Captured Data

### `screenshots[]` 
- Single screenshot captured when recording stops (not periodic)
- Base64 encoded PNG image
- Viewport dimensions

### `extractedInputs[]` (NEW)
Processed input values extracted from keydown events:
```javascript
{
  field: 'item_name',
  value: 'Test Item 1A',  // Final reconstructed value
  url: 'https://inventory.zoho.com/items/new',
  element: { /* element details */ }
}
```

### Recording Metadata
```javascript
{
  sessionId: 'comprehensive-1234567890',
  startTime: 1234567890,
  endTime: 1234567899,
  duration: 9000,
  url: 'https://starting-url.com',
  title: 'Page Title',
  tabSwitches: [],      // Multi-tab navigation
  tabsUsed: ['tab-initial'],
  stats: {
    totalActions: 1267,
    totalSnapshots: 74,
    totalMutations: 5807,
    totalNetworkEvents: 1128,
    totalConsoleEvents: 764,
    totalScreenshots: 1,
    dataSizeMB: 10.48
  }
}
```

## 4. What's NOT Captured by Playwright Native

This system does NOT use Playwright's native recording. Instead, it uses:
- Chrome DevTools Protocol for low-level browser events
- Injected JavaScript for DOM interactions
- Custom event listeners for comprehensive coverage

Playwright would typically only capture:
- High-level actions (click, type, navigate)
- Basic selectors
- Limited context

Our system captures EVERYTHING for bulletproof Intent Spec generation.

## 5. Recent Fixes

1. **Input Value Capture** - Now captures actual field values directly in input/change events
2. **Screenshot Optimization** - Only captures one screenshot at stop (not periodic)
3. **Field Value Reconstruction** - Fallback to keydown reconstruction if values missing
4. **Enhanced Prompt Generation** - Summarizes data instead of embedding full JSON

## Data Flow

1. **Recording Start** → CDP domains enabled + Script injected
2. **User Interaction** → Events captured in arrays
3. **Recording Stop** → Data processed + Intent Spec generated
4. **AI Analysis** → Enhanced prompt with summarized data
5. **Output** → Intent Spec with detected variables