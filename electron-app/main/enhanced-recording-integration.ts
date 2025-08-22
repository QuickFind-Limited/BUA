import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { EnhancedRecordingController } from './enhanced-recording-controller';
import { getTabManager } from './main';

/**
 * Enhanced Recording Integration
 * Provides IPC handlers for the Enhanced Recording Controller
 * without modifying existing WebContentsTabManager
 */

let enhancedRecordingController: EnhancedRecordingController | null = null;
let currentRecordingTabId: string | null = null;

/**
 * Initialize the enhanced recording integration
 */
export function initializeEnhancedRecording(): void {
  console.log('🎬 Initializing Enhanced Recording Integration...');
  
  enhancedRecordingController = new EnhancedRecordingController();
  
  // Register IPC handlers
  registerEnhancedRecordingHandlers();
  
  console.log('✅ Enhanced Recording Integration initialized');
}

/**
 * Register IPC handlers for enhanced recording
 */
function registerEnhancedRecordingHandlers(): void {
  // Start enhanced recording
  ipcMain.handle('enhanced-recording:start', async (event: IpcMainInvokeEvent, url?: string) => {
    try {
      console.log('🎬 IPC: Starting enhanced recording...');

      if (!enhancedRecordingController) {
        return { success: false, error: 'Enhanced recording controller not initialized' };
      }

      const tabManager = getTabManager();
      if (!tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const activeTab = (tabManager as any).getActiveTab();
      if (!activeTab) {
        return { success: false, error: 'No active tab found' };
      }

      // Connect to WebView if not already connected
      const connected = await enhancedRecordingController.connectToWebView(activeTab.view);
      if (!connected) {
        return { success: false, error: 'Failed to connect to WebView via CDP' };
      }

      // Start recording session
      const startUrl = url || activeTab.url;
      const sessionId = await enhancedRecordingController.startRecording(activeTab.view, startUrl);

      currentRecordingTabId = (tabManager as any).getActiveTabId();

      // Set up event listeners for recording events
      enhancedRecordingController.on('recording-started', (data) => {
        console.log('📡 Forwarding recording-started event to renderer');
        // Forward to renderer if needed
      });

      enhancedRecordingController.on('recording-stopped', (data) => {
        console.log('📡 Forwarding recording-stopped event to renderer');
        currentRecordingTabId = null;
        // Forward to renderer if needed
      });

      enhancedRecordingController.on('network-request', (data) => {
        // Forward network request events if needed
      });

      enhancedRecordingController.on('console-error', (data) => {
        // Forward console error events if needed
      });

      console.log(`✅ Enhanced recording started: ${sessionId}`);
      return { success: true, sessionId };

    } catch (error) {
      console.error('❌ Error starting enhanced recording:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Stop enhanced recording
  ipcMain.handle('enhanced-recording:stop', async () => {
    try {
      console.log('🛑 IPC: Stopping enhanced recording...');

      if (!enhancedRecordingController) {
        return { success: false, error: 'Enhanced recording controller not available' };
      }

      const activeSession = enhancedRecordingController.getActiveSession();
      if (!activeSession) {
        return { success: false, error: 'No active recording session found' };
      }

      // Stop the recording and get data
      const recordingData = await enhancedRecordingController.stopRecording(activeSession.id);

      currentRecordingTabId = null;

      console.log('✅ Enhanced recording stopped successfully');
      return { success: true, recordingData };

    } catch (error) {
      console.error('❌ Error stopping enhanced recording:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Get enhanced recording status
  ipcMain.handle('enhanced-recording:status', async () => {
    try {
      if (!enhancedRecordingController) {
        return { isRecording: false };
      }

      const activeSession = enhancedRecordingController.getActiveSession();
      if (!activeSession) {
        return { isRecording: false };
      }

      return {
        isRecording: true,
        sessionId: activeSession.id,
        tabId: currentRecordingTabId,
        startTime: activeSession.startTime,
        duration: Date.now() - activeSession.startTime
      };

    } catch (error) {
      console.error('❌ Error getting enhanced recording status:', error);
      return { isRecording: false, error: error.message };
    }
  });

  // Get enhanced recording performance stats
  ipcMain.handle('enhanced-recording:performance-stats', async () => {
    try {
      if (!enhancedRecordingController) {
        return {};
      }

      return enhancedRecordingController.getPerformanceStats();

    } catch (error) {
      console.error('❌ Error getting performance stats:', error);
      return { error: error.message };
    }
  });

  // Connect to active tab (utility function)
  ipcMain.handle('enhanced-recording:connect', async () => {
    try {
      console.log('🔗 IPC: Connecting to active tab...');

      if (!enhancedRecordingController) {
        return { success: false, error: 'Enhanced recording controller not initialized' };
      }

      const tabManager = getTabManager();
      if (!tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const activeTab = (tabManager as any).getActiveTab();
      if (!activeTab) {
        return { success: false, error: 'No active tab found' };
      }

      const connected = await enhancedRecordingController.connectToWebView(activeTab.view);
      
      return { 
        success: connected, 
        error: connected ? undefined : 'Failed to connect to WebView' 
      };

    } catch (error) {
      console.error('❌ Error connecting to tab:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  console.log('✅ Enhanced recording IPC handlers registered');
}

/**
 * Get the current enhanced recording controller instance
 */
export function getEnhancedRecordingController(): EnhancedRecordingController | null {
  return enhancedRecordingController;
}

/**
 * Dispose of the enhanced recording integration
 */
export async function disposeEnhancedRecording(): Promise<void> {
  console.log('🧹 Disposing Enhanced Recording Integration...');
  
  if (enhancedRecordingController) {
    await enhancedRecordingController.dispose();
    enhancedRecordingController = null;
  }
  
  currentRecordingTabId = null;
  
  console.log('✅ Enhanced Recording Integration disposed');
}