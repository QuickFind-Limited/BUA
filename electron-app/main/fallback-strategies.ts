import { Page } from 'playwright-core';

/**
 * Non-AI Fallback Strategies for Automation
 * These strategies provide alternatives when AI-based automation fails
 */

export class FallbackStrategies {
  constructor(private page: Page) {}

  /**
   * Try text-based action
   */
  async tryTextBasedAction(instruction: string): Promise<boolean> {
    const text = this.extractTarget(instruction);
    if (!text) return false;
    
    try {
      // Try exact text match first
      let locator = this.page.getByText(text, { exact: true });
      if (await locator.count() === 1) {
        await locator.click();
        return true;
      }
      
      // Try partial text match
      locator = this.page.getByText(text);
      if (await locator.count() === 1) {
        await locator.click();
        return true;
      }
      
      // Try with first visible element
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (await el.isVisible()) {
          await el.click();
          return true;
        }
      }
    } catch (e: any) {
      console.log('Text-based action failed:', e.message);
    }
    return false;
  }

  /**
   * Try role-based action
   */
  async tryRoleBasedAction(instruction: string): Promise<boolean> {
    const lower = instruction.toLowerCase();
    const target = this.extractTarget(instruction);
    
    try {
      // Determine the role based on instruction
      let role: any = 'button';
      if (lower.includes('link')) role = 'link';
      if (lower.includes('input') || lower.includes('field')) role = 'textbox';
      if (lower.includes('dropdown') || lower.includes('select')) role = 'combobox';
      if (lower.includes('checkbox')) role = 'checkbox';
      if (lower.includes('radio')) role = 'radio';
      if (lower.includes('tab')) role = 'tab';
      if (lower.includes('menu')) role = 'menu';
      
      const locator = this.page.getByRole(role, { name: target });
      if (await locator.count() === 1) {
        if (lower.includes('click')) {
          await locator.click();
        } else if (lower.includes('fill') || lower.includes('type')) {
          const value = this.extractValue(instruction);
          await locator.fill(value);
        }
        return true;
      }
    } catch (e: any) {
      console.log('Role-based action failed:', e.message);
    }
    return false;
  }

  /**
   * Try XPath action
   */
  async tryXPathAction(instruction: string): Promise<boolean> {
    const target = this.extractTarget(instruction);
    if (!target) return false;
    
    try {
      // Build XPath expressions for common patterns
      const xpaths = [
        `//*[text()='${target}']`,
        `//*[contains(text(), '${target}')]`,
        `//button[contains(., '${target}')]`,
        `//a[contains(., '${target}')]`,
        `//*[@aria-label='${target}']`,
        `//*[@title='${target}']`,
        `//*[@placeholder='${target}']`
      ];
      
      for (const xpath of xpaths) {
        const locator = this.page.locator(xpath);
        if (await locator.count() > 0) {
          const visible = locator.first();
          if (await visible.isVisible()) {
            await visible.click();
            return true;
          }
        }
      }
    } catch (e: any) {
      console.log('XPath action failed:', e.message);
    }
    return false;
  }

  /**
   * Try keyboard navigation
   */
  async tryKeyboardNavigation(instruction: string): Promise<boolean> {
    const target = this.extractTarget(instruction);
    
    try {
      // Use Tab navigation to find and activate element
      const maxTabs = 50;
      for (let i = 0; i < maxTabs; i++) {
        await this.page.keyboard.press('Tab');
        
        // Check if focused element matches target
        const focused = await this.page.evaluate(() => {
          const el = document.activeElement;
          return {
            text: el?.textContent || '',
            label: el?.getAttribute('aria-label') || '',
            placeholder: el?.getAttribute('placeholder') || '',
            value: (el as HTMLInputElement)?.value || ''
          };
        });
        
        if (Object.values(focused).some(v => v.includes(target))) {
          if (instruction.toLowerCase().includes('click')) {
            await this.page.keyboard.press('Enter');
          } else if (instruction.toLowerCase().includes('fill')) {
            const value = this.extractValue(instruction);
            await this.page.keyboard.type(value);
          }
          return true;
        }
      }
    } catch (e: any) {
      console.log('Keyboard navigation failed:', e.message);
    }
    return false;
  }

  /**
   * Click with multiple fallback strategies
   */
  async clickWithFallbacks(target: string): Promise<boolean> {
    const strategies = [
      () => this.page.getByText(target, { exact: true }).click(),
      () => this.page.getByText(target).first().click(),
      () => this.page.getByRole('button', { name: target }).click(),
      () => this.page.getByRole('link', { name: target }).click(),
      () => this.page.getByRole('tab', { name: target }).click(),
      () => this.page.getByLabel(target).click(),
      () => this.page.locator(`text="${target}"`).first().click(),
      () => this.page.locator(`*:has-text("${target}")`).first().click(),
      () => this.page.locator(`[aria-label="${target}"]`).click(),
      () => this.page.locator(`[title="${target}"]`).click()
    ];
    
    for (const strategy of strategies) {
      try {
        await strategy();
        console.log(`✅ Click succeeded with fallback strategy`);
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * Fill with multiple fallback strategies
   */
  async fillWithFallbacks(target: string, value: string): Promise<boolean> {
    const strategies = [
      () => this.page.getByLabel(target).fill(value),
      () => this.page.getByPlaceholder(target).fill(value),
      () => this.page.getByRole('textbox', { name: target }).fill(value),
      () => this.page.locator(`input[name*="${target.toLowerCase()}"]`).fill(value),
      () => this.page.locator(`input[id*="${target.toLowerCase()}"]`).fill(value),
      () => this.page.locator(`textarea[name*="${target.toLowerCase()}"]`).fill(value),
      () => this.page.locator(`[aria-label="${target}"]`).fill(value)
    ];
    
    for (const strategy of strategies) {
      try {
        await strategy();
        console.log(`✅ Fill succeeded with fallback strategy`);
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * Extract target from instruction
   */
  private extractTarget(instruction: string): string {
    // Remove common action prefixes
    const cleaned = instruction.replace(/^(click|select|fill|type|enter|tap|press)\s+(on\s+|the\s+)?/i, '');
    
    // Extract text between quotes
    const quotedMatch = cleaned.match(/["']([^"']+)["']/);
    if (quotedMatch) return quotedMatch[1];
    
    // Remove common suffixes
    const target = cleaned.replace(/\s+(button|field|link|tab|section|element|option)$/i, '').trim();
    
    return target;
  }

  /**
   * Extract value from instruction
   */
  private extractValue(instruction: string): string {
    // Extract value after 'with', 'to', or '='
    const patterns = [
      /with\s+["']?([^"']+)["']?$/i,
      /to\s+["']?([^"']+)["']?$/i,
      /=\s*["']?([^"']+)["']?$/i,
      /value\s+["']?([^"']+)["']?$/i
    ];
    
    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) return match[1].trim();
    }
    
    return '';
  }
}

/**
 * Handle strict mode violations
 */
export async function handleStrictModeViolation(
  page: Page,
  locator: any,
  action: string,
  instruction?: string
): Promise<any> {
  try {
    // First attempt: Execute normally
    return await locator[action]();
  } catch (error: any) {
    if (error.message.includes('strict mode violation')) {
      const count = await locator.count();
      console.warn(`⚠️ Strict mode violation: ${count} elements match. Attempting recovery...`);
      
      // Strategy 1: Use first element
      if (count > 0) {
        console.log('Using first matching element');
        return await locator.first()[action]();
      }
      
      // Strategy 2: Find visible element
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (await el.isVisible()) {
          console.log(`Using visible element at index ${i}`);
          return await el[action]();
        }
      }
      
      // Strategy 3: Use fallback strategies
      if (instruction) {
        const fallback = new FallbackStrategies(page);
        if (action === 'click') {
          const target = fallback['extractTarget'](instruction);
          return await fallback.clickWithFallbacks(target);
        }
      }
    }
    
    // Re-throw if not a strict mode violation
    throw error;
  }
}

/**
 * Execute action with comprehensive fallbacks
 */
export async function executeWithAllFallbacks(
  page: Page,
  instruction: string,
  snippet?: string
): Promise<{ success: boolean; method: string; error?: string }> {
  const fallback = new FallbackStrategies(page);
  
  // Try original snippet first if provided
  if (snippet) {
    try {
      await page.evaluate(`(async () => { ${snippet} })()`);
      return { success: true, method: 'snippet' };
    } catch (e: any) {
      console.log('Snippet failed:', e.message);
    }
  }
  
  // Try all fallback strategies
  const strategies = [
    { name: 'text-based', fn: () => fallback.tryTextBasedAction(instruction) },
    { name: 'role-based', fn: () => fallback.tryRoleBasedAction(instruction) },
    { name: 'xpath', fn: () => fallback.tryXPathAction(instruction) },
    { name: 'keyboard', fn: () => fallback.tryKeyboardNavigation(instruction) }
  ];
  
  for (const strategy of strategies) {
    try {
      const result = await strategy.fn();
      if (result) {
        return { success: true, method: strategy.name };
      }
    } catch (e: any) {
      console.log(`${strategy.name} strategy failed:`, e.message);
    }
  }
  
  // Extract target and try click/fill fallbacks
  const target = fallback['extractTarget'](instruction);
  if (instruction.toLowerCase().includes('click')) {
    const success = await fallback.clickWithFallbacks(target);
    if (success) return { success: true, method: 'click-fallbacks' };
  } else if (instruction.toLowerCase().includes('fill') || instruction.toLowerCase().includes('type')) {
    const value = fallback['extractValue'](instruction);
    const success = await fallback.fillWithFallbacks(target, value);
    if (success) return { success: true, method: 'fill-fallbacks' };
  }
  
  return { 
    success: false, 
    method: 'none', 
    error: 'All fallback strategies exhausted' 
  };
}