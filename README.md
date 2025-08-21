# CUA Enhanced Recording - Electron Browser Automation Platform

A powerful Electron-based browser automation platform with comprehensive CDP recording capabilities for AI-driven test generation.

## Features

### 🎯 Core Capabilities
- **Comprehensive Recording**: Captures ALL user interactions, DOM mutations, network activity, and visual states
- **CDP Integration**: Uses Chrome DevTools Protocol for deep browser integration
- **AI-Ready Data**: Generates rich data for Claude to create intelligent Playwright scripts
- **Multi-Strategy Selectors**: 8+ selector strategies per element for resilient automation
- **Visual Validation**: Screenshot capture and comparison for test validation

### 📊 Data Capture (Comprehensive Mode)
- **User Actions**: All events (clicks, keyboard, mouse, scroll) with full context
- **DOM Monitoring**: Structure snapshots every 500ms with visibility and style information
- **Network Tracking**: All requests, responses, timing, and failures
- **Console Logging**: All levels (log, warn, error, info) with stack traces
- **Visual Proof**: Screenshots every 2 seconds
- **Performance Metrics**: Memory usage, timing, resource loading

### 🚀 Performance
With high-spec machines (8GB+ RAM):
- CPU Usage: 5-10%
- Memory: 200-500MB
- Data Rate: 10-20MB per minute
- Capture Frequency: DOM every 500ms, Screenshots every 2s

## Installation

```bash
cd electron-app
npm install
```

## Usage

### Start the Application
```bash
npm run electron
# or
npx electron .
```

### Recording
1. Click the **Record** button in the navigation bar
2. Perform your actions in the browser
3. Click **Stop** to end recording
4. Recording data is saved as `recording-{timestamp}.json`

### Navigation
- Use the address bar to navigate (supports URLs and search queries)
- Click **+** to create new tabs
- Use back/forward buttons for navigation

## Architecture

### Main Components
- `main-comprehensive.js`: Main process with CDP recording
- `ui/tabbar.html`: Browser UI with tab management
- `enhanced-recording-controller.ts`: CDP recording logic
- `recording-toolbar-injector.ts`: In-page recording UI

### Recording Data Structure
```javascript
{
  sessionId: string,
  duration: number,
  actions: [], // All user interactions
  domSnapshots: [], // DOM structure every 500ms
  mutations: [], // All DOM changes
  network: {}, // All network activity
  console: {}, // All console output
  screenshots: [], // Visual captures
  performance: [], // Performance metrics
  stats: {} // Summary statistics
}
```

## Development

### Project Structure
```
cua-clean-final-20250821_124832/
├── electron-app/
│   ├── main-comprehensive.js  # Main process
│   ├── main-integrated.js     # Standard recording
│   ├── main-test.js          # Test version
│   ├── preload.js            # Preload script
│   ├── ui/                   # UI components
│   │   ├── tabbar.html
│   │   ├── tabbar.js
│   │   └── styles.css
│   └── main/                 # TypeScript sources
│       ├── enhanced-recording-controller.ts
│       └── WebContentsTabManager.ts
└── README.md
```

### Recording Modes
1. **Standard**: Basic capture (main-integrated.js)
   - Minimal overhead (< 5%)
   - Essential data only

2. **Comprehensive**: Full capture (main-comprehensive.js)
   - All events and mutations
   - Aggressive data collection
   - Best for AI script generation

## System Requirements

### Minimum
- RAM: 4GB
- CPU: Dual-core
- OS: Windows 10+, macOS 10.14+, Ubuntu 18.04+

### Recommended (for Comprehensive Mode)
- RAM: 8GB+
- CPU: Quad-core
- SSD storage for recording data

## AI Integration

The captured data is optimized for Claude AI to generate:
- Robust Playwright test scripts
- Self-healing selectors
- Intelligent wait strategies
- Visual validation checks
- Error recovery logic

## License

MIT

## Contributing

Contributions welcome! Please submit issues and pull requests.

---

Built with Electron, Playwright, and Claude AI integration for next-generation browser automation.