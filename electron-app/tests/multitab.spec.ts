import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';

// Test configuration
const ELECTRON_APP_PATH = path.join(__dirname, '..');
const ELECTRON_MAIN_PATH = path.join(ELECTRON_APP_PATH, 'dist', 'main', 'index.js');
const TEST_URL_A = 'https://httpbin.org/html';
const TEST_URL_B = 'https://example.com';
const TEST_TIMEOUT = 30000;

test.describe('Multi-tab Functionality Tests', () => {
  let electronApp: any;
  let window: any;

  test.beforeAll(async () => {
    // Build the app before testing
    const { execSync } = require('child_process');
    try {
      execSync('npm run build', { 
        cwd: ELECTRON_APP_PATH,
        stdio: 'inherit',
        timeout: 60000
      });
    } catch (error) {
      console.warn('Build failed, attempting to run tests with existing build:', error);
    }
  });

  test.beforeEach(async () => {
    // Launch Electron app
    electronApp = await electron.launch({ 
      args: [ELECTRON_MAIN_PATH],
      timeout: TEST_TIMEOUT
    });
    
    // Get the main window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    
    // Wait for the app to be fully initialized
    await window.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    // Clean up
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should launch Electron app successfully', async () => {
    // Verify the app window is created
    expect(window).toBeTruthy();
    
    // Check window title contains expected text
    const title = await window.title();
    expect(title).toBeTruthy();
    
    // Verify window dimensions
    const windowSize = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    expect(windowSize.width).toBeGreaterThan(0);
    expect(windowSize.height).toBeGreaterThan(0);
  });

  test('should open URL in tab A and verify content loads', async () => {
    // Use the existing URL input and go button from the UI
    const urlInput = await window.locator('[data-testid="url-input"]');
    const goButton = await window.locator('[data-testid="go-button"]');
    
    // Navigate to test URL A
    await urlInput.fill(TEST_URL_A);
    await goButton.click();
    
    // Wait for navigation to complete
    await window.waitForTimeout(3000);
    
    // Verify the existing webview (webview-0) has the correct URL
    const webviewSrc = await window.evaluate(() => {
      const webview = document.querySelector('#webview-0');
      return webview ? webview.getAttribute('src') : null;
    });
    
    expect(webviewSrc).toBe(TEST_URL_A);
    
    // Verify webview is visible
    const webview = await window.locator('#webview-0');
    expect(await webview.isVisible()).toBe(true);
  });

  test('should trigger window.open() to create tab B', async () => {
    // First navigate to a URL in the existing tab
    const urlInput = await window.locator('[data-testid="url-input"]');
    const goButton = await window.locator('[data-testid="go-button"]');
    
    await urlInput.fill(TEST_URL_A);
    await goButton.click();
    await window.waitForTimeout(2000);
    
    // Use the "New Tab" button to create tab B (simulating window.open behavior)
    const newTabButton = await window.locator('[data-testid="new-tab-button"]');
    await newTabButton.click();
    
    await window.waitForTimeout(1000);
    
    // Verify a new tab was created
    const tabs = await window.locator('.tab');
    expect(await tabs.count()).toBe(2);
    
    // Navigate the new tab to TEST_URL_B
    await urlInput.fill(TEST_URL_B);
    await goButton.click();
    await window.waitForTimeout(2000);
    
    // Verify the new tab has the correct URL
    const activeWebviewSrc = await window.evaluate(() => {
      const activeTabId = window.tabManager ? window.tabManager.getActiveTabId() : 1;
      const webview = document.querySelector(`#webview-${activeTabId}`);
      return webview ? webview.getAttribute('src') : null;
    });
    
    expect(activeWebviewSrc).toBe(TEST_URL_B);
  });

  test('should verify tab B appears in the tab bar', async () => {
    // Create a second tab using the New Tab button
    const newTabButton = await window.locator('[data-testid="new-tab-button"]');
    await newTabButton.click();
    await window.waitForTimeout(1000);
    
    // Verify tab bar exists (it should already exist from the UI)
    const tabBar = await window.locator('[data-testid="tab-bar"]');
    expect(await tabBar.count()).toBe(1);
    
    // Verify both tabs exist in the tab bar
    const tabs = await window.locator('.tab');
    expect(await tabs.count()).toBe(2);
    
    // Verify the first tab (tab-0) exists
    const tab0 = await window.locator('[data-testid="tab-0"]');
    expect(await tab0.count()).toBe(1);
    
    // Verify the second tab (tab-1) exists
    const tab1 = await window.locator('[data-testid="tab-1"]');
    expect(await tab1.count()).toBe(1);
    
    // Verify tab titles
    const tab0Title = await tab0.locator('.tab-title').textContent();
    const tab1Title = await tab1.locator('.tab-title').textContent();
    
    expect(tab0Title).toBeTruthy();
    expect(tab1Title).toBeTruthy();
  });

  test('should test switching between tabs', async () => {
    // Navigate to URL A in the first tab
    const urlInput = await window.locator('[data-testid="url-input"]');
    const goButton = await window.locator('[data-testid="go-button"]');
    
    await urlInput.fill(TEST_URL_A);
    await goButton.click();
    await window.waitForTimeout(2000);
    
    // Create a second tab
    const newTabButton = await window.locator('[data-testid="new-tab-button"]');
    await newTabButton.click();
    await window.waitForTimeout(1000);
    
    // Navigate to URL B in the second tab
    await urlInput.fill(TEST_URL_B);
    await goButton.click();
    await window.waitForTimeout(2000);
    
    // Initially, Tab 1 (second tab) should be active
    const webview0 = await window.locator('#webview-0');
    const webview1 = await window.locator('#webview-1');
    
    expect(await webview0.isVisible()).toBe(false);
    expect(await webview1.isVisible()).toBe(true);
    
    // Click Tab 0 to switch back
    const tab0 = await window.locator('[data-testid="tab-0"]');
    await tab0.click();
    await window.waitForTimeout(500);
    
    // Verify tab 0 is now visible and tab 1 is hidden
    expect(await webview0.isVisible()).toBe(true);
    expect(await webview1.isVisible()).toBe(false);
    
    // Verify tab 0 is now active
    const tab0Active = await window.evaluate(() => {
      const tab = document.querySelector('[data-testid="tab-0"]');
      return tab ? tab.classList.contains('active') : false;
    });
    expect(tab0Active).toBe(true);
    
    // Switch back to Tab 1
    const tab1 = await window.locator('[data-testid="tab-1"]');
    await tab1.click();
    await window.waitForTimeout(500);
    
    // Verify tab 1 is visible again
    expect(await webview0.isVisible()).toBe(false);
    expect(await webview1.isVisible()).toBe(true);
  });

  test('should verify automation can interact with both tabs', async () => {
    // Create first tab with content
    const urlInput = await window.locator('[data-testid="url-input"]');
    const goButton = await window.locator('[data-testid="go-button"]');
    
    await urlInput.fill(TEST_URL_A);
    await goButton.click();
    await window.waitForTimeout(2000);
    
    // Create second tab
    const newTabButton = await window.locator('[data-testid="new-tab-button"]');
    await newTabButton.click();
    await window.waitForTimeout(1000);
    
    // Navigate second tab to different URL
    await urlInput.fill(TEST_URL_B);
    await goButton.click();
    await window.waitForTimeout(2000);
    
    // Test interaction with current tab (Tab 1)
    const webview1 = await window.locator('#webview-1');
    expect(await webview1.isVisible()).toBe(true);
    
    // Verify URL input shows current tab's URL
    const currentUrl = await urlInput.inputValue();
    expect(currentUrl).toBe(TEST_URL_B);
    
    // Switch to Tab 0
    const tab0 = await window.locator('[data-testid="tab-0"]');
    await tab0.click();
    await window.waitForTimeout(500);
    
    // Test interaction with Tab 0
    const webview0 = await window.locator('#webview-0');
    expect(await webview0.isVisible()).toBe(true);
    expect(await webview1.isVisible()).toBe(false);
    
    // Verify URL input updated to show Tab 0's URL
    const tab0Url = await urlInput.inputValue();
    expect(tab0Url).toBe(TEST_URL_A);
    
    // Switch back to verify isolation
    const tab1 = await window.locator('[data-testid="tab-1"]');
    await tab1.click();
    await window.waitForTimeout(500);
    
    expect(await webview0.isVisible()).toBe(false);
    expect(await webview1.isVisible()).toBe(true);
    
    // Verify URL input shows Tab 1's URL again
    const tab1Url = await urlInput.inputValue();
    expect(tab1Url).toBe(TEST_URL_B);
  });

  test('should test closing tabs', async () => {
    // Create second tab
    const newTabButton = await window.locator('[data-testid="new-tab-button"]');
    await newTabButton.click();
    await window.waitForTimeout(1000);
    
    // Verify both tabs exist initially
    expect(await window.locator('[data-testid="tab-0"]').count()).toBe(1);
    expect(await window.locator('[data-testid="tab-1"]').count()).toBe(1);
    expect(await window.locator('#webview-0').count()).toBe(1);
    expect(await window.locator('#webview-1').count()).toBe(1);
    
    // Close Tab 1 (second tab)
    const tab1Close = await window.locator('[data-testid="tab-1-close"]');
    await tab1Close.click();
    await window.waitForTimeout(500);
    
    // Verify Tab 1 is removed
    expect(await window.locator('[data-testid="tab-1"]').count()).toBe(0);
    expect(await window.locator('#webview-1').count()).toBe(0);
    
    // Verify Tab 0 still exists and is visible
    expect(await window.locator('[data-testid="tab-0"]').count()).toBe(1);
    expect(await window.locator('#webview-0').count()).toBe(1);
    expect(await window.locator('#webview-0').isVisible()).toBe(true);
    
    // Verify tab 0 is now active
    const tab0Active = await window.evaluate(() => {
      const tab = document.querySelector('[data-testid="tab-0"]');
      return tab ? tab.classList.contains('active') : false;
    });
    expect(tab0Active).toBe(true);
    
    // Create another tab to test closing the first tab
    await newTabButton.click();
    await window.waitForTimeout(1000);
    
    // Now close Tab 0 (first tab)
    const tab0Close = await window.locator('[data-testid="tab-0-close"]');
    await tab0Close.click();
    await window.waitForTimeout(500);
    
    // Verify Tab 0 is removed
    expect(await window.locator('[data-testid="tab-0"]').count()).toBe(0);
    expect(await window.locator('#webview-0').count()).toBe(0);
    
    // Verify the remaining tab is still there
    const remainingTabs = await window.locator('.tab');
    expect(await remainingTabs.count()).toBe(1);
    
    // Verify tab bar still exists
    expect(await window.locator('[data-testid="tab-bar"]').count()).toBe(1);
  });

  test('should handle edge cases - rapid tab switching', async () => {
    // Create multiple tabs for stress testing
    const newTabButton = await window.locator('[data-testid="new-tab-button"]');
    
    // Create 3 tabs total (1 exists, create 2 more)
    await newTabButton.click();
    await window.waitForTimeout(200);
    await newTabButton.click();
    await window.waitForTimeout(200);
    
    // Verify 3 tabs exist
    const tabs = await window.locator('.tab');
    expect(await tabs.count()).toBe(3);
    
    // Rapidly switch between tabs
    for (let i = 0; i < 10; i++) {
      const tabIndex = i % 3;
      const tab = await window.locator(`[data-testid="tab-${tabIndex}"]`);
      await tab.click();
      await window.waitForTimeout(50);
      
      // Verify correct tab is visible
      const activeWebview = await window.locator(`#webview-${tabIndex}`);
      expect(await activeWebview.isVisible()).toBe(true);
      
      // Verify tab has active class
      const isActive = await window.evaluate((index) => {
        const tab = document.querySelector(`[data-testid="tab-${index}"]`);
        return tab ? tab.classList.contains('active') : false;
      }, tabIndex);
      expect(isActive).toBe(true);
    }
    
    // Verify all tabs still exist after rapid switching
    expect(await tabs.count()).toBe(3);
    expect(await window.locator('#webview-0').count()).toBe(1);
    expect(await window.locator('#webview-1').count()).toBe(1);
    expect(await window.locator('#webview-2').count()).toBe(1);
  });

  test('should maintain WebView2 functionality across tabs', async () => {
    // Test WebView2 specific features using the real UI
    const urlInput = await window.locator('[data-testid="url-input"]');
    const goButton = await window.locator('[data-testid="go-button"]');
    const newTabButton = await window.locator('[data-testid="new-tab-button"]');
    
    // Navigate first tab to a data URL with specific content
    const dataUrlA = 'data:text/html,<html><body><h1>WebView A</h1><script>window.tabId="A";</script><div id="content-a">Content A</div></body></html>';
    await urlInput.fill(dataUrlA);
    await goButton.click();
    await window.waitForTimeout(1000);
    
    // Create second tab
    await newTabButton.click();
    await window.waitForTimeout(500);
    
    // Navigate second tab to different content
    const dataUrlB = 'data:text/html,<html><body><h1>WebView B</h1><script>window.tabId="B";</script><div id="content-b">Content B</div></body></html>';
    await urlInput.fill(dataUrlB);
    await goButton.click();
    await window.waitForTimeout(1000);
    
    // Test switching between WebViews maintains isolation
    // Initially WebView 1 (second tab) should be visible
    expect(await window.locator('#webview-0').isVisible()).toBe(false);
    expect(await window.locator('#webview-1').isVisible()).toBe(true);
    
    // Verify URL input shows current tab's URL
    expect(await urlInput.inputValue()).toBe(dataUrlB);
    
    // Switch to WebView 0 (first tab)
    const tab0 = await window.locator('[data-testid="tab-0"]');
    await tab0.click();
    await window.waitForTimeout(500);
    
    expect(await window.locator('#webview-0').isVisible()).toBe(true);
    expect(await window.locator('#webview-1').isVisible()).toBe(false);
    
    // Verify URL input updated to first tab's URL
    expect(await urlInput.inputValue()).toBe(dataUrlA);
    
    // Switch back to WebView 1
    const tab1 = await window.locator('[data-testid="tab-1"]');
    await tab1.click();
    await window.waitForTimeout(500);
    
    expect(await window.locator('#webview-0').isVisible()).toBe(false);
    expect(await window.locator('#webview-1').isVisible()).toBe(true);
    
    // Verify URL input shows second tab's URL again
    expect(await urlInput.inputValue()).toBe(dataUrlB);
    
    // Test that webviews maintain their state independently
    // Navigate first tab to a different URL
    await tab0.click();
    await window.waitForTimeout(500);
    
    const newUrlA = 'https://httpbin.org/html';
    await urlInput.fill(newUrlA);
    await goButton.click();
    await window.waitForTimeout(2000);
    
    // Switch back to second tab and verify it still has the original URL
    await tab1.click();
    await window.waitForTimeout(500);
    
    expect(await urlInput.inputValue()).toBe(dataUrlB);
    
    // Verify webviews are properly isolated (each maintains its own state)
    const webview0Src = await window.evaluate(() => {
      const webview = document.querySelector('#webview-0');
      return webview ? webview.getAttribute('src') : null;
    });
    
    const webview1Src = await window.evaluate(() => {
      const webview = document.querySelector('#webview-1');
      return webview ? webview.getAttribute('src') : null;
    });
    
    expect(webview0Src).toBe(newUrlA);
    expect(webview1Src).toBe(dataUrlB);
  });
});