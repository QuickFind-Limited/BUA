import { WebContentsView } from 'electron';
import { Browser, Page } from 'playwright';
import { PreFlightAnalyzer, PreFlightAnalysis } from './preflight-analyzer';
import { ErrorAnalyzer, ErrorAnalysis } from './error-analyzer';
import { getMagnitudeAgent, executeRuntimeAIAction } from './llm';
import { FallbackStrategies, handleStrictModeViolation, executeWithAllFallbacks } from './fallback-strategies';
import { AutonomousAIExecutor, FailureContext } from './autonomous-ai-executor';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Enhanced Magnitude WebView Controller
 * Integrates Pre-Flight Analysis, Enhanced Error Recovery, and Smart Skip Logic
 */

interface ExecutionResult {
  success: boolean;
  error?: string;
  data?: any;
  skipped?: boolean;
  skipReason?: string;
  executionMethod?: 'snippet' | 'ai' | 'hybrid';
  retryCount?: number;
  recoveryActions?: string[];
  allActions?: string[];  // All actions taken by autonomous AI
}

interface StepExecutionContext {
  step: any;
  variables: Record<string, string>;
  retryCount: number;
  previousErrors: Error[];
  skipHistory: string[];
}

export class EnhancedMagnitudeController {
  private webView: WebContentsView | null = null;
  private playwrightPage: Page | null = null;
  private playwrightBrowser: Browser | null = null;
  private isConnected = false;
  private userDataDir: string = path.join(process.cwd(), 'playwright-profile');
  
  private preFlightAnalyzer: PreFlightAnalyzer;
  private errorAnalyzer: ErrorAnalyzer;
  private magnitudeAgent: any = null;
  
  // Execution statistics for optimization
  private executionStats = {
    snippetSuccess: 0,
    snippetFailure: 0,
    aiSuccess: 0,
    aiFailure: 0,
    skippedSteps: 0,
    totalSteps: 0
  };

  constructor() {
    this.preFlightAnalyzer = new PreFlightAnalyzer();
    this.errorAnalyzer = new ErrorAnalyzer();
    
    // Ensure user data directory exists
    this.ensureUserDataDir();
  }
  
  private ensureUserDataDir(): void {
    try {
      if (!fs.existsSync(this.userDataDir)) {
        fs.mkdirSync(this.userDataDir, { recursive: true });
        console.log(`📁 Created browser profile directory: ${this.userDataDir}`);
      }
      
      // Create a First Run file to suppress Chrome's first run experience
      const firstRunFile = path.join(this.userDataDir, 'First Run');
      if (!fs.existsSync(firstRunFile)) {
        fs.writeFileSync(firstRunFile, '');
        console.log(`✅ Created First Run file to suppress Chrome welcome screen`);
      }
    } catch (error) {
      console.error('Failed to create user data directory:', error);
    }
  }

  /**
   * Connect to WebView using Playwright CDP
   */
  public async connectToWebView(webView: WebContentsView): Promise<boolean> {
    try {
      this.webView = webView;
      
      // Import chromium from playwright
      const { chromium } = await import('playwright');
      
      // Get the actual CDP port from environment variable (set by main-comprehensive.js)
      // The CDP port is randomly generated between 9335-9435
      const cdpPort = process.env.CDP_PORT || '9335';
      console.log(`🔍 CDP_PORT from environment: ${cdpPort}`);
      
      let cdpEndpoint = '';
      let connected = false;
      
      // First try the actual CDP port from environment, then fallbacks
      const portsToTry = [cdpPort, '9335', '9222', '9344', '9363', '9340', '9341', '9342', '9343', '9345', '9346', '9347', '9348', '9349', '9350'];
      
      for (const port of portsToTry) {
        try {
          const testEndpoint = `http://127.0.0.1:${port}`;
          console.log(`Trying CDP endpoint: ${testEndpoint}`);
          
          // Try to connect
          const browser = await chromium.connectOverCDP(testEndpoint);
          if (browser) {
            this.playwrightBrowser = browser;
            cdpEndpoint = testEndpoint;
            connected = true;
            console.log(`✅ Successfully connected to CDP on port ${port}`);
            break;
          }
        } catch (err) {
          // This port didn't work, try next
          continue;
        }
      }
      
      if (!connected) {
        console.error('Failed to connect to CDP on any port');
        return false;
      }
      
      if (!this.playwrightBrowser) {
        console.error('Failed to connect browser via CDP');
        return false;
      }
      
      // Get existing contexts or create new one
      const contexts = this.playwrightBrowser.contexts();
      if (contexts.length > 0) {
        // Use existing context
        const context = contexts[0];
        const pages = context.pages();
        
        if (pages.length > 0) {
          // CRITICAL: Filter out Electron UI pages and only use WebView pages
          // WebView pages should have http:// or https:// URLs (actual web content)
          let webViewPage = null;
          
          for (const page of pages) {
            const url = page.url();
            console.log(`Found page with URL: ${url}`);
            
            // ONLY use pages with http/https URLs (actual web content)
            // Skip everything else (file://, chrome://, about:, etc.)
            if (url.startsWith('http://') || url.startsWith('https://')) {
              webViewPage = page;
              console.log('✅ Found WebView page with web content, using it for automation');
              break;
            } else {
              console.log(`⚠️ Skipping non-web page: ${url}`);
              continue;
            }
          }
          
          if (webViewPage) {
            this.playwrightPage = webViewPage;
          } else {
            console.error('No WebView page found, only Electron UI pages detected');
            return false;
          }
        } else {
          // Create new page
          this.playwrightPage = await context.newPage();
          console.log('Created new page in existing context');
        }
      } else {
        console.error('No contexts found in connected browser');
        return false;
      }
      
      if (!this.playwrightPage) {
        console.error('Could not establish page connection');
        return false;
      }
      
      // Don't clear cookies/session - it affects the WebView's initial state
      // The enhanced-flow-executor will navigate to the correct URL anyway
      
      this.isConnected = true;
      console.log('Successfully connected Playwright to WebContentsView');
      return true;
    } catch (error) {
      console.error('Failed to connect to WebView:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
      }
      return false;
    }
  }

  /**
   * Enhanced step execution with pre-flight analysis and intelligent error recovery
   */
  public async executeStepEnhanced(
    step: any,
    variables: Record<string, string> = {},
    context?: StepExecutionContext
  ): Promise<ExecutionResult> {
    if (!this.isConnected || !this.playwrightPage) {
      return {
        success: false,
        error: 'Not connected to WebView'
      };
    }

    const executionContext = context || {
      step,
      variables,
      retryCount: 0,
      previousErrors: [],
      skipHistory: []
    };

    this.executionStats.totalSteps++;

    try {
      // STEP 1: Quick Skip Check (without full pre-flight analysis)
      console.log(`📝 Executing step: ${step.name}`);
      
      // Check basic skip conditions if present
      if (step.skipConditions && Array.isArray(step.skipConditions)) {
        const currentUrl = await this.playwrightPage.url();
        
        for (const condition of step.skipConditions) {
          if (condition.type === 'url_match' && currentUrl.includes(condition.value)) {
            console.log(`⏭️ Skipping step: ${condition.skipReason || 'URL condition matched'}`);
            this.executionStats.skippedSteps++;
            
            return {
              success: true,
              skipped: true,
              skipReason: condition.skipReason || `URL matches ${condition.value}`,
              executionMethod: 'snippet' // Not actually executed, but need valid type
            };
          }
        }
      }

      // STEP 2: Direct Execution - Try Snippet First
      console.log(`🎯 Trying snippet-first execution for: ${step.name}`);
      
      let result: ExecutionResult;

      // Always try snippet first if available (it's fastest)
      if (step.snippet || step.prefer === 'snippet') {
        result = await this.executeWithSnippet(step, variables, null);
      } else if (step.ai_instruction || step.prefer === 'ai') {
        // If no snippet or AI is preferred, go straight to AI
        result = await this.executeWithAI(step, variables);
      } else {
        // Fallback to snippet attempt
        result = await this.executeWithSnippet(step, variables, null);
      }

      // If snippet failed and we have AI fallback, try AI
      if (!result.success && step.fallback === 'ai' && step.ai_instruction) {
        console.log(`🔄 Snippet failed, falling back to AI...`);
        result = await this.executeWithAI(step, variables);
      }

      // Update statistics based on what method succeeded
      if (result.success) {
        if (result.executionMethod === 'ai') {
          this.executionStats.aiSuccess++;
        } else if (result.executionMethod === 'snippet') {
          this.executionStats.snippetSuccess++;
        }
      } else {
        if (result.executionMethod === 'ai') {
          this.executionStats.aiFailure++;
        } else if (result.executionMethod === 'snippet') {
          this.executionStats.snippetFailure++;
        }
      }

      return result;

    } catch (error) {
      console.error(`❌ Step execution failed: ${error}`);
      
      // STEP 4: Enhanced Error Analysis
      const errorAnalysis = await this.errorAnalyzer.analyzeError(
        error,
        step,
        this.playwrightPage,
        executionContext.retryCount
      );

      // STEP 5: Attempt Recovery
      const recoveryResult = await this.attemptRecovery(
        errorAnalysis,
        executionContext
      );

      if (recoveryResult.success) {
        return recoveryResult;
      }

      // Update failure statistics
      this.executionStats.snippetFailure++;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: executionContext.retryCount,
        recoveryActions: errorAnalysis.suggestedActions.map(a => a.description)
      };
    }
  }

  /**
   * Execute step using Playwright snippet via Magnitude
   */
  private async executeWithSnippet(
    step: any,
    variables: Record<string, string>,
    preFlightAnalysis?: PreFlightAnalysis | null
  ): Promise<ExecutionResult> {
    // Replace variables in snippet
    let snippetToExecute = step.snippet || '';
    for (const [key, value] of Object.entries(variables)) {
      snippetToExecute = snippetToExecute.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    try {
      console.log(`📝 Executing snippet via Magnitude: ${snippetToExecute.substring(0, 100)}...`);

      // Get CDP endpoint from our WebView browser
      // Try multiple ports as WebView might use a different one
      let cdpEndpoint = '';
      const portsToTry = ['9335', '9222', '9344', '9363', '9340', '9341', '9342', '9343', '9345', '9346', '9347', '9348', '9349', '9350'];
      
      for (const port of portsToTry) {
        try {
          const testEndpoint = `http://127.0.0.1:${port}`;
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(`${testEndpoint}/json/version`);
          if (response.ok) {
            cdpEndpoint = testEndpoint;
            console.log(`Found CDP endpoint at port ${port}`);
            break;
          }
        } catch {
          continue;
        }
      }
      
      if (!cdpEndpoint) {
        console.error('Could not find CDP endpoint');
        cdpEndpoint = 'http://127.0.0.1:9335'; // Fallback
      }
      
      // Import getMagnitudeAgent from llm module
      const { getMagnitudeAgent } = await import('./llm');
      
      // Get Magnitude agent connected to our WebView browser
      const magnitudeAgent = await getMagnitudeAgent(cdpEndpoint);
      
      // Execute the Playwright snippet directly through Magnitude's act() function
      // Magnitude can understand and execute Playwright code
      const result = await magnitudeAgent.act(snippetToExecute);
      
      console.log(`✅ Magnitude executed snippet successfully`);
      
      return {
        success: true,
        data: result,
        executionMethod: 'snippet'
      };

    } catch (error) {
      // If snippet fails and we have AI fallback, use autonomous AI
      if (step.fallback === 'ai') {
        console.log('🤖 Snippet failed, falling back to Autonomous AI...');
        
        // Get current page state directly
        const currentUrl = await this.playwrightPage.url();
        const currentTitle = await this.playwrightPage.title();
        
        // Check if this is a "element not found" error that might need navigation
        const isElementMissing = error.message?.includes('Timeout') || 
                                error.message?.includes('waiting for locator');
        
        // Build failure context for AI
        const failureContext: FailureContext = {
          step: {
            name: step.name || 'Unknown step',
            snippet: step.snippet,
            aiInstruction: step.ai_instruction || step.aiInstruction,
            selectors: step.selectors || [],
            value: step.value,
            successCriteria: step.successCriteria
          },
          error: {
            message: error.message || 'Unknown error',
            type: this.classifyError(error)
          },
          attemptedSelectors: step.selectors || [],
          currentPageState: {
            url: currentUrl,
            title: currentTitle,
            // Additional page state will be gathered by the AI executor
            visibleElements: null
          }
        };

        // If elements are missing, first ask AI to navigate to the right place
        if (isElementMissing && step.selectors && step.selectors.length > 0) {
          console.log('📍 Elements not found, asking AI to navigate to correct page first...');
          
          // Modify the instruction to focus on navigation
          const navigationContext = { ...failureContext };
          navigationContext.step.aiInstruction = 
            `The element "${step.selectors[0]}" is not present on the current page. ` +
            `Navigate to where this element would exist. ` +
            `For login fields: Look for and click Sign In/Login buttons. ` +
            `For app features: Ensure you're logged in first. ` +
            `Once on the correct page with the element visible, stop.`;
          
          // Use AI to navigate to the right place
          const aiExecutor = new AutonomousAIExecutor(this.playwrightPage!, {
            maxAttempts: 3,
            debug: true
          });
          
          const navResult = await aiExecutor.executeAutonomously(navigationContext, variables);
          
          if (navResult.success) {
            console.log('✅ AI navigation completed, checking if elements now exist...');
            
            // Wait for page to stabilize
            await this.playwrightPage.waitForTimeout(2000);
            
            // Check if the required element now exists
            const elementExists = await this.checkElementExists(step.selectors[0]);
            
            if (elementExists) {
              console.log('🔄 Element now exists, retrying original snippet...');
              
              // Retry the original snippet now that we're on the right page
              try {
                // Get CDP endpoint and Magnitude agent
                const cdpEndpoint = await this.findCdpEndpoint();
                const { getMagnitudeAgent } = await import('./llm');
                const magnitudeAgent = await getMagnitudeAgent(cdpEndpoint);
                
                // Execute snippet via Magnitude
                const retryResult = await magnitudeAgent.act(snippetToExecute);
                return {
                  success: true,
                  data: retryResult,
                  executionMethod: 'hybrid'
                };
              } catch (retryError) {
                console.log('❌ Snippet still failed after navigation, using AI for the action...');
                // Continue to use AI for the actual action below
              }
            } else {
              console.log('⚠️ Element still not found after navigation, using AI for the full task...');
            }
          }
        }

        // Use AI executor for the full task (navigation + action)
        const aiExecutor = new AutonomousAIExecutor(this.playwrightPage!, {
          maxAttempts: 5,
          debug: true
        });

        const result = await aiExecutor.executeAutonomously(failureContext, variables);
        
        return {
          success: result.success,
          data: result.finalAction,
          executionMethod: 'ai',
          allActions: result.allActions
        };
      }
      
      throw error;
    }
  }

  /**
   * Check if an element exists on the page
   */
  private async checkElementExists(selector: string): Promise<boolean> {
    try {
      const count = await this.playwrightPage.locator(selector).count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Classify error type for AI context
   */
  private classifyError(error: any): string {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('not found') || message.includes('no element')) return 'selector_not_found';
    if (message.includes('navigation')) return 'navigation';
    if (message.includes('network')) return 'network';
    if (message.includes('click')) return 'click_failed';
    if (message.includes('fill') || message.includes('type')) return 'input_failed';
    
    return 'unknown';
  }

  /**
   * Execute step using Magnitude AI
   */
  private async executeWithAI(
    step: any,
    variables: Record<string, string>,
    preFlightAnalysis?: PreFlightAnalysis | null
  ): Promise<ExecutionResult> {
    try {
      // Prepare instruction for AI
      let instruction = step.aiInstruction || step.name || step.snippet || '';
      for (const [key, value] of Object.entries(variables)) {
        instruction = instruction.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      console.log(`🤖 Using Sonnet 4 for runtime AI action: ${instruction}`);

      // Determine if this needs full Magnitude (browser control) or just Sonnet (decision making)
      const needsBrowserControl = this.requiresBrowserControl(instruction);

      if (needsBrowserControl && this.playwrightPage) {
        // WORKAROUND: Don't pass page object directly to avoid serialization errors
        try {
          // Create a serializable context
          const pageContext = {
            url: await this.playwrightPage.url(),
            title: await this.playwrightPage.title(),
            viewport: await this.playwrightPage.viewportSize(),
            // Add any other serializable metadata needed
          };

          // Try using Magnitude with minimal context first
          if (!this.magnitudeAgent) {
            const cdpEndpoint = await this.findCdpEndpoint();
            this.magnitudeAgent = await getMagnitudeAgent(cdpEndpoint);
          }

          // Attempt workaround: Execute AI action without passing page directly
          const result = await this.executeAIActionWithWorkaround(instruction, pageContext);
          
          console.log(`✅ AI action completed: ${instruction}`);
          return {
            success: true,
            data: result,
            executionMethod: 'ai'
          };
        } catch (error) {
          // If serialization still fails, fall back to direct Playwright automation
          console.warn('AI serialization failed, using direct automation fallback');
          return await this.executeDirectAutomation(instruction, step);
        }
      } else {
        // Use autonomous AI executor for all AI tasks
        console.log(`🤖 Using Autonomous AI for: ${instruction}`);
        
        // Get current page state directly from Playwright
        const currentUrl = await this.playwrightPage.url();
        const currentTitle = await this.playwrightPage.title();
        
        // Build context for autonomous AI
        const failureContext: FailureContext = {
          step: {
            name: step.name || instruction,
            snippet: step.snippet,
            aiInstruction: instruction,
            selectors: step.selectors || [],
            value: step.value,
            successCriteria: step.successCriteria
          },
          error: {
            message: 'Direct AI execution requested',
            type: 'ai_fallback'
          },
          attemptedSelectors: [],
          currentPageState: {
            url: currentUrl,
            title: currentTitle,
            // Additional page state will be gathered by the AI executor
            visibleElements: null
          }
        };

        // Use autonomous AI executor with Magnitude's act() function
        const aiExecutor = new AutonomousAIExecutor(this.playwrightPage!, {
          maxAttempts: 5,
          debug: true
        });

        const result = await aiExecutor.executeAutonomously(failureContext, variables);
        
        return {
          success: result.success,
          data: result.finalAction,
          executionMethod: 'ai',
          allActions: result.allActions
        };
      }

    } catch (error) {
      console.error('AI execution failed:', error);
      throw error;
    }
  }

  /**
   * Determine if instruction requires browser control vs just decision making
   */
  private requiresBrowserControl(instruction: string): boolean {
    const browserKeywords = [
      'click', 'type', 'fill', 'select', 'hover', 'scroll',
      'navigate', 'press', 'drag', 'upload', 'download'
    ];
    
    const instructionLower = instruction.toLowerCase();
    return browserKeywords.some(keyword => instructionLower.includes(keyword));
  }

  /**
   * Execute AI action with serialization workaround
   */
  private async executeAIActionWithWorkaround(
    instruction: string,
    pageContext: any
  ): Promise<any> {
    // Instead of passing page object, use alternative approach
    try {
      // Option 1: Use page evaluation with AI-generated code
      const code = await this.generateActionCode(instruction, pageContext);
      return await this.playwrightPage.evaluate(code);
    } catch (error) {
      // Option 2: Break down to simpler Playwright commands
      return await this.executeSimplifiedAction(instruction);
    }
  }

  /**
   * Generate executable code for an action
   */
  private async generateActionCode(instruction: string, context: any): Promise<string> {
    // Actually use AI to generate JavaScript code that can be evaluated
    try {
      const prompt = `Generate browser JavaScript code to: ${instruction}
Context: Page URL is ${context.url}, title is "${context.title}"

IMPORTANT: Be intelligent about navigation:
- If asked to fill a login form but no login fields exist, look for and click a "Sign In" or "Login" link/button first
- If asked to enter credentials but not on a login page, navigate to the login page first
- Look for elements by text content, not just selectors

Return ONLY executable JavaScript code that can run in page.evaluate().
The code should return true if successful, false if failed.
Use document.querySelector, querySelectorAll, or search by text content.
For clicks, use element.click(). For inputs, use element.value = 'text'.

Example for finding by text:
const signInLink = Array.from(document.querySelectorAll('a, button')).find(el => 
  el.textContent && el.textContent.match(/sign\s*in|log\s*in/i)
);
if (signInLink) { signInLink.click(); return true; }

Your code:`;
      
      const result = await executeRuntimeAIAction(prompt, JSON.stringify(context));
      
      // Extract code from AI response
      let code = result.result;
      
      // Clean up the response - remove markdown code blocks if present
      code = code.replace(/```javascript\n?/g, '').replace(/```\n?/g, '');
      
      // Ensure it returns something
      if (!code.includes('return')) {
        code += '\nreturn true;';
      }
      
      return code;
    } catch (error) {
      console.error('AI code generation failed, using heuristic fallback:', error);
      // Fallback to heuristic-based solution
      if (instruction.toLowerCase().includes('click')) {
        const target = instruction.match(/click[^\w]*([^"']+)/i)?.[1] || '';
        return `
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.toLowerCase().includes('${target.toLowerCase()}')
          );
          const visible = elements.find(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (visible) { visible.click(); return true; }
          return false;
        `;
      }
      return 'return false;';
    }
  }

  /**
   * Execute simplified action without AI
   */
  private async executeSimplifiedAction(instruction: string): Promise<any> {
    // Use FallbackStrategies class
    const fallback = new FallbackStrategies(this.playwrightPage);
    
    // Parse instruction and execute basic Playwright commands
    const lower = instruction.toLowerCase();
    
    if (lower.includes('click')) {
      const target = this.extractTargetFromInstruction(instruction);
      return await fallback.clickWithFallbacks(target);
    }
    
    if (lower.includes('fill') || lower.includes('type') || lower.includes('enter')) {
      const target = this.extractTargetFromInstruction(instruction);
      const value = this.extractValueFromInstruction(instruction);
      return await fallback.fillWithFallbacks(target, value);
    }
    
    throw new Error('Could not execute simplified action');
  }

  /**
   * Helper: Extract target from instruction
   */
  private extractTargetFromInstruction(instruction: string): string {
    // Remove common action prefixes
    const cleaned = instruction.replace(/^(click|select|fill|type|enter|tap|press)\s+(on\s+|the\s+)?/i, '');
    
    // Extract text between quotes
    const quotedMatch = cleaned.match(/["']([^"']+)["']/);
    if (quotedMatch) return quotedMatch[1];
    
    // Remove common suffixes
    const target = cleaned.replace(/\s+(button|field|link|tab|section|element|option)$/i, '').trim();
    
    return target;
  }

  /**
   * Helper: Extract value from instruction
   */
  private extractValueFromInstruction(instruction: string): string {
    // Extract value after 'with', 'to', or '='
    const patterns = [
      /with\s+["']?([^"']+)["']?$/i,
      /to\s+["']?([^"']+)["']?$/i,
      /=\s*["']?([^"']+)["']?$/i,
      /value\s+["']?([^"']+)["']?$/i
    ];
    
    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) return match[1].trim();
    }
    
    return '';
  }

  /**
   * Direct automation fallback without AI
   */
  private async executeDirectAutomation(instruction: string, step: any): Promise<ExecutionResult> {
    console.log('📌 Using direct automation fallback (no AI)');
    
    try {
      // Use FallbackStrategies class
      const fallback = new FallbackStrategies(this.playwrightPage);
      
      // Try multiple strategies to complete the action
      const strategies = [
        () => fallback.tryTextBasedAction(instruction),
        () => fallback.tryRoleBasedAction(instruction),
        () => fallback.tryXPathAction(instruction),
        () => fallback.tryKeyboardNavigation(instruction)
      ];
      
      for (const strategy of strategies) {
        try {
          const result = await strategy();
          if (result) {
            return {
              success: true,
              data: result,
              executionMethod: 'ai' // Keep as 'ai' to match interface
            };
          }
        } catch (e) {
          // Try next strategy
          continue;
        }
      }
      
      throw new Error('All fallback strategies failed');
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionMethod: 'ai' // Keep as 'ai' to match interface
      };
    }
  }

  /**
   * Execute with hybrid approach (snippet + AI assistance)
   */
  private async executeHybrid(
    step: any,
    variables: Record<string, string>,
    preFlightAnalysis: PreFlightAnalysis
  ): Promise<ExecutionResult> {
    try {
      // First try snippet
      const snippetResult = await this.executeWithSnippet(step, variables, preFlightAnalysis);
      if (snippetResult.success) {
        return { ...snippetResult, executionMethod: 'hybrid' };
      }
    } catch {
      // Snippet failed, continue with AI
    }

    // Use AI to complete the task
    console.log('🔄 Hybrid execution: snippet failed, using AI...');
    const aiResult = await this.executeWithAI(step, variables, preFlightAnalysis);
    return { ...aiResult, executionMethod: 'hybrid' };
  }

  /**
   * Attempt recovery based on error analysis
   */
  private async attemptRecovery(
    errorAnalysis: ErrorAnalysis,
    context: StepExecutionContext
  ): Promise<ExecutionResult> {
    if (!errorAnalysis.isRecoverable || context.retryCount >= 3) {
      return {
        success: false,
        error: 'Recovery not possible'
      };
    }

    console.log(`🔧 Attempting recovery: ${errorAnalysis.suggestedActions[0]?.description}`);

    // Try the top suggested action
    const topAction = errorAnalysis.suggestedActions[0];
    if (!topAction) {
      return { success: false, error: 'No recovery actions available' };
    }

    switch (topAction.action) {
      case 'retry':
        // Simple retry with increased timeout
        await this.playwrightPage!.setDefaultTimeout(30000);
        return await this.executeStepEnhanced(
          context.step,
          context.variables,
          { ...context, retryCount: context.retryCount + 1 }
        );

      case 'use_ai':
        // Switch to AI execution
        if (!this.magnitudeAgent) {
          const cdpEndpoint = await this.findCdpEndpoint();
          this.magnitudeAgent = await getMagnitudeAgent(cdpEndpoint);
        }
        
        const aiResult = await this.executeWithAI(
          context.step,
          context.variables,
          {} as PreFlightAnalysis // Simplified for recovery
        );
        return aiResult;

      case 'wait':
        // Wait and retry
        await this.playwrightPage!.waitForTimeout(5000);
        return await this.executeStepEnhanced(
          context.step,
          context.variables,
          { ...context, retryCount: context.retryCount + 1 }
        );

      case 'refresh':
        // Refresh page and retry
        await this.playwrightPage!.reload();
        await this.playwrightPage!.waitForLoadState('networkidle');
        return await this.executeStepEnhanced(
          context.step,
          context.variables,
          { ...context, retryCount: context.retryCount + 1 }
        );

      case 'skip':
        // Skip the step
        return {
          success: true,
          skipped: true,
          skipReason: topAction.description
        };

      case 'alternative_selector':
        // Try alternative approaches
        if (errorAnalysis.alternativeApproaches?.length) {
          for (const alternative of errorAnalysis.alternativeApproaches) {
            try {
              const result = await this.evaluateSnippet(alternative.snippet);
              return {
                success: true,
                data: result,
                executionMethod: 'snippet',
                recoveryActions: ['Used alternative selector']
              };
            } catch {
              continue;
            }
          }
        }
        return { success: false, error: 'All alternatives failed' };

      default:
        return { success: false, error: 'Unknown recovery action' };
    }
  }

  /**
   * Evaluate Playwright snippet via Magnitude with strict mode handling
   * Note: This method now routes through Magnitude's act() function
   * which provides better error handling and automatic retries
   */
  private async evaluateSnippet(snippet: string): Promise<any> {
    if (!this.playwrightPage) {
      throw new Error('Page not available');
    }

    const page = this.playwrightPage;
    
    try {
      // Use Magnitude to execute the snippet
      const cdpEndpoint = await this.findCdpEndpoint();
      const { getMagnitudeAgent } = await import('./llm');
      const magnitudeAgent = await getMagnitudeAgent(cdpEndpoint);
      
      // Execute the snippet through Magnitude's act() function
      return await magnitudeAgent.act(snippet);
    } catch (error) {
      // If dynamic execution fails, fall back to pattern matching
      console.log('Dynamic execution failed, trying pattern matching:', error);
      
      // Handle page.goto
      if (snippet.includes('page.goto')) {
        const urlMatch = snippet.match(/page\.goto\(['"]([^'"]+)['"]\)/);
        if (urlMatch) {
          return await page.goto(urlMatch[1]);
        }
      }
      
      // Handle page.getByRole (more complex pattern)
      if (snippet.includes('page.getByRole')) {
        // Match patterns like: page.getByRole('textbox', { name: 'Email address or mobile number' })
        const roleMatch = snippet.match(/page\.getByRole\(['"](\w+)['"],\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}\)/);
        if (roleMatch) {
          const [, role, name] = roleMatch;
          return await page.getByRole(role as any, { name }).first();
        }
      }
      
      // Handle .click() at the end
      if (snippet.includes('.click()')) {
        // First get the element, then click it
        const elementSnippet = snippet.replace('.click()', '');
        const element = await this.evaluateSnippet(elementSnippet);
        if (element) {
          return await element.click();
        }
      }
      
      // Handle .fill() 
      if (snippet.includes('.fill(')) {
        const fillMatch = snippet.match(/(.+)\.fill\(['"]([^'"]+)['"]\)/);
        if (fillMatch) {
          const [, elementSnippet, value] = fillMatch;
          const element = await this.evaluateSnippet(elementSnippet);
          if (element) {
            return await element.fill(value);
          }
        }
      }
      
      // Handle page.locator
      if (snippet.includes('page.locator')) {
        const locatorMatch = snippet.match(/page\.locator\(['"]([^'"]+)['"]\)/);
        if (locatorMatch) {
          return await page.locator(locatorMatch[1]).first();
        }
      }
      
      // Handle .filter()
      if (snippet.includes('.filter(')) {
        // This is complex, skip for now and throw error
        throw new Error(`Complex filter pattern not supported: ${snippet.substring(0, 100)}`);
      }
      
      throw error;
    }
  }

  /**
   * Get execution statistics for monitoring and optimization
   */
  public getExecutionStats() {
    const total = this.executionStats.snippetSuccess + 
                  this.executionStats.snippetFailure +
                  this.executionStats.aiSuccess + 
                  this.executionStats.aiFailure;

    return {
      ...this.executionStats,
      snippetSuccessRate: total > 0 
        ? this.executionStats.snippetSuccess / total 
        : 0,
      aiSuccessRate: total > 0 
        ? this.executionStats.aiSuccess / total 
        : 0,
      skipRate: this.executionStats.totalSteps > 0
        ? this.executionStats.skippedSteps / this.executionStats.totalSteps
        : 0
    };
  }

  /**
   * Reset execution statistics
   */
  public resetStats() {
    this.executionStats = {
      snippetSuccess: 0,
      snippetFailure: 0,
      aiSuccess: 0,
      aiFailure: 0,
      skippedSteps: 0,
      totalSteps: 0
    };
  }

  /**
   * Get the Playwright page instance
   */
  public async getPlaywrightPage(): Promise<any> {
    return this.playwrightPage;
  }

  /**
   * Find the CDP endpoint by trying multiple ports
   */
  private async findCdpEndpoint(): Promise<string> {
    // Get the actual CDP port from environment variable (set by main-comprehensive.js)
    const cdpPort = process.env.CDP_PORT || '9335';
    console.log(`🔍 Using CDP_PORT from environment: ${cdpPort}`);
    
    // If we have the CDP port from environment, just use it directly
    if (cdpPort && cdpPort !== '9335') {
      return `http://127.0.0.1:${cdpPort}`;
    }
    
    // Otherwise try common ports
    const portsToTry = [cdpPort, '9335', '9222', '9344', '9363', '9340', '9341', '9342', '9343', '9345', '9346', '9347', '9348', '9349', '9350'];
    
    for (const port of portsToTry) {
      try {
        const testEndpoint = `http://127.0.0.1:${port}`;
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${testEndpoint}/json/version`, { timeout: 1000 });
        if (response.ok) {
          console.log(`Found CDP endpoint at port ${port}`);
          return testEndpoint;
        }
      } catch {
        continue;
      }
    }
    
    console.warn('Could not find CDP endpoint, using default port 9335');
    return 'http://127.0.0.1:9335';
  }
}