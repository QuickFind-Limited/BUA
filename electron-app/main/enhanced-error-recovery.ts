/**
 * Enhanced Error Recovery System with Claude Code Integration
 * 
 * Extends the HybridErrorRecovery system with AI-powered error recovery capabilities
 * using the ClaudeCodeIntegration module for complex error scenarios.
 */

import { Page } from 'playwright';
import {
  HybridErrorRecovery,
  ErrorCategory,
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult,
  ErrorAnalysisResult,
  ErrorRecoveryUtils
} from './hybrid-error-recovery';
import {
  ClaudeCodeIntegration,
  ClaudeCodeConfig,
  ErrorContext,
  ClaudeSolution
} from './claude-code-integration';
import { FlowError, ActionContext } from '../flows/types';

export interface EnhancedRecoveryOptions {
  // Claude Code Integration options
  enableAIRecovery: boolean;
  aiRecoveryConfig?: Partial<ClaudeCodeConfig>;
  
  // Strategy selection options
  maxBuiltInAttempts: number;
  aiConfidenceThreshold: number;
  fallbackToBuiltIn: boolean;
  
  // Logging and monitoring
  enableDetailedLogging: boolean;
  logSuccessfulStrategies: boolean;
  trackPerformanceMetrics: boolean;
}

export interface EnhancedRecoveryResult extends RecoveryResult {
  aiUsed: boolean;
  builtInStrategiesAttempted: RecoveryStrategy[];
  confidenceScore?: number;
  solutionSource: 'built-in' | 'ai' | 'cached-ai';
  performanceMetrics?: {
    decisionTime: number;
    executionTime: number;
    totalTime: number;
    cacheHit: boolean;
  };
}

export interface RecoverySession {
  sessionId: string;
  startTime: Date;
  error: Error | any;
  context: RecoveryContext;
  attempts: Array<{
    strategy: RecoveryStrategy | string;
    source: 'built-in' | 'ai';
    result: RecoveryResult;
    timestamp: Date;
    duration: number;
  }>;
  finalResult?: EnhancedRecoveryResult;
  endTime?: Date;
}

/**
 * Enhanced Error Recovery class that combines built-in strategies with AI-powered solutions
 */
export class EnhancedErrorRecovery {
  private hybridRecovery: HybridErrorRecovery;
  private claudeIntegration: ClaudeCodeIntegration | null = null;
  private options: EnhancedRecoveryOptions;
  private activeSessions: Map<string, RecoverySession> = new Map();
  private performanceStats: {
    totalRecoveries: number;
    aiSuccesses: number;
    builtInSuccesses: number;
    averageDecisionTime: number;
    averageExecutionTime: number;
  } = {
    totalRecoveries: 0,
    aiSuccesses: 0,
    builtInSuccesses: 0,
    averageDecisionTime: 0,
    averageExecutionTime: 0
  };

  constructor(options: Partial<EnhancedRecoveryOptions> = {}) {
    this.options = this.mergeOptions(options);
    this.hybridRecovery = new HybridErrorRecovery();
    
    // Initialize Claude Code integration if enabled
    if (this.options.enableAIRecovery) {
      this.claudeIntegration = new ClaudeCodeIntegration(
        this.options.aiRecoveryConfig,
        this.hybridRecovery
      );
    }
  }

  private mergeOptions(userOptions: Partial<EnhancedRecoveryOptions>): EnhancedRecoveryOptions {
    return {
      enableAIRecovery: true,
      maxBuiltInAttempts: 3,
      aiConfidenceThreshold: 0.7,
      fallbackToBuiltIn: true,
      enableDetailedLogging: true,
      logSuccessfulStrategies: true,
      trackPerformanceMetrics: true,
      ...userOptions
    };
  }

  /**
   * Main entry point for enhanced error recovery
   */
  public async recoverFromError(
    error: Error | any,
    context: RecoveryContext,
    options?: { forceAI?: boolean; maxAttempts?: number }
  ): Promise<EnhancedRecoveryResult> {
    const sessionId = this.generateSessionId();
    const session = this.createRecoverySession(sessionId, error, context);
    
    const startTime = Date.now();
    let decisionTime = 0;
    let executionTime = 0;
    
    try {
      // Phase 1: Error Analysis and Strategy Decision
      const decisionStart = Date.now();
      const shouldUseAI = await this.decideRecoveryApproach(error, context, options);
      decisionTime = Date.now() - decisionStart;
      
      let result: EnhancedRecoveryResult;
      
      if (shouldUseAI.useClaudeCode && this.claudeIntegration) {
        // Phase 2a: AI-powered recovery
        result = await this.attemptAIRecovery(error, context, session);
      } else {
        // Phase 2b: Built-in strategy recovery
        result = await this.attemptBuiltInRecovery(error, context, session);
      }
      
      executionTime = result.duration || 0;
      
      // Phase 3: Fallback if needed and enabled
      if (!result.success && this.options.fallbackToBuiltIn) {
        const fallbackResult = await this.attemptFallbackRecovery(error, context, session, result.solutionSource);
        if (fallbackResult.success) {
          result = fallbackResult;
          executionTime += fallbackResult.duration || 0;
        }
      }

      // Finalize session
      session.finalResult = result;
      session.endTime = new Date();
      
      // Update performance metrics
      if (this.options.trackPerformanceMetrics) {
        this.updatePerformanceStats(result, decisionTime, executionTime);
      }
      
      // Enhanced result with performance metrics
      const enhancedResult: EnhancedRecoveryResult = {
        ...result,
        performanceMetrics: {
          decisionTime,
          executionTime,
          totalTime: Date.now() - startTime,
          cacheHit: result.metadata?.cacheHit || false
        }
      };

      // Log successful strategies
      if (this.options.logSuccessfulStrategies && result.success) {
        this.logSuccessfulStrategy(session, enhancedResult);
      }

      return enhancedResult;
      
    } catch (recoveryError) {
      const errorMessage = recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error';
      
      const failureResult: EnhancedRecoveryResult = {
        success: false,
        strategyUsed: 'error_recovery_failed' as RecoveryStrategy,
        retryCount: context.retryCount,
        duration: Date.now() - startTime,
        error: `Enhanced recovery failed: ${errorMessage}`,
        aiUsed: false,
        builtInStrategiesAttempted: [],
        solutionSource: 'built-in',
        performanceMetrics: {
          decisionTime,
          executionTime,
          totalTime: Date.now() - startTime,
          cacheHit: false
        }
      };

      session.finalResult = failureResult;
      session.endTime = new Date();

      return failureResult;
    } finally {
      // Clean up session after some time
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Decide whether to use AI or built-in strategies
   */
  private async decideRecoveryApproach(
    error: Error | any,
    context: RecoveryContext,
    options?: { forceAI?: boolean }
  ): Promise<{ useClaudeCode: boolean; reasoning: string; confidence: number }> {
    // Force AI if requested
    if (options?.forceAI && this.claudeIntegration) {
      return {
        useClaudeCode: true,
        reasoning: 'AI recovery forced by option',
        confidence: 1.0
      };
    }

    // Use built-in decision if AI not available
    if (!this.claudeIntegration || !this.options.enableAIRecovery) {
      return {
        useClaudeCode: false,
        reasoning: 'AI recovery not available or disabled',
        confidence: 1.0
      };
    }

    // Check if we've exceeded built-in attempts
    if (context.retryCount >= this.options.maxBuiltInAttempts) {
      return {
        useClaudeCode: true,
        reasoning: `Exceeded built-in attempt limit (${this.options.maxBuiltInAttempts})`,
        confidence: 0.8
      };
    }

    // Use Claude Code integration's decision engine
    return this.claudeIntegration.shouldUseClaudeCode(error, context);
  }

  /**
   * Attempt recovery using AI-powered solutions
   */
  private async attemptAIRecovery(
    error: Error | any,
    context: RecoveryContext,
    session: RecoverySession
  ): Promise<EnhancedRecoveryResult> {
    if (!this.claudeIntegration) {
      throw new Error('AI recovery requested but Claude integration not available');
    }

    const attemptStart = Date.now();
    
    try {
      // Get AI solution
      const solution: ClaudeSolution = await this.claudeIntegration.invokeClaudeCode(error, context);
      
      // Execute the solution
      const result = await this.claudeIntegration.executeSolution(solution, context);
      
      // Record attempt
      session.attempts.push({
        strategy: solution.strategy,
        source: 'ai',
        result,
        timestamp: new Date(),
        duration: Date.now() - attemptStart
      });

      return {
        ...result,
        aiUsed: true,
        builtInStrategiesAttempted: [],
        solutionSource: result.metadata?.cacheHit ? 'cached-ai' : 'ai',
        confidenceScore: solution.confidence
      };
      
    } catch (aiError) {
      const errorMessage = aiError instanceof Error ? aiError.message : 'AI recovery failed';
      
      // Record failed attempt
      session.attempts.push({
        strategy: 'ai_recovery_failed',
        source: 'ai',
        result: {
          success: false,
          strategyUsed: 'ai_recovery_failed' as RecoveryStrategy,
          retryCount: context.retryCount,
          duration: Date.now() - attemptStart,
          error: errorMessage
        },
        timestamp: new Date(),
        duration: Date.now() - attemptStart
      });

      return {
        success: false,
        strategyUsed: 'ai_recovery_failed' as RecoveryStrategy,
        retryCount: context.retryCount,
        duration: Date.now() - attemptStart,
        error: errorMessage,
        aiUsed: true,
        builtInStrategiesAttempted: [],
        solutionSource: 'ai'
      };
    }
  }

  /**
   * Attempt recovery using built-in strategies
   */
  private async attemptBuiltInRecovery(
    error: Error | any,
    context: RecoveryContext,
    session: RecoverySession
  ): Promise<EnhancedRecoveryResult> {
    const attemptStart = Date.now();
    const triedStrategies: RecoveryStrategy[] = [];
    
    try {
      // First try known fixes if it's a known issue
      if (this.hybridRecovery.isKnownIssue(error)) {
        try {
          const knownFixResult = await this.hybridRecovery.applyKnownFix(error, context);
          
          triedStrategies.push(knownFixResult.strategyUsed);
          
          session.attempts.push({
            strategy: knownFixResult.strategyUsed,
            source: 'built-in',
            result: knownFixResult,
            timestamp: new Date(),
            duration: knownFixResult.duration || 0
          });

          if (knownFixResult.success) {
            return {
              ...knownFixResult,
              aiUsed: false,
              builtInStrategiesAttempted: triedStrategies,
              solutionSource: 'built-in'
            };
          }
        } catch (knownFixError) {
          // Continue to general strategies
        }
      }

      // Try general built-in strategies
      const builtInResult = await this.hybridRecovery.tryBuiltInStrategies(error, context);
      
      session.attempts.push({
        strategy: builtInResult.strategyUsed,
        source: 'built-in',
        result: builtInResult,
        timestamp: new Date(),
        duration: builtInResult.duration || 0
      });

      // Get all attempted strategies from the hybrid recovery
      const analysis = this.hybridRecovery.categorizeError(error);
      const suggestedStrategies = analysis.suggestedStrategies.map(s => s.strategy);
      triedStrategies.push(...suggestedStrategies.slice(0, this.options.maxBuiltInAttempts));

      return {
        ...builtInResult,
        aiUsed: false,
        builtInStrategiesAttempted: triedStrategies,
        solutionSource: 'built-in'
      };
      
    } catch (builtInError) {
      const errorMessage = builtInError instanceof Error ? builtInError.message : 'Built-in recovery failed';
      
      return {
        success: false,
        strategyUsed: 'built_in_recovery_failed' as RecoveryStrategy,
        retryCount: context.retryCount,
        duration: Date.now() - attemptStart,
        error: errorMessage,
        aiUsed: false,
        builtInStrategiesAttempted: triedStrategies,
        solutionSource: 'built-in'
      };
    }
  }

  /**
   * Attempt fallback recovery when primary approach fails
   */
  private async attemptFallbackRecovery(
    error: Error | any,
    context: RecoveryContext,
    session: RecoverySession,
    primarySource: 'built-in' | 'ai' | 'cached-ai'
  ): Promise<EnhancedRecoveryResult> {
    const attemptStart = Date.now();
    
    try {
      let fallbackResult: EnhancedRecoveryResult;
      
      if (primarySource === 'ai' || primarySource === 'cached-ai') {
        // AI failed, try built-in as fallback
        fallbackResult = await this.attemptBuiltInRecovery(error, context, session);
        fallbackResult.solutionSource = 'built-in';
      } else {
        // Built-in failed, try AI as fallback if available
        if (this.claudeIntegration && this.options.enableAIRecovery) {
          fallbackResult = await this.attemptAIRecovery(error, context, session);
          fallbackResult.solutionSource = fallbackResult.solutionSource || 'ai';
        } else {
          // No AI available, return failure
          return {
            success: false,
            strategyUsed: 'no_fallback_available' as RecoveryStrategy,
            retryCount: context.retryCount,
            duration: Date.now() - attemptStart,
            error: 'No fallback strategy available',
            aiUsed: false,
            builtInStrategiesAttempted: [],
            solutionSource: 'built-in'
          };
        }
      }

      // Mark as fallback in metadata
      fallbackResult.metadata = {
        ...fallbackResult.metadata,
        fallbackUsed: true,
        primarySource
      };

      return fallbackResult;
      
    } catch (fallbackError) {
      const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Fallback recovery failed';
      
      return {
        success: false,
        strategyUsed: 'fallback_recovery_failed' as RecoveryStrategy,
        retryCount: context.retryCount,
        duration: Date.now() - attemptStart,
        error: errorMessage,
        aiUsed: primarySource !== 'ai',
        builtInStrategiesAttempted: [],
        solutionSource: primarySource
      };
    }
  }

  /**
   * Utility methods
   */
  private generateSessionId(): string {
    return `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createRecoverySession(sessionId: string, error: Error | any, context: RecoveryContext): RecoverySession {
    const session: RecoverySession = {
      sessionId,
      startTime: new Date(),
      error,
      context,
      attempts: []
    };
    
    this.activeSessions.set(sessionId, session);
    return session;
  }

  private updatePerformanceStats(result: EnhancedRecoveryResult, decisionTime: number, executionTime: number): void {
    this.performanceStats.totalRecoveries++;
    
    if (result.success) {
      if (result.aiUsed) {
        this.performanceStats.aiSuccesses++;
      } else {
        this.performanceStats.builtInSuccesses++;
      }
    }
    
    // Update averages
    const totalRecoveries = this.performanceStats.totalRecoveries;
    this.performanceStats.averageDecisionTime = 
      (this.performanceStats.averageDecisionTime * (totalRecoveries - 1) + decisionTime) / totalRecoveries;
    
    this.performanceStats.averageExecutionTime = 
      (this.performanceStats.averageExecutionTime * (totalRecoveries - 1) + executionTime) / totalRecoveries;
  }

  private logSuccessfulStrategy(session: RecoverySession, result: EnhancedRecoveryResult): void {
    if (this.options.enableDetailedLogging) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        success: true,
        strategy: result.strategyUsed,
        source: result.solutionSource,
        aiUsed: result.aiUsed,
        confidence: result.confidenceScore,
        duration: result.duration,
        errorCategory: this.hybridRecovery.categorizeError(session.error).category,
        builtInStrategiesAttempted: result.builtInStrategiesAttempted,
        totalAttempts: session.attempts.length,
        cacheHit: result.performanceMetrics?.cacheHit
      };
      
      console.log(`[EnhancedRecovery] Success: ${JSON.stringify(logEntry)}`);
    }
  }

  // Public API methods

  /**
   * Get current performance statistics
   */
  public getPerformanceStats(): {
    totalRecoveries: number;
    successRate: number;
    aiSuccessRate: number;
    builtInSuccessRate: number;
    averageDecisionTime: number;
    averageExecutionTime: number;
    activeSessionsCount: number;
  } {
    const totalSuccesses = this.performanceStats.aiSuccesses + this.performanceStats.builtInSuccesses;
    
    return {
      totalRecoveries: this.performanceStats.totalRecoveries,
      successRate: this.performanceStats.totalRecoveries > 0 ? totalSuccesses / this.performanceStats.totalRecoveries : 0,
      aiSuccessRate: this.performanceStats.totalRecoveries > 0 ? this.performanceStats.aiSuccesses / this.performanceStats.totalRecoveries : 0,
      builtInSuccessRate: this.performanceStats.totalRecoveries > 0 ? this.performanceStats.builtInSuccesses / this.performanceStats.totalRecoveries : 0,
      averageDecisionTime: this.performanceStats.averageDecisionTime,
      averageExecutionTime: this.performanceStats.averageExecutionTime,
      activeSessionsCount: this.activeSessions.size
    };
  }

  /**
   * Get active recovery sessions
   */
  public getActiveSessions(): Array<{
    sessionId: string;
    startTime: Date;
    errorCategory: string;
    attemptsCount: number;
    isComplete: boolean;
  }> {
    return Array.from(this.activeSessions.values()).map(session => ({
      sessionId: session.sessionId,
      startTime: session.startTime,
      errorCategory: this.hybridRecovery.categorizeError(session.error).category,
      attemptsCount: session.attempts.length,
      isComplete: !!session.finalResult
    }));
  }

  /**
   * Get detailed session information
   */
  public getSessionDetails(sessionId: string): RecoverySession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Clear completed sessions
   */
  public clearCompletedSessions(): number {
    let cleared = 0;
    
    for (const [id, session] of this.activeSessions.entries()) {
      if (session.finalResult) {
        this.activeSessions.delete(id);
        cleared++;
      }
    }
    
    return cleared;
  }

  /**
   * Export comprehensive status for monitoring
   */
  public exportStatus(): {
    options: EnhancedRecoveryOptions;
    performance: ReturnType<typeof this.getPerformanceStats>;
    activeSessions: ReturnType<typeof this.getActiveSessions>;
    claudeIntegrationStatus: any;
  } {
    return {
      options: this.options,
      performance: this.getPerformanceStats(),
      activeSessions: this.getActiveSessions(),
      claudeIntegrationStatus: this.claudeIntegration ? this.claudeIntegration.exportStatus() : null
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Clear sessions
    this.activeSessions.clear();
    
    // Cleanup Claude integration
    if (this.claudeIntegration) {
      await this.claudeIntegration.cleanup();
    }
    
    // Reset stats
    this.performanceStats = {
      totalRecoveries: 0,
      aiSuccesses: 0,
      builtInSuccesses: 0,
      averageDecisionTime: 0,
      averageExecutionTime: 0
    };
  }
}

// Export singleton instance
export const enhancedErrorRecovery = new EnhancedErrorRecovery();

export default EnhancedErrorRecovery;