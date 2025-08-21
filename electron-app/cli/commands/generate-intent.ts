import * as fs from 'fs';
import * as path from 'path';
import { IntentStep, IntentSpec } from '../types';

interface GenerateIntentOptions {
  from: string;
  withFallback?: boolean;
  preferSnippetFor?: string;
  preferAiFor?: string;
}

export async function generateIntentCommand(options: GenerateIntentOptions): Promise<void> {
  try {
    console.log('Generating Intent Spec from:', options.from);
    
    // Read the Playwright spec file
    const specFilePath = path.resolve(options.from);
    if (!fs.existsSync(specFilePath)) {
      throw new Error(`File not found: ${specFilePath}`);
    }
    
    const specContent = fs.readFileSync(specFilePath, 'utf-8');
    console.log('✓ Read Playwright spec file');
    
    // Parse the spec file to extract steps
    const steps = parsePlaywrightSpec(specContent);
    console.log(`✓ Extracted ${steps.length} steps from spec`);
    
    // Set up preferences
    const preferences = {
      dynamic_elements: 'snippet' as const,
      simple_steps: 'ai' as const
    };
    if (options.preferSnippetFor) {
      preferences[options.preferSnippetFor] = 'snippet';
    }
    if (options.preferAiFor) {
      preferences[options.preferAiFor] = 'ai';
    }
    
    // Generate Intent Spec
    const intentSpec: IntentSpec = {
      name: `Generated from ${path.basename(options.from)}`,
      description: `Intent spec generated from Playwright recording`,
      url: 'https://example.com', // Default URL, should be extracted from spec
      params: [], // Extract from variables in the spec
      steps: steps.map(step => generateIntentStep(step, options, preferences)),
      preferences
    };
    
    // Output the Intent Spec
    const outputPath = path.join(path.dirname(specFilePath), 'intent-spec.json');
    fs.writeFileSync(outputPath, JSON.stringify(intentSpec, null, 2));
    
    console.log('✓ Generated Intent Spec with both AI and snippet paths');
    console.log(`✓ Output written to: ${outputPath}`);
    console.log('')
    console.log('Intent Spec Preview:');
    console.log(JSON.stringify(intentSpec, null, 2));
    
  } catch (error) {
    console.error('Error generating Intent Spec:', error);
    process.exit(1);
  }
}

interface PlaywrightStep {
  action: string;
  selector?: string;
  value?: string;
  url?: string;
  description: string;
  lineNumber: number;
}

function parsePlaywrightSpec(content: string): PlaywrightStep[] {
  const steps: PlaywrightStep[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;
    
    // Skip comments and empty lines
    if (line.startsWith('//') || line.startsWith('*') || !line || line.startsWith('import') || line.startsWith('const') || line.startsWith('test') || line.startsWith('expect')) {
      continue;
    }
    
    // Parse common Playwright actions
    if (line.includes('.goto(')) {
      const urlMatch = line.match(/\.goto\(['\"](.*?)['\"]\)/);
      const url = urlMatch ? urlMatch[1] : 'URL';
      steps.push({
        action: 'goto',
        url,
        description: `Navigate to ${url}`,
        lineNumber
      });
    }
    
    if (line.includes('.locator(') && line.includes('.click()')) {
      const locatorMatch = line.match(/\.locator\(['\"](.*?)['\"]\)\.click\(\)/);
      const selector = locatorMatch ? locatorMatch[1] : 'element';
      steps.push({
        action: 'click',
        selector,
        description: `Click ${selector}`,
        lineNumber
      });
    }
    
    if (line.includes('.locator(') && line.includes('.fill(')) {
      const locatorMatch = line.match(/\.locator\(['\"](.*?)['\"]\)\.fill\(['\"](.*?)['\"]\)/);
      if (locatorMatch) {
        const selector = locatorMatch[1];
        const value = locatorMatch[2];
        steps.push({
          action: 'fill',
          selector,
          value,
          description: `Enter "${value}" in ${selector}`,
          lineNumber
        });
      }
    }
    
    if (line.includes('.click(') && !line.includes('.locator(')) {
      const selectorMatch = line.match(/\.click\(['\"](.*?)['\"]\)/);
      const selector = selectorMatch ? selectorMatch[1] : 'element';
      steps.push({
        action: 'click',
        selector,
        description: `Click ${selector}`,
        lineNumber
      });
    }
    
    if (line.includes('.fill(') && !line.includes('.locator(')) {
      const fillMatch = line.match(/\.fill\(['\"](.*?)['\"]\s*,\s*['\"](.*?)['\"]\)/);
      if (fillMatch) {
        const selector = fillMatch[1];
        const value = fillMatch[2];
        steps.push({
          action: 'fill',
          selector,
          value,
          description: `Enter "${value}" in ${selector}`,
          lineNumber
        });
      }
    }
    
    if (line.includes('.waitForTimeout(')) {
      const timeoutMatch = line.match(/\.waitForTimeout\((\d+)\)/);
      const timeout = timeoutMatch ? timeoutMatch[1] : '1000';
      steps.push({
        action: 'wait',
        value: timeout,
        description: `Wait ${timeout}ms`,
        lineNumber
      });
    }
    
    if (line.includes('.waitForLoadState(')) {
      steps.push({
        action: 'waitForLoad',
        description: 'Wait for page to load',
        lineNumber
      });
    }
  }
  
  return steps;
}

function generateIntentStep(step: PlaywrightStep, options: GenerateIntentOptions, preferences: Record<string, 'ai' | 'snippet'>): IntentStep {
  // Generate AI instruction
  const aiInstruction = generateAIInstruction(step);
  
  // Generate Playwright snippet
  const snippet = generatePlaywrightSnippet(step);
  
  // Determine preference based on options
  let prefer: 'ai' | 'snippet' = 'ai'; // default
  
  // Check if this step matches any preference patterns
  if (options.preferSnippetFor && step.description.toLowerCase().includes(options.preferSnippetFor.toLowerCase())) {
    prefer = 'snippet';
  } else if (options.preferAiFor && step.description.toLowerCase().includes(options.preferAiFor.toLowerCase())) {
    prefer = 'ai';
  } else {
    // Apply global preferences based on action type
    if (step.action === 'fill' || step.action === 'click') {
      prefer = 'snippet'; // dynamic elements prefer snippets by default
    } else if (step.action === 'goto' || step.action === 'wait') {
      prefer = 'ai'; // simple steps prefer AI by default
    }
  }
  
  const fallback: 'ai' | 'snippet' | 'none' = options.withFallback ? (prefer === 'ai' ? 'snippet' : 'ai') : 'none';
  
  return {
    name: step.description,
    ai_instruction: aiInstruction,
    snippet: snippet,
    prefer: prefer,
    fallback: fallback,
    selector: step.selector,
    value: step.value,
    // Legacy compatibility
    action: step.action,
    target: step.selector,
    description: step.description
  };
}

function generateAIInstruction(step: PlaywrightStep): string {
  switch (step.action) {
    case 'goto':
      return `Navigate to the page at ${step.url}`;
    case 'click':
      return `Click on the ${step.selector || 'element'}`;
    case 'fill':
      return `Enter "${step.value}" in the ${step.selector || 'input field'}`;
    case 'wait':
      return `Wait for ${step.value}ms`;
    case 'waitForLoad':
      return 'Wait for the page to finish loading';
    default:
      return step.description;
  }
}

function generatePlaywrightSnippet(step: PlaywrightStep): string {
  switch (step.action) {
    case 'goto':
      return `await page.goto('${step.url}');`;
    case 'click':
      if (step.selector) {
        return `await page.locator('${step.selector}').click();`;
      }
      return `await page.click('${step.selector || 'selector'}');`;
    case 'fill':
      if (step.selector && step.value) {
        return `await page.locator('${step.selector}').fill('${step.value}');`;
      }
      return `await page.fill('${step.selector}', '${step.value}');`;
    case 'wait':
      return `await page.waitForTimeout(${step.value});`;
    case 'waitForLoad':
      return `await page.waitForLoadState('domcontentloaded');`;
    default:
      return `// ${step.description}`;
  }
}