# Enhanced Recording Controller

The Enhanced Recording Controller provides performant data capture for WebContentsView instances via CDP (Chrome DevTools Protocol). It targets < 5% performance overhead through strategic monitoring and throttling.

## Features

- **CDP Connection**: Connects to WebContentsView via port 9335 (configured in main.ts)
- **Performance Optimized**: < 5% overhead through throttling and selective monitoring
- **Popup Blocking**: Comprehensive blocking of Google sign-in, notifications, etc.
- **Strategic Screenshots**: Captures key moments, not continuous recording
- **Lightweight DOM Monitoring**: Structure-only capture, not full content
- **Network Metadata**: Request/response metadata only, not full bodies
- **Error-Only Logging**: Console errors only, not all logs
- **Diff-Based Updates**: Minimizes data transfer through intelligent diffing

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   UI (Renderer)     │────▶│  WebContentsTab      │────▶│  WebContentsView    │
│                     │     │  Manager             │     │                     │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                       │                            │
                                       ▼                            │
                            ┌──────────────────────┐                │
                            │ Enhanced Recording   │                │
                            │ Controller           │                │
                            └──────────────────────┘                │
                                       │                            │
                                       ▼                            ▼
                            ┌──────────────────────┐     ┌─────────────────────┐
                            │ Playwright Browser   │◀────│ CDP (Port 9335)     │
                            │                      │     │                     │
                            └──────────────────────┘     └─────────────────────┘
```

## Usage

### From Renderer Process (UI)

```javascript
// Start enhanced recording
const result = await window.electronAPI.invoke('enhanced-recording:start', 'https://example.com');
if (result.success) {
  console.log('Recording started:', result.sessionId);
} else {
  console.error('Failed to start recording:', result.error);
}

// Check status
const status = await window.electronAPI.invoke('enhanced-recording:status');
console.log('Recording status:', status);

// Get performance stats
const stats = await window.electronAPI.invoke('enhanced-recording:performance-stats');
console.log('Performance stats:', stats);

// Stop recording
const stopResult = await window.electronAPI.invoke('enhanced-recording:stop');
if (stopResult.success) {
  console.log('Recording data:', stopResult.recordingData);
} else {
  console.error('Failed to stop recording:', stopResult.error);
}
```

### From Main Process (Direct API)

```typescript
import { getTabManager } from './main';

const tabManager = getTabManager();
if (tabManager) {
  // Start enhanced recording
  const result = await tabManager.startEnhancedRecording('https://example.com');
  if (result.success) {
    console.log('Recording started:', result.sessionId);
    
    // Later, stop recording
    const stopResult = await tabManager.stopEnhancedRecording();
    console.log('Recording data:', stopResult.recordingData);
  }
}
```

## Data Structure

### Recording Metadata
```typescript
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
```

### DOM Snapshot (Lightweight)
```typescript
interface DOMSnapshot {
  timestamp: number;
  visibleElements: DOMElement[];      // Max 100 elements for performance
  interactableElements: DOMElement[]; // Buttons, links, inputs only
  pageUrl: string;
  title: string;
  viewport: { width: number; height: number };
}
```

### Network Request (Metadata Only)
```typescript
interface NetworkRequest {
  url: string;
  method: string;
  statusCode?: number;
  timestamp: number;
  responseSize?: number;  // Size only, not content
  timing?: { start: number; end: number };
}
```

## Performance Optimizations

### Throttling Settings
- **DOM Snapshots**: 1 second throttle
- **Screenshots**: 5 seconds throttle  
- **Network Requests**: Max 200 tracked
- **Console Errors**: Max 50 tracked
- **DOM Elements**: Max 100 per snapshot

### Data Limits
- **Screenshot Quality**: 80% (balanced quality/performance)
- **Text Content**: Max 100 characters per element
- **DOM Selector Complexity**: Simplified selectors only
- **Memory Management**: Auto-cleanup of old data

### Monitoring Strategy
- **Structure Only**: No full content capture for DOM
- **Errors Only**: Console errors, not all log levels
- **Metadata Only**: Network request headers/timing, not bodies
- **Strategic Screenshots**: Key moments, not continuous

## Integration Points

### WebContentsTabManager Integration
The controller is integrated into WebContentsTabManager with:
- Automatic CDP connection management
- Tab lifecycle management
- Event forwarding to UI
- Resource cleanup on tab close

### Popup Blocking
Comprehensive blocking includes:
- `window.open()` calls
- OAuth redirects (Google, Microsoft)
- Notification API requests
- Geolocation API requests
- Camera/microphone requests
- beforeunload dialogs

### Error Handling
- Graceful degradation if CDP connection fails
- Automatic reconnection attempts
- Safe resource cleanup on errors
- Performance monitoring and alerting

## Files Created/Modified

1. **`main/enhanced-recording-controller.ts`** - New controller implementation
2. **`main/WebContentsTabManager.ts`** - Integration points added:
   - Import and initialization
   - IPC handlers for enhanced recording
   - Event forwarding
   - Resource cleanup

## Performance Monitoring

The controller provides real-time performance statistics:
- Recording duration
- Screenshot capture rate
- DOM mutation frequency
- Network request volume
- Memory usage trends

Use `enhanced-recording:performance-stats` IPC call to monitor overhead and ensure < 5% target is maintained.

## CDP Connection Details

- **Port**: 9335 (configured in main.ts)
- **Protocol**: Chrome DevTools Protocol
- **Connection**: Via Playwright `connectOverCDP()`
- **Scope**: WebContentsView instances only (filters out Electron UI)
- **Lifecycle**: Automatic connection/disconnection with recording sessions

## Future Enhancements

- Real-time performance alerting
- Configurable throttling settings
- Custom data capture filters
- Recording compression
- Cloud storage integration
- AI-powered action detection