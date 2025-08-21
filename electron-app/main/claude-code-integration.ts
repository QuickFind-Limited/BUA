/**
 * Claude Code CLI Integration Module
 * 
 * Production-ready integration system that:
 * 1. Spawns Claude Code CLI as a child process for complex error recovery
 * 2. Provides methods to invoke Claude Code with error context
 * 3. Parses and executes Claude's solutions safely
 * 4. Includes sandboxing for AI-generated code execution
 * 5. Implements caching of successful AI solutions
 * 6. Creates a decision engine for when to use Claude vs built-in strategies
 * 7. Includes timeout and rate limiting for API calls
 * 8. Logs all AI interventions for audit
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Page } from 'playwright';
import { createHash } from 'crypto';
import { HybridErrorRecovery, ErrorCategory, RecoveryStrategy, RecoveryContext, RecoveryResult, ErrorAnalysisResult } from './hybrid-error-recovery';
import { FlowError, ActionContext } from '../flows/types';

// Configuration interfaces
export interface ClaudeCodeConfig {
  // API Configuration
  apiKey?: string;
  rateLimitRequestsPerMinute: number;
  timeoutMs: number;
  maxRetries: number;
  
  // Decision Engine Configuration
  complexityThreshold: number; // Error complexity score above which Claude is used
  failureCountThreshold: number; // Number of built-in strategy failures before using Claude
  confidenceThreshold: number; // Minimum confidence required for Claude solutions
  
  // Caching Configuration
  enableCaching: boolean;
  cacheMaxSize: number;
  cacheExpirationHours: number;
  
  // Sandboxing Configuration
  enableSandboxing: boolean;
  sandboxTimeoutMs: number;
  allowedOperations: string[];
  
  // Logging Configuration
  auditLogPath: string;
  enableDetailedLogging: boolean;
  logRetentionDays: number;
}

export interface ErrorContext {
  error: Error | any;
  errorMessage: string;
  category: ErrorCategory;
  page?: Page;
  selector?: string;
  value?: string;
  stepName: string;
  retryCount: number;
  actionContext?: ActionContext;
  variables?: Record<string, string>;
  stackTrace?: string;
  browserState?: BrowserState;
  pageContent?: string;
  screenshot?: string;
  timestamp: Date;
}

export interface BrowserState {
  url: string;
  title: string;
  readyState: string;
  viewport: { width: number; height: number };
  cookies: any[];
  userAgent: string;
}

export interface ClaudeSolution {
  id: string;
  strategy: string;
  code: string;
  explanation: string;
  confidence: number;
  estimatedSuccessRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiredPermissions: string[];
  timeEstimate: number;
  metadata: {
    model: string;
    timestamp: Date;
    tokenUsage?: number;
    reasoning: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  sideEffects: string[];
  warnings: string[];
  securityViolations: string[];
}

export interface DecisionContext {
  error: Error | any;
  errorCategory: ErrorCategory;
  complexity: number;
  builtInStrategiesTried: RecoveryStrategy[];
  builtInFailureCount: number;
  isKnownIssue: boolean;
  systemLoad: number;
  availableTime: number;
  criticalPath: boolean;
}

export interface CacheEntry {
  key: string;
  solution: ClaudeSolution;
  successCount: number;
  failureCount: number;
  lastUsed: Date;
  created: Date;
  averageSuccessRate: number;
}

export interface AuditLogEntry {
  timestamp: Date;
  sessionId: string;
  eventType: 'decision' | 'invocation' | 'execution' | 'error' | 'cache';
  errorContext?: Partial<ErrorContext>;
  decision?: {
    useClaudeCode: boolean;
    reasoning: string;
    confidence: number;
  };
  solution?: Partial<ClaudeSolution>;
  executionResult?: Partial<ExecutionResult>;
  cacheHit?: boolean;
  duration: number;
  metadata: Record<string, any>;
}

// Rate limiting class
class RateLimiter {
  private requestTimes: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequestsPerMinute: number) {
    this.maxRequests = maxRequestsPerMinute;
    this.windowMs = 60 * 1000; // 1 minute
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Remove old entries
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    
    if (this.requestTimes.length >= this.maxRequests) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requestTimes.push(now);
  }
}

// Code sandboxing class
class CodeSandbox {
  private allowedOperations: Set<string>;
  private timeoutMs: number;

  constructor(allowedOperations: string[], timeoutMs: number) {
    this.allowedOperations = new Set(allowedOperations);
    this.timeoutMs = timeoutMs;
  }

  validateCode(code: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // Check for dangerous operations
    const dangerousPatterns = [
      /eval\s*\(/g,
      /new\s+Function\s*\(/g,
      /document\.write/g,
      /window\.open/g,
      /location\.(href|replace|assign)/g,
      /fetch\s*\(/g,
      /XMLHttpRequest/g,
      /localStorage/g,
      /sessionStorage/g,
      /process\./g,
      /require\s*\(/g,
      /import\s+/g,
      /fs\./g,
      /child_process/g,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        violations.push(`Dangerous operation detected: ${pattern.source}`);
      }
    }

    // Check for allowed operations
    const operations = this.extractOperations(code);
    for (const op of operations) {
      if (!this.allowedOperations.has(op)) {
        violations.push(`Unauthorized operation: ${op}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  private extractOperations(code: string): string[] {
    const operations: string[] = [];
    
    // Extract Playwright operations
    const playwrightMatches = code.match(/page\.(\w+)\(/g) || [];
    operations.push(...playwrightMatches.map(match => match.replace('page.', '').replace('(', '')));
    
    // Extract other method calls
    const methodMatches = code.match(/\.(\w+)\(/g) || [];
    operations.push(...methodMatches.map(match => match.replace('.', '').replace('(', '')));
    
    return operations;
  }

  async executeCode(code: string, context: any): Promise<ExecutionResult> {
    const startTime = Date.now();
    const validation = this.validateCode(code);
    
    if (!validation.valid) {
      return {
        success: false,
        error: 'Code validation failed',
        executionTime: 0,
        sideEffects: [],
        warnings: [],
        securityViolations: validation.violations
      };
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        this.safeExecute(code, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Execution timeout')), this.timeoutMs)
        )
      ]);

      return {
        success: true,
        result,
        executionTime: Date.now() - startTime,
        sideEffects: [],
        warnings: [],
        securityViolations: []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: Date.now() - startTime,
        sideEffects: [],
        warnings: [],
        securityViolations: []
      };
    }
  }

  private async safeExecute(code: string, context: any): Promise<any> {
    // Create a safe execution context
    const safeContext = {
      page: context.page,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      // Add other safe context elements
    };

    // Use Function constructor for safer execution than eval
    const fn = new Function('context', `
      const { page } = context;
      return (async () => {
        ${code}
      })();
    `);

    return await fn(safeContext);
  }
}

/**
 * Main Claude Code Integration Class
 */
export class ClaudeCodeIntegration {
  private config: ClaudeCodeConfig;
  private hybridRecovery: HybridErrorRecovery;
  private rateLimiter: RateLimiter;
  private sandbox: CodeSandbox;
  private cache: Map<string, CacheEntry> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private sessionId: string;
  private activeProcess: ChildProcess | null = null;

  constructor(config: Partial<ClaudeCodeConfig> = {}, hybridRecovery?: HybridErrorRecovery) {
    this.config = this.mergeConfig(config);
    this.hybridRecovery = hybridRecovery || new HybridErrorRecovery();
    this.rateLimiter = new RateLimiter(this.config.rateLimitRequestsPerMinute);
    this.sandbox = new CodeSandbox(this.config.allowedOperations, this.config.sandboxTimeoutMs);
    this.sessionId = this.generateSessionId();

    // Initialize cache cleanup
    this.setupCacheCleanup();
    
    // Initialize audit log cleanup
    this.setupAuditCleanup();
  }

  private mergeConfig(userConfig: Partial<ClaudeCodeConfig>): ClaudeCodeConfig {
    const defaultConfig: ClaudeCodeConfig = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      rateLimitRequestsPerMinute: 30,
      timeoutMs: 120000, // 2 minutes
      maxRetries: 3,
      complexityThreshold: 7,
      failureCountThreshold: 2,
      confidenceThreshold: 0.7,
      enableCaching: true,
      cacheMaxSize: 1000,
      cacheExpirationHours: 24,
      enableSandboxing: true,
      sandboxTimeoutMs: 30000, // 30 seconds
      allowedOperations: [
        'click', 'type', 'fill', 'select', 'check', 'uncheck',
        'waitFor', 'waitForSelector', 'waitForTimeout', 'waitForLoadState',
        'goto', 'reload', 'goBack', 'goForward',
        'screenshot', 'locator', 'getByRole', 'getByLabel', 'getByText',
        'scrollIntoViewIfNeeded', 'hover', 'focus', 'blur',
        'getAttribute', 'textContent', 'innerHTML', 'evaluate'
      ],
      auditLogPath: path.join(process.cwd(), 'logs', 'claude-code-audit.log'),
      enableDetailedLogging: true,
      logRetentionDays: 30
    };

    return { ...defaultConfig, ...userConfig };
  }

  private generateSessionId(): string {
    return `claude-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(errorContext: ErrorContext): string {
    const keyData = {
      errorMessage: errorContext.errorMessage,
      category: errorContext.category,
      selector: errorContext.selector,
      pageUrl: errorContext.browserState?.url,
    };
    
    return createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Main decision engine - determines whether to use Claude Code vs built-in strategies
   */
  public shouldUseClaudeCode(
    error: Error | any, 
    context: Partial<RecoveryContext> = {}
  ): { useClaudeCode: boolean; reasoning: string; confidence: number } {
    const startTime = Date.now();
    
    try {
      const errorContext = this.buildErrorContext(error, context);
      const decisionContext = this.buildDecisionContext(errorContext);
      
      const decision = this.evaluateDecision(decisionContext);
      
      // Log decision
      this.logAuditEvent({
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventType: 'decision',
        decision,
        errorContext,
        duration: Date.now() - startTime,
        metadata: { decisionContext }
      });

      return decision;
    } catch (error) {
      // Fallback to conservative approach on decision error
      const fallbackDecision = {
        useClaudeCode: false,
        reasoning: `Decision engine error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.1
      };

      this.logAuditEvent({
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventType: 'error',
        decision: fallbackDecision,
        duration: Date.now() - startTime,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return fallbackDecision;
    }
  }

  private buildErrorContext(error: Error | any, context: Partial<RecoveryContext>): ErrorContext {
    const analysis = this.hybridRecovery.categorizeError(error);
    
    return {
      error,
      errorMessage: this.extractErrorMessage(error),
      category: analysis.category,
      page: context.page,
      selector: context.selector,
      value: context.value,
      stepName: context.stepName || 'unknown',
      retryCount: context.retryCount || 0,
      actionContext: context.actionContext,
      variables: context.variables,
      stackTrace: error?.stack,
      timestamp: new Date()
    };
  }

  private buildDecisionContext(errorContext: ErrorContext): DecisionContext {
    const complexity = this.calculateComplexity(errorContext);
    const builtInStrategies = this.getTriedStrategies(errorContext);
    
    return {
      error: errorContext.error,
      errorCategory: errorContext.category,
      complexity,
      builtInStrategiesTried: builtInStrategies,
      builtInFailureCount: errorContext.retryCount,
      isKnownIssue: this.hybridRecovery.isKnownIssue(errorContext.error),
      systemLoad: this.getSystemLoad(),
      availableTime: this.getAvailableTime(),
      criticalPath: this.isCriticalPath(errorContext)
    };
  }

  private evaluateDecision(context: DecisionContext): { useClaudeCode: boolean; reasoning: string; confidence: number } {
    const factors: Array<{ factor: string; score: number; weight: number; reasoning: string }> = [];
    
    // Factor 1: Error complexity
    const complexityScore = Math.min(context.complexity / 10, 1);
    factors.push({
      factor: 'complexity',
      score: complexityScore,
      weight: 0.3,
      reasoning: `Error complexity: ${context.complexity}/10`
    });

    // Factor 2: Built-in strategy failures
    const failureScore = Math.min(context.builtInFailureCount / this.config.failureCountThreshold, 1);
    factors.push({
      factor: 'failures',
      score: failureScore,
      weight: 0.25,
      reasoning: `Built-in failures: ${context.builtInFailureCount}/${this.config.failureCountThreshold}`
    });

    // Factor 3: Known issue status (inverse - if known, prefer built-in)
    const knownIssueScore = context.isKnownIssue ? 0.2 : 0.8;
    factors.push({
      factor: 'known_issue',
      score: knownIssueScore,
      weight: 0.15,
      reasoning: `Known issue: ${context.isKnownIssue ? 'yes (prefer built-in)' : 'no (consider Claude)'}`
    });

    // Factor 4: System resources
    const resourceScore = 1 - context.systemLoad;
    factors.push({
      factor: 'resources',
      score: resourceScore,
      weight: 0.1,
      reasoning: `System load: ${Math.round(context.systemLoad * 100)}%`
    });

    // Factor 5: Time constraints
    const timeScore = context.availableTime > this.config.timeoutMs ? 1 : 0.3;
    factors.push({
      factor: 'time',
      score: timeScore,
      weight: 0.1,
      reasoning: `Available time: ${context.availableTime}ms vs required ${this.config.timeoutMs}ms`
    });

    // Factor 6: Critical path
    const criticalScore = context.criticalPath ? 0.9 : 0.5;
    factors.push({
      factor: 'critical',
      score: criticalScore,
      weight: 0.1,
      reasoning: `Critical path: ${context.criticalPath ? 'yes (high stakes)' : 'no'}`
    });

    // Calculate weighted score
    const weightedScore = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);
    const useClaudeCode = weightedScore > 0.6; // Threshold for using Claude
    
    const reasoning = [
      `Decision score: ${(weightedScore * 100).toFixed(1)}% (threshold: 60%)`,
      ...factors.map(f => `${f.factor}: ${(f.score * 100).toFixed(0)}% (${f.reasoning})`)
    ].join('; ');

    return {
      useClaudeCode,
      reasoning,
      confidence: Math.abs(weightedScore - 0.5) * 2 // Distance from threshold
    };
  }

  /**
   * Invoke Claude Code CLI with error context
   */
  public async invokeClaudeCode(
    error: Error | any,
    context: Partial<RecoveryContext> = {}
  ): Promise<ClaudeSolution> {
    const startTime = Date.now();
    
    try {
      // Rate limiting
      await this.rateLimiter.waitIfNeeded();
      
      const errorContext = this.buildErrorContext(error, context);
      const cacheKey = this.generateCacheKey(errorContext);
      
      // Check cache first
      if (this.config.enableCaching) {
        const cached = await this.getCachedSolution(cacheKey);
        if (cached) {
          this.logAuditEvent({
            timestamp: new Date(),
            sessionId: this.sessionId,
            eventType: 'invocation',
            errorContext,
            cacheHit: true,
            duration: Date.now() - startTime,
            metadata: { cached: true }
          });
          
          return cached.solution;
        }
      }

      // Invoke Claude Code CLI
      const solution = await this.callClaudeCodeCLI(errorContext);
      
      // Cache successful solution
      if (this.config.enableCaching && solution.confidence >= this.config.confidenceThreshold) {
        await this.cacheSuccessfulSolution(cacheKey, solution);
      }

      this.logAuditEvent({
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventType: 'invocation',
        errorContext,
        solution,
        cacheHit: false,
        duration: Date.now() - startTime,
        metadata: { freshSolution: true }
      });

      return solution;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logAuditEvent({
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventType: 'error',
        errorContext: this.buildErrorContext(error, context),
        duration: Date.now() - startTime,
        metadata: { invocationError: errorMessage }
      });

      throw new Error(`Claude Code invocation failed: ${errorMessage}`);
    }
  }

  private async callClaudeCodeCLI(errorContext: ErrorContext): Promise<ClaudeSolution> {
    const prompt = this.buildClaudePrompt(errorContext);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.activeProcess) {
          this.activeProcess.kill('SIGTERM');
          this.activeProcess = null;
        }
        reject(new Error('Claude Code CLI timeout'));
      }, this.config.timeoutMs);

      // Spawn Claude Code CLI process
      this.activeProcess = spawn('node', [
        path.join(__dirname, '..', 'cli', 'index.js'),
        'analyze-error'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: this.config.apiKey
        }
      });

      let stdout = '';
      let stderr = '';

      this.activeProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      this.activeProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      this.activeProcess.on('close', (code) => {
        clearTimeout(timeout);
        this.activeProcess = null;
        
        if (code === 0) {
          try {
            const solution = this.parseClaudeResponse(stdout);
            resolve(solution);
          } catch (parseError) {
            reject(new Error(`Failed to parse Claude response: ${parseError instanceof Error ? parseError.message : 'Parse error'}`));
          }
        } else {
          reject(new Error(`Claude Code CLI exited with code ${code}: ${stderr}`));
        }
      });

      this.activeProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.activeProcess = null;
        reject(new Error(`Failed to spawn Claude Code CLI: ${error.message}`));
      });

      // Send the prompt
      this.activeProcess.stdin?.write(JSON.stringify({
        prompt,
        errorContext: {
          message: errorContext.errorMessage,
          category: errorContext.category,
          selector: errorContext.selector,
          pageUrl: errorContext.browserState?.url
        }
      }));
      this.activeProcess.stdin?.end();
    });
  }

  private buildClaudePrompt(errorContext: ErrorContext): string {
    return `You are an expert browser automation error recovery specialist. Analyze this error and provide a specific, executable solution.

ERROR DETAILS:
- Message: ${errorContext.errorMessage}
- Category: ${errorContext.category}
- Step: ${errorContext.stepName}
- Retry Count: ${errorContext.retryCount}
- Selector: ${errorContext.selector || 'N/A'}
- Value: ${errorContext.value || 'N/A'}

BROWSER STATE:
- URL: ${errorContext.browserState?.url || 'Unknown'}
- Title: ${errorContext.browserState?.title || 'Unknown'}
- Ready State: ${errorContext.browserState?.readyState || 'Unknown'}

CONTEXT:
- Action Context: ${JSON.stringify(errorContext.actionContext, null, 2)}
- Variables: ${JSON.stringify(errorContext.variables, null, 2)}

REQUIREMENTS:
1. Provide specific Playwright code to resolve this error
2. Include confidence level (0-1) in your solution
3. Estimate success rate based on error pattern
4. Assess risk level: low, medium, or high
5. List any required permissions or special considerations
6. Provide clear explanation of the approach

Response should be valid JSON with this structure:
{
  "strategy": "brief_strategy_name",
  "code": "await page.click('selector');",
  "explanation": "Detailed explanation of the solution",
  "confidence": 0.85,
  "estimatedSuccessRate": 0.9,
  "riskLevel": "low",
  "requiredPermissions": ["page_interaction"],
  "timeEstimate": 5000,
  "reasoning": "Why this solution should work"
}

Provide ONLY the JSON response, no additional text.`;
  }

  private parseClaudeResponse(response: string): ClaudeSolution {
    try {
      const cleanedResponse = response.trim();
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleanedResponse;
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate required fields
      const required = ['strategy', 'code', 'explanation', 'confidence'];
      for (const field of required) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return {
        id: this.generateSolutionId(),
        strategy: parsed.strategy,
        code: parsed.code,
        explanation: parsed.explanation,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        estimatedSuccessRate: parsed.estimatedSuccessRate || 0.5,
        riskLevel: parsed.riskLevel || 'medium',
        requiredPermissions: parsed.requiredPermissions || [],
        timeEstimate: parsed.timeEstimate || 10000,
        metadata: {
          model: 'claude-code-cli',
          timestamp: new Date(),
          reasoning: parsed.reasoning || parsed.explanation
        }
      };
    } catch (error) {
      throw new Error(`Invalid Claude response format: ${error instanceof Error ? error.message : 'Parse error'}`);
    }
  }

  private generateSolutionId(): string {
    return `solution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute Claude's solution safely with sandboxing
   */
  public async executeSolution(
    solution: ClaudeSolution,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Validate solution before execution
      if (solution.confidence < this.config.confidenceThreshold) {
        throw new Error(`Solution confidence ${solution.confidence} below threshold ${this.config.confidenceThreshold}`);
      }

      // Execute with sandboxing if enabled
      let executionResult: ExecutionResult;
      
      if (this.config.enableSandboxing) {
        executionResult = await this.sandbox.executeCode(solution.code, context);
      } else {
        executionResult = await this.executeUnsandboxed(solution.code, context);
      }

      const recoveryResult: RecoveryResult = {
        success: executionResult.success,
        strategyUsed: solution.strategy as RecoveryStrategy,
        retryCount: context.retryCount,
        duration: Date.now() - startTime,
        error: executionResult.error,
        alternativeApproach: solution.explanation,
        metadata: {
          solutionId: solution.id,
          confidence: solution.confidence,
          riskLevel: solution.riskLevel,
          securityViolations: executionResult.securityViolations,
          warnings: executionResult.warnings
        }
      };

      // Update cache statistics
      if (this.config.enableCaching) {
        await this.updateCacheStatistics(solution.id, executionResult.success);
      }

      this.logAuditEvent({
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventType: 'execution',
        solution,
        executionResult,
        duration: Date.now() - startTime,
        metadata: { recoveryResult }
      });

      return recoveryResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
      
      const failureResult: RecoveryResult = {
        success: false,
        strategyUsed: solution.strategy as RecoveryStrategy,
        retryCount: context.retryCount,
        duration: Date.now() - startTime,
        error: errorMessage,
        metadata: {
          solutionId: solution.id,
          executionFailed: true
        }
      };

      this.logAuditEvent({
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventType: 'error',
        solution,
        executionResult: { success: false, error: errorMessage, executionTime: 0, sideEffects: [], warnings: [], securityViolations: [] },
        duration: Date.now() - startTime,
        metadata: { executionError: errorMessage }
      });

      return failureResult;
    }
  }

  private async executeUnsandboxed(code: string, context: RecoveryContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Create execution function
      const asyncFunction = new Function('page', 'context', `
        return (async () => {
          ${code}
        })();
      `);

      const result = await asyncFunction(context.page, context);
      
      return {
        success: true,
        result,
        executionTime: Date.now() - startTime,
        sideEffects: [],
        warnings: ['Executed without sandboxing'],
        securityViolations: []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        executionTime: Date.now() - startTime,
        sideEffects: [],
        warnings: [],
        securityViolations: []
      };
    }
  }

  /**
   * Cache successful solutions
   */
  public async cacheSuccessfulSolution(errorKey: string, solution: ClaudeSolution): Promise<void> {
    if (!this.config.enableCaching) {
      return;
    }

    // Check cache size limit
    if (this.cache.size >= this.config.cacheMaxSize) {
      await this.evictOldestCacheEntry();
    }

    const cacheEntry: CacheEntry = {
      key: errorKey,
      solution,
      successCount: 0,
      failureCount: 0,
      lastUsed: new Date(),
      created: new Date(),
      averageSuccessRate: solution.estimatedSuccessRate
    };

    this.cache.set(errorKey, cacheEntry);
    
    this.logAuditEvent({
      timestamp: new Date(),
      sessionId: this.sessionId,
      eventType: 'cache',
      duration: 0,
      metadata: { action: 'cache_solution', key: errorKey, solutionId: solution.id }
    });
  }

  private async getCachedSolution(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check expiration
    const ageHours = (Date.now() - entry.created.getTime()) / (1000 * 60 * 60);
    if (ageHours > this.config.cacheExpirationHours) {
      this.cache.delete(key);
      return null;
    }

    // Update last used
    entry.lastUsed = new Date();
    
    return entry;
  }

  private async updateCacheStatistics(solutionId: string, success: boolean): Promise<void> {
    for (const entry of this.cache.values()) {
      if (entry.solution.id === solutionId) {
        if (success) {
          entry.successCount++;
        } else {
          entry.failureCount++;
        }
        
        const totalAttempts = entry.successCount + entry.failureCount;
        entry.averageSuccessRate = entry.successCount / totalAttempts;
        break;
      }
    }
  }

  private async evictOldestCacheEntry(): Promise<void> {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed.getTime() < oldestTime) {
        oldestTime = entry.lastUsed.getTime();
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // Utility methods
  private extractErrorMessage(error: Error | any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.toString) return error.toString();
    return 'Unknown error';
  }

  private calculateComplexity(errorContext: ErrorContext): number {
    let complexity = 0;
    
    // Base complexity by category
    const categoryComplexity: Record<ErrorCategory, number> = {
      'timeout': 3,
      'element_not_found': 4,
      'navigation_failed': 5,
      'network_error': 4,
      'interaction_blocked': 6,
      'validation_error': 5,
      'permission_denied': 8,
      'page_load_error': 4,
      'stale_element': 6,
      'javascript_error': 7,
      'unknown': 9
    };
    
    complexity += categoryComplexity[errorContext.category] || 5;
    
    // Additional complexity factors
    if (errorContext.retryCount > 2) complexity += 2;
    if (!errorContext.selector) complexity += 1;
    if (errorContext.stackTrace && errorContext.stackTrace.length > 500) complexity += 1;
    if (errorContext.errorMessage.includes('timeout')) complexity += 1;
    
    return Math.min(complexity, 10);
  }

  private getTriedStrategies(errorContext: ErrorContext): RecoveryStrategy[] {
    // This would typically be tracked by the HybridErrorRecovery system
    // For now, we'll make a reasonable assumption based on retry count
    const commonStrategies: RecoveryStrategy[] = [
      'retry_with_backoff',
      'wait_for_element',
      'alternative_selector',
      'scroll_into_view'
    ];
    
    return commonStrategies.slice(0, errorContext.retryCount);
  }

  private getSystemLoad(): number {
    // Simplified system load calculation
    // In production, this could use actual system metrics
    return Math.random() * 0.3; // Assume low load for now
  }

  private getAvailableTime(): number {
    // This would typically come from the execution context
    // Return a reasonable default
    return this.config.timeoutMs;
  }

  private isCriticalPath(errorContext: ErrorContext): boolean {
    // Determine if this is a critical path operation
    const criticalKeywords = ['login', 'auth', 'payment', 'submit', 'confirm'];
    const stepName = errorContext.stepName.toLowerCase();
    
    return criticalKeywords.some(keyword => stepName.includes(keyword));
  }

  private logAuditEvent(event: AuditLogEntry): void {
    this.auditLog.push(event);
    
    if (this.config.enableDetailedLogging) {
      this.writeAuditLog(event);
    }
  }

  private async writeAuditLog(event: AuditLogEntry): Promise<void> {
    try {
      const logDir = path.dirname(this.config.auditLogPath);
      await fs.mkdir(logDir, { recursive: true });
      
      const logLine = JSON.stringify(event) + '\n';
      await fs.appendFile(this.config.auditLogPath, logLine);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  private setupCacheCleanup(): void {
    // Clean up expired cache entries every hour
    setInterval(() => {
      const now = Date.now();
      const expirationMs = this.config.cacheExpirationHours * 60 * 60 * 1000;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.created.getTime() > expirationMs) {
          this.cache.delete(key);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  private setupAuditCleanup(): void {
    // Clean up old audit logs daily
    setInterval(async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.logRetentionDays);
        
        this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoffDate);
        
        // Also clean up the log file if it exists
        const logPath = this.config.auditLogPath;
        const stats = await fs.stat(logPath);
        
        if (stats.mtime < cutoffDate) {
          await fs.writeFile(logPath, ''); // Clear the file
        }
      } catch (error) {
        // Log file doesn't exist or other error, ignore
      }
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  // Public API methods
  
  /**
   * Get cache statistics
   */
  public getCacheStatistics(): {
    size: number;
    hitRate: number;
    averageAge: number;
    topSolutions: Array<{ strategy: string; successRate: number; uses: number }>;
  } {
    const totalEntries = this.cache.size;
    const entries = Array.from(this.cache.values());
    
    const totalUses = entries.reduce((sum, entry) => sum + entry.successCount + entry.failureCount, 0);
    const totalSuccesses = entries.reduce((sum, entry) => sum + entry.successCount, 0);
    
    const averageAge = entries.reduce((sum, entry) => 
      sum + (Date.now() - entry.created.getTime()), 0) / (totalEntries || 1);
    
    const topSolutions = entries
      .filter(entry => entry.successCount + entry.failureCount > 0)
      .sort((a, b) => b.averageSuccessRate - a.averageSuccessRate)
      .slice(0, 5)
      .map(entry => ({
        strategy: entry.solution.strategy,
        successRate: entry.averageSuccessRate,
        uses: entry.successCount + entry.failureCount
      }));

    return {
      size: totalEntries,
      hitRate: totalUses > 0 ? totalSuccesses / totalUses : 0,
      averageAge: averageAge / (1000 * 60 * 60), // Convert to hours
      topSolutions
    };
  }

  /**
   * Get audit statistics
   */
  public getAuditStatistics(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    averageResponseTime: number;
    successRate: number;
    recentTrends: Array<{ date: string; events: number; successes: number }>;
  } {
    const totalEvents = this.auditLog.length;
    const eventsByType: Record<string, number> = {};
    let totalDuration = 0;
    let executionEvents = 0;
    let successfulExecutions = 0;

    for (const event of this.auditLog) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      totalDuration += event.duration;
      
      if (event.eventType === 'execution') {
        executionEvents++;
        if (event.executionResult?.success) {
          successfulExecutions++;
        }
      }
    }

    // Calculate recent trends (last 7 days)
    const recentTrends: Array<{ date: string; events: number; successes: number }> = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayEvents = this.auditLog.filter(event => 
        event.timestamp.toISOString().split('T')[0] === dateStr
      );
      
      const daySuccesses = dayEvents.filter(event => 
        event.eventType === 'execution' && event.executionResult?.success
      );

      recentTrends.push({
        date: dateStr,
        events: dayEvents.length,
        successes: daySuccesses.length
      });
    }

    return {
      totalEvents,
      eventsByType,
      averageResponseTime: totalEvents > 0 ? totalDuration / totalEvents : 0,
      successRate: executionEvents > 0 ? successfulExecutions / executionEvents : 0,
      recentTrends
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    
    this.logAuditEvent({
      timestamp: new Date(),
      sessionId: this.sessionId,
      eventType: 'cache',
      duration: 0,
      metadata: { action: 'clear_cache' }
    });
  }

  /**
   * Export configuration and statistics for monitoring
   */
  public exportStatus(): {
    config: ClaudeCodeConfig;
    cache: ReturnType<typeof this.getCacheStatistics>;
    audit: ReturnType<typeof this.getAuditStatistics>;
    sessionId: string;
    uptime: number;
  } {
    return {
      config: { ...this.config, apiKey: '***' }, // Hide API key
      cache: this.getCacheStatistics(),
      audit: this.getAuditStatistics(),
      sessionId: this.sessionId,
      uptime: Date.now() - parseInt(this.sessionId.split('-')[2])
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Kill active process if any
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
    }

    // Final audit log
    this.logAuditEvent({
      timestamp: new Date(),
      sessionId: this.sessionId,
      eventType: 'error', // Using error type for cleanup events
      duration: 0,
      metadata: { action: 'cleanup', finalCacheSize: this.cache.size, finalAuditSize: this.auditLog.length }
    });

    // Clear memory
    this.cache.clear();
    this.auditLog.length = 0;
  }
}

// Export singleton instance for easy use
export const claudeCodeIntegration = new ClaudeCodeIntegration();

export default ClaudeCodeIntegration;