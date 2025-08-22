/**
 * Intent Spec Generator - Generates Intent Specifications leveraging rich recording data
 * including multiple selectors, DOM snapshots, timing, and 40+ event types
 */

import { IntentSpec, IntentStep } from '../flows/types';
import { serializeRecording } from './recording-serializer';
import { 
  generateEnhancedIntentSpecPrompt,
  generateVariableExtractionPrompt,
  generateComplexInteractionPrompt,
  generateFlowAnalysisPrompt 
} from './enhanced-intent-spec-prompt';
import fs from 'fs';
import path from 'path';

export interface GenerationOptions {
  withFallback: boolean;
  preferSnippetFor: string[];
  preferAIFor: string[];
  defaultPreference: 'ai' | 'snippet';
}

export interface PlaywrightRecordingStep {
  type: string;
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
  description?: string;
  timestamp?: number;
  target?: {
    selector?: string;
    text?: string;
    placeholder?: string;
    tagName?: string;
    attributes?: Record<string, string>;
  };
}

/**
 * Generates Intent Specifications from Playwright recordings with dual AI/snippet paths
 */
export class IntentSpecGenerator {
  /**
   * Generates an Intent Spec from a Playwright recording file
   * @param recordingPath Path to the recording.spec.ts file
   * @param options Generation options for preferences and fallbacks
   * @returns Complete Intent Spec with both AI and snippet paths
   */
  generateFromRecording(
    recordingPath: string,
    options: GenerationOptions = {
      withFallback: true,
      preferSnippetFor: ['dynamic_elements', 'form_interactions'],
      preferAIFor: ['simple_steps', 'navigation'],
      defaultPreference: 'ai'
    }
  ): IntentSpec {
    // Parse the recording file
    const recording = this.parseRecordingFile(recordingPath);
    
    // Extract basic metadata
    const metadata = this.extractMetadata(recording, recordingPath);
    
    // Generate steps with both AI and snippet paths
    const steps = this.generateSteps(recording, options);
    
    // Extract parameters from the steps
    const params = this.extractParameters(steps);
    
    // Build preferences based on options and step analysis
    const preferences = this.buildPreferences(steps, options);
    
    // Generate the complete Intent Spec
    const intentSpec: IntentSpec = {
      name: metadata.name,
      description: metadata.description,
      url: metadata.url,
      params: params,
      steps: steps,
      preferences: preferences,
      success_screenshot: metadata.successScreenshot,
      recording_spec: recordingPath
    };
    
    return intentSpec;
  }

  /**
   * Parses a Playwright recording file and extracts the steps
   * @param recordingPath Path to the recording file
   * @returns Array of recording steps
   */
  private parseRecordingFile(recordingPath: string): PlaywrightRecordingStep[] {
    try {
      const content = fs.readFileSync(recordingPath, 'utf-8');
      
      // Parse the Playwright test file to extract actions
      const steps: PlaywrightRecordingStep[] = [];
      
      // Extract page.goto() calls
      const gotoMatches = content.match(/page\.goto\(['"`]([^'"`]+)['"`]\)/g);
      if (gotoMatches) {
        gotoMatches.forEach((match, index) => {
          const url = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
          if (url) {
            steps.push({
              type: 'navigate',
              url: url,
              description: `Navigate to ${url}`
            });
          }
        });
      }
      
      // Extract page.click() calls
      const clickMatches = content.match(/page\.click\(['"`]([^'"`]+)['"`]\)/g);
      if (clickMatches) {
        clickMatches.forEach((match) => {
          const selector = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
          if (selector) {
            steps.push({
              type: 'click',
              selector: selector,
              description: `Click on element with selector ${selector}`,
              target: { selector }
            });
          }
        });
      }
      
      // Extract page.fill() calls
      const fillMatches = content.match(/page\.fill\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/g);
      if (fillMatches) {
        fillMatches.forEach((match) => {
          const parts = match.match(/page\.fill\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/);
          if (parts) {
            const selector = parts[1];
            const value = parts[2];
            steps.push({
              type: 'fill',
              selector: selector,
              value: value,
              description: `Fill field ${selector} with value`,
              target: { selector }
            });
          }
        });
      }
      
      // Extract page.selectOption() calls
      const selectMatches = content.match(/page\.selectOption\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/g);
      if (selectMatches) {
        selectMatches.forEach((match) => {
          const parts = match.match(/page\.selectOption\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/);
          if (parts) {
            const selector = parts[1];
            const value = parts[2];
            steps.push({
              type: 'select',
              selector: selector,
              value: value,
              description: `Select option ${value} from ${selector}`,
              target: { selector }
            });
          }
        });
      }
      
      // Extract page.waitForSelector() calls
      const waitMatches = content.match(/page\.waitForSelector\(['"`]([^'"`]+)['"`]\)/g);
      if (waitMatches) {
        waitMatches.forEach((match) => {
          const selector = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
          if (selector) {
            steps.push({
              type: 'wait',
              selector: selector,
              description: `Wait for element ${selector} to appear`,
              target: { selector }
            });
          }
        });
      }
      
      return steps;
    } catch (error) {
      console.error('Error parsing recording file:', error);
      return [];
    }
  }

  /**
   * Extracts metadata from the recording
   * @param recording Array of recording steps
   * @param recordingPath Path to the recording file
   * @returns Metadata object
   */
  private extractMetadata(recording: PlaywrightRecordingStep[], recordingPath: string): {
    name: string;
    description: string;
    url: string;
    successScreenshot?: string;
  } {
    const filename = path.basename(recordingPath, '.spec.ts');
    const firstNavigateStep = recording.find(step => step.type === 'navigate');
    
    return {
      name: this.generateFlowName(recording, filename),
      description: this.generateFlowDescription(recording),
      url: firstNavigateStep?.url || 'https://example.com',
      successScreenshot: this.findSuccessScreenshot(recordingPath)
    };
  }

  /**
   * Generates steps with both AI instructions and Playwright snippets
   * @param recording Array of recording steps
   * @param options Generation options
   * @returns Array of Intent Steps with dual paths
   */
  private generateSteps(recording: PlaywrightRecordingStep[], options: GenerationOptions): IntentStep[] {
    return recording.map((step, index) => {
      const stepName = `step_${index + 1}_${step.type}`;
      const aiInstruction = this.generateAIInstruction(step);
      const snippet = this.generatePlaywrightSnippet(step);
      const preference = this.determineStepPreference(step, options);
      
      return {
        name: stepName,
        ai_instruction: aiInstruction,
        snippet: snippet,
        prefer: preference,
        fallback: options.withFallback ? (preference === 'ai' ? 'snippet' : 'ai') : 'none',
        selector: step.selector || step.target?.selector,
        value: this.parameterizeValue(step.value),
        
        // Legacy fields for backward compatibility
        action: step.type,
        description: step.description
      };
    });
  }

  /**
   * Generates AI instruction from a recording step
   * @param step Recording step
   * @returns Human-readable AI instruction
   */
  private generateAIInstruction(step: PlaywrightRecordingStep): string {
    switch (step.type) {
      case 'navigate':
        return `Navigate to the URL: ${step.url}`;
      
      case 'click':
        if (step.target?.text) {
          return `Click on the element containing text "${step.target.text}"`;
        }
        return `Click on the element located by selector "${step.selector}"`;
      
      case 'fill':
        if (step.target?.placeholder) {
          return `Fill the input field with placeholder "${step.target.placeholder}" with the value`;
        }
        return `Enter text into the input field located by selector "${step.selector}"`;
      
      case 'select':
        return `Select the option "${step.value}" from the dropdown located by selector "${step.selector}"`;
      
      case 'wait':
        return `Wait for the element with selector "${step.selector}" to become visible`;
      
      default:
        return `Perform ${step.type} action on element with selector "${step.selector}"`;
    }
  }

  /**
   * Generates Playwright code snippet from a recording step
   * @param step Recording step
   * @returns Playwright code snippet
   */
  private generatePlaywrightSnippet(step: PlaywrightRecordingStep): string {
    switch (step.type) {
      case 'navigate':
        return `await page.goto('${step.url}');`;
      
      case 'click':
        return `await page.click('${step.selector}');`;
      
      case 'fill':
        const value = this.parameterizeValue(step.value);
        return `await page.fill('${step.selector}', '${value}');`;
      
      case 'select':
        return `await page.selectOption('${step.selector}', '${step.value}');`;
      
      case 'wait':
        return `await page.waitForSelector('${step.selector}');`;
      
      default:
        return `await page.${step.type}('${step.selector}');`;
    }
  }

  /**
   * Determines whether to prefer AI or snippet for a specific step
   * @param step Recording step
   * @param options Generation options
   * @returns Preference setting
   */
  private determineStepPreference(step: PlaywrightRecordingStep, options: GenerationOptions): 'ai' | 'snippet' {
    // Check if step type is in explicit preference lists
    if (options.preferSnippetFor.includes(step.type)) {
      return 'snippet';
    }
    
    if (options.preferAIFor.includes(step.type)) {
      return 'ai';
    }
    
    // Apply heuristics based on step characteristics
    switch (step.type) {
      case 'navigate':
        return 'snippet'; // URLs are deterministic
      
      case 'click':
        // Prefer AI for dynamic elements with text, snippet for stable selectors
        if (step.target?.text && !step.selector?.includes('#')) {
          return 'ai';
        }
        return 'snippet';
      
      case 'fill':
        // Prefer snippet for form fields with stable selectors
        return 'snippet';
      
      case 'select':
        return 'snippet';
      
      case 'wait':
        return 'snippet';
      
      default:
        return options.defaultPreference;
    }
  }

  /**
   * Extracts parameters from step values
   * @param steps Array of Intent Steps
   * @returns Array of parameter names
   */
  private extractParameters(steps: IntentStep[]): string[] {
    const params = new Set<string>();
    const paramRegex = /\{\{([^}]+)\}\}/g;
    
    steps.forEach(step => {
      if (step.value) {
        let match;
        while ((match = paramRegex.exec(step.value)) !== null) {
          params.add(match[1].trim());
        }
      }
    });
    
    return Array.from(params);
  }

  /**
   * Parameterizes step values using UI-compatible variable names
   * @param value Original value
   * @param fieldContext Additional context about the field
   * @returns Parameterized value with {{VARIABLE}} syntax
   */
  private parameterizeValue(value?: string, fieldContext?: any): string {
    if (!value) return '';
    
    // Check field context for hints (if available)
    if (fieldContext) {
      const fieldName = (fieldContext.name || fieldContext.id || '').toLowerCase();
      const fieldType = (fieldContext.type || '').toLowerCase();
      const placeholder = (fieldContext.placeholder || '').toLowerCase();
      
      // Password fields
      if (fieldType === 'password' || fieldName.includes('password') || fieldName.includes('pass')) {
        return '{{PASSWORD}}';
      }
      
      // Email fields
      if (fieldType === 'email' || fieldName.includes('email') || placeholder.includes('email')) {
        return '{{EMAIL_ADDRESS}}';
      }
      
      // Username fields
      if (fieldName.includes('username') || fieldName.includes('user') || placeholder.includes('username')) {
        return '{{USERNAME}}';
      }
      
      // Phone fields
      if (fieldType === 'tel' || fieldName.includes('phone') || fieldName.includes('tel')) {
        return '{{PHONE_NUMBER}}';
      }
      
      // Name fields
      if (fieldName.includes('firstname') || fieldName.includes('first_name')) {
        return '{{FIRST_NAME}}';
      }
      if (fieldName.includes('lastname') || fieldName.includes('last_name')) {
        return '{{LAST_NAME}}';
      }
      
      // Company fields
      if (fieldName.includes('company') || fieldName.includes('organization')) {
        return '{{COMPANY_NAME}}';
      }
      
      // Department fields
      if (fieldName.includes('department') || fieldName.includes('dept')) {
        return '{{DEPARTMENT}}';
      }
      
      // Search fields
      if (fieldName.includes('search') || fieldName.includes('query')) {
        return '{{SEARCH_QUERY}}';
      }
    }
    
    // Pattern-based detection for UI-compatible variable names
    const patterns: { [key: string]: string } = {
      '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$': '{{EMAIL_ADDRESS}}',
      '^[\\w\\s]{2,50}$': '{{USERNAME}}',
      '^.{8,}$': '{{PASSWORD}}', // Only if looks like password
      '^\\d{10,15}$': '{{PHONE_NUMBER}}',
      '^\\d{4}-\\d{2}-\\d{2}$': '{{DATE}}',
      '^\\d+\\.?\\d*$': '{{AMOUNT}}',
      '^\\d{5,10}$': '{{EMPLOYEE_ID}}',
      '^[A-Z]{2,}-\\d{4,}$': '{{ORDER_ID}}',
      '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$': '{{TRANSACTION_ID}}'
    };
    
    for (const [pattern, variable] of Object.entries(patterns)) {
      if (new RegExp(pattern).test(value)) {
        return variable;
      }
    }
    
    // If value looks like it should be parameterized but doesn't match patterns
    if (value.length > 3 && !/^(submit|login|search|ok|cancel|yes|no|continue|next|back)$/i.test(value)) {
      // Generate UI-compatible variable name
      const varName = value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      return `{{${varName}}}`;
    }
    
    return value;
  }

  /**
   * Builds preferences object based on step analysis and options
   * @param steps Array of Intent Steps
   * @param options Generation options
   * @returns Preferences object
   */
  private buildPreferences(steps: IntentStep[], options: GenerationOptions): {
    dynamic_elements: 'snippet' | 'ai';
    simple_steps: 'snippet' | 'ai';
    [key: string]: 'snippet' | 'ai';
  } {
    // Analyze steps to determine preferences
    const hasDynamicElements = steps.some(step => 
      step.prefer === 'ai' && step.ai_instruction.includes('text')
    );
    
    const hasSimpleSteps = steps.some(step => 
      ['navigate', 'wait'].includes(step.action || '')
    );
    
    return {
      dynamic_elements: hasDynamicElements ? 'ai' : 'snippet',
      simple_steps: hasSimpleSteps ? 'snippet' : 'ai'
    };
  }

  /**
   * Generates a descriptive name for the flow
   * @param recording Array of recording steps
   * @param filename Original filename
   * @returns Generated flow name
   */
  private generateFlowName(recording: PlaywrightRecordingStep[], filename: string): string {
    const actions = recording.map(step => step.type);
    
    if (actions.includes('fill') && actions.includes('click')) {
      return `${filename} Form Submission Flow`;
    } else if (actions.includes('navigate')) {
      return `${filename} Navigation Flow`;
    } else {
      return `${filename} Interaction Flow`;
    }
  }

  /**
   * Generates a description for the flow
   * @param recording Array of recording steps
   * @returns Generated flow description
   */
  private generateFlowDescription(recording: PlaywrightRecordingStep[]): string {
    const stepTypes = [...new Set(recording.map(step => step.type))];
    const actionCount = recording.length;
    
    return `Automated flow with ${actionCount} steps including: ${stepTypes.join(', ')}. ` +
           `This flow captures user interactions and provides both AI-guided and snippet-based execution paths.`;
  }

  /**
   * Finds associated success screenshot file
   * @param recordingPath Path to the recording file
   * @returns Path to success screenshot if found
   */
  private findSuccessScreenshot(recordingPath: string): string | undefined {
    const dir = path.dirname(recordingPath);
    const basename = path.basename(recordingPath, '.spec.ts');
    
    const possibleScreenshots = [
      path.join(dir, `${basename}-success.png`),
      path.join(dir, `${basename}-final.png`),
      path.join(dir, 'screenshots', `${basename}-success.png`)
    ];
    
    for (const screenshot of possibleScreenshots) {
      if (fs.existsSync(screenshot)) {
        return screenshot;
      }
    }
    
    return undefined;
  }

  /**
   * Process rich recording data with multiple selectors and DOM snapshots
   * @param recordingData Rich recording data from enhanced system
   * @returns Processed recording with resilient selectors
   */
  private processRichRecordingData(recordingData: any): any {
    const processedSteps = [];
    
    for (const action of recordingData.actions || []) {
      const step: any = {
        type: action.action || action.type,
        timestamp: action.timestamp,
        url: action.url,
        tabId: action.tabId
      };
      
      // Extract multiple selectors if available
      if (action.selectors && Array.isArray(action.selectors)) {
        step.selector = action.selectors[0]; // Primary selector
        step.alternativeSelectors = action.selectors.slice(1); // All alternatives
      } else if (action.selector) {
        step.selector = action.selector;
      }
      
      // Extract element info for context
      if (action.elementInfo) {
        step.target = {
          selector: step.selector,
          text: action.elementInfo.text,
          placeholder: action.elementInfo.placeholder,
          tagName: action.elementInfo.tag,
          attributes: action.elementInfo.attributes || {},
          name: action.elementInfo.attributes?.name,
          id: action.elementInfo.attributes?.id,
          type: action.elementInfo.attributes?.type
        };
      }
      
      // Extract typed values for parameterization
      if (action.value !== undefined) {
        step.value = action.value;
      }
      
      // Add timing information
      if (action.timeSinceLastAction) {
        step.waitBefore = Math.min(action.timeSinceLastAction, 5000); // Cap at 5 seconds
      }
      
      // Store DOM snapshot reference
      if (action.dom_snapshot) {
        step.domSnapshotAvailable = true;
      }
      
      processedSteps.push(step);
    }
    
    return {
      steps: processedSteps,
      metadata: recordingData.metadata || {},
      domSnapshots: recordingData.domSnapshots || [],
      performanceMetrics: recordingData.performanceMetrics || {}
    };
  }
}

/**
 * Convenience function to generate Intent Spec from recording
 * @param recordingPath Path to recording file
 * @param options Generation options
 * @returns Generated Intent Spec
 */
export function generateIntentSpecFromRecording(
  recordingPath: string,
  options?: Partial<GenerationOptions>
): IntentSpec {
  const generator = new IntentSpecGenerator();
  const fullOptions: GenerationOptions = {
    withFallback: true,
    preferSnippetFor: ['dynamic_elements', 'form_interactions'],
    preferAIFor: ['simple_steps', 'navigation'],
    defaultPreference: 'ai',
    ...options
  };
  
  return generator.generateFromRecording(recordingPath, fullOptions);
}

/**
 * Generate Intent Spec from rich recording data (enhanced system)
 * @param recordingData Rich recording data with multiple selectors
 * @param options Generation options
 * @returns Generated Intent Spec with resilient automation
 */
export function generateIntentSpecFromRichRecording(
  recordingData: any,
  options?: Partial<GenerationOptions>
): IntentSpec {
  const generator = new IntentSpecGenerator();
  
  // Process the rich recording data
  const processed = generator['processRichRecordingData'](recordingData);
  
  // Use enhanced prompt for generation
  const serialized = JSON.stringify(processed, null, 2);
  const enhancedPrompt = generateEnhancedIntentSpecPrompt(serialized);
  
  // Generate the Intent Spec (would normally call Claude here)
  console.log('Enhanced prompt generated for rich recording data');
  
  // For now, return a structured Intent Spec based on the data
  const steps = generator['generateSteps'](processed.steps, {
    withFallback: true,
    preferSnippetFor: ['form_interactions'],
    preferAIFor: ['validation'],
    defaultPreference: 'snippet',
    ...options
  });
  
  const params = generator['extractParameters'](steps);
  
  return {
    name: recordingData.name || 'Enhanced Recording Flow',
    description: 'Generated from rich recording with multiple selectors and DOM snapshots',
    url: processed.steps[0]?.url || '',
    params: params,
    steps: steps,
    preferences: {
      dynamic_elements: 'snippet',
      simple_steps: 'snippet'
    }
  };
}