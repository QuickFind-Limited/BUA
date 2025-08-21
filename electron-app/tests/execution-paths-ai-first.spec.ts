/**
 * Test script for AI-first execution path
 * This test verifies that when prefer="ai" is set for all steps,
 * the AI path is attempted first and the SDK Decider logic works correctly.
 */

import { test, expect } from '@playwright/test';
import { ExecutionOrchestrator } from '../main/execution-orchestrator';
import { IntentSpec, ExecutionReport, StepExecutionResult } from '../flows/types';
import { MagnitudeExecutor } from '../main/magnitude-executor';
import { PlaywrightExecutor } from '../main/playwright-executor';

// Mock MagnitudeExecutor to simulate AI execution responses
class MockMagnitudeExecutor extends MagnitudeExecutor {
  private simulateFailure: boolean = false;
  private stepResults: Map<string, boolean> = new Map();

  constructor(simulateFailure: boolean = false) {
    super({ headless: true, timeout: 5000 });
    this.simulateFailure = simulateFailure;
  }

  setStepResult(stepName: string, success: boolean) {
    this.stepResults.set(stepName, success);
  }

  async executeFlow(spec: IntentSpec, variables: Record<string, string>): Promise<any> {
    const stepName = spec.steps[0]?.name || 'unknown';
    const shouldSucceed = this.stepResults.get(stepName) ?? !this.simulateFailure;
    
    // Simulate AI execution with delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: shouldSucceed,
      error: shouldSucceed ? undefined : 'AI execution simulated failure',
      screenshots: shouldSucceed ? [`ai-step-${stepName}-${Date.now()}.png`] : []
    };
  }
}

// Mock PlaywrightExecutor for fallback testing
class MockPlaywrightExecutor extends PlaywrightExecutor {
  constructor() {
    super({ headless: true, timeout: 5000 });
  }

  async executeAction(step: any): Promise<any> {
    // Simulate snippet execution with delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      success: true,
      error: undefined
    };
  }

  async takeScreenshot(name: string): Promise<string> {
    return `snippet-${name}.png`;
  }
}

test.describe('AI-First Execution Path Tests', () => {
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

  test('should execute all steps with AI when prefer="ai" and AI succeeds', async () => {
    // Create Intent Spec with prefer="ai" for all steps
    const intentSpec: IntentSpec = {
      name: 'AI-First Test Flow',
      description: 'Test flow where all steps prefer AI execution',
      url: 'https://example.com',
      params: ['USERNAME', 'PASSWORD'],
      steps: [
        {
          name: 'navigate_to_page',
          ai_instruction: 'Navigate to the test page',
          snippet: 'await page.goto("https://example.com");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: null,
          value: null
        },
        {
          name: 'click_username_field',
          ai_instruction: 'Click on the username input field',
          snippet: 'await page.click("#username");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#username',
          value: null
        },
        {
          name: 'enter_username',
          ai_instruction: 'Enter the username value',
          snippet: 'await page.fill("#username", "{{USERNAME}}");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#username',
          value: '{{USERNAME}}'
        },
        {
          name: 'submit_form',
          ai_instruction: 'Submit the form by clicking submit button',
          snippet: 'await page.click("button[type=submit]");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: 'button[type=submit]',
          value: null
        }
      ]
    };

    // Set all AI executions to succeed
    mockMagnitudeExecutor.setStepResult('navigate_to_page', true);
    mockMagnitudeExecutor.setStepResult('click_username_field', true);
    mockMagnitudeExecutor.setStepResult('enter_username', true);
    mockMagnitudeExecutor.setStepResult('submit_form', true);

    const variables = { USERNAME: 'testuser', PASSWORD: 'testpass' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(4);
    expect(report.aiUsageCount).toBe(4);
    expect(report.snippetUsageCount).toBe(0);
    expect(report.fallbackCount).toBe(0);

    // Verify each step used AI path
    report.steps!.forEach((step: StepExecutionResult, index: number) => {
      expect(step.pathUsed).toBe('ai');
      expect(step.fallbackOccurred).toBe(false);
      expect(step.success).toBe(true);
      expect(step.name).toBe(intentSpec.steps[index].name);
    });

    console.log('✅ AI-First Execution Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log(`   - Overall Success: ${report.overallSuccess}`);
  });

  test('should fallback to snippets when AI fails and fallback enabled', async () => {
    const intentSpec: IntentSpec = {
      name: 'AI-First with Fallback Test',
      description: 'Test AI execution with snippet fallback',
      url: 'https://example.com',
      params: ['USERNAME'],
      steps: [
        {
          name: 'navigate_step',
          ai_instruction: 'Navigate to the page',
          snippet: 'await page.goto("https://example.com");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: null,
          value: null
        },
        {
          name: 'failing_step',
          ai_instruction: 'This step will fail in AI',
          snippet: 'await page.click("#button");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#button',
          value: null
        },
        {
          name: 'success_step',
          ai_instruction: 'This step will succeed in AI',
          snippet: 'await page.fill("#input", "{{USERNAME}}");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#input',
          value: '{{USERNAME}}'
        }
      ]
    };

    // Set mixed results for AI execution
    mockMagnitudeExecutor.setStepResult('navigate_step', true);
    mockMagnitudeExecutor.setStepResult('failing_step', false);
    mockMagnitudeExecutor.setStepResult('success_step', true);

    const variables = { USERNAME: 'testuser' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify execution report
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(3);
    expect(report.aiUsageCount).toBe(2); // navigate_step and success_step
    expect(report.snippetUsageCount).toBe(1); // failing_step fallback
    expect(report.fallbackCount).toBe(1);

    // Verify specific step results
    expect(report.steps![0].pathUsed).toBe('ai');
    expect(report.steps![0].fallbackOccurred).toBe(false);
    expect(report.steps![0].success).toBe(true);

    expect(report.steps![1].pathUsed).toBe('snippet');
    expect(report.steps![1].fallbackOccurred).toBe(true);
    expect(report.steps![1].success).toBe(true);

    expect(report.steps![2].pathUsed).toBe('ai');
    expect(report.steps![2].fallbackOccurred).toBe(false);
    expect(report.steps![2].success).toBe(true);

    console.log('✅ AI-First with Fallback Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log('   - Path Used per Step:', report.steps!.map(s => `${s.name}: ${s.pathUsed}${s.fallbackOccurred ? ' (fallback)' : ''}`));
  });

  test('should respect no-fallback setting when AI fails', async () => {
    // Create orchestrator with fallback disabled
    const noFallbackOrchestrator = new ExecutionOrchestrator({
      enableFallback: false,
      screenshotComparison: false,
      saveScreenshots: false,
      timeout: 5000
    });

    // Replace executors with mocks
    (noFallbackOrchestrator as any).magnitudeExecutor = mockMagnitudeExecutor;
    (noFallbackOrchestrator as any).playwrightExecutor = mockPlaywrightExecutor;

    const intentSpec: IntentSpec = {
      name: 'AI-Only No Fallback Test',
      description: 'Test AI execution without fallback',
      url: 'https://example.com',
      params: [],
      steps: [
        {
          name: 'success_step',
          ai_instruction: 'This step will succeed',
          snippet: 'await page.click("#success");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#success',
          value: null
        },
        {
          name: 'failing_step',
          ai_instruction: 'This step will fail',
          snippet: 'await page.click("#fail");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#fail',
          value: null
        }
      ]
    };

    // Set one success, one failure
    mockMagnitudeExecutor.setStepResult('success_step', true);
    mockMagnitudeExecutor.setStepResult('failing_step', false);

    const report: ExecutionReport = await noFallbackOrchestrator.execute(intentSpec, {});

    // Verify execution report
    expect(report.overallSuccess).toBe(false);
    expect(report.steps).toHaveLength(2);
    expect(report.aiUsageCount).toBe(2); // Both attempted with AI
    expect(report.snippetUsageCount).toBe(0); // No fallback
    expect(report.fallbackCount).toBe(0);

    // First step should succeed
    expect(report.steps![0].pathUsed).toBe('ai');
    expect(report.steps![0].fallbackOccurred).toBe(false);
    expect(report.steps![0].success).toBe(true);

    // Second step should fail without fallback
    expect(report.steps![1].pathUsed).toBe('ai');
    expect(report.steps![1].fallbackOccurred).toBe(false);
    expect(report.steps![1].success).toBe(false);

    console.log('✅ AI-Only No Fallback Test Results:');
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - AI Usage Count: ${report.aiUsageCount}`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount}`);
    console.log(`   - Fallback Count: ${report.fallbackCount}`);
    console.log(`   - Overall Success: ${report.overallSuccess}`);
  });

  test('should handle execution events correctly during AI-first execution', async () => {
    const events: any[] = [];
    
    orchestrator.on('execution-started', (data) => events.push({ type: 'execution-started', data }));
    orchestrator.on('step-started', (data) => events.push({ type: 'step-started', data }));
    orchestrator.on('step-completed', (data) => events.push({ type: 'step-completed', data }));
    orchestrator.on('execution-completed', (data) => events.push({ type: 'execution-completed', data }));

    const intentSpec: IntentSpec = {
      name: 'Event Test Flow',
      description: 'Test event emission during execution',
      url: 'https://example.com',
      params: [],
      steps: [
        {
          name: 'test_step',
          ai_instruction: 'Test step for events',
          snippet: 'await page.click("#test");',
          prefer: 'ai',
          fallback: 'snippet',
          selector: '#test',
          value: null
        }
      ]
    };

    mockMagnitudeExecutor.setStepResult('test_step', true);
    await orchestrator.execute(intentSpec, {});

    // Verify events were emitted
    expect(events).toHaveLength(4);
    expect(events[0].type).toBe('execution-started');
    expect(events[1].type).toBe('step-started');
    expect(events[2].type).toBe('step-completed');
    expect(events[3].type).toBe('execution-completed');

    // Verify event data
    expect(events[1].data.stepIndex).toBe(0);
    expect(events[1].data.totalSteps).toBe(1);
    expect(events[2].data.pathUsed).toBe('ai');
    expect(events[2].data.success).toBe(true);

    console.log('✅ Event Emission Test Results:');
    console.log(`   - Events Emitted: ${events.length}`);
    console.log(`   - Event Types: ${events.map(e => e.type).join(', ')}`);
  });

  test.afterEach(async () => {
    await orchestrator.stop();
  });
});