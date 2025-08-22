import { SmartSelectorExecutor, shouldPreferAI } from './smart-selector-executor';

// Fallback handler for magnitude executor
export class FallbackHandler {
  private smartExecutor: SmartSelectorExecutor | null = null;
  private aiExecutor: any = null;
  
  constructor(page?: any, aiExecutor?: any) {
    if (page) {
      this.smartExecutor = new SmartSelectorExecutor(page);
    }
    this.aiExecutor = aiExecutor;
  }
  
  /**
   * Execute with intelligent fallback strategy
   */
  async executeWithFallback(step: any, variables: Record<string, string>): Promise<any> {
    // Determine if AI should be preferred for this step
    const preferAI = step.prefer === 'ai' || shouldPreferAI(step);
    
    console.log(`Executing: ${step.name || 'unnamed step'} (prefer: ${preferAI ? 'ai' : 'snippet'})`);
    
    // Try primary method
    try {
      if (preferAI && this.aiExecutor) {
        // Try AI first
        const result = await this.executeWithAI(step, variables);
        return {
          success: true,
          pathUsed: 'ai',
          fallbackOccurred: false,
          ...result
        };
      } else if (this.smartExecutor) {
        // Try snippet/selector first
        const success = await this.smartExecutor.executeWithSmartSelectors(step, variables);
        if (success) {
          return {
            success: true,
            pathUsed: 'snippet',
            fallbackOccurred: false
          };
        }
        throw new Error('Snippet execution failed');
      }
    } catch (primaryError) {
      console.log('Primary method failed:', primaryError);
      
      // Check fallback option
      if (!step.fallback || step.fallback === 'none') {
        return {
          success: false,
          pathUsed: preferAI ? 'ai' : 'snippet',
          fallbackOccurred: false,
          error: primaryError.message
        };
      }
      
      // Try fallback
      try {
        if (step.fallback === 'ai' && this.aiExecutor) {
          const result = await this.executeWithAI(step, variables);
          return {
            success: true,
            pathUsed: 'ai',
            fallbackOccurred: true,
            ...result
          };
        } else if (step.fallback === 'snippet' && this.smartExecutor) {
          const success = await this.smartExecutor.executeWithSmartSelectors(step, variables);
          if (success) {
            return {
              success: true,
              pathUsed: 'snippet',
              fallbackOccurred: true
            };
          }
        }
      } catch (fallbackError) {
        console.log('Fallback also failed:', fallbackError);
      }
    }
    
    // Both methods failed
    return {
      success: false,
      pathUsed: 'none',
      fallbackOccurred: true,
      error: 'Both primary and fallback methods failed'
    };
  }
  
  /**
   * Execute using AI
   */
  private async executeWithAI(step: any, variables: Record<string, string>): Promise<any> {
    if (!this.aiExecutor) {
      throw new Error('AI executor not initialized');
    }
    
    // Replace variables in instruction
    let instruction = step.ai_instruction || step.name || '';
    for (const [key, value] of Object.entries(variables)) {
      instruction = instruction.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    console.log('Executing with AI:', instruction);
    const result = await this.aiExecutor.execute(instruction);
    
    if (!result.success) {
      throw new Error(result.error || 'AI execution failed');
    }
    
    return result;
  }
  
  async handleFallback(error: any, context: any): Promise<any> {
    console.log('Handling fallback for error:', error.message);
    
    // Smart fallback suggestions based on error type
    const suggestion = this.getSuggestion(error);
    
    return {
      success: false,
      fallbackAttempted: true,
      error: error.message,
      suggestion
    };
  }
  
  private getSuggestion(error: any): string {
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('selector') || errorMsg.includes('element')) {
      return 'Consider using AI-based element detection or multiple selectors';
    }
    if (errorMsg.includes('timeout')) {
      return 'Increase timeout or add explicit wait conditions';
    }
    if (errorMsg.includes('navigation')) {
      return 'Check URL validity and network conditions';
    }
    if (errorMsg.includes('permission') || errorMsg.includes('blocked')) {
      return 'Check browser permissions and security settings';
    }
    
    return 'Consider using enhanced recording with CDP for better results';
  }
  
  async canRecover(error: any): Promise<boolean> {
    // Check if error is recoverable
    const recoverableErrors = [
      'Element not found',
      'Timeout',
      'Navigation failed',
      'Element not visible',
      'Element not clickable',
      'Stale element reference'
    ];
    
    return recoverableErrors.some(e => error.message?.includes(e));
  }
}