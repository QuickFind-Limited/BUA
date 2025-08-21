/**
 * Fallback Mechanism Demo
 * 
 * This example demonstrates how to use the ExecutionOrchestrator
 * with different fallback configurations and scenarios.
 */

import { ExecutionOrchestrator } from '../main/execution-orchestrator';
import { IntentSpec, IntentStep, ExecutionReport } from '../flows/types';

async function demonstrateFallbackMechanisms() {
  console.log('🚀 ExecutionOrchestrator Fallback Demonstration\n');

  // Demo 1: Default Fallback Enabled
  console.log('Demo 1: AI to Snippet Fallback (Default)');
  console.log('─'.repeat(50));
  
  const orchestratorWithFallback = new ExecutionOrchestrator({
    enableFallback: true,
    screenshotComparison: false,
    saveScreenshots: false,
    timeout: 10000
  });

  const fallbackEnabledSpec: IntentSpec = {
    name: "Fallback Enabled Demo",
    url: "https://example.com",
    params: [],
    steps: [
      {
        name: "ai_might_fail",
        action: "click",
        target: "#dynamic-button",
        description: "AI execution might fail, will fallback to snippet"
      },
      {
        name: "ai_should_work",
        action: "wait",
        target: "body",
        value: "1000",
        description: "Simple wait that AI should handle fine"
      }
    ]
  };

  try {
    const report1 = await orchestratorWithFallback.execute(fallbackEnabledSpec);
    displayExecutionReport(report1, 'Fallback Enabled');
  } catch (error) {
    console.error('Error in fallback demo:', error);
  } finally {
    await orchestratorWithFallback.stop();
  }

  console.log('\n');

  // Demo 2: Fallback Disabled (Strict Mode)
  console.log('Demo 2: No Fallback (Strict Mode)');
  console.log('─'.repeat(50));

  const orchestratorNoFallback = new ExecutionOrchestrator({
    enableFallback: false,
    screenshotComparison: false,
    saveScreenshots: false,
    timeout: 10000
  });

  const noFallbackSpec: IntentSpec = {
    name: "No Fallback Demo",
    url: "https://example.com", 
    params: [],
    steps: [
      {
        name: "critical_step",
        action: "click",
        target: "#must-work-element",
        description: "Critical step that must work or execution stops"
      },
      {
        name: "never_reached",
        action: "type",
        target: "#input",
        value: "this should not execute if previous step fails",
        description: "This step should not execute if previous fails"
      }
    ]
  };

  try {
    const report2 = await orchestratorNoFallback.execute(noFallbackSpec);
    displayExecutionReport(report2, 'No Fallback');
  } catch (error) {
    console.error('Error in no-fallback demo:', error);
  } finally {
    await orchestratorNoFallback.stop();
  }

  console.log('\n');

  // Demo 3: Step-Level Fallback Control
  console.log('Demo 3: Step-Level Fallback Control');
  console.log('─'.repeat(50));

  const orchestratorStepControl = new ExecutionOrchestrator({
    enableFallback: true,
    screenshotComparison: false,
    saveScreenshots: false,
    timeout: 10000
  });

  const stepControlSpec: IntentSpec = {
    name: "Step-Level Control Demo",
    url: "https://example.com",
    params: [],
    steps: [
      {
        name: "fallback_allowed",
        action: "click",
        target: "#button1",
        description: "This step allows fallback (default behavior)"
      },
      {
        name: "no_fallback_critical",
        action: "click", 
        target: "#critical-button",
        fallback: "none" as any, // Force no fallback for this step
        description: "Critical step with no fallback allowed"
      },
      {
        name: "prefer_snippet",
        snippet: "await page.click('#snippet-button');",
        prefer: "snippet" as any,
        fallback: "ai" as any,
        action: "click",
        target: "#snippet-button", 
        description: "Prefers snippet execution, AI as fallback"
      }
    ]
  };

  try {
    const report3 = await orchestratorStepControl.execute(stepControlSpec);
    displayExecutionReport(report3, 'Step-Level Control');
  } catch (error) {
    console.error('Error in step control demo:', error);
  } finally {
    await orchestratorStepControl.stop();
  }

  console.log('\n');

  // Demo 4: Event Monitoring
  console.log('Demo 4: Fallback Event Monitoring');
  console.log('─'.repeat(50));

  const orchestratorWithEvents = new ExecutionOrchestrator({
    enableFallback: true,
    screenshotComparison: false,
    saveScreenshots: false,
    timeout: 10000
  });

  // Set up event listeners
  const events: any[] = [];
  
  orchestratorWithEvents.on('execution-started', (event) => {
    events.push({ type: 'execution-started', timestamp: new Date(), ...event });
    console.log(`📤 Execution started: ${event.intentSpec.name}`);
  });

  orchestratorWithEvents.on('step-started', (event) => {
    events.push({ type: 'step-started', timestamp: new Date(), ...event });
    console.log(`🔄 Step ${event.stepIndex + 1}/${event.totalSteps}: ${event.step.description}`);
  });

  orchestratorWithEvents.on('fallback-started', (event) => {
    events.push({ type: 'fallback-started', timestamp: new Date(), ...event });
    console.log(`⚠️  Fallback initiated for step ${event.stepIndex + 1}: ${event.step.action}`);
  });

  orchestratorWithEvents.on('fallback-completed', (event) => {
    events.push({ type: 'fallback-completed', timestamp: new Date(), ...event });
    console.log(`${event.success ? '✅' : '❌'} Fallback completed for step ${event.stepIndex + 1}`);
  });

  orchestratorWithEvents.on('step-completed', (result) => {
    events.push({ type: 'step-completed', timestamp: new Date(), ...result });
    const fallbackInfo = result.fallbackOccurred ? ' (via fallback)' : '';
    console.log(`📋 Step completed: ${result.name} → ${result.pathUsed}${fallbackInfo}`);
  });

  orchestratorWithEvents.on('execution-completed', (report) => {
    events.push({ type: 'execution-completed', timestamp: new Date(), ...report });
    console.log(`🎉 Execution completed: ${report.overallSuccess ? 'SUCCESS' : 'FAILURE'}`);
  });

  const eventMonitoringSpec: IntentSpec = {
    name: "Event Monitoring Demo",
    url: "https://example.com",
    params: [],
    steps: [
      {
        name: "monitored_step_1",
        action: "navigate",
        target: "https://example.com/page1",
        description: "Navigation step with event monitoring"
      },
      {
        name: "monitored_step_2", 
        action: "click",
        target: "#monitored-button",
        description: "Click step that might trigger fallback"
      }
    ]
  };

  try {
    const report4 = await orchestratorWithEvents.execute(eventMonitoringSpec);
    displayExecutionReport(report4, 'Event Monitoring');
    
    console.log('\n📊 Captured Events:');
    events.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.type} at ${event.timestamp.toISOString()}`);
    });
    
  } catch (error) {
    console.error('Error in event monitoring demo:', error);
  } finally {
    await orchestratorWithEvents.stop();
  }

  console.log('\n🏁 Fallback demonstration completed!');
}

/**
 * Display a formatted execution report
 */
function displayExecutionReport(report: ExecutionReport, demoName: string): void {
  console.log(`\n📋 ${demoName} Results:`);
  console.log(`  Overall Success: ${report.overallSuccess ? '✅' : '❌'}`);
  console.log(`  Total Steps: ${report.steps?.length || 0}`);
  console.log(`  AI Usage: ${report.aiUsageCount || 0}`);
  console.log(`  Snippet Usage: ${report.snippetUsageCount || 0}`);
  console.log(`  Fallback Count: ${report.fallbackCount || 0}`);
  console.log(`  Duration: ${report.totalDuration || 0}ms`);
  
  if (report.steps && report.steps.length > 0) {
    console.log(`\n  Step Details:`);
    report.steps.forEach((step, index) => {
      const status = step.success ? '✅' : '❌';
      const fallback = step.fallbackOccurred ? ' (fallback)' : '';
      console.log(`    ${index + 1}. ${status} ${step.name} → ${step.pathUsed}${fallback}`);
      if (!step.success && step.error) {
        console.log(`       Error: ${step.error}`);
      }
    });
  }

  if (report.suggestions && report.suggestions.length > 0) {
    console.log(`\n  💡 Suggestions:`);
    report.suggestions.forEach(suggestion => {
      console.log(`    - ${suggestion}`);
    });
  }
}

/**
 * Simulate execution scenarios for testing fallback behavior
 */
async function simulateFallbackScenarios() {
  console.log('\n🧪 Simulating Various Fallback Scenarios\n');

  const scenarios = [
    {
      name: "High AI Success Rate",
      description: "90% AI success, 10% fallback to snippet",
      aiSuccessRate: 0.9,
      snippetSuccessRate: 0.95
    },
    {
      name: "Frequent AI Failures", 
      description: "30% AI success, 70% fallback to snippet",
      aiSuccessRate: 0.3,
      snippetSuccessRate: 0.9
    },
    {
      name: "Snippet Reliability Issues",
      description: "50% AI success, 40% snippet success on fallback",
      aiSuccessRate: 0.5,
      snippetSuccessRate: 0.4
    }
  ];

  for (const scenario of scenarios) {
    console.log(`📊 Scenario: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    const results = {
      totalSteps: 100,
      aiSuccesses: 0,
      snippetSuccesses: 0,
      totalFailures: 0,
      fallbackCount: 0
    };

    // Simulate 100 steps
    for (let i = 0; i < 100; i++) {
      const aiSuccess = Math.random() < scenario.aiSuccessRate;
      
      if (aiSuccess) {
        results.aiSuccesses++;
      } else {
        results.fallbackCount++;
        const snippetSuccess = Math.random() < scenario.snippetSuccessRate;
        if (snippetSuccess) {
          results.snippetSuccesses++;
        } else {
          results.totalFailures++;
        }
      }
    }

    const overallSuccessRate = ((results.aiSuccesses + results.snippetSuccesses) / results.totalSteps * 100).toFixed(1);
    const fallbackRate = (results.fallbackCount / results.totalSteps * 100).toFixed(1);

    console.log(`   Results: ${overallSuccessRate}% success, ${fallbackRate}% fallback rate`);
    console.log(`   AI: ${results.aiSuccesses}, Snippet: ${results.snippetSuccesses}, Failed: ${results.totalFailures}\n`);
  }
}

// Export functions for use in other modules
export {
  demonstrateFallbackMechanisms,
  simulateFallbackScenarios,
  displayExecutionReport
};

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateFallbackMechanisms()
    .then(() => simulateFallbackScenarios())
    .catch(console.error);
}