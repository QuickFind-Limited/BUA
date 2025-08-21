import { chromium, Browser, Page } from '@playwright/test';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { 
  IntentStep, 
  IntentSpec, 
  FlowResult, 
  LLMProviders, 
  FlowRunnerConfig,
  DEFAULT_CONFIG,
  CLAUDE_MODELS,
  LogLevel 
} from './types';

// Magnitude Flow Runner Configuration (imported from types)

/**
 * Magnitude Hybrid Flow Runner
 * 
 * This runner combines multiple LLM providers for different tasks:
 * - ACT model (Sonnet): Performs browser automation actions
 * - QUERY model (Opus): Extracts and analyzes data
 */
export class MagnitudeFlowRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private providers: LLMProviders;
  private logs: string[] = [];

  constructor(apiKey: string) {
    // Initialize LLM providers
    this.providers = {
      act: new Anthropic({
        apiKey,
        defaultHeaders: {
          'anthropic-version': '2023-06-01'
        }
      }),
      query: new Anthropic({
        apiKey,
        defaultHeaders: {
          'anthropic-version': '2023-06-01'
        }
      })
    };
  }

  /**
   * Parse Intent Specification from JSON file
   */
  private parseIntentSpec(intentPath: string): IntentSpec {
    try {
      const intentData = readFileSync(intentPath, 'utf8');
      const intent = JSON.parse(intentData) as IntentSpec;
      this.log(`Parsed intent spec: ${intent.name}`);
      return intent;
    } catch (error) {
      throw new Error(`Failed to parse intent spec: ${error}`);
    }
  }

  /**
   * Handle variable substitution in intent values
   */
  private substituteVariables(value: string, variables: Record<string, string>): string {
    let substituted = value;
    for (const [key, val] of Object.entries(variables)) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      substituted = substituted.replace(pattern, val);
    }
    return substituted;
  }

  /**
   * Build prompts for ACT model (browser automation)
   */
  private buildActPrompt(step: IntentStep, pageContext: string): string {
    return `
You are a browser automation assistant. Based on the current page context, execute the following action:

Action: ${step.action}
Target: ${step.target}
Value: ${step.value}

Current Page Context:
${pageContext}

Please provide the exact Playwright code to execute this action. Respond with only the code, no explanations.

Example responses:
- For click: await page.click('${step.target}');
- For type: await page.fill('${step.target}', '${step.value}');
- For wait: await page.waitForTimeout(${step.target});
- For navigation: await page.goto('${step.value}');
`;
  }

  /**
   * Build prompts for QUERY model (data extraction)
   */
  private buildQueryPrompt(pageContent: string, extractionGoal: string): string {
    return `
You are a data extraction assistant. Analyze the following web page content and extract relevant information.

Extraction Goal: ${extractionGoal}

Page Content:
${pageContent}

Please extract the relevant data and return it as a structured JSON object. Focus on the specific information requested in the extraction goal.
`;
  }

  /**
   * Initialize browser and page
   */
  private async initializeBrowser(): Promise<void> {
    try {
      this.browser = await chromium.launch({ headless: false });
      this.page = await this.browser.newPage();
      this.log('Browser initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error}`);
    }
  }

  /**
   * Execute a single automation step using ACT model
   */
  private async executeStep(step: IntentStep): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Get current page context
      const pageTitle = await this.page.title();
      const pageUrl = this.page.url();
      const pageContext = `Title: ${pageTitle}\nURL: ${pageUrl}`;

      // Build prompt for ACT model
      const actPrompt = this.buildActPrompt(step, pageContext);

      this.log(`Executing step: ${step.action} on ${step.target}`);

      // Get automation code from ACT model
      const actResponse = await this.providers.act.messages.create({
        model: CLAUDE_MODELS.ACT,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: actPrompt
          }
        ]
      });

      const automationCode = actResponse.content[0].type === 'text' ? 
        actResponse.content[0].text.trim() : '';

      // Execute the action based on step type
      switch (step.action.toLowerCase()) {
        case 'click':
          await this.page.click(step.target);
          break;
        case 'type':
          await this.page.fill(step.target, step.value);
          break;
        case 'wait':
          await this.page.waitForTimeout(parseInt(step.target));
          break;
        case 'navigate':
          await this.page.goto(step.value);
          break;
        case 'select':
          await this.page.selectOption(step.target, step.value);
          break;
        default:
          // For complex actions, use the LLM-generated code
          this.log(`Using LLM-generated automation: ${automationCode}`);
          // Note: In a real implementation, you'd need to safely evaluate this code
          // For now, we'll log it and handle basic actions manually
      }

      this.log(`Step completed successfully: ${step.action}`);
    } catch (error) {
      throw new Error(`Failed to execute step ${step.action}: ${error}`);
    }
  }

  /**
   * Extract data using QUERY model
   */
  private async extractData(extractionGoal: string): Promise<any> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Get page content
      const pageContent = await this.page.content();
      const visibleText = await this.page.textContent('body') || '';

      // Build prompt for QUERY model
      const queryPrompt = this.buildQueryPrompt(visibleText, extractionGoal);

      this.log('Extracting data with QUERY model');

      // Extract data using QUERY model
      const queryResponse = await this.providers.query.messages.create({
        model: CLAUDE_MODELS.QUERY,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: queryPrompt
          }
        ]
      });

      const extractedData = queryResponse.content[0].type === 'text' ? 
        queryResponse.content[0].text.trim() : '';

      // Try to parse as JSON, fallback to raw text
      try {
        return JSON.parse(extractedData);
      } catch {
        return { rawData: extractedData };
      }
    } catch (error) {
      throw new Error(`Failed to extract data: ${error}`);
    }
  }

  /**
   * Check success conditions
   */
  private async checkSuccess(successCheck: string): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      // Wait for the success element to appear
      await this.page.waitForSelector(successCheck, { timeout: 5000 });
      this.log(`Success condition met: ${successCheck}`);
      return true;
    } catch {
      this.log(`Success condition not met: ${successCheck}`);
      return false;
    }
  }

  /**
   * Log messages with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(logMessage);
  }

  /**
   * Main flow execution method
   */
  public async runIntentFlow(
    intentPath: string, 
    variables: Record<string, string> = {},
    extractionGoal?: string
  ): Promise<FlowResult> {
    try {
      this.log('Starting Magnitude flow execution');
      
      // Parse Intent Specification
      const intent = this.parseIntentSpec(intentPath);
      
      // Validate required parameters
      if (intent.params) {
        for (const param of intent.params) {
          if (!variables[param]) {
            throw new Error(`Missing required parameter: ${param}`);
          }
        }
      }

      // Initialize browser
      await this.initializeBrowser();
      
      if (!this.page) {
        throw new Error('Failed to initialize page');
      }

      // Navigate to start URL
      this.log(`Navigating to: ${intent.startUrl}`);
      await this.page.goto(intent.startUrl);

      // Execute each step
      for (let i = 0; i < intent.steps.length; i++) {
        const step = intent.steps[i];
        
        // Substitute variables in step values
        const substitutedStep = {
          ...step,
          value: this.substituteVariables(step.value, variables)
        };

        this.log(`Executing step ${i + 1}/${intent.steps.length}: ${step.action}`);
        await this.executeStep(substitutedStep);
        
        // Small delay between steps
        await this.page.waitForTimeout(500);
      }

      // Check success conditions
      const success = await this.checkSuccess(intent.successCheck);
      
      // Extract data if requested
      let extractedData;
      if (extractionGoal && success) {
        extractedData = await this.extractData(extractionGoal);
      }

      this.log(`Flow execution completed. Success: ${success}`);

      return {
        success,
        data: extractedData,
        logs: this.logs
      };

    } catch (error) {
      this.log(`Flow execution failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: this.logs
      };
    } finally {
      // Cleanup
      if (this.browser) {
        await this.browser.close();
        this.log('Browser closed');
      }
    }
  }

  /**
   * Run flow with retry logic
   */
  public async runIntentFlowWithRetry(
    intentPath: string,
    variables: Record<string, string> = {},
    extractionGoal?: string,
    maxRetries: number = 3
  ): Promise<FlowResult> {
    let lastResult: FlowResult | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log(`Attempt ${attempt}/${maxRetries}`);
      
      lastResult = await this.runIntentFlow(intentPath, variables, extractionGoal);
      
      if (lastResult.success) {
        this.log(`Flow succeeded on attempt ${attempt}`);
        return lastResult;
      }
      
      if (attempt < maxRetries) {
        this.log(`Attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      }
    }

    this.log(`All ${maxRetries} attempts failed`);
    return lastResult!;
  }
}

// Example usage and demonstration
export async function exampleUsage() {
  // Initialize the flow runner
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const runner = new MagnitudeFlowRunner(apiKey);

  // Example 1: Simple flow without variables
  console.log('=== Example 1: Simple Navigation Flow ===');
  try {
    const result1 = await runner.runIntentFlow(
      join(__dirname, '../intents/exampleNoVars.json')
    );
    console.log('Result:', result1);
  } catch (error) {
    console.error('Example 1 failed:', error);
  }

  // Example 2: Flow with variables and data extraction
  console.log('\n=== Example 2: Login Flow with Data Extraction ===');
  try {
    const result2 = await runner.runIntentFlowWithRetry(
      join(__dirname, '../intents/exampleWithVars.json'),
      {
        USERNAME: 'testuser@example.com',
        PASSWORD: 'testpassword123'
      },
      'Extract user profile information from the dashboard'
    );
    console.log('Result:', result2);
  } catch (error) {
    console.error('Example 2 failed:', error);
  }

  // Example 3: Custom intent with complex extraction
  console.log('\n=== Example 3: E-commerce Product Search ===');
  
  const ecommerceIntent: IntentSpec = {
    name: 'Product Search and Price Extraction',
    startUrl: 'https://example-shop.com',
    params: ['SEARCH_TERM'],
    steps: [
      {
        action: 'click',
        target: '#search-input',
        value: ''
      },
      {
        action: 'type',
        target: '#search-input',
        value: '{{SEARCH_TERM}}'
      },
      {
        action: 'click',
        target: '.search-button',
        value: ''
      },
      {
        action: 'wait',
        target: '3000',
        value: ''
      }
    ],
    successCheck: '.product-results'
  };

  try {
    // Write temporary intent file
    const tempIntentPath = join(__dirname, '../intents/temp-ecommerce.json');
    const fs = require('fs');
    fs.writeFileSync(tempIntentPath, JSON.stringify(ecommerceIntent, null, 2));

    const result3 = await runner.runIntentFlow(
      tempIntentPath,
      {
        SEARCH_TERM: 'laptop computer'
      },
      'Extract product names, prices, and ratings from the search results'
    );
    console.log('Result:', result3);

    // Cleanup temp file
    fs.unlinkSync(tempIntentPath);
  } catch (error) {
    console.error('Example 3 failed:', error);
  }
}

// Export for use in other modules
export default MagnitudeFlowRunner;