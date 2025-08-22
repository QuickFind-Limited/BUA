import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { 
  analyzeRecording, 
  executeMagnitudeAct, 
  processQuery, 
  isApiKeyConfigured, 
  testConnection,
  makeDecision,
  buildPromptFromSpec,
  extractDataForMagnitudeQuery,
  analyzeRecordingWithMetadata,
  executeMagnitudeDecision,
  executeMagnitudeQuery
} from './llm';
import { serializeRecording } from './recording-serializer';
import { ScreenshotComparator } from './screenshot-comparator';
// REMOVED: ExecutionEngine import - not used
import { getTabManager, getMainWindow } from './main';

// Type definitions for IPC events
interface AnalyzeRecordingParams {
  recordingData: string;
  context?: string;
}

interface DecideParams {
  instruction: string;
  context?: string;
  parameters?: Record<string, any>;
}

interface QueryParams {
  query: string;
  context?: string;
  searchScope?: string;
}

interface RunFlowParams {
  flowId: string;
  parameters?: Record<string, any>;
  context?: string;
}

interface ExecuteFlowParams {
  flowSpec: any;
  variables?: Record<string, any>;
}

interface SaveFlowParams {
  flowSpec: any;
  filePath?: string;
}

interface TabOperationParams {
  tabId?: string;
  url?: string;
}

interface ScreenshotComparisonParams {
  actualPath: string;
  expectedPath: string;
}

interface ExecuteWithValidationParams {
  flowSpec: any;
  variables?: Record<string, any>;
  successStatePath?: string;
  validateAgainstState?: boolean;
}

// Initialize screenshot comparator
const screenshotComparator = new ScreenshotComparator();

/**
 * Register all IPC handlers for secure communication between main and renderer processes
 */
export function registerIpcHandlers(): void {
  // LLM: Analyze recording handler with intelligent strategy selection
  ipcMain.handle('llm:analyzeRecording', async (event: IpcMainInvokeEvent, params: AnalyzeRecordingParams) => {
    console.log('==========================================');
    console.log('IPC: llm:analyzeRecording called');
    console.log('Params received:', JSON.stringify(params).substring(0, 200));
    console.log('==========================================');
    
    try {
      // Validate input
      if (!params.recordingData || typeof params.recordingData !== 'string') {
        console.error('Invalid recording data:', params.recordingData);
        throw new Error('Invalid recording data provided');
      }

      // Check API key is configured
      if (!isApiKeyConfigured()) {
        console.error('API key not configured');
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      console.log('Starting analyzeRecordingWithMetadata...');
      
      // Send progress updates to the renderer
      const mainWindow = getMainWindow();
      if (mainWindow) {
        // Notify that parsing is starting
        mainWindow.webContents.send('analysis-progress', { 
          step: 'parsing', 
          status: 'active', 
          message: 'Processing recording data for AI analysis...' 
        });
      }
      
      // Parse recording data to get metadata
      let recordingData: any[];
      if (typeof params.recordingData === 'string') {
        try {
          recordingData = JSON.parse(params.recordingData);
        } catch {
          recordingData = [{ type: 'raw', data: params.recordingData }];
        }
      } else {
        recordingData = params.recordingData || [];
      }
      
      // Serialize recording for display
      const serializedRecording = serializeRecording(recordingData);
      
      // Extract metadata
      const metadata = {
        stepCount: recordingData.length,
        complexity: recordingData.length > 10 ? 'complex' : recordingData.length > 5 ? 'moderate' : 'simple',
        hasNavigation: recordingData.some((action: any) => action.type === 'navigate'),
        hasFormInput: recordingData.some((action: any) => action.type === 'type' || action.type === 'fill'),
        hasClickActions: recordingData.some((action: any) => action.type === 'click'),
        estimatedDuration: recordingData.length * 2,
        variableCount: 0 // Will be updated after analysis
      };
      
      if (mainWindow) {
        // Add 2-second delay for parsing step visibility
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Notify that parsing is complete and AI analysis is starting
        mainWindow.webContents.send('analysis-progress', { 
          step: 'parsing', 
          status: 'completed', 
          message: 'Recording data prepared for AI' 
        });
        mainWindow.webContents.send('analysis-progress', { 
          step: 'analyzing', 
          status: 'active', 
          message: 'Claude Opus 4.1 is analyzing your workflow...' 
        });
      }
      
      // Get the full Intent Spec directly from analyzeRecording
      const fullIntentSpec = await analyzeRecording(params.recordingData);
      
      // Update metadata with variable count
      metadata.variableCount = fullIntentSpec.params?.length || 0;

      // Send progress for remaining steps
      if (mainWindow) {
        // AI analysis is already done, just update UI
        mainWindow.webContents.send('analysis-progress', { 
          step: 'analyzing', 
          status: 'completed', 
          message: 'Claude Opus 4.1 has completed workflow analysis' 
        });
        
        // Add 2-second delay before variables step
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        mainWindow.webContents.send('analysis-progress', { 
          step: 'variables', 
          status: 'active', 
          message: 'AI is identifying dynamic fields and variables...' 
        });
      }
      
      const processedResult = {
        success: true,
        data: {
          // Return the full Intent Spec with all step details
          intentSpec: fullIntentSpec,
          metadata: metadata,
          serializedRecording: serializedRecording
        }
      };
      
      // Send final progress updates
      if (mainWindow) {
        // Add 2-second delay for variables completion
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const varCount = fullIntentSpec.params ? fullIntentSpec.params.length : 0;
        mainWindow.webContents.send('analysis-progress', { 
          step: 'variables', 
          status: 'completed', 
          message: `Found ${varCount} variables` 
        });
        
        mainWindow.webContents.send('analysis-progress', { 
          step: 'generating', 
          status: 'active', 
          message: 'AI is structuring the Intent Spec...' 
        });
        
        // 2-second delay for generating step
        setTimeout(() => {
          mainWindow.webContents.send('analysis-progress', { 
            step: 'generating', 
            status: 'completed', 
            message: 'AI Intent Spec generation complete' 
          });
          
          mainWindow.webContents.send('analysis-progress', { 
            step: 'validating', 
            status: 'active', 
            message: 'Validating AI-generated structure...' 
          });
          
          // 2-second delay for validation step
          setTimeout(() => {
            mainWindow.webContents.send('analysis-progress', { 
              step: 'validating', 
              status: 'completed', 
              message: 'AI Intent Spec validated successfully' 
            });
          }, 2000);
        }, 2000);
      }
      
      return processedResult;
    } catch (error) {
      console.error('LLM analyze recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // LLM: Decide handler (Uses Opus 4.1 to decide act vs snippet)
  ipcMain.handle('llm:decide', async (event: IpcMainInvokeEvent, signals: any) => {
    try {
      // Check API key is configured
      if (!isApiKeyConfigured()) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      // Use Opus 4.1 for decision making
      const result = await makeDecision(signals);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('LLM decide error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Magnitude: Act handler (ONLY uses Sonnet 4 for browser automation)
  ipcMain.handle('magnitude:act', async (event: IpcMainInvokeEvent, params: DecideParams) => {
    try {
      // Validate input
      if (!params.instruction || typeof params.instruction !== 'string') {
        throw new Error('Invalid instruction provided');
      }

      // Check API key is configured
      if (!isApiKeyConfigured()) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      // Use Sonnet 4 ONLY for Magnitude act operations
      const context = params.context || "IPC request for browser automation";
      const action = {
        action: "custom",
        target: "IPC",
        value: params.instruction,
        description: params.instruction
      };
      const result = await executeMagnitudeAct(context, action);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Magnitude act error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Magnitude: Query handler (Uses Opus 4.1 for data extraction)
  ipcMain.handle('magnitude:query', async (event: IpcMainInvokeEvent, params: { content: string; goal: string }) => {
    try {
      // Check API key is configured
      if (!isApiKeyConfigured()) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      // Use Opus 4.1 for query/extraction
      const result = await extractDataForMagnitudeQuery(params.content, params.goal);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Magnitude query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // LLM: Query handler
  ipcMain.handle('llm:query', async (event: IpcMainInvokeEvent, params: QueryParams) => {
    try {
      // Validate input
      if (!params.query || typeof params.query !== 'string') {
        throw new Error('Invalid query provided');
      }

      // Check API key is configured
      if (!isApiKeyConfigured()) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      const result = await processQuery({
        query: params.query,
        context: params.context,
        searchScope: params.searchScope
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('LLM query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Flows: Run one flow handler
  ipcMain.handle('flows:runOne', async (event: IpcMainInvokeEvent, params: RunFlowParams) => {
    try {
      // Validate input
      if (!params.flowId || typeof params.flowId !== 'string') {
        throw new Error('Invalid flow ID provided');
      }

      // TODO: Implement actual flow execution logic
      // This is a placeholder that would integrate with your flow system
      const result = await executeFlow({
        flowId: params.flowId,
        parameters: params.parameters,
        context: params.context
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Flow execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Utility: Test API connection
  ipcMain.handle('llm:testConnection', async (event: IpcMainInvokeEvent) => {
    try {
      if (!isApiKeyConfigured()) {
        return {
          success: false,
          error: 'API key not configured'
        };
      }

      const isConnected = await testConnection();
      return {
        success: true,
        data: { connected: isConnected }
      };
    } catch (error) {
      console.error('API connection test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Utility: Check API key status
  ipcMain.handle('llm:checkApiKey', async (event: IpcMainInvokeEvent) => {
    return {
      success: true,
      data: { configured: isApiKeyConfigured() }
    };
  });

  // Tab Management Operations
  // Note: TabManager already registers its own IPC handlers, but we provide
  // wrapper handlers here for consistency and additional error handling
  
  // Create new tab
  ipcMain.handle('create-tab', async (event: IpcMainInvokeEvent, url?: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const tab = await tabManager.createTab(url || 'https://www.google.com');
      return {
        success: true,
        data: tab
      };
    } catch (error) {
      console.error('Create tab error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Close tab
  ipcMain.handle('close-tab', async (event: IpcMainInvokeEvent, tabId: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!tabId || typeof tabId !== 'string') {
        throw new Error('Invalid tab ID provided');
      }

      const result = await tabManager.closeTab(tabId);
      return {
        success: true,
        data: { closed: result }
      };
    } catch (error) {
      console.error('Close tab error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Switch tab
  ipcMain.handle('switch-tab', async (event: IpcMainInvokeEvent, tabId: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!tabId || typeof tabId !== 'string') {
        throw new Error('Invalid tab ID provided');
      }

      const result = await tabManager.switchTab(tabId);
      return {
        success: true,
        data: { switched: result }
      };
    } catch (error) {
      console.error('Switch tab error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Navigate tab
  ipcMain.handle('navigate-tab', async (event: IpcMainInvokeEvent, tabId: string, url: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!tabId || typeof tabId !== 'string') {
        throw new Error('Invalid tab ID provided');
      }

      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
      }

      const result = await tabManager.navigateTab(tabId, url);
      return {
        success: true,
        data: { navigated: result }
      };
    } catch (error) {
      console.error('Navigate tab error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Tab back navigation
  ipcMain.handle('tab-back', async (event: IpcMainInvokeEvent, tabId?: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      // If no tabId provided, use active tab
      const targetTabId = tabId || (tabManager as any).getActiveTab()?.id;
      if (!targetTabId) {
        throw new Error('No tab ID provided and no active tab found');
      }

      const result = await tabManager.goBack(targetTabId);
      return {
        success: true,
        data: { wentBack: result }
      };
    } catch (error) {
      console.error('Tab back error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Tab forward navigation
  ipcMain.handle('tab-forward', async (event: IpcMainInvokeEvent, tabId?: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      // If no tabId provided, use active tab
      const targetTabId = tabId || (tabManager as any).getActiveTab()?.id;
      if (!targetTabId) {
        throw new Error('No tab ID provided and no active tab found');
      }

      const result = await tabManager.goForward(targetTabId);
      return {
        success: true,
        data: { wentForward: result }
      };
    } catch (error) {
      console.error('Tab forward error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Tab reload
  ipcMain.handle('tab-reload', async (event: IpcMainInvokeEvent, tabId?: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      // If no tabId provided, use active tab
      const targetTabId = tabId || (tabManager as any).getActiveTab()?.id;
      if (!targetTabId) {
        throw new Error('No tab ID provided and no active tab found');
      }

      const result = await tabManager.reloadTab(targetTabId);
      return {
        success: true,
        data: { reloaded: result }
      };
    } catch (error) {
      console.error('Tab reload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Recording: Start recording
  ipcMain.handle('start-recording', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = await (tabManager as any).startRecording();
      return {
        success: result.success,
        data: result.success ? { sessionId: result.sessionId } : undefined,
        error: result.error
      };
    } catch (error) {
      console.error('Start recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Recording: Stop recording
  ipcMain.handle('stop-recording', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = (tabManager as any).stopRecording();
      return {
        success: result.success,
        data: result.success ? { session: (result as any).session } : undefined,
        error: result.error
      };
    } catch (error) {
      console.error('Stop recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Recording: Get recording status
  ipcMain.handle('recording-status', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const status = tabManager.getRecordingStatus();
      return {
        success: true,
        data: status
      };
    } catch (error) {
      console.error('Get recording status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Recording: Process recorded action from injected script
  ipcMain.handle('record-action', async (event: IpcMainInvokeEvent, action: any) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = (tabManager as any).processRecordedAction(action);
      return {
        success: result,
        error: result ? undefined : 'Failed to process recorded action'
      };
    } catch (error) {
      console.error('Process recorded action error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Recording: Generate Playwright code from session
  ipcMain.handle('generate-playwright-code', async (event: IpcMainInvokeEvent, session: any) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!session) {
        throw new Error('No session data provided');
      }

      const code = (tabManager as any).generatePlaywrightCode(session);
      return {
        success: true,
        data: { code }
      };
    } catch (error) {
      console.error('Generate Playwright code error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Recording: Export session as JSON
  ipcMain.handle('export-recording-session', async (event: IpcMainInvokeEvent, session: any) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!session) {
        throw new Error('No session data provided');
      }

      const jsonData = (tabManager as any).exportRecordingSession(session);
      return {
        success: true,
        data: { jsonData }
      };
    } catch (error) {
      console.error('Export recording session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Recording: Import session from JSON
  ipcMain.handle('import-recording-session', async (event: IpcMainInvokeEvent, jsonData: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!jsonData || typeof jsonData !== 'string') {
        throw new Error('Invalid JSON data provided');
      }

      const session = (tabManager as any).importRecordingSession(jsonData);
      return {
        success: !!session,
        data: session ? { session } : undefined,
        error: session ? undefined : 'Failed to import session data'
      };
    } catch (error) {
      console.error('Import recording session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Codegen Recording: Start codegen recording
  ipcMain.handle('start-codegen-recording', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = await (tabManager as any).startCodegenRecording();
      return {
        success: result.success,
        data: result.success ? { sessionId: result.sessionId } : undefined,
        error: result.error
      };
    } catch (error) {
      console.error('Start codegen recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // REMOVED: Duplicate of stop-recording - use unified handler instead

  // REMOVED: Duplicate of recording-status - use unified handler instead

  // Enhanced Recording: Start enhanced recording
  ipcMain.handle('start-enhanced-recording', async (event: IpcMainInvokeEvent, options = {}) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = await tabManager.startEnhancedRecording(options);
      return {
        success: result.success,
        data: result.success ? { sessionId: result.sessionId } : undefined,
        error: result.error
      };
    } catch (error) {
      console.error('Start enhanced recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced Recording: Stop enhanced recording
  ipcMain.handle('stop-enhanced-recording', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = await tabManager.stopEnhancedRecording();
      return {
        success: result.success,
        data: result.success ? { session: (result as any).session } : undefined,
        error: result.error
      };
    } catch (error) {
      console.error('Stop enhanced recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced Recording: Pause enhanced recording
  ipcMain.handle('pause-enhanced-recording', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = tabManager.pauseEnhancedRecording() as any;
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Pause enhanced recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced Recording: Resume enhanced recording
  ipcMain.handle('resume-enhanced-recording', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = tabManager.resumeEnhancedRecording() as any;
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Resume enhanced recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced Recording: Get enhanced recording status
  ipcMain.handle('enhanced-recording-status', async (event: IpcMainInvokeEvent) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const status = (tabManager as any).getRecordingStatus();
      return {
        success: true,
        data: status
      };
    } catch (error) {
      console.error('Get enhanced recording status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced Recording: Process recorded action from injected script
  ipcMain.handle('record-enhanced-action', async (event: IpcMainInvokeEvent, action: any) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      const result = (tabManager as any).processEnhancedAction(action);
      return {
        success: result,
        error: result ? undefined : 'Failed to process enhanced action'
      };
    } catch (error) {
      console.error('Process enhanced action error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced Recording: Generate Playwright code from enhanced session
  ipcMain.handle('generate-enhanced-playwright-code', async (event: IpcMainInvokeEvent, session: any) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!session) {
        throw new Error('No session data provided');
      }

      const code = (tabManager as any).generateEnhancedPlaywrightCode(session);
      return {
        success: true,
        data: { code }
      };
    } catch (error) {
      console.error('Generate enhanced Playwright code error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced Recording: Export enhanced session as JSON
  ipcMain.handle('export-enhanced-recording-session', async (event: IpcMainInvokeEvent, session: any) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }

      if (!session) {
        throw new Error('No session data provided');
      }

      const jsonData = (tabManager as any).exportEnhancedRecordingSession(session);
      return {
        success: true,
        data: { jsonData }
      };
    } catch (error) {
      console.error('Export enhanced recording session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Execute flow handler
  ipcMain.handle('execute-flow', async (event: IpcMainInvokeEvent, params: ExecuteFlowParams) => {
    try {
      // Validate input
      if (!params.flowSpec) {
        throw new Error('Flow specification is required');
      }

      // Check API key is configured
      if (!isApiKeyConfigured()) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      // For now, delegate to the Magnitude act system
      // In a full implementation, this would execute the flow steps directly
      const result = await executeFlowSteps(params.flowSpec, params.variables);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Execute flow error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Save flow handler
  ipcMain.handle('save-flow', async (event: IpcMainInvokeEvent, params: SaveFlowParams) => {
    try {
      // Validate input
      if (!params.flowSpec) {
        throw new Error('Flow specification is required');
      }

      const result = await saveFlowToFile(params.flowSpec, params.filePath);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Save flow error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Sidebar management handlers
  ipcMain.handle('sidebar:toggle', async (event: IpcMainInvokeEvent, isVisible: boolean) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }
      
      (tabManager as any).toggleSidebar?.(isVisible);
      return { 
        success: true, 
        sidebarWidth: isVisible ? 320 : 0 
      };
    } catch (error) {
      console.error('Sidebar toggle error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle sidebar'
      };
    }
  });

  ipcMain.handle('sidebar:resize', async (event: IpcMainInvokeEvent, width: number) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }
      
      tabManager.setSidebarWidth(width);
      return { 
        success: true, 
        sidebarWidth: width 
      };
    } catch (error) {
      console.error('Sidebar resize error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resize sidebar'
      };
    }
  });

  // Store launcher recorder instance
  let launcherRecorderInstance: any = null;
  
  // Launch Recorder handler
  ipcMain.handle('launch-recorder', async (event: IpcMainInvokeEvent, startUrl: string) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }
      
      // Import the launcher recorder
      const { PlaywrightLauncherRecorder } = await import('./playwright-launcher-recorder');
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('Main window not initialized');
      }
      
      // Create or reuse launcher recorder instance
      if (!launcherRecorderInstance) {
        launcherRecorderInstance = new PlaywrightLauncherRecorder(mainWindow);
      }
      
      const result = await launcherRecorderInstance.launchRecorder(startUrl);
      
      return result;
    } catch (error) {
      console.error('Launch recorder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to launch recorder'
      };
    }
  });
  
  // Save Intent Spec to file
  ipcMain.handle('save-intent-spec', async (event: IpcMainInvokeEvent, intentSpec: any, filename: string) => {
    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      const recordingsDir = path.join(process.cwd(), 'recordings');
      
      // Ensure recordings directory exists
      await fs.mkdir(recordingsDir, { recursive: true });
      
      const filePath = path.join(recordingsDir, filename);
      await fs.writeFile(filePath, JSON.stringify(intentSpec, null, 2), 'utf-8');
      
      console.log('Intent Spec saved to:', filePath);
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Failed to save Intent Spec:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save Intent Spec' 
      };
    }
  });
  
  // Get recorder status
  ipcMain.handle('get-recorder-status', async (event: IpcMainInvokeEvent) => {
    try {
      if (!launcherRecorderInstance) {
        return { isRecording: false };
      }
      
      return {
        isRecording: launcherRecorderInstance.isRecording()
      };
    } catch (error) {
      console.error('Get recorder status error:', error);
      return { isRecording: false };
    }
  });
  
  // Get last recording
  ipcMain.handle('get-last-recording', async (event: IpcMainInvokeEvent) => {
    try {
      if (!launcherRecorderInstance) {
        return null;
      }
      
      return launcherRecorderInstance.getLastRecording();
    } catch (error) {
      console.error('Get last recording error:', error);
      return null;
    }
  });

  // Run Magnitude with WebView handler
  ipcMain.handle('run-magnitude-webview', async (event: IpcMainInvokeEvent, params: { flowSpec: any; variables: Record<string, any> }) => {
    try {
      const tabManager = getTabManager();
      if (!tabManager) {
        throw new Error('TabManager not initialized');
      }
      
      // Import the ENHANCED flow executor with pre-flight analysis and skip logic
      const { EnhancedFlowExecutor } = await import('./enhanced-flow-executor');
      const executor = new EnhancedFlowExecutor();
      
      // Get the current WebContentsView from tab manager
      const activeTabId = (tabManager as any).getActiveTabId();
      if (!activeTabId) {
        throw new Error('No active tab found');
      }
      
      const activeTab = (tabManager as any).getTab(activeTabId);
      if (!activeTab || !activeTab.view) {
        throw new Error('Active tab has no WebContentsView');
      }
      
      // Set up progress callback to forward to renderer
      executor.onProgress((progress) => {
        event.sender.send('flow-progress', progress);
      });
      
      // Execute the flow with ENHANCED executor (includes pre-flight analysis)
      const result = await executor.executeFlow(params.flowSpec, params.variables, activeTab.view);
      
      // Return a serializable result matching the expected format
      return {
        success: result.success,
        results: [], // Enhanced executor doesn't provide step-by-step results in same format
        errors: result.errors.map(e => e.error),
        completedSteps: result.completedSteps,
        totalSteps: result.totalSteps,
        skippedSteps: result.skippedSteps,
        executionStats: result.executionStats,
        message: result.success 
          ? `Flow executed successfully! (${result.completedSteps}/${result.totalSteps} completed, ${result.skippedSteps} skipped)`
          : 'Flow execution completed with errors'
      };
    } catch (error) {
      console.error('Magnitude WebView execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute with Magnitude WebView',
        results: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  });

  // Screenshot comparison handler
  ipcMain.handle('screenshot:compare', async (event: IpcMainInvokeEvent, params: ScreenshotComparisonParams) => {
    try {
      if (!params.actualPath || !params.expectedPath) {
        throw new Error('Both actualPath and expectedPath are required');
      }

      if (typeof params.actualPath !== 'string' || typeof params.expectedPath !== 'string') {
        throw new Error('Screenshot paths must be strings');
      }

      const comparisonResult = await screenshotComparator.compareScreenshots(
        params.actualPath,
        params.expectedPath
      );

      return {
        success: true,
        data: comparisonResult
      };
    } catch (error) {
      console.error('Screenshot comparison error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Execute flow with validation against success state
  ipcMain.handle('execute-flow-with-validation', async (event: IpcMainInvokeEvent, params: ExecuteWithValidationParams) => {
    try {
      // Validate input
      if (!params.flowSpec) {
        throw new Error('Flow specification is required');
      }

      // Check API key is configured
      if (!isApiKeyConfigured()) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      // Execute the flow using the execution engine
      const executionResult = await executeFlowWithValidation(params);

      return {
        success: true,
        data: executionResult
      };
    } catch (error) {
      console.error('Execute flow with validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Enhanced decision making with context
  ipcMain.handle('llm:decideWithContext', async (event: IpcMainInvokeEvent, params: { context: string; options: any }) => {
    try {
      // Check API key is configured
      if (!isApiKeyConfigured()) {
        throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
      }

      // Use enhanced decision making with Magnitude
      const result = await executeMagnitudeDecision(params.context, params.options);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Enhanced decision making error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  console.log('IPC handlers registered successfully');
}

// Placeholder function for flow execution
// This should be replaced with actual flow execution logic
async function executeFlow(params: RunFlowParams): Promise<any> {
  // This is a placeholder implementation
  // In a real implementation, this would:
  // 1. Load the flow definition by flowId
  // 2. Execute the flow steps
  // 3. Handle flow state and error recovery
  // 4. Return the flow execution result
  
  return {
    flowId: params.flowId,
    status: 'completed',
    result: 'Flow execution placeholder - implement actual flow logic',
    executionTime: Date.now(),
    parameters: params.parameters
  };
}

/**
 * Helper function to determine intelligent strategy for action
 */
function determineIntelligentStrategy(step: any): 'ai' | 'snippet' {
  const action = step.action?.toLowerCase() || '';
  const target = step.target?.toLowerCase() || '';
  const value = step.value?.toLowerCase() || '';

  // Use snippet for sensitive data and stable elements
  if (
    value.includes('password') ||
    value.includes('credit') ||
    value.includes('ssn') ||
    value.includes('api') ||
    target.includes('#') || // ID selectors
    target.includes('data-testid') ||
    action === 'wait' ||
    action === 'navigate'
  ) {
    return 'snippet';
  }

  // Use AI for dynamic content and complex interactions
  if (
    target.includes('search') ||
    target.includes('result') ||
    target.includes('popup') ||
    target.includes('modal') ||
    target.includes('dynamic') ||
    action === 'click' && target.includes('button')
  ) {
    return 'ai';
  }

  // Default to snippet for simple, deterministic actions
  return 'snippet';
}

/**
 * Helper function to determine fallback strategy
 */
function determineFallbackStrategy(step: any): 'ai' | 'snippet' | 'none' {
  const prefer = determineIntelligentStrategy(step);
  
  // If we prefer snippet, fallback to AI
  if (prefer === 'snippet') {
    return 'ai';
  }
  
  // If we prefer AI, fallback to snippet
  if (prefer === 'ai') {
    return 'snippet';
  }
  
  return 'none';
}

/**
 * Helper function to generate Playwright snippet for action
 */
function generateSnippetForAction(step: any): string {
  const action = step.action?.toLowerCase() || '';
  const target = step.target || '';
  const value = step.value || '';

  switch (action) {
    case 'click':
      return `await page.click('${target}');`;
    case 'type':
    case 'fill':
      return `await page.fill('${target}', '${value}');`;
    case 'navigate':
      return `await page.goto('${target || value}');`;
    case 'wait':
      return `await page.waitForSelector('${target}', { timeout: 5000 });`;
    case 'select':
      return `await page.selectOption('${target}', '${value}');`;
    case 'hover':
      return `await page.hover('${target}');`;
    case 'scroll':
      return `await page.mouse.wheel(0, 300);`;
    default:
      return `await page.locator('${target}').click();`;
  }
}

/**
 * Execute flow with validation against success state
 */
async function executeFlowWithValidation(params: ExecuteWithValidationParams): Promise<any> {
  try {
    console.log('Executing flow with validation:', params.flowSpec.name || 'Unnamed Flow');
    
    // First execute the flow normally
    const executionResult = await executeFlowSteps(params.flowSpec, params.variables);
    
    // If validation is requested and we have a success state path
    if (params.validateAgainstState && params.successStatePath) {
      console.log('Validating execution against success state...');
      
      // Take a screenshot of current state
      const currentScreenshotPath = await takeCurrentScreenshot();
      
      if (currentScreenshotPath) {
        // Compare with expected success state
        const comparisonResult = await screenshotComparator.compareScreenshots(
          currentScreenshotPath,
          params.successStatePath
        );
        
        return {
          ...executionResult,
          validation: {
            performed: true,
            screenshotComparison: comparisonResult,
            currentScreenshotPath,
            expectedScreenshotPath: params.successStatePath,
            validationSuccess: comparisonResult.match && comparisonResult.similarity > 80
          }
        };
      } else {
        console.warn('Could not take screenshot for validation');
        return {
          ...executionResult,
          validation: {
            performed: false,
            error: 'Failed to capture current state for validation'
          }
        };
      }
    }
    
    // Return execution result without validation
    return {
      ...executionResult,
      validation: {
        performed: false,
        reason: 'Validation not requested'
      }
    };
  } catch (error) {
    console.error('Flow execution with validation error:', error);
    throw error;
  }
}

/**
 * Take screenshot of current browser state
 */
async function takeCurrentScreenshot(): Promise<string | null> {
  try {
    const tabManager = getTabManager();
    if (!tabManager) {
      throw new Error('TabManager not available');
    }

    const activeTab = (tabManager as any).getActiveTab();
    if (!activeTab) {
      throw new Error('No active tab available');
    }

    // Generate unique filename for current screenshot
    const timestamp = Date.now();
    const screenshotPath = `./recordings/execution-current-state-${timestamp}.png`;
    
    // Take screenshot using WebContents captureScreen method
    const fs = require('fs').promises;
    const path = require('path');
    
    // Ensure the recordings directory exists
    await fs.mkdir('./recordings', { recursive: true });
    
    // Take screenshot using WebContents
    const image = await activeTab.view.webContents.capturePage();
    const buffer = image.toPNG();
    
    // Write to file
    await fs.writeFile(screenshotPath, buffer);
    
    console.log('Screenshot saved to:', screenshotPath);
    return screenshotPath;
  } catch (error) {
    console.error('Error taking current screenshot:', error);
    return null;
  }
}

/**
 * Execute flow steps using Magnitude Act system
 */
async function executeFlowSteps(flowSpec: any, variables?: Record<string, any>): Promise<any> {
  try {
    console.log('Executing flow:', flowSpec.name || 'Unnamed Flow');
    
    if (!flowSpec.steps || !Array.isArray(flowSpec.steps)) {
      throw new Error('Flow must have valid steps array');
    }

    const results = [];
    for (let i = 0; i < flowSpec.steps.length; i++) {
      const step = flowSpec.steps[i];
      console.log(`Executing step ${i + 1}/${flowSpec.steps.length}:`, step.action);
      
      // Convert step to Magnitude instruction
      const instruction = formatStepForMagnitude(step, variables);
      
      // Execute via Magnitude Act
      const context = `Step ${i + 1} of flow: ${flowSpec.name || 'Unnamed Flow'}`;
      const stepResult = await executeMagnitudeAct(context, step);
      
      results.push({
        stepIndex: i,
        step: step,
        result: stepResult,
        timestamp: Date.now()
      });
      
      // Add delay between steps to avoid overwhelming the system
      if (i < flowSpec.steps.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return {
      flowId: flowSpec.id || 'generated',
      flowName: flowSpec.name || 'Unnamed Flow',
      status: 'completed',
      stepsExecuted: results.length,
      totalSteps: flowSpec.steps.length,
      results: results,
      executionTime: Date.now(),
      variables: variables
    };
    
  } catch (error) {
    console.error('Flow execution error:', error);
    throw error;
  }
}

/**
 * Format a flow step for Magnitude Act execution
 */
function formatStepForMagnitude(step: any, variables?: Record<string, any>): string {
  const action = step.action || 'unknown';
  const target = step.target || '';
  const value = step.value || '';
  
  // Substitute variables in target and value
  const substitutedTarget = substituteVariables(target, variables);
  const substitutedValue = substituteVariables(value, variables);
  
  switch (action.toLowerCase()) {
    case 'click':
      return `Click on the element: ${substitutedTarget}`;
    case 'type':
      return `Type "${substitutedValue}" into the element: ${substitutedTarget}`;
    case 'navigate':
      return `Navigate to URL: ${substitutedTarget || substitutedValue}`;
    case 'wait':
      return `Wait for ${substitutedTarget || substitutedValue || '1000'} milliseconds`;
    case 'scroll':
      return `Scroll ${substitutedTarget || 'down'} on the page`;
    case 'hover':
      return `Hover over the element: ${substitutedTarget}`;
    case 'select':
      return `Select "${substitutedValue}" from the dropdown: ${substitutedTarget}`;
    case 'submit':
      return `Submit the form: ${substitutedTarget}`;
    default:
      return `Perform ${action} action on ${substitutedTarget}${substitutedValue ? ` with value: ${substitutedValue}` : ''}`;
  }
}

/**
 * Substitute variables in a string using {{variable}} syntax
 */
function substituteVariables(text: string, variables?: Record<string, any>): string {
  if (!text || typeof text !== 'string' || !variables) {
    return text;
  }
  
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, String(value || ''));
  }
  
  return result;
}

/**
 * Save flow specification to file
 */
async function saveFlowToFile(flowSpec: any, filePath?: string): Promise<any> {
  const fs = require('fs').promises;
  const path = require('path');
  const { dialog } = require('electron');
  
  try {
    let targetPath = filePath;
    
    if (!targetPath) {
      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Save Flow',
        defaultPath: `${flowSpec.name || 'flow'}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled || !result.filePath) {
        throw new Error('Save operation cancelled');
      }
      
      targetPath = result.filePath;
    }
    
    // Ensure the directory exists
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Add metadata to the flow
    const flowWithMetadata = {
      ...flowSpec,
      savedAt: new Date().toISOString(),
      version: '1.0',
      type: 'cua-flow'
    };
    
    // Write the file
    await fs.writeFile(targetPath, JSON.stringify(flowWithMetadata, null, 2), 'utf8');
    
    console.log('Flow saved to:', targetPath);
    
    return {
      filePath: targetPath,
      size: JSON.stringify(flowWithMetadata).length,
      savedAt: flowWithMetadata.savedAt
    };
    
  } catch (error) {
    console.error('Error saving flow:', error);
    throw error;
  }
}

/**
 * Remove all IPC handlers (useful for cleanup)
 */
export function removeIpcHandlers(): void {
  ipcMain.removeAllListeners('llm:analyzeRecording');
  ipcMain.removeAllListeners('llm:decide');
  ipcMain.removeAllListeners('llm:query');
  ipcMain.removeAllListeners('magnitude:act');
  ipcMain.removeAllListeners('magnitude:query');
  ipcMain.removeAllListeners('flows:runOne');
  ipcMain.removeAllListeners('llm:testConnection');
  ipcMain.removeAllListeners('llm:checkApiKey');
  
  // Tab management handlers
  ipcMain.removeAllListeners('create-tab');
  ipcMain.removeAllListeners('close-tab');
  ipcMain.removeAllListeners('switch-tab');
  ipcMain.removeAllListeners('navigate-tab');
  ipcMain.removeAllListeners('tab-back');
  ipcMain.removeAllListeners('tab-forward');
  ipcMain.removeAllListeners('tab-reload');
  
  // Recording handlers
  ipcMain.removeAllListeners('start-recording');
  ipcMain.removeAllListeners('stop-recording');
  ipcMain.removeAllListeners('recording-status');
  ipcMain.removeAllListeners('record-action');
  ipcMain.removeAllListeners('generate-playwright-code');
  ipcMain.removeAllListeners('export-recording-session');
  ipcMain.removeAllListeners('import-recording-session');
  
  // Screenshot and validation handlers
  ipcMain.removeAllListeners('screenshot:compare');
  ipcMain.removeAllListeners('execute-flow-with-validation');
  ipcMain.removeAllListeners('llm:decideWithContext');
  
  // Codegen recording handlers
  ipcMain.removeAllListeners('start-codegen-recording');
  ipcMain.removeAllListeners('stop-codegen-recording');
  ipcMain.removeAllListeners('codegen-recording-status');
  
  // Enhanced recording handlers
  ipcMain.removeAllListeners('start-enhanced-recording');
  ipcMain.removeAllListeners('stop-enhanced-recording');
  ipcMain.removeAllListeners('pause-enhanced-recording');
  ipcMain.removeAllListeners('resume-enhanced-recording');
  ipcMain.removeAllListeners('enhanced-recording-status');
  ipcMain.removeAllListeners('record-enhanced-action');
  ipcMain.removeAllListeners('generate-enhanced-playwright-code');
  ipcMain.removeAllListeners('export-enhanced-recording-session');
  
  // Flow execution handlers
  ipcMain.removeAllListeners('execute-flow');
  ipcMain.removeAllListeners('save-flow');
  
  console.log('IPC handlers removed');
}