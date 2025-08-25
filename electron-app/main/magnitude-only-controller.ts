import { WebContentsView } from 'electron';
import { getMagnitudeAgent } from './llm';
import { AutonomousAIExecutor, FailureContext } from './autonomous-ai-executor';
import { MagnitudeElectronAdapter } from './magnitude-electron-adapter';

interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  aiUsed?: boolean;
  method?: 'snippet' | 'ai' | 'mixed';
}

interface StepResult {
  success: boolean;
  action?: string;
  method?: 'snippet' | 'ai' | 'magnitude-snippet';
  error?: string;
  needsRetry?: boolean;
  skipped?: boolean;
  skipReason?: string;
  executionMethod?: string;
}

/**
 * MagnitudeOnlyController - Uses only Magnitude for all browser automation
 * This replaces the hybrid Playwright + Magnitude approach
 * All automation (snippets and AI) goes through Magnitude's act() function
 */
export class MagnitudeOnlyController {
  private webView: WebContentsView | null = null;
  private magnitudeAgent: any = null;
  private isConnected: boolean = false;
  private aiExecutor: AutonomousAIExecutor | null = null;
  private executionLogs: any[] = [];
  private playwrightPage: any = null; // Store the WebView-specific page

  constructor() {
    console.log('🚀 MagnitudeOnlyController initialized');
  }

  /**
   * Connect to WebView using Magnitude
   */
  public async connectToWebView(webView: WebContentsView): Promise<boolean> {
    try {
      this.webView = webView;
      
      // Import chromium from playwright to connect to CDP first
      const { chromium } = await import('playwright');
      
      // Get the CDP port from environment
      const cdpPort = process.env.CDP_PORT || '9335';
      let cdpEndpoint = `http://127.0.0.1:${cdpPort}`;
      
      console.log(`🔗 Connecting to CDP endpoint: ${cdpEndpoint}`);
      
      // Connect Playwright to CDP first
      const playwrightBrowser = await chromium.connectOverCDP(cdpEndpoint);
      if (!playwrightBrowser) {
        console.error('Failed to connect Playwright to CDP');
        return false;
      }
      
      // Get existing contexts
      const contexts = playwrightBrowser.contexts();
      if (contexts.length === 0) {
        console.error('No contexts found in connected browser');
        return false;
      }
      
      // Find the WebView page (not Electron UI pages)
      const context = contexts[0];
      const pages = context.pages();
      let webViewPage = null;
      
      for (const page of pages) {
        const url = page.url();
        console.log(`Found page with URL: ${url}`);
        
        // ONLY use pages with http/https URLs (actual web content)
        // Skip everything else (file://, chrome://, about:, etc.)
        if (url.startsWith('http://') || url.startsWith('https://')) {
          webViewPage = page;
          console.log('✅ Found WebView page with web content');
          break;
        } else {
          console.log(`⚠️ Skipping non-web page: ${url}`);
        }
      }
      
      if (!webViewPage) {
        console.error('No WebView page found, only Electron UI pages detected');
        await playwrightBrowser.close();
        return false;
      }
      
      // Store the WebView page for direct use
      this.playwrightPage = webViewPage;
      
      // PATCHED MAGNITUDE APPROACH: Magnitude controls everything but ONLY WebView pages
      // The patched Magnitude will ignore all non-http/https pages (Electron UI)
      
      console.log('🎯 Using patched Magnitude - controls WebView pages only');
      
      // Initialize Magnitude with the CDP endpoint
      // It will now automatically filter out non-WebView pages
      const magnitudeAgent = await getMagnitudeAgent(cdpEndpoint);
      
      if (!magnitudeAgent) {
        console.error('Failed to initialize Magnitude agent');
        return false;
      }
      
      this.magnitudeAgent = magnitudeAgent;
      console.log('✅ Patched Magnitude ready - will control ONLY WebView pages!');
      
      this.isConnected = true;
      console.log('✅ Successfully connected to WebView page ONLY (not entire Electron UI)');
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
    variables: Record<string, string>,
    options: {
      retryOnFailure?: boolean;
      maxRetries?: number;
      fallbackToAI?: boolean;
    } = {}
  ): Promise<StepResult> {
    const { 
      retryOnFailure = true, 
      maxRetries = 3, 
      fallbackToAI = true 
    } = options;

    console.log(`📝 Executing step: ${step.name}`);

    // Replace variables in snippet
    let snippetToExecute = step.snippet;
    if (snippetToExecute && variables) {
      Object.entries(variables).forEach(([key, value]) => {
        snippetToExecute = snippetToExecute.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    let attempts = 0;
    let lastError: Error | null = null;
    let result: StepResult | null = null;

    // Try snippet execution first if preferred
    if (step.prefer === 'snippet' && snippetToExecute) {
      // Only retry if we don't have alternative selectors
      const hasAlternatives = (step.selectors && step.selectors.length > 1) || 
                              (step.errorHandling?.fallbackSelectors && step.errorHandling.fallbackSelectors.length > 0);
      
      const retriesToAttempt = hasAlternatives ? 1 : maxRetries; // If we have alternatives, only try once
      
      while (attempts < retriesToAttempt) {
        attempts++;
        try {
          result = await this.executeWithSnippet(step, variables);
          if (result.success) {
            return result;
          }
        } catch (error) {
          lastError = error as Error;
          console.log(`Snippet execution failed: ${lastError.message}`);
          if (attempts < retriesToAttempt) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }

    // Fallback to AI if snippet failed and fallback is enabled
    console.log('🔍 Checking AI fallback conditions:');
    console.log('  - fallbackToAI:', fallbackToAI);
    console.log('  - step.fallback:', step.fallback);
    console.log('  - step.ai_instruction exists:', !!step.ai_instruction);
    console.log('  - All retries exhausted:', attempts >= maxRetries);
    
    if (fallbackToAI && step.fallback === 'ai' && step.ai_instruction) {
      console.log('🤖 Preparing for AI fallback...');
      
      try {
        // Initialize AI executor if not already done
        if (!this.aiExecutor) {
          this.aiExecutor = new AutonomousAIExecutor();
        }

        // Create failure context for AI (matching the expected interface)
        const failureContext: FailureContext = {
          step: {
            name: step.name,
            snippet: step.snippet,
            aiInstruction: step.ai_instruction,
            selectors: step.selectors || [],
            value: step.value
          },
          error: {
            message: lastError?.message || 'Snippet execution failed',
            type: 'snippet_failure'
          },
          attemptedSelectors: step.selectors || [],
          currentPageState: await this.getPageState(),
          previousAttempts: []
        };

        // Execute with AI using Magnitude's act() function
        // Replace variables with actual values in the AI instruction
        let aiInstruction = step.ai_instruction.replace(/{{(\w+)}}/g, (match, key) => {
          return variables[key] || match;
        });
        
        // For fill actions, make sure to include the actual value in the instruction
        if (step.value) {
          const actualValue = step.value.replace(/{{(\w+)}}/g, (match, key) => {
            return variables[key] || match;
          });
          aiInstruction = `${aiInstruction} The value to enter is: "${actualValue}"`;
        }
        
        // CRITICAL: For AI, we still need Magnitude but we should ensure
        // it's operating on the correct page context
        console.log('🤖 Executing AI instruction on WebView page:', aiInstruction);
        
        // Ensure we're on the right page before AI execution
        if (this.playwrightPage) {
          // Make sure the WebView page is focused
          await this.playwrightPage.bringToFront();
        }
        
        const aiResult = await this.magnitudeAgent.act(aiInstruction);

        // Magnitude's act() doesn't return success/failure, it just executes
        // If we get here without throwing, consider it successful
        return {
          success: true,
          action: step.ai_instruction,
          method: 'ai'
        };
      } catch (aiError) {
        console.error('AI fallback failed:', aiError);
        lastError = aiError as Error;
      }
    }

    // If everything failed, return failure
    return {
      success: false,
      error: lastError?.message || 'Step execution failed',
      needsRetry: false
    };
  }

  /**
   * Execute a step using direct Playwright with intelligent validation
   */
  private async executeWithSnippet(
    step: any,
    variables: Record<string, string>
  ): Promise<StepResult> {
    // Get Magnitude's underlying Playwright page
    const page = this.magnitudeAgent.page;
    if (!page) {
      throw new Error('No Playwright page available from Magnitude');
    }

    // Replace variables in snippet
    let snippetToExecute = step.snippet;
    if (snippetToExecute && variables) {
      Object.entries(variables).forEach(([key, value]) => {
        snippetToExecute = snippetToExecute.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    console.log(`⚡ Executing snippet DIRECTLY with validation: ${snippetToExecute.substring(0, 100)}...`);

    // For fill and click operations, try alternative selectors if the first fails
    if (snippetToExecute.includes('page.fill(') || snippetToExecute.includes('page.click(')) {
      // Get all possible selectors
      const selectors = step.selectors || [];
      const fallbackSelectors = step.errorHandling?.fallbackSelectors || [];
      const allSelectors = [...new Set([...selectors, ...fallbackSelectors])]; // Remove duplicates
      
      // Extract the value for fill operations
      const fillMatch = snippetToExecute.match(/(?:await\s+)?page\.fill\(['"](.+?)['"],\s*['"](.+?)['"]\)/);
      const clickMatch = snippetToExecute.match(/(?:await\s+)?page\.click\(['"](.+?)['"]\)/);
      
      if (fillMatch && allSelectors.length > 0) {
        const valueToFill = fillMatch[2];
        console.log(`🔄 Trying ${allSelectors.length} selectors for fill operation...`);
        
        // Try each selector ONCE with validation
        for (const selector of allSelectors) {
          try {
            console.log(`  → Trying selector: ${selector}`);
            
            // Check element exists and is visible before filling
            const element = await page.locator(selector).first();
            if (!await element.isVisible({ timeout: 1000 })) {
              throw new Error('Element not visible');
            }
            
            // Execute the fill
            await page.fill(selector, valueToFill, { timeout: 5000 });
            
            // Validate the fill worked
            const actualValue = await element.inputValue();
            if (actualValue !== valueToFill) {
              throw new Error(`Validation failed: expected "${valueToFill}", got "${actualValue}"`);
            }
            
            console.log(`  ✓ Success with selector: ${selector} (validated)`);
            return {
              success: true,
              action: `page.fill('${selector}', '${valueToFill}')`,
              method: 'snippet'
            };
          } catch (error) {
            console.log(`  ✗ Failed with selector ${selector}: ${error.message}`);
            // Continue to next selector
          }
        }
        
        // All selectors failed - fall back to Magnitude AI
        console.log(`❌ All selectors failed validation. Falling back to Magnitude AI...`);
        return await this.executeWithMagnitudeAI(step, variables, 'fill');
        
      } else if (clickMatch && allSelectors.length > 0) {
        console.log(`🔄 Trying ${allSelectors.length} selectors for click operation...`);
        
        // Try each selector ONCE with validation
        for (const selector of allSelectors) {
          try {
            console.log(`  → Trying selector: ${selector}`);
            
            // Check element exists and is clickable before clicking
            const element = await page.locator(selector).first();
            if (!await element.isVisible({ timeout: 1000 })) {
              throw new Error('Element not visible');
            }
            if (!await element.isEnabled({ timeout: 1000 })) {
              throw new Error('Element not enabled');
            }
            
            // Store current URL to detect navigation
            const urlBefore = page.url();
            
            // Execute the click
            await page.click(selector, { timeout: 5000 });
            
            // Basic validation - wait a bit to see if action had effect
            await page.waitForTimeout(500);
            
            // Check if navigation occurred or element state changed
            const urlAfter = page.url();
            const navigationOccurred = urlBefore !== urlAfter;
            
            console.log(`  ✓ Success with selector: ${selector} (${navigationOccurred ? 'navigated' : 'clicked'})`);
            return {
              success: true,
              action: `page.click('${selector}')`,
              method: 'snippet'
            };
          } catch (error) {
            console.log(`  ✗ Failed with selector ${selector}: ${error.message}`);
            // Continue to next selector
          }
        }
        
        // All selectors failed - fall back to Magnitude AI
        console.log(`❌ All selectors failed validation. Falling back to Magnitude AI...`);
        return await this.executeWithMagnitudeAI(step, variables, 'click');
      }
    }

    // For other operations, execute directly with basic validation
    try {
      if (snippetToExecute.includes('page.goto(')) {
        const urlMatch = snippetToExecute.match(/(?:await\s+)?page\.goto\(['"](.+?)['"]/);
        if (urlMatch) {
          await page.goto(urlMatch[1], { waitUntil: 'domcontentloaded', timeout: 30000 });
          // Validate navigation succeeded
          const currentUrl = page.url();
          if (!currentUrl.includes(urlMatch[1].split('#')[0].split('?')[0])) {
            throw new Error(`Navigation validation failed: expected to reach ${urlMatch[1]}, but at ${currentUrl}`);
          }
        }
      } else if (snippetToExecute.includes('page.fill(')) {
        const fillMatch = snippetToExecute.match(/(?:await\s+)?page\.fill\(['"](.+?)['"],\s*['"](.+?)['"]\)/);
        if (fillMatch) {
          await page.fill(fillMatch[1], fillMatch[2]);
          // Validate fill
          const actualValue = await page.locator(fillMatch[1]).inputValue();
          if (actualValue !== fillMatch[2]) {
            throw new Error(`Fill validation failed: expected "${fillMatch[2]}", got "${actualValue}"`);
          }
        }
      } else if (snippetToExecute.includes('page.click(')) {
        const clickMatch = snippetToExecute.match(/(?:await\s+)?page\.click\(['"](.+?)['"]\)/);
        if (clickMatch) {
          await page.click(clickMatch[1]);
        }
      } else if (snippetToExecute.includes('page.waitForSelector(')) {
        const waitMatch = snippetToExecute.match(/(?:await\s+)?page\.waitForSelector\(['"](.+?)['"]\)/);
        if (waitMatch) {
          await page.waitForSelector(waitMatch[1], { timeout: 5000 });
        }
      } else {
        // For other snippets, evaluate them directly
        await eval(`(async () => { const page = this.magnitudeAgent.page; ${snippetToExecute} })()`);
      }
      
      console.log('✅ Snippet executed successfully with validation');
      
      return {
        success: true,
        action: snippetToExecute,
        method: 'snippet'
      };
    } catch (error) {
      console.error('❌ Snippet execution failed validation:', error.message);
      // Fall back to Magnitude AI
      console.log('🤖 Falling back to Magnitude AI...');
      return await this.executeWithMagnitudeAI(step, variables, 'general');
    }
  }

  /**
   * Execute using Magnitude AI as fallback when direct execution fails
   */
  private async executeWithMagnitudeAI(
    step: any,
    variables: Record<string, string>,
    actionType: 'fill' | 'click' | 'general'
  ): Promise<StepResult> {
    console.log(`🤖 Using Magnitude AI to handle: ${step.ai_instruction || step.name}`);
    
    // Build natural language instruction from the step
    let instruction = step.ai_instruction || step.name;
    
    // Add context about what we're trying to do
    if (actionType === 'fill' && variables) {
      Object.entries(variables).forEach(([key, value]) => {
        instruction = instruction.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }
    
    try {
      // Use Magnitude's natural language understanding
      await this.magnitudeAgent.act(instruction);
      
      console.log('✅ Magnitude AI successfully handled the action');
      return {
        success: true,
        action: instruction,
        method: 'ai'
      };
    } catch (error) {
      console.error('❌ Magnitude AI also failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current page state for AI context
   */
  private async getPageState(): Promise<any> {
    if (!this.magnitudeAgent || !this.magnitudeAgent.page) {
      return {
        url: 'unknown',
        title: 'unknown',
        hasLoginForm: false
      };
    }

    try {
      const page = this.magnitudeAgent.page;
      const url = await page.url();
      const title = await page.title();
      
      // Check for common login elements
      const hasLoginForm = await page.locator('input[type="email"], input[type="password"], #LOGIN_ID').count() > 0;
      
      return {
        url,
        title,
        hasLoginForm
      };
    } catch (error) {
      console.error('Failed to get page state:', error);
      return {
        url: 'error',
        title: 'error',
        hasLoginForm: false
      };
    }
  }

  /**
   * Navigate to a URL using Magnitude
   */
  public async navigate(url: string): Promise<boolean> {
    if (!this.isConnected || !this.magnitudeAgent) {
      console.error('Not connected to WebView');
      return false;
    }

    try {
      await this.magnitudeAgent.nav(url);
      console.log(`📍 Navigated to: ${url}`);
      return true;
    } catch (error) {
      console.error('Navigation failed:', error);
      return false;
    }
  }

  /**
   * Disconnect and cleanup
   */
  public async disconnect(): Promise<void> {
    this.isConnected = false;
    this.magnitudeAgent = null;
    this.webView = null;
    if (this.aiExecutor) {
      this.aiExecutor = null;
    }
    console.log('🔌 Disconnected from WebView');
  }

  /**
   * Check if connected
   */
  public isReady(): boolean {
    return this.isConnected && this.magnitudeAgent !== null;
  }

  /**
   * Get execution logs
   */
  public getExecutionLogs(): any[] {
    return this.executionLogs;
  }

  /**
   * Reset stats (for compatibility)
   */
  public resetStats(): void {
    this.executionLogs = [];
  }

  /**
   * Get Playwright page (for compatibility - returns the WebView-specific page)
   */
  public getPlaywrightPage(): any {
    return this.playwrightPage || this.magnitudeAgent?.page || null;
  }

  /**
   * Get execution stats (for compatibility)
   */
  public getExecutionStats(): any {
    return {
      totalSteps: this.executionLogs.length,
      successfulSteps: this.executionLogs.filter(log => log.success).length,
      failedSteps: this.executionLogs.filter(log => !log.success).length
    };
  }
}