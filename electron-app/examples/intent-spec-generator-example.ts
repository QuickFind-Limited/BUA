/**
 * Example usage of the Intent Spec Generator
 * Demonstrates how to generate Intent Specs with both AI and snippet paths
 */

import { IntentSpecGenerator, generateIntentSpecFromRecording } from '../main/intent-spec-generator';
import { IntentSpecBuilder, buildExecutionPlan } from '../main/intent-spec-builder';
import { validateIntentSpec } from '../main/intent-spec-validator';
import { IntentSpec } from '../flows/types';

/**
 * Example 1: Generate Intent Spec from a Playwright recording
 */
export function exampleGenerateFromRecording() {
  const recordingPath = './recordings/login-flow.spec.ts';
  
  // Generate with custom options
  const intentSpec = generateIntentSpecFromRecording(recordingPath, {
    withFallback: true,
    preferSnippetFor: ['form_interactions', 'navigation'],
    preferAIFor: ['dynamic_elements', 'search_interactions'],
    defaultPreference: 'ai'
  });
  
  console.log('Generated Intent Spec:', JSON.stringify(intentSpec, null, 2));
  
  // Validate the generated spec
  const validation = validateIntentSpec(intentSpec);
  if (validation.valid) {
    console.log('✅ Intent Spec is valid');
  } else {
    console.log('❌ Intent Spec validation failed:', validation.errors);
  }
  
  return intentSpec;
}

/**
 * Example 2: Build execution plan from Intent Spec
 */
export function exampleBuildExecutionPlan() {
  // Load an existing Intent Spec (this would normally come from a file)
  const intentSpec: IntentSpec = {
    name: "Login Flow Example",
    description: "Demo login flow with dual execution paths",
    url: "https://example.com/login",
    params: ["USERNAME", "PASSWORD"],
    steps: [
      {
        name: "navigate_to_login",
        ai_instruction: "Navigate to the login page",
        snippet: "await page.goto('https://example.com/login');",
        prefer: "snippet",
        fallback: "ai"
      },
      {
        name: "enter_credentials",
        ai_instruction: "Enter the username {{USERNAME}} and password into the login form",
        snippet: "await page.fill('#username', '{{USERNAME}}'); await page.fill('#password', '{{PASSWORD}}');",
        prefer: "ai",
        fallback: "snippet",
        selector: "#username",
        value: "{{USERNAME}}"
      },
      {
        name: "submit_login",
        ai_instruction: "Click the login button to submit the form",
        snippet: "await page.click('button[type=\"submit\"]');",
        prefer: "snippet",
        fallback: "ai",
        selector: "button[type=\"submit\"]"
      }
    ],
    preferences: {
      dynamic_elements: "ai",
      simple_steps: "snippet"
    }
  };
  
  // Build execution plan with variables
  const executionPlan = buildExecutionPlan(intentSpec, {
    USERNAME: "test_user@example.com",
    PASSWORD: "secure_password123"
  }, {
    preferredPath: "ai",
    fallbackStrategy: "on_failure"
  });
  
  console.log('Execution Plan:', JSON.stringify(executionPlan, null, 2));
  
  // Display individual steps
  executionPlan.steps.forEach((step, index) => {
    console.log(`\nStep ${index + 1}: ${step.name}`);
    console.log(`Type: ${step.type}`);
    console.log(`Instruction: ${step.instruction}`);
    if (step.fallback) {
      console.log(`Fallback Type: ${step.fallback.type}`);
      console.log(`Fallback Instruction: ${step.fallback.instruction}`);
    }
  });
  
  return executionPlan;
}

/**
 * Example 3: Advanced Intent Spec generation with custom preferences
 */
export function exampleAdvancedGeneration() {
  const generator = new IntentSpecGenerator();
  
  // Custom options for different types of applications
  const ecommerceOptions = {
    withFallback: true,
    preferSnippetFor: ['navigation', 'form_submission'],
    preferAIFor: ['product_search', 'dynamic_content', 'recommendations'],
    defaultPreference: 'ai' as const
  };
  
  const adminPanelOptions = {
    withFallback: true,
    preferSnippetFor: ['navigation', 'form_interactions', 'data_entry'],
    preferAIFor: ['dynamic_tables', 'modal_dialogs'],
    defaultPreference: 'snippet' as const
  };
  
  // Generate Intent Specs for different scenarios
  console.log('E-commerce Intent Spec Options:', ecommerceOptions);
  console.log('Admin Panel Intent Spec Options:', adminPanelOptions);
  
  // Example of how you might choose options based on application type
  function chooseOptionsForApp(appType: string) {
    switch (appType) {
      case 'ecommerce':
        return ecommerceOptions;
      case 'admin':
        return adminPanelOptions;
      default:
        return {
          withFallback: true,
          preferSnippetFor: ['simple_interactions'],
          preferAIFor: ['complex_interactions'],
          defaultPreference: 'ai' as const
        };
    }
  }
  
  return { chooseOptionsForApp, ecommerceOptions, adminPanelOptions };
}

/**
 * Example 4: Testing execution paths
 */
export function exampleTestExecutionPaths() {
  const builder = new IntentSpecBuilder();
  
  // Sample Intent Spec for testing
  const testSpec: IntentSpec = {
    name: "Test Flow",
    description: "Testing different execution paths",
    url: "https://test.example.com",
    params: ["TEST_VALUE"],
    steps: [
      {
        name: "test_step",
        ai_instruction: "Perform test action with value {{TEST_VALUE}}",
        snippet: "await page.click('#test-button'); await page.fill('#test-input', '{{TEST_VALUE}}');",
        prefer: "ai",
        fallback: "snippet",
        selector: "#test-button",
        value: "{{TEST_VALUE}}"
      }
    ],
    preferences: {
      dynamic_elements: "ai",
      simple_steps: "snippet"
    }
  };
  
  // Test both AI-first and snippet-first execution plans
  const aiFirstPlan = builder.buildExecutionPlan(testSpec, { TEST_VALUE: "ai_test" }, {
    preferredPath: "ai",
    overridePreferences: true
  });
  
  const snippetFirstPlan = builder.buildExecutionPlan(testSpec, { TEST_VALUE: "snippet_test" }, {
    preferredPath: "snippet", 
    overridePreferences: true
  });
  
  console.log('AI-first plan:', aiFirstPlan.steps[0].type);
  console.log('Snippet-first plan:', snippetFirstPlan.steps[0].type);
  
  // Test plan for development (with dummy variables)
  const testPlan = builder.buildTestExecutionPlan(testSpec, 'snippet');
  console.log('Test plan variables:', testPlan.variables);
  
  return { aiFirstPlan, snippetFirstPlan, testPlan };
}

/**
 * Example 5: Complete workflow from recording to execution
 */
export async function exampleCompleteWorkflow() {
  console.log('🚀 Starting complete Intent Spec workflow...');
  
  try {
    // Step 1: Generate Intent Spec from recording
    console.log('📝 Step 1: Generating Intent Spec from recording...');
    const recordingPath = './recordings/sample-flow.spec.ts';
    const intentSpec = generateIntentSpecFromRecording(recordingPath, {
      withFallback: true,
      preferSnippetFor: ['navigation', 'form_submission'],
      preferAIFor: ['dynamic_search', 'modal_interactions'],
      defaultPreference: 'ai'
    });
    
    // Step 2: Validate the Intent Spec
    console.log('✅ Step 2: Validating Intent Spec...');
    const validation = validateIntentSpec(intentSpec);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Step 3: Build execution plan
    console.log('🔧 Step 3: Building execution plan...');
    const executionPlan = buildExecutionPlan(intentSpec, {
      USERNAME: "demo_user",
      PASSWORD: "demo_pass",
      SEARCH_TERM: "test product"
    });
    
    // Step 4: Display results
    console.log('📊 Step 4: Workflow complete!');
    console.log(`Generated Intent Spec: "${intentSpec.name}"`);
    console.log(`Steps: ${intentSpec.steps.length}`);
    console.log(`Parameters: ${intentSpec.params.join(', ')}`);
    console.log(`Execution steps: ${executionPlan.steps.length}`);
    
    // Display execution strategy for each step
    executionPlan.steps.forEach((step, index) => {
      const fallbackInfo = step.fallback ? ` → ${step.fallback.type}` : ' (no fallback)';
      console.log(`  ${index + 1}. ${step.name}: ${step.type}${fallbackInfo}`);
    });
    
    return { intentSpec, executionPlan, validation };
    
  } catch (error) {
    console.error('❌ Workflow failed:', error);
    throw error;
  }
}

// Export all examples for use in tests or demos
export const examples = {
  generateFromRecording: exampleGenerateFromRecording,
  buildExecutionPlan: exampleBuildExecutionPlan,
  advancedGeneration: exampleAdvancedGeneration,
  testExecutionPaths: exampleTestExecutionPaths,
  completeWorkflow: exampleCompleteWorkflow
};

// Example usage
if (require.main === module) {
  console.log('Running Intent Spec Generator Examples...\n');
  
  try {
    console.log('=== Example 1: Generate from Recording ===');
    exampleGenerateFromRecording();
    
    console.log('\n=== Example 2: Build Execution Plan ===');
    exampleBuildExecutionPlan();
    
    console.log('\n=== Example 3: Advanced Generation ===');
    exampleAdvancedGeneration();
    
    console.log('\n=== Example 4: Test Execution Paths ===');
    exampleTestExecutionPaths();
    
    console.log('\n=== Example 5: Complete Workflow ===');
    exampleCompleteWorkflow();
    
  } catch (error) {
    console.error('Error running examples:', error);
  }
}