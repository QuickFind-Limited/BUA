# Playwright Recording Integration

This document describes the Playwright integration that has been added to the Electron app for capturing user actions in WebContentsView.

## Overview

The Playwright integration allows you to:
- Record user interactions (clicks, typing, navigation, etc.) in any tab
- Generate Playwright test code from recorded sessions
- Export/import recording sessions as JSON
- Capture detailed action metadata including selectors, coordinates, and timing

## Architecture

### Core Components

1. **`main/playwright-recorder.ts`** - Core recording engine
   - Manages recording sessions
   - Injects JavaScript into pages to capture user actions
   - Generates Playwright test code from recorded actions

2. **`main/WebContentsTabManager.ts`** - Enhanced with recording methods
   - `startRecording()` - Start recording in active tab
   - `stopRecording()` - Stop recording and return session data
   - `getRecordingStatus()` - Get current recording status

3. **`main/ipc.ts`** - IPC handlers for recording operations
   - `start-recording` - Start recording
   - `stop-recording` - Stop recording  
   - `recording-status` - Get recording status
   - `generate-playwright-code` - Generate test code
   - `export-recording-session` - Export as JSON
   - `import-recording-session` - Import from JSON

4. **`ui/tabbar.js`** - Enhanced UI with recording functionality
   - Updated `toggleRecording()` function with async/await
   - Recording status display and error handling
   - Recording completion callbacks

5. **`preload.js`** - Exposed recording APIs
   - All recording methods exposed to renderer process
   - Event handling for recording completion

## Usage

### Basic Recording

```javascript
// Start recording
const result = await window.electronAPI.startRecording();
if (result.success) {
    console.log('Recording started:', result.data.sessionId);
}

// Stop recording
const stopResult = await window.electronAPI.stopRecording();
if (stopResult.success) {
    const session = stopResult.data.session;
    console.log('Recorded', session.actions.length, 'actions');
}
```

### Using the Record Button

Simply click the "Record" button in the UI:
1. Button text changes to "Stop" and becomes highlighted
2. All user interactions are captured
3. Click "Stop" to end recording
4. Recording summary is displayed in the status bar
5. Session data is available via callback or event

### Recording Callbacks

```javascript
// Set up callback for recording completion
window.electronAPI.onRecordingComplete((session) => {
    console.log('Recording completed:', session);
    // Process the session data
});

// Or listen for the custom event
window.addEventListener('recordingComplete', (event) => {
    const session = event.detail;
    console.log('Recording session:', session);
});
```

### Generate Playwright Code

```javascript
const codeResult = await window.electronAPI.generatePlaywrightCode(session);
if (codeResult.success) {
    console.log('Generated test code:');
    console.log(codeResult.data.code);
}
```

### Export/Import Sessions

```javascript
// Export session as JSON
const exportResult = await window.electronAPI.exportRecordingSession(session);
const jsonData = exportResult.data.jsonData;

// Import session from JSON
const importResult = await window.electronAPI.importRecordingSession(jsonData);
const importedSession = importResult.data.session;
```

## Recorded Action Types

The recorder captures the following types of user actions:

### Click Events
```javascript
{
  type: 'click',
  selector: '#submit-button',
  coordinates: { x: 100, y: 200 },
  element: { tagName: 'BUTTON', attributes: {...}, text: 'Submit' },
  timestamp: 1640995200000
}
```

### Text Input
```javascript
{
  type: 'type',
  selector: 'input[name="username"]',
  value: 'john.doe',
  element: { tagName: 'INPUT', attributes: {...} },
  timestamp: 1640995210000
}
```

### Navigation
```javascript
{
  type: 'navigate',
  url: 'https://example.com/page2',
  timestamp: 1640995220000,
  waitTime: 1500
}
```

### Form Submission
```javascript
{
  type: 'submit',
  selector: 'form#login',
  value: '{"username":"john","password":"***"}',
  element: { tagName: 'FORM', attributes: {...} },
  timestamp: 1640995230000
}
```

### Select Dropdown
```javascript
{
  type: 'select',
  selector: 'select[name="country"]',
  value: 'US',
  element: { tagName: 'SELECT', attributes: {...} },
  timestamp: 1640995240000
}
```

### Scroll Events
```javascript
{
  type: 'scroll',
  scrollPosition: { x: 0, y: 500 },
  timestamp: 1640995250000
}
```

### Hover Events
```javascript
{
  type: 'hover',
  selector: '.menu-item',
  coordinates: { x: 150, y: 100 },
  element: { tagName: 'DIV', attributes: {...} },
  timestamp: 1640995260000
}
```

### Key Presses
```javascript
{
  type: 'keypress',
  key: 'Enter',
  modifiers: ['Control'],
  selector: 'input#search',
  timestamp: 1640995270000
}
```

## Selector Generation

The recorder generates CSS selectors in this priority order:

1. **ID selector** - `#element-id` (highest priority)
2. **Class selector** - `.class-name` or `.class1.class2`
3. **Attribute selectors** - `[name="value"]`, `[data-testid="value"]`
4. **Text-based selectors** - For buttons/links: `button:has-text("Click me")`
5. **nth-child selectors** - `div > button:nth-child(2)` (fallback)

## Generated Playwright Code

Example generated test:

```javascript
// Generated Playwright test from recording session: recording-tab-123-1640995200000
// Recorded on: 2021-12-31T12:00:00.000Z
// URL: https://example.com

import { test, expect } from '@playwright/test';

test('recorded user flow', async ({ page }) => {
  await page.goto('https://example.com');

  await page.click('#username');
  await page.fill('#username', 'john.doe');
  await page.click('#password');
  await page.fill('#password', 'secretpass');
  await page.click('#login-button');
  await page.waitForTimeout(2000);
  await page.goto('https://example.com/dashboard');
});
```

## Configuration

### Polling Interval
The recorder polls for actions every 500ms. This can be adjusted in `playwright-recorder.ts`:

```typescript
setTimeout(pollForActions, 500); // Adjust timing here
```

### Action Throttling
Some events are throttled to avoid noise:
- Scroll events: 500ms throttle
- Hover events: 100ms throttle

### Selector Optimization
Selectors are optimized for:
- Stability (prefer IDs and attributes over position-based selectors)
- Readability (use meaningful attribute values)
- Playwright compatibility

## Error Handling

The integration includes comprehensive error handling:

- Recording start/stop failures are caught and reported
- Script injection errors are handled gracefully
- UI provides visual feedback for errors
- Console logging for debugging

## Limitations

1. **Cross-origin restrictions** - Some sites may block script injection
2. **Dynamic content** - Selectors may break if page structure changes significantly
3. **Complex interactions** - Some advanced interactions may not be captured perfectly
4. **Performance** - Recording adds some overhead to page interactions

## Testing

To test the integration:

1. Start the Electron app: `npm run dev`
2. Navigate to any website
3. Click the "Record" button
4. Perform various actions (clicking, typing, navigation)
5. Click "Stop" to end recording
6. Check console for recorded actions and generated code

You can also load the example file:
```javascript
// In the browser console
await import('./examples/playwright-recording-example.js');
```

## Future Enhancements

Potential improvements:
- Visual feedback during recording (highlight clicked elements)
- Recording playback functionality
- Smart waiting strategies in generated code
- Integration with existing test frameworks
- Batch recording management
- Recording analytics and insights