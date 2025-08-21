import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import { IntentStep, ActionType, ElementInfo, BrowserState } from '../flows/types';
import * as path from 'path';
import * as fs from 'fs';

export interface PlaywrightConfig {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  timeout?: number;
  saveScreenshots?: boolean;
  screenshotPath?: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
  screenshot?: string;
  elementInfo?: ElementInfo;
}

export interface PageContent {
  html: string;
  text: string;
  url: string;
  title: string;
}

export interface PageInfo {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  readyState: string;
}

/**
 * Playwright executor for browser automation
 * Handles initialization, action execution, and browser state management
 */
export class PlaywrightExecutor {
  public config: PlaywrightConfig;
  public page: Page | null = null;  // Made public for snippet execution
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private screenshotCounter = 0;

  constructor(config: PlaywrightConfig = {}) {
    this.config = {
      browser: 'chromium',
      headless: false,
      viewport: { width: 1920, height: 1080 },
      timeout: 30000,
      saveScreenshots: true,
      screenshotPath: path.join(process.cwd(), 'screenshots'),
      ...config
    };

    // Ensure screenshot directory exists
    if (this.config.saveScreenshots && this.config.screenshotPath) {
      try {
        fs.mkdirSync(this.config.screenshotPath, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create screenshot directory: ${error}`);
      }
    }
  }

  /**
   * Initialize browser, context, and page
   */
  async initialize(): Promise<void> {
    try {
      // Launch browser
      const browserType = this.getBrowserType();
      this.browser = await browserType.launch({
        headless: this.config.headless,
        timeout: this.config.timeout
      });

      // Create context
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });

      // Create page
      this.page = await this.context.newPage();
      
      // Set default timeouts
      this.page.setDefaultTimeout(this.config.timeout || 30000);
      this.page.setDefaultNavigationTimeout(this.config.timeout || 30000);

      console.log('Playwright browser initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<ActionResult> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      return { success: true, data: { url } };
    } catch (error) {
      return {
        success: false,
        error: `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Execute a browser action based on the step definition
   */
  async executeAction(step: IntentStep): Promise<ActionResult> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      switch (step.action.toLowerCase()) {
        case 'click':
          return await this.click(step.target);
        
        case 'type':
          return await this.type(step.target, step.value);
        
        case 'select':
          return await this.select(step.target, step.value);
        
        case 'wait':
          return await this.waitFor(step.target, parseInt(step.value) || 5000);
        
        case 'navigate':
          return await this.navigate(step.value);
        
        case 'scroll':
          return await this.scroll(step.target, step.value);
        
        case 'hover':
          return await this.hover(step.target);
        
        case 'drag':
          return await this.drag(step.target, step.value);
        
        case 'upload':
          return await this.upload(step.target, step.value);
        
        case 'screenshot':
          const screenshot = await this.takeScreenshot(step.value || 'manual');
          return { success: true, data: { screenshot } };
        
        default:
          return {
            success: false,
            error: `Unsupported action: ${step.action}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Click on an element
   */
  private async click(selector: string): Promise<ActionResult> {
    try {
      const element = await this.page!.waitForSelector(selector, { timeout: 10000 });
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      await element.click();
      return { success: true, data: { action: 'click', selector } };
    } catch (error) {
      return {
        success: false,
        error: `Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Type text into an element
   */
  private async type(selector: string, text: string): Promise<ActionResult> {
    try {
      const element = await this.page!.waitForSelector(selector, { timeout: 10000 });
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      await element.fill('');
      await element.type(text);
      return { success: true, data: { action: 'type', selector, text } };
    } catch (error) {
      return {
        success: false,
        error: `Type failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Select an option from a dropdown
   */
  private async select(selector: string, value: string): Promise<ActionResult> {
    try {
      const element = await this.page!.waitForSelector(selector, { timeout: 10000 });
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      await this.page!.selectOption(selector, value);
      return { success: true, data: { action: 'select', selector, value } };
    } catch (error) {
      return {
        success: false,
        error: `Select failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Wait for an element or timeout
   */
  private async waitFor(selector: string, timeout: number): Promise<ActionResult> {
    try {
      if (selector === 'timeout' || selector === 'delay') {
        await this.page!.waitForTimeout(timeout);
        return { success: true, data: { action: 'wait', timeout } };
      }

      await this.page!.waitForSelector(selector, { timeout });
      return { success: true, data: { action: 'wait', selector, timeout } };
    } catch (error) {
      return {
        success: false,
        error: `Wait failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Scroll to an element or position
   */
  private async scroll(selector: string, value: string): Promise<ActionResult> {
    try {
      if (selector === 'page' || selector === 'window') {
        const [x, y] = value.split(',').map(v => parseInt(v.trim()) || 0);
        await this.page!.mouse.wheel(x, y);
        return { success: true, data: { action: 'scroll', x, y } };
      }

      const element = await this.page!.waitForSelector(selector, { timeout: 10000 });
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      await element.scrollIntoViewIfNeeded();
      return { success: true, data: { action: 'scroll', selector } };
    } catch (error) {
      return {
        success: false,
        error: `Scroll failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Hover over an element
   */
  private async hover(selector: string): Promise<ActionResult> {
    try {
      const element = await this.page!.waitForSelector(selector, { timeout: 10000 });
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      await element.hover();
      return { success: true, data: { action: 'hover', selector } };
    } catch (error) {
      return {
        success: false,
        error: `Hover failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Drag and drop operation
   */
  private async drag(sourceSelector: string, targetSelector: string): Promise<ActionResult> {
    try {
      const sourceElement = await this.page!.waitForSelector(sourceSelector, { timeout: 10000 });
      const targetElement = await this.page!.waitForSelector(targetSelector, { timeout: 10000 });

      if (!sourceElement || !targetElement) {
        return { success: false, error: `Source or target element not found` };
      }

      await this.page!.dragAndDrop(sourceSelector, targetSelector);
      return { success: true, data: { action: 'drag', sourceSelector, targetSelector } };
    } catch (error) {
      return {
        success: false,
        error: `Drag failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Upload a file
   */
  private async upload(selector: string, filePath: string): Promise<ActionResult> {
    try {
      const element = await this.page!.waitForSelector(selector, { timeout: 10000 });
      if (!element) {
        return { success: false, error: `Element not found: ${selector}` };
      }

      await element.setInputFiles(filePath);
      return { success: true, data: { action: 'upload', selector, filePath } };
    } catch (error) {
      return {
        success: false,
        error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(name: string = 'screenshot'): Promise<string | null> {
    if (!this.page || !this.config.saveScreenshots || !this.config.screenshotPath) {
      return null;
    }

    try {
      this.screenshotCounter++;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}-${this.screenshotCounter}-${name}.png`;
      const filepath = path.join(this.config.screenshotPath, filename);

      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });

      return filepath;
    } catch (error) {
      console.warn(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Get page content (HTML and text)
   */
  async getPageContent(): Promise<PageContent> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const [html, text, url, title] = await Promise.all([
        this.page.content(),
        this.page.textContent('body') || '',
        this.page.url(),
        this.page.title()
      ]);

      return { html, text, url, title };
    } catch (error) {
      throw new Error(`Failed to get page content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get page information
   */
  async getPageInfo(): Promise<PageInfo> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const [url, title, readyState] = await Promise.all([
        this.page.url(),
        this.page.title(),
        this.page.evaluate(() => document.readyState)
      ]);

      const viewport = this.page.viewportSize() || { width: 0, height: 0 };

      return { url, title, viewport, readyState };
    } catch (error) {
      throw new Error(`Failed to get page info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get element information
   */
  async getElementInfo(selector: string): Promise<ElementInfo | null> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const element = await this.page.$(selector);
      if (!element) {
        return null;
      }

      const [boundingBox, tagName, text, attributes] = await Promise.all([
        element.boundingBox(),
        element.evaluate(el => el.tagName.toLowerCase()),
        element.textContent(),
        element.evaluate(el => {
          const attrs: Record<string, string> = {};
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            attrs[attr.name] = attr.value;
          }
          return attrs;
        })
      ]);

      const [visible, enabled] = await Promise.all([
        element.isVisible(),
        element.isEnabled()
      ]);

      return {
        selector,
        tagName,
        text: text || '',
        attributes,
        boundingBox: boundingBox || { x: 0, y: 0, width: 0, height: 0 },
        visible,
        enabled
      };
    } catch (error) {
      console.warn(`Failed to get element info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Wait for a specified amount of time
   */
  async wait(milliseconds: number): Promise<void> {
    if (this.page) {
      await this.page.waitForTimeout(milliseconds);
    } else {
      await new Promise(resolve => setTimeout(resolve, milliseconds));
    }
  }

  /**
   * Get browser type based on configuration
   */
  private getBrowserType() {
    switch (this.config.browser) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      case 'chromium':
      default:
        return chromium;
    }
  }

  /**
   * Get browser state
   */
  async getBrowserState(): Promise<BrowserState> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const [url, title, readyState, cookies, localStorage, sessionStorage] = await Promise.all([
        this.page.url(),
        this.page.title(),
        this.page.evaluate(() => document.readyState),
        this.context!.cookies(),
        this.page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
        this.page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
      ]);

      const viewport = this.page.viewportSize() || { width: 0, height: 0 };

      return {
        url,
        title,
        readyState,
        viewport,
        cookies,
        localStorage,
        sessionStorage
      };
    } catch (error) {
      throw new Error(`Failed to get browser state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close browser and clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      console.log('Playwright browser cleaned up successfully');
    } catch (error) {
      console.warn(`Browser cleanup warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if browser is initialized
   */
  isInitialized(): boolean {
    return !!(this.browser && this.context && this.page);
  }
}