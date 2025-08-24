/**
 * Autonomous AI Executor for Browser Automation
 * 
 * Provides AI with full context about failures and lets it autonomously
 * complete tasks through multiple attempts and approaches
 * 
 * Uses Magnitude's dual-agent architecture:
 * - Sonnet 3.5 for vision/execution (fast, cheaper) via agent.act()
 * - Falls back to Opus 4.1 for complex reasoning if needed
 */

import { Page } from 'playwright';
import { executeRuntimeAIAction, getMagnitudeAgent } from './llm';
import { BrowserAgent } from 'magnitude-core/dist/agent/browserAgent';

export interface FailureContext {
  step: {
    name: string;
    snippet?: string;
    aiInstruction?: string;
    selectors?: string[];
    value?: any;
  };
  error: {
    message: string;
    type: string; // 'timeout', 'selector_not_found', 'navigation', etc.
  };
  attemptedSelectors: string[];
  currentPageState: {
    url: string;
    title: string;
    hasLoginForm?: boolean;
    visibleElements?: any;
  };
  previousAttempts?: Array<{
    action: string;
    result: string;
  }>;
}

export interface ExecutionResult {
  success: boolean;
  finalAction: string;
  allActions: string[];
  error?: string;
  pageState?: any;
}

export class AutonomousAIExecutor {
  private page: Page;
  private maxAttempts: number = 5;
  private debug: boolean = false;
  private magnitudeAgent: BrowserAgent | null = null;

  constructor(page: Page, options: { maxAttempts?: number; debug?: boolean } = {}) {
    this.page = page;
    this.maxAttempts = options.maxAttempts || 5;
    this.debug = options.debug || false;
  }

  /**
   * Initialize Magnitude agent for browser automation
   * Uses Magnitude's dual-agent architecture with act() function
   */
  private async initMagnitudeAgent(): Promise<BrowserAgent> {
    if (!this.magnitudeAgent) {
      try {
        this.magnitudeAgent = await getMagnitudeAgent();
        if (this.debug) {
          console.log('🤖 Magnitude agent initialized with act() function for autonomous execution');
        }
      } catch (error) {
        console.error('Failed to initialize Magnitude agent:', error);
        throw new Error('Magnitude agent required for autonomous execution');
      }
    }
    return this.magnitudeAgent;
  }

  /**
   * Autonomously complete a failed task using Magnitude's act() function
   * AI will try multiple approaches until success or max attempts
   */
  async executeAutonomously(
    failureContext: FailureContext,
    variables: Record<string, string> = {}
  ): Promise<ExecutionResult> {
    // Initialize Magnitude agent with act() function
    const agent = await this.initMagnitudeAgent();
    
    const allActions: string[] = [];
    let currentPageState = failureContext.currentPageState;
    let attempts = 0;
    
    // Build comprehensive context for AI
    const goalDescription = this.extractGoal(failureContext);
    
    while (attempts < this.maxAttempts) {
      attempts++;
      
      if (this.debug) {
        console.log(`\n🤖 AI Autonomous Attempt ${attempts}/${this.maxAttempts}`);
      }

      try {
        // Get current page state
        currentPageState = await this.getCurrentPageState();
        
        // Build task instruction for Magnitude's act() function
        const taskInstruction = this.buildTaskForMagnitude(
          failureContext,
          goalDescription,
          currentPageState,
          allActions,
          attempts,
          variables
        );

        // Execute using Magnitude's act() function
        // This leverages Magnitude's dual-agent architecture:
        // - Planner agent (Opus) for reasoning
        // - Executor agent (Sonnet) for actions
        if (this.debug) {
          console.log(`   🎯 Using Magnitude act() for: ${taskInstruction.substring(0, 100)}...`);
        }
        
        // Execute the action using Magnitude
        try {
          await agent.act(taskInstruction);
          
          // Record the action taken
          const actionDescription = `Magnitude act(): ${goalDescription}`;
          allActions.push(actionDescription);
          
          if (this.debug) {
            console.log(`   ✅ Magnitude act() completed successfully`);
          }
          
          // Wait for page to stabilize
          await this.page.waitForTimeout(1000);
          
          // Check if we've achieved the goal
          const isComplete = await this.checkGoalCompletion(failureContext, currentPageState);
          
          if (isComplete) {
            return {
              success: true,
              finalAction: actionDescription,
              allActions,
              pageState: await this.getCurrentPageState()
            };
          }
          
          if (this.debug) {
            console.log(`   ↻ Action completed but goal not yet achieved, continuing...`);
          }
          
        } catch (magnitudeError) {
          if (this.debug) {
            console.error(`   ⚠️ Magnitude act() failed:`, magnitudeError);
          }
          allActions.push(`Failed: ${magnitudeError.message}`);
        }

        // If no progress and we have more attempts, try different approach
        if (attempts < this.maxAttempts) {
          if (this.debug) {
            console.log(`   ⚠ No progress, trying different approach...`);
          }
          await this.page.waitForTimeout(500);
        }

      } catch (error) {
        if (this.debug) {
          console.error(`   ❌ Attempt ${attempts} error:`, error);
        }
        
        // Try recovery strategies
        if (attempts < this.maxAttempts) {
          await this.tryRecoveryStrategy(error, currentPageState);
        }
      }
    }

    // All attempts exhausted
    return {
      success: false,
      finalAction: allActions[allActions.length - 1] || 'No actions taken',
      allActions,
      error: `Failed after ${attempts} attempts`,
      pageState: currentPageState
    };
  }

  /**
   * Build task instruction for Magnitude's act() function
   */
  private buildTaskForMagnitude(
    failureContext: FailureContext,
    goal: string,
    currentPageState: any,
    previousActions: string[],
    attemptNumber: number,
    variables: Record<string, string>
  ): string {
    // Replace variables in the instruction
    let instruction = failureContext.step.aiInstruction || failureContext.step.name || '';
    for (const [key, value] of Object.entries(variables)) {
      instruction = instruction.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    // Build context-aware instruction for Magnitude
    const context = `
Failed step: ${failureContext.step.name}
Error: ${failureContext.error.message}
Current URL: ${currentPageState.url}
${previousActions.length > 0 ? `Previous attempts: ${previousActions.join(', ')}` : ''}
${instruction ? `Specific instruction: ${instruction}` : ''}
${failureContext.step.value ? `Value to use: ${failureContext.step.value}` : ''}
`;

    // Return a clear, actionable instruction for Magnitude's act() function
    return `${goal}. ${context.trim()}`;
  }

  /**
   * Check if the goal has been completed
   */
  private async checkGoalCompletion(failureContext: FailureContext, previousPageState: any): Promise<boolean> {
    try {
      const currentState = await this.getCurrentPageState();
      
      // Check for common success indicators
      if (failureContext.step.name?.toLowerCase().includes('login')) {
        // Check if we've navigated away from login page
        if (currentState.url !== previousPageState.url && !currentState.hasLoginForm) {
          return true;
        }
      }
      
      if (failureContext.step.name?.toLowerCase().includes('fill') || 
          failureContext.step.name?.toLowerCase().includes('enter')) {
        // Check if the value was entered
        if (failureContext.step.value) {
          const hasValue = currentState.visibleElements?.inputs?.some(
            (input: any) => input.value === failureContext.step.value
          );
          if (hasValue) return true;
        }
      }
      
      if (failureContext.step.name?.toLowerCase().includes('click')) {
        // Check if page changed after click
        if (currentState.url !== previousPageState.url || 
            currentState.title !== previousPageState.title) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Build comprehensive prompt for autonomous AI execution (fallback)
   */
  private buildAutonomousPrompt(
    failureContext: FailureContext,
    goal: string,
    currentPageState: any,
    previousActions: string[],
    attemptNumber: number,
    variables: Record<string, string>
  ): string {
    // Replace variables in the instruction
    let instruction = failureContext.step.aiInstruction || failureContext.step.name || '';
    for (const [key, value] of Object.entries(variables)) {
      instruction = instruction.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return `You are an autonomous browser automation AI. Your task is to complete a specific goal by taking whatever actions are necessary.

CONTEXT OF FAILURE:
- Original Task: ${failureContext.step.name}
- Failed Snippet: ${failureContext.step.snippet || 'N/A'}
- Error: ${failureContext.error.message}
- Error Type: ${failureContext.error.type}
- Selectors That Failed: ${failureContext.attemptedSelectors.join(', ')}

ULTIMATE GOAL:
${goal}
${instruction ? `Specific instruction: ${instruction}` : ''}
${failureContext.step.value ? `Value to enter: ${failureContext.step.value}` : ''}

CURRENT PAGE STATE:
- URL: ${currentPageState.url}
- Title: ${currentPageState.title}
- Has Login Form: ${currentPageState.hasLoginForm}
- Visible Elements: ${JSON.stringify(currentPageState.visibleElements, null, 2)}

PREVIOUS ACTIONS IN THIS SESSION:
${previousActions.length > 0 ? previousActions.map((a, i) => `${i + 1}. ${a}`).join('\n') : 'None yet'}

ATTEMPT NUMBER: ${attemptNumber}/${this.maxAttempts}

YOUR TASK:
1. Analyze why the original action failed
2. Determine what needs to be done to achieve the goal
3. Take the necessary action(s) - this may require multiple steps
4. Be creative - if direct approach fails, try alternatives

IMPORTANT:
- You can take multiple actions in sequence (e.g., click Sign In, wait, then fill form)
- If you need to navigate somewhere first, do it
- If you need to wait for elements to appear, include that
- Return executable JavaScript code that will run in the browser

Return your response as JSON:
{
  "analysis": "Why the original failed and what needs to be done",
  "actionTaken": "Description of what you did",
  "code": "JavaScript code to execute in the browser",
  "taskComplete": true/false,
  "madeProgress": true/false,
  "success": true/false
}`;
  }

  /**
   * Execute AI action with actual browser control
   */
  private async executeAIAction(prompt: string, pageState: any): Promise<any> {
    try {
      // Get AI response
      const aiResponse = await executeRuntimeAIAction(prompt, JSON.stringify(pageState));
      
      // Parse response
      let parsed;
      try {
        // Extract JSON from response if wrapped in markdown
        const jsonMatch = aiResponse.result.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          parsed = JSON.parse(aiResponse.result);
        }
      } catch {
        // Fallback if parsing fails
        parsed = {
          actionTaken: aiResponse.result,
          success: aiResponse.success,
          taskComplete: false,
          madeProgress: false,
          code: null
        };
      }

      // Execute the code if provided
      if (parsed.code) {
        try {
          if (this.debug) {
            console.log(`   Executing: ${parsed.code.substring(0, 100)}...`);
          }
          
          // Execute in browser context
          const result = await this.page.evaluate(parsed.code);
          
          // Update parsed result based on execution
          parsed.executionResult = result;
          parsed.success = true;
          
        } catch (execError) {
          if (this.debug) {
            console.error(`   Code execution failed:`, execError);
          }
          parsed.success = false;
          parsed.error = execError.message;
        }
      }

      return parsed;

    } catch (error) {
      throw new Error(`AI execution failed: ${error.message}`);
    }
  }

  /**
   * Get current page state for AI context
   */
  private async getCurrentPageState(): Promise<any> {
    try {
      const pageData = await this.page.evaluate(() => {
        // Find all interactive elements
        const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
          type: el.getAttribute('type'),
          name: el.getAttribute('name'),
          id: el.id,
          placeholder: el.getAttribute('placeholder'),
          value: (el as HTMLInputElement).value,
          visible: (el as HTMLElement).offsetParent !== null,
          selector: el.id ? `#${el.id}` : el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : null
        })).filter(i => i.visible);

        const buttons = Array.from(document.querySelectorAll('button, [type="submit"], a')).map(el => ({
          text: el.textContent?.trim(),
          type: el.getAttribute('type'),
          href: el.getAttribute('href'),
          visible: (el as HTMLElement).offsetParent !== null,
          selector: el.id ? `#${el.id}` : null
        })).filter(b => b.visible && b.text);

        // Check for common patterns
        const hasLoginForm = inputs.some(i => i.type === 'password') || 
                            inputs.some(i => i.name?.toLowerCase().includes('login') || 
                                         i.name?.toLowerCase().includes('email'));

        const hasSignInButton = buttons.some(b => 
          b.text?.toLowerCase().includes('sign in') || 
          b.text?.toLowerCase().includes('login')
        );

        return {
          url: window.location.href,
          title: document.title,
          hasLoginForm,
          hasSignInButton,
          visibleElements: {
            inputs: inputs.slice(0, 10),
            buttons: buttons.slice(0, 10)
          },
          bodyText: document.body.innerText.substring(0, 500)
        };
      });

      return pageData;
    } catch (error) {
      return {
        url: await this.page.url(),
        title: await this.page.title(),
        error: 'Failed to extract page state'
      };
    }
  }

  /**
   * Extract the goal from failure context
   */
  private extractGoal(failureContext: FailureContext): string {
    const step = failureContext.step;
    
    if (step.name?.toLowerCase().includes('login email')) {
      return 'Enter the login email address in the appropriate field';
    } else if (step.name?.toLowerCase().includes('password')) {
      return 'Enter the password in the password field';
    } else if (step.name?.toLowerCase().includes('click login')) {
      return 'Click the login/submit button to authenticate';
    } else if (step.snippet) {
      // Try to extract from snippet
      if (step.snippet.includes('fill')) {
        return `Fill the field with value: ${step.value || 'specified value'}`;
      } else if (step.snippet.includes('click')) {
        return 'Click the specified element';
      } else if (step.snippet.includes('goto')) {
        return 'Navigate to the specified URL';
      }
    }
    
    return step.aiInstruction || step.name || 'Complete the specified action';
  }

  /**
   * Try recovery strategies when an attempt fails
   */
  private async tryRecoveryStrategy(error: any, pageState: any): Promise<void> {
    if (this.debug) {
      console.log('   🔧 Attempting recovery...');
    }

    try {
      // If we're on an error page, try to go back
      if (pageState.title?.toLowerCase().includes('error') || 
          pageState.bodyText?.toLowerCase().includes('404')) {
        await this.page.goBack().catch(() => {});
        await this.page.waitForTimeout(1000);
        return;
      }

      // If timeout error, wait and retry
      if (error.message?.includes('timeout')) {
        await this.page.waitForTimeout(2000);
        return;
      }

      // Generic recovery - wait a bit
      await this.page.waitForTimeout(1000);
      
    } catch (recoveryError) {
      if (this.debug) {
        console.warn('   Recovery failed:', recoveryError);
      }
    }
  }
}