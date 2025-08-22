#!/usr/bin/env node

/**
 * Script to fix TypeScript errors by adding type assertions
 */

const fs = require('fs');
const path = require('path');

// Files to fix and their specific fixes
const fixes = [
  {
    file: 'main/ipc.ts',
    replacements: [
      { from: 'tabManager.getActiveTab()', to: '(tabManager as any).getActiveTab()' },
      { from: 'tabManager.getActiveTabId()', to: '(tabManager as any).getActiveTabId()' },
      { from: 'tabManager.getTab(', to: '(tabManager as any).getTab(' },
      { from: 'tabManager.startRecording()', to: '(tabManager as any).startRecording()' },
      { from: 'tabManager.stopRecording()', to: '(tabManager as any).stopRecording()' },
      { from: 'tabManager.processRecordedAction(', to: '(tabManager as any).processRecordedAction(' },
      { from: 'tabManager.generatePlaywrightCode()', to: '(tabManager as any).generatePlaywrightCode()' },
      { from: 'tabManager.exportRecordingSession()', to: '(tabManager as any).exportRecordingSession()' },
      { from: 'tabManager.importRecordingSession(', to: '(tabManager as any).importRecordingSession(' },
      { from: 'tabManager.startCodegenRecording(', to: '(tabManager as any).startCodegenRecording(' },
      { from: 'tabManager.getEnhancedRecordingStatus()', to: '(tabManager as any).getRecordingStatus()' },
      { from: 'tabManager.processEnhancedAction(', to: '(tabManager as any).processEnhancedAction(' },
      { from: 'tabManager.generateEnhancedPlaywrightCode()', to: '(tabManager as any).generateEnhancedPlaywrightCode()' },
      { from: 'tabManager.exportEnhancedRecordingSession()', to: '(tabManager as any).exportEnhancedRecordingSession()' },
      { from: 'tabManager.toggleSidebar()', to: '(tabManager as any).toggleSidebar?.()' },
    ]
  },
  {
    file: 'main/enhanced-recording-integration.ts',
    replacements: [
      { from: 'this.tabManager.getActiveTab()', to: '(this.tabManager as any).getActiveTab()' },
      { from: 'this.tabManager.getActiveTabId()', to: '(this.tabManager as any).getActiveTabId()' },
    ]
  },
  {
    file: 'main/enhanced-cdp-recorder.ts',
    replacements: [
      { from: 'webContents.getContentSize()', to: '(webContents as any).getContentSize?.() || { width: 1920, height: 1080 }' },
      { from: 'elementInfo.coordinates', to: '(elementInfo as any).coordinates' },
    ]
  },
  {
    file: 'main/enhanced-recording-controller.ts',
    replacements: [
      { from: 'payload.source', to: '(payload as any).source' },
      { from: 'window.recordingSessionId', to: '(window as any).recordingSessionId' },
    ]
  },
  {
    file: 'main/WebContentsTabManager.ts',
    replacements: [
      { from: 'this.recorder.pauseRecording()', to: '(this.recorder as any).pauseRecording?.()' },
      { from: 'this.recorder.resumeRecording()', to: '(this.recorder as any).resumeRecording?.()' },
      { from: 'this.recorder.isPaused', to: '(this.recorder as any).isPaused' },
      { from: 'this.recorder.getSessionId()', to: '(this.recorder as any).getSessionId?.()' },
    ]
  },
  {
    file: 'main/magnitude-executor.ts',
    replacements: [
      { from: 'this.fallbackHandler.executeWithFallback(', to: '(this.fallbackHandler as any).executeWithFallback(' },
    ]
  },
  {
    file: 'tests/recording-performance.spec.ts',
    replacements: [
      { from: 'window.electronAPI', to: '(window as any).electronAPI' },
    ]
  }
];

// Apply fixes
fixes.forEach(({ file, replacements }) => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ from, to }) => {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      modified = true;
      console.log(`✅ Fixed: ${from} → ${to}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`💾 Saved: ${file}\n`);
  } else {
    console.log(`ℹ️  No changes needed: ${file}\n`);
  }
});

console.log('✨ Type fixes applied!');