/**
 * Intent Spec Builder - Builds execution paths from Intent Specifications
 * Handles variable substitution and execution strategy selection
 */

import { IntentSpec, IntentStep } from '../flows/types';

export interface ExecutionStep {
  name: string;
  type: 'ai' | 'snippet';
  instruction: string;
  fallback?: ExecutionStep;
  variables: Record<string, string>;
  originalStep: IntentStep;
}

export interface ExecutionPlan {
  name: string;
  description: string;
  url: string;
  steps: ExecutionStep[];
  fallbackStrategy: 'immediate' | 'on_failure' | 'none';
  variables: Record<string, string>;
}

export interface VariableContext {
  [key: string]: string;
}

/**
 * Builds executable plans from Intent Specifications
 */
export class IntentSpecBuilder {
  /**
   * Builds an execution plan from an Intent Spec with variable substitution
   * @param intentSpec Intent Specification
   * @param variables Variable values for substitution
   * @param strategy Execution strategy preferences
   * @returns Executable plan with both AI and snippet paths
   */
  buildExecutionPlan(
    intentSpec: IntentSpec,
    variables: VariableContext = {},
    strategy: {
      preferredPath?: 'ai' | 'snippet';
      fallbackStrategy?: 'immediate' | 'on_failure' | 'none';
      overridePreferences?: boolean;
    } = {}
  ): ExecutionPlan {
    // Validate required variables
    this.validateVariables(intentSpec, variables);
    
    // Substitute variables in URL
    const processedUrl = this.substituteVariables(intentSpec.url, variables);
    
    // Build execution steps
    const steps = this.buildExecutionSteps(intentSpec, variables, strategy);
    
    return {
      name: intentSpec.name,
      description: this.substituteVariables(intentSpec.description, variables),
      url: processedUrl,
      steps: steps,
      fallbackStrategy: strategy.fallbackStrategy || 'on_failure',
      variables: variables
    };
  }

  /**
   * Builds individual execution steps with AI and snippet instructions
   * @param intentSpec Intent Specification
   * @param variables Variable context
   * @param strategy Execution strategy
   * @returns Array of execution steps
   */
  private buildExecutionSteps(
    intentSpec: IntentSpec,
    variables: VariableContext,
    strategy: {
      preferredPath?: 'ai' | 'snippet';
      overridePreferences?: boolean;
    }
  ): ExecutionStep[] {
    return intentSpec.steps.map(step => {
      // Determine which path to use (AI or snippet)
      const preferredType = this.determineExecutionType(step, intentSpec.preferences, strategy);
      
      // Build primary execution step
      const primaryStep = this.buildSingleExecutionStep(step, preferredType, variables);
      
      // Build fallback step if configured
      let fallbackStep: ExecutionStep | undefined;
      if (step.fallback !== 'none') {
        const fallbackType = step.fallback as 'ai' | 'snippet';
        fallbackStep = this.buildSingleExecutionStep(step, fallbackType, variables);
      }
      
      return {
        ...primaryStep,
        fallback: fallbackStep
      };
    });
  }

  /**
   * Builds a single execution step for either AI or snippet path
   * @param step Intent step
   * @param type Execution type (ai or snippet)
   * @param variables Variable context
   * @returns Single execution step
   */
  private buildSingleExecutionStep(
    step: IntentStep,
    type: 'ai' | 'snippet',
    variables: VariableContext
  ): ExecutionStep {
    const instruction = type === 'ai' 
      ? this.buildAIInstruction(step, variables)
      : this.buildSnippetInstruction(step, variables);
    
    return {
      name: step.name,
      type: type,
      instruction: instruction,
      variables: this.extractStepVariables(step, variables),
      originalStep: step
    };
  }

  /**
   * Builds AI instruction with variable substitution and context
   * @param step Intent step
   * @param variables Variable context
   * @returns AI instruction string
   */
  private buildAIInstruction(step: IntentStep, variables: VariableContext): string {
    let instruction = this.substituteVariables(step.ai_instruction, variables);
    
    // Add context information for AI execution
    const context: string[] = [];
    
    if (step.selector) {
      context.push(`Target selector: ${step.selector}`);
    }
    
    if (step.value) {
      const processedValue = this.substituteVariables(step.value, variables);
      context.push(`Value to use: ${processedValue}`);
    }
    
    if (context.length > 0) {
      instruction += `\n\nAdditional context:\n${context.join('\n')}`;
    }
    
    return instruction;
  }

  /**
   * Builds Playwright snippet with variable substitution
   * @param step Intent step
   * @param variables Variable context
   * @returns Executable Playwright code
   */
  private buildSnippetInstruction(step: IntentStep, variables: VariableContext): string {
    let snippet = this.substituteVariables(step.snippet, variables);
    
    // Add error handling and retries if specified
    if (step.timeout || step.retries) {
      snippet = this.wrapSnippetWithOptions(snippet, step);
    }
    
    return snippet;
  }

  /**
   * Wraps snippet with timeout and retry options
   * @param snippet Original snippet
   * @param step Intent step with options
   * @returns Enhanced snippet with error handling
   */
  private wrapSnippetWithOptions(snippet: string, step: IntentStep): string {
    let wrappedSnippet = snippet;
    
    // Add timeout if specified
    if (step.timeout) {
      wrappedSnippet = `await Promise.race([
  ${snippet},
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Step timeout after ${step.timeout}ms')), ${step.timeout})
  )
]);`;
    }
    
    // Add retry logic if specified
    if (step.retries && step.retries > 0) {
      wrappedSnippet = `
let attempts = 0;
const maxAttempts = ${step.retries + 1};
while (attempts < maxAttempts) {
  try {
    ${wrappedSnippet}
    break;
  } catch (error) {
    attempts++;
    if (attempts === maxAttempts) throw error;
    await page.waitForTimeout(1000); // Wait before retry
  }
}`;
    }
    
    return wrappedSnippet;
  }

  /**
   * Determines execution type based on step preferences and strategy
   * @param step Intent step
   * @param globalPreferences Global preferences from Intent Spec
   * @param strategy Override strategy
   * @returns Execution type
   */
  private determineExecutionType(
    step: IntentStep,
    globalPreferences: IntentSpec['preferences'],
    strategy: {
      preferredPath?: 'ai' | 'snippet';
      overridePreferences?: boolean;
    }
  ): 'ai' | 'snippet' {
    // Strategy override takes precedence
    if (strategy.overridePreferences && strategy.preferredPath) {
      return strategy.preferredPath;
    }
    
    // Step-level preference
    if (step.prefer) {
      return step.prefer;
    }
    
    // Global preference for step category
    const stepCategory = this.categorizeStep(step);
    if (globalPreferences[stepCategory]) {
      return globalPreferences[stepCategory];
    }
    
    // Default global preferences
    if (globalPreferences.simple_steps && this.isSimpleStep(step)) {
      return globalPreferences.simple_steps;
    }
    
    if (globalPreferences.dynamic_elements && this.isDynamicElement(step)) {
      return globalPreferences.dynamic_elements;
    }
    
    // Default fallback
    return 'ai';
  }

  /**
   * Categorizes a step for preference matching
   * @param step Intent step
   * @returns Step category
   */
  private categorizeStep(step: IntentStep): string {
    const action = step.action?.toLowerCase() || '';
    
    switch (action) {
      case 'navigate':
      case 'wait':
        return 'simple_steps';
      
      case 'click':
        return this.isDynamicElement(step) ? 'dynamic_elements' : 'simple_steps';
      
      case 'fill':
      case 'type':
        return 'form_interactions';
      
      case 'select':
        return 'dropdown_interactions';
      
      default:
        return 'general_interactions';
    }
  }

  /**
   * Checks if a step is considered simple
   * @param step Intent step
   * @returns True if step is simple
   */
  private isSimpleStep(step: IntentStep): boolean {
    const simpleActions = ['navigate', 'wait', 'screenshot'];
    return simpleActions.includes(step.action?.toLowerCase() || '');
  }

  /**
   * Checks if a step involves dynamic elements
   * @param step Intent step
   * @returns True if step involves dynamic elements
   */
  private isDynamicElement(step: IntentStep): boolean {
    // Check if step uses text-based targeting or lacks stable selectors
    const hasTextInAI = step.ai_instruction.toLowerCase().includes('text');
    const hasStableSelector = step.selector?.includes('#') || step.selector?.includes('[data-');
    
    return hasTextInAI || !hasStableSelector;
  }

  /**
   * Substitutes variables in a string using {{VARIABLE}} syntax
   * @param text Text with variable placeholders
   * @param variables Variable values
   * @returns Text with substituted values
   */
  private substituteVariables(text: string, variables: VariableContext): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedVarName = varName.trim();
      if (variables.hasOwnProperty(trimmedVarName)) {
        return variables[trimmedVarName];
      }
      
      // Return original placeholder if variable not found
      console.warn(`Variable ${trimmedVarName} not found in context`);
      return match;
    });
  }

  /**
   * Extracts variables used in a specific step
   * @param step Intent step
   * @param allVariables All available variables
   * @returns Variables used in this step
   */
  private extractStepVariables(step: IntentStep, allVariables: VariableContext): Record<string, string> {
    const stepVariables: Record<string, string> = {};
    const variableRegex = /\{\{([^}]+)\}\}/g;
    
    // Check all string fields in the step
    const fieldsToCheck = [step.ai_instruction, step.snippet, step.value, step.selector];
    
    fieldsToCheck.forEach(field => {
      if (field) {
        let match;
        while ((match = variableRegex.exec(field)) !== null) {
          const varName = match[1].trim();
          if (allVariables.hasOwnProperty(varName)) {
            stepVariables[varName] = allVariables[varName];
          }
        }
      }
    });
    
    return stepVariables;
  }

  /**
   * Validates that all required variables are provided
   * @param intentSpec Intent Specification
   * @param variables Provided variables
   * @throws Error if required variables are missing
   */
  private validateVariables(intentSpec: IntentSpec, variables: VariableContext): void {
    const missing: string[] = [];
    
    intentSpec.params.forEach(param => {
      if (!variables.hasOwnProperty(param)) {
        missing.push(param);
      }
    });
    
    if (missing.length > 0) {
      throw new Error(`Missing required variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Creates a minimal execution plan for testing purposes
   * @param intentSpec Intent Specification
   * @param executionType Preferred execution type
   * @returns Simplified execution plan
   */
  buildTestExecutionPlan(
    intentSpec: IntentSpec,
    executionType: 'ai' | 'snippet' = 'snippet'
  ): ExecutionPlan {
    // Create dummy variables for testing
    const testVariables: VariableContext = {};
    intentSpec.params.forEach(param => {
      testVariables[param] = `test_${param.toLowerCase()}`;
    });
    
    return this.buildExecutionPlan(
      intentSpec,
      testVariables,
      {
        preferredPath: executionType,
        overridePreferences: true,
        fallbackStrategy: 'none'
      }
    );
  }
}

/**
 * Utility function to build execution plan from Intent Spec
 * @param intentSpec Intent Specification
 * @param variables Variable context
 * @param options Execution options
 * @returns Execution plan
 */
export function buildExecutionPlan(
  intentSpec: IntentSpec,
  variables: VariableContext,
  options?: {
    preferredPath?: 'ai' | 'snippet';
    fallbackStrategy?: 'immediate' | 'on_failure' | 'none';
  }
): ExecutionPlan {
  const builder = new IntentSpecBuilder();
  return builder.buildExecutionPlan(intentSpec, variables, options || {});
}

/**
 * Utility function to create test execution plans
 * @param intentSpec Intent Specification
 * @param type Execution type preference
 * @returns Test execution plan
 */
export function createTestExecutionPlan(
  intentSpec: IntentSpec,
  type: 'ai' | 'snippet' = 'snippet'
): ExecutionPlan {
  const builder = new IntentSpecBuilder();
  return builder.buildTestExecutionPlan(intentSpec, type);
}