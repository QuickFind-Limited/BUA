import { WebContentsView } from 'electron';
import { getMagnitudeAgent } from './llm';
import { AutonomousAIExecutor, FailureContext } from './autonomous-ai-executor';

interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionMethod?: 'snippet' | 'ai' | 'hybrid';
  skipped?: boolean;
  skipReason?: string;
  retryCount?: number;
  recoveryActions?: string[];
}

/**
 * Simplified controller that uses ONLY Magnitude for all browser interactions
 */
export class MagnitudeOnlyController {
  private webView: WebContentsView | null = null;
  private magnitudeAgent: any = null;
  private isConnected = false;
  
  // Execution statistics
  private executionStats = {
    snippetSuccess: 0,
    snippetFailure: 0,
    aiSuccess: 0,
    aiFailure: 0,
    skippedSteps: 0,
    totalSteps: 0
  };

  constructor() {
    console.log('🚀 MagnitudeOnlyController initialized');
  }

  /**
   * Connect to WebView using Magnitude
   */
  public async connectToWebView(webView: WebContentsView): Promise<boolean> {
    try {
      this.webView = webView;
      
      // Get the actual CDP port from environment variable
      const cdpPort = process.env.CDP_PORT || '9335';
      const cdpEndpoint = `http://127.0.0.1:${cdpPort}`;
      console.log(`🔗 Connecting Magnitude to CDP endpoint: ${cdpEndpoint}`);
      
      // Get Magnitude agent connected to our WebView browser
      this.magnitudeAgent = await getMagnitudeAgent(cdpEndpoint);
      
      if (!this.magnitudeAgent) {
        console.error('Failed to initialize Magnitude agent');
        return false;
      }
      
      this.isConnected = true;
      console.log('✅ Successfully connected Magnitude to WebView');
      return true;
    } catch (error) {
      console.error('Failed to connect to WebView:', error);
      return false;
    }
  }

  /**
   * Execute a step using Magnitude
   */
  public async executeStepEnhanced(
    step: any,
    variables: Record<string, string> = {}
  ): Promise<ExecutionResult> {
    if (!this.isConnected || !this.magnitudeAgent) {
      return {
        success: false,
        error: 'Not connected to WebView'
      };
    }

    this.executionStats.totalSteps++;

    try {
      console.log(`📝 Executing step: ${step.name}`);
      
      // Check skip conditions using Magnitude
      if (step.skipConditions && Array.isArray(step.skipConditions)) {
        const currentUrl = await this.getCurrentUrl();
        
        for (const condition of step.skipConditions) {
          if (condition.type === 'url_match' && currentUrl.includes(condition.value)) {
            console.log(`⏭️ Skipping step: ${condition.skipReason || 'URL condition matched'}`);
            this.executionStats.skippedSteps++;
            
            return {
              success: true,
              skipped: true,
              skipReason: condition.skipReason || `URL matches ${condition.value}`,
              executionMethod: 'snippet'
            };
          }
        }
      }

      // Try snippet first if available
      let result: ExecutionResult;
      if (step.snippet || step.prefer === 'snippet') {
        result = await this.executeWithSnippet(step, variables);
      } else if (step.ai_instruction || step.prefer === 'ai') {
        result = await this.executeWithAI(step, variables);
      } else {
        result = await this.executeWithSnippet(step, variables);
      }

      // If snippet failed and we have AI fallback, try AI
      if (!result.success && step.fallback === 'ai' && step.ai_instruction) {
        console.log(`🔄 Snippet failed, falling back to AI...`);
        result = await this.executeWithAI(step, variables);
      }

      // Update statistics
      if (result.success) {
        if (result.executionMethod === 'ai') {
          this.executionStats.aiSuccess++;
        } else if (result.executionMethod === 'snippet') {
          this.executionStats.snippetSuccess++;
        }
      } else {
        if (result.executionMethod === 'ai') {
          this.executionStats.aiFailure++;
        } else {
          this.executionStats.snippetFailure++;
        }
      }

      return result;
    } catch (error) {
      console.error(`❌ Step execution failed: ${error}`);
      this.executionStats.snippetFailure++;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute step using Magnitude with Playwright snippet
   */
  private async executeWithSnippet(
    step: any,
    variables: Record<string, string>
  ): Promise<ExecutionResult> {
    // Replace variables in snippet
    let snippetToExecute = step.snippet || '';
    for (const [key, value] of Object.entries(variables)) {
      snippetToExecute = snippetToExecute.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    try {
      console.log(`📝 Executing snippet via Magnitude: ${snippetToExecute.substring(0, 100)}...`);
      
      // Execute the Playwright snippet through Magnitude's act() function
      const result = await this.magnitudeAgent.act(snippetToExecute);
      
      console.log(`✅ Magnitude executed snippet successfully`);
      
      return {
        success: true,
        data: result,
        executionMethod: 'snippet'
      };

    } catch (error: any) {
      console.log(`❌ Snippet execution failed: ${error.message}`);
      
      // If snippet fails and we have AI fallback, prepare for AI
      if (step.fallback === 'ai') {
        console.log('🤖 Preparing for AI fallback...');
        
        // Check if this is an element not found error
        const isElementMissing = error.message?.includes('Timeout') || 
                                error.message?.includes('waiting for locator') ||
                                error.message?.includes('not found');
        
        if (isElementMissing && step.selectors && step.selectors.length > 0) {
          console.log('📍 Elements not found, will use AI to navigate...');
          
          // First try to get AI to navigate to the right place
          const navigationInstruction = 
            `The element "${step.selectors[0]}" is not present on the current page. ` +
            `Navigate to where this element would exist. ` +
            `For login fields: Look for and click Sign In/Login buttons. ` +
            `Once on the correct page with the element visible, stop.`;
          
          try {
            await this.magnitudeAgent.act(navigationInstruction);
            console.log('✅ AI navigation completed, retrying snippet...');
            
            // Retry the original snippet
            const retryResult = await this.magnitudeAgent.act(snippetToExecute);
            return {
              success: true,
              data: retryResult,
              executionMethod: 'hybrid'
            };
          } catch (retryError) {
            console.log('❌ Snippet still failed after navigation');
          }
        }
      }
      
      throw error;
    }
  }

  /**
   * Execute step using Magnitude with AI instruction
   */
  private async executeWithAI(
    step: any,
    variables: Record<string, string>
  ): Promise<ExecutionResult> {
    try {
      // Build AI instruction with variable replacement
      let instruction = step.ai_instruction || step.aiInstruction || '';
      for (const [key, value] of Object.entries(variables)) {
        instruction = instruction.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      
      console.log(`🤖 Executing via Magnitude AI: ${instruction}`);
      
      // Execute using Magnitude's AI capabilities
      const result = await this.magnitudeAgent.act(instruction);
      
      console.log(`✅ AI execution completed successfully`);
      
      return {
        success: true,
        data: result,
        executionMethod: 'ai'
      };
    } catch (error) {
      console.error('❌ AI execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI execution failed',
        executionMethod: 'ai'
      };
    }
  }

  /**
   * Get current URL using Magnitude
   */
  private async getCurrentUrl(): Promise<string> {
    try {
      // Use Magnitude's page property to get URL
      if (this.magnitudeAgent && this.magnitudeAgent.page) {
        return await this.magnitudeAgent.page.url();
      }
      return '';
    } catch (error) {
      console.error('Failed to get current URL:', error);
      return '';
    }
  }

  /**
   * Get current page title using Magnitude
   */
  private async getCurrentTitle(): Promise<string> {
    try {
      // Use Magnitude's page property to get title
      if (this.magnitudeAgent && this.magnitudeAgent.page) {
        return await this.magnitudeAgent.page.title();
      }
      return '';
    } catch (error) {
      console.error('Failed to get current title:', error);
      return '';
    }
  }

  /**
   * Check if element exists using Magnitude
   */
  private async checkElementExists(selector: string): Promise<boolean> {
    try {
      if (this.magnitudeAgent && this.magnitudeAgent.page) {
        const count = await this.magnitudeAgent.page.locator(selector).count();
        return count > 0;
      }
      return false;
    } catch (error) {
      console.error('Failed to check element:', error);
      return false;
    }
  }

  /**
   * Navigate to URL using Magnitude
   */
  public async navigateToUrl(url: string): Promise<boolean> {
    try {
      if (!this.magnitudeAgent) {
        console.error('Magnitude agent not initialized');
        return false;
      }
      
      console.log(`🌐 Navigating to: ${url}`);
      await this.magnitudeAgent.nav(url);
      console.log('✅ Navigation completed');
      return true;
    } catch (error) {
      console.error('Navigation failed:', error);
      return false;
    }
  }

  /**
   * Get execution statistics
   */
  public getExecutionStats() {
    return { ...this.executionStats };
  }

  /**
   * Get the Magnitude agent
   */
  public getMagnitudeAgent(): any {
    return this.magnitudeAgent;
  }
}