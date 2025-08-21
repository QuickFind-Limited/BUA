import { test, expect } from '@playwright/test';
import { MagnitudeExecutor } from '../main/magnitude-executor';
import { PlaywrightExecutor } from '../main/playwright-executor';
import { FlowStorage } from '../main/flow-storage';
import { IntentSpec } from '../flows/types';

/**
 * Test suite for Magnitude execution system
 */

test.describe('Magnitude Execution System', () => {
  let executor: MagnitudeExecutor;
  let storage: FlowStorage;

  test.beforeEach(async () => {
    executor = new MagnitudeExecutor({
      headless: true,
      timeout: 10000,
      saveScreenshots: false
    });
    storage = new FlowStorage();
  });

  test.afterEach(async () => {
    if (executor) {
      await executor.stop();
    }
  });

  test('should initialize MagnitudeExecutor', () => {
    expect(executor).toBeDefined();
    expect(executor.getMetrics()).toBeDefined();
    expect(executor.getLogs()).toEqual([]);
  });

  test('should execute simple navigation flow', async () => {
    const simpleFlow: IntentSpec = {
      name: "Simple Navigation Test",
      params: [],
      startUrl: "https://example.com",
      steps: [
        {
          action: "wait",
          target: "h1",
          value: "5000",
          description: "Wait for page title"
        }
      ],
      successCheck: "Example Domain"
    };

    const result = await executor.executeFlow(simpleFlow);
    
    expect(result.success).toBe(true);
    expect(result.logs).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics?.stepsExecuted).toBe(1);
  });

  test('should handle variable substitution', async () => {
    const flowWithVariables: IntentSpec = {
      name: "Variable Test Flow",
      startUrl: "https://httpbin.org/get?test={{testValue}}",
      params: ["testValue"],
      steps: [
        {
          action: "wait",
          target: "body",
          value: "3000",
          description: "Wait for page load"
        }
      ],
      successCheck: "httpbin"
    };

    const variables = { testValue: "magnitude-test" };
    const result = await executor.executeFlow(flowWithVariables, variables);
    
    expect(result.success).toBe(true);
  });

  test('should handle execution failure gracefully', async () => {
    const failingFlow: IntentSpec = {
      name: "Failing Flow Test",
      params: [],
      startUrl: "https://httpstat.us/404",
      steps: [
        {
          action: "click",
          target: "#non-existent-element",
          value: "",
          description: "Try to click non-existent element"
        }
      ],
      successCheck: "This will not be found"
    };

    const result = await executor.executeFlow(failingFlow);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.logs.length).toBeGreaterThan(0);
  });

  test('should emit progress events', async () => {
    const progressEvents: any[] = [];
    
    executor.on('progress', (progress) => {
      progressEvents.push(progress);
    });

    const simpleFlow: IntentSpec = {
      name: "Progress Test Flow",
      params: [],
      startUrl: "https://example.com",
      steps: [
        {
          action: "wait",
          target: "body",
          value: "1000",
          description: "Wait step"
        }
      ],
      successCheck: "Example"
    };

    await executor.executeFlow(simpleFlow);
    
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0]).toHaveProperty('stepIndex');
    expect(progressEvents[0]).toHaveProperty('status');
    expect(progressEvents[0]).toHaveProperty('currentStep');
  });
});

test.describe('PlaywrightExecutor', () => {
  let playwrightExecutor: PlaywrightExecutor;

  test.beforeEach(() => {
    playwrightExecutor = new PlaywrightExecutor({
      headless: true,
      timeout: 10000,
      saveScreenshots: false
    });
  });

  test.afterEach(async () => {
    if (playwrightExecutor.isInitialized()) {
      await playwrightExecutor.cleanup();
    }
  });

  test('should initialize browser', async () => {
    await playwrightExecutor.initialize();
    expect(playwrightExecutor.isInitialized()).toBe(true);
  });

  test('should navigate to URL', async () => {
    await playwrightExecutor.initialize();
    const result = await playwrightExecutor.navigate('https://example.com');
    
    expect(result.success).toBe(true);
    expect(result.data?.url).toBe('https://example.com');
  });

  test('should get page content', async () => {
    await playwrightExecutor.initialize();
    await playwrightExecutor.navigate('https://example.com');
    
    const content = await playwrightExecutor.getPageContent();
    
    expect(content.html).toContain('Example Domain');
    expect(content.text).toContain('Example Domain');
    expect(content.url).toBe('https://example.com/');
    expect(content.title).toContain('Example');
  });

  test('should get page info', async () => {
    await playwrightExecutor.initialize();
    await playwrightExecutor.navigate('https://example.com');
    
    const info = await playwrightExecutor.getPageInfo();
    
    expect(info.url).toBe('https://example.com/');
    expect(info.title).toContain('Example');
    expect(info.viewport).toHaveProperty('width');
    expect(info.viewport).toHaveProperty('height');
  });

  test('should execute wait action', async () => {
    await playwrightExecutor.initialize();
    await playwrightExecutor.navigate('https://example.com');
    
    const step = {
      action: 'wait',
      target: 'h1',
      value: '3000',
      description: 'Wait for heading'
    };

    const result = await playwrightExecutor.executeAction(step);
    expect(result.success).toBe(true);
  });
});

test.describe('FlowStorage', () => {
  let storage: FlowStorage;
  let testFlow: IntentSpec;

  test.beforeEach(() => {
    storage = new FlowStorage();
    testFlow = {
      name: "Test Storage Flow",
      params: [],
      startUrl: "https://example.com",
      steps: [
        {
          action: "wait",
          target: "body",
          value: "1000",
          description: "Wait for page"
        }
      ],
      successCheck: "Example Domain"
    };
  });

  test('should save and load flow', async () => {
    const variables = { test: "value" };
    const result = {
      success: true,
      logs: ["Test log"],
      data: { extracted: "data" }
    };

    const flowId = await storage.saveExecutedFlow(testFlow, variables, result);
    expect(flowId).toBeDefined();

    const loadedFlow = await storage.loadFlow(flowId);
    expect(loadedFlow).toBeDefined();
    expect(loadedFlow?.spec.name).toBe("Test Storage Flow");
    expect(loadedFlow?.variables).toEqual(variables);
  });

  test('should list saved flows', async () => {
    const result = {
      success: true,
      logs: ["Test log"],
      data: {}
    };

    await storage.saveExecutedFlow(testFlow, {}, result);
    
    const flows = await storage.listFlows();
    expect(flows.length).toBeGreaterThan(0);
    
    const savedFlow = flows.find(f => f.spec.name === "Test Storage Flow");
    expect(savedFlow).toBeDefined();
  });

  test('should filter flows', async () => {
    const result = {
      success: true,
      logs: ["Test log"],
      data: {}
    };

    await storage.saveExecutedFlow(testFlow, {}, result, ["test-tag"]);
    
    const filteredFlows = await storage.listFlows({
      tags: ["test-tag"]
    });
    
    expect(filteredFlows.length).toBeGreaterThan(0);
    expect(filteredFlows[0].metadata.tags).toContain("test-tag");
  });

  test('should export and import flow', async () => {
    const result = {
      success: true,
      logs: ["Test log"],
      data: {}
    };

    const flowId = await storage.saveExecutedFlow(testFlow, {}, result);
    
    const exportData = await storage.exportFlow(flowId);
    expect(exportData).toBeDefined();
    
    const importedFlowId = await storage.importFlow(exportData!, true);
    expect(importedFlowId).toBeDefined();
    
    const importedFlow = await storage.loadFlow(importedFlowId!);
    expect(importedFlow?.spec.name).toBe(testFlow.name);
  });

  test('should get flow statistics', async () => {
    const result = {
      success: true,
      logs: ["Test log"],
      data: {},
      metrics: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000,
        stepsExecuted: 1,
        stepsTotal: 1,
        retryCount: 0,
        browserInteractions: 1,
        llmCalls: { act: 1, query: 0 }
      }
    };

    const flowId = await storage.saveExecutedFlow(testFlow, {}, result);
    
    const stats = await storage.getFlowStats(flowId);
    expect(stats).toBeDefined();
    expect(stats?.totalExecutions).toBe(1);
    expect(stats?.successRate).toBe(100);
    expect(stats?.averageDuration).toBe(1000);
  });

  test('should get storage statistics', async () => {
    const result = {
      success: true,
      logs: ["Test log"],
      data: {}
    };

    await storage.saveExecutedFlow(testFlow, {}, result);
    
    const stats = await storage.getStorageStats();
    expect(stats.totalFlows).toBeGreaterThan(0);
    expect(stats.totalExecutions).toBeGreaterThan(0);
  });
});

test.describe('Integration Tests', () => {
  test('should execute complete flow with hybrid model approach', async () => {
    test.setTimeout(60000);
    // Skip if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      test.skip();
      return;
    }

    const executor = new MagnitudeExecutor({
      headless: true,
      timeout: 15000,
      saveScreenshots: false,
      saveFlow: false
    });

    const integrationFlow: IntentSpec = {
      name: "Integration Test Flow",
      params: [],
      startUrl: "https://httpbin.org/forms/post",
      steps: [
        {
          action: "type",
          target: "input[name='custname']",
          value: "Test Customer",
          description: "Enter customer name"
        },
        {
          action: "type",
          target: "input[name='custtel']", 
          value: "123-456-7890",
          description: "Enter phone number"
        },
        {
          action: "type",
          target: "input[name='custemail']",
          value: "test@example.com",
          description: "Enter email"
        },
        {
          action: "click",
          target: "input[type='submit']",
          value: "",
          description: "Submit form"
        }
      ],
      successCheck: "httpbin"
    };

    try {
      const result = await executor.executeFlow(integrationFlow);
      
      expect(result).toBeDefined();
      expect(result.logs).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.llmCalls.act).toBeGreaterThan(0);
      
      // Should have used Sonnet 4 for act operations
      expect(result.metrics?.llmCalls.act).toBeGreaterThan(0);
      
    } finally {
      await executor.stop();
    }
  });
});