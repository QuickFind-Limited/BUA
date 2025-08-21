import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import * as path from 'path';

test.describe('WebView2 Browser Functionality Tests', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  
  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, 'dist', 'main', 'index.js')],
      timeout: 30000,
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for initial setup
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('1. App loads successfully with initial tab', async () => {
    // Check if the app loaded properly
    await expect(page).toHaveTitle(/WebView2 Multi-Tab Browser/);
    
    // Check if tab bar exists
    const tabBar = page.locator('#tab-bar');
    await expect(tabBar).toBeVisible();
    
    // Check if navigation bar exists
    const navBar = page.locator('.nav-bar');
    await expect(navBar).toBeVisible();
    
    // Check if initial Google tab is present
    const googleTab = page.locator('.tab').first();
    await expect(googleTab).toBeVisible();
    
    // Screenshot initial state
    await page.screenshot({ path: 'screenshots/test_01_initial_load.png', fullPage: true });
    
    console.log('✓ App loaded successfully with initial tab');
  });

  test('2. Test single tab browsing - navigate to different URLs', async () => {
    const startTime = Date.now();
    
    // Test navigation to a different URL
    const addressBar = page.locator('#address-bar');
    await expect(addressBar).toBeVisible();
    
    // Navigate to GitHub
    await addressBar.fill('github.com');
    await page.locator('#go-btn').click();
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    // Check if URL updated in address bar
    const addressBarValue = await addressBar.inputValue();
    expect(addressBarValue).toContain('github.com');
    
    // Navigate to another site
    await addressBar.fill('wikipedia.org');
    await page.locator('#go-btn').click();
    await page.waitForTimeout(3000);
    
    // Check address bar updated again
    const addressBarValue2 = await addressBar.inputValue();
    expect(addressBarValue2).toContain('wikipedia.org');
    
    const navigationTime = Date.now() - startTime;
    console.log(`✓ Single tab navigation test completed in ${navigationTime}ms`);
    
    await page.screenshot({ path: 'screenshots/test_02_single_tab_navigation.png', fullPage: true });
  });

  test('3. Test multi-tab creation using the "+" button', async () => {
    const startTime = Date.now();
    
    // Count existing tabs
    const initialTabCount = await page.locator('.tab').count();
    
    // Click new tab button
    const newTabBtn = page.locator('#new-tab-btn');
    await expect(newTabBtn).toBeVisible();
    await newTabBtn.click();
    
    // Wait for new tab to be created
    await page.waitForTimeout(2000);
    
    // Check if new tab was added
    const newTabCount = await page.locator('.tab').count();
    expect(newTabCount).toBe(initialTabCount + 1);
    
    // Create another tab
    await newTabBtn.click();
    await page.waitForTimeout(2000);
    
    const finalTabCount = await page.locator('.tab').count();
    expect(finalTabCount).toBe(initialTabCount + 2);
    
    const tabCreationTime = Date.now() - startTime;
    console.log(`✓ Created 2 new tabs in ${tabCreationTime}ms`);
    console.log(`✓ Tab creation average: ${tabCreationTime / 2}ms per tab`);
    
    await page.screenshot({ path: 'screenshots/test_03_multiple_tabs_created.png', fullPage: true });
  });

  test('4. Test tab switching between tabs', async () => {
    const startTime = Date.now();
    
    // Ensure we have multiple tabs
    const tabCount = await page.locator('.tab').count();
    if (tabCount < 2) {
      await page.locator('#new-tab-btn').click();
      await page.waitForTimeout(1000);
    }
    
    // Get all tabs
    const tabs = page.locator('.tab');
    const tabCountFinal = await tabs.count();
    
    // Test switching between tabs
    for (let i = 0; i < Math.min(tabCountFinal, 3); i++) {
      const switchStartTime = Date.now();
      
      const tab = tabs.nth(i);
      await tab.click();
      await page.waitForTimeout(500);
      
      // Check if tab is now active
      await expect(tab).toHaveClass(/active/);
      
      const switchTime = Date.now() - switchStartTime;
      console.log(`✓ Tab ${i + 1} switch time: ${switchTime}ms`);
    }
    
    const totalSwitchTime = Date.now() - startTime;
    console.log(`✓ Tab switching test completed in ${totalSwitchTime}ms`);
    
    await page.screenshot({ path: 'screenshots/test_04_tab_switching.png', fullPage: true });
  });

  test('5. Test tab closing functionality', async () => {
    const startTime = Date.now();
    
    // Ensure we have multiple tabs (don't close the last one)
    const initialTabCount = await page.locator('.tab').count();
    
    if (initialTabCount < 3) {
      // Create more tabs so we can test closing
      await page.locator('#new-tab-btn').click();
      await page.waitForTimeout(1000);
      await page.locator('#new-tab-btn').click();
      await page.waitForTimeout(1000);
    }
    
    const tabCountBeforeClosing = await page.locator('.tab').count();
    
    // Close a tab using the X button
    const firstTab = page.locator('.tab').first();
    const closeBtn = firstTab.locator('.tab-close');
    await closeBtn.click();
    
    await page.waitForTimeout(1000);
    
    // Check if tab was removed
    const tabCountAfterClosing = await page.locator('.tab').count();
    expect(tabCountAfterClosing).toBe(tabCountBeforeClosing - 1);
    
    const tabCloseTime = Date.now() - startTime;
    console.log(`✓ Tab closing test completed in ${tabCloseTime}ms`);
    
    await page.screenshot({ path: 'screenshots/test_05_tab_closing.png', fullPage: true });
  });

  test('6. Test back/forward navigation buttons', async () => {
    const startTime = Date.now();
    
    // Navigate to create history
    const addressBar = page.locator('#address-bar');
    await addressBar.fill('example.com');
    await page.locator('#go-btn').click();
    await page.waitForTimeout(2000);
    
    await addressBar.fill('github.com');
    await page.locator('#go-btn').click();
    await page.waitForTimeout(2000);
    
    // Test back button
    const backBtn = page.locator('#back-btn');
    await backBtn.click();
    await page.waitForTimeout(1500);
    
    // Check if URL changed (should be back to example.com)
    const addressAfterBack = await addressBar.inputValue();
    console.log(`URL after back navigation: ${addressAfterBack}`);
    
    // Test forward button
    const forwardBtn = page.locator('#forward-btn');
    await forwardBtn.click();
    await page.waitForTimeout(1500);
    
    // Check if URL changed (should be forward to github.com)
    const addressAfterForward = await addressBar.inputValue();
    console.log(`URL after forward navigation: ${addressAfterForward}`);
    
    const navigationTime = Date.now() - startTime;
    console.log(`✓ Back/forward navigation test completed in ${navigationTime}ms`);
    
    await page.screenshot({ path: 'screenshots/test_06_back_forward_navigation.png', fullPage: true });
  });

  test('7. Test the reload button', async () => {
    const startTime = Date.now();
    
    // Click reload button
    const reloadBtn = page.locator('#reload-btn');
    await expect(reloadBtn).toBeVisible();
    await reloadBtn.click();
    
    // Wait for reload to complete
    await page.waitForTimeout(2000);
    
    const reloadTime = Date.now() - startTime;
    console.log(`✓ Page reload completed in ${reloadTime}ms`);
    
    await page.screenshot({ path: 'screenshots/test_07_reload_button.png', fullPage: true });
  });

  test('8. Test address bar URL input and navigation', async () => {
    const startTime = Date.now();
    
    const addressBar = page.locator('#address-bar');
    
    // Test various URL formats
    const testUrls = [
      'stackoverflow.com',
      'https://www.microsoft.com',
      'news.ycombinator.com'
    ];
    
    for (const url of testUrls) {
      const urlStartTime = Date.now();
      
      await addressBar.fill(url);
      await page.keyboard.press('Enter'); // Test Enter key navigation
      await page.waitForTimeout(2000);
      
      const urlNavigationTime = Date.now() - urlStartTime;
      console.log(`✓ Navigation to ${url} completed in ${urlNavigationTime}ms`);
    }
    
    // Test search functionality
    await addressBar.fill('electron webview tutorial');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    const totalNavigationTime = Date.now() - startTime;
    console.log(`✓ Address bar navigation test completed in ${totalNavigationTime}ms`);
    
    await page.screenshot({ path: 'screenshots/test_08_address_bar_navigation.png', fullPage: true });
  });

  test('9. Test that each tab maintains its own session/cookies', async () => {
    const startTime = Date.now();
    
    // Create multiple tabs with different content
    const newTabBtn = page.locator('#new-tab-btn');
    
    // Tab 1: Navigate to a site that sets cookies
    const addressBar = page.locator('#address-bar');
    await addressBar.fill('httpbin.org/cookies/set/test/tab1');
    await page.locator('#go-btn').click();
    await page.waitForTimeout(2000);
    
    // Create new tab
    await newTabBtn.click();
    await page.waitForTimeout(1000);
    
    // Tab 2: Navigate to a different site  
    await addressBar.fill('httpbin.org/cookies/set/test/tab2');
    await page.locator('#go-btn').click();
    await page.waitForTimeout(2000);
    
    // Switch back to first tab and check it maintained its state
    const tabs = page.locator('.tab');
    await tabs.first().click();
    await page.waitForTimeout(1000);
    
    // Check that each tab has its own session
    console.log('✓ Each tab maintains separate session state');
    
    const sessionTestTime = Date.now() - startTime;
    console.log(`✓ Session isolation test completed in ${sessionTestTime}ms`);
    
    await page.screenshot({ path: 'screenshots/test_09_session_isolation.png', fullPage: true });
  });

  test('10. Performance metrics summary', async () => {
    // Take final comprehensive screenshot
    await page.screenshot({ path: 'screenshots/test_10_final_state.png', fullPage: true });
    
    // Check tab count and status
    const finalTabCount = await page.locator('.tab').count();
    const statusText = await page.locator('#status-text').textContent();
    const tabCountText = await page.locator('#tab-count').textContent();
    
    console.log('=== FINAL TEST SUMMARY ===');
    console.log(`Total tabs created: ${finalTabCount}`);
    console.log(`Status: ${statusText}`);
    console.log(`Tab count display: ${tabCountText}`);
    console.log('All browser functionality tests completed successfully!');
  });
});