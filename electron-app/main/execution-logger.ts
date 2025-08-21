/**
 * Execution Logger for debugging and troubleshooting
 * Logs all execution steps, pre-flight analysis, errors, and recovery attempts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  category: 'EXECUTION' | 'PREFLIGHT' | 'ERROR' | 'RECOVERY' | 'AI' | 'FALLBACK';
  message: string;
  data?: any;
}

export class ExecutionLogger {
  private logDir: string;
  private currentLogFile: string | null = null;
  private sessionId: string;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private debugMode: boolean = false;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'executions');
    this.sessionId = '';
  }

  /**
   * Initialize logger for a new execution session
   */
  async startSession(flowName: string): Promise<void> {
    this.sessionId = `${Date.now()}-${flowName.replace(/[^a-z0-9]/gi, '-')}`;
    this.currentLogFile = path.join(this.logDir, `${this.sessionId}.log`);
    
    // Ensure log directory exists
    await fs.mkdir(this.logDir, { recursive: true });
    
    // Write session header
    await this.log('INFO', 'EXECUTION', `=== Starting execution session: ${flowName} ===`);
    await this.log('INFO', 'EXECUTION', `Session ID: ${this.sessionId}`);
    await this.log('INFO', 'EXECUTION', `Timestamp: ${new Date().toISOString()}`);
    
    // Start auto-flush
    this.flushInterval = setInterval(() => this.flush(), 1000);
  }

  /**
   * End the current session
   */
  async endSession(success: boolean, summary?: any): Promise<void> {
    await this.log('INFO', 'EXECUTION', `=== Session ended: ${success ? 'SUCCESS' : 'FAILED'} ===`);
    if (summary) {
      await this.log('INFO', 'EXECUTION', 'Session Summary:', summary);
    }
    
    // Stop auto-flush and do final flush
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
    
    // Also create a summary JSON file
    if (summary) {
      const summaryFile = path.join(this.logDir, `${this.sessionId}-summary.json`);
      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
    }
  }

  /**
   * Log a message
   */
  async log(level: LogEntry['level'], category: LogEntry['category'], message: string, data?: any): Promise<void> {
    // Skip debug logs if not in debug mode
    if (level === 'DEBUG' && !this.debugMode) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? this.sanitizeData(data) : undefined
    };

    this.buffer.push(entry);
    
    // Also log to console
    const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
    console.log(`${prefix} ${message}`);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Log step execution
   */
  async logStep(stepIndex: number, stepName: string, action: string, result: any): Promise<void> {
    await this.log('INFO', 'EXECUTION', `Step ${stepIndex + 1}: ${stepName}`, {
      action,
      success: result.success,
      method: result.executionMethod,
      skipped: result.skipped,
      skipReason: result.skipReason,
      duration: result.duration
    });
  }

  /**
   * Log pre-flight analysis
   */
  async logPreflightAnalysis(stepName: string, analysis: any): Promise<void> {
    await this.log('DEBUG', 'PREFLIGHT', `Pre-flight analysis for: ${stepName}`, {
      canSkip: analysis.canSkip,
      confidence: analysis.confidence,
      reason: analysis.reason,
      elementFound: analysis.elementFound,
      strategy: analysis.recommendedStrategy
    });
  }

  /**
   * Log error and recovery attempt
   */
  async logError(error: Error, context: any): Promise<void> {
    await this.log('ERROR', 'ERROR', error.message, {
      stack: error.stack,
      context,
      name: error.name
    });
  }

  /**
   * Log recovery attempt
   */
  async logRecoveryAttempt(strategy: string, success: boolean, details?: any): Promise<void> {
    await this.log('INFO', 'RECOVERY', `Recovery attempt: ${strategy}`, {
      success,
      details
    });
  }

  /**
   * Log fallback strategy attempt
   */
  async logFallbackAttempt(strategyType: string, instruction: string, success: boolean): Promise<void> {
    await this.log('DEBUG', 'FALLBACK', `Fallback strategy: ${strategyType}`, {
      instruction,
      success
    });
  }

  /**
   * Log AI intervention
   */
  async logAIIntervention(context: string, prompt: string, response: string, success: boolean): Promise<void> {
    await this.log('INFO', 'AI', 'AI intervention requested', {
      context,
      promptLength: prompt.length,
      responseLength: response.length,
      success
    });
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.log('INFO', 'EXECUTION', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Flush buffer to file
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.currentLogFile) {
      return;
    }

    const entries = this.buffer.splice(0);
    const logText = entries.map(entry => {
      let line = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
      if (entry.data) {
        line += '\n  ' + JSON.stringify(entry.data, null, 2).replace(/\n/g, '\n  ');
      }
      return line;
    }).join('\n') + '\n';

    try {
      await fs.appendFile(this.currentLogFile, logText, 'utf-8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Sanitize sensitive data
   */
  private sanitizeData(data: any): any {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential'];
    
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = Array.isArray(data) ? [...data] : { ...data };
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Get current session log file path
   */
  getCurrentLogFile(): string | null {
    return this.currentLogFile;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
export const executionLogger = new ExecutionLogger();