/**
 * Smart Selector Executor
 * Handles multiple selectors with intelligent fallback
 */

import { Page, Locator } from 'playwright';

export interface SmartStep {
  name?: string;
  prefer: 'snippet' | 'ai';
  fallback?: 'ai' | 'snippet' | 'none';
  snippet?: string;
  ai_instruction?: string;
  selectors?: string[];  // Multiple selectors to try
  selector?: string;     // Single selector (backwards compat)
  value?: string;
  action?: string;
  retries?: number;
}

export class SmartSelectorExecutor {
  constructor(private page: Page) {}

  /**
   * Find element using multiple selector strategies
   */
  async findElement(step: SmartStep): Promise<Locator | null> {
    // Build selector list
    const selectors: string[] = [];
    
    // Add multiple selectors if provided
    if (step.selectors && Array.isArray(step.selectors)) {
      selectors.push(...step.selectors);
    }
    
    // Add single selector for backwards compatibility
    if (step.selector) {
      selectors.push(step.selector);
    }
    
    // Try each selector
    for (const selector of selectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        const locator = this.page.locator(selector);
        
        // Check if element exists and is visible
        const count = await locator.count();
        if (count > 0) {
          const isVisible = await locator.first().isVisible();
          if (isVisible) {
            console.log(`✓ Found element with selector: ${selector}`);
            return locator.first();
          }
        }
      } catch (error) {
        console.log(`✗ Selector failed: ${selector}`, error);
      }
    }
    
    // Try text-based selectors as last resort
    if (step.value || step.name) {
      const textToFind = step.value || step.name;
      try {
        // Try finding by text
        const textLocator = this.page.locator(`text="${textToFind}"`);
        if (await textLocator.count() > 0) {
          console.log(`✓ Found element by text: ${textToFind}`);
          return textLocator.first();
        }
        
        // Try finding by label
        const labelLocator = this.page.locator(`label:has-text("${textToFind}")`);
        if (await labelLocator.count() > 0) {
          console.log(`✓ Found element by label: ${textToFind}`);
          return labelLocator.first();
        }
      } catch (error) {
        console.log(`✗ Text-based search failed for: ${textToFind}`);
      }
    }
    
    return null;
  }

  /**
   * Execute action with smart selector strategy
   */
  async executeWithSmartSelectors(step: SmartStep, variables: Record<string, string>): Promise<boolean> {
    const action = this.determineAction(step);
    
    switch (action) {
      case 'navigate':
        return await this.handleNavigation(step, variables);
        
      case 'click':
        return await this.handleClick(step, variables);
        
      case 'input':
      case 'fill':
        return await this.handleInput(step, variables);
        
      case 'select':
        return await this.handleSelect(step, variables);
        
      case 'wait':
        return await this.handleWait(step, variables);
        
      default:
        console.warn(`Unknown action type: ${action}`);
        return false;
    }
  }

  /**
   * Determine action type from step
   */
  private determineAction(step: SmartStep): string {
    // Check snippet for action type
    if (step.snippet) {
      if (step.snippet.includes('.goto(')) return 'navigate';
      if (step.snippet.includes('.click(')) return 'click';
      if (step.snippet.includes('.fill(') || step.snippet.includes('.type(')) return 'input';
      if (step.snippet.includes('.selectOption(')) return 'select';
      if (step.snippet.includes('.wait')) return 'wait';
    }
    
    // Check action field
    if (step.action) {
      return step.action.toLowerCase();
    }
    
    // Infer from instruction
    if (step.ai_instruction) {
      const instruction = step.ai_instruction.toLowerCase();
      if (instruction.includes('navigate') || instruction.includes('go to')) return 'navigate';
      if (instruction.includes('click')) return 'click';
      if (instruction.includes('enter') || instruction.includes('type') || instruction.includes('fill')) return 'input';
      if (instruction.includes('select')) return 'select';
      if (instruction.includes('wait')) return 'wait';
    }
    
    return 'unknown';
  }

  /**
   * Handle navigation with retry
   */
  private async handleNavigation(step: SmartStep, variables: Record<string, string>): Promise<boolean> {
    const retries = step.retries || 3;
    let url = step.value || '';
    
    // Extract URL from snippet if needed
    if (!url && step.snippet) {
      const match = step.snippet.match(/goto\(['"](.+?)['"]/);
      if (match) url = match[1];
    }
    
    // Replace variables
    url = this.replaceVariables(url, variables);
    
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        console.log(`✓ Navigated to: ${url}`);
        return true;
      } catch (error) {
        console.log(`Navigation attempt ${i + 1}/${retries} failed:`, error);
        if (i < retries - 1) {
          await this.page.waitForTimeout(2000); // Wait before retry
        }
      }
    }
    
    return false;
  }

  /**
   * Handle click with multiple selectors
   */
  private async handleClick(step: SmartStep, variables: Record<string, string>): Promise<boolean> {
    const element = await this.findElement(step);
    
    if (!element) {
      console.error('Could not find element to click');
      return false;
    }
    
    try {
      await element.click({ timeout: 5000 });
      console.log('✓ Clicked element');
      return true;
    } catch (error) {
      console.error('Click failed:', error);
      return false;
    }
  }

  /**
   * Handle input with multiple selectors
   */
  private async handleInput(step: SmartStep, variables: Record<string, string>): Promise<boolean> {
    const element = await this.findElement(step);
    
    if (!element) {
      console.error('Could not find input element');
      return false;
    }
    
    const value = this.replaceVariables(step.value || '', variables);
    
    try {
      await element.fill(value);
      console.log(`✓ Filled input with: ${value.includes('pass') ? '****' : value}`);
      return true;
    } catch (error) {
      console.error('Input failed:', error);
      return false;
    }
  }

  /**
   * Handle select with multiple selectors
   */
  private async handleSelect(step: SmartStep, variables: Record<string, string>): Promise<boolean> {
    const element = await this.findElement(step);
    
    if (!element) {
      console.error('Could not find select element');
      return false;
    }
    
    const value = this.replaceVariables(step.value || '', variables);
    
    try {
      await element.selectOption(value);
      console.log(`✓ Selected option: ${value}`);
      return true;
    } catch (error) {
      console.error('Select failed:', error);
      return false;
    }
  }

  /**
   * Handle wait conditions
   */
  private async handleWait(step: SmartStep, variables: Record<string, string>): Promise<boolean> {
    try {
      // Extract wait condition from snippet
      if (step.snippet) {
        if (step.snippet.includes('waitForURL')) {
          const match = step.snippet.match(/waitForURL\(['"](.+?)['"]/);
          if (match) {
            await this.page.waitForURL(match[1], { timeout: 10000 });
          }
        } else if (step.snippet.includes('waitForSelector')) {
          const match = step.snippet.match(/waitForSelector\(['"](.+?)['"]/);
          if (match) {
            await this.page.waitForSelector(match[1], { timeout: 10000 });
          }
        } else {
          // Default wait
          await this.page.waitForTimeout(2000);
        }
      } else {
        await this.page.waitForTimeout(2000);
      }
      
      console.log('✓ Wait completed');
      return true;
    } catch (error) {
      console.error('Wait failed:', error);
      return false;
    }
  }

  /**
   * Replace variables in text
   */
  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}

/**
 * AI-first scenarios detector
 */
export function shouldPreferAI(step: SmartStep): boolean {
  const aiFirstPatterns = [
    // Security sensitive
    /password|pwd|secret|token|api[_-]?key/i,
    /login|signin|auth|credential/i,
    
    // Dynamic content
    /search|filter|query|find/i,
    /suggestion|autocomplete|typeahead/i,
    
    // Complex interactions
    /date[_-]?picker|calendar|time[_-]?picker/i,
    /drag|drop|resize|draw/i,
    /upload|file[_-]?input/i,
    
    // Context dependent
    /dynamic|contextual|conditional/i,
    /recommendation|personalized/i,
    
    // Rich editors
    /wysiwyg|editor|markdown|rich[_-]?text/i,
    
    // Captcha and verification
    /captcha|recaptcha|verification|challenge/i
  ];
  
  // Check instruction
  if (step.ai_instruction) {
    for (const pattern of aiFirstPatterns) {
      if (pattern.test(step.ai_instruction)) {
        return true;
      }
    }
  }
  
  // Check selectors
  const allSelectors = [
    ...(step.selectors || []),
    step.selector || ''
  ].join(' ');
  
  for (const pattern of aiFirstPatterns) {
    if (pattern.test(allSelectors)) {
      return true;
    }
  }
  
  // Check value for sensitive data
  if (step.value) {
    for (const pattern of aiFirstPatterns.slice(0, 2)) { // Just security patterns
      if (pattern.test(step.value)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Recommendations for Intent Spec generation
 */
export const SELECTOR_STRATEGIES = {
  // Multiple selectors for robustness
  loginField: {
    selectors: [
      '#username',
      '#email',
      '[name="username"]',
      '[name="email"]',
      '[type="email"]',
      'input:near(text="Username")',
      'input:near(text="Email")'
    ],
    prefer: 'ai',  // Security sensitive
    fallback: 'snippet'
  },
  
  passwordField: {
    selectors: [
      '#password',
      '[name="password"]',
      '[type="password"]',
      'input:near(text="Password")'
    ],
    prefer: 'ai',  // Security sensitive
    fallback: 'none'  // Don't retry passwords
  },
  
  searchField: {
    selectors: [
      '[type="search"]',
      '[role="searchbox"]',
      '[placeholder*="search"]',
      'input:near(text="Search")'
    ],
    prefer: 'ai',  // Context matters
    fallback: 'snippet'
  },
  
  submitButton: {
    selectors: [
      '[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Save")',
      'button[form]'
    ],
    prefer: 'snippet',
    fallback: 'ai'
  }
};