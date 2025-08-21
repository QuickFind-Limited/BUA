/**
 * Test script for Snippet-first execution path
 * This test verifies that when prefer="snippet" is set for all steps,
 * the snippet path is attempted first using Playwright execution.
 */

import { test, expect } from '@playwright/test';
import { ExecutionOrchestrator } from '../main/execution-orchestrator';
import { IntentSpec, ExecutionReport, StepExecutionResult } from '../flows/types';
import { MagnitudeExecutor } from '../main/magnitude-executor';
import { PlaywrightExecutor } from '../main/playwright-executor';

// Mock PlaywrightExecutor to simulate snippet execution responses
class MockPlaywrightExecutor extends PlaywrightExecutor {
  private simulateFailure: boolean = false;
  private stepResults: Map<string, boolean> = new Map();

  constructor(simulateFailure: boolean = false) {
    super({ headless: true, timeout: 5000 });
    this.simulateFailure = simulateFailure;
  }

  setStepResult(stepName: string, success: boolean) {
    this.stepResults.set(stepName, success);
  }

  async executeAction(step: any): Promise<any> {
    const stepName = step.name || 'unknown';
    const shouldSucceed = this.stepResults.get(stepName) ?? !this.simulateFailure;
    
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

// Mock MagnitudeExecutor for fallback testing
class MockMagnitudeExecutor extends MagnitudeExecutor {
  constructor() {
    super({ headless: true, timeout: 5000 });
  }

  async executeFlow(spec: IntentSpec, variables: Record<string, string>): Promise<any> {
    const stepName = spec.steps[0]?.name || 'unknown';
    
    // Simulate AI execution with delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      error: undefined,
      screenshots: [`ai-fallback-${stepName}-${Date.now()}.png`]
    };
  }

  async stop(): Promise<void> {
    // Mock stop
  }
}

test.describe('Snippet-First Execution Path Tests', () => {
  let orchestrator: ExecutionOrchestrator;
  let mockPlaywrightExecutor: MockPlaywrightExecutor;
  let mockMagnitudeExecutor: MockMagnitudeExecutor;

  test.beforeEach(() => {
    mockPlaywrightExecutor = new MockPlaywrightExecutor();
    mockMagnitudeExecutor = new MockMagnitudeExecutor();
    
    orchestrator = new ExecutionOrchestrator({
      enableFallback: true,
      screenshotComparison: false,
      saveScreenshots: true,
      timeout: 10000
    });

    // Replace executors with mocks
    (orchestrator as any).playwrightExecutor = mockPlaywrightExecutor;
    (orchestrator as any).magnitudeExecutor = mockMagnitudeExecutor;
  });

  test('should execute all steps with snippets when prefer="snippet" and snippets succeed', async () => {
    // Create Intent Spec with prefer="snippet" for all steps
    const intentSpec: IntentSpec = {
      name: 'Snippet-First Test Flow',
      description: 'Test flow where all steps prefer snippet execution',
      url: 'https://example.com',
      params: ['USERNAME', 'PASSWORD'],
      steps: [
        {
          name: 'navigate_to_page',
          ai_instruction: 'Navigate to the test page',
          snippet: 'await page.goto("https://example.com");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'click_username_field',
          ai_instruction: 'Click on the username input field',
          snippet: 'await page.click("#username");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#username',
          value: null
        },
        {
          name: 'enter_username',
          ai_instruction: 'Enter the username value',
          snippet: 'await page.fill("#username", "{{USERNAME}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#username',
          value: '{{USERNAME}}'
        },
        {
          name: 'click_password_field',
          ai_instruction: 'Click on password field',
          snippet: 'await page.click("#password");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#password',
          value: null
        },
        {
          name: 'enter_password',
          ai_instruction: 'Enter the password value',
          snippet: 'await page.fill("#password", "{{PASSWORD}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#password',
          value: '{{PASSWORD}}'
        },
        {
          name: 'submit_form',
          ai_instruction: 'Submit the form by clicking submit button',
          snippet: 'await page.click("button[type=submit]");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: 'button[type=submit]',
          value: null
        }
      ]
    };

    // Set all snippet executions to succeed
    mockPlaywrightExecutor.setStepResult('navigate_to_page', true);
    mockPlaywrightExecutor.setStepResult('click_username_field', true);
    mockPlaywrightExecutor.setStepResult('enter_username', true);
    mockPlaywrightExecutor.setStepResult('click_password_field', true);
    mockPlaywrightExecutor.setStepResult('enter_password', true);
    mockPlaywrightExecutor.setStepResult('submit_form', true);

    const variables = { USERNAME: 'testuser', PASSWORD: 'testpass' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(6);
    expect(report.aiUsageCount).toBe(0);
    expect(report.snippetUsageCount).toBe(6);
    expect(report.fallbackCount).toBe(0);

    // Verify each step used snippet path
    report.steps!.forEach((step: StepExecutionResult, index: number) => {
      expect(step.pathUsed).toBe('snippet');
      expect(step.fallbackOccurred).toBe(false);
      expect(step.success).toBe(true);
      expect(step.name).toBe(intentSpec.steps[index].name);
    });

    console.log('✅ Snippet-First Execution Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log(`   - Overall Success: ${report.overallSuccess}`);
  });

  test('should fallback to AI when snippets fail and fallback enabled', async () => {
    const intentSpec: IntentSpec = {
      name: 'Snippet-First with Fallback Test',
      description: 'Test snippet execution with AI fallback',
      url: 'https://example.com',
      params: ['USERNAME'],
      steps: [
        {
          name: 'navigate_step',
          ai_instruction: 'Navigate to the page',
          snippet: 'await page.goto("https://example.com");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'failing_snippet_step',
          ai_instruction: 'This step will fallback to AI',
          snippet: 'await page.click("#nonexistent");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#nonexistent',
          value: null
        },
        {
          name: 'success_snippet_step',
          ai_instruction: 'This step will succeed with snippet',
          snippet: 'await page.fill("#input", "{{USERNAME}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#input',
          value: '{{USERNAME}}'
        }
      ]
    };

    // Set mixed results for snippet execution
    mockPlaywrightExecutor.setStepResult('navigate_step', true);
    mockPlaywrightExecutor.setStepResult('failing_snippet_step', false);
    mockPlaywrightExecutor.setStepResult('success_snippet_step', true);

    const variables = { USERNAME: 'testuser' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(3);
    expect(report.aiUsageCount).toBe(1); // failing_snippet_step fallback
    expect(report.snippetUsageCount).toBe(2); // navigate_step and success_snippet_step
    expect(report.fallbackCount).toBe(1);

    // Verify specific step results
    expect(report.steps![0].pathUsed).toBe('snippet');
    expect(report.steps![0].fallbackOccurred).toBe(false);
    expect(report.steps![0].success).toBe(true);

    expect(report.steps![1].pathUsed).toBe('ai');
    expect(report.steps![1].fallbackOccurred).toBe(true);
    expect(report.steps![1].success).toBe(true);

    expect(report.steps![2].pathUsed).toBe('snippet');
    expect(report.steps![2].fallbackOccurred).toBe(false);
    expect(report.steps![2].success).toBe(true);

    console.log('✅ Snippet-First with Fallback Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log('   - Path Used per Step:', report.steps!.map(s => `${s.name}: ${s.pathUsed}${s.fallbackOccurred ? ' (fallback)' : ''}`));
  });

  test('should handle variable substitution in snippets correctly', async () => {
    const intentSpec: IntentSpec = {
      name: 'Variable Substitution Test',
      description: 'Test variable substitution in snippet execution',
      url: 'https://example.com',
      params: ['EMAIL', 'NAME', 'AGE'],
      steps: [
        {
          name: 'fill_email',
          ai_instruction: 'Fill in the email field',
          snippet: 'await page.fill("#email", "{{EMAIL}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#email',
          value: '{{EMAIL}}'
        },
        {
          name: 'fill_name',
          ai_instruction: 'Fill in the name field',
          snippet: 'await page.fill("#name", "{{NAME}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#name',
          value: '{{NAME}}'
        },
        {
          name: 'fill_age',
          ai_instruction: 'Fill in the age field',
          snippet: 'await page.fill("#age", "{{AGE}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#age',
          value: '{{AGE}}'
        }
      ]
    };

    // Set all snippet executions to succeed
    mockPlaywrightExecutor.setStepResult('fill_email', true);
    mockPlaywrightExecutor.setStepResult('fill_name', true);
    mockPlaywrightExecutor.setStepResult('fill_age', true);

    const variables = { 
      EMAIL: 'test@example.com', 
      NAME: 'John Doe', 
      AGE: '25' 
    };

    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(3);
    expect(report.snippetUsageCount).toBe(3);
    expect(report.aiUsageCount).toBe(0);

    // All steps should use snippet path
    report.steps!.forEach((step: StepExecutionResult) => {
      expect(step.pathUsed).toBe('snippet');
      expect(step.success).toBe(true);
    });

    console.log('✅ Variable Substitution Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - Variables Used: ${Object.keys(variables).join(', ')}`);
    console.log(`   - All Snippet Executions: ${report.snippetUsageCount}`);
  });

  test('should respect no-fallback setting when snippets fail', async () => {
    // Create orchestrator with fallback disabled
    const noFallbackOrchestrator = new ExecutionOrchestrator({
      enableFallback: false,
      screenshotComparison: false,
      saveScreenshots: false,
      timeout: 5000
    });

    // Replace executors with mocks
    (noFallbackOrchestrator as any).playwrightExecutor = mockPlaywrightExecutor;
    (noFallbackOrchestrator as any).magnitudeExecutor = mockMagnitudeExecutor;

    const intentSpec: IntentSpec = {
      name: 'Snippet-Only No Fallback Test',
      description: 'Test snippet execution without fallback',
      url: 'https://example.com',
      params: [],
      steps: [
        {
          name: 'success_step',
          ai_instruction: 'This step will succeed',
          snippet: 'await page.click("#success");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#success',
          value: null
        },
        {
          name: 'failing_step',
          ai_instruction: 'This step will fail',
          snippet: 'await page.click("#fail");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#fail',
          value: null
        }
      ]
    };

    // Set one success, one failure
    mockPlaywrightExecutor.setStepResult('success_step', true);
    mockPlaywrightExecutor.setStepResult('failing_step', false);

    const report: ExecutionReport = await noFallbackOrchestrator.execute(intentSpec, {});

    // Verify execution report
    expect(report.overallSuccess).toBe(false);
    expect(report.steps).toHaveLength(2);
    expect(report.snippetUsageCount).toBe(2); // Both attempted with snippets
    expect(report.aiUsageCount).toBe(0); // No fallback
    expect(report.fallbackCount).toBe(0);

    // First step should succeed
    expect(report.steps![0].pathUsed).toBe('snippet');
    expect(report.steps![0].fallbackOccurred).toBe(false);
    expect(report.steps![0].success).toBe(true);

    // Second step should fail without fallback
    expect(report.steps![1].pathUsed).toBe('snippet');
    expect(report.steps![1].fallbackOccurred).toBe(false);
    expect(report.steps![1].success).toBe(false);

    console.log('✅ Snippet-Only No Fallback Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log(`   - Overall Success: ${report.overallSuccess}`);
  });

  test('should handle complex snippet execution patterns', async () => {
    const intentSpec: IntentSpec = {
      name: 'Complex Snippet Pattern Test',
      description: 'Test complex snippet execution patterns',
      url: 'https://example.com',
      params: ['SEARCH_TERM'],
      steps: [
        {
          name: 'navigate_to_search',
          ai_instruction: 'Navigate to search page',
          snippet: 'await page.goto("https://example.com/search");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'wait_for_search_box',
          ai_instruction: 'Wait for search box to appear',
          snippet: 'await page.waitForSelector("#search-input", { timeout: 5000 });',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#search-input',
          value: null
        },
        {
          name: 'click_search_box',
          ai_instruction: 'Click on the search box',
          snippet: 'await page.click("#search-input");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#search-input',
          value: null
        },
        {
          name: 'type_search_term',
          ai_instruction: 'Type the search term',
          snippet: 'await page.type("#search-input", "{{SEARCH_TERM}}");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '#search-input',
          value: '{{SEARCH_TERM}}'
        },
        {
          name: 'press_enter',
          ai_instruction: 'Press enter to search',
          snippet: 'await page.keyboard.press("Enter");',
          prefer: 'snippet',
          fallback: 'ai',
          selector: null,
          value: null
        },
        {
          name: 'wait_for_results',
          ai_instruction: 'Wait for search results',
          snippet: 'await page.waitForSelector(".search-results", { timeout: 10000 });',
          prefer: 'snippet',
          fallback: 'ai',
          selector: '.search-results',
          value: null
        }
      ]
    };

    // Set all snippet executions to succeed
    intentSpec.steps.forEach(step => {
      mockPlaywrightExecutor.setStepResult(step.name!, true);
    });

    const variables = { SEARCH_TERM: 'playwright testing' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(6);
    expect(report.snippetUsageCount).toBe(6);
    expect(report.aiUsageCount).toBe(0);
    expect(report.fallbackCount).toBe(0);

    // Verify all steps executed successfully with snippets
    report.steps!.forEach((step: StepExecutionResult) => {
      expect(step.pathUsed).toBe('snippet');
      expect(step.fallbackOccurred).toBe(false);
      expect(step.success).toBe(true);
    });

    console.log('✅ Complex Snippet Pattern Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - All Snippet Executions: ${report.snippetUsageCount}`);
    console.log(`   - Step Names: ${report.steps!.map(s => s.name).join(', ')}`);
  });

  test.afterEach(async () => {
    await orchestrator.stop();
  });
});