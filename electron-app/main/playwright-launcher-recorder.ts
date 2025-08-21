import { BrowserWindow, ipcMain } from 'electron';
import { spawn, ChildProcess, exec } from 'child_process';
import * as path from 'path';
import { promises as fs } from 'fs';
import { existsSync, writeFileSync } from 'fs';
import * as chokidar from 'chokidar';

/**
 * Playwright Launcher Recorder
 * Launches Playwright codegen and watches for saved recordings
 * User controls recording entirely through Playwright's interface
 */
export class PlaywrightLauncherRecorder {
  private electronWindow: BrowserWindow;
  private codegenProcess: ChildProcess | null = null;
  private recordingsDir = path.join(process.cwd(), 'recordings');
  private fileWatcher: chokidar.FSWatcher | null = null;
  private currentOutputPath: string | null = null;
  private lastFileSize = 0;
  private lastModified = 0;
  private isRecordingActive = false;
  private lastRecordingData: any = null;
  private screenshotPath: string | null = null;
  private recordingStarted = false;

  constructor(electronWindow: BrowserWindow) {
    this.electronWindow = electronWindow;
    this.ensureRecordingsDirectory();
  }

  private async ensureRecordingsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create recordings directory:', error);
    }
  }

  /**
   * Find Playwright executable
   */
  private findPlaywrightExecutable(): string {
    return this.findPlaywrightPath() || 'playwright';
  }
  
  /**
   * Minimize Playwright Inspector window using Windows API
   */
  private minimizeInspectorWindow(): void {
    try {
      const { exec } = require('child_process');
      
      // Use PowerShell to find and minimize Playwright Inspector windows
      const powershellScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")]
            public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
            [DllImport("user32.dll")]
            public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder strText, int maxCount);
            [DllImport("user32.dll")]
            public static extern int GetWindowTextLength(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool IsWindowVisible(IntPtr hWnd);
            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
          }
"@
        
        $SW_MINIMIZE = 6
        
        # Function to minimize window if title contains "Playwright"
        $callback = {
          param($hWnd, $lParam)
          if ([Win32]::IsWindowVisible($hWnd)) {
            $length = [Win32]::GetWindowTextLength($hWnd)
            if ($length -gt 0) {
              $builder = New-Object System.Text.StringBuilder($length + 1)
              [Win32]::GetWindowText($hWnd, $builder, $builder.Capacity) | Out-Null
              $windowTitle = $builder.ToString()
              if ($windowTitle -match "Playwright|Inspector") {
                Write-Host "Minimizing window: $windowTitle"
                [Win32]::ShowWindow($hWnd, $SW_MINIMIZE) | Out-Null
              }
            }
          }
          return $true
        }
        
        [Win32]::EnumWindows($callback, [IntPtr]::Zero)
      `;
      
      exec(`powershell -Command "${powershellScript}"`, (error, stdout, stderr) => {
        if (error) {
          console.log('Note: Could not minimize inspector window automatically:', error.message);
        } else {
          console.log('✅ Inspector window minimized');
        }
      });
      
    } catch (error) {
      console.log('Note: Inspector window minimization not available on this platform');
    }
  }

  /**
   * Find Playwright executable
   */
  private findPlaywrightPath(): string | null {
    const possiblePaths = [
      // Local node_modules
      path.join(process.cwd(), 'node_modules', '.bin', 'playwright.cmd'),
      path.join(process.cwd(), 'node_modules', '.bin', 'playwright'),
      // Electron app node_modules
      path.join(__dirname, '..', '..', 'node_modules', '.bin', 'playwright.cmd'),
      path.join(__dirname, '..', '..', 'node_modules', '.bin', 'playwright'),
      // Global installation
      'playwright'
    ];

    for (const playwrightPath of possiblePaths) {
      if (playwrightPath === 'playwright') {
        // Check if globally available
        try {
          const { execSync } = require('child_process');
          execSync('playwright --version', { stdio: 'ignore' });
          return 'playwright';
        } catch {
          continue;
        }
      } else if (existsSync(playwrightPath)) {
        return playwrightPath;
      }
    }

    // Try npx as fallback
    try {
      const { execSync } = require('child_process');
      execSync('npx playwright --version', { stdio: 'ignore' });
      return 'npx playwright';
    } catch {
      // npx not available or playwright not installed
    }

    return null;
  }

  /**
   * Launch Playwright recorder
   * User controls everything through Playwright's interface
   */
  public async launchRecorder(startUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find playwright executable
      const playwrightPath = this.findPlaywrightPath();
      if (!playwrightPath) {
        return { 
          success: false, 
          error: 'Playwright not found. Please install Playwright: npm install -D @playwright/test' 
        };
      }
      
      // Set recording flag
      this.isRecordingActive = true;

      // Generate output file path
      const sessionId = `recording-${Date.now()}`;
      this.currentOutputPath = path.join(this.recordingsDir, `${sessionId}.spec.ts`);
      
      // Build codegen command - back to working version
      const args = [
        'codegen',
        '--target=playwright-test',
        `--output=${this.currentOutputPath}`,
        '--browser=chromium'
      ];
      
      // Add URL if provided
      if (startUrl) {
        args.push(startUrl);
      }

      console.log('Launching Playwright recorder...');
      console.log('Playwright path:', playwrightPath);
      console.log('Arguments:', args);
      console.log('Output will be saved to:', this.currentOutputPath);
      console.log('📌 NOTE: If Chrome shows promotional popup, click "Not interested" to proceed');
      console.log('💡 TIP: Inspector window will be minimized automatically for a cleaner experience.');
      
      // Create environment - keep inspector enabled for full functionality
      const env = { 
        ...process.env
        // Note: We need the inspector window for saving recordings - will minimize it programmatically
        // PW_CODEGEN_NO_INSPECTOR: 'true'  // Commented out - we want the inspector
      };
      
      // Launch playwright codegen with environment variable
      if (playwrightPath === 'playwright' || playwrightPath.includes('npx')) {
        const [cmd, ...cmdArgs] = playwrightPath.split(' ');
        this.codegenProcess = spawn(cmd, [...cmdArgs, ...args], {
          stdio: 'pipe',
          shell: true,
          env
        });
      } else {
        this.codegenProcess = spawn(playwrightPath, args, {
          stdio: 'pipe',
          shell: process.platform === 'win32',
          env
        });
      }
      
      // Handle process output silently
      this.codegenProcess.stdout?.on('data', (data) => {
        console.log('Codegen output:', data.toString());
      });
      
      this.codegenProcess.stderr?.on('data', (data) => {
        console.error('Codegen error:', data.toString());
      });
      
      // Watch for file changes
      this.startFileWatcher();

      // Minimize inspector window after a short delay (Windows only)
      if (process.platform === 'win32') {
        setTimeout(() => {
          this.minimizeInspectorWindow();
        }, 3000); // Wait 3 seconds for windows to fully open
      }

      // Handle process exit
      this.codegenProcess.on('exit', (code, signal) => {
        console.log(`Playwright recorder exited with code ${code}, signal ${signal}`);
        if (code === 1) {
          console.error('Playwright exited with error code 1. Common causes:');
          console.error('- Chromium browser not installed (run: npx playwright install chromium)');
          console.error('- Invalid arguments or configuration');
        }
        this.handleRecorderClosed();
      });

      this.codegenProcess.on('error', (error) => {
        console.error('Failed to launch Playwright recorder:', error);
        console.error('Error details:', error.message);
        if (error.message.includes('ENOENT')) {
          console.error('Playwright executable not found. Try running: npm install playwright');
        }
        this.cleanup();
      });

      // Notify UI
      this.electronWindow.webContents.send('recorder-launched', { 
        sessionId,
        outputPath: this.currentOutputPath,
        instructions: 'Use Playwright Inspector to record your actions. Save or close when done.'
      });

      return { success: true };

    } catch (error) {
      console.error('Failed to launch recorder:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Start watching for file changes using chokidar
   */
  private startFileWatcher(): void {
    if (!this.currentOutputPath) return;

    console.log('Starting file watcher for:', this.currentOutputPath);

    // Use chokidar for more reliable file watching
    this.fileWatcher = chokidar.watch(this.currentOutputPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    this.fileWatcher
      .on('add', (path) => {
        console.log('Recording file created:', path);
        this.handleFileCreated(path);
      })
      .on('change', (path) => {
        console.log('Recording file changed:', path);
        this.handleFileChanged(path);
      })
      .on('error', (error) => {
        console.error('File watcher error:', error);
      });

    // Also start polling as backup
    this.startPollingForChanges();
  }

  /**
   * Poll for file changes as backup to file watching
   */
  private startPollingForChanges(): void {
    const pollInterval = setInterval(async () => {
      if (!this.currentOutputPath || !this.isRecordingActive) {
        clearInterval(pollInterval);
        return;
      }

      try {
        if (existsSync(this.currentOutputPath)) {
          const stats = await fs.stat(this.currentOutputPath);
          const currentSize = stats.size;
          const currentModified = stats.mtime.getTime();

          if (currentSize !== this.lastFileSize || currentModified !== this.lastModified) {
            this.lastFileSize = currentSize;
            this.lastModified = currentModified;

            if (currentSize > 0) {
              await this.processFileChange(this.currentOutputPath, stats);
            }
          }
        }
      } catch (error) {
        // File might not exist yet
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Handle file creation
   */
  private async handleFileCreated(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > 0) {
        // Recording has started - capture screenshot and show Begin Analysis
        if (!this.recordingStarted) {
          this.recordingStarted = true;
          console.log('Recording started - capturing initial screenshot...');
          
          // Capture screenshot using system tools
          const sessionId = path.basename(filePath, '.spec.ts');
          await this.capturePlaywrightScreenshot(sessionId);
          
          // Notify UI to show Begin Analysis button immediately (but disabled)
          this.electronWindow.webContents.send('recording-started', {
            path: filePath,
            sessionId,
            screenshotPath: this.screenshotPath,
            buttonEnabled: false // Button should be disabled initially
          });
        }
        
        await this.processFileChange(filePath, stats);
      }
    } catch (error) {
      console.error('Error handling file creation:', error);
    }
  }

  /**
   * Handle file changes
   */
  private async handleFileChanged(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      await this.processFileChange(filePath, stats);
    } catch (error) {
      console.error('Error handling file change:', error);
    }
  }

  /**
   * Process file changes and notify UI
   */
  private async processFileChange(filePath: string, stats: any): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Count Playwright actions to gauge recording progress
      const actionCount = this.countPlaywrightActions(content);
      
      // Check if recording has been stopped (test is complete)
      const isRecordingStopped = this.isRecordingComplete(content);
      
      console.log(`Recording updated: ${actionCount} actions recorded${isRecordingStopped ? ' (RECORDING STOPPED)' : ''}`);
      
      // If recording just stopped via file change (not button), we can't capture screenshot
      // because browser might already be closing
      let screenshotPath: string | undefined;
      if (isRecordingStopped && !this.lastRecordingData?.recordingStopped) {
        console.log('Recording stopped detected via file change - browser may be closing');
        // Don't attempt screenshot - browser likely gone
      }
      
      // Store recording data
      this.lastRecordingData = {
        path: filePath,
        size: stats.size,
        actionCount,
        timestamp: Date.now(),
        specCode: content,
        content: content,  // Store the actual content for later use
        recordingStopped: isRecordingStopped,
        screenshotPath
      };
      
      // Notify UI that recording was saved/updated
      this.electronWindow.webContents.send('recording-saved', this.lastRecordingData);
    } catch (error) {
      console.error('Error processing file change:', error);
    }
  }
  
  /**
   * Check if the recording is complete (test closure detected)
   */
  private isRecordingComplete(content: string): boolean {
    // When user clicks stop in the floating toolbar, Playwright writes the complete test
    // A complete test has the structure: test('...', async ({ page }) => { ... });
    
    // Check if we have both opening and closing brackets for the test
    const hasTestOpening = content.includes("test('") || content.includes('test("');
    const hasAsyncFunction = content.includes('async ({ page })') || content.includes('async ({page})');
    const hasClosingBrackets = content.trim().endsWith('});');
    
    // Also check if the last action is followed by the closing brackets
    // (no more actions will be added after the stop button is clicked)
    const lines = content.trim().split('\n');
    const lastFewLines = lines.slice(-3).join('\n');
    const hasProperClosure = lastFewLines.includes('});');
    
    return hasTestOpening && hasAsyncFunction && (hasClosingBrackets || hasProperClosure);
  }
  
  /**
   * Capture screenshot of current browser state
   */
  private async captureSuccessScreenshot(recordingPath: string): Promise<string | undefined> {
    console.log('[Screenshot] Starting capture for recording:', recordingPath);
    
    try {
      const sessionId = path.basename(recordingPath, '.spec.ts');
      const screenshotPath = path.join(this.recordingsDir, `${sessionId}-success.png`);
      console.log('[Screenshot] Target path:', screenshotPath);
      
      // Get the active tab manager to capture screenshot
      console.log('[Screenshot] Importing tab manager...');
      const { getTabManager } = await import('./main');
      const tabManager = getTabManager();
      console.log('[Screenshot] Tab manager obtained:', !!tabManager);
      
      if (tabManager) {
        const activeTab = tabManager.getActiveTab();
        console.log('[Screenshot] Active tab found:', !!activeTab);
        console.log('[Screenshot] Active tab has view:', !!activeTab?.view);
        
        if (activeTab?.view) {
          console.log('[Screenshot] WebContents available:', !!activeTab.view.webContents);
          
          // Check if webContents is destroyed
          if (activeTab.view.webContents.isDestroyed()) {
            console.log('[Screenshot] ERROR: WebContents is destroyed!');
            return undefined;
          }
          
          // Get the URL being recorded
          const currentUrl = activeTab.view.webContents.getURL();
          console.log('[Screenshot] Current URL:', currentUrl);
          
          console.log('[Screenshot] Capturing page...');
          const screenshot = await activeTab.view.webContents.capturePage();
          console.log('[Screenshot] Screenshot captured, size:', screenshot ? screenshot.getSize() : 'null');
          
          console.log('[Screenshot] Converting to PNG...');
          const pngBuffer = screenshot.toPNG();
          console.log('[Screenshot] PNG buffer size:', pngBuffer.length);
          
          console.log('[Screenshot] Writing to file...');
          await fs.writeFile(screenshotPath, pngBuffer);
          console.log('[Screenshot] Success! Screenshot saved:', screenshotPath);
          
          // Verify file was written
          const stats = await fs.stat(screenshotPath);
          console.log('[Screenshot] File verified, size:', stats.size, 'bytes');
          
          return screenshotPath;
        } else {
          console.log('[Screenshot] No active tab with view available');
          
          // Try alternative: look for Playwright browser window
          console.log('[Screenshot] Attempting to find Playwright browser window...');
          const { BrowserWindow } = await import('electron');
          const allWindows = BrowserWindow.getAllWindows();
          console.log('[Screenshot] Total windows:', allWindows.length);
          
          for (const win of allWindows) {
            const title = win.getTitle();
            const url = win.webContents.getURL();
            console.log(`[Screenshot] Window: ${title}, URL: ${url}`);
            
            // Check if this might be the Playwright browser
            if (!url.includes('localhost:') && !url.includes('file://')) {
              console.log('[Screenshot] Found potential browser window, attempting capture...');
              try {
                const screenshot = await win.webContents.capturePage();
                await fs.writeFile(screenshotPath, screenshot.toPNG());
                console.log('[Screenshot] Alternative capture successful!');
                return screenshotPath;
              } catch (altError) {
                console.log('[Screenshot] Alternative capture failed:', altError);
              }
            }
          }
        }
      } else {
        console.log('[Screenshot] No tab manager available');
      }
    } catch (error) {
      console.error('[Screenshot] Failed to capture:', error);
      console.error('[Screenshot] Error stack:', (error as Error).stack);
    }
    return undefined;
  }

  /**
   * Count Playwright actions in the spec code
   */
  private countPlaywrightActions(content: string): number {
    const actionPatterns = [
      /await page\.click\(/g,
      /await page\.fill\(/g,
      /await page\.type\(/g,
      /await page\.goto\(/g,
      /await page\.press\(/g,
      /await page\.selectOption\(/g,
      /await page\.getByRole\(/g,
      /await page\.getByLabel\(/g,
      /await page\.getByText\(/g,
      /await page\.getByTestId\(/g,
      /await page\.locator\(/g
    ];

    return actionPatterns.reduce((count, pattern) => {
      return count + (content.match(pattern) || []).length;
    }, 0);
  }

  /**
   * Capture screenshot of Playwright browser window
   */
  private async capturePlaywrightScreenshot(sessionId: string): Promise<void> {
    try {
      this.screenshotPath = path.join(this.recordingsDir, `${sessionId}-success.png`);
      console.log('[Screenshot] Attempting to capture Playwright browser window...');
      
      // Use Electron's desktopCapturer to find and capture the Playwright window
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({ 
        types: ['window'],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      
      // Find Playwright browser window
      const playwrightWindow = sources.find(source => 
        source.name.toLowerCase().includes('chromium') ||
        source.name.toLowerCase().includes('playwright') ||
        source.name.toLowerCase().includes('chrome')
      );
      
      if (playwrightWindow) {
        // Save the screenshot
        await fs.writeFile(this.screenshotPath, playwrightWindow.thumbnail.toPNG());
        console.log('[Screenshot] Captured Playwright window:', this.screenshotPath);
      } else {
        console.log('[Screenshot] Could not find Playwright browser window');
      }
    } catch (error) {
      console.error('[Screenshot] Failed to capture:', error);
    }
  }

  /**
   * Handle recorder closed
   */
  private async handleRecorderClosed(): Promise<void> {
    // Send event to enable the Begin Analysis button now that browser is closed
    if (this.recordingStarted) {
      this.electronWindow.webContents.send('browser-closed', {
        buttonEnabled: true // Enable the button now
      });
    }
    
    if (!this.currentOutputPath) {
      this.cleanup();
      // Notify UI that recorder exited without recording
      this.electronWindow.webContents.send('recorder-exit', { hasRecording: false });
      return;
    }

    try {
      console.log('Checking for recording file (browser closed without stop button):', this.currentOutputPath);
      
      // Wait longer for file to be written by Playwright
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Capture screenshot of final state for validation
      let screenshotPath: string | undefined;
      try {
        const sessionId = path.basename(this.currentOutputPath, '.spec.ts');
        screenshotPath = path.join(this.recordingsDir, `${sessionId}-success.png`);
        
        // Get the active tab manager to capture screenshot
        const { getTabManager } = await import('./main');
        const tabManager = getTabManager();
        
        if (tabManager) {
          const activeTab = tabManager.getActiveTab();
          if (activeTab?.view) {
            console.log('Capturing success state screenshot...');
            const screenshot = await activeTab.view.webContents.capturePage();
            await fs.writeFile(screenshotPath, screenshot.toPNG());
            console.log('Success screenshot saved:', screenshotPath);
          }
        }
      } catch (screenshotError) {
        console.error('Failed to capture success screenshot:', screenshotError);
        screenshotPath = undefined;
      }
      
      // First check if the exact file was created
      let recordingFilePath = this.currentOutputPath;
      let fileExists = existsSync(recordingFilePath);
      
      // If the exact file doesn't exist, Playwright may have failed to save
      // In this case, use the last recording data if available
      if (!fileExists && this.lastRecordingData) {
        console.log('Exact file not found, but we have recording data from file watcher');
        // Create the file with the data we captured
        try {
          await fs.writeFile(recordingFilePath, this.lastRecordingData.content);
          fileExists = true;
          console.log('Created recording file from captured data:', recordingFilePath);
        } catch (error) {
          console.error('Failed to create recording file:', error);
        }
      }
      
      // Check if file was created
      if (fileExists) {
        console.log('Recording file found:', recordingFilePath);
        const stats = await fs.stat(recordingFilePath);
        
        if (stats.size > 0) {
          // Read the final recording
          const specCode = await fs.readFile(recordingFilePath, 'utf8');
          
          // Store last recording data for retrieval
          this.lastRecordingData = {
            path: recordingFilePath,
            specCode,
            sessionId: path.basename(recordingFilePath, '.spec.ts'),
            timestamp: Date.now()
          };
          
          // Notify UI with the complete recording
          this.electronWindow.webContents.send('recording-complete', {
            path: recordingFilePath,
            specCode,
            sessionId: path.basename(recordingFilePath, '.spec.ts')
          });
          
          // Also send recorder exit with recording flag
          this.electronWindow.webContents.send('recorder-exit', { hasRecording: true });
          
          console.log('Recording saved successfully:', this.currentOutputPath);
        } else {
          console.log('Recording file is empty, user may have cancelled');
          this.electronWindow.webContents.send('recording-cancelled', {
            reason: 'Empty recording file'
          });
          this.electronWindow.webContents.send('recorder-exit', { hasRecording: false });
        }
      } else {
        console.log('No recording file created, user cancelled');
        this.electronWindow.webContents.send('recording-cancelled', {
          reason: 'No recording file created'
        });
        this.electronWindow.webContents.send('recorder-exit', { hasRecording: false });
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      this.electronWindow.webContents.send('recorder-exit', { hasRecording: false });
    } finally {
      this.cleanup();
    }
  }

  /**
   * Import an existing recording file
   */
  public async importRecording(filePath: string): Promise<{ 
    success: boolean; 
    specCode?: string; 
    error?: string 
  }> {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const specCode = await fs.readFile(filePath, 'utf8');
      
      // Copy to recordings directory with timestamp
      const sessionId = `imported-${Date.now()}`;
      const newPath = path.join(this.recordingsDir, `${sessionId}.spec.ts`);
      await fs.writeFile(newPath, specCode, 'utf8');

      return { success: true, specCode };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import recording' 
      };
    }
  }

  /**
   * Get recording status
   */
  public isRecording(): boolean {
    return this.codegenProcess !== null && !this.codegenProcess.killed;
  }
  
  /**
   * Get last recording data
   */
  public getLastRecording(): any {
    return this.lastRecordingData;
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    
    if (this.codegenProcess && !this.codegenProcess.killed) {
      this.codegenProcess.kill();
    }
    
    this.codegenProcess = null;
    this.currentOutputPath = null;
    this.isRecordingActive = false;
    this.recordingStarted = false;
    this.screenshotPath = null;
  }

  /**
   * Dispose
   */
  public async dispose(): Promise<void> {
    this.cleanup();
  }
}