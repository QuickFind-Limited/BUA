# CUA Electron App - Deployment & Development Guide

## Quick Start for Development on Another Machine

### Prerequisites
1. **Node.js** - Version 20.x or higher
2. **npm** - Version 10.x or higher (comes with Node.js)
3. **Git** - For cloning the repository
4. **Anthropic API Key** - Required for AI functionality

### Step 1: Clone the Repository
```bash
git clone https://github.com/QuickFind-Limited/cua-new.git
cd cua-new/electron-app
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Set Up Environment Variables
Create a `.env` file in the `electron-app` directory:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CDP_PORT=9335
```

### Step 4: Run in Development Mode
```bash
npm run dev
```

The app will start with hot-reload enabled for development.

## What Files Are Needed?

### Essential Files to Copy (if not using Git)
If you're copying files manually instead of cloning, you need:

```
electron-app/
├── main/                    # All TypeScript backend code
│   ├── *.ts                 # Main process files
│   ├── llm.ts              # AI integration (critical)
│   ├── main.ts             # Entry point
│   ├── ipc.ts              # IPC handlers
│   └── enhanced-*.ts       # Enhanced execution modules
├── ui/                      # Frontend files
│   ├── *.html              # HTML templates
│   ├── *.js                # JavaScript UI logic
│   ├── *.css               # Styling
│   └── styles-modern.css   # Modern UI styles
├── flows/                   # Flow definitions
├── package.json            # Dependencies & scripts
├── package-lock.json       # Locked dependency versions
├── tsconfig.json           # TypeScript configuration
├── playwright.config.ts    # Playwright configuration
├── preload.js              # Electron preload script
└── .env                    # Environment variables (create this)
```

### Dependencies Breakdown

#### Core Dependencies (from package.json)
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",      // AI integration
    "@playwright/test": "^1.49.1",       // Browser automation
    "dotenv": "^16.4.7",                 // Environment variables
    "electron-store": "^10.0.0",         // Settings storage
    "playwright": "^1.49.1"              // Core automation
  },
  "devDependencies": {
    "@types/node": "^22.10.2",           // TypeScript types
    "electron": "^34.0.0",               // Electron framework
    "electron-builder": "^25.1.8",       // Build tool
    "nodemon": "^3.1.9",                 // Auto-restart
    "ts-node": "^10.9.2",                // TypeScript execution
    "typescript": "^5.7.2"               // TypeScript compiler
  }
}
```

## System Requirements

### Minimum Requirements
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for app + dependencies
- **Internet**: Required for AI features

### Network Requirements
- Port 9335 for Chrome DevTools Protocol (CDP)
- HTTPS access to api.anthropic.com
- Access to npm registry for dependencies

## Common Setup Issues & Solutions

### Issue 1: Missing Dependencies
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Issue 2: TypeScript Build Errors
```bash
# Rebuild TypeScript files
npm run build
```

### Issue 3: Playwright Not Working
```bash
# Install Playwright browsers
npx playwright install chromium
```

### Issue 4: Port 9335 Already in Use
Change the CDP_PORT in .env file to another port (e.g., 9336)

## Development Commands

```bash
# Start in development mode
npm run dev

# Build TypeScript files
npm run build

# Run tests
npm test

# Package for distribution
npm run dist

# Clean build artifacts
npm run clean
```

## Project Structure Overview

```
Main Process (Backend):
- main.ts: Application entry point
- ipc.ts: Inter-process communication handlers
- llm.ts: AI model integration (Opus & Sonnet)
- enhanced-flow-executor.ts: Flow execution orchestration
- enhanced-magnitude-controller.ts: Intelligent automation control
- preflight-analyzer.ts: Pre-execution analysis
- error-analyzer.ts: Error recovery system
- playwright-launcher-recorder.ts: Recording functionality

Renderer Process (Frontend):
- tabbar.html/js: Main UI with sidebar
- vars-panel.js: Flow variables management
- styles-modern.css: Modern UI styling
- sidebar-manager.js: Sidebar state management
```

## Key Features Configuration

### Dual-Model AI Architecture
- **Analysis**: Claude Opus 4.1 (complex analysis)
- **Runtime**: Claude Sonnet 4 (quick actions)
- Configure in `llm.ts`

### Pre-Flight Analysis
- Automatic skip detection
- Smart execution strategies
- Configure in `preflight-analyzer.ts`

### Enhanced Error Recovery
- Automatic retry mechanisms
- Alternative selector detection
- Configure in `error-analyzer.ts`

## Deployment Checklist

- [ ] Clone repository or copy all essential files
- [ ] Run `npm install` to install dependencies
- [ ] Create `.env` file with ANTHROPIC_API_KEY
- [ ] Run `npm run build` to compile TypeScript
- [ ] Test with `npm run dev`
- [ ] Verify Playwright recorder works
- [ ] Test automation execution
- [ ] Check AI integration works

## Support & Troubleshooting

### Logs Location
- Console output in terminal
- DevTools console (Ctrl+Shift+I in app)

### Debug Mode
Set in main.ts:
```typescript
const DEBUG = true; // Enable verbose logging
```

### Common Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-...
CDP_PORT=9335
NODE_ENV=development
DEBUG=true
```

## Building for Production

```bash
# Windows
npm run dist:win

# macOS
npm run dist:mac

# Linux
npm run dist:linux
```

Built applications will be in `dist/` directory.

## License & Support
For issues, check the repository: https://github.com/QuickFind-Limited/cua-new