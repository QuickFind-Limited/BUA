/**
 * Test script for Execution Reporting verification
 * This test verifies that aiUsageCount, snippetUsageCount, pathUsed,
 * and other execution metrics are accurate across different scenarios.
 */

import { test, expect } from '@playwright/test';
import { ExecutionOrchestrator } from '../main/execution-orchestrator';
import { IntentSpec, ExecutionReport, StepExecutionResult } from '../flows/types';
import { MagnitudeExecutor } from '../main/magnitude-executor';
import { PlaywrightExecutor } from '../main/playwright-executor';

// Enhanced Mock MagnitudeExecutor with detailed tracking
class MockMagnitudeExecutor extends MagnitudeExecutor {
  private stepResults: Map<string, boolean> = new Map();
  private executionLog: Array<{ stepName: string; timestamp: number; success: boolean }> = [];

  constructor() {
    super({ headless: true, timeout: 5000 });
  }

  setStepResult(stepName: string, success: boolean) {
    this.stepResults.set(stepName, success);
  }

  getExecutionLog() {
    return [...this.executionLog];
  }

  clearExecutionLog() {
    this.executionLog = [];
  }

  async executeFlow(spec: IntentSpec, variables: Record<string, string>): Promise<any> {
    const stepName = spec.steps[0]?.name || 'unknown';
    const shouldSucceed = this.stepResults.get(stepName) ?? true;
    const timestamp = Date.now();
    
    // Log execution
    this.executionLog.push({ stepName, timestamp, success: shouldSucceed });
    
    // Simulate AI execution with realistic delay
    await new Promise(resolve => setTimeout(resolve, 120 + Math.random() * 80));
    
    return {
      success: shouldSucceed,
      error: shouldSucceed ? undefined : `AI execution failed for step: ${stepName}`,
      screenshots: shouldSucceed ? [`ai-step-${stepName}-${timestamp}.png`] : []
    };
  }

  async stop(): Promise<void> {
    // Mock stop
  }
}

// Enhanced Mock PlaywrightExecutor with detailed tracking
class MockPlaywrightExecutor extends PlaywrightExecutor {
  private stepResults: Map<string, boolean> = new Map();
  private executionLog: Array<{ stepName: string; timestamp: number; success: boolean }> = [];

  constructor() {
    super({ headless: true, timeout: 5000 });
  }

  setStepResult(stepName: string, success: boolean) {
    this.stepResults.set(stepName, success);
  }

  getExecutionLog() {
    return [...this.executionLog];
  }

  clearExecutionLog() {
    this.executionLog = [];
  }

  async executeAction(step: any): Promise<any> {
    const stepName = step.name || 'unknown';
    const shouldSucceed = this.stepResults.get(stepName) ?? true;
    const timestamp = Date.now();
    
    // Log execution
    this.executionLog.push({ stepName, timestamp, success: shouldSucceed });
    
    // Simulate snippet execution with realistic delay
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 40));
    
    return {
      success: shouldSucceed,
      error: shouldSucceed ? undefined : `Snippet execution failed for step: ${stepName}`
    };
  }

  async takeScreenshot(name: string): Promise<string> {
    return `snippet-${name}.png`;
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }
}

test.describe('Execution Reporting Verification Tests', () => {
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

  test('should accurately track aiUsageCount and snippetUsageCount', async () => {
    const intentSpec: IntentSpec = {
      name: 'Usage Count Tracking Test',
      description: 'Test accurate counting of AI and snippet usage',
      url: 'https://example.com',
      params: ['VALUE1', 'VALUE2'],
      steps: [
        {
          name: 'ai_step_1',
          ai_instruction: 'AI step 1',
          snippet: 'await page.click("#ai1");',
          prefer: 'ai',
          fallback: 'snippet'
        },
        {
          name: 'snippet_step_1',
          ai_instruction: 'Snippet step 1',
          snippet: 'await page.click("#snippet1");',
          prefer: 'snippet',
          fallback: 'ai'
        },
        {
          name: 'ai_step_2',
          ai_instruction: 'AI step 2',
          snippet: 'await page.fill("#ai2", "{{VALUE1}}");',
          prefer: 'ai',
          fallback: 'snippet'
        },
        {
          name: 'snippet_step_2',
          ai_instruction: 'Snippet step 2',
          snippet: 'await page.fill("#snippet2", "{{VALUE2}}");',
          prefer: 'snippet',
          fallback: 'ai'
        },
        {
          name: 'ai_step_3',
          ai_instruction: 'AI step 3',
          snippet: 'await page.click("#ai3");',
          prefer: 'ai',
          fallback: 'snippet'
        }
      ]
    };

    // Set all executions to succeed
    intentSpec.steps.forEach(step => {
      mockMagnitudeExecutor.setStepResult(step.name!, true);
      mockPlaywrightExecutor.setStepResult(step.name!, true);
    });

    const variables = { VALUE1: 'test1', VALUE2: 'test2' };
    const report: ExecutionReport = await orchestrator.execute(intentSpec, variables);

    // Verify accurate counting
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(5);
    expect(report.aiUsageCount).toBe(3); // ai_step_1, ai_step_2, ai_step_3
    expect(report.snippetUsageCount).toBe(2); // snippet_step_1, snippet_step_2
    expect(report.fallbackCount).toBe(0);

    // Verify individual step reporting
    expect(report.steps![0].pathUsed).toBe('ai');
    expect(report.steps![1].pathUsed).toBe('snippet');
    expect(report.steps![2].pathUsed).toBe('ai');
    expect(report.steps![3].pathUsed).toBe('snippet');
    expect(report.steps![4].pathUsed).toBe('ai');

    // Verify totals match individual counts
    const aiSteps = report.steps!.filter(step => step.pathUsed === 'ai').length;
    const snippetSteps = report.steps!.filter(step => step.pathUsed === 'snippet').length;
    expect(aiSteps).toBe(report.aiUsageCount);
    expect(snippetSteps).toBe(report.snippetUsageCount);

    console.log('✅ Usage Count Tracking Test Results:');
    console.log(`   - AI Usage Count: ${report.aiUsageCount} (expected: 3)`);
    console.log(`   - Snippet Usage Count: ${report.snippetUsageCount} (expected: 2)`);
    console.log(`   - Total Steps: ${report.steps!.length}`);
    console.log(`   - Verification: AI(${aiSteps}) + Snippet(${snippetSteps}) = ${aiSteps + snippetSteps}`);
  });

  test('should accurately track fallbackCount with mixed scenarios', async () => {
    const intentSpec: IntentSpec = {
      name: 'Fallback Count Tracking Test',
      description: 'Test accurate counting of fallback occurrences',
      url: 'https://example.com',
      params: [],
      steps: [
        {
          name: 'ai_success_no_fallback',
          ai_instruction: 'AI step that succeeds',
          snippet: 'await page.click("#success");',
          prefer: 'ai',
          fallback: 'snippet'
        },
        {
          name: 'ai_failure_fallback_to_snippet',
          ai_instruction: 'AI step that fails, fallback to snippet',
          snippet: 'await page.click("#fallback1");',
          prefer: 'ai',
          fallback: 'snippet'
        },
        {
          name: 'snippet_success_no_fallback',
          ai_instruction: 'Snippet step that succeeds',
          snippet: 'await page.click("#success2");',
          prefer: 'snippet',
          fallback: 'ai'
        },
        {
          name: 'snippet_failure_fallback_to_ai',
          ai_instruction: 'Snippet step that fails, fallback to AI',
          snippet: 'await page.click("#failure");',
          prefer: 'snippet',
          fallback: 'ai'
        },
        {
          name: 'another_ai_failure_fallback',
          ai_instruction: 'Another AI failure with fallback',
          snippet: 'await page.click("#fallback2");',
          prefer: 'ai',
          fallback: 'snippet'
        }
      ]
    };

    // Set specific execution results
    mockMagnitudeExecutor.setStepResult('ai_success_no_fallback', true);
    mockMagnitudeExecutor.setStepResult('ai_failure_fallback_to_snippet', false);
    mockPlaywrightExecutor.setStepResult('ai_failure_fallback_to_snippet', true); // fallback
    
    mockPlaywrightExecutor.setStepResult('snippet_success_no_fallback', true);
    
    mockPlaywrightExecutor.setStepResult('snippet_failure_fallback_to_ai', false);
    mockMagnitudeExecutor.setStepResult('snippet_failure_fallback_to_ai', true); // fallback
    
    mockMagnitudeExecutor.setStepResult('another_ai_failure_fallback', false);
    mockPlaywrightExecutor.setStepResult('another_ai_failure_fallback', true); // fallback

    const report: ExecutionReport = await orchestrator.execute(intentSpec, {});

    // Verify fallback counting
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(5);
    expect(report.fallbackCount).toBe(3); // Three fallbacks occurred
    
    // Verify final usage counts after fallbacks
    expect(report.aiUsageCount).toBe(2); // ai_success_no_fallback + snippet_failure_fallback_to_ai
    expect(report.snippetUsageCount).toBe(3); // ai_failure_fallback_to_snippet + snippet_success_no_fallback + another_ai_failure_fallback

    // Verify individual fallback tracking
    expect(report.steps![0].fallbackOccurred).toBe(false);
    expect(report.steps![1].fallbackOccurred).toBe(true);
    expect(report.steps![2].fallbackOccurred).toBe(false);
    expect(report.steps![3].fallbackOccurred).toBe(true);
    expect(report.steps![4].fallbackOccurred).toBe(true);

    // Count fallbacks manually
    const actualFallbacks = report.steps!.filter(step => step.fallbackOccurred).length;
    expect(actualFallbacks).toBe(report.fallbackCount);

    console.log('✅ Fallback Count Tracking Test Results:');
    console.log(`   - Fallback Count: ${report.fallbackCount} (expected: 3)`);
    console.log(`   - Manual Count: ${actualFallbacks}`);
    console.log(`   - Final AI Usage: ${report.aiUsageCount}`);
    console.log(`   - Final Snippet Usage: ${report.snippetUsageCount}`);
    console.log('   - Fallback Details:');
    report.steps!.forEach((step, index) => {
      if (step.fallbackOccurred) {
        console.log(`     ${index + 1}. ${step.name}: ${step.pathUsed} (fallback)`);
      }
    });
  });

  test('should provide accurate pathUsed reporting for each step', async () => {
    const intentSpec: IntentSpec = {
      name: 'Path Used Reporting Test',
      description: 'Test accurate pathUsed reporting for each step',
      url: 'https://example.com',
      params: [],
      steps: [
        {
          name: 'step_1_ai_prefer',
          ai_instruction: 'Step 1 with AI preference',
          snippet: 'await page.click("#step1");',
          prefer: 'ai',
          fallback: 'snippet'
        },
        {
          name: 'step_2_snippet_prefer',
          ai_instruction: 'Step 2 with snippet preference',
          snippet: 'await page.click("#step2");',
          prefer: 'snippet',
          fallback: 'ai'
        },
        {
          name: 'step_3_ai_with_fallback',
          ai_instruction: 'Step 3 AI that will fallback',
          snippet: 'await page.click("#step3");',
          prefer: 'ai',
          fallback: 'snippet'
        },
        {
          name: 'step_4_snippet_with_fallback',
          ai_instruction: 'Step 4 snippet that will fallback',
          snippet: 'await page.click("#step4");',
          prefer: 'snippet',
          fallback: 'ai'
        }
      ]
    };

    // Set execution results
    mockMagnitudeExecutor.setStepResult('step_1_ai_prefer', true);
    mockPlaywrightExecutor.setStepResult('step_2_snippet_prefer', true);
    mockMagnitudeExecutor.setStepResult('step_3_ai_with_fallback', false);
    mockPlaywrightExecutor.setStepResult('step_3_ai_with_fallback', true); // fallback
    mockPlaywrightExecutor.setStepResult('step_4_snippet_with_fallback', false);
    mockMagnitudeExecutor.setStepResult('step_4_snippet_with_fallback', true); // fallback

    const report: ExecutionReport = await orchestrator.execute(intentSpec, {});

    // Verify pathUsed accuracy
    expect(report.overallSuccess).toBe(true);
    expect(report.steps).toHaveLength(4);

    // Step 1: AI prefer, AI success -> pathUsed should be 'ai'
    expect(report.steps![0].pathUsed).toBe('ai');
    expect(report.steps![0].fallbackOccurred).toBe(false);
    expect(report.steps![0].name).toBe('step_1_ai_prefer');

    // Step 2: Snippet prefer, snippet success -> pathUsed should be 'snippet'
    expect(report.steps![1].pathUsed).toBe('snippet');
    expect(report.steps![1].fallbackOccurred).toBe(false);
    expect(report.steps![1].name).toBe('step_2_snippet_prefer');

    // Step 3: AI prefer, AI fail, snippet success -> pathUsed should be 'snippet'
    expect(report.steps![2].pathUsed).toBe('snippet');
    expect(report.steps![2].fallbackOccurred).toBe(true);
    expect(report.steps![2].name).toBe('step_3_ai_with_fallback');

    // Step 4: Snippet prefer, snippet fail, AI success -> pathUsed should be 'ai'
    expect(report.steps![3].pathUsed).toBe('ai');
    expect(report.steps![3].fallbackOccurred).toBe(true);
    expect(report.steps![3].name).toBe('step_4_snippet_with_fallback');

    console.log('✅ Path Used Reporting Test Results:');
    console.log('   - Path Used Details:');
    report.steps!.forEach((step, index) => {
      const preference = intentSpec.steps[index].prefer;
      const fallbackInfo = step.fallbackOccurred ? ` (fallback from ${preference})` : '';
      console.log(`     ${index + 1}. ${step.name}: prefer=${preference} -> used=${step.pathUsed}${fallbackInfo}`);
    });
  });

  test('should track execution duration and timing accurately', async () => {
    const intentSpec: IntentSpec = {
      name: 'Duration Tracking Test',
      description: 'Test accurate duration tracking',
      url: 'https://example.com',
      params: [],
      steps: [
        {
          name: 'ai_step',
          ai_instruction: 'AI step with timing',
          snippet: 'await page.click("#ai");',
          prefer: 'ai',
          fallback: 'snippet'
        },
        {
          name: 'snippet_step',
          ai_instruction: 'Snippet step with timing',
          snippet: 'await page.click("#snippet");',
          prefer: 'snippet',
          fallback: 'ai'
        }
      ]
    };

    mockMagnitudeExecutor.setStepResult('ai_step', true);
    mockPlaywrightExecutor.setStepResult('snippet_step', true);

    const startTime = Date.now();
    const report: ExecutionReport = await orchestrator.execute(intentSpec, {});
    const endTime = Date.now();

    // Verify timing
    expect(report.totalDuration).toBeDefined();
    expect(report.totalDuration!).toBeGreaterThan(0);
    expect(report.totalDuration!).toBeLessThan(endTime - startTime + 100); // Allow some margin

    // Verify step durations
    report.steps!.forEach((step: StepExecutionResult) => {
      expect(step.duration).toBeDefined();
      expect(step.duration!).toBeGreaterThan(0);
    });

    console.log('✅ Duration Tracking Test Results:');
    console.log(`   - Total Duration: ${report.totalDuration}ms`);
    console.log('   - Step Durations:');
    report.steps!.forEach((step, index) => {
      console.log(`     ${index + 1}. ${step.name}: ${step.duration}ms (${step.pathUsed})`);
    });
  });

  test('should provide comprehensive execution report structure', async () => {
    const intentSpec: IntentSpec = {
      name: 'Complete Report Structure Test',
      description: 'Test complete execution report structure',
      url: 'https://example.com',
      params: ['PARAM1'],
      steps: [
        {
          name: 'test_step',
          ai_instruction: 'Test step',
          snippet: 'await page.click("#test");',
          prefer: 'ai',
          fallback: 'snippet'
        }
      ]
    };

    mockMagnitudeExecutor.setStepResult('test_step', true);

    const report: ExecutionReport = await orchestrator.execute(intentSpec, { PARAM1: 'value1' });

    // Verify complete report structure
    expect(report).toHaveProperty('executionId');
    expect(report).toHaveProperty('steps');
    expect(report).toHaveProperty('aiUsageCount');
    expect(report).toHaveProperty('snippetUsageCount');
    expect(report).toHaveProperty('fallbackCount');
    expect(report).toHaveProperty('screenshots');
    expect(report).toHaveProperty('overallSuccess');
    expect(report).toHaveProperty('suggestions');
    expect(report).toHaveProperty('totalDuration');

    // Verify executionId format
    expect(report.executionId).toMatch(/^exec_\d+_[a-z0-9]+$/);

    // Verify step structure
    expect(report.steps![0]).toHaveProperty('name');
    expect(report.steps![0]).toHaveProperty('pathUsed');
    expect(report.steps![0]).toHaveProperty('fallbackOccurred');
    expect(report.steps![0]).toHaveProperty('success');
    expect(report.steps![0]).toHaveProperty('duration');

    // Verify data types
    expect(typeof report.aiUsageCount).toBe('number');
    expect(typeof report.snippetUsageCount).toBe('number');
    expect(typeof report.fallbackCount).toBe('number');
    expect(typeof report.overallSuccess).toBe('boolean');
    expect(typeof report.totalDuration).toBe('number');
    expect(Array.isArray(report.steps)).toBe(true);
    expect(Array.isArray(report.screenshots)).toBe(true);
    expect(Array.isArray(report.suggestions)).toBe(true);

    console.log('✅ Complete Report Structure Test Results:');
    console.log(`   - Execution ID: ${report.executionId}`);
    console.log(`   - All required fields present: ✓`);
    console.log(`   - Correct data types: ✓`);
    console.log(`   - Report structure validated: ✓`);
  });

  test.afterEach(async () => {
    await orchestrator.stop();
    mockMagnitudeExecutor.clearExecutionLog();
    mockPlaywrightExecutor.clearExecutionLog();
  });
});