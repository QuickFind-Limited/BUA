# Electron WebView2 Multi-Tab Browser

A Windows Electron desktop app with Edge WebView2 integration for multi-tab browsing, Playwright recording, and Claude AI integration.

## Features

- ✅ **Edge WebView2** multi-tab browsing
- ✅ **Playwright recorder** for flow recording
- ✅ **Claude Opus 4.1** for Intent Spec analysis
- ✅ **Claude Sonnet 4** for Magnitude act operations
- ✅ **Variables Preview Panel** for flow configuration
- ✅ **Hybrid AI model setup** (Opus for analysis/query, Sonnet for act)
- ✅ **Windows packaging** (NSIS installer or portable ZIP)

## Prerequisites

- Windows 10/11 (WebView2 is Windows-only)
- Node.js 18+ and npm
- Microsoft Edge WebView2 Runtime (usually pre-installed on Windows)
- Anthropic API key for Claude features

## Setup

1. **Clone and navigate to the project:**
```bash
cd electron-app
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set your Anthropic API key:**
```bash
# Windows Command Prompt
set ANTHROPIC_API_KEY=your-api-key-here

# Windows PowerShell
$env:ANTHROPIC_API_KEY="your-api-key-here"
```

4. **Build the TypeScript:**
```bash
npm run build
```

## Running the App

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Packaging for Windows

### Create NSIS Installer (per-user, no admin required):
```bash
npm run dist:win
```
Output: `dist-electron/[AppName]-Setup-[version].exe`

### Create Portable EXE (no installation):
```bash
npm run dist:portable
```
Output: `dist-electron/[AppName]-Portable-[version].exe`

### Create both:
```bash
npm run dist
```

## Architecture

### Model Usage (per spec section 3)
- **Claude Opus 4.1** (`claude-opus-4-1-20250805`):
  - Recording → Intent Spec analysis
  - Decision boundary (act vs snippet)
  - Magnitude query operations
  - All prompt building
  
- **Claude Sonnet 4** (`claude-sonnet-4-20250514`):
  - Magnitude act operations only

### IPC Channels (per spec section 4)
- `llm:analyzeRecording(recording)` → Intent Spec (Opus 4.1)
- `llm:decide(signals)` → act/snippet decision (Opus 4.1)
- `flows:runOne({spec, vars, prompt})` → Magnitude hybrid flow

### WebView2 Integration (per spec section 5)
- Each tab is a separate WebView2 instance
- `TabManager.ts` handles multi-tab management
- `NewWindowRequested` events spawn new tabs
- Tab bar and address bar in main UI

## Project Structure

```
electron-app/
├─ main/
│  ├─ main.ts         # Electron app with WebView2 setup
│  ├─ llm.ts          # Claude Code SDK integration
│  └─ ipc.ts          # IPC endpoints
├─ shell/
│  ├─ TabManager.ts   # WebView2 multi-tab manager
│  └─ webview2-bridge.js # WebView2 renderer bridge
├─ ui/
│  ├─ tabbar.html     # Main UI with tabs
│  └─ vars-panel.html # Variables preview panel
├─ flows/             # Magnitude integration
├─ intents/           # Intent Spec examples
└─ tests/             # Playwright tests
```

## Testing

Run the multi-tab Playwright test:
```bash
npm test
```

## Security Features

- API key stored in main process only
- Context isolation enabled
- Node integration disabled
- Secure IPC communication via preload script
- CSP headers configured
- Variable redaction in logs

## Troubleshooting

### WebView2 not working
- Ensure Microsoft Edge WebView2 Runtime is installed
- Check Windows version (requires Windows 10+)
- Run app as non-admin user

### Claude features not working
- Verify ANTHROPIC_API_KEY is set
- Check API key has access to required models
- Review console logs for errors

### Build errors
- Clear TypeScript cache: `rm -rf dist/`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Ensure all TypeScript files compile: `npm run build`

## License

MIT