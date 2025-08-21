const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * RecordingEventCollector - Production-ready recording data management
 * 
 * This module manages all recording data in the main process, handling:
 * - Event collection from page contexts
 * - Tab context management  
 * - Data aggregation and export
 * - Proper error handling and logging
 * 
 * @version 1.0.0
 * @author Generated with Claude Code
 */

// Event type definitions
const EVENT_TYPES = {
  ACTION: 'action',
  DOM_SNAPSHOT: 'dom_snapshot', 
  DOM_MUTATION: 'dom_mutation',
  NETWORK_REQUEST: 'network_request',
  CONSOLE_LOG: 'console_log',
  CONSOLE_ERROR: 'console_error',
  SCREENSHOT: 'screenshot',
  PAGE_LOAD: 'page_load',
  PAGE_UNLOAD: 'page_unload',
  USER_INPUT: 'user_input',
  NAVIGATION: 'navigation'
};

// Event priority levels for performance optimization
const EVENT_PRIORITY = {
  CRITICAL: 0,    // Actions, errors, navigation
  HIGH: 1,        // User inputs, page loads
  MEDIUM: 2,      // DOM mutations, network requests
  LOW: 3          // Console logs, minor events
};

class RecordingEventCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.options = {
      maxEventsPerSession: options.maxEventsPerSession || 10000,
      maxSessionDuration: options.maxSessionDuration || 3600000, // 1 hour
      enableDebugLogging: options.enableDebugLogging || false,
      recordingsDir: options.recordingsDir || path.join(process.cwd(), 'recordings'),
      autoSaveInterval: options.autoSaveInterval || 30000, // 30 seconds
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      compressionEnabled: options.compressionEnabled || true,
      ...options
    };

    // Internal state
    this.sessions = new Map();           // sessionId -> RecordingSession
    this.activeSessionId = null;
    this.tabContexts = new Map();        // tabId -> TabContext
    this.eventQueue = [];                // Buffered events for batch processing
    this.isCollecting = false;
    this.autoSaveTimer = null;
    this.performanceMetrics = {
      eventsProcessed: 0,
      sessionsCreated: 0,
      errorsEncountered: 0,
      avgProcessingTime: 0
    };

    // Initialize
    this.initializeCollector();
  }

  /**
   * Initialize the event collector
   */
  async initializeCollector() {
    try {
      await this.ensureDirectories();
      this.setupPerformanceMonitoring();
      this.log('RecordingEventCollector initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize RecordingEventCollector', error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.options.recordingsDir, { recursive: true });
      await fs.mkdir(path.join(this.options.recordingsDir, 'temp'), { recursive: true });
      await fs.mkdir(path.join(this.options.recordingsDir, 'archives'), { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create recordings directories: ${error.message}`);
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
        this.log('High memory usage detected, triggering cleanup', 'warn');
        this.performCleanup();
      }
    }, 60000); // Check every minute
  }

  /**
   * Start a new recording session
   */
  startSession(options = {}) {
    try {
      const sessionId = options.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      if (this.sessions.has(sessionId)) {
        throw new Error(`Session ${sessionId} already exists`);
      }

      const session = {
        id: sessionId,
        startTime: Date.now(),
        endTime: null,
        status: 'active',
        metadata: {
          url: options.url || 'unknown',
          title: options.title || 'Untitled Recording',
          userAgent: options.userAgent || 'unknown',
          viewport: options.viewport || { width: 1920, height: 1080 },
          version: '1.0.0',
          type: 'enhanced-recording'
        },
        events: [],
        tabContexts: new Map(),
        statistics: {
          totalEvents: 0,
          eventsByType: {},
          errorCount: 0,
          warningCount: 0,
          averageEventInterval: 0,
          peakMemoryUsage: 0
        },
        performanceData: {
          startMemory: process.memoryUsage(),
          eventProcessingTimes: [],
          batchProcessingTimes: []
        }
      };

      // Initialize event type counters
      Object.values(EVENT_TYPES).forEach(type => {
        session.statistics.eventsByType[type] = 0;
      });

      this.sessions.set(sessionId, session);
      this.activeSessionId = sessionId;
      this.isCollecting = true;

      // Start auto-save timer
      this.startAutoSave();

      this.log(`Recording session started: ${sessionId}`, 'info');
      this.emit('session-started', { sessionId, session: this.sanitizeSessionForEmit(session) });

      return sessionId;
    } catch (error) {
      this.logError('Failed to start recording session', error);
      throw error;
    }
  }

  /**
   * Stop a recording session
   */
  async stopSession(sessionId = null) {
    try {
      const targetSessionId = sessionId || this.activeSessionId;
      if (!targetSessionId) {
        throw new Error('No active session to stop');
      }

      const session = this.sessions.get(targetSessionId);
      if (!session) {
        throw new Error(`Session ${targetSessionId} not found`);
      }

      // Update session metadata
      session.endTime = Date.now();
      session.status = 'completed';
      session.metadata.duration = session.endTime - session.startTime;

      // Calculate final statistics
      this.calculateFinalStatistics(session);

      // Process any remaining queued events
      await this.processEventQueue();

      // Save final recording data
      const recordingData = await this.exportSessionData(targetSessionId);

      // Cleanup
      if (targetSessionId === this.activeSessionId) {
        this.activeSessionId = null;
        this.isCollecting = false;
        this.stopAutoSave();
      }

      this.log(`Recording session stopped: ${targetSessionId}`, 'info');
      this.emit('session-stopped', { 
        sessionId: targetSessionId, 
        recordingData,
        statistics: session.statistics
      });

      return recordingData;
    } catch (error) {
      this.logError('Failed to stop recording session', error);
      throw error;
    }
  }

  /**
   * Add event to recording session
   */
  addEvent(eventData, tabId = null) {
    try {
      const startTime = Date.now();
      
      if (!this.isCollecting || !this.activeSessionId) {
        this.log('Event received but no active recording session', 'warn');
        return false;
      }

      const session = this.sessions.get(this.activeSessionId);
      if (!session) {
        this.logError('Active session not found', new Error(`Session ${this.activeSessionId} not found`));
        return false;
      }

      // Validate event data
      const validatedEvent = this.validateAndNormalizeEvent(eventData, tabId);
      if (!validatedEvent) {
        this.log('Invalid event data received', 'warn');
        return false;
      }

      // Check session limits
      if (session.events.length >= this.options.maxEventsPerSession) {
        this.log('Session event limit reached', 'warn');
        return false;
      }

      // Add event to session
      session.events.push(validatedEvent);
      session.statistics.totalEvents++;
      session.statistics.eventsByType[validatedEvent.type]++;
      
      // Track specific action types
      if (validatedEvent.type === EVENT_TYPES.ACTION && validatedEvent.data.action) {
        const actionType = validatedEvent.data.action;
        if (!session.statistics.eventsByType[actionType]) {
          session.statistics.eventsByType[actionType] = 0;
        }
        session.statistics.eventsByType[actionType]++;
      }

      // Update tab context if provided
      if (tabId) {
        this.updateTabContext(tabId, validatedEvent);
      }

      // Track performance
      const processingTime = Date.now() - startTime;
      session.performanceData.eventProcessingTimes.push(processingTime);
      this.performanceMetrics.eventsProcessed++;

      // Queue for batch processing if needed
      if (this.shouldBatchProcess(validatedEvent)) {
        this.eventQueue.push({
          sessionId: this.activeSessionId,
          event: validatedEvent,
          timestamp: Date.now()
        });
      }

      this.emit('event-added', {
        sessionId: this.activeSessionId,
        event: validatedEvent,
        tabId
      });

      return true;
    } catch (error) {
      this.logError('Failed to add event', error);
      this.performanceMetrics.errorsEncountered++;
      return false;
    }
  }

  /**
   * Add DOM snapshot event
   */
  addDOMSnapshot(snapshotData, tabId = null) {
    return this.addEvent({
      type: EVENT_TYPES.DOM_SNAPSHOT,
      timestamp: Date.now(),
      data: {
        url: snapshotData.url || 'unknown',
        title: snapshotData.title || 'unknown',
        viewport: snapshotData.viewport || { width: 0, height: 0 },
        visibleElements: snapshotData.visibleElements || [],
        interactableElements: snapshotData.interactableElements || [],
        elementCount: (snapshotData.visibleElements || []).length,
        interactableCount: (snapshotData.interactableElements || []).length
      },
      context: {
        tabId,
        sessionId: this.activeSessionId
      }
    }, tabId);
  }

  /**
   * Add user action event
   */
  addAction(actionData, tabId = null) {
    // Preserve the actual event type (click, scroll, etc.) in the data
    return this.addEvent({
      type: EVENT_TYPES.ACTION,
      timestamp: actionData.timestamp || Date.now(),
      priority: EVENT_PRIORITY.CRITICAL,
      data: {
        action: actionData.action || actionData.type,  // The actual event type
        element: actionData.element,
        selector: actionData.selector,
        value: actionData.value,
        url: actionData.url,
        // Preserve all event-specific data
        ...actionData
      },
      context: {
        tabId: actionData.tabContext?.tabId || tabId,
        sessionId: this.activeSessionId,
        userInitiated: true
      }
    }, tabId);
  }

  /**
   * Add DOM mutation event
   */
  addDOMMutation(mutationData, tabId = null) {
    return this.addEvent({
      type: EVENT_TYPES.DOM_MUTATION,
      timestamp: Date.now(),
      priority: EVENT_PRIORITY.MEDIUM,
      data: {
        mutations: mutationData.mutations || [],
        mutationCount: (mutationData.mutations || []).length,
        affectedNodes: mutationData.affectedNodes || []
      },
      context: {
        tabId,
        sessionId: this.activeSessionId
      }
    }, tabId);
  }

  /**
   * Add network request event
   */
  addNetworkRequest(requestData, tabId = null) {
    return this.addEvent({
      type: EVENT_TYPES.NETWORK_REQUEST,
      timestamp: Date.now(),
      priority: EVENT_PRIORITY.MEDIUM,
      data: {
        url: requestData.url,
        method: requestData.method || 'GET',
        statusCode: requestData.statusCode,
        responseSize: requestData.responseSize,
        timing: requestData.timing,
        headers: requestData.headers
      },
      context: {
        tabId,
        sessionId: this.activeSessionId
      }
    }, tabId);
  }

  /**
   * Add console event (log or error)
   */
  addConsoleEvent(consoleData, tabId = null) {
    const isError = consoleData.level === 'error' || consoleData.type === 'error';
    
    return this.addEvent({
      type: isError ? EVENT_TYPES.CONSOLE_ERROR : EVENT_TYPES.CONSOLE_LOG,
      timestamp: Date.now(),
      priority: isError ? EVENT_PRIORITY.CRITICAL : EVENT_PRIORITY.LOW,
      data: {
        level: consoleData.level || 'log',
        message: consoleData.message,
        source: consoleData.source,
        stackTrace: consoleData.stackTrace,
        args: consoleData.args
      },
      context: {
        tabId,
        sessionId: this.activeSessionId
      }
    }, tabId);
  }

  /**
   * Associate events with tab context
   */
  registerTabContext(tabId, contextData) {
    try {
      const tabContext = {
        id: tabId,
        url: contextData.url || 'unknown',
        title: contextData.title || 'unknown',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        eventCount: 0,
        webContentsId: contextData.webContentsId,
        sessionId: this.activeSessionId,
        isActive: contextData.isActive || false
      };

      this.tabContexts.set(tabId, tabContext);
      
      if (this.activeSessionId) {
        const session = this.sessions.get(this.activeSessionId);
        if (session) {
          session.tabContexts.set(tabId, tabContext);
        }
      }

      this.log(`Tab context registered: ${tabId}`, 'debug');
      this.emit('tab-context-registered', { tabId, context: tabContext });

      return tabContext;
    } catch (error) {
      this.logError('Failed to register tab context', error);
      return null;
    }
  }

  /**
   * Update tab context with new activity
   */
  updateTabContext(tabId, event) {
    try {
      const tabContext = this.tabContexts.get(tabId);
      if (tabContext) {
        tabContext.lastActivity = Date.now();
        tabContext.eventCount++;
        
        // Update URL if navigation event
        if (event.type === EVENT_TYPES.NAVIGATION && event.data && event.data.url) {
          tabContext.url = event.data.url;
        }
        
        // Update title if page load event
        if (event.type === EVENT_TYPES.PAGE_LOAD && event.data && event.data.title) {
          tabContext.title = event.data.title;
        }
      }
    } catch (error) {
      this.logError('Failed to update tab context', error);
    }
  }

  /**
   * Remove tab context
   */
  removeTabContext(tabId) {
    try {
      this.tabContexts.delete(tabId);
      
      if (this.activeSessionId) {
        const session = this.sessions.get(this.activeSessionId);
        if (session) {
          session.tabContexts.delete(tabId);
        }
      }

      this.log(`Tab context removed: ${tabId}`, 'debug');
      this.emit('tab-context-removed', { tabId });
    } catch (error) {
      this.logError('Failed to remove tab context', error);
    }
  }

  /**
   * Validate and normalize event data
   */
  validateAndNormalizeEvent(eventData, tabId) {
    try {
      if (!eventData || typeof eventData !== 'object') {
        return null;
      }

      // Ensure required fields
      const normalizedEvent = {
        id: eventData.id || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: eventData.type || EVENT_TYPES.ACTION,
        timestamp: eventData.timestamp || Date.now(),
        priority: eventData.priority || EVENT_PRIORITY.MEDIUM,
        data: eventData.data || {},
        context: {
          tabId: tabId || eventData.context?.tabId || null,
          sessionId: this.activeSessionId,
          ...(eventData.context || {})
        }
      };

      // Validate event type
      if (!Object.values(EVENT_TYPES).includes(normalizedEvent.type)) {
        this.log(`Unknown event type: ${normalizedEvent.type}`, 'warn');
        normalizedEvent.type = EVENT_TYPES.ACTION;
      }

      // Sanitize data to prevent circular references
      normalizedEvent.data = this.sanitizeObjectForSerialization(normalizedEvent.data);

      return normalizedEvent;
    } catch (error) {
      this.logError('Failed to validate event', error);
      return null;
    }
  }

  /**
   * Determine if event should be batch processed
   */
  shouldBatchProcess(event) {
    // Batch process low priority events for performance
    return event.priority >= EVENT_PRIORITY.MEDIUM && 
           (event.type === EVENT_TYPES.DOM_MUTATION || 
            event.type === EVENT_TYPES.CONSOLE_LOG);
  }

  /**
   * Process queued events in batches
   */
  async processEventQueue() {
    if (this.eventQueue.length === 0) return;

    const startTime = Date.now();
    const batchSize = 100;
    
    try {
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, batchSize);
        
        // Process batch (e.g., compress, deduplicate, etc.)
        for (const queuedEvent of batch) {
          // Additional processing logic here if needed
          this.emit('event-batch-processed', queuedEvent);
        }
      }

      const processingTime = Date.now() - startTime;
      if (this.activeSessionId) {
        const session = this.sessions.get(this.activeSessionId);
        if (session) {
          session.performanceData.batchProcessingTimes.push(processingTime);
        }
      }

    } catch (error) {
      this.logError('Failed to process event queue', error);
    }
  }

  /**
   * Export session data for final recording
   */
  async exportSessionData(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const recordingData = {
        metadata: {
          ...session.metadata,
          sessionId: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.endTime - session.startTime,
          timestamp: new Date().toISOString(),
          statistics: session.statistics
        },
        events: session.events,
        tabContexts: Array.from(session.tabContexts.values()),
        performanceMetrics: {
          ...session.performanceData,
          finalMemory: process.memoryUsage(),
          averageEventProcessingTime: this.calculateAverage(session.performanceData.eventProcessingTimes),
          averageBatchProcessingTime: this.calculateAverage(session.performanceData.batchProcessingTimes)
        }
      };

      // Save to file
      const filename = `recording-${sessionId}-${Date.now()}.json`;
      const filepath = path.join(this.options.recordingsDir, filename);
      
      await fs.writeFile(
        filepath, 
        JSON.stringify(recordingData, null, 2),
        'utf8'
      );

      this.log(`Recording data exported to: ${filepath}`, 'info');
      
      return {
        ...recordingData,
        filepath,
        filename
      };
    } catch (error) {
      this.logError('Failed to export session data', error);
      throw error;
    }
  }

  /**
   * Get aggregated data for active session
   */
  getAggregatedData(sessionId = null) {
    try {
      const targetSessionId = sessionId || this.activeSessionId;
      if (!targetSessionId) {
        return null;
      }

      const session = this.sessions.get(targetSessionId);
      if (!session) {
        return null;
      }

      return {
        sessionId: session.id,
        status: session.status,
        startTime: session.startTime,
        currentTime: Date.now(),
        duration: Date.now() - session.startTime,
        eventCount: session.events.length,
        statistics: session.statistics,
        tabContexts: Array.from(session.tabContexts.values()),
        recentEvents: session.events.slice(-10), // Last 10 events
        performanceMetrics: {
          memoryUsage: process.memoryUsage(),
          eventsPerSecond: this.calculateEventsPerSecond(session),
          averageEventSize: this.calculateAverageEventSize(session.events)
        }
      };
    } catch (error) {
      this.logError('Failed to get aggregated data', error);
      return null;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(sessionId = null) {
    try {
      const targetSessionId = sessionId || this.activeSessionId;
      const session = this.sessions.get(targetSessionId);
      
      if (!session) {
        return null;
      }

      return {
        sessionId: session.id,
        totalEvents: session.statistics.totalEvents,
        eventsByType: { ...session.statistics.eventsByType },
        errorCount: session.statistics.errorCount,
        warningCount: session.statistics.warningCount,
        duration: session.endTime ? (session.endTime - session.startTime) : (Date.now() - session.startTime),
        tabCount: session.tabContexts.size,
        averageEventInterval: this.calculateAverageEventInterval(session),
        memoryUsage: session.performanceData.finalMemory || process.memoryUsage()
      };
    } catch (error) {
      this.logError('Failed to get session statistics', error);
      return null;
    }
  }

  /**
   * Calculate final session statistics
   */
  calculateFinalStatistics(session) {
    try {
      // Calculate average event interval
      if (session.events.length > 1) {
        const totalTime = session.endTime - session.startTime;
        session.statistics.averageEventInterval = totalTime / session.events.length;
      }

      // Count errors and warnings
      session.statistics.errorCount = session.events.filter(event => 
        event.type === EVENT_TYPES.CONSOLE_ERROR || 
        event.priority === EVENT_PRIORITY.CRITICAL
      ).length;

      session.statistics.warningCount = session.events.filter(event => 
        event.data && event.data.level === 'warn'
      ).length;

      // Calculate peak memory usage
      session.statistics.peakMemoryUsage = Math.max(
        session.performanceData.startMemory.heapUsed,
        process.memoryUsage().heapUsed
      );

    } catch (error) {
      this.logError('Failed to calculate final statistics', error);
    }
  }

  /**
   * Auto-save functionality
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      if (this.activeSessionId) {
        this.saveSessionBackup(this.activeSessionId);
      }
    }, this.options.autoSaveInterval);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Save session backup
   */
  async saveSessionBackup(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) return;

      const backupData = {
        sessionId: session.id,
        startTime: session.startTime,
        eventCount: session.events.length,
        lastBackup: Date.now(),
        events: session.events.slice(-100), // Last 100 events only
        statistics: session.statistics
      };

      const backupPath = path.join(
        this.options.recordingsDir, 
        'temp', 
        `${sessionId}-backup.json`
      );

      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
      this.log(`Session backup saved: ${sessionId}`, 'debug');
    } catch (error) {
      this.logError('Failed to save session backup', error);
    }
  }

  /**
   * Cleanup old data and optimize memory
   */
  performCleanup() {
    try {
      // Clear old completed sessions
      for (const [sessionId, session] of this.sessions) {
        if (session.status === 'completed' && 
            Date.now() - session.endTime > 3600000) { // 1 hour old
          this.sessions.delete(sessionId);
          this.log(`Cleaned up old session: ${sessionId}`, 'debug');
        }
      }

      // Clear old tab contexts
      for (const [tabId, context] of this.tabContexts) {
        if (Date.now() - context.lastActivity > 1800000) { // 30 minutes inactive
          this.tabContexts.delete(tabId);
          this.log(`Cleaned up inactive tab context: ${tabId}`, 'debug');
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

    } catch (error) {
      this.logError('Failed to perform cleanup', error);
    }
  }

  /**
   * Utility methods
   */
  calculateAverage(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  calculateEventsPerSecond(session) {
    const duration = (Date.now() - session.startTime) / 1000;
    return duration > 0 ? session.events.length / duration : 0;
  }

  calculateAverageEventSize(events) {
    if (!events || events.length === 0) return 0;
    const totalSize = events.reduce((sum, event) => {
      return sum + JSON.stringify(event).length;
    }, 0);
    return totalSize / events.length;
  }

  calculateAverageEventInterval(session) {
    if (session.events.length < 2) return 0;
    const intervals = [];
    for (let i = 1; i < session.events.length; i++) {
      intervals.push(session.events[i].timestamp - session.events[i-1].timestamp);
    }
    return this.calculateAverage(intervals);
  }

  sanitizeObjectForSerialization(obj, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return '[Object: max depth reached]';
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof Error) return { message: obj.message, stack: obj.stack };
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObjectForSerialization(item, depth + 1, maxDepth));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        sanitized[key] = this.sanitizeObjectForSerialization(value, depth + 1, maxDepth);
      } catch (error) {
        sanitized[key] = '[Object: serialization error]';
      }
    }
    return sanitized;
  }

  sanitizeSessionForEmit(session) {
    return {
      id: session.id,
      startTime: session.startTime,
      status: session.status,
      metadata: session.metadata,
      statistics: session.statistics,
      eventCount: session.events.length,
      tabCount: session.tabContexts.size
    };
  }

  /**
   * Logging methods
   */
  log(message, level = 'info') {
    if (!this.options.enableDebugLogging && level === 'debug') return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [RecordingEventCollector] [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage);
    } else if (level === 'warn') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  }

  logError(message, error) {
    const errorDetails = error ? `${error.message}\nStack: ${error.stack}` : 'No error details';
    this.log(`${message}: ${errorDetails}`, 'error');
    this.performanceMetrics.errorsEncountered++;
  }

  /**
   * Public API methods
   */
  isActive() {
    return this.isCollecting && this.activeSessionId !== null;
  }

  getActiveSessionId() {
    return this.activeSessionId;
  }

  getAllSessions() {
    return Array.from(this.sessions.keys());
  }

  getSessionData(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? this.sanitizeSessionForEmit(session) : null;
  }

  getTabContexts() {
    return Array.from(this.tabContexts.values());
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Dispose and cleanup resources
   */
  async dispose() {
    try {
      this.log('Disposing RecordingEventCollector...', 'info');

      // Stop any active sessions
      if (this.activeSessionId) {
        await this.stopSession(this.activeSessionId);
      }

      // Stop auto-save
      this.stopAutoSave();

      // Process remaining events
      await this.processEventQueue();

      // Clear all data
      this.sessions.clear();
      this.tabContexts.clear();
      this.eventQueue = [];
      this.isCollecting = false;
      this.activeSessionId = null;

      // Remove all listeners
      this.removeAllListeners();

      this.log('RecordingEventCollector disposed successfully', 'info');
    } catch (error) {
      this.logError('Failed to dispose RecordingEventCollector', error);
    }
  }
}

// Export the class and constants
module.exports = {
  RecordingEventCollector,
  EVENT_TYPES,
  EVENT_PRIORITY
};