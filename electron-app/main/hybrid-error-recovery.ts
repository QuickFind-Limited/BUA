/**
 * Hybrid Error Recovery System
 * 
 * Provides comprehensive error recovery strategies for browser automation errors.
 * Combines pattern matching, built-in recovery strategies, and statistics tracking
 * to handle common automation failures intelligently.
 */

import { Page } from 'playwright';
import { FlowError, ActionContext } from '../flows/types';

// Error Category Definitions
export type ErrorCategory = 
  | 'timeout'
  | 'element_not_found' 
  | 'navigation_failed'
  | 'network_error'
  | 'interaction_blocked'
  | 'validation_error'
  | 'permission_denied'
  | 'page_load_error'
  | 'stale_element'
  | 'javascript_error'
  | 'unknown';

// Recovery Strategy Types
export type RecoveryStrategy = 
  | 'retry_with_backoff'
  | 'alternative_selector'
  | 'wait_for_element'
  | 'scroll_into_view'
  | 'force_click'
  | 'page_refresh'
  | 'wait_for_network'
  | 'clear_and_retry'
  | 'use_javascript_click'
  | 'wait_for_stable'
  | 'bypass_validation'
  | 'skip_step';

// Error Pattern Definition
export interface ErrorPattern {
  id: string;
  name: string;
  patterns: string[]; // Regex patterns to match error messages
  category: ErrorCategory;
  confidence: number;
  commonCauses: string[];
  quickFix?: RecoveryStrategy;
}

// Recovery Context
export interface RecoveryContext {
  page: Page;
  stepName: string;
  selector?: string;
  value?: string;
  retryCount: number;
  maxRetries: number;
  timeout?: number;
  actionContext?: ActionContext;
  variables?: Record<string, string>;
}

// Recovery Result
export interface RecoveryResult {
  success: boolean;
  strategyUsed: RecoveryStrategy;
  retryCount: number;
  duration: number;
  error?: string;
  alternativeApproach?: string;
  metadata?: Record<string, any>;
}

// Error Analysis Result
export interface ErrorAnalysisResult {
  category: ErrorCategory;
  confidence: number;
  isKnownIssue: boolean;
  patternMatched?: ErrorPattern;
  suggestedStrategies: Array<{
    strategy: RecoveryStrategy;
    priority: number;
    description: string;
    estimatedSuccessRate: number;
  }>;
  quickFix?: RecoveryStrategy;
}

// Recovery Statistics
export interface RecoveryStatistics {
  strategy: RecoveryStrategy;
  category: ErrorCategory;
  totalAttempts: number;
  successCount: number;
  successRate: number;
  averageDuration: number;
  lastUsed: Date;
  effectivenessScore: number;
}

/**
 * Main Hybrid Error Recovery Class
 */
export class HybridErrorRecovery {
  private knownPatterns: ErrorPattern[] = [];
  private recoveryStats: Map<string, RecoveryStatistics> = new Map();
  private recentErrors: Array<{
    timestamp: Date;
    error: string;
    category: ErrorCategory;
    recovery: RecoveryStrategy;
    success: boolean;
  }> = [];

  constructor() {
    this.initializeKnownPatterns();
  }

  /**
   * Initialize known error patterns with their recovery strategies
   */
  private initializeKnownPatterns(): void {
    this.knownPatterns = [
      // Timeout Errors
      {
        id: 'playwright_timeout',
        name: 'Playwright Timeout',
        patterns: [
          'timeout.*exceeded',
          'waiting for.*timed out',
          'locator.*timeout',
          'page\.waitFor.*timeout'
        ],
        category: 'timeout',
        confidence: 0.95,
        commonCauses: ['Slow page load', 'Element not appearing', 'Network delay'],
        quickFix: 'wait_for_element'
      },
      {
        id: 'network_timeout',
        name: 'Network Timeout',
        patterns: [
          'net::ERR_TIMED_OUT',
          'net::ERR_CONNECTION_TIMED_OUT',
          'request timeout',
          'fetch.*timeout'
        ],
        category: 'network_error',
        confidence: 0.9,
        commonCauses: ['Slow network', 'Server overload', 'DNS issues'],
        quickFix: 'wait_for_network'
      },

      // Element Not Found Errors
      {
        id: 'element_not_found',
        name: 'Element Not Found',
        patterns: [
          'no element matches',
          'element not found',
          'locator.*not found',
          'unable to locate element',
          'querySelector.*null'
        ],
        category: 'element_not_found',
        confidence: 0.95,
        commonCauses: ['Dynamic content', 'Changed selectors', 'Page not loaded'],
        quickFix: 'alternative_selector'
      },
      {
        id: 'stale_element',
        name: 'Stale Element Reference',
        patterns: [
          'stale element reference',
          'element is not attached',
          'node is detached',
          'element.*no longer attached'
        ],
        category: 'stale_element',
        confidence: 0.9,
        commonCauses: ['DOM refresh', 'Dynamic content update', 'Page navigation'],
        quickFix: 'wait_for_stable'
      },

      // Navigation Errors
      {
        id: 'navigation_failed',
        name: 'Navigation Failed',
        patterns: [
          'navigation.*failed',
          'net::ERR_NAME_NOT_RESOLVED',
          'net::ERR_CONNECTION_REFUSED',
          'page.*navigate.*failed'
        ],
        category: 'navigation_failed',
        confidence: 0.9,
        commonCauses: ['Invalid URL', 'Network issues', 'Server down'],
        quickFix: 'retry_with_backoff'
      },

      // Interaction Blocked Errors
      {
        id: 'element_not_interactable',
        name: 'Element Not Interactable',
        patterns: [
          'element not interactable',
          'element.*not clickable',
          'element.*obscured',
          'element.*disabled',
          'pointer-events.*none'
        ],
        category: 'interaction_blocked',
        confidence: 0.85,
        commonCauses: ['Overlay blocking', 'Element disabled', 'CSS issues'],
        quickFix: 'scroll_into_view'
      },

      // JavaScript Errors
      {
        id: 'javascript_error',
        name: 'JavaScript Error',
        patterns: [
          'uncaught.*error',
          'javascript.*error',
          'console.*error',
          'TypeError.*undefined',
          'ReferenceError'
        ],
        category: 'javascript_error',
        confidence: 0.8,
        commonCauses: ['Script errors', 'Missing dependencies', 'Timing issues'],
        quickFix: 'wait_for_stable'
      },

      // Validation Errors
      {
        id: 'form_validation',
        name: 'Form Validation Error',
        patterns: [
          'validation.*failed',
          'invalid.*input',
          'required.*field',
          'form.*error',
          'constraint validation'
        ],
        category: 'validation_error',
        confidence: 0.8,
        commonCauses: ['Invalid input format', 'Missing required fields', 'Business rules'],
        quickFix: 'clear_and_retry'
      },

      // Permission Errors
      {
        id: 'permission_denied',
        name: 'Permission Denied',
        patterns: [
          'permission denied',
          'access denied',
          'unauthorized',
          '403.*forbidden',
          'authentication.*required'
        ],
        category: 'permission_denied',
        confidence: 0.9,
        commonCauses: ['Authentication required', 'Insufficient permissions', 'Session expired'],
        quickFix: 'skip_step'
      }
    ];
  }

  /**
   * Categorize error based on message and context
   */
  public categorizeError(error: Error | any): ErrorAnalysisResult {
    const errorMessage = this.extractErrorMessage(error);
    
    // Check against known patterns
    for (const pattern of this.knownPatterns) {
      for (const regex of pattern.patterns) {
        if (new RegExp(regex, 'i').test(errorMessage)) {
          const suggestedStrategies = this.getStrategiesForCategory(pattern.category);
          
          return {
            category: pattern.category,
            confidence: pattern.confidence,
            isKnownIssue: true,
            patternMatched: pattern,
            suggestedStrategies,
            quickFix: pattern.quickFix
          };
        }
      }
    }

    // Fallback categorization based on error type/name
    const category = this.fallbackCategorization(error, errorMessage);
    const suggestedStrategies = this.getStrategiesForCategory(category);

    return {
      category,
      confidence: 0.5,
      isKnownIssue: false,
      suggestedStrategies
    };
  }

  /**
   * Check if error is a known issue
   */
  public isKnownIssue(error: Error | any): boolean {
    const errorMessage = this.extractErrorMessage(error);
    
    return this.knownPatterns.some(pattern =>
      pattern.patterns.some(regex =>
        new RegExp(regex, 'i').test(errorMessage)
      )
    );
  }

  /**
   * Apply known fix for recognized error patterns
   */
  public async applyKnownFix(error: Error | any, context: RecoveryContext): Promise<RecoveryResult> {
    const analysis = this.categorizeError(error);
    
    if (!analysis.isKnownIssue || !analysis.quickFix) {
      throw new Error('No known fix available for this error');
    }

    const startTime = Date.now();
    const result = await this.executeRecoveryStrategy(analysis.quickFix, context);
    const duration = Date.now() - startTime;

    // Update statistics
    this.updateRecoveryStats(analysis.quickFix, analysis.category, result.success, duration);

    return {
      ...result,
      duration,
      strategyUsed: analysis.quickFix
    };
  }

  /**
   * Try built-in recovery strategies in order of effectiveness
   */
  public async tryBuiltInStrategies(error: Error | any, context: RecoveryContext): Promise<RecoveryResult> {
    const analysis = this.categorizeError(error);
    const startTime = Date.now();
    
    // Sort strategies by effectiveness for this error category
    const sortedStrategies = analysis.suggestedStrategies
      .sort((a, b) => {
        const aStats = this.getStrategyStats(a.strategy, analysis.category);
        const bStats = this.getStrategyStats(b.strategy, analysis.category);
        return (bStats?.effectivenessScore || a.estimatedSuccessRate) - 
               (aStats?.effectivenessScore || b.estimatedSuccessRate);
      });

    // Try each strategy in order
    for (const strategyInfo of sortedStrategies) {
      try {
        console.log(`Attempting recovery strategy: ${strategyInfo.strategy}`);
        
        const result = await this.executeRecoveryStrategy(strategyInfo.strategy, context);
        const duration = Date.now() - startTime;
        
        // Update statistics
        this.updateRecoveryStats(strategyInfo.strategy, analysis.category, result.success, duration);
        
        if (result.success) {
          // Log successful recovery
          this.logRecoveryAttempt(error, analysis.category, strategyInfo.strategy, true);
          
          return {
            ...result,
            duration,
            strategyUsed: strategyInfo.strategy
          };
        }
      } catch (strategyError) {
        console.warn(`Recovery strategy ${strategyInfo.strategy} failed:`, strategyError.message);
        
        // Update statistics for failed attempt
        const duration = Date.now() - startTime;
        this.updateRecoveryStats(strategyInfo.strategy, analysis.category, false, duration);
      }
    }

    // All strategies failed
    this.logRecoveryAttempt(error, analysis.category, 'skip_step', false);
    
    return {
      success: false,
      strategyUsed: 'skip_step',
      retryCount: context.retryCount,
      duration: Date.now() - startTime,
      error: 'All recovery strategies failed'
    };
  }

  /**
   * Execute a specific recovery strategy
   */
  private async executeRecoveryStrategy(
    strategy: RecoveryStrategy, 
    context: RecoveryContext
  ): Promise<Omit<RecoveryResult, 'duration' | 'strategyUsed'>> {
    const { page, selector, value, timeout = 10000 } = context;

    try {
      switch (strategy) {
        case 'retry_with_backoff':
          await this.retryWithBackoff(context);
          return { success: true, retryCount: context.retryCount };

        case 'alternative_selector':
          const altSelector = await this.findAlternativeSelector(page, selector);
          return { 
            success: !!altSelector, 
            retryCount: context.retryCount,
            alternativeApproach: altSelector 
          };

        case 'wait_for_element':
          if (selector) {
            await page.waitForSelector(selector, { timeout, state: 'visible' });
          } else {
            await page.waitForTimeout(2000);
          }
          return { success: true, retryCount: context.retryCount };

        case 'scroll_into_view':
          if (selector) {
            await page.locator(selector).scrollIntoViewIfNeeded();
            await page.waitForTimeout(500); // Allow scrolling to complete
          }
          return { success: true, retryCount: context.retryCount };

        case 'force_click':
          if (selector) {
            await page.locator(selector).click({ force: true });
          }
          return { success: true, retryCount: context.retryCount };

        case 'page_refresh':
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
          return { success: true, retryCount: context.retryCount };

        case 'wait_for_network':
          await page.waitForLoadState('networkidle', { timeout });
          return { success: true, retryCount: context.retryCount };

        case 'clear_and_retry':
          if (selector) {
            await page.locator(selector).clear();
            await page.waitForTimeout(500);
            if (value) {
              await page.locator(selector).fill(value);
            }
          }
          return { success: true, retryCount: context.retryCount };

        case 'use_javascript_click':
          if (selector) {
            await page.evaluate((sel) => {
              const element = document.querySelector(sel);
              if (element) {
                (element as HTMLElement).click();
              }
            }, selector);
          }
          return { success: true, retryCount: context.retryCount };

        case 'wait_for_stable':
          // Wait for DOM to stabilize
          await page.waitForFunction(() => document.readyState === 'complete');
          await page.waitForTimeout(1000);
          return { success: true, retryCount: context.retryCount };

        case 'bypass_validation':
          // Attempt to bypass client-side validation
          if (selector && value !== undefined) {
            await page.evaluate(([sel, val]: [string, string]) => {
              const element = document.querySelector(sel) as HTMLInputElement;
              if (element) {
                element.value = val;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, [selector, value]);
          }
          return { success: true, retryCount: context.retryCount };

        case 'skip_step':
          return { 
            success: true, 
            retryCount: context.retryCount,
            metadata: { skipped: true }
          };

        default:
          throw new Error(`Unknown recovery strategy: ${strategy}`);
      }
    } catch (error) {
      return { 
        success: false, 
        retryCount: context.retryCount,
        error: error.message 
      };
    }
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff(context: RecoveryContext): Promise<void> {
    const delay = Math.min(1000 * Math.pow(2, context.retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Find alternative selectors for an element
   */
  private async findAlternativeSelector(page: Page, originalSelector?: string): Promise<string | null> {
    if (!originalSelector) return null;

    try {
      // Generate alternative selectors
      const alternatives = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [];

        const alternatives: string[] = [];
        
        // By ID
        if (element.id) {
          alternatives.push(`#${element.id}`);
        }
        
        // By class
        if (element.className) {
          const classes = element.className.split(' ').filter(c => c.trim());
          if (classes.length > 0) {
            alternatives.push(`.${classes.join('.')}`);
            alternatives.push(`.${classes[0]}`); // First class only
          }
        }
        
        // By tag and text
        if (element.textContent && element.textContent.trim().length < 50) {
          alternatives.push(`${element.tagName.toLowerCase()}:has-text("${element.textContent.trim()}")`);
        }
        
        // By attributes
        Array.from(element.attributes).forEach(attr => {
          if (['data-testid', 'data-test', 'name', 'type', 'role'].includes(attr.name)) {
            alternatives.push(`[${attr.name}="${attr.value}"]`);
          }
        });
        
        // By position (nth-child)
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element) + 1;
          alternatives.push(`${parent.tagName.toLowerCase()} > ${element.tagName.toLowerCase()}:nth-child(${index})`);
        }

        return alternatives;
      }, originalSelector);

      // Test each alternative
      for (const altSelector of alternatives) {
        try {
          await page.locator(altSelector).first().waitFor({ timeout: 2000 });
          return altSelector;
        } catch {
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get recovery strategies for a specific error category
   */
  private getStrategiesForCategory(category: ErrorCategory): Array<{
    strategy: RecoveryStrategy;
    priority: number;
    description: string;
    estimatedSuccessRate: number;
  }> {
    const strategyMap: Record<ErrorCategory, Array<{
      strategy: RecoveryStrategy;
      priority: number;
      description: string;
      estimatedSuccessRate: number;
    }>> = {
      timeout: [
        { strategy: 'wait_for_element', priority: 1, description: 'Wait for element to appear', estimatedSuccessRate: 0.8 },
        { strategy: 'wait_for_stable', priority: 2, description: 'Wait for page to stabilize', estimatedSuccessRate: 0.7 },
        { strategy: 'page_refresh', priority: 3, description: 'Refresh page and retry', estimatedSuccessRate: 0.6 },
        { strategy: 'retry_with_backoff', priority: 4, description: 'Retry with exponential backoff', estimatedSuccessRate: 0.5 }
      ],
      element_not_found: [
        { strategy: 'alternative_selector', priority: 1, description: 'Try alternative selectors', estimatedSuccessRate: 0.85 },
        { strategy: 'wait_for_element', priority: 2, description: 'Wait for element to load', estimatedSuccessRate: 0.7 },
        { strategy: 'scroll_into_view', priority: 3, description: 'Scroll to make element visible', estimatedSuccessRate: 0.6 },
        { strategy: 'page_refresh', priority: 4, description: 'Refresh and try again', estimatedSuccessRate: 0.4 }
      ],
      navigation_failed: [
        { strategy: 'retry_with_backoff', priority: 1, description: 'Retry navigation with delay', estimatedSuccessRate: 0.8 },
        { strategy: 'wait_for_network', priority: 2, description: 'Wait for network to stabilize', estimatedSuccessRate: 0.6 },
        { strategy: 'skip_step', priority: 3, description: 'Skip navigation step', estimatedSuccessRate: 1.0 }
      ],
      network_error: [
        { strategy: 'wait_for_network', priority: 1, description: 'Wait for network recovery', estimatedSuccessRate: 0.7 },
        { strategy: 'retry_with_backoff', priority: 2, description: 'Retry with exponential backoff', estimatedSuccessRate: 0.6 },
        { strategy: 'page_refresh', priority: 3, description: 'Refresh page', estimatedSuccessRate: 0.5 }
      ],
      interaction_blocked: [
        { strategy: 'scroll_into_view', priority: 1, description: 'Scroll element into view', estimatedSuccessRate: 0.8 },
        { strategy: 'force_click', priority: 2, description: 'Force click on element', estimatedSuccessRate: 0.7 },
        { strategy: 'use_javascript_click', priority: 3, description: 'Use JavaScript to click', estimatedSuccessRate: 0.6 },
        { strategy: 'wait_for_element', priority: 4, description: 'Wait for element to be interactable', estimatedSuccessRate: 0.5 }
      ],
      validation_error: [
        { strategy: 'clear_and_retry', priority: 1, description: 'Clear field and retry input', estimatedSuccessRate: 0.8 },
        { strategy: 'bypass_validation', priority: 2, description: 'Bypass client-side validation', estimatedSuccessRate: 0.6 },
        { strategy: 'skip_step', priority: 3, description: 'Skip validation step', estimatedSuccessRate: 1.0 }
      ],
      permission_denied: [
        { strategy: 'skip_step', priority: 1, description: 'Skip unauthorized step', estimatedSuccessRate: 1.0 }
      ],
      page_load_error: [
        { strategy: 'page_refresh', priority: 1, description: 'Refresh page', estimatedSuccessRate: 0.8 },
        { strategy: 'wait_for_network', priority: 2, description: 'Wait for network', estimatedSuccessRate: 0.6 },
        { strategy: 'retry_with_backoff', priority: 3, description: 'Retry with delay', estimatedSuccessRate: 0.5 }
      ],
      stale_element: [
        { strategy: 'wait_for_stable', priority: 1, description: 'Wait for DOM to stabilize', estimatedSuccessRate: 0.8 },
        { strategy: 'alternative_selector', priority: 2, description: 'Find fresh element reference', estimatedSuccessRate: 0.7 },
        { strategy: 'page_refresh', priority: 3, description: 'Refresh page', estimatedSuccessRate: 0.6 }
      ],
      javascript_error: [
        { strategy: 'wait_for_stable', priority: 1, description: 'Wait for scripts to load', estimatedSuccessRate: 0.7 },
        { strategy: 'page_refresh', priority: 2, description: 'Refresh page', estimatedSuccessRate: 0.6 },
        { strategy: 'skip_step', priority: 3, description: 'Skip problematic step', estimatedSuccessRate: 1.0 }
      ],
      unknown: [
        { strategy: 'retry_with_backoff', priority: 1, description: 'Retry with delay', estimatedSuccessRate: 0.5 },
        { strategy: 'wait_for_stable', priority: 2, description: 'Wait for page stability', estimatedSuccessRate: 0.4 },
        { strategy: 'skip_step', priority: 3, description: 'Skip problematic step', estimatedSuccessRate: 1.0 }
      ]
    };

    return strategyMap[category] || strategyMap.unknown;
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: Error | any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.toString) return error.toString();
    return 'Unknown error';
  }

  /**
   * Fallback error categorization for unknown patterns
   */
  private fallbackCategorization(error: Error | any, errorMessage: string): ErrorCategory {
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('timeout')) return 'timeout';
    if (lowerMessage.includes('not found') || lowerMessage.includes('locate')) return 'element_not_found';
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) return 'network_error';
    if (lowerMessage.includes('navigate')) return 'navigation_failed';
    if (lowerMessage.includes('click') || lowerMessage.includes('interact')) return 'interaction_blocked';
    if (lowerMessage.includes('permission') || lowerMessage.includes('denied')) return 'permission_denied';
    if (lowerMessage.includes('load')) return 'page_load_error';
    if (lowerMessage.includes('stale') || lowerMessage.includes('detached')) return 'stale_element';
    if (lowerMessage.includes('javascript') || lowerMessage.includes('script')) return 'javascript_error';
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) return 'validation_error';
    
    return 'unknown';
  }

  /**
   * Update recovery statistics
   */
  private updateRecoveryStats(
    strategy: RecoveryStrategy,
    category: ErrorCategory,
    success: boolean,
    duration: number
  ): void {
    const key = `${strategy}_${category}`;
    const existing = this.recoveryStats.get(key);
    
    if (existing) {
      existing.totalAttempts++;
      if (success) existing.successCount++;
      existing.successRate = existing.successCount / existing.totalAttempts;
      existing.averageDuration = (existing.averageDuration * (existing.totalAttempts - 1) + duration) / existing.totalAttempts;
      existing.lastUsed = new Date();
      existing.effectivenessScore = this.calculateEffectivenessScore(existing);
    } else {
      this.recoveryStats.set(key, {
        strategy,
        category,
        totalAttempts: 1,
        successCount: success ? 1 : 0,
        successRate: success ? 1 : 0,
        averageDuration: duration,
        lastUsed: new Date(),
        effectivenessScore: success ? 0.5 : 0.1
      });
    }
  }

  /**
   * Calculate effectiveness score for a recovery strategy
   */
  private calculateEffectivenessScore(stats: RecoveryStatistics): number {
    const successWeight = 0.7;
    const speedWeight = 0.2;
    const recencyWeight = 0.1;
    
    const successScore = stats.successRate;
    const speedScore = Math.max(0, 1 - (stats.averageDuration / 10000)); // Normalize to 10 seconds
    const recencyScore = Math.max(0, 1 - ((Date.now() - stats.lastUsed.getTime()) / (7 * 24 * 60 * 60 * 1000))); // Decay over week
    
    return (successScore * successWeight) + (speedScore * speedWeight) + (recencyScore * recencyWeight);
  }

  /**
   * Get statistics for a specific strategy and category
   */
  private getStrategyStats(strategy: RecoveryStrategy, category: ErrorCategory): RecoveryStatistics | undefined {
    return this.recoveryStats.get(`${strategy}_${category}`);
  }

  /**
   * Log recovery attempt for pattern learning
   */
  private logRecoveryAttempt(
    error: Error | any,
    category: ErrorCategory,
    strategy: RecoveryStrategy,
    success: boolean
  ): void {
    this.recentErrors.push({
      timestamp: new Date(),
      error: this.extractErrorMessage(error),
      category,
      recovery: strategy,
      success
    });

    // Keep only last 1000 errors
    if (this.recentErrors.length > 1000) {
      this.recentErrors.shift();
    }
  }

  /**
   * Get recovery statistics summary
   */
  public getRecoveryStatistics(): {
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
    overallSuccessRate: number;
    topStrategies: Array<{
      strategy: RecoveryStrategy;
      category: ErrorCategory;
      successRate: number;
      effectivenessScore: number;
    }>;
    recentTrends: Array<{
      date: string;
      attempts: number;
      successes: number;
    }>;
  } {
    const stats = Array.from(this.recoveryStats.values());
    const totalAttempts = stats.reduce((sum, s) => sum + s.totalAttempts, 0);
    const totalSuccesses = stats.reduce((sum, s) => sum + s.successCount, 0);
    
    const topStrategies = stats
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
      .slice(0, 10)
      .map(s => ({
        strategy: s.strategy,
        category: s.category,
        successRate: s.successRate,
        effectivenessScore: s.effectivenessScore
      }));

    // Calculate recent trends (last 7 days)
    const recentTrends: Array<{
      date: string;
      attempts: number;
      successes: number;
    }> = [];
    
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayErrors = this.recentErrors.filter(e => 
        e.timestamp.toISOString().split('T')[0] === dateStr
      );
      
      recentTrends.push({
        date: dateStr,
        attempts: dayErrors.length,
        successes: dayErrors.filter(e => e.success).length
      });
    }

    return {
      totalRecoveryAttempts: totalAttempts,
      successfulRecoveries: totalSuccesses,
      overallSuccessRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
      topStrategies,
      recentTrends
    };
  }

  /**
   * Get recommendations for improving error handling
   */
  public getRecoveryRecommendations(): Array<{
    type: 'strategy' | 'pattern' | 'timeout' | 'selector';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    expectedImprovement: number;
  }> {
    const recommendations: Array<{
      type: 'strategy' | 'pattern' | 'timeout' | 'selector';
      priority: 'high' | 'medium' | 'low';
      recommendation: string;
      expectedImprovement: number;
    }> = [];

    const stats = Array.from(this.recoveryStats.values());
    const lowSuccessRateStrategies = stats.filter(s => s.successRate < 0.3 && s.totalAttempts > 5);
    
    // Recommend strategy improvements
    for (const strategy of lowSuccessRateStrategies) {
      recommendations.push({
        type: 'strategy',
        priority: 'high',
        recommendation: `Strategy '${strategy.strategy}' for '${strategy.category}' has low success rate (${Math.round(strategy.successRate * 100)}%). Consider alternative approaches or improve implementation.`,
        expectedImprovement: 0.3
      });
    }

    // Recommend timeout adjustments
    const timeoutErrors = this.recentErrors.filter(e => e.category === 'timeout');
    if (timeoutErrors.length > 10) {
      const successfulTimeouts = timeoutErrors.filter(e => e.success);
      const timeoutSuccessRate = successfulTimeouts.length / timeoutErrors.length;
      
      if (timeoutSuccessRate < 0.5) {
        recommendations.push({
          type: 'timeout',
          priority: 'medium',
          recommendation: 'High frequency of timeout errors detected. Consider increasing default timeouts or improving wait strategies.',
          expectedImprovement: 0.2
        });
      }
    }

    // Recommend selector improvements
    const selectorErrors = this.recentErrors.filter(e => e.category === 'element_not_found');
    if (selectorErrors.length > 15) {
      recommendations.push({
        type: 'selector',
        priority: 'medium',
        recommendation: 'Frequent element not found errors detected. Consider using more robust selectors (data-testid attributes) or improving element location strategies.',
        expectedImprovement: 0.25
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Export recovery patterns for analysis or backup
   */
  public exportRecoveryData(): {
    patterns: ErrorPattern[];
    statistics: Array<RecoveryStatistics & { key: string }>;
    recentErrors: typeof this.recentErrors;
    exportTime: Date;
  } {
    return {
      patterns: this.knownPatterns,
      statistics: Array.from(this.recoveryStats.entries()).map(([key, stats]) => ({ 
        key, 
        ...stats 
      })),
      recentErrors: this.recentErrors,
      exportTime: new Date()
    };
  }

  /**
   * Import recovery data from previous sessions
   */
  public importRecoveryData(data: {
    patterns?: ErrorPattern[];
    statistics?: Array<RecoveryStatistics & { key: string }>;
    recentErrors?: typeof this.recentErrors;
  }): void {
    if (data.patterns) {
      // Merge with existing patterns, avoiding duplicates
      const existingIds = new Set(this.knownPatterns.map(p => p.id));
      const newPatterns = data.patterns.filter(p => !existingIds.has(p.id));
      this.knownPatterns.push(...newPatterns);
    }

    if (data.statistics) {
      data.statistics.forEach(({ key, ...stats }) => {
        this.recoveryStats.set(key, stats);
      });
    }

    if (data.recentErrors) {
      // Merge recent errors, keeping only last 1000
      this.recentErrors.push(...data.recentErrors);
      this.recentErrors.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      if (this.recentErrors.length > 1000) {
        this.recentErrors.splice(0, this.recentErrors.length - 1000);
      }
    }
  }
}

/**
 * Utility functions for error recovery
 */
export class ErrorRecoveryUtils {
  /**
   * Create a recovery context from execution context
   */
  static createRecoveryContext(
    page: Page,
    stepName: string,
    selector?: string,
    value?: string,
    retryCount: number = 0,
    maxRetries: number = 3,
    timeout?: number,
    actionContext?: ActionContext,
    variables?: Record<string, string>
  ): RecoveryContext {
    return {
      page,
      stepName,
      selector,
      value,
      retryCount,
      maxRetries,
      timeout,
      actionContext,
      variables
    };
  }

  /**
   * Check if error should trigger recovery
   */
  static shouldAttemptRecovery(error: Error | any, retryCount: number, maxRetries: number): boolean {
    if (retryCount >= maxRetries) {
      return false;
    }

    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Don't retry critical errors
    const criticalErrors = [
      'permission denied',
      'access denied',
      'authentication required',
      'user aborted'
    ];
    
    return !criticalErrors.some(critical => errorMessage.includes(critical));
  }

  /**
   * Estimate recovery time based on strategy
   */
  static estimateRecoveryTime(strategy: RecoveryStrategy): number {
    const timeEstimates: Record<RecoveryStrategy, number> = {
      retry_with_backoff: 2000,
      alternative_selector: 3000,
      wait_for_element: 5000,
      scroll_into_view: 1000,
      force_click: 500,
      page_refresh: 8000,
      wait_for_network: 10000,
      clear_and_retry: 1500,
      use_javascript_click: 500,
      wait_for_stable: 3000,
      bypass_validation: 1000,
      skip_step: 0
    };

    return timeEstimates[strategy] || 2000;
  }
}

// Export singleton instance for easy use
export const hybridErrorRecovery = new HybridErrorRecovery();

export default HybridErrorRecovery;