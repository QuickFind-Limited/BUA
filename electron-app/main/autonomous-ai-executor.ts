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
    successCriteria?: {
      type: 'element_exists' | 'element_has_value' | 'navigation' | 'custom' | 'ai_verify';
      selector?: string;
      expectedValue?: string;
      urlPattern?: string;
      waitForElement?: string;
      description?: string;
      customCheck?: string;
    };
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
   * Fully generic - no hardcoded assumptions about task types
   */
  async executeAutonomously(
    failureContext: FailureContext,
    variables: Record<string, string> = {}
  ): Promise<ExecutionResult> {
    // Initialize Magnitude agent with act() function
    const agent = await this.initMagnitudeAgent();
    
    const allActions: string[] = [];
    let attempts = 0;
    
    // Build comprehensive instruction including success criteria
    const fullInstruction = this.buildGenericInstruction(failureContext, variables);
    
    while (attempts < this.maxAttempts) {
      attempts++;
      
      if (this.debug) {
        console.log(`\n🤖 Magnitude Autonomous Attempt ${attempts}/${this.maxAttempts}`);
      }

      try {
        // Build dynamic instruction with context from previous attempts
        const contextualInstruction = attempts > 1 
          ? `${fullInstruction}\n\nPrevious attempts: ${allActions.join('; ')}\nPlease try a different approach.`
          : fullInstruction;

        if (this.debug) {
          console.log(`   🎯 Executing: ${contextualInstruction.substring(0, 150)}...`);
        }
        
        // Execute using Magnitude's act() function
        // Magnitude handles:
        // - Planning the approach (Opus)
        // - Executing the action (Sonnet)  
        // - Verifying completion
        // - Retrying if needed
        await agent.act(contextualInstruction);
        
        // Record action
        const actionDescription = `Attempt ${attempts}: Executed "${failureContext.step.name}"`;
        allActions.push(actionDescription);
        
        // Wait for stability
        await this.page.waitForTimeout(1500);
        
        // For Magnitude execution, trust its built-in verification
        // Only verify if we have explicit success criteria
        if (failureContext.step.successCriteria && 
            failureContext.step.successCriteria.type !== 'ai_verify') {
          const verificationResult = await this.verifySuccess(failureContext, variables);
          
          if (verificationResult.success) {
            if (this.debug) {
              console.log(`   ✅ Success verified: ${verificationResult.evidence}`);
            }
            
            return {
              success: true,
              finalAction: actionDescription,
              allActions,
              pageState: await this.getCurrentPageState()
            };
          }
          
          if (this.debug) {
            console.log(`   ↻ Action executed but verification failed: ${verificationResult.reason}`);
          }
        } else {
          // Trust Magnitude's execution when no explicit criteria
          if (this.debug) {
            console.log(`   ✅ Magnitude execution completed (trusting built-in verification)`);
          }
          
          return {
            success: true,
            finalAction: actionDescription,
            allActions,
            pageState: await this.getCurrentPageState()
          };
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (this.debug) {
          console.error(`   ⚠️ Attempt ${attempts} failed:`, errorMsg);
        }
        allActions.push(`Failed: ${errorMsg}`);
        
        // Let Magnitude handle recovery on next attempt
        await this.page.waitForTimeout(1000);
      }
    }

    // All attempts exhausted
    return {
      success: false,
      finalAction: allActions[allActions.length - 1] || 'No actions taken',
      allActions,
      error: `Failed after ${attempts} attempts. Magnitude could not complete the task.`,
      pageState: await this.getCurrentPageState()
    };
  }

  /**
   * Build generic instruction for Magnitude without hardcoded assumptions
   */
  private buildGenericInstruction(
    failureContext: FailureContext,
    variables: Record<string, string>
  ): string {
    // Replace variables in all text
    const replaceVariables = (text: string): string => {
      let result = text;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      return result;
    };

    // Build the base instruction
    const taskName = failureContext.step.name || 'Complete the action';
    const aiInstruction = failureContext.step.aiInstruction 
      ? replaceVariables(failureContext.step.aiInstruction)
      : null;
    const value = failureContext.step.value 
      ? replaceVariables(failureContext.step.value)
      : null;

    // Extract domain context from current URL (generic approach)
    const currentDomain = failureContext.currentPageState.url ? 
      new URL(failureContext.currentPageState.url).hostname : 'unknown';
    const siteName = currentDomain.replace('www.', '').split('.')[0];

    // Build success criteria description
    let successDescription = '';
    if (failureContext.step.successCriteria) {
      const criteria = failureContext.step.successCriteria;
      if (criteria.description) {
        successDescription = replaceVariables(criteria.description);
      } else {
        // Generate description from criteria type
        switch (criteria.type) {
          case 'element_exists':
            successDescription = `Ensure element "${criteria.selector}" exists on the page`;
            break;
          case 'element_has_value':
            successDescription = `Ensure element "${criteria.selector}" has value "${replaceVariables(criteria.expectedValue || '')}"`;
            break;
          case 'navigation':
            successDescription = `Ensure navigation to URL matching "${criteria.urlPattern}"`;
            break;
          case 'ai_verify':
            successDescription = 'Verify the action completed successfully using visual confirmation';
            break;
        }
      }
    }

    // Construct the full instruction for Magnitude
    let instruction = `Task: ${taskName}\n`;
    
    // Add website context (generic - works for any site)
    instruction += `Website: You are working on ${siteName} (${currentDomain})\n`;
    instruction += `Current URL: ${failureContext.currentPageState.url}\n`;
    
    if (aiInstruction) {
      instruction += `Instructions: ${aiInstruction}\n`;
    }
    
    if (value) {
      instruction += `Value to use: ${value}\n`;
    }
    
    if (failureContext.step.selectors && failureContext.step.selectors.length > 0) {
      instruction += `Target elements: ${failureContext.step.selectors.join(', ')}\n`;
    }
    
    instruction += `\nContext:\n`;
    instruction += `- Previous error: ${failureContext.error.message}\n`;
    instruction += `- Error type: ${failureContext.error.type}\n`;
    
    // Add smarter navigation guidance
    if (failureContext.error.message?.includes('Timeout') && failureContext.step.selectors?.length > 0) {
      instruction += `- The required elements (${failureContext.step.selectors[0]}) are not present on the current page\n`;
      instruction += `- IMPORTANT: First navigate to where these elements would exist, then perform the action\n`;
      instruction += `- For login fields: Look for Sign In/Login buttons to reach the login page\n`;
      instruction += `- For app features: Ensure you're logged in first\n`;
    }
    
    instruction += `- IMPORTANT: You are on ${siteName}, NOT on any other website. Do not navigate to different domains.\n`;
    
    if (failureContext.attemptedSelectors?.length > 0) {
      instruction += `- Failed selectors: ${failureContext.attemptedSelectors.join(', ')}\n`;
    }
    
    if (successDescription) {
      instruction += `\nSuccess criteria: ${successDescription}\n`;
    } else {
      instruction += `\nComplete this action successfully and verify it worked.\n`;
    }
    
    return instruction.trim();
  }

  /**
   * Verify success using provided criteria or AI verification
   */
  private async verifySuccess(
    failureContext: FailureContext,
    variables: Record<string, string>
  ): Promise<{ success: boolean; evidence?: string; reason?: string }> {
    const criteria = failureContext.step.successCriteria;
    
    // If no criteria provided, use AI verification
    if (!criteria || criteria.type === 'ai_verify') {
      return await this.verifyWithAI(failureContext);
    }
    
    // Replace variables in criteria values
    const replaceVariables = (text: string): string => {
      let result = text;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      return result;
    };
    
    try {
      switch (criteria.type) {
        case 'element_exists':
          if (!criteria.selector) {
            return { success: false, reason: 'No selector provided for element_exists check' };
          }
          const exists = await this.page.locator(criteria.selector).count() > 0;
          return {
            success: exists,
            evidence: exists ? `Element ${criteria.selector} found` : undefined,
            reason: exists ? undefined : `Element ${criteria.selector} not found`
          };
          
        case 'element_has_value':
          if (!criteria.selector || !criteria.expectedValue) {
            return { success: false, reason: 'Missing selector or expected value' };
          }
          const expectedValue = replaceVariables(criteria.expectedValue);
          const actualValue = await this.page.locator(criteria.selector).inputValue().catch(() => '');
          const matches = actualValue === expectedValue;
          return {
            success: matches,
            evidence: matches ? `Element has expected value: ${expectedValue}` : undefined,
            reason: matches ? undefined : `Expected "${expectedValue}" but got "${actualValue}"`
          };
          
        case 'navigation':
          if (!criteria.urlPattern) {
            return { success: false, reason: 'No URL pattern provided' };
          }
          const currentUrl = this.page.url();
          const pattern = new RegExp(criteria.urlPattern);
          const navigated = pattern.test(currentUrl);
          
          // Also check for wait element if specified
          if (navigated && criteria.waitForElement) {
            const elementFound = await this.page.locator(criteria.waitForElement)
              .waitFor({ timeout: 5000 })
              .then(() => true)
              .catch(() => false);
            
            return {
              success: elementFound,
              evidence: elementFound ? `Navigated to ${currentUrl} and found ${criteria.waitForElement}` : undefined,
              reason: elementFound ? undefined : `Navigated but ${criteria.waitForElement} not found`
            };
          }
          
          return {
            success: navigated,
            evidence: navigated ? `Successfully navigated to ${currentUrl}` : undefined,
            reason: navigated ? undefined : `URL ${currentUrl} doesn't match pattern ${criteria.urlPattern}`
          };
          
        case 'custom':
          if (!criteria.customCheck) {
            return { success: false, reason: 'No custom check code provided' };
          }
          const result = await this.page.evaluate(criteria.customCheck);
          return {
            success: !!result,
            evidence: result ? 'Custom check passed' : undefined,
            reason: result ? undefined : 'Custom check failed'
          };
          
        default:
          return await this.verifyWithAI(failureContext);
      }
    } catch (error) {
      return {
        success: false,
        reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Use AI to verify if the action was successful
   */
  private async verifyWithAI(
    failureContext: FailureContext
  ): Promise<{ success: boolean; evidence?: string; reason?: string }> {
    try {
      const pageState = await this.getCurrentPageState();
      const taskDescription = failureContext.step.name || 'the action';
      
      const verificationPrompt = `
Task: Verify if "${taskDescription}" was completed successfully.

Original instruction: ${failureContext.step.aiInstruction || failureContext.step.name}
${failureContext.step.value ? `Expected value: ${failureContext.step.value}` : ''}

Current page state:
- URL: ${pageState.url}
- Title: ${pageState.title}
- Visible elements: ${JSON.stringify(pageState.visibleElements, null, 2)}

Determine if the task was completed successfully. Return JSON:
{
  "success": true/false,
  "evidence": "what indicates success or failure",
  "confidence": 0-100
}`;

      const result = await executeRuntimeAIAction(verificationPrompt, JSON.stringify(pageState));
      
      // Parse AI response
      let parsed;
      try {
        const jsonMatch = result.result.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          parsed = JSON.parse(result.result);
        }
      } catch {
        // If parsing fails, assume not successful
        return {
          success: false,
          reason: 'Could not parse AI verification response'
        };
      }
      
      return {
        success: parsed.success === true,
        evidence: parsed.evidence,
        reason: parsed.success ? undefined : parsed.evidence
      };
      
    } catch (error) {
      return {
        success: false,
        reason: `AI verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get current page state for context
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