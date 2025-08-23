// Use child process to handle ES module import
import { fork } from 'child_process';
import * as path from 'path';

let workerProcess: any = null;
let queryFunction: any = null;

async function getQueryFunction() {
  console.log('getQueryFunction called, queryFunction exists:', !!queryFunction);
  if (!queryFunction) {
    // Create a query function that uses the worker process
    queryFunction = async function* (options: any) {
      console.log('Query function invoked with options:', options.prompt?.substring(0, 100));
      // Ensure worker is started
      if (!workerProcess) {
        // Use v2 worker that supports file-based prompts for large inputs
        const workerPath = path.join(__dirname, 'claude-code-worker-v2.js');
        console.log('Starting worker process at:', workerPath);
        workerProcess = fork(workerPath, [], {
          silent: false,
          env: { ...process.env }
        });
        
        // Wait for worker to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error('Worker process timeout');
            reject(new Error('Worker process failed to start'));
          }, 5000);
          
          workerProcess.once('message', (msg: any) => {
            console.log('Worker message received:', msg);
            if (msg.type === 'ready') {
              clearTimeout(timeout);
              console.log('Worker process is ready');
              resolve(true);
            }
          });
        });
      }
      
      // Send request to worker
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Clean up worker process on timeout
          if (workerProcess) {
            workerProcess.kill();
            workerProcess = null;
            queryFunction = null;
          }
          reject(new Error('Claude Code SDK timeout'));
        }, 120000); // 120 second timeout
        
        // Handle worker exit/error
        workerProcess.once('exit', (code: number) => {
          clearTimeout(timeout);
          workerProcess = null;
          queryFunction = null;
          if (code !== 0) {
            reject(new Error('Worker process exited unexpectedly'));
          }
        });
        
        workerProcess.once('error', (error: any) => {
          clearTimeout(timeout);
          workerProcess = null;
          queryFunction = null;
          reject(error);
        });
        
        workerProcess.once('message', (msg: any) => {
          clearTimeout(timeout);
          if (msg.type === 'result') {
            if (msg.success) {
              resolve(msg.data);
            } else {
              // Clean up on error
              if (workerProcess) {
                workerProcess.kill();
                workerProcess = null;
                queryFunction = null;
              }
              reject(new Error(msg.error));
            }
          }
        });
        
        // Wrap send in try-catch to handle closed channel
        try {
          // Check prompt size - use file for large prompts to avoid Windows CLI limits
          const promptSize = options.prompt?.length || 0;
          let messageToSend: any = { type: 'analyze' };
          
          if (promptSize > 7000) {
            // Write to temp file for large prompts
            const os = require('os');
            const fs = require('fs');
            const tempFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}.txt`);
            fs.writeFileSync(tempFile, options.prompt);
            console.log(`Large prompt (${promptSize} bytes) written to temp file`);
            messageToSend.promptFile = tempFile;
          } else {
            messageToSend.prompt = options.prompt;
          }
          
          // Add any options
          if (options.options) {
            messageToSend.options = options.options;
          }
          
          workerProcess.send(messageToSend);
        } catch (error: any) {
          console.error('Failed to send to worker:', error.message);
          workerProcess = null;
          queryFunction = null;
          reject(new Error('Failed to communicate with worker process'));
        }
      });
      
      // Yield the result in the expected format
      yield {
        type: 'result',
        subtype: 'success',
        result: result
      };
    };
  }
  return queryFunction;
}

import Anthropic from '@anthropic-ai/sdk';
import { startBrowserAgent } from 'magnitude-core';
import { z } from 'zod';
import { IntentSpec } from '../flows/types';
import { validateIntentSpec, sanitizeIntentSpec } from './intent-spec-validator';
import { serializeRecording } from './recording-serializer';
import { generateIntentSpecPrompt, generateSimpleIntentSpecPrompt, generateValidationPrompt as generatePromptForValidation } from './intent-spec-prompt';
import { generateBulletproofIntentSpecPrompt } from './enhanced-prompt-generator';

// Model configuration per spec
const OPUS_MODEL = 'claude-opus-4-1-20250805';
const SONNET_MODEL = 'claude-sonnet-4-20250514';

// Initialize standard Anthropic SDK for Sonnet 4 (runtime AI actions)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Execute runtime AI action using Sonnet 4 (faster, cheaper for simple tasks)
 * Used for the 10% of steps that need AI during execution
 */
export async function executeRuntimeAIAction(
  instruction: string,
  context?: string
): Promise<{ success: boolean; result: string; confidence: number }> {
  try {
    const client = getAnthropicClient();
    
    // Use Sonnet for runtime actions - faster and cheaper
    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1000,
      temperature: 0.2, // Lower temperature for more deterministic actions
      system: `You are an intelligent browser automation assistant. You help complete browser tasks by understanding context and taking appropriate actions.

IMPORTANT: If you cannot complete the requested action because prerequisite steps are needed (like navigating to a login page before filling login fields), you should:
1. First try to complete the prerequisite action (e.g., click "Sign In" link if trying to fill login fields but not on login page)
2. Return the action you actually took
3. Set success to true if you made progress toward the goal

Be smart about navigation - if asked to fill a login form but you're not on a login page, look for and click sign-in/login links first.`,
      messages: [
        {
          role: 'user',
          content: `Execute this browser action: ${instruction}

Page context: ${context || 'No context provided'}

If the requested action cannot be performed directly but you see a way to navigate there (like clicking a Sign In button to get to a login form), do that instead.

Return JSON: {"action": "what you actually did", "success": true/false, "details": "brief result"}`
        }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Try to parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        success: parsed.success !== false,
        result: parsed.details || parsed.action || responseText,
        confidence: parsed.confidence || 0.85
      };
    } catch {
      // If not JSON, still return the response
      return {
        success: true,
        result: responseText,
        confidence: 0.7
      };
    }
  } catch (error) {
    console.error('Runtime AI action failed:', error);
    throw error;
  }
}

// Magnitude agent singleton
let magnitudeAgent: any = null;

export async function getMagnitudeAgent() {
  if (!magnitudeAgent) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Magnitude');
    }

    // Initialize Magnitude with proper model configuration
    // Using array format for multiple model configurations
    magnitudeAgent = await startBrowserAgent({
      llm: [
        {
          provider: 'anthropic' as const,
          options: {
            model: SONNET_MODEL, // claude-sonnet-4-20250514
            apiKey: apiKey,
            temperature: 0.2,
            maxTokens: 1500,
            system: 'You operate a browser. Be concise, deterministic, and prefer role/label selectors.'
          },
          roles: ['act'] as const
        },
        {
          provider: 'anthropic' as const,
          options: {
            model: OPUS_MODEL, // claude-opus-4-1-20250805
            apiKey: apiKey,
            temperature: 0,
            maxTokens: 1200,
            system: 'Return only JSON that matches the provided schema. No extra text.'
          },
          roles: ['extract'] as const
        },
        {
          provider: 'anthropic' as const,
          options: {
            model: OPUS_MODEL, // claude-opus-4-1-20250805
            apiKey: apiKey,
            temperature: 0.3,
            maxTokens: 1200,
            system: 'You are a planner/arbiter. Respond with short, strict JSON when asked.'
          },
          roles: ['query'] as const
        }
      ],
      browser: { 
        launchOptions: { 
          headless: true // Set to false for debugging
        } 
      },
      narration: { level: 'silent' } // Set to 'normal' for debugging
    } as any);
  }
  return magnitudeAgent;
}


// Interfaces
interface AnalysisRequest {
  recordingData: string;
  context?: string;
}

interface AnalysisResponse {
  name: string;
  startUrl: string;
  params: string[];
  steps: Array<{
    action: string;
    target: string;
    value: string;
  }>;
  successCheck: string;
}

interface ActRequest {
  instruction: string;
  context?: string;
  parameters?: Record<string, any>;
}

interface ActResponse {
  action: string;
  result: any;
  success: boolean;
  error?: string;
}

interface QueryRequest {
  query: string;
  context?: string;
  searchScope?: string;
}

interface QueryResponse {
  answer: string;
  sources?: string[];
  confidence: number;
}

/**
 * Analyze recording using Claude Code SDK with Sonnet 4 for Intent Spec generation
 * This is used ONCE during analysis phase to create the Intent Spec
 * Sonnet 4 is faster and more reliable for structured JSON generation
 */
export async function analyzeRecording(recordingData: any): Promise<IntentSpec> {
  const maxRetries = 3;
  const retryDelay = 1000; // Start with 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Analysis attempt ${attempt}/${maxRetries}`);
      
      const promptText = createAnalysisPrompt(recordingData);
      const query = await getQueryFunction();
      let result = '';
      
      // Use Claude Code SDK with Opus 4.1 (default)
      // Don't set maxTurns - let Opus 4.1 complete its reasoning
      for await (const message of query({
        prompt: promptText
      })) {
        if (message.type === 'result' && message.subtype === 'success') {
          result = message.result;
        }
      }

      if (!result) {
        throw new Error('No result returned from Claude');
      }

      // Parse and validate the result
      const parsedResult = parseAndValidateIntentSpec(result);
      
      console.log('Analysis successful:', parsedResult.name);
      return parsedResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Analysis attempt ${attempt} failed:`, errorMessage);
      
      if (attempt === maxRetries) {
        throw new Error(`Analysis failed after ${maxRetries} attempts. Last error: ${errorMessage}`);
      }
      
      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Analysis failed: Maximum retries exceeded');
}

// REMOVED: analyzeRecordingLegacy - use analyzeRecording directly

/**
 * Creates a prompt for analyzing a recording session with actual actions
 */
function createSessionAnalysisPrompt(session: any): string {
  const actions = session.actions || [];
  const url = session.url || 'Unknown URL';
  const screenshotPath = session.screenshotPath || '';
  
  // Create a human-readable description of actions
  const actionDescriptions = actions.map((action: any, index: number) => {
    switch(action.type) {
      case 'navigate':
        return `${index + 1}. Navigate to: ${action.url}`;
      case 'click':
        return `${index + 1}. Click on: ${action.selector || action.element?.text || 'element'}`;
      case 'type':
        return `${index + 1}. Type "${action.value}" into: ${action.selector || 'input field'}`;
      case 'select':
        return `${index + 1}. Select "${action.value}" from: ${action.selector || 'dropdown'}`;
      case 'submit':
        return `${index + 1}. Submit form: ${action.selector || 'form'}`;
      case 'scroll':
        return `${index + 1}. Scroll to position: x=${action.scrollPosition?.x}, y=${action.scrollPosition?.y}`;
      default:
        return `${index + 1}. ${action.type}: ${JSON.stringify(action)}`;
    }
  }).join('\n');
  
  return `You are an expert at analyzing browser automation recordings and converting them to Intent Specifications.

Analyze these ACTUAL recorded user actions and create an Intent Spec. Output ONLY valid JSON.

Recording Session Details:
- Start URL: ${url}
- Total Actions: ${actions.length}
- Session ID: ${session.id || 'Unknown'}

Recorded Actions:
${actionDescriptions}

Raw Action Data:
${JSON.stringify(actions, null, 2)}

CRITICAL RULES:
1. Analyze ONLY the actual recorded actions - do not invent steps
2. Detect patterns that should be variables (usernames, passwords, search terms, etc.)
3. Each action should become a step in the Intent Spec
4. Use the actual selectors from the recording
5. SELECTOR STRATEGY:
   - Provide multiple selectors when possible: ["#id", "[name='field']", "text=Label"]
   - Order selectors from most to least specific
6. PREFER/FALLBACK STRATEGY:
   - Navigation: prefer="snippet", fallback="snippet" (with retry)
   - Login/Auth fields: prefer="ai", fallback="snippet" (security sensitive)
   - Dynamic content: prefer="ai", fallback="snippet" (may change)
   - Form inputs: prefer="snippet", fallback="ai" (stable but may move)
   - Static buttons: prefer="snippet", fallback="ai"
   - Search/Filter: prefer="ai", fallback="snippet" (context matters)
   - Date pickers: prefer="ai", fallback="none" (complex interaction)
   - File uploads: prefer="snippet", fallback="none" (system specific)

Output this EXACT JSON structure:
{
  "name": "Descriptive name based on the actions performed",
  "description": "Brief description of what this automation does",
  "url": "${url}",
  "params": ["VARIABLE_NAMES_IF_ANY"],
  "skipNavigationStates": ["authenticated_area", "dashboard", "logged_in"],
  "success_screenshot": "${screenshotPath || ''}",
  "steps": [
    {
      "name": "Step description",
      "ai_instruction": "Natural language instruction",
      "snippet": "await page.ACTION('selector', 'value');",
      "prefer": "snippet or ai based on rules above",
      "fallback": "ai, snippet, or none based on rules",
      "selectors": ["primary selector", "fallback selector", "text selector"],
      "selector": "The primary selector (for backwards compatibility)",
      "value": "The actual value or {{VARIABLE}}"
    }
  ],
  "preferences": {
    "dynamic_elements": "ai",
    "simple_steps": "snippet"
  }
}

Analyze the recording and output ONLY the JSON:`;
}

/**
 * Creates a prompt for analyzing Playwright spec code
 */
function createPlaywrightSpecAnalysisPrompt(playwrightCode: string, screenshotPath: string = ''): string {
  return `You are an expert at analyzing Playwright test code and converting it to Intent Specifications.

Analyze this Playwright test recording and extract ONLY the actual user actions performed. 
IMPORTANT: Output ONLY valid JSON. No markdown, no explanations, no comments.

Playwright Test Code:
${playwrightCode}

CRITICAL RULES:
1. Extract ONLY the actual actions from the Playwright code
2. Ignore test setup/teardown code
3. The first goto() is the starting URL
4. Convert each await page.* action to an Intent Spec step
5. Detect variables (values that should be parameterized like usernames, passwords, search terms)
6. DO NOT invent or hallucinate steps that aren't in the code
7. PREFER="ai" FIRST scenarios:
   - Login credentials (security sensitive)
   - Dynamic search/filter fields
   - Content that changes based on context
   - Date/time pickers
   - Complex interactions (drag & drop)
8. MULTIPLE SELECTORS:
   - Always provide array of selectors when possible
   - Include: ID, name, role, text, data attributes
9. FALLBACK="none" only for:
   - File system operations
   - Very specific wait conditions
   - One-time setup steps

Output this EXACT JSON structure:
{
  "name": "Descriptive name based on the actions",
  "description": "Brief description of what this automation does",
  "url": "The first page.goto() URL",
  "params": ["VARIABLE_NAMES_HERE"],
  "skipNavigationStates": ["authenticated_area", "dashboard", "logged_in"],
  "success_screenshot": "${screenshotPath}",
  "steps": [
    {
      "name": "Step description",
      "ai_instruction": "Natural language instruction",
      "snippet": "The actual Playwright code line",
      "prefer": "snippet",
      "fallback": "ai",
      "selector": "The selector used",
      "value": "The value or {{VARIABLE}}"
    }
  ],
  "preferences": {
    "dynamic_elements": "ai",
    "simple_steps": "snippet"
  }
}

Analyze the Playwright code and output ONLY the JSON:`;
}

/**
 * Creates a comprehensive analysis prompt with examples and explicit format requirements
 */
function createAnalysisPrompt(recordingData: any): string {
  // Log the recording data for debugging
  console.log('Recording data type:', typeof recordingData);
  console.log('Recording data preview:', typeof recordingData === 'string' ? recordingData.substring(0, 500) : JSON.stringify(recordingData).substring(0, 500));
  
  // Extract screenshot path if provided
  let screenshotPath = '';
  let actualRecordingData = recordingData;
  
  // Check if recordingData contains both code and screenshot path
  if (recordingData && typeof recordingData === 'object' && !Array.isArray(recordingData)) {
    if (recordingData.recordingData) {
      actualRecordingData = recordingData.recordingData;
      screenshotPath = recordingData.screenshotPath || '';
    } else if (recordingData.specCode) {
      actualRecordingData = recordingData.specCode;
      screenshotPath = recordingData.screenshotPath || '';
    }
  }
  
  // ALWAYS use enhanced bulletproof prompt for ALL recordings
  // This prompt utilizes all available data for robust Intent Specs
  if (actualRecordingData && typeof actualRecordingData === 'object') {
    console.log('🚀 Using ENHANCED BULLETPROOF prompt for comprehensive Intent Spec generation');
    
    // Handle both extractedInputs (from recording) and capturedInputs (from console)
    if (!actualRecordingData.capturedInputs) {
      // First check if we have extractedInputs from the recording
      if (actualRecordingData.extractedInputs && Array.isArray(actualRecordingData.extractedInputs)) {
        const capturedInputs: any = {};
        actualRecordingData.extractedInputs.forEach((input: any) => {
          capturedInputs[input.field] = {
            field: input.field,
            value: input.value,
            type: input.element?.type || 'text',
            url: input.url || actualRecordingData.url,
            isLoginField: input.element?.isLoginField || false
          };
        });
        actualRecordingData.capturedInputs = capturedInputs;
        console.log('📝 Converted extractedInputs to capturedInputs:', Object.keys(capturedInputs).join(', '));
      }
      // Also check console logs as fallback
      else if (actualRecordingData.console) {
        const capturedInputs: any = {};
        Object.values(actualRecordingData.console as any).forEach((logs: any) => {
        if (Array.isArray(logs)) {
          logs.forEach((log: any) => {
            if (log.args) {
              log.args.forEach((arg: any) => {
                if (arg.value && typeof arg.value === 'string' && arg.value.includes('[RECORDER-DATA]')) {
                  try {
                    const data = JSON.parse(arg.value.replace('[RECORDER-DATA]', ''));
                    if (data.field && data.value) {
                      // Keep the latest value for each field
                      capturedInputs[data.field] = {
                        field: data.field,
                        value: data.value,
                        type: data.inputType || 'text',
                        url: data.url || actualRecordingData.url,
                        isLoginField: data.isLoginField || false
                      };
                    }
                  } catch (e) {
                    // Skip parsing errors
                  }
                }
              });
            }
          });
        }
      });
      
        if (Object.keys(capturedInputs).length > 0) {
          actualRecordingData.capturedInputs = capturedInputs;
          console.log('📝 Extracted captured inputs from console:', Object.keys(capturedInputs).join(', '));
        }
      }
    }
    
    console.log('📊 Data includes:', {
      hasActions: !!actualRecordingData.actions,
      hasDomSnapshots: !!actualRecordingData.domSnapshots,
      hasNetworkData: !!actualRecordingData.networkRequests,
      hasMutations: !!actualRecordingData.mutations,
      hasCapturedInputs: !!actualRecordingData.capturedInputs
    });
    return generateBulletproofIntentSpecPrompt(actualRecordingData);
  }
  
  // For Playwright specs and all other cases, use the general prompt that allows inference
  // This enables Claude to intelligently infer steps from start/end URLs
  const recordingString = typeof actualRecordingData === 'string' ? actualRecordingData : JSON.stringify(actualRecordingData);
  
  // Check if it's Playwright spec code
  if (typeof recordingString === 'string' && 
      (recordingString.includes('import { test') || 
       recordingString.includes("import { test") ||
       recordingString.includes('test(') ||
       recordingString.includes("test("))) {
    return createPlaywrightSpecAnalysisPrompt(recordingString, screenshotPath);
  }
  
  return `You are an expert at analyzing browser automation recordings and converting them to Intent Specifications.

Your task: Analyze the provided recording and output a STRICT JSON Intent Spec. NO prose, comments, or markdown - only valid JSON.

CRITICAL: Choose execution strategy intelligently:
- SNIPPET PREFERRED for: passwords, credit cards, SSNs, API keys, any sensitive data, stable form fields with IDs
- SNIPPET PREFERRED for: simple navigation, waiting, screenshots, elements with stable IDs/data-testid
- AI PREFERRED for: dynamic content, search results, marketing pages, elements that may move/change
- AI PREFERRED for: popups, modals, complex interactions needing context

IMPORTANT: For authentication steps (login, sign in, email, password):
- Add skipConditions with requiredState: "authenticated_area" to skip if already logged in
- This allows the flow to skip auth steps when user is already authenticated

REQUIRED OUTPUT FORMAT:
{
  "name": "Clear descriptive name for this automation",
  "description": "Brief description of what this automation does",
  "url": "Starting URL (must be complete URL with protocol)",
  "params": ["PARAM1", "PARAM2"],
  "steps": [
    {
      "name": "Step name describing the action",
      "ai_instruction": "Natural language instruction for AI to execute",
      "snippet": "await page.click('selector'); // Playwright code snippet",
      "prefer": "snippet",
      "fallback": "ai",
      "selector": "CSS selector (optional)",
      "value": "{{PARAM}} or static value (optional)"
    }
  ],
  "preferences": {
    "dynamic_elements": "ai",
    "simple_steps": "snippet"
  }
}

IMPORTANT RULES:
1. Each step MUST have: name, ai_instruction, snippet, prefer, fallback
2. INTELLIGENTLY set "prefer" based on the action type:
   - Use "snippet" for: password fields, sensitive data entry, precise form fills, API keys, credit cards, SSNs
   - Use "snippet" for: simple navigation (page.goto), waiting for elements, taking screenshots
   - Use "snippet" for: actions with stable selectors (IDs, data-testid attributes)
   - Use "ai" for: dynamic content (search results, popups, modals)
   - Use "ai" for: elements that may vary (marketing pages, A/B tests)
   - Use "ai" for: complex interactions requiring context understanding
3. Set appropriate fallback:
   - If prefer="snippet", set fallback="ai" (AI can often figure it out if snippet fails)
   - If prefer="ai", set fallback="snippet" (deterministic backup)
   - Use fallback="none" only if the other approach would definitely not work
4. snippet should be valid Playwright code - PRESERVE EXACT SELECTORS FROM RECORDING
5. CRITICAL: If the recording uses page.getByRole(), page.getByLabel(), page.getByText() - KEEP THESE EXACT SELECTORS
6. DO NOT convert modern Playwright selectors to CSS selectors - keep getByRole, getByLabel, getByText as-is
7. Replace dynamic values with {{PARAM_NAME}} and list in params array
8. Common dynamic values: usernames, passwords, email addresses, dates, IDs
9. Use descriptive parameter names: {{USERNAME}}, {{PASSWORD}}, {{EMAIL}}, {{SEARCH_TERM}}
10. ai_instruction should be clear natural language instructions
11. PRESERVE the recording's selector strategy - don't invent new selectors
12. preferences: Set based on overall pattern - if mostly forms/data entry use "snippet", if mostly dynamic use "ai"

EXAMPLE OUTPUT:
{
  "name": "Zoho Inventory Login",
  "description": "Automated login process for Zoho Inventory",
  "url": "https://inventory.zoho.com/",
  "params": ["EMAIL", "PASSWORD"],
  "steps": [
    {
      "name": "Navigate to login page",
      "ai_instruction": "Navigate to Zoho Inventory login page",
      "snippet": "await page.goto('https://inventory.zoho.com/');",
      "prefer": "snippet",
      "fallback": "none",
      "comment": "Simple navigation - snippet is reliable"
    },
    {
      "name": "Click Sign In",
      "ai_instruction": "Click the Sign In button on the homepage",
      "snippet": "await page.click('a:has-text(\"Sign In\")');",
      "prefer": "ai",
      "fallback": "snippet",
      "comment": "Marketing page button - position may vary"
    },
    {
      "name": "Enter email",
      "ai_instruction": "Enter email address in the email field",
      "snippet": "await page.getByRole('textbox', { name: 'Email address or mobile number' }).fill('{{EMAIL}}');",
      "prefer": "snippet",
      "fallback": "ai",
      "value": "{{EMAIL}}",
      "skipConditions": [{"requiredState": "authenticated_area"}],
      "comment": "PRESERVE getByRole selector from recording - more reliable than CSS"
    },
    {
      "name": "Click Next",
      "ai_instruction": "Click the Next button",
      "snippet": "await page.getByRole('button', { name: 'Next' }).click();",
      "prefer": "snippet",
      "fallback": "ai",
      "comment": "Modern Playwright selector - accessible and stable"
    },
    {
      "name": "Wait for password field",
      "ai_instruction": "Wait for password field to appear",
      "snippet": "await page.getByRole('textbox', { name: 'Enter password' }).waitFor({ timeout: 5000 });",
      "prefer": "snippet",
      "fallback": "none",
      "comment": "Using role-based selector for waiting"
    },
    {
      "name": "Enter password",
      "ai_instruction": "Enter password in the password field",
      "snippet": "await page.getByRole('textbox', { name: 'Enter password' }).fill('{{PASSWORD}}');",
      "prefer": "snippet",
      "fallback": "ai",
      "value": "{{PASSWORD}}",
      "skipConditions": [{"requiredState": "authenticated_area"}],
      "comment": "SENSITIVE DATA - always prefer snippet for passwords, keep getByRole"
    },
    {
      "name": "Complete login",
      "ai_instruction": "Click the Sign In button to complete login",
      "snippet": "await page.getByRole('button', { name: 'Sign in' }).click();",
      "prefer": "snippet",
      "fallback": "ai",
      "comment": "Preserve exact selector from recording"
    }
  ],
  "preferences": {
    "dynamic_elements": "ai",
    "simple_steps": "snippet"
  }
}

RECORDING DATA:
${JSON.stringify(recordingData, null, 2)}

Output only the JSON Intent Spec:`;
}

/**
 * Parses Claude's response and validates the Intent Spec
 */
function parseAndValidateIntentSpec(response: string): IntentSpec {
  // Clean up the response - remove any markdown formatting or extra text
  let cleanedResponse = response.trim();
  
  // Find JSON content if wrapped in markdown or other text
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[0];
  }

  let parsedSpec: any;
  try {
    parsedSpec = JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error('Failed to parse Claude response as JSON:', cleanedResponse);
    throw new Error(`Invalid JSON response from Claude: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
  }

  // Validate the parsed spec
  const validation = validateIntentSpec(parsedSpec);
  
  if (!validation.valid) {
    console.error('Intent Spec validation failed:', validation.errors);
    
    // Try to sanitize and recover
    const sanitized = sanitizeIntentSpec(parsedSpec);
    const sanitizedValidation = validateIntentSpec(sanitized);
    
    if (sanitizedValidation.valid) {
      console.log('Recovered with sanitized Intent Spec');
      return sanitized as IntentSpec;
    }
    
    throw new Error(`Invalid Intent Spec: ${validation.errors.join(', ')}`);
  }

  // Additional post-processing and normalization
  if (!parsedSpec.description) {
    parsedSpec.description = `Automated workflow: ${parsedSpec.name}`;
  }

  // Normalize field names to preferred format
  if (parsedSpec.startUrl && !parsedSpec.url) {
    parsedSpec.url = parsedSpec.startUrl;
    delete parsedSpec.startUrl;
  }

  // Normalize step selectors
  if (parsedSpec.steps) {
    parsedSpec.steps = parsedSpec.steps.map((step: any) => {
      if (step.target && !step.selector) {
        step.selector = step.target;
        delete step.target;
      }
      return step;
    });
  }

  return parsedSpec as IntentSpec;
}

/**
 * Decision making using Claude Code (Opus 4.1) per spec section 7b
 */
export async function makeDecision(signals: any): Promise<{ choice: string; confidence: number; rationale: string }> {
  const promptText = `Return STRICT JSON only: {"choice":"act|snippet","confidence":0..1,"rationale":"short"}

Choose "act" (AI) or "snippet" (deterministic).
Prefer snippet: CI, reproducibility, flaky selectors.
Prefer act: flexible UI, resilience.

Signals:
${JSON.stringify(signals, null, 2)}`;

  try {
    const query = await getQueryFunction();
    let result = '';
    
    // Use Claude Code SDK with Opus 4.1
    for await (const message of query({
      prompt: promptText,
      options: {
        maxTurns: 1
      }
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
      }
    }

    return JSON.parse(result);
  } catch (error) {
    throw new Error(`Decision failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute Magnitude act using Sonnet 4 (per spec section 7c)
 * ONLY Sonnet 4 is used for Magnitude act operations
 */
export async function executeMagnitudeAct(context: string, action: any): Promise<ActResponse> {
  try {
    const agent = await getMagnitudeAgent();
    
    const instruction = `Analyze and reason about the following browser automation action in the given context.

Context:
${context}

Action to perform:
- Type: ${action.action}
- Target: ${action.target}
- Value: ${action.value}
${action.description ? `- Description: ${action.description}` : ''}

Provide reasoning about:
1. How to locate the target element effectively
2. What the action should accomplish
3. Any potential issues or considerations
4. The best approach to execute this action`;

    // Use Magnitude agent with Sonnet 4 for act operations
    const result = await agent.act(instruction);
    
    return {
      action: 'Action reasoning completed',
      result: result || 'Magnitude agent has analyzed the action and provided guidance',
      success: true
    };
  } catch (error) {
    return {
      action: 'Action reasoning',
      result: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process query using Claude Code (Opus 4.1) for Magnitude query operations
 */
export async function processQuery(request: QueryRequest): Promise<QueryResponse> {
  const prompt = `Answer the following query:

Query: ${request.query}
${request.context ? `Context: ${request.context}` : ''}
${request.searchScope ? `Search Scope: ${request.searchScope}` : ''}

Return JSON: {"answer": "detailed answer", "sources": ["source1"], "confidence": 0-100}`;

  try {
    const query = await getQueryFunction();
    let result = '';
    
    // Use Claude Code SDK with Opus 4.1 for query
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 1
      }
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
      }
    }

    return JSON.parse(result);
  } catch (error) {
    throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract data for Magnitude query using Claude Code (Opus 4.1)
 */
export async function extractDataForMagnitudeQuery(content: string, extractionGoal: string): Promise<any> {
  const prompt = `Extract the following from this content: ${extractionGoal}

Content:
${content}

Return the extracted data as JSON.`;

  try {
    const query = await getQueryFunction();
    let result = '';
    
    // Use Claude Code SDK with Opus 4.1
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 1
      }
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
      }
    }

    return JSON.parse(result);
  } catch (error) {
    throw new Error(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute Magnitude query using Opus 4.1 for data extraction
 * This is the main function used by MagnitudeExecutor for extraction operations
 */
export async function executeMagnitudeQuery(html: string, query: string): Promise<any> {
  try {
    const agent = await getMagnitudeAgent();
    
    const extractionQuery = `Extract data based on this query from the provided HTML content.

Query: ${query}

HTML Content:
${html}

Instructions:
- Focus on extracting the specific information requested in the query
- Return structured data in JSON format when possible
- If extracting multiple items, return them as an array
- Include confidence level if uncertain about the extraction
- Return null if the requested information is not found`;

    // Use Magnitude agent's extract operation with Opus 4.1
    // Import zod for schema definition
    const { z } = await import('zod');
    
    // Define a zod schema to get JSON response
    const schema = z.object({
      data: z.any().describe('Extracted data from the HTML content'),
      confidence: z.number().optional().describe('Confidence level (0-1) in the extraction')
    });

    const result = await agent.extract(extractionQuery, schema);
    
    // Return the extracted data
    return result.data || result;
  } catch (error) {
    throw new Error(`Magnitude query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute Magnitude decision using Opus 4.1 for decision making
 * This function uses agent.query() for decision-making operations
 */
export async function executeMagnitudeDecision(context: string, options: any): Promise<{ choice: string; confidence: number; rationale: string }> {
  try {
    const agent = await getMagnitudeAgent();
    
    const decisionQuery = `Make a decision based on the provided context and options.

Context:
${context}

Options:
${JSON.stringify(options, null, 2)}

Instructions:
- Analyze the context and available options
- Make a reasoned decision based on the information provided
- Return your choice with confidence level and rationale
- Consider factors like reliability, efficiency, and appropriateness`;

    // Import zod for schema definition
    const { z } = await import('zod');
    
    // Define a zod schema for decision response
    const schema = z.object({
      choice: z.string().describe('The chosen option'),
      confidence: z.number().min(0).max(1).describe('Confidence level (0-1) in the decision'),
      rationale: z.string().describe('Brief explanation of the decision reasoning')
    });

    const result = await agent.query(decisionQuery, schema);
    
    return {
      choice: result.choice,
      confidence: result.confidence,
      rationale: result.rationale
    };
  } catch (error) {
    throw new Error(`Magnitude decision failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build prompt from Intent Spec using Claude Code (Opus 4.1)
 */
export async function buildPromptFromSpec(spec: any): Promise<string> {
  const prompt = `Convert this Intent Spec to an actionable prompt for browser automation:
${JSON.stringify(spec, null, 2)}

Return a clear, step-by-step prompt.`;

  try {
    const query = await getQueryFunction();
    let result = '';
    
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 1
      }
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Prompt building failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Test connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const query = await getQueryFunction();
    let success = false;
    
    for await (const message of query({
      prompt: 'Reply with {"status": "ok"}',
      options: {
        maxTurns: 1
      }
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        const result = JSON.parse(message.result);
        success = result.status === 'ok';
      }
    }
    
    return success;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

/**
 * Validate an Intent Spec using Claude Code (Opus 4.1) - renamed to avoid conflict
 */
export async function validateIntentSpecWithClaude(intentSpec: any): Promise<{
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  summary: string;
}> {
  try {
    const intentSpecJson = typeof intentSpec === 'string' ? intentSpec : JSON.stringify(intentSpec, null, 2);
    const promptText = generatePromptForValidation(intentSpecJson);
    
    const query = await getQueryFunction();
    let result = '';
    
    for await (const message of query({
      prompt: promptText,
      options: {
        maxTurns: 1
      }
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
      }
    }

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    const jsonResult = jsonMatch ? jsonMatch[0] : result;
    
    return JSON.parse(jsonResult);
  } catch (error) {
    return {
      isValid: false,
      score: 0,
      issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      suggestions: ['Please check the Intent Spec format and try again'],
      summary: 'Validation error occurred'
    };
  }
}

/**
 * Preview serialized recording without full analysis
 */
export function previewRecordingSerialization(recordingData: any): string {
  try {
    let data: any[];
    
    if (typeof recordingData === 'string') {
      try {
        data = JSON.parse(recordingData);
      } catch {
        data = [{ type: 'raw', data: recordingData }];
      }
    } else {
      data = recordingData || [];
    }

    return serializeRecording(data);
  } catch (error) {
    return `Error serializing recording: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Enhanced recording analysis with metadata extraction
 */
export async function analyzeRecordingWithMetadata(request: AnalysisRequest): Promise<{
  analysis: AnalysisResponse;
  metadata: any;
  serializedRecording: string;
}> {
  try {
    // Parse recording data
    let recordingData: any[];
    
    if (typeof request.recordingData === 'string') {
      try {
        recordingData = JSON.parse(request.recordingData);
      } catch {
        recordingData = [{ type: 'raw', data: request.recordingData }];
      }
    } else {
      recordingData = request.recordingData || [];
    }

    // Serialize recording
    const serializedRecording = serializeRecording(recordingData);
    
    // Get basic analysis
    const intentSpec = await analyzeRecording(request.recordingData);
    
    // Convert to expected format
    const analysis = {
      name: intentSpec.name,
      startUrl: intentSpec.startUrl || '',
      params: intentSpec.params || [],
      steps: intentSpec.steps.map(step => ({
        action: step.action,
        target: step.target || '',
        value: step.value || ''
      })),
      successCheck: intentSpec.successCheck || ''
    };
    
    // Extract metadata (simplified version - could be enhanced with another Claude call)
    const metadata = {
      stepCount: recordingData.length,
      complexity: recordingData.length > 10 ? 'complex' : recordingData.length > 5 ? 'moderate' : 'simple',
      hasNavigation: recordingData.some(action => action.type === 'navigate'),
      hasFormInput: recordingData.some(action => action.type === 'type' || action.type === 'fill'),
      hasClickActions: recordingData.some(action => action.type === 'click'),
      estimatedDuration: recordingData.length * 2, // rough estimate in seconds
      variableCount: analysis.params?.length || 0
    };

    return {
      analysis,
      metadata,
      serializedRecording
    };
  } catch (error) {
    throw new Error(`Enhanced analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}