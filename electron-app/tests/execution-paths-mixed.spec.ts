/**
 * Test script for Mixed execution path
 * This test verifies that when steps have mixed AI and snippet preferences,
 * the correct path selection for each step works as expected.
 */

import { test, expect } from '@playwright/test';
import { ExecutionOrchestrator } from '../main/execution-orchestrator';
import { IntentSpec, ExecutionReport, StepExecutionResult } from '../flows/types';
import { MagnitudeExecutor } from '../main/magnitude-executor';
import { PlaywrightExecutor } from '../main/playwright-executor';

// Mock MagnitudeExecutor for AI execution
class MockMagnitudeExecutor extends MagnitudeExecutor {
  private stepResults: Map<string, boolean> = new Map();

  constructor() {
    super({ headless: true, timeout: 5000 });
  }

  setStepResult(stepName: string, success: boolean) {
    this.stepResults.set(stepName, success);
  }

  async executeFlow(spec: IntentSpec, variables: Record<string, string>): Promise<any> {
    const stepName = spec.steps[0]?.name || 'unknown';
    const shouldSucceed = this.stepResults.get(stepName) ?? true;
    
    // Simulate AI execution with delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: shouldSucceed,
      error: shouldSucceed ? undefined : 'AI execution simulated failure',
      screenshots: shouldSucceed ? [`ai-step-${stepName}-${Date.now()}.png`] : []
    };
  }

  async stop(): Promise<void> {
    // Mock stop
  }
}

// Mock PlaywrightExecutor for snippet execution
class MockPlaywrightExecutor extends PlaywrightExecutor {
  private stepResults: Map<string, boolean> = new Map();

  constructor() {
    super({ headless: true, timeout: 5000 });
  }

  setStepResult(stepName: string, success: boolean) {
    this.stepResults.set(stepName, success);
  }

  async executeAction(step: any): Promise<any> {
    const stepName = step.name || 'unknown';
    const shouldSucceed = this.stepResults.get(stepName) ?? true;
    
    // Simulate snippet execution with delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      success: shouldSucceed,
      error: shouldSucceed ? undefined : 'Snippet execution simulated failure'
    };
  }

  async takeScreenshot(name: string): Promise<string> {
    return `snippet-${name}.png`;
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }
}

test.describe('Mixed Execution Path Tests', () => {
  let orchestrator: ExecutionOrchestrator;
  let mockMagnitudeExecutor: MockMagnitudeExecutor;
  let mockPlaywrightExecutor: MockPlaywrightExecutor;

  test.beforeEach(() => {
    mockMagnitudeExecutor = new MockMagnitudeExecutor();
    mockPlaywrightExecutor = new MockPlaywrightExecutor();
    
    orchestrator = new ExecutionOrchestrator({
      enableFallback: true,
      screenshotComparison: false,
      saveScreenshots: true,
      timeout: 10000
    });

    // Replace executors with mocks
    (orchestrator as any).magnitudeExecutor = mockMagnitudeExecutor;
    (orchestrator as any).playwrightExecutor = mockPlaywrightExecutor;
  });

  test('should execute steps with mixed AI and snippet preferences correctly', async () => {
    // Create Intent Spec with mixed preferences
    const intentSpec: IntentSpec = {
      name: 'Mixed Execution Test Flow',
      description: 'Test flow with mixed AI and snippet preferences',
      url: 'https://example.com',
      params: ['USERNAME', 'PASSWORD'],
      steps: [
        {
          name: 'navigate_with_snippet',
          ai_instruction: 'Navigate to the test page',
          snippet: 'await page.goto("https://example.com");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'find_elements_with_ai',
          ai_instruction: 'Find and identify the login form elements on the page',
          snippet: 'await page.waitForSelector("#login-form");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#login-form',
          value: null
        },
        {
          name: 'fill_username_with_snippet',
          ai_instruction: 'Fill in the username field',
          snippet: 'await page.fill("#username", "{{USERNAME}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#username',
          value: '{{USERNAME}}'
        },
        {
          name: 'validate_with_ai',
          ai_instruction: 'Validate that the username field has been filled correctly',
          snippet: 'await page.locator("#username").inputValue();',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#username',
          value: null
        },
        {
          name: 'fill_password_with_snippet',
          ai_instruction: 'Fill in the password field',
          snippet: 'await page.fill("#password", "{{PASSWORD}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#password',
          value: '{{PASSWORD}}'
        },
        {
          name: 'submit_with_ai',
          ai_instruction: 'Submit the login form by finding and clicking the submit button',
          snippet: 'await page.click("button[type=submit]");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: 'button[type=submit]',
          value: null
        }
      ]
    };

    // Set all executions to succeed
    mockPlaywrightExecutor.setStepResult('navigate_with_snippet', true);
    mockMagnitudeExecutor.setStepResult('find_elements_with_ai', true);
    mockPlaywrightExecutor.setStepResult('fill_username_with_snippet', true);
    mockMagnitudeExecutor.setStepResult('validate_with_ai', true);
    mockPlaywrightExecutor.setStepResult('fill_password_with_snippet', true);
    mockMagnitudeExecutor.setStepResult('submit_with_ai', true);

    const variables = { USERNAME: 'testuser', PASSWORD: 'testpass' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(6);
    expect(report.aiUsageCount).toBe(3); // find_elements, validate, submit
    expect(report.snippetUsageCount).toBe(3); // navigate, fill_username, fill_password
    expect(report.fallbackCount).toBe(0);

    // Verify specific path usage for each step
    expect(report.steps![0].pathUsed).toBe('snippet'); // navigate_with_snippet
    expect(report.steps![1].pathUsed).toBe('ai');     // find_elements_with_ai
    expect(report.steps![2].pathUsed).toBe('snippet'); // fill_username_with_snippet
    expect(report.steps![3].pathUsed).toBe('ai');     // validate_with_ai
    expect(report.steps![4].pathUsed).toBe('snippet'); // fill_password_with_snippet
    expect(report.steps![5].pathUsed).toBe('ai');     // submit_with_ai

    // All steps should succeed without fallback
    report.steps!.forEach((step: StepExecutionResult) => {
      expect(step.fallbackOccurred).toBe(false);
      expect(step.success).toBe(true);
    });

    console.log('✅ Mixed Execution Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log('   - Execution Pattern:');
    report.steps!.forEach((step, index) => {
      console.log(`     ${index + 1}. ${step.name}: ${step.pathUsed}`);
    });
  });

  test('should handle mixed execution with fallbacks correctly', async () => {
    const intentSpec: IntentSpec = {
      name: 'Mixed Execution with Fallbacks',
      description: 'Test mixed execution where some steps need fallbacks',
      url: 'https://example.com',
      params: ['EMAIL'],
      steps: [
        {
          name: 'snippet_success',
          ai_instruction: 'Navigate to page',
          snippet: 'await page.goto("https://example.com");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'ai_failure_fallback_snippet',
          ai_instruction: 'This AI step will fail and fallback to snippet',
          snippet: 'await page.click("#button");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#button',
          value: null
        },
        {
          name: 'snippet_failure_fallback_ai',
          ai_instruction: 'This will be the fallback for failing snippet',
          snippet: 'await page.click("#nonexistent");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#nonexistent',
          value: null
        },
        {
          name: 'ai_success',
          ai_instruction: 'Fill in the email field',
          snippet: 'await page.fill("#email", "{{EMAIL}}");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#email',
          value: '{{EMAIL}}'
        }
      ]
    };

    // Set execution results to create fallback scenarios
    mockPlaywrightExecutor.setStepResult('snippet_success', true);
    mockMagnitudeExecutor.setStepResult('ai_failure_fallback_snippet', false);
    mockPlaywrightExecutor.setStepResult('ai_failure_fallback_snippet', true); // fallback
    mockPlaywrightExecutor.setStepResult('snippet_failure_fallback_ai', false);
    mockMagnitudeExecutor.setStepResult('snippet_failure_fallback_ai', true); // fallback
    mockMagnitudeExecutor.setStepResult('ai_success', true);

    const variables = { EMAIL: 'test@example.com' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(4);
    expect(report.aiUsageCount).toBe(2); // snippet_failure_fallback_ai (fallback) + ai_success
    expect(report.snippetUsageCount).toBe(2); // snippet_success + ai_failure_fallback_snippet (fallback)
    expect(report.fallbackCount).toBe(2);

    // Verify specific execution paths
    expect(report.steps![0].pathUsed).toBe('snippet');
    expect(report.steps![0].fallbackOccurred).toBe(false);
    expect(report.steps![0].success).toBe(true);

    expect(report.steps![1].pathUsed).toBe('snippet');
    expect(report.steps![1].fallbackOccurred).toBe(true);
    expect(report.steps![1].success).toBe(true);

    expect(report.steps![2].pathUsed).toBe('ai');
    expect(report.steps![2].fallbackOccurred).toBe(true);
    expect(report.steps![2].success).toBe(true);

    expect(report.steps![3].pathUsed).toBe('ai');
    expect(report.steps![3].fallbackOccurred).toBe(false);
    expect(report.steps![3].success).toBe(true);

    console.log('✅ Mixed Execution with Fallbacks Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log('   - Detailed Results:');
    report.steps!.forEach((step, index) => {
      const fallbackInfo = step.fallbackOccurred ? ' (fallback)' : '';
      console.log(`     ${index + 1}. ${step.name}: ${step.pathUsed}${fallbackInfo}`);
    });
  });

  test('should handle complex workflows with dynamic preferences', async () => {
    const intentSpec: IntentSpec = {
      name: 'Complex Dynamic Workflow',
      description: 'Complex workflow with dynamic preference patterns',
      url: 'https://example.com',
      params: ['SEARCH_TERM', 'FILTER_TYPE'],
      steps: [
        {
          name: 'initial_navigation',
          ai_instruction: 'Navigate to the application',
          snippet: 'await page.goto("https://example.com/search");',
          prefer: 'snippet', // Reliable navigation
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'dynamic_element_detection',
          ai_instruction: 'Detect and analyze the search interface layout',
          snippet: 'await page.waitForSelector(".search-container");',
          prefer: 'ai', // Better for dynamic content analysis
          fallback: 'snippet',
          selector: '.search-container',
          value: null
        },
        {
          name: 'search_input_interaction',
          ai_instruction: 'Find and interact with the search input field',
          snippet: 'await page.fill("#search-input", "{{SEARCH_TERM}}");',
          prefer: 'snippet', // Predictable form interaction
          fallback: 'ai',
          selector: '#search-input',
          value: '{{SEARCH_TERM}}'
        },
        {
          name: 'filter_selection',
          ai_instruction: 'Select the appropriate filter based on the filter type: {{FILTER_TYPE}}',
          snippet: 'await page.selectOption("#filter-select", "{{FILTER_TYPE}}");',
          prefer: 'ai', // Dynamic filter selection
          fallback: 'snippet',
          selector: '#filter-select',
          value: '{{FILTER_TYPE}}'
        },
        {
          name: 'submit_search',
          ai_instruction: 'Submit the search form',
          snippet: 'await page.click("button[type=submit]");',
          prefer: 'snippet', // Reliable form submission
          fallback: 'ai',
          selector: 'button[type=submit]',
          value: null
        },
        {
          name: 'result_validation',
          ai_instruction: 'Validate that search results are displayed and match expectations',
          snippet: 'await page.waitForSelector(".search-results .result-item");',
          prefer: 'ai', // Better for content validation
          fallback: 'snippet',
          selector: '.search-results .result-item',
          value: null
        },
        {
          name: 'pagination_check',
          ai_instruction: 'Check if pagination is available and note the number of results',
          snippet: 'await page.locator(".pagination").isVisible();',
          prefer: 'ai', // Dynamic content analysis
          fallback: 'snippet',
          selector: '.pagination',
          value: null
        }
      ]
    };

    // Set all executions to succeed
    intentSpec.steps.forEach(step => {
      mockPlaywrightExecutor.setStepResult(step.name!, true);
      mockMagnitudeExecutor.setStepResult(step.name!, true);
    });

    const variables = { 
      SEARCH_TERM: 'automation testing',
      FILTER_TYPE: 'relevance'
    };

    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(7);
    
    // Expected AI steps: dynamic_element_detection, filter_selection, result_validation, pagination_check (4)
    // Expected snippet steps: initial_navigation, search_input_interaction, submit_search (3)
    expect(report.aiUsageCount).toBe(4);
    expect(report.snippetUsageCount).toBe(3);
    expect(report.fallbackCount).toBe(0);

    // Verify execution pattern follows preferences
    const expectedPaths = ['snippet', 'ai', 'snippet', 'ai', 'snippet', 'ai', 'ai'];
    report.steps!.forEach((step, index) => {
      expect(step.pathUsed).toBe(expectedPaths[index]);
      expect(step.success).toBe(true);
      expect(step.fallbackOccurred).toBe(false);
    });

    console.log('✅ Complex Dynamic Workflow Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Expected Pattern: ${expectedPaths.join(' -> ')}`);
    console.log(`   - Actual Pattern: ${report.steps!.map(s => s.pathUsed).join(' -> ')}`);
  });

  test('should handle preference inheritance and override patterns', async () => {
    const intentSpec: IntentSpec = {
      name: 'Preference Inheritance Test',
      description: 'Test preference inheritance and override patterns',
      url: 'https://example.com',
      params: [],
      preferences: {
        dynamic_elements: 'ai',
        simple_steps: 'snippet',
        form_interactions: 'snippet',
        navigation: 'snippet'
      },
      steps: [
        {
          name: 'navigation_step',
          ai_instruction: 'Navigate to page',
          snippet: 'await page.goto("https://example.com");',
          // No prefer specified - should use global preference for navigation (snippet)
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'form_interaction_step',
          ai_instruction: 'Fill form field',
          snippet: 'await page.fill("#input", "value");',
          // No prefer specified - should use global preference for form_interactions (snippet)
          fallback: 'ai',
          selector: '#input',
          value: 'value'
        },
        {
          name: 'dynamic_override_step',
          ai_instruction: 'Handle dynamic content',
          snippet: 'await page.waitForSelector(".dynamic");',
          prefer: 'snippet', // Override global preference for dynamic_elements
          fallback: 'ai',
          selector: '.dynamic',
          value: null
        },
        {
          name: 'explicit_ai_step',
          ai_instruction: 'Use AI explicitly',
          snippet: 'await page.click("#button");',
          prefer: 'ai', // Explicit preference
          fallback: 'snippet',
          selector: '#button',
          value: null
        }
      ]
    };

    // Set all executions to succeed
    intentSpec.steps.forEach(step => {
      mockPlaywrightExecutor.setStepResult(step.name!, true);
      mockMagnitudeExecutor.setStepResult(step.name!, true);
    });

    const report: ExecutionReport = await orchestrator.execute(intentSpec, {});

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(4);
    expect(report.aiUsageCount).toBe(1); // explicit_ai_step
    expect(report.snippetUsageCount).toBe(3); // other steps use snippet preferences
    expect(report.fallbackCount).toBe(0);

    // Verify preference application
    expect(report.steps![0].pathUsed).toBe('snippet'); // navigation preference
    expect(report.steps![1].pathUsed).toBe('snippet'); // form_interactions preference
    expect(report.steps![2].pathUsed).toBe('snippet'); // explicit override
    expect(report.steps![3].pathUsed).toBe('ai');      // explicit prefer

    console.log('✅ Preference Inheritance Test Results:');
    console.log(`   - Global Preferences Applied: ${report.snippetUsageCount - 1} steps`);
    console.log(`   - Explicit Overrides: 2 steps`);
    console.log(`   - Final AI Usage: ${report.aiUsageCount}`);
    console.log(`   - Final Snippet Usage: ${report.snippetUsageCount}`);
  });

  test.afterEach(async () => {
    await orchestrator.stop();
  });
});