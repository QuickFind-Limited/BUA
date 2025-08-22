/**
 * Enhanced Fallback Handler for Intent Spec Execution
 * Handles prefer/fallback strategies intelligently
 */

import { Page } from 'playwright';

export interface ExecutionStep {
  name?: string;
  prefer: 'snippet' | 'ai';
  fallback?: 'ai' | 'snippet' | 'none';
  snippet?: string;
  ai_instruction?: string;
  selector?: string;
  value?: string;
  [key: string]: any;
}

export interface ExecutionResult {
  success: boolean;
  pathUsed: 'snippet' | 'ai' | 'none';
  fallbackOccurred: boolean;
  error?: string;
  data?: any;
}

export class EnhancedFallbackHandler {
  private page: Page | null = null;
  private aiExecutor: any = null;

  constructor(page?: Page, aiExecutor?: any) {
    this.page = page;
    this.aiExecutor = aiExecutor;
  }

  /**
   * Execute step with intelligent fallback strategy
   */
  async executeWithFallback(step: ExecutionStep, variables: Record<string, string>): Promise<ExecutionResult> {
    console.log(`Executing step: ${step.name || 'unnamed'} (prefer: ${step.prefer}, fallback: ${step.fallback || 'none'})`);

    // Determine execution order based on preferences
    const primaryMethod = step.prefer;
    const fallbackMethod = step.fallback;

    // Try primary method first
    try {
      if (primaryMethod === 'snippet' && step.snippet) {
        await this.executeSnippet(step.snippet, variables);
        return {
          success: true,
          pathUsed: 'snippet',
          fallbackOccurred: false
        };
      } else if (primaryMethod === 'ai' && step.ai_instruction) {
        await this.executeAI(step.ai_instruction, variables);
        return {
          success: true,
          pathUsed: 'ai',
          fallbackOccurred: false
        };
      }
    } catch (primaryError) {
      console.log(`Primary method (${primaryMethod}) failed:`, primaryError);
      
      // Check if fallback is available
      if (!fallbackMethod || fallbackMethod === 'none') {
        // No fallback available - fail immediately
        return {
          success: false,
          pathUsed: primaryMethod,
          fallbackOccurred: false,
          error: `Primary execution failed with no fallback: ${primaryError}`
        };
      }

      // Try fallback method
      try {
        if (fallbackMethod === 'snippet' && step.snippet) {
          await this.executeSnippet(step.snippet, variables);
          return {
            success: true,
            pathUsed: 'snippet',
            fallbackOccurred: true
          };
        } else if (fallbackMethod === 'ai' && step.ai_instruction) {
          await this.executeAI(step.ai_instruction, variables);
          return {
            success: true,
            pathUsed: 'ai',
            fallbackOccurred: true
          };
        }
      } catch (fallbackError) {
        console.log(`Fallback method (${fallbackMethod}) also failed:`, fallbackError);
        return {
          success: false,
          pathUsed: fallbackMethod,
          fallbackOccurred: true,
          error: `Both primary and fallback execution failed: ${fallbackError}`
        };
      }
    }

    // Should not reach here
    return {
      success: false,
      pathUsed: 'none',
      fallbackOccurred: false,
      error: 'No executable method found in step'
    };
  }

  /**
   * Execute Playwright snippet
   */
  private async executeSnippet(snippet: string, variables: Record<string, string>): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized for snippet execution');
    }

    // Replace variables in snippet
    let processedSnippet = snippet;
    for (const [key, value] of Object.entries(variables)) {
      processedSnippet = processedSnippet.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    console.log(`Executing snippet: ${processedSnippet}`);
    
    // Execute the snippet using eval (in production, use a safer method)
    // This is a simplified version - in production, parse and execute safely
    const page = this.page;
    await eval(`(async () => { ${processedSnippet} })()`);
  }

  /**
   * Execute using AI
   */
  private async executeAI(instruction: string, variables: Record<string, string>): Promise<void> {
    if (!this.aiExecutor) {
      throw new Error('AI executor not initialized');
    }

    // Replace variables in instruction
    let processedInstruction = instruction;
    for (const [key, value] of Object.entries(variables)) {
      processedInstruction = processedInstruction.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    console.log(`Executing via AI: ${processedInstruction}`);
    
    // Call AI executor
    const result = await this.aiExecutor.execute(processedInstruction);
    if (!result.success) {
      throw new Error(result.error || 'AI execution failed');
    }
  }

  /**
   * Determine if error is recoverable
   */
  async canRecover(error: any): Promise<boolean> {
    const recoverableErrors = [
      'Element not found',
      'Timeout',
      'Navigation failed',
      'Element not visible',
      'Element not clickable'
    ];
    
    return recoverableErrors.some(e => 
      error.message?.toLowerCase().includes(e.toLowerCase())
    );
  }

  /**
   * Handle navigation with smart retry
   */
  async handleNavigation(url: string, retries = 3): Promise<ExecutionResult> {
    for (let i = 0; i < retries; i++) {
      try {
        if (!this.page) {
          throw new Error('Page not initialized');
        }
        
        await this.page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        return {
          success: true,
          pathUsed: 'snippet',
          fallbackOccurred: i > 0
        };
      } catch (error) {
        console.log(`Navigation attempt ${i + 1} failed:`, error);
        if (i === retries - 1) {
          return {
            success: false,
            pathUsed: 'snippet',
            fallbackOccurred: true,
            error: `Navigation failed after ${retries} attempts: ${error}`
          };
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return {
      success: false,
      pathUsed: 'snippet',
      fallbackOccurred: true,
      error: 'Navigation failed'
    };
  }
}

// Recommendations for Intent Spec generation:
export const FALLBACK_RECOMMENDATIONS = {
  navigation: {
    prefer: 'snippet',
    fallback: 'snippet', // Use retry logic instead of 'none'
    retries: 3
  },
  input: {
    prefer: 'snippet',
    fallback: 'ai', // AI can find fields even if selectors change
  },
  click: {
    prefer: 'snippet',
    fallback: 'ai', // AI can find buttons by text/context
  },
  wait: {
    prefer: 'snippet',
    fallback: 'none', // Waits typically don't have good fallbacks
  },
  validation: {
    prefer: 'ai',
    fallback: 'snippet', // AI better at understanding context
  }
};