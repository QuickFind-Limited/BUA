import { EventEmitter } from 'events';
import { BrowserWindow, WebContentsView, ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { EnhancedRecordingController } from './enhanced-recording-controller';

// WebContentsView-based tab interface
interface WebContentsTab {
  id: string;
  url: string;
  title: string;
  view: WebContentsView;
  isActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

interface WebContentsTabManagerOptions {
  window: BrowserWindow;
  preloadPath?: string;
}

/**
 * WebContentsTabManager for Electron app using WebContentsView instances
 * Each tab is a WebContentsView that fills the content area below the UI chrome
 */
export class WebContentsTabManager extends EventEmitter {
  private tabs: Map<string, WebContentsTab> = new Map();
  private activeTabId: string | null = null;
  private window: BrowserWindow;
  private preloadPath: string;
  private readonly chromeHeight = 88; // Height of tab bar + nav bar
  private sidebarWidth = 0; // Track sidebar state for bounds management
  private varsPanelWidth = 0; // Track vars panel width on the right
  private recordingController: EnhancedRecordingController | null = null;
  private recordingTabId: string | null = null;
  private recordingActive = false;

  constructor(options: WebContentsTabManagerOptions) {
    super();
    this.window = options.window;
    this.preloadPath = options.preloadPath || '';
    this.setupIpcHandlers();
    this.setupWindowListeners();
  }

  /**
   * Setup IPC handlers for tab management and recording
   */
  private setupIpcHandlers(): void {
    // Tab creation
    ipcMain.handle('tabs:create', async (event, url?: string) => {
      return this.createTab(url || 'https://www.google.com');
    });

    // Tab closing
    ipcMain.handle('tabs:close', async (event, tabId: string) => {
      return this.closeTab(tabId);
    });

    // Tab switching
    ipcMain.handle('tabs:switch', async (event, tabId: string) => {
      return this.switchTab(tabId);
    });

    // Navigation
    ipcMain.handle('tabs:navigate', async (event, tabId: string, url: string) => {
      return this.navigateTab(tabId, url);
    });

    ipcMain.handle('tabs:goBack', async (event, tabId: string) => {
      return this.goBack(tabId);
    });

    ipcMain.handle('tabs:goForward', async (event, tabId: string) => {
      return this.goForward(tabId);
    });

    ipcMain.handle('tabs:reload', async (event, tabId: string) => {
      return this.reloadTab(tabId);
    });

    // Get all tabs
    ipcMain.handle('tabs:getAll', async () => {
      return this.getTabsForRenderer();
    });

    // Get active tab
    ipcMain.handle('tabs:getActive', async () => {
      return this.activeTabId ? this.getTabForRenderer(this.activeTabId) : null;
    });

    // Enhanced Recording handlers
    ipcMain.handle('enhanced-recording:start', async (event, options) => {
      return this.startEnhancedRecording(options);
    });

    ipcMain.handle('enhanced-recording:stop', async () => {
      return this.stopEnhancedRecording();
    });

    ipcMain.handle('enhanced-recording:pause', async () => {
      return this.pauseEnhancedRecording();
    });

    ipcMain.handle('enhanced-recording:resume', async () => {
      return this.resumeEnhancedRecording();
    });

    ipcMain.handle('enhanced-recording:status', async () => {
      return this.getRecordingStatus();
    });
  }

  /**
   * Setup window listeners for resizing
   */
  private setupWindowListeners(): void {
    this.window.on('resize', () => {
      this.updateAllTabBounds();
    });
  }

  /**
   * Create a new WebContentsView tab
   */
  public async createTab(url: string): Promise<Omit<WebContentsTab, 'view'>> {
    const tabId = uuidv4();

    // Handle local files and ensure URL has protocol
    if (url.startsWith('./') || url.endsWith('.html')) {
      const htmlPath = path.join(__dirname, '..', '..', 'ui', url.replace('./', ''));
      url = `file://${htmlPath}`;
    } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      url = 'https://' + url;
    }

    // Create WebContentsView
    const view = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        experimentalFeatures: true,
        backgroundThrottling: false,
        offscreen: false
      }
    });

    const tab: WebContentsTab = {
      id: tabId,
      url,
      title: 'New Tab',
      view,
      isActive: false,
      canGoBack: false,
      canGoForward: false,
      isLoading: true
    };

    // Setup WebContents event handlers
    this.setupWebContentsHandlers(tab);

    // Set user agent
    const modernUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    view.webContents.setUserAgent(modernUA);

    // Navigate to URL
    await view.webContents.loadURL(url);

    // Store tab
    this.tabs.set(tabId, tab);

    // If this is the first tab, make it active
    if (this.tabs.size === 1) {
      await this.switchTab(tabId);
    }

    // Update bounds
    this.updateTabBounds(tab);

    // Emit tab created event
    this.emit('tab-created', tab);

    // Return serializable tab info
    return this.getTabForRenderer(tabId)!;
  }

  /**
   * Start enhanced CDP-based recording
   */
  public async startEnhancedRecording(options?: any): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      if (this.recordingActive) {
        return { success: false, error: 'Recording is already in progress' };
      }

      const activeTab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (!activeTab) {
        return { success: false, error: 'No active tab to record' };
      }

      // Create new recording controller
      this.recordingController = new EnhancedRecordingController();
      
      // Connect to the WebContentsView via CDP
      const sessionId = `enhanced-${Date.now()}`;
      await this.recordingController.startRecording({
        url: activeTab.url,
        webContentsId: activeTab.view.webContents.id,
        options
      });

      this.recordingActive = true;
      this.recordingTabId = this.activeTabId;

      this.emit('enhanced-recording-started', { sessionId, tabId: this.activeTabId });
      return { success: true, sessionId };

    } catch (error: any) {
      console.error('Failed to start enhanced recording:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop enhanced recording
   */
  public async stopEnhancedRecording(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!this.recordingActive || !this.recordingController) {
        return { success: false, error: 'No recording in progress' };
      }

      const recordingData = await this.recordingController.stopRecording();
      
      this.recordingActive = false;
      this.recordingTabId = null;
      this.recordingController = null;

      this.emit('enhanced-recording-stopped', { data: recordingData });
      return { success: true, data: recordingData };

    } catch (error: any) {
      console.error('Failed to stop enhanced recording:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause enhanced recording
   */
  public async pauseEnhancedRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.recordingActive || !this.recordingController) {
        return { success: false, error: 'No recording in progress' };
      }

      await this.recordingController.pauseRecording();
      this.emit('enhanced-recording-paused');
      return { success: true };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume enhanced recording
   */
  public async resumeEnhancedRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.recordingController) {
        return { success: false, error: 'No recording session to resume' };
      }

      await this.recordingController.resumeRecording();
      this.emit('enhanced-recording-resumed');
      return { success: true };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recording status
   */
  public getRecordingStatus(): { isRecording: boolean; isPaused: boolean; sessionId?: string } {
    if (!this.recordingController) {
      return { isRecording: false, isPaused: false };
    }

    return {
      isRecording: this.recordingActive,
      isPaused: this.recordingController.isPaused(),
      sessionId: this.recordingController.getSessionId()
    };
  }

  /**
   * Close a tab
   */
  public async closeTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Remove view from window
    this.window.contentView.removeChildView(tab.view);

    // Delete tab
    this.tabs.delete(tabId);

    // If this was the active tab, switch to another
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        await this.switchTab(remainingTabs[0]);
      } else {
        this.activeTabId = null;
      }
    }

    this.emit('tab-closed', tabId);
    return true;
  }

  /**
   * Switch to a different tab
   */
  public async switchTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Hide current active tab
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.isActive = false;
        this.window.contentView.removeChildView(currentTab.view);
      }
    }

    // Show new tab
    tab.isActive = true;
    this.activeTabId = tabId;
    this.window.contentView.addChildView(tab.view);
    this.updateTabBounds(tab);

    this.emit('tab-switched', tabId);
    return true;
  }

  /**
   * Navigate a tab to a new URL
   */
  public async navigateTab(tabId: string, url: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    await tab.view.webContents.loadURL(url);
    tab.url = url;

    return true;
  }

  /**
   * Go back in a tab
   */
  public async goBack(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.canGoBack) return false;

    tab.view.webContents.goBack();
    return true;
  }

  /**
   * Go forward in a tab
   */
  public async goForward(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.canGoForward) return false;

    tab.view.webContents.goForward();
    return true;
  }

  /**
   * Reload a tab
   */
  public async reloadTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.view.webContents.reload();
    return true;
  }

  /**
   * Setup WebContents event handlers for a tab
   */
  private setupWebContentsHandlers(tab: WebContentsTab): void {
    const webContents = tab.view.webContents;

    webContents.on('did-start-loading', () => {
      tab.isLoading = true;
      this.emit('tab-loading', tab.id);
    });

    webContents.on('did-stop-loading', () => {
      tab.isLoading = false;
      this.emit('tab-loaded', tab.id);
    });

    webContents.on('page-title-updated', (event, title) => {
      tab.title = title;
      this.emit('tab-title-updated', { tabId: tab.id, title });
    });

    webContents.on('did-navigate', (event, url) => {
      tab.url = url;
      tab.canGoBack = webContents.canGoBack();
      tab.canGoForward = webContents.canGoForward();
      this.emit('tab-navigated', { tabId: tab.id, url });
    });

    webContents.on('new-window', (event, url) => {
      event.preventDefault();
      this.createTab(url);
    });
  }

  /**
   * Update tab bounds
   */
  private updateTabBounds(tab: WebContentsTab): void {
    const bounds = this.window.getContentBounds();
    tab.view.setBounds({
      x: this.sidebarWidth,
      y: this.chromeHeight,
      width: bounds.width - this.sidebarWidth - this.varsPanelWidth,
      height: bounds.height - this.chromeHeight
    });
  }

  /**
   * Update all tab bounds
   */
  private updateAllTabBounds(): void {
    for (const tab of this.tabs.values()) {
      if (tab.isActive) {
        this.updateTabBounds(tab);
      }
    }
  }

  /**
   * Get tab info for renderer (without view object)
   */
  private getTabForRenderer(tabId: string): Omit<WebContentsTab, 'view'> | null {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      isActive: tab.isActive,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      isLoading: tab.isLoading
    };
  }

  /**
   * Get all tabs for renderer
   */
  private getTabsForRenderer(): Array<Omit<WebContentsTab, 'view'>> {
    return Array.from(this.tabs.values()).map(tab => this.getTabForRenderer(tab.id)!);
  }

  /**
   * Set sidebar width for bounds calculation
   */
  public setSidebarWidth(width: number): void {
    this.sidebarWidth = width;
    this.updateAllTabBounds();
  }

  /**
   * Set vars panel width for bounds calculation
   */
  public setVarsPanelWidth(width: number): void {
    this.varsPanelWidth = width;
    this.updateAllTabBounds();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Stop any active recording
    if (this.recordingActive) {
      this.stopEnhancedRecording();
    }

    // Close all tabs
    for (const tabId of this.tabs.keys()) {
      this.closeTab(tabId);
    }

    // Remove all listeners
    this.removeAllListeners();
  }
}