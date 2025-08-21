import { ExecutionEngine } from '../main/execution-engine';
import { IntentSpec } from '../flows/types';

// Mock AI executor
class MockAIExecutor {
  async execute(instruction: string): Promise<void> {
    console.log(`[AI] Executing: ${instruction}`);
    // Simulate AI execution
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Mock Snippet executor  
class MockSnippetExecutor {
  async execute(snippet: string): Promise<void> {
    console.log(`[SNIPPET] Executing: ${snippet}`);
    // Simulate snippet execution
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Example usage of the SDK Decider
async function demonstrateSDKDecider() {
  // Create executors
  const aiExecutor = new MockAIExecutor();
  const snippetExecutor = new MockSnippetExecutor();
  
  // Create execution engine with executors
  const engine = new ExecutionEngine(aiExecutor, snippetExecutor);
  
  // Load intent spec (this would normally be loaded from JSON)
  const intentSpec: IntentSpec = {
    name: "Login Flow with SDK Decider",
    url: "https://example.com/login",
    params: ["USERNAME", "PASSWORD"],
    preferences: {
      "navigate_to_login": "snippet",
      "fill_username": "ai",
      "fill_password": "snippet", 
      "submit_form": "ai"
    },
    steps: [
      {
        name: "navigate_to_login",
        action: "navigate",
        selector: "",
        value: "https://example.com/login",
        prefer: "snippet",
        fallback: "ai",
        ai_instruction: "Navigate to the login page at {{URL}}",
        snippet: "await page.goto('{{URL}}');"
      },
      {
        name: "fill_username", 
        action: "type",
        selector: "#username-field",
        value: "{{USERNAME}}",
        prefer: "ai",
        fallback: "snippet",
        ai_instruction: "Find the username field and type the username '{{USERNAME}}'",
        snippet: "await page.fill('#username-field', '{{USERNAME}}');"
      },
      {
        name: "fill_password",
        action: "type", 
        selector: "#password-field",
        value: "{{PASSWORD}}",
        prefer: "snippet",
        fallback: "ai",
        ai_instruction: "Find the password field and type the password '{{PASSWORD}}'",
        snippet: "await page.fill('#password-field', '{{PASSWORD}}');"
      },
      {
        name: "submit_form",
        action: "click",
        selector: "#login-button", 
        value: "",
        prefer: "ai",
        fallback: "snippet",
        ai_instruction: "Click the login button to submit the form",
        snippet: "await page.click('#login-button');"
      }
    ],
    successCheck: ".dashboard-welcome"
  };
  
  // Variables for execution
  const variables = {
    USERNAME: "john.doe@example.com",
    PASSWORD: "secretpassword123",
    URL: "https://example.com/login"
  };
  
  console.log("=== SDK Decider Execution Demo ===");
  console.log(`Executing intent: ${intentSpec.name}`);
  console.log(`Variables:`, variables);
  console.log("");
  
  try {
    // Execute the intent spec using the SDK Decider
    const report = await engine.executeIntentSpec(intentSpec, variables);
    
    console.log("=== Execution Report ===");
    console.log(`Overall Success: ${report.overallSuccess}`);
    console.log("");
    
    report.results.forEach((result, index) => {
      console.log(`Step ${index + 1}: ${result.step}`);
      console.log(`  Path Used: ${result.pathUsed}`);
      console.log(`  Fallback Occurred: ${result.fallbackOccurred}`);
      console.log(`  Success: ${result.success}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      console.log("");
    });
    
  } catch (error) {
    console.error("Execution failed:", error);
  }
}

// Run the demo
if (require.main === module) {
  demonstrateSDKDecider().catch(console.error);
}

export { demonstrateSDKDecider };