import { Page } from 'playwright';
import { getMagnitudeAgent } from './llm';

/**
 * Enhanced Error Analyzer
 * Provides intelligent error analysis and recovery strategies
 */

export interface ErrorAnalysis {
  errorType: 'selector' | 'network' | 'timeout' | 'validation' | 'permission' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  rootCause: string;
  suggestedActions: Array<{
    action: 'retry' | 'skip' | 'use_ai' | 'wait' | 'refresh' | 'navigate_back' | 'alternative_selector';
    description: string;
    confidence: number;
    implementation?: string;
  }>;
  pageContext: {
    url: string;
    title: string;
    hasDialog?: boolean;
    hasErrors?: boolean;
    networkStatus?: string;
  };
  alternativeApproaches?: Array<{
    approach: string;
    snippet: string;
    confidence: number;
  }>;
}

export class ErrorAnalyzer {
  private magnitudeAgent: any;
  private errorHistory: Array<{
    timestamp: number;
    step: string;
    error: string;
    recovery: string;
    success: boolean;
  }> = [];

  constructor() {
    // Magnitude agent will be initialized when needed
  }

  /**
   * Analyze error and provide recovery strategies
   */
  async analyzeError(
    error: Error | any,
    step: any,
    page: Page,
    retryCount: number = 0
  ): Promise<ErrorAnalysis> {
    console.log(`Analyzing error for step: ${step.name}`);
    
    try {
      // Classify the error type
      const errorType = this.classifyError(error);
      
      // Get page context
      const pageContext = await this.getPageContext(page);
      
      // Determine severity
      const severity = this.determineSeverity(errorType, retryCount, step);
      
      // Check if recoverable
      const isRecoverable = this.isErrorRecoverable(errorType, severity, retryCount);
      
      // Identify root cause
      const rootCause = await this.identifyRootCause(error, step, page, pageContext);
      
      // Generate suggested actions
      const suggestedActions = await this.generateSuggestedActions(
        errorType,
        rootCause,
        step,
        page,
        retryCount
      );
      
      // Generate alternative approaches using AI
      const alternativeApproaches = isRecoverable 
        ? await this.generateAlternativeApproaches(step, page, rootCause)
        : undefined;
      
      // Log to error history for pattern learning
      this.logErrorToHistory(step.name, error.message, suggestedActions[0]?.action || 'none', false);
      
      return {
        errorType,
        severity,
        isRecoverable,
        rootCause,
        suggestedActions,
        pageContext,
        alternativeApproaches
      };
    } catch (analysisError) {
      console.error('Error during error analysis:', analysisError);
      
      // Return safe defaults
      return {
        errorType: 'unknown',
        severity: 'high',
        isRecoverable: false,
        rootCause: 'Unable to analyze error',
        suggestedActions: [{
          action: 'skip',
          description: 'Skip this step due to analysis failure',
          confidence: 0.5
        }],
        pageContext: {
          url: await page.url(),
          title: await page.title()
        }
      };
    }
  }

  /**
   * Classify error type
   */
  private classifyError(error: Error | any): ErrorAnalysis['errorType'] {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorName = error?.name?.toLowerCase() || '';

    if (errorMessage.includes('selector') || 
        errorMessage.includes('element not found') ||
        errorMessage.includes('no element matches')) {
      return 'selector';
    }

    if (errorMessage.includes('net::') || 
        errorMessage.includes('network') ||
        errorMessage.includes('fetch')) {
      return 'network';
    }

    if (errorMessage.includes('timeout') || 
        errorMessage.includes('timed out')) {
      return 'timeout';
    }

    if (errorMessage.includes('validation') || 
        errorMessage.includes('invalid')) {
      return 'validation';
    }

    if (errorMessage.includes('permission') || 
        errorMessage.includes('denied') ||
        errorMessage.includes('unauthorized')) {
      return 'permission';
    }

    return 'unknown';
  }

  /**
   * Get page context for error analysis
   */
  private async getPageContext(page: Page): Promise<ErrorAnalysis['pageContext']> {
    try {
      const [url, title, hasDialog, pageErrors, networkFailures] = await Promise.all([
        page.url(),
        page.title(),
        page.evaluate(() => !!document.querySelector('[role="dialog"], .modal, .popup')),
        page.evaluate(() => {
          const errorElements = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
          return errorElements.length > 0;
        }),
        // Check for network issues
        page.evaluate(() => !navigator.onLine ? 'offline' : 'online')
      ]);

      return {
        url,
        title,
        hasDialog,
        hasErrors: pageErrors,
        networkStatus: networkFailures
      };
    } catch {
      return {
        url: 'unknown',
        title: 'unknown'
      };
    }
  }

  /**
   * Determine error severity
   */
  private determineSeverity(
    errorType: ErrorAnalysis['errorType'],
    retryCount: number,
    step: any
  ): ErrorAnalysis['severity'] {
    // Critical if login/auth step fails
    if (step.name?.toLowerCase().includes('login') || 
        step.name?.toLowerCase().includes('auth')) {
      return 'critical';
    }

    // High severity for network errors
    if (errorType === 'network') {
      return 'high';
    }

    // Increase severity with retry count
    if (retryCount >= 3) {
      return 'high';
    }

    // Low severity for optional steps
    if (step.continueOnFailure) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Check if error is recoverable
   */
  private isErrorRecoverable(
    errorType: ErrorAnalysis['errorType'],
    severity: ErrorAnalysis['severity'],
    retryCount: number
  ): boolean {
    if (severity === 'critical') {
      return false;
    }

    if (retryCount >= 5) {
      return false;
    }

    // Most errors are recoverable with the right strategy
    return errorType !== 'permission';
  }

  /**
   * Identify root cause using page analysis
   */
  private async identifyRootCause(
    error: Error,
    step: any,
    page: Page,
    pageContext: ErrorAnalysis['pageContext']
  ): Promise<string> {
    // Use AI to analyze the page and error
    try {
      if (!this.magnitudeAgent) {
        this.magnitudeAgent = await getMagnitudeAgent();
      }

      const analysis = await this.magnitudeAgent.query({
        page,
        prompt: `Analyze why this step failed: "${step.name}".
                 Error: ${error.message}.
                 Current URL: ${pageContext.url}.
                 Identify the root cause in one sentence.`
      });

      return analysis || error.message;
    } catch {
      // Fallback to error message
      return error.message;
    }
  }

  /**
   * Generate suggested recovery actions
   */
  private async generateSuggestedActions(
    errorType: ErrorAnalysis['errorType'],
    rootCause: string,
    step: any,
    page: Page,
    retryCount: number
  ): Promise<ErrorAnalysis['suggestedActions']> {
    const actions: ErrorAnalysis['suggestedActions'] = [];

    switch (errorType) {
      case 'selector':
        // Try AI to find element
        actions.push({
          action: 'use_ai',
          description: 'Use AI to locate the element with natural language',
          confidence: 0.85,
          implementation: `magnitude.act("${step.name}")`
        });
        
        // Try alternative selector
        actions.push({
          action: 'alternative_selector',
          description: 'Search for alternative selectors',
          confidence: 0.7
        });
        
        // Skip if optional
        if (step.continueOnFailure) {
          actions.push({
            action: 'skip',
            description: 'Skip this optional step',
            confidence: 0.9
          });
        }
        break;

      case 'timeout':
        // Wait and retry
        if (retryCount < 2) {
          actions.push({
            action: 'wait',
            description: 'Wait 5 seconds and retry',
            confidence: 0.7,
            implementation: 'await page.waitForTimeout(5000)'
          });
        }
        
        // Refresh page
        actions.push({
          action: 'refresh',
          description: 'Refresh the page and retry',
          confidence: 0.6,
          implementation: 'await page.reload()'
        });
        
        // Use AI
        actions.push({
          action: 'use_ai',
          description: 'Use AI to handle dynamic content',
          confidence: 0.8
        });
        break;

      case 'network':
        // Retry with longer timeout
        actions.push({
          action: 'retry',
          description: 'Retry with extended timeout',
          confidence: 0.8,
          implementation: 'await page.setDefaultTimeout(30000)'
        });
        
        // Navigate back and retry
        actions.push({
          action: 'navigate_back',
          description: 'Go back and try alternative path',
          confidence: 0.5,
          implementation: 'await page.goBack()'
        });
        break;

      case 'validation':
        // Use AI to understand validation requirements
        actions.push({
          action: 'use_ai',
          description: 'Use AI to understand and fix validation errors',
          confidence: 0.9
        });
        
        // Skip if optional
        actions.push({
          action: 'skip',
          description: 'Skip validation step',
          confidence: 0.4
        });
        break;

      default:
        // Generic AI fallback
        actions.push({
          action: 'use_ai',
          description: 'Use AI for intelligent recovery',
          confidence: 0.7
        });
        
        // Skip as last resort
        actions.push({
          action: 'skip',
          description: 'Skip this problematic step',
          confidence: 0.5
        });
    }

    // Sort by confidence
    return actions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate alternative approaches using AI
   */
  private async generateAlternativeApproaches(
    step: any,
    page: Page,
    rootCause: string
  ): Promise<ErrorAnalysis['alternativeApproaches']> {
    try {
      if (!this.magnitudeAgent) {
        this.magnitudeAgent = await getMagnitudeAgent();
      }

      // Query AI for alternatives
      const alternatives = await this.magnitudeAgent.query({
        page,
        prompt: `The step "${step.name}" failed with: ${rootCause}.
                 Suggest 3 alternative Playwright code snippets to achieve the same goal.
                 Return as JSON array with 'approach' and 'snippet' fields.`
      });

      if (Array.isArray(alternatives)) {
        return alternatives.map((alt: any, index: number) => ({
          approach: alt.approach || `Alternative ${index + 1}`,
          snippet: alt.snippet || '',
          confidence: 0.9 - (index * 0.2)
        }));
      }

      return [];
    } catch (error) {
      console.error('Error generating alternatives:', error);
      return [];
    }
  }

  /**
   * Log error to history for pattern learning
   */
  private logErrorToHistory(
    step: string,
    error: string,
    recovery: string,
    success: boolean
  ): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      step,
      error,
      recovery,
      success
    });

    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
  }

  /**
   * Get successful recovery patterns from history
   */
  getSuccessfulRecoveryPatterns(): Array<{ pattern: string; successRate: number }> {
    const patterns = new Map<string, { success: number; total: number }>();

    for (const entry of this.errorHistory) {
      const key = `${entry.error.substring(0, 30)}_${entry.recovery}`;
      if (!patterns.has(key)) {
        patterns.set(key, { success: 0, total: 0 });
      }
      const stats = patterns.get(key)!;
      stats.total++;
      if (entry.success) {
        stats.success++;
      }
    }

    return Array.from(patterns.entries())
      .map(([pattern, stats]) => ({
        pattern,
        successRate: stats.success / stats.total
      }))
      .filter(p => p.successRate > 0.5)
      .sort((a, b) => b.successRate - a.successRate);
  }
}