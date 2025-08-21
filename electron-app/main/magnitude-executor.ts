import { IntentSpec, IntentStep, FlowResult, FlowMetrics, ActionContext, LogEntry, ExtractionResult, StepExecutionResult, ScreenshotComparison } from '../flows/types';
import { PlaywrightExecutor } from './playwright-executor';
import { FlowStorage } from './flow-storage';
import { FallbackHandler } from './fallback-handler';
import { ScreenshotComparator } from './screenshot-comparator';
import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

export interface MagnitudeExecutionOptions {
  headless?: boolean;
  timeout?: number;
  retries?: number;
  saveScreenshots?: boolean;
  saveFlow?: boolean;
  enableFallback?: boolean;
  screenshotComparison?: boolean;
}

export interface ExecutionProgress {
  stepIndex: number;
  totalSteps: number;
  currentStep: IntentStep;
  status: 'executing' | 'completed' | 'failed' | 'extracting' | 'fallback';
  pathUsed?: 'ai' | 'snippet';
  fallbackOccurred?: boolean;
  screenshot?: string;
  extractedData?: any;
  error?: string;
  timestamp: Date;
}

/**
 * Magnitude Agent configuration and models
 */
interface MagnitudeAgentConfig {
  act: string;      // Model for browser actions
  extract: string;  // Model for data extraction  
  query: string;    // Model for planning
}

/**
 * Internal Magnitude Agent class for handling different AI operations
 */
class MagnitudeAgent {
  private config: MagnitudeAgentConfig;
  private anthropicClient: Anthropic | null = null;
  private claudeCodeQuery: any = null;

  constructor(config: MagnitudeAgentConfig) {
    this.config = config;
  }

  private getAnthropicClient(): Anthropic {
    if (!this.anthropicClient) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      this.anthropicClient = new Anthropic({ apiKey });
    }
    return this.anthropicClient;
  }

  private async getClaudeCodeQuery() {
    if (!this.claudeCodeQuery) {
      const claudeCode = await import('@anthropic-ai/claude-code');
      this.claudeCodeQuery = claudeCode.query;
    }
    return this.claudeCodeQuery;
  }

  /**
   * Execute action reasoning using Sonnet 4
   */
  async act(context: string, action: any): Promise<{ action: string; result: any; success: boolean; error?: string }> {
    try {
      const client = this.getAnthropicClient();
      
      const prompt = `Analyze and reason about the following browser automation action in the given context.

Context:
${context}

Action to perform:
- Type: ${action.action}
- Target: ${action.target}
- Value: ${action.value}
${action.description ? `- Description: ${action.description}` : ''}

Provide reasoning about:
1. How to locate the target element effectively
2. What the action should accomplish
3. Any potential issues or considerations
4. The best approach to execute this action

Return JSON with: {"action": "reasoning and approach", "result": "guidance for execution", "success": true, "confidence": 0-100}`;

      const response = await client.messages.create({
        model: this.config.act,
        max_tokens: 3000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      try {
        return JSON.parse(content.text);
      } catch {
        return {
          action: 'Action reasoning',
          result: content.text,
          success: true
        };
      }
    } catch (error) {
      return {
        action: 'Action reasoning',
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract data using Opus 4.1
   */
  async extract(html: string, extractionGoal: string): Promise<any> {
    const prompt = `Extract data based on this query from the provided HTML content.

Query: ${extractionGoal}

HTML Content:
${html}

Instructions:
- Focus on extracting the specific information requested in the query
- Return structured data in JSON format when possible
- If extracting multiple items, return them as an array
- Include confidence level if uncertain about the extraction
- Return null if the requested information is not found

Response format: Return the extracted data directly as JSON.`;

    try {
      const queryFunction = await this.getClaudeCodeQuery();
      let result = '';
      
      for await (const message of queryFunction({
        prompt,
        options: {
          maxTurns: 1
        }
      })) {
        if (message.type === 'result' && message.subtype === 'success') {
          result = message.result;
        }
      }

      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    } catch (error) {
      throw new Error(`Data extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process queries and planning using Opus 4.1
   */
  async query(queryText: string, context?: string): Promise<any> {
    const prompt = `Answer the following query:

Query: ${queryText}
${context ? `Context: ${context}` : ''}

Return JSON: {"answer": "detailed answer", "sources": ["source1"], "confidence": 0-100}`;

    try {
      const queryFunction = await this.getClaudeCodeQuery();
      let result = '';
      
      for await (const message of queryFunction({
        prompt,
        options: {
          maxTurns: 1
        }
      })) {
        if (message.type === 'result' && message.subtype === 'success') {
          result = message.result;
        }
      }

      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Main class for executing Intent Specs using hybrid model approach
 * - Uses Sonnet 4 for 'act' operations (reasoning about actions)
 * - Uses Opus 4.1 for 'extract' and 'query' operations (data extraction and planning)
 * - Orchestrates Playwright for browser automation
 */
export class MagnitudeExecutor extends EventEmitter {
  private playwrightExecutor: PlaywrightExecutor;
  private flowStorage: FlowStorage;
  private fallbackHandler: FallbackHandler;
  private screenshotComparator: ScreenshotComparator;
  private metrics: FlowMetrics;
  private logs: LogEntry[] = [];
  private currentContext: ActionContext | null = null;
  private magnitudeAgent: MagnitudeAgent;
  private options: MagnitudeExecutionOptions;

  constructor(options: MagnitudeExecutionOptions = {}) {
    super();
    this.options = {
      headless: false,
      timeout: 30000,
      saveScreenshots: true,
      enableFallback: true,
      screenshotComparison: true,
      ...options
    };
    
    this.playwrightExecutor = new PlaywrightExecutor({
      headless: this.options.headless,
      timeout: this.options.timeout,
      saveScreenshots: this.options.saveScreenshots
    });
    this.flowStorage = new FlowStorage();
    this.screenshotComparator = new ScreenshotComparator();
    
    // Initialize Magnitude agent with specified models
    this.magnitudeAgent = new MagnitudeAgent({
      act: 'claude-sonnet-4-20250514',      // Sonnet 4 for browser actions
      extract: 'claude-opus-4-1-20250805',  // Opus 4.1 for data extraction
      query: 'claude-opus-4-1-20250805'     // Opus 4.1 for planning
    });
    
    // Initialize fallback handler with executors
    this.fallbackHandler = new FallbackHandler();
    // this.setupFallbackExecutors(); // TODO: Implement this method if needed
    
    this.metrics = {
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      stepsExecuted: 0,
      stepsTotal: 0,
      retryCount: 0,
      browserInteractions: 0,
      llmCalls: {
        act: 0,
        query: 0
      }
    };
  }

  /**
   * Execute a complete flow from an Intent Spec
   * @param spec The Intent Specification to execute
   * @param variables Variables to substitute in the spec
   * @param options Execution options
   * @returns Promise<FlowResult> with execution results
   */
  async executeFlow(
    spec: IntentSpec, 
    variables: Record<string, string> = {},
    options: MagnitudeExecutionOptions = {}
  ): Promise<FlowResult> {
    try {
      this.log('info', `Starting execution of flow: ${spec.name}`);
      this.metrics.startTime = new Date();
      this.metrics.stepsTotal = spec.steps.length;

      // Initialize browser
      await this.playwrightExecutor.initialize();
      
      // Navigate to start URL with variable substitution
      const startUrl = this.substituteVariables(spec.startUrl, variables);
      await this.playwrightExecutor.navigate(startUrl);
      
      this.updateContext();
      this.log('info', `Navigated to: ${startUrl}`);

      const extractedData: Record<string, any> = {};
      const screenshots: string[] = [];

      // Execute each step
      for (let i = 0; i < spec.steps.length; i++) {
        const step = spec.steps[i];
        this.metrics.stepsExecuted = i + 1;

        try {
          await this.executeStep(step, variables, i, extractedData, screenshots);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.log('error', `Step ${i + 1} failed: ${errorMessage}`, { step, error });
          
          // Attempt retry if configured
          if (options.retries && options.retries > 0) {
            this.log('info', `Retrying step ${i + 1} (attempt ${this.metrics.retryCount + 1})`);
            this.metrics.retryCount++;
            
            try {
              await this.executeStep(step, variables, i, extractedData, screenshots);
            } catch (retryError) {
              throw new Error(`Step ${i + 1} failed after retry: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
            }
          } else {
            throw error;
          }
        }
      }

      // Verify success condition or screenshot comparison
      await this.verifyExecutionSuccess(spec, variables, screenshots);

      this.metrics.endTime = new Date();
      this.metrics.duration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();

      const result: FlowResult = {
        success: true,
        data: extractedData,
        logs: this.logs.map(log => `[${log.level.toUpperCase()}] ${log.message}`),
        metrics: this.metrics,
        screenshots
      };

      // Save flow if requested
      if (options.saveFlow) {
        await this.flowStorage.saveExecutedFlow(spec, variables, result);
      }

      this.log('info', `Flow completed successfully in ${this.metrics.duration}ms`);
      return result;

    } catch (error) {
      this.metrics.endTime = new Date();
      this.metrics.duration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Flow execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        logs: this.logs.map(log => `[${log.level.toUpperCase()}] ${log.message}`),
        metrics: this.metrics
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute a single step with intelligent prefer/fallback strategy
   */
  private async executeStep(
    step: IntentStep,
    variables: Record<string, string>,
    stepIndex: number,
    extractedData: Record<string, any>,
    screenshots: string[]
  ): Promise<void> {
    // Check if this is a new-format step with prefer/fallback
    if (this.isNewFormatStep(step)) {
      return await this.executeStepWithPreferFallback(step, variables, stepIndex, extractedData, screenshots);
    } else {
      // Legacy format - use original execution logic
      return await this.executeStepLegacy(step, variables, stepIndex, extractedData, screenshots);
    }
  }

  /**
   * Check if step uses new Intent Spec format with prefer/fallback
   */
  private isNewFormatStep(step: IntentStep): boolean {
    return !!(step.name && step.prefer && (step.ai_instruction || step.snippet));
  }

  /**
   * Execute step using new prefer/fallback strategy
   */
  private async executeStepWithPreferFallback(
    step: IntentStep,
    variables: Record<string, string>,
    stepIndex: number,
    extractedData: Record<string, any>,
    screenshots: string[]
  ): Promise<void> {
    this.log('info', `Executing step ${stepIndex + 1}: ${step.name} (prefer: ${step.prefer})`);

    // Emit progress
    this.emit('progress', {
      stepIndex,
      totalSteps: this.metrics.stepsTotal,
      currentStep: step,
      status: 'executing',
      timestamp: new Date()
    } as ExecutionProgress);

    try {
      // Use fallback handler for intelligent execution
      const result = await this.fallbackHandler.executeWithFallback(step, variables);
      
      // Emit progress with execution details
      this.emit('progress', {
        stepIndex,
        totalSteps: this.metrics.stepsTotal,
        currentStep: step,
        status: result.fallbackOccurred ? 'fallback' : 'completed',
        pathUsed: result.pathUsed,
        fallbackOccurred: result.fallbackOccurred,
        timestamp: new Date()
      } as ExecutionProgress);

      if (!result.success) {
        throw new Error(result.error || 'Step execution failed');
      }

      this.log('info', `Step ${stepIndex + 1} completed using ${result.pathUsed}${result.fallbackOccurred ? ' (fallback)' : ''}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Step ${stepIndex + 1} failed: ${errorMessage}`);
      
      this.emit('progress', {
        stepIndex,
        totalSteps: this.metrics.stepsTotal,
        currentStep: step,
        status: 'failed',
        error: errorMessage,
        timestamp: new Date()
      } as ExecutionProgress);
      
      throw error;
    }

    // Take screenshot after action if enabled
    if (this.options.saveScreenshots) {
      const screenshot = await this.playwrightExecutor.takeScreenshot(`step-${stepIndex + 1}-${step.name || 'unnamed'}`);
      if (screenshot) {
        screenshots.push(screenshot);
      }
    }

    // Handle data extraction if specified
    if ((step as any).extract) {
      await this.handleDataExtraction(step, stepIndex, extractedData);
    }

    // Update context and handle step timeout
    this.updateContext();
    if (step.timeout) {
      await this.playwrightExecutor.wait(step.timeout);
    }
  }

  /**
   * Execute step using legacy format (backward compatibility)
   */
  private async executeStepLegacy(
    step: IntentStep,
    variables: Record<string, string>,
    stepIndex: number,
    extractedData: Record<string, any>,
    screenshots: string[]
  ): Promise<void> {
    this.log('info', `Executing step ${stepIndex + 1}: ${step.action} on ${step.target}`);

    // Emit progress
    this.emit('progress', {
      stepIndex,
      totalSteps: this.metrics.stepsTotal,
      currentStep: step,
      status: 'executing',
      timestamp: new Date()
    } as ExecutionProgress);

    // 1. Use Sonnet 4 for reasoning about the action
    this.log('debug', 'Using Sonnet 4 for action reasoning...');
    const context = await this.getCurrentPageContext();
    const actionReasoning = await this.magnitudeAgent.act(context, step);
    this.metrics.llmCalls.act++;

    this.log('debug', `Action reasoning: ${actionReasoning.action}`);

    // 2. Substitute variables in step
    const processedStep = this.processStepVariables(step, variables);

    // 3. Execute the action with Playwright
    const actionResult = await this.playwrightExecutor.executeAction(processedStep);
    this.metrics.browserInteractions++;

    if (!actionResult.success) {
      throw new Error(`Action execution failed: ${actionResult.error}`);
    }

    // 4. Take screenshot after action
    if (this.playwrightExecutor.config.saveScreenshots) {
      const screenshot = await this.playwrightExecutor.takeScreenshot(`step-${stepIndex + 1}`);
      if (screenshot) {
        screenshots.push(screenshot);
      }
    }

    // 5. Handle data extraction if specified
    if ((step as any).extract) {
      await this.handleDataExtraction(step, stepIndex, extractedData);
    } else {
      this.emit('progress', {
        stepIndex,
        totalSteps: this.metrics.stepsTotal,
        currentStep: step,
        status: 'completed',
        timestamp: new Date()
      } as ExecutionProgress);
    }

    // Update current context
    this.updateContext();

    // Add delay if specified
    if (step.timeout) {
      await this.playwrightExecutor.wait(step.timeout);
    }
  }

  /**
   * Verify success condition using current page state
   */
  private async verifySuccess(
    successCheck: string,
    variables: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const processedCheck = this.substituteVariables(successCheck, variables);
      const pageContent = await this.playwrightExecutor.getPageContent();
      
      // Use Opus 4.1 for verification
      const verificationResult = await this.magnitudeAgent.query(
        `Verify if this condition is met: ${processedCheck}. Return {"success": true/false, "reason": "explanation"}`,
        pageContent.html
      );
      this.metrics.llmCalls.query++;

      if (typeof verificationResult === 'object' && verificationResult.success !== undefined) {
        return {
          success: verificationResult.success,
          error: verificationResult.success ? undefined : verificationResult.reason
        };
      }

      // Fallback to simple text search
      const textContent = pageContent.text.toLowerCase();
      const checkContent = processedCheck.toLowerCase();
      const success = textContent.includes(checkContent);

      return {
        success,
        error: success ? undefined : `Success condition "${processedCheck}" not found on page`
      };
    } catch (error) {
      return {
        success: false,
        error: `Success verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get current page context for LLM reasoning
   */
  private async getCurrentPageContext(): Promise<string> {
    const pageInfo = await this.playwrightExecutor.getPageInfo();
    const context = {
      url: pageInfo.url,
      title: pageInfo.title,
      viewport: pageInfo.viewport,
      timestamp: new Date().toISOString()
    };

    return `Current page context:
URL: ${context.url}
Title: ${context.title}
Viewport: ${context.viewport.width}x${context.viewport.height}
Timestamp: ${context.timestamp}`;
  }

  /**
   * Update action context
   */
  private async updateContext(): Promise<void> {
    const pageInfo = await this.playwrightExecutor.getPageInfo();
    this.currentContext = {
      pageTitle: pageInfo.title,
      pageUrl: pageInfo.url,
      viewport: pageInfo.viewport,
      timestamp: new Date(),
      stepNumber: this.metrics.stepsExecuted
    };
  }

  /**
   * Substitute variables in strings
   */
  private substituteVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    return result;
  }

  /**
   * Process step variables
   */
  private processStepVariables(step: IntentStep, variables: Record<string, string>): IntentStep {
    return {
      ...step,
      target: this.substituteVariables(step.target, variables),
      value: this.substituteVariables(step.value, variables)
    };
  }

  /**
   * Log message with context
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: any): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      step: this.metrics.stepsExecuted
    };

    this.logs.push(logEntry);
    console.log(`[${level.toUpperCase()}] ${message}`, context || '');
  }

  /**
   * Get execution logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get current metrics
   */
  getMetrics(): FlowMetrics {
    return { ...this.metrics };
  }

  /**
   * Handle data extraction for a step
   */
  private async handleDataExtraction(
    step: IntentStep,
    stepIndex: number,
    extractedData: Record<string, any>
  ): Promise<void> {
    this.log('debug', 'Using Opus 4.1 for data extraction...');
    
    this.emit('progress', {
      stepIndex,
      totalSteps: this.metrics.stepsTotal,
      currentStep: step,
      status: 'extracting',
      timestamp: new Date()
    } as ExecutionProgress);

    const pageContent = await this.playwrightExecutor.getPageContent();
    const extractedResult = await this.magnitudeAgent.extract(pageContent.html, (step as any).extract);
    this.metrics.llmCalls.query++;

    extractedData[`step_${stepIndex + 1}`] = extractedResult;
    this.log('info', `Data extracted from step ${stepIndex + 1}`);

    this.emit('progress', {
      stepIndex,
      totalSteps: this.metrics.stepsTotal,
      currentStep: step,
      status: 'completed',
      extractedData: extractedResult,
      timestamp: new Date()
    } as ExecutionProgress);
  }

  /**
   * Verify execution success using success condition or screenshot comparison
   */
  private async verifyExecutionSuccess(
    spec: IntentSpec,
    variables: Record<string, string>,
    screenshots: string[]
  ): Promise<void> {
    // Legacy success check
    if (spec.successCheck || (spec as any).success_check) {
      const successCheck = spec.successCheck || (spec as any).success_check;
      const successResult = await this.verifySuccess(successCheck, variables);
      if (!successResult.success) {
        throw new Error(`Success verification failed: ${successResult.error}`);
      }
    }

    // Screenshot comparison if enabled and available
    if (this.options.screenshotComparison && (spec as any).success_screenshot && screenshots.length > 0) {
      const finalScreenshot = screenshots[screenshots.length - 1];
      try {
        const comparison = await this.screenshotComparator.compareScreenshots(
          finalScreenshot,
          (spec as any).success_screenshot
        );

        this.log('info', `Screenshot comparison: ${comparison.match ? 'MATCH' : 'NO MATCH'} (${comparison.similarity}% similarity)`);
        
        if (!comparison.match && comparison.similarity < 80) {
          this.log('warn', 'Screenshot comparison indicates potential execution failure');
          
          // Add suggestions to logs
          comparison.suggestions.forEach(suggestion => {
            this.log('info', `Suggestion: ${suggestion}`);
          });
          
          // Don't fail execution for screenshot mismatch, but log concerns
          this.log('warn', 'Consider reviewing the execution flow - visual state differs from expected');
        }
      } catch (error) {
        this.log('warn', `Screenshot comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Check if a step involves password or sensitive data
   */
  private isPasswordField(step: IntentStep): boolean {
    const sensitiveFields = [
      'password', 'pass', 'pwd', 'secret', 'key', 'token',
      'credential', 'auth', 'pin', 'ssn', 'social',
      'credit', 'card', 'cvv', 'ccv', 'security'
    ];
    
    const checkField = (field: string | undefined): boolean => {
      if (!field) return false;
      const lowerField = field.toLowerCase();
      return sensitiveFields.some(sensitive => lowerField.includes(sensitive));
    };

    return checkField(step.target) || 
           checkField(step.selector) || 
           checkField(step.name) ||
           checkField(step.description) ||
           (step.action === 'type' && checkField(step.value));
  }

  /**
   * Get execution report for this flow
   */
  getExecutionReport(): {
    aiUsageCount: number;
    snippetUsageCount: number;
    fallbackCount: number;
    totalSteps: number;
    successRate: number;
  } {
    return {
      aiUsageCount: this.metrics.llmCalls.act,
      snippetUsageCount: this.metrics.browserInteractions,
      fallbackCount: this.metrics.retryCount,
      totalSteps: this.metrics.stepsTotal,
      successRate: this.metrics.stepsExecuted / this.metrics.stepsTotal
    };
  }

  /**
   * Enhanced cleanup with fallback handler cleanup
   */
  private async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.playwrightExecutor?.cleanup(),
        // Add any fallback handler cleanup if needed
      ]);
    } catch (error) {
      this.log('error', `Cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop execution (for external control)
   */
  async stop(): Promise<void> {
    this.log('info', 'Stopping execution...');
    await this.cleanup();
  }
}